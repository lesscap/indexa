"""Filesystem path resolution, aligned with the Node server's layout."""

from __future__ import annotations

from pathlib import Path


def resolve_document_path(storage_root: Path, relative_path: str) -> Path:
  """Resolve a Document.storagePath into an absolute filesystem path.

  Rejects traversal attempts that would escape the storage root.
  """
  absolute = (storage_root / relative_path).resolve()
  storage_root_resolved = storage_root.resolve()
  if storage_root_resolved not in absolute.parents and absolute != storage_root_resolved:
    raise ValueError(f'Path escapes storage root: {relative_path}')
  return absolute


def chunk_directory(storage_root: Path, library_index_id: str, document_id: str) -> Path:
  return storage_root / 'chunks' / library_index_id / document_id


def chunk_file_path(directory: Path, chunk_no: int) -> Path:
  return directory / f'chunk-{chunk_no:05d}.txt'


def relative_to_storage(storage_root: Path, absolute: Path) -> str:
  return str(absolute.relative_to(storage_root))
