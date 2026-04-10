"""Claim, progress, and finalization SQL for IndexJob rows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.engine import Connection

from .constants import DocumentIndexStateStatus, IndexJobStatus
from .schema import document_index_state, index_job


@dataclass(frozen=True)
class ClaimedJob:
  id: str
  library_id: str
  document_id: str
  library_index_id: str
  document_index_state_id: str
  type: str


def claim_jobs(conn: Connection, worker_id: str, batch: int) -> list[ClaimedJob]:
  candidates = (
    select(index_job.c.id)
    .where(index_job.c.status == IndexJobStatus.QUEUED)
    .order_by(index_job.c.createdAt.asc())
    .limit(batch)
    .with_for_update(skip_locked=True)
  )
  stmt = (
    update(index_job)
    .where(index_job.c.id.in_(candidates.scalar_subquery()))
    .values(
      status=IndexJobStatus.RUNNING,
      lockedAt=func.now(),
      workerId=worker_id,
      startedAt=func.coalesce(index_job.c.startedAt, func.now()),
      updatedAt=func.now(),
    )
    .returning(
      index_job.c.id,
      index_job.c.libraryId,
      index_job.c.documentId,
      index_job.c.libraryIndexId,
      index_job.c.documentIndexStateId,
      index_job.c.type,
    )
  )

  rows = conn.execute(stmt).mappings().all()
  if not rows:
    return []

  conn.execute(
    update(document_index_state)
    .where(
      document_index_state.c.id.in_([row['documentIndexStateId'] for row in rows])
    )
    .values(
      status=DocumentIndexStateStatus.PROCESSING,
      updatedAt=func.now(),
    )
  )

  return [
    ClaimedJob(
      id=row['id'],
      library_id=row['libraryId'],
      document_id=row['documentId'],
      library_index_id=row['libraryIndexId'],
      document_index_state_id=row['documentIndexStateId'],
      type=row['type'],
    )
    for row in rows
  ]


def update_stage(
  conn: Connection,
  job: ClaimedJob,
  stage: str,
  progress_current: int | None = None,
  progress_total: int | None = None,
  progress_unit: str | None = None,
) -> None:
  values: dict[str, Any] = {
    'stage': stage,
    'updatedAt': func.now(),
  }
  if progress_current is not None:
    values['progressCurrent'] = progress_current
  if progress_total is not None:
    values['progressTotal'] = progress_total
  if progress_unit is not None:
    values['progressUnit'] = progress_unit

  conn.execute(
    update(index_job).where(index_job.c.id == job.id).values(**values)
  )
  conn.execute(
    update(document_index_state)
    .where(document_index_state.c.id == job.document_index_state_id)
    .values(stage=stage, updatedAt=func.now())
  )


def mark_job_succeeded(conn: Connection, job: ClaimedJob) -> None:
  conn.execute(
    update(index_job)
    .where(index_job.c.id == job.id)
    .values(
      status=IndexJobStatus.SUCCEEDED,
      stage=None,
      errorMessage=None,
      finishedAt=func.now(),
      updatedAt=func.now(),
    )
  )
  conn.execute(
    update(document_index_state)
    .where(document_index_state.c.id == job.document_index_state_id)
    .values(
      status=DocumentIndexStateStatus.READY,
      stage=None,
      errorMessage=None,
      lastIndexedAt=func.now(),
      updatedAt=func.now(),
    )
  )


def mark_job_failed(
  conn: Connection,
  job: ClaimedJob,
  stage: str | None,
  error_message: str,
) -> None:
  conn.execute(
    update(index_job)
    .where(index_job.c.id == job.id)
    .values(
      status=IndexJobStatus.FAILED,
      stage=stage,
      errorMessage=error_message,
      finishedAt=func.now(),
      updatedAt=func.now(),
    )
  )
  conn.execute(
    update(document_index_state)
    .where(document_index_state.c.id == job.document_index_state_id)
    .values(
      status=DocumentIndexStateStatus.FAILED,
      stage=stage,
      errorMessage=error_message,
      updatedAt=func.now(),
    )
  )
