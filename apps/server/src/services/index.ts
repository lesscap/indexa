import type { PrismaService } from './prisma.js'
import type { QdrantService } from './qdrant.js'

export type Services = {
  $prisma: PrismaService
  $qdrant: QdrantService
}
