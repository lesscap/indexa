import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ApiResponse, WebApplication } from '../../../types.js'
import { getCurrentDomainId } from '../lib/current-domain.js'
import { getCurrentUserId } from '../lib/current-user.js'
import { UploadService } from '../services/upload.js'

const getUploadId = (request: FastifyRequest) => {
  const wildcard = (request.params as Record<string, string | undefined>)['*']

  if (typeof wildcard !== 'string') {
    return null
  }

  const trimmed = wildcard.trim()

  return trimmed.length > 0 ? trimmed : null
}

export const TusUploadsController = (app: WebApplication) => {
  const service = UploadService(app)
  const tusHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const currentDomainId = getCurrentDomainId(request)
    const userId = getCurrentUserId(request)

    if (!currentDomainId || !userId) {
      const response: ApiResponse = {
        success: false,
        code: 'SESSION_REQUIRED',
        message: 'Please login first.',
      }

      return reply.code(401).send(response)
    }

    const uploadId = getUploadId(request)

    if (uploadId) {
      const allowed = await service.ensureUploadAccess(currentDomainId, uploadId)

      if (!allowed) {
        const response: ApiResponse = {
          success: false,
          code: 'UPLOAD_NOT_FOUND',
          message: 'Upload session was not found in the current domain.',
        }

        return reply.code(404).send(response)
      }
    }

    service.attachTusContext(request.raw, {
      currentDomainId,
      userId,
    })

    reply.hijack()
    await service.handleTusRequest(request.raw, reply.raw)
  }

  app.all(
    '/',
    {
      schema: {
        hide: true,
      },
    },
    tusHandler,
  )

  app.all(
    '/*',
    {
      schema: {
        hide: true,
      },
    },
    tusHandler,
  )
}
