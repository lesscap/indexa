"""Environment-based configuration for the worker."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# override=True lets apps/worker/.env take precedence over any DASHSCOPE_API_KEY
# or DATABASE_URL that may already be exported in the parent shell (e.g. ~/.zshrc).
load_dotenv(override=True)


@dataclass(frozen=True)
class WorkerConfig:
  database_url: str
  document_storage_root: Path
  qdrant_url: str
  qdrant_api_key: str | None
  dashscope_api_key: str
  worker_batch_size: int
  worker_id: str
  log_level: str


def _require(name: str) -> str:
  value = os.environ.get(name)
  if not value:
    raise RuntimeError(f'Missing required env var: {name}')
  return value


def load_config() -> WorkerConfig:
  return WorkerConfig(
    database_url=_require('DATABASE_URL'),
    document_storage_root=Path(_require('DOCUMENT_STORAGE_ROOT')).resolve(),
    qdrant_url=os.environ.get('QDRANT_URL', 'http://127.0.0.1:6333'),
    qdrant_api_key=os.environ.get('QDRANT_API_KEY') or None,
    dashscope_api_key=_require('DASHSCOPE_API_KEY'),
    worker_batch_size=int(os.environ.get('WORKER_BATCH_SIZE', '5')),
    worker_id=os.environ.get('WORKER_ID') or socket.gethostname(),
    log_level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
  )
