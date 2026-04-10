from pathlib import Path

import pytest

from indexa_worker.parsers import UnsupportedFormatError, parse_document


def test_parse_text_file(tmp_path: Path):
  target = tmp_path / 'sample.txt'
  target.write_text('hello world', encoding='utf-8')
  assert parse_document(target, 'text/plain') == 'hello world'


def test_parse_markdown_by_extension(tmp_path: Path):
  target = tmp_path / 'note.md'
  target.write_text('# heading\n\nbody', encoding='utf-8')
  assert '# heading' in parse_document(target, 'application/octet-stream')


def test_parse_markdown_by_mime(tmp_path: Path):
  target = tmp_path / 'note'
  target.write_text('content', encoding='utf-8')
  assert parse_document(target, 'text/markdown') == 'content'


def test_parse_unsupported_format(tmp_path: Path):
  target = tmp_path / 'binary.bin'
  target.write_bytes(b'\x00\x01')
  with pytest.raises(UnsupportedFormatError):
    parse_document(target, 'application/octet-stream')
