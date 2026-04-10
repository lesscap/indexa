"""SQLAlchemy Core Table definitions mirroring apps/server/prisma/schema.prisma.

Only columns actually used by the worker are declared. Table names and column
names match Prisma's PascalCase/camelCase quoted identifiers exactly.
"""

from __future__ import annotations

from sqlalchemy import (
  JSON,
  BigInteger,
  Column,
  DateTime,
  Integer,
  MetaData,
  String,
  Table,
  Text,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

metadata = MetaData()

# Prisma creates these as native Postgres enum types. We mirror them with
# create_type=False so SQLAlchemy casts bound parameters correctly but does
# not attempt to CREATE TYPE at startup.
index_job_status_enum = PGEnum(
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
  name='IndexJobStatus',
  create_type=False,
)

index_job_stage_enum = PGEnum(
  'PARSING',
  'CHUNKING',
  'EMBEDDING',
  'UPSERTING',
  'FINALIZING',
  name='IndexJobStage',
  create_type=False,
)

document_index_state_status_enum = PGEnum(
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
  name='DocumentIndexStateStatus',
  create_type=False,
)

domain = Table(
  'Domain',
  metadata,
  Column('id', String, primary_key=True),
  Column('slug', String, nullable=False),
)

library = Table(
  'Library',
  metadata,
  Column('id', String, primary_key=True),
  Column('domainId', String, nullable=False),
  Column('slug', String, nullable=False),
  Column('activeIndexId', String),
)

document = Table(
  'Document',
  metadata,
  Column('id', String, primary_key=True),
  Column('libraryId', String, nullable=False),
  Column('title', String, nullable=False),
  Column('originalName', String, nullable=False),
  Column('mimeType', String, nullable=False),
  Column('sizeBytes', BigInteger, nullable=False),
  Column('checksumSha256', String, nullable=False),
  Column('storagePath', Text, nullable=False),
)

embedding_profile = Table(
  'EmbeddingProfile',
  metadata,
  Column('id', String, primary_key=True),
  Column('provider', String, nullable=False),
  Column('model', String, nullable=False),
  Column('dimensions', Integer, nullable=False),
  Column('distanceMetric', String, nullable=False),
)

library_index = Table(
  'LibraryIndex',
  metadata,
  Column('id', String, primary_key=True),
  Column('libraryId', String, nullable=False),
  Column('embeddingProfileId', String, nullable=False),
  Column('qdrantCollectionName', String, nullable=False),
  Column('chunkStrategy', String, nullable=False),
  Column('chunkConfig', JSON),
)

document_index_state = Table(
  'DocumentIndexState',
  metadata,
  Column('id', String, primary_key=True),
  Column('documentId', String, nullable=False),
  Column('libraryIndexId', String, nullable=False),
  Column('status', document_index_state_status_enum, nullable=False),
  Column('stage', index_job_stage_enum),
  Column('lastIndexedAt', DateTime(timezone=True)),
  Column('errorMessage', Text),
  Column('updatedAt', DateTime(timezone=True), nullable=False),
)

index_job = Table(
  'IndexJob',
  metadata,
  Column('id', String, primary_key=True),
  Column('libraryId', String, nullable=False),
  Column('documentId', String, nullable=False),
  Column('libraryIndexId', String, nullable=False),
  Column('documentIndexStateId', String, nullable=False),
  Column('type', String, nullable=False),
  Column('status', index_job_status_enum, nullable=False),
  Column('stage', index_job_stage_enum),
  Column('progressCurrent', Integer),
  Column('progressTotal', Integer),
  Column('progressUnit', String),
  Column('lockedAt', DateTime(timezone=True)),
  Column('workerId', String),
  Column('errorMessage', Text),
  Column('startedAt', DateTime(timezone=True)),
  Column('finishedAt', DateTime(timezone=True)),
  Column('createdAt', DateTime(timezone=True), nullable=False),
  Column('updatedAt', DateTime(timezone=True), nullable=False),
)

document_chunk = Table(
  'DocumentChunk',
  metadata,
  Column('id', String, primary_key=True),
  Column('documentId', String, nullable=False),
  Column('libraryIndexId', String, nullable=False),
  Column('chunkNo', Integer, nullable=False),
  Column('textPath', Text, nullable=False),
  Column('charCount', Integer, nullable=False),
  Column('tokenCount', Integer),
  Column('contentHash', String, nullable=False),
  Column('qdrantPointId', String, nullable=False),
  Column('metadataJson', JSON),
  Column('createdAt', DateTime(timezone=True), nullable=False),
)
