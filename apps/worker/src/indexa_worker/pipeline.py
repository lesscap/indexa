"""Five-stage indexing pipeline orchestration."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Engine

from .chunking import Chunk, resolve_chunk_config, split_text
from .config import WorkerConfig
from .constants import IndexJobStage
from .embeddings import embed_texts
from .ids import new_cuid, new_uuid
from .job_queue import ClaimedJob, mark_job_failed, mark_job_succeeded, update_stage
from .parsers import parse_document
from .schema import (
  document,
  document_chunk,
  domain,
  embedding_profile,
  library,
  library_index,
)
from .storage import chunk_directory, chunk_file_path, relative_to_storage, resolve_document_path
from .vectorstore import VectorPoint, build_client, delete_document_points, ensure_collection, upsert_points

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class JobContext:
  document_id: str
  document_mime_type: str
  document_storage_path: str
  document_title: str
  library_id: str
  library_index_id: str
  qdrant_collection: str
  chunk_config: dict | None
  embedding_model: str
  embedding_dimensions: int
  distance_metric: str


def load_job_context(engine: Engine, job: ClaimedJob) -> JobContext:
  stmt = (
    select(
      document.c.id.label('document_id'),
      document.c.mimeType.label('mime_type'),
      document.c.storagePath.label('storage_path'),
      document.c.title.label('title'),
      library.c.id.label('library_id'),
      library_index.c.id.label('library_index_id'),
      library_index.c.qdrantCollectionName.label('qdrant_collection'),
      library_index.c.chunkConfig.label('chunk_config'),
      embedding_profile.c.model.label('model'),
      embedding_profile.c.dimensions.label('dimensions'),
      embedding_profile.c.distanceMetric.label('distance_metric'),
    )
    .select_from(
      document.join(library, document.c.libraryId == library.c.id)
      .join(domain, library.c.domainId == domain.c.id)
      .join(library_index, library_index.c.id == job.library_index_id)
      .join(
        embedding_profile,
        embedding_profile.c.id == library_index.c.embeddingProfileId,
      )
    )
    .where(document.c.id == job.document_id)
  )
  with engine.connect() as conn:
    row = conn.execute(stmt).mappings().first()
  if not row:
    raise RuntimeError(f'Job context not found for job {job.id}')

  return JobContext(
    document_id=row['document_id'],
    document_mime_type=row['mime_type'],
    document_storage_path=row['storage_path'],
    document_title=row['title'],
    library_id=row['library_id'],
    library_index_id=row['library_index_id'],
    qdrant_collection=row['qdrant_collection'],
    chunk_config=row['chunk_config'],
    embedding_model=row['model'],
    embedding_dimensions=row['dimensions'],
    distance_metric=row['distance_metric'],
  )


def _write_chunks_to_disk(
  chunks: list[Chunk],
  storage_root: Path,
  library_index_id: str,
  document_id: str,
) -> list[str]:
  directory = chunk_directory(storage_root, library_index_id, document_id)
  directory.mkdir(parents=True, exist_ok=True)
  relative_paths: list[str] = []
  for chunk in chunks:
    absolute = chunk_file_path(directory, chunk.chunk_no)
    absolute.write_text(chunk.text, encoding='utf-8')
    relative_paths.append(relative_to_storage(storage_root, absolute))
  return relative_paths


def _replace_document_chunks(
  engine: Engine,
  context: JobContext,
  chunks: list[Chunk],
  chunk_paths: list[str],
  qdrant_point_ids: list[str],
) -> None:
  with engine.begin() as conn:
    conn.execute(
      delete(document_chunk).where(
        (document_chunk.c.documentId == context.document_id)
        & (document_chunk.c.libraryIndexId == context.library_index_id)
      )
    )
    if not chunks:
      return
    # Client-side timestamp mirrors Prisma's @default(now()) semantics (the
    # default is applied by Prisma client, not by Postgres). executemany-mode
    # bulk insert cannot take SQL expressions like func.now() in parameters.
    now = datetime.now(timezone.utc)
    conn.execute(
      insert(document_chunk),
      [
        {
          'id': new_cuid(),
          'documentId': context.document_id,
          'libraryIndexId': context.library_index_id,
          'chunkNo': chunk.chunk_no,
          'textPath': path,
          'charCount': chunk.char_count,
          'tokenCount': None,
          'contentHash': chunk.content_hash,
          'qdrantPointId': point_id,
          'metadataJson': None,
          'createdAt': now,
        }
        for chunk, path, point_id in zip(chunks, chunk_paths, qdrant_point_ids, strict=True)
      ],
    )


def run_job(engine: Engine, config: WorkerConfig, job: ClaimedJob) -> None:
  current_stage: str | None = None
  try:
    context = load_job_context(engine, job)

    # --- PARSING ---
    current_stage = IndexJobStage.PARSING
    with engine.begin() as conn:
      update_stage(conn, job, current_stage)
    document_path = resolve_document_path(
      config.document_storage_root, context.document_storage_path
    )
    text = parse_document(document_path, context.document_mime_type)
    logger.info('job=%s parsed %d chars from %s', job.id, len(text), document_path.name)

    # --- CHUNKING ---
    current_stage = IndexJobStage.CHUNKING
    chunk_size, chunk_overlap = resolve_chunk_config(context.chunk_config)
    chunks = split_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    if not chunks:
      raise RuntimeError('Document produced zero chunks after splitting')

    chunk_paths = _write_chunks_to_disk(
      chunks,
      config.document_storage_root,
      context.library_index_id,
      context.document_id,
    )
    with engine.begin() as conn:
      update_stage(
        conn,
        job,
        current_stage,
        progress_current=len(chunks),
        progress_total=len(chunks),
        progress_unit='chunks',
      )
    logger.info('job=%s produced %d chunks', job.id, len(chunks))

    # --- EMBEDDING ---
    current_stage = IndexJobStage.EMBEDDING
    with engine.begin() as conn:
      update_stage(conn, job, current_stage, progress_current=0, progress_total=len(chunks))
    vectors = embed_texts(
      [chunk.text for chunk in chunks],
      model=context.embedding_model,
      api_key=config.dashscope_api_key,
    )
    if len(vectors) != len(chunks):
      raise RuntimeError(f'Embedding count {len(vectors)} != chunk count {len(chunks)}')
    for vector in vectors:
      if len(vector) != context.embedding_dimensions:
        raise RuntimeError(
          f'Embedding dim {len(vector)} != profile dim {context.embedding_dimensions}'
        )
    with engine.begin() as conn:
      update_stage(
        conn, job, current_stage, progress_current=len(chunks), progress_total=len(chunks)
      )
    logger.info('job=%s embedded %d chunks', job.id, len(chunks))

    # --- UPSERTING ---
    current_stage = IndexJobStage.UPSERTING
    with engine.begin() as conn:
      update_stage(conn, job, current_stage)
    client = build_client(config.qdrant_url, config.qdrant_api_key)
    ensure_collection(
      client,
      context.qdrant_collection,
      context.embedding_dimensions,
      context.distance_metric,
    )
    delete_document_points(client, context.qdrant_collection, context.document_id)

    qdrant_point_ids = [new_uuid() for _ in chunks]
    points = [
      VectorPoint(
        point_id=point_id,
        vector=vector,
        payload={
          'document_id': context.document_id,
          'library_id': context.library_id,
          'library_index_id': context.library_index_id,
          'chunk_no': chunk.chunk_no,
          'text_path': path,
          'content_hash': chunk.content_hash,
          'mime_type': context.document_mime_type,
          'document_title': context.document_title,
        },
      )
      for point_id, vector, chunk, path in zip(
        qdrant_point_ids, vectors, chunks, chunk_paths, strict=True
      )
    ]
    upsert_points(client, context.qdrant_collection, points)
    _replace_document_chunks(engine, context, chunks, chunk_paths, qdrant_point_ids)
    logger.info('job=%s upserted %d points to %s', job.id, len(points), context.qdrant_collection)

    # --- FINALIZING ---
    current_stage = IndexJobStage.FINALIZING
    with engine.begin() as conn:
      update_stage(conn, job, current_stage)
      mark_job_succeeded(conn, job)
    logger.info('job=%s SUCCEEDED', job.id)

  except Exception as exc:
    logger.exception('job=%s FAILED at stage %s', job.id, current_stage)
    with engine.begin() as conn:
      mark_job_failed(conn, job, current_stage, f'{type(exc).__name__}: {exc}')
