import type { FastifyRequest } from 'fastify'
import type { ApiResponse, WebApplication } from '../../../types.js'
import { getCurrentDomainId } from '../lib/current-domain.js'
import { UploadService } from '../services/upload.js'

export const UploadSessionsController = (app: WebApplication) => {
  const service = UploadService(app)

  app.get(
    '/',
    {
      schema: {
        summary: 'List active upload sessions in a library for the current domain',
        tags: ['console.uploads'],
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

      const uploads = await service.list(currentDomainId, request.params.libraryId)

      if (!uploads) {
        const response: ApiResponse = {
          success: false,
          code: 'LIBRARY_NOT_FOUND',
          message: 'Library was not found in the current domain.',
        }

        return reply.code(404).send(response)
      }

      const response: ApiResponse<{ list: typeof uploads }> = {
        success: true,
        data: {
          list: uploads,
        },
      }

      return response
    },
  )
}
