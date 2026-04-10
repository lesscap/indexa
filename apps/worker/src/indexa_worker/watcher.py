"""Long-running daemon that consumes IndexJob via Postgres LISTEN/NOTIFY.

Uses a dedicated raw psycopg connection so the LISTEN does not permanently
occupy a slot in the SQLAlchemy engine pool. Falls back to a periodic poll
so that missed notifications (dropped connections, races) are eventually
recovered without manual intervention.
"""

from __future__ import annotations

import logging
import signal
import threading
from collections.abc import Callable

import psycopg

NOTIFY_CHANNEL = 'indexa_job'
# The fallback poll runs only if NOTIFY was lost (connection drop, race).
# Kept short so SIGINT/SIGTERM can cut through the psycopg notifies() block
# in bounded time — NOTIFY itself is still the primary wake path.
POLL_FALLBACK_SECONDS = 5
RECONNECT_BACKOFF_SECONDS = 5

logger = logging.getLogger(__name__)


def strip_sqlalchemy_prefix(url: str) -> str:
  """Convert an SQLAlchemy URL into a libpq-compatible URL for raw psycopg."""
  prefix = 'postgresql+psycopg://'
  if url.startswith(prefix):
    return 'postgresql://' + url[len(prefix) :]
  return url


class Watcher:
  def __init__(self, database_url: str, process_once: Callable[[], None]) -> None:
    self._database_url = strip_sqlalchemy_prefix(database_url)
    self._process_once = process_once
    self._stop = threading.Event()

  def request_stop(self) -> None:
    self._stop.set()

  def run(self) -> int:
    self._install_signal_handlers()
    while not self._stop.is_set():
      try:
        self._listen_loop()
      except Exception:
        logger.exception('watcher loop crashed, reconnecting in %ds', RECONNECT_BACKOFF_SECONDS)
        if self._stop.wait(RECONNECT_BACKOFF_SECONDS):
          break
    logger.info('watcher stopped')
    return 0

  def _listen_loop(self) -> None:
    with psycopg.connect(self._database_url, autocommit=True) as conn:
      conn.execute(f'LISTEN {NOTIFY_CHANNEL}')
      logger.info('listening on channel %s', NOTIFY_CHANNEL)
      # Initial sweep catches anything that was queued while the worker was
      # down or that arrived between LISTEN and the first wait.
      self._safe_process()
      while not self._stop.is_set():
        notifies = conn.notifies(timeout=POLL_FALLBACK_SECONDS, stop_after=1)
        # We do not care about the payload; any wakeup means "go claim".
        for _ in notifies:
          pass
        if self._stop.is_set():
          break
        self._safe_process()

  def _safe_process(self) -> None:
    try:
      self._process_once()
    except Exception:
      logger.exception('process_once raised, continuing')

  def _install_signal_handlers(self) -> None:
    for sig in (signal.SIGINT, signal.SIGTERM):
      signal.signal(sig, self._handle_signal)

  def _handle_signal(self, signum: int, _frame: object) -> None:
    logger.info('received signal %s, stopping', signum)
    self._stop.set()
