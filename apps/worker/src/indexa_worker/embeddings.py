"""DashScope QWEN embeddings client."""

from __future__ import annotations

import time
from collections.abc import Iterable

import dashscope
from dashscope import TextEmbedding

BATCH_SIZE = 10
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2.0


class EmbeddingError(Exception):
  pass


def _chunked(items: list[str], size: int) -> Iterable[list[str]]:
  for start in range(0, len(items), size):
    yield items[start : start + size]


def embed_texts(texts: list[str], model: str, api_key: str) -> list[list[float]]:
  dashscope.api_key = api_key
  vectors: list[list[float]] = []

  for batch in _chunked(texts, BATCH_SIZE):
    vectors.extend(_embed_batch(batch, model))

  return vectors


def _embed_batch(batch: list[str], model: str) -> list[list[float]]:
  last_error: Exception | None = None
  for attempt in range(1, MAX_RETRIES + 1):
    try:
      response = TextEmbedding.call(model=model, input=batch)
      if response.status_code != 200:
        raise EmbeddingError(
          f'DashScope returned status {response.status_code}: {response.message}'
        )
      embeddings = response.output.get('embeddings') or []
      if len(embeddings) != len(batch):
        raise EmbeddingError(
          f'Expected {len(batch)} embeddings, got {len(embeddings)}'
        )
      embeddings.sort(key=lambda item: item['text_index'])
      return [item['embedding'] for item in embeddings]
    except Exception as exc:
      last_error = exc
      if attempt < MAX_RETRIES:
        time.sleep(RETRY_BACKOFF_SECONDS * attempt)
  raise EmbeddingError(f'Embedding call failed after {MAX_RETRIES} retries: {last_error}')
