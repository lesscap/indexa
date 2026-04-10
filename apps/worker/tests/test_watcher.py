import threading
import time

from indexa_worker.watcher import Watcher, strip_sqlalchemy_prefix


def test_strip_sqlalchemy_prefix_converts_driver_url():
  assert (
    strip_sqlalchemy_prefix('postgresql+psycopg://user:pw@host:5432/db')
    == 'postgresql://user:pw@host:5432/db'
  )


def test_strip_sqlalchemy_prefix_leaves_plain_url_untouched():
  assert strip_sqlalchemy_prefix('postgresql://user@host/db') == 'postgresql://user@host/db'


def test_request_stop_aborts_loop_without_connecting():
  calls: list[int] = []

  def fake_process() -> None:
    calls.append(1)

  watcher = Watcher(database_url='postgresql://invalid:0', process_once=fake_process)
  # Flip the stop flag before run(); the loop should exit immediately without
  # ever attempting to open a psycopg connection (which would raise).
  watcher.request_stop()
  exit_code = watcher.run()
  assert exit_code == 0
  assert calls == []


def test_request_stop_from_another_thread_breaks_reconnect_backoff():
  watcher = Watcher(database_url='postgresql://127.0.0.1:1/none', process_once=lambda: None)

  def stop_after_delay() -> None:
    time.sleep(0.2)
    watcher.request_stop()

  t = threading.Thread(target=stop_after_delay)
  t.start()
  start = time.monotonic()
  exit_code = watcher.run()  # will fail to connect, enter backoff, then get stopped
  elapsed = time.monotonic() - start
  t.join()
  assert exit_code == 0
  # Reconnect backoff is 5s; stop flag should cut it short well under that.
  assert elapsed < 3
