import fp from 'fastify-plugin'
import type { Services } from '../../services/index.js'
import { createPrismaService } from '../../services/prisma.js'

export type ServiceOptions = {
  services?: Partial<Services>
}

export const Service = fp<ServiceOptions>(async (app, options) => {
  const prisma = options.services?.$prisma ?? createPrismaService()

  app.decorate('$prisma', prisma)

  if (!options.services?.$prisma) {
    app.addHook('onClose', async () => {
      await prisma.$disconnect()
    })
  }
})
