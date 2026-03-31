import type { FastifyRequest } from 'fastify'
import type { ApiResponse, WebApplication } from '../../../types.js'
import { SessionService } from '../services/session.js'

type LoginBody = {
  username: string
  password: string
}

export const SessionController = (app: WebApplication) => {
  const service = SessionService(app)

  app.post(
    '/',
    {
      schema: {
        summary: 'Login to the console',
        tags: ['console.session'],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 64 },
            password: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply) => {
      const result = await service.login(request.body.username, request.body.password)

      if (!result.ok) {
        const statusCode =
          result.code === 'USER_NOT_FOUND' ? 404 : result.code === 'USER_DISABLED' ? 403 : 401
        const response: ApiResponse = {
          success: false,
          code: result.code,
          message: result.message,
        }

        return reply.code(statusCode).send(response)
      }

      request.session.set('userId', result.data.id)
      request.session.set('currentDomainId', result.data.currentDomainId)

      const response: ApiResponse<{ session: typeof result.data }> = {
        success: true,
        data: {
          session: result.data,
        },
      }

      return response
    },
  )

  app.get(
    '/',
    {
      schema: {
        summary: 'Get the current console session',
        tags: ['console.session'],
      },
    },
    async (request, reply) => {
      const userId = request.session.get('userId')

      if (typeof userId !== 'string' || userId.length === 0) {
        const response: ApiResponse = {
          success: false,
          code: 'SESSION_REQUIRED',
          message: 'Please login first.',
        }

        return reply.code(401).send(response)
      }

      const session = await service.getCurrent(userId)

      if (!session) {
        request.session.delete()

        const response: ApiResponse = {
          success: false,
          code: 'SESSION_INVALID',
          message: 'Current session is invalid.',
        }

        return reply.code(401).send(response)
      }

      const response: ApiResponse<{ session: typeof session }> = {
        success: true,
        data: {
          session,
        },
      }

      return response
    },
  )

  app.delete(
    '/',
    {
      schema: {
        summary: 'Logout from the console',
        tags: ['console.session'],
      },
    },
    async request => {
      request.session.delete()

      const response: ApiResponse<{ loggedOut: true }> = {
        success: true,
        data: {
          loggedOut: true,
        },
      }

      return response
    },
  )
}
