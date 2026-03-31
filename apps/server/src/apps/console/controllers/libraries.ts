import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ApiResponse, WebApplication } from '../../../types.js'
import { getCurrentDomainId } from '../lib/current-domain.js'
import { LibraryService } from '../services/library.js'

type CreateLibraryBody = {
  name: string
  slug?: string
  description?: string
  embeddingMethodSlug: string
}

const unauthorizedResponse = (reply: FastifyReply) => {
  const response: ApiResponse = {
    success: false,
    code: 'CURRENT_DOMAIN_REQUIRED',
    message: 'currentDomainId is required in session.',
  }

  return reply.code(401).send(response)
}

export const LibrariesController = (app: WebApplication) => {
  const service = LibraryService(app)

  app.get(
    '/',
    {
      schema: {
        summary: 'List libraries in the current domain',
        tags: ['console.libraries'],
      },
    },
    async (request, reply) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        return unauthorizedResponse(reply)
      }

      const list = await service.list(currentDomainId)
      const response: ApiResponse<{ list: typeof list }> = {
        success: true,
        data: {
          list,
        },
      }

      return response
    },
  )

  app.post(
    '/',
    {
      schema: {
        summary: 'Create a library in the current domain',
        tags: ['console.libraries'],
        body: {
          type: 'object',
          required: ['name', 'embeddingMethodSlug'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 128 },
            slug: { type: 'string', minLength: 1, maxLength: 64 },
            description: { type: 'string', maxLength: 2000 },
            embeddingMethodSlug: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateLibraryBody }>, reply) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        return unauthorizedResponse(reply)
      }

      const result = await service.create({
        currentDomainId,
        name: request.body.name,
        embeddingMethodSlug: request.body.embeddingMethodSlug,
        ...(request.body.slug ? { slug: request.body.slug } : {}),
        ...(request.body.description ? { description: request.body.description } : {}),
      })

      if (!result.ok) {
        const statusCode =
          result.code === 'LIBRARY_SLUG_EXISTS'
            ? 409
            : result.code === 'EMBEDDING_METHOD_NOT_FOUND'
              ? 404
              : 400
        const response: ApiResponse = {
          success: false,
          code: result.code,
          message: result.message,
        }

        return reply.code(statusCode).send(response)
      }

      const response: ApiResponse<{ library: typeof result.data }> = {
        success: true,
        data: {
          library: result.data,
        },
      }

      return reply.code(201).send(response)
    },
  )

  app.get(
    '/:id',
    {
      schema: {
        summary: 'Get a library in the current domain',
        tags: ['console.libraries'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        return unauthorizedResponse(reply)
      }

      const library = await service.getById(currentDomainId, request.params.id)

      if (!library) {
        const response: ApiResponse = {
          success: false,
          code: 'LIBRARY_NOT_FOUND',
          message: 'Library was not found in the current domain.',
        }

        return reply.code(404).send(response)
      }

      const response: ApiResponse<{ library: typeof library }> = {
        success: true,
        data: {
          library,
        },
      }

      return response
    },
  )
}
