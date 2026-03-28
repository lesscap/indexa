import type { FastifyInstance } from 'fastify'
import fastify from 'fastify'
import { app as appConfig, server as serverConfig } from '../../config/app.js'
import type { AppConfig } from './config.js'
import { Router } from './router.js'

type CreateAppOptions = {
  config: AppConfig
}

export const createApp = ({ config }: CreateAppOptions) => {
  const app = fastify({
    logger: {
      level: appConfig.logLevel,
    },
  })

  app.register(Router, { routes: config.routes })

  return app
}

type ListenOptions = {
  port?: number
  host?: string
}

export const listen = async (app: FastifyInstance, options: ListenOptions = {}) => {
  const port = options.port || serverConfig.port
  const host = options.host || serverConfig.host

  try {
    await app.listen({ port, host })
    await app.ready()

    const address = app.server.address()
    const actualPort = typeof address === 'string' ? address : address?.port
    global.console.log(`Server listening on http://${host}:${actualPort}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }

  const shutdown = (signal: string) => {
    global.console.log(`${signal} received, closing server...`)
    app.close().finally(() => {
      global.console.log('Server closed')
      process.exit(0)
    })
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}
