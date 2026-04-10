"""Recursive text splitting, aligned with chunkStrategy="recursive_text"."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter

DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 120


@dataclass(frozen=True)
class Chunk:
  chunk_no: int
  text: str
  char_count: int
  content_hash: str


def split_text(
  text: str,
  chunk_size: int = DEFAULT_CHUNK_SIZE,
  chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[Chunk]:
  splitter = RecursiveCharacterTextSplitter(
    chunk_size=chunk_size,
    chunk_overlap=chunk_overlap,
    length_function=len,
    separators=['\n\n', '\n', '. ', ' ', ''],
  )
  raw_chunks = splitter.split_text(text)
  return [
    Chunk(
      chunk_no=index,
      text=chunk_text,
      char_count=len(chunk_text),
      content_hash=hashlib.sha256(chunk_text.encode('utf-8')).hexdigest(),
    )
    for index, chunk_text in enumerate(raw_chunks)
    if chunk_text.strip()
  ]


def resolve_chunk_config(config: dict | None) -> tuple[int, int]:
  config = config or {}
  size = int(config.get('chunk_size') or DEFAULT_CHUNK_SIZE)
  overlap = int(config.get('chunk_overlap') or DEFAULT_CHUNK_OVERLAP)
  return size, overlap
