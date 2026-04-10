"""CLI entry point for the indexa worker."""

from __future__ import annotations

import argparse
import logging
import sys

from .config import WorkerConfig, load_config
from .db import get_engine
from .job_queue import claim_jobs
from .pipeline import run_job
from .watcher import Watcher

logger = logging.getLogger('indexa_worker')


def _configure_logging(level: str) -> None:
  logging.basicConfig(
    level=getattr(logging, level, logging.INFO),
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
  )


def _claim_and_process(config: WorkerConfig, batch: int, worker_id: str) -> int:
  """Shared body for one-shot run and each wakeup inside watch."""
  engine = get_engine()
  with engine.begin() as conn:
    claimed = claim_jobs(conn, worker_id=worker_id, batch=batch)

  if not claimed:
    logger.info('no queued jobs')
    return 0

  logger.info('claimed %d jobs', len(claimed))
  for job in claimed:
    logger.info('processing job=%s document=%s', job.id, job.document_id)
    run_job(engine, config, job)

  return len(claimed)


def _watch(config: WorkerConfig, batch: int, worker_id: str) -> int:
  def process_once() -> None:
    _claim_and_process(config, batch=batch, worker_id=worker_id)

  watcher = Watcher(database_url=config.database_url, process_once=process_once)
  return watcher.run()


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(prog='indexa_worker')
  sub = parser.add_subparsers(dest='command', required=True)

  run_cmd = sub.add_parser('run', help='claim queued jobs and process them once')
  run_cmd.add_argument('--batch', type=int, default=None, help='max jobs to claim')
  run_cmd.add_argument('--worker-id', type=str, default=None, help='override worker id')

  watch_cmd = sub.add_parser(
    'watch',
    help='run as a long-lived daemon using Postgres LISTEN/NOTIFY for real-time wakeups',
  )
  watch_cmd.add_argument('--batch', type=int, default=None, help='max jobs to claim per wakeup')
  watch_cmd.add_argument('--worker-id', type=str, default=None, help='override worker id')

  args = parser.parse_args(argv)
  config = load_config()
  _configure_logging(config.log_level)

  batch = args.batch if args.batch is not None else config.worker_batch_size
  worker_id = args.worker_id if args.worker_id is not None else config.worker_id

  if args.command == 'run':
    _claim_and_process(config, batch=batch, worker_id=worker_id)
    return 0
  if args.command == 'watch':
    return _watch(config, batch=batch, worker_id=worker_id)

  parser.error(f'unknown command: {args.command}')
  return 2


if __name__ == '__main__':
  sys.exit(main())
