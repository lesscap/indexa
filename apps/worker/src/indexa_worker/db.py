"""SQLAlchemy engine singleton and transaction helpers."""

from __future__ import annotations

from functools import lru_cache

from sqlalchemy import Engine, create_engine

from .config import load_config


@lru_cache(maxsize=1)
def get_engine() -> Engine:
  config = load_config()
  return create_engine(
    config.database_url,
    pool_pre_ping=True,
    future=True,
  )
