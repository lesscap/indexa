"""Mirrors of enum literals from apps/server/prisma/schema.prisma.

Keep these in sync manually. Not auto-generated.
"""

from __future__ import annotations

from typing import Final


class IndexJobStatus:
  QUEUED: Final = 'QUEUED'
  RUNNING: Final = 'RUNNING'
  SUCCEEDED: Final = 'SUCCEEDED'
  FAILED: Final = 'FAILED'
  CANCELED: Final = 'CANCELED'


class IndexJobStage:
  PARSING: Final = 'PARSING'
  CHUNKING: Final = 'CHUNKING'
  EMBEDDING: Final = 'EMBEDDING'
  UPSERTING: Final = 'UPSERTING'
  FINALIZING: Final = 'FINALIZING'


class DocumentIndexStateStatus:
  QUEUED: Final = 'QUEUED'
  PROCESSING: Final = 'PROCESSING'
  READY: Final = 'READY'
  FAILED: Final = 'FAILED'


class DistanceMetric:
  COSINE: Final = 'COSINE'
