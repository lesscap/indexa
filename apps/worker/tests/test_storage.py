from pathlib import Path

import pytest

from indexa_worker.storage import (
  chunk_directory,
  chunk_file_path,
  relative_to_storage,
  resolve_document_path,
)


def test_resolve_document_path_success(tmp_path: Path):
  target = tmp_path / 'domains' / 'dev' / 'documents' / 'doc1' / 'source.md'
  target.parent.mkdir(parents=True)
  target.write_text('body', encoding='utf-8')
  resolved = resolve_document_path(tmp_path, 'domains/dev/documents/doc1/source.md')
  assert resolved == target


def test_resolve_document_path_rejects_traversal(tmp_path: Path):
  with pytest.raises(ValueError):
    resolve_document_path(tmp_path, '../escape.txt')


def test_chunk_paths(tmp_path: Path):
  directory = chunk_directory(tmp_path, 'lib_idx', 'doc1')
  assert directory == tmp_path / 'chunks' / 'lib_idx' / 'doc1'
  assert chunk_file_path(directory, 3).name == 'chunk-00003.txt'


def test_relative_to_storage(tmp_path: Path):
  absolute = tmp_path / 'chunks' / 'lib' / 'doc' / 'chunk-00000.txt'
  assert relative_to_storage(tmp_path, absolute) == 'chunks/lib/doc/chunk-00000.txt'
