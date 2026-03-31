import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import fastifySession from '@fastify/secure-session'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import fastify from 'fastify'
import {
  app as appConfig,
  server as serverConfig,
  session as sessionConfig,
} from '../../config/app.js'
import type { Services } from '../../services/index.js'
import type { AppConfig } from './config.js'
import { Router } from './router.js'
import { Service } from './service.js'

type CreateAppOptions = {
  config: AppConfig
  services?: Partial<Services>
}

export const createApp = ({ config, services }: CreateAppOptions) => {
  const app = fastify({
    logger: {
      level: appConfig.logLevel,
    },
  })

  app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: config.name,
        description: `API documentation for ${config.name}`,
        version: '0.1.0',
      },
    },
  })

  app.register(swaggerUI, {
    routePrefix: '/docs',
  })

  app.register(fastifyCookie)

  app.register(fastifySession, {
    secret: sessionConfig.secret,
    salt: sessionConfig.salt,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: appConfig.env === 'production',
    },
  })

  app.register(fastifyMultipart)
  app.addContentTypeParser(/^application\/offset\+octet-stream(;.*)?$/, (_request, payload, done) =>
    done(null, payload),
  )
  app.register(Service, services ? { services } : {})
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
    global.console.log(`API docs available at http://${host}:${actualPort}/docs`)
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
