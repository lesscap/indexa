import { QdrantClient } from '@qdrant/js-client-rest'
import { qdrant } from '../config/app.js'

export type QdrantService = QdrantClient

export const createQdrantService = () => {
  return new QdrantClient(
    qdrant.apiKey ? { url: qdrant.url, apiKey: qdrant.apiKey } : { url: qdrant.url },
  )
}
