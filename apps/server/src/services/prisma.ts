import { PrismaClient } from '@prisma/client'

export type PrismaService = PrismaClient

export const createPrismaService = () => {
  return new PrismaClient()
}
