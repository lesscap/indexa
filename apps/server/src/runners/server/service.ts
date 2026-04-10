import fp from 'fastify-plugin'
import type { Services } from '../../services/index.js'
import { createPrismaService } from '../../services/prisma.js'
import { createQdrantService } from '../../services/qdrant.js'

export type ServiceOptions = {
  services?: Partial<Services>
}

export const Service = fp<ServiceOptions>(async (app, options) => {
  const prisma = options.services?.$prisma ?? createPrismaService()
  const qdrant = options.services?.$qdrant ?? createQdrantService()

  app.decorate('$prisma', prisma)
  app.decorate('$qdrant', qdrant)

  if (!options.services?.$prisma) {
    app.addHook('onClose', async () => {
      await prisma.$disconnect()
    })
  }
})
