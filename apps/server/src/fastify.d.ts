import '@fastify/secure-session'
import 'fastify'
import type { Services } from './services/index.js'

declare module '@fastify/secure-session' {
  interface SessionData {
    userId?: string
    currentDomainId?: string
  }
}

declare module 'fastify' {
  interface FastifyInstance extends Services {}
}
