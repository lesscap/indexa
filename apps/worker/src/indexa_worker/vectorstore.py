"""Qdrant client wrapper for collection management and upserts."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from .constants import DistanceMetric

_DISTANCE_MAP = {
  DistanceMetric.COSINE: rest.Distance.COSINE,
}

_LOCAL_HOSTS = {'127.0.0.1', 'localhost', '::1'}


@dataclass(frozen=True)
class VectorPoint:
  point_id: str
  vector: list[float]
  payload: dict


def build_client(url: str, api_key: str | None) -> QdrantClient:
  # When Qdrant is on localhost there's no reason to honor the shell proxy
  # (ALL_PROXY / HTTPS_PROXY). trust_env=False disables httpx's env-var scan
  # on Client init so a SOCKS proxy in the shell does not cause an eager
  # transport construction (which fails without socksio installed).
  host = (urlparse(url).hostname or '').lower()
  kwargs: dict = {'url': url, 'api_key': api_key, 'prefer_grpc': False}
  if host in _LOCAL_HOSTS:
    kwargs['trust_env'] = False
  return QdrantClient(**kwargs)


def ensure_collection(
  client: QdrantClient,
  name: str,
  dimensions: int,
  distance_metric: str,
) -> None:
  distance = _DISTANCE_MAP.get(distance_metric)
  if distance is None:
    raise ValueError(f'Unsupported distance metric: {distance_metric}')

  if client.collection_exists(name):
    return

  client.create_collection(
    collection_name=name,
    vectors_config=rest.VectorParams(size=dimensions, distance=distance),
  )


def delete_document_points(client: QdrantClient, collection: str, document_id: str) -> None:
  client.delete(
    collection_name=collection,
    points_selector=rest.FilterSelector(
      filter=rest.Filter(
        must=[
          rest.FieldCondition(
            key='document_id',
            match=rest.MatchValue(value=document_id),
          ),
        ]
      )
    ),
  )


def upsert_points(client: QdrantClient, collection: str, points: list[VectorPoint]) -> None:
  if not points:
    return
  client.upsert(
    collection_name=collection,
    points=[
      rest.PointStruct(id=p.point_id, vector=p.vector, payload=p.payload)
      for p in points
    ],
  )
