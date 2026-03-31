import type { FastifyRequest } from 'fastify'
import type { ApiResponse, WebApplication } from '../../../types.js'
import { getCurrentDomainId } from '../lib/current-domain.js'
import { DocumentService } from '../services/document.js'

export const DocumentsController = (app: WebApplication) => {
  const service = DocumentService(app)

  app.get(
    '/',
    {
      schema: {
        summary: 'List documents in a library for the current domain',
        tags: ['console.documents'],
        params: {
          type: 'object',
          required: ['libraryId'],
          properties: {
            libraryId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { libraryId: string } }>, reply) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        const response: ApiResponse = {
          success: false,
          code: 'CURRENT_DOMAIN_REQUIRED',
          message: 'currentDomainId is required in session.',
        }

        return reply.code(401).send(response)
      }

      const documents = await service.list(currentDomainId, request.params.libraryId)

      if (!documents) {
        const response: ApiResponse = {
          success: false,
          code: 'LIBRARY_NOT_FOUND',
          message: 'Library was not found in the current domain.',
        }

        return reply.code(404).send(response)
      }

      const response: ApiResponse<{ list: typeof documents }> = {
        success: true,
        data: {
          list: documents,
        },
      }

      return response
    },
  )

  app.post(
    '/',
    {
      schema: {
        summary: 'Upload a document to a library in the current domain',
        tags: ['console.documents'],
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          required: ['libraryId'],
          properties: {
            libraryId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { libraryId: string } }>, reply) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        const response: ApiResponse = {
          success: false,
          code: 'CURRENT_DOMAIN_REQUIRED',
          message: 'currentDomainId is required in session.',
        }

        return reply.code(401).send(response)
      }

      const file = await request.file()

      if (!file) {
        const response: ApiResponse = {
          success: false,
          code: 'FILE_REQUIRED',
          message: 'A multipart file is required.',
        }

        return reply.code(400).send(response)
      }

      const result = await service.upload({
        currentDomainId,
        libraryId: request.params.libraryId,
        file,
      })

      if (!result.ok) {
        const statusCode =
          result.code === 'LIBRARY_NOT_FOUND'
            ? 404
            : result.code === 'LIBRARY_INDEX_MISSING'
              ? 409
              : 400
        const response: ApiResponse = {
          success: false,
          code: result.code,
          message: result.message,
        }

        return reply.code(statusCode).send(response)
      }

      const response: ApiResponse<typeof result.data> = {
        success: true,
        data: result.data,
      }

      return reply.code(201).send(response)
    },
  )
}
