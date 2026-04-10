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

  app.get(
    '/:documentId/chunks',
    {
      schema: {
        summary: 'Get a document with all its chunks for the current domain',
        tags: ['console.documents'],
        params: {
          type: 'object',
          required: ['libraryId', 'documentId'],
          properties: {
            libraryId: { type: 'string', minLength: 1 },
            documentId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { libraryId: string; documentId: string } }>,
      reply,
    ) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        const response: ApiResponse = {
          success: false,
          code: 'CURRENT_DOMAIN_REQUIRED',
          message: 'currentDomainId is required in session.',
        }

        return reply.code(401).send(response)
      }

      const result = await service.listChunks(
        currentDomainId,
        request.params.libraryId,
        request.params.documentId,
      )

      if (!result.ok) {
        const response: ApiResponse = {
          success: false,
          code: result.code,
          message: 'Document was not found in the current domain.',
        }

        return reply.code(404).send(response)
      }

      const response: ApiResponse<typeof result.data> = {
        success: true,
        data: result.data,
      }

      return response
    },
  )

  app.get(
    '/:documentId/chunks/:chunkNo/neighbors',
    {
      schema: {
        summary: 'Get vector neighbors for a chunk via Qdrant recommend',
        tags: ['console.documents'],
        params: {
          type: 'object',
          required: ['libraryId', 'documentId', 'chunkNo'],
          properties: {
            libraryId: { type: 'string', minLength: 1 },
            documentId: { type: 'string', minLength: 1 },
            chunkNo: { type: 'integer', minimum: 0 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 8 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { libraryId: string; documentId: string; chunkNo: number }
        Querystring: { limit?: number }
      }>,
      reply,
    ) => {
      const currentDomainId = getCurrentDomainId(request)

      if (!currentDomainId) {
        const response: ApiResponse = {
          success: false,
          code: 'CURRENT_DOMAIN_REQUIRED',
          message: 'currentDomainId is required in session.',
        }

        return reply.code(401).send(response)
      }

      const result = await service.getChunkNeighbors(
        currentDomainId,
        request.params.libraryId,
        request.params.documentId,
        request.params.chunkNo,
        request.query.limit ?? 8,
      )

      if (!result.ok) {
        const statusCode = result.code === 'LIBRARY_INDEX_MISSING' ? 409 : 404
        const response: ApiResponse = {
          success: false,
          code: result.code,
          message:
            result.code === 'LIBRARY_INDEX_MISSING'
              ? 'Library has no active index.'
              : result.code === 'CHUNK_NOT_FOUND'
                ? 'Chunk was not found for this document.'
                : 'Document was not found in the current domain.',
        }

        return reply.code(statusCode).send(response)
      }

      const response: ApiResponse<typeof result.data> = {
        success: true,
        data: result.data,
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
