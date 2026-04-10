"""CLI entry point for the indexa worker."""

from __future__ import annotations

import argparse
import logging
import sys

from .config import WorkerConfig, load_config
from .db import get_engine
from .job_queue import claim_jobs
from .pipeline import run_job

logger = logging.getLogger('indexa_worker')


def _configure_logging(level: str) -> None:
  logging.basicConfig(
    level=getattr(logging, level, logging.INFO),
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
  )


def _run(config: WorkerConfig, batch: int, worker_id: str) -> int:
  engine = get_engine()
  with engine.begin() as conn:
    claimed = claim_jobs(conn, worker_id=worker_id, batch=batch)

  if not claimed:
    logger.info('no queued jobs, exiting')
    return 0

  logger.info('claimed %d jobs', len(claimed))
  for job in claimed:
    logger.info('processing job=%s document=%s', job.id, job.document_id)
    run_job(engine, config, job)

  return 0


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(prog='indexa_worker')
  sub = parser.add_subparsers(dest='command', required=True)

  run_cmd = sub.add_parser('run', help='claim queued jobs and process them once')
  run_cmd.add_argument('--batch', type=int, default=None, help='max jobs to claim')
  run_cmd.add_argument('--worker-id', type=str, default=None, help='override worker id')

  args = parser.parse_args(argv)
  config = load_config()
  _configure_logging(config.log_level)

  if args.command == 'run':
    batch = args.batch if args.batch is not None else config.worker_batch_size
    worker_id = args.worker_id if args.worker_id is not None else config.worker_id
    return _run(config, batch=batch, worker_id=worker_id)

  parser.error(f'unknown command: {args.command}')
  return 2


if __name__ == '__main__':
  sys.exit(main())
