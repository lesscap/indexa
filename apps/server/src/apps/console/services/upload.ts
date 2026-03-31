import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { FileStore } from '@tus/file-store'
import { EVENTS, Server } from '@tus/server'
import { storage as storageConfig } from '../../../config/app.js'
import type { WebApplication } from '../../../types.js'
import { getDocumentStoragePaths, queueStoredDocument } from './document.js'

type UploadSessionSummary = {
  id: string
  tusUploadId: string
  originalName: string
  mimeType: string
  sizeBytes: string
  bytesReceived: string
  status: string
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

type TusAuthContext = {
  currentDomainId: string
  userId: string
}

type TusRawRequest = IncomingMessage & {
  indexaTusAuth?: TusAuthContext
}

const tusPath = '/api/console/uploads'

const toUploadSessionSummary = <
  T extends {
    id: string
    tusUploadId: string
    originalName: string
    mimeType: string
    sizeBytes: bigint
    bytesReceived: bigint
    status: string
    errorMessage: string | null
    createdAt: Date
    updatedAt: Date
  },
>(
  uploadSession: T,
): UploadSessionSummary => {
  return {
    id: uploadSession.id,
    tusUploadId: uploadSession.tusUploadId,
    originalName: uploadSession.originalName,
    mimeType: uploadSession.mimeType,
    sizeBytes: uploadSession.sizeBytes.toString(),
    bytesReceived: uploadSession.bytesReceived.toString(),
    status: uploadSession.status,
    errorMessage: uploadSession.errorMessage,
    createdAt: uploadSession.createdAt,
    updatedAt: uploadSession.updatedAt,
  }
}

const getTusContext = (request: Request) => {
  const rawRequest = (
    request as Request & {
      runtime?: {
        node?: {
          req?: TusRawRequest
        }
      }
    }
  ).runtime?.node?.req

  return rawRequest?.indexaTusAuth || null
}

const readMetadata = (metadata: Record<string, string | null> | undefined, key: string) => {
  const value = metadata?.[key]

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

const hashFile = async (filePath: string) => {
  const digest = createHash('sha256')

  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk)
  }

  return digest.digest('hex')
}

export const UploadService = (app: WebApplication) => {
  const fileStore = new FileStore({
    directory: storageConfig.uploadRoot,
  })
  const tusServer = new Server({
    path: tusPath,
    datastore: fileStore,
    allowedCredentials: true,
    postReceiveInterval: 1000,
    relativeLocation: true,
    async onUploadCreate(request, upload) {
      const auth = getTusContext(request)

      if (!auth) {
        throw {
          status_code: 401,
          body: 'Authentication is required.',
        }
      }

      const libraryId = readMetadata(upload.metadata, 'libraryId')

      if (!libraryId) {
        throw {
          status_code: 400,
          body: 'libraryId is required in upload metadata.',
        }
      }

      const library = await app.$prisma.library.findFirst({
        where: {
          id: libraryId,
          domainId: auth.currentDomainId,
        },
        select: {
          id: true,
        },
      })

      if (!library) {
        throw {
          status_code: 404,
          body: 'Library was not found in the current domain.',
        }
      }

      const originalName =
        readMetadata(upload.metadata, 'filename') ||
        readMetadata(upload.metadata, 'name') ||
        'document'
      const mimeType =
        readMetadata(upload.metadata, 'filetype') ||
        readMetadata(upload.metadata, 'type') ||
        'application/octet-stream'

      await app.$prisma.uploadSession.create({
        data: {
          domainId: auth.currentDomainId,
          libraryId,
          createdByUserId: auth.userId,
          tusUploadId: upload.id,
          originalName,
          mimeType,
          sizeBytes: BigInt(upload.size || 0),
          bytesReceived: 0,
          storagePath: upload.id,
          status: 'CREATED',
        },
      })

      return {}
    },
    async onUploadFinish(_request, upload) {
      const uploadSession = await app.$prisma.uploadSession.findUnique({
        where: {
          tusUploadId: upload.id,
        },
        include: {
          library: {
            include: {
              domain: true,
            },
          },
        },
      })

      if (!uploadSession) {
        throw {
          status_code: 404,
          body: 'Upload session was not found.',
        }
      }

      if (!uploadSession.library.activeIndexId) {
        await app.$prisma.uploadSession.update({
          where: {
            id: uploadSession.id,
          },
          data: {
            status: 'FAILED',
            errorMessage: 'Library does not have an active index.',
          },
        })

        throw {
          status_code: 409,
          body: 'Library does not have an active index.',
        }
      }

      const temporaryPath = path.join(storageConfig.uploadRoot, uploadSession.storagePath)
      const documentId = randomUUID()
      const { relativePath, absoluteDirectory, absolutePath } = getDocumentStoragePaths(
        uploadSession.library,
        documentId,
        uploadSession.originalName,
      )

      let moved = false

      try {
        const checksumSha256 = await hashFile(temporaryPath)
        await mkdir(absoluteDirectory, { recursive: true })
        await rename(temporaryPath, absolutePath)
        moved = true

        const queued = await queueStoredDocument({
          prisma: app.$prisma,
          library: uploadSession.library,
          documentId,
          filename: uploadSession.originalName,
          mimeType: uploadSession.mimeType,
          sizeBytes: uploadSession.sizeBytes,
          checksumSha256,
          storagePath: relativePath,
        })

        if (!queued.ok) {
          throw new Error(queued.message)
        }

        await app.$prisma.uploadSession.update({
          where: {
            id: uploadSession.id,
          },
          data: {
            status: 'COMPLETED',
            bytesReceived: uploadSession.sizeBytes,
            errorMessage: null,
          },
        })

        try {
          await fileStore.configstore.delete(upload.id)
        } catch {}
      } catch (error) {
        await app.$prisma.uploadSession.update({
          where: {
            id: uploadSession.id,
          },
          data: {
            status: 'FAILED',
            bytesReceived: BigInt(upload.offset),
            errorMessage: error instanceof Error ? error.message : 'Failed to finalize upload.',
          },
        })

        if (moved) {
          await rm(absoluteDirectory, { recursive: true, force: true })
        }

        throw {
          status_code: 500,
          body: 'Failed to finalize upload.',
        }
      }

      return {}
    },
  })

  tusServer.on(EVENTS.POST_RECEIVE, async (_request, upload) => {
    await app.$prisma.uploadSession.updateMany({
      where: {
        tusUploadId: upload.id,
        status: {
          in: ['CREATED', 'UPLOADING'],
        },
      },
      data: {
        bytesReceived: BigInt(upload.offset),
        status: 'UPLOADING',
        errorMessage: null,
      },
    })
  })

  tusServer.on(EVENTS.POST_TERMINATE, async (_request, _response, uploadId) => {
    await app.$prisma.uploadSession.updateMany({
      where: {
        tusUploadId: uploadId,
      },
      data: {
        status: 'CANCELED',
      },
    })
  })

  const list = async (currentDomainId: string, libraryId: string) => {
    const library = await app.$prisma.library.findFirst({
      where: {
        id: libraryId,
        domainId: currentDomainId,
      },
      select: {
        id: true,
      },
    })

    if (!library) {
      return null
    }

    const uploadSessions = await app.$prisma.uploadSession.findMany({
      where: {
        libraryId,
        domainId: currentDomainId,
        status: {
          in: ['CREATED', 'UPLOADING', 'FAILED'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return uploadSessions.map(toUploadSessionSummary)
  }

  const ensureUploadAccess = async (currentDomainId: string, tusUploadId: string) => {
    const uploadSession = await app.$prisma.uploadSession.findFirst({
      where: {
        tusUploadId,
        domainId: currentDomainId,
      },
      select: {
        id: true,
      },
    })

    return Boolean(uploadSession)
  }

  const attachTusContext = (rawRequest: IncomingMessage, context: TusAuthContext) => {
    ;(rawRequest as TusRawRequest).indexaTusAuth = context
  }

  const handleTusRequest = async (rawRequest: IncomingMessage, rawResponse: ServerResponse) => {
    await tusServer.handle(rawRequest, rawResponse)
  }

  return {
    list,
    ensureUploadAccess,
    attachTusContext,
    handleTusRequest,
  }
}
