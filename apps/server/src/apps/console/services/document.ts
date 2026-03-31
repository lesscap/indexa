import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'
import { storage as storageConfig } from '../../../config/app.js'
import type { WebApplication } from '../../../types.js'

type DocumentStorageLibrary = {
  id: string
  slug: string
  activeIndexId: string | null
  domain: {
    slug: string
  }
}

type QueueStoredDocumentInput = {
  prisma: WebApplication['$prisma']
  library: DocumentStorageLibrary
  filename: string
  mimeType: string
  sizeBytes: bigint
  checksumSha256: string
  storagePath: string
  documentId?: string
}

type UploadDocumentInput = {
  currentDomainId: string
  libraryId: string
  file: MultipartFile
}

export const toDocumentSummary = <
  T extends {
    id: string
    title: string
    originalName: string
    mimeType: string
    sizeBytes: bigint
    checksumSha256: string
    storagePath: string
    createdAt: Date
    updatedAt: Date
    currentIndexState?: {
      id: string
      status: string
      stage: string | null
      lastIndexedAt: Date | null
      errorMessage: string | null
      updatedAt: Date
    } | null
  },
>(
  document: T,
) => {
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes.toString(),
    checksumSha256: document.checksumSha256,
    storagePath: document.storagePath,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    currentIndexState: document.currentIndexState
      ? {
          id: document.currentIndexState.id,
          status: document.currentIndexState.status,
          stage: document.currentIndexState.stage,
          lastIndexedAt: document.currentIndexState.lastIndexedAt,
          errorMessage: document.currentIndexState.errorMessage,
          updatedAt: document.currentIndexState.updatedAt,
        }
      : null,
  }
}

export const sanitizeExtension = (filename: string) => {
  return path
    .extname(filename)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
}

export const getDocumentTitle = (filename: string) => {
  const extension = path.extname(filename)
  const title = path.basename(filename, extension).trim()

  return title || 'Untitled Document'
}

export const getDocumentStoragePaths = (
  library: Pick<DocumentStorageLibrary, 'slug' | 'domain'>,
  documentId: string,
  filename: string,
) => {
  const extension = sanitizeExtension(filename)
  const relativeDirectory = path.join(
    'domains',
    library.domain.slug,
    'libraries',
    library.slug,
    'documents',
    documentId,
  )
  const relativePath = path.join(relativeDirectory, `source${extension}`)

  return {
    relativeDirectory,
    relativePath,
    absoluteDirectory: path.join(storageConfig.documentRoot, relativeDirectory),
    absolutePath: path.join(storageConfig.documentRoot, relativePath),
  }
}

const saveSourceFile = async (file: MultipartFile, targetPath: string) => {
  const digest = createHash('sha256')
  let sizeBytes = 0n

  await pipeline(
    file.file,
    new Transform({
      transform(chunk, _encoding, callback) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        sizeBytes += BigInt(buffer.length)
        digest.update(buffer)
        callback(null, buffer)
      },
    }),
    createWriteStream(targetPath),
  )

  return {
    checksumSha256: digest.digest('hex'),
    sizeBytes,
  }
}

export const queueStoredDocument = async ({
  prisma,
  library,
  filename,
  mimeType,
  sizeBytes,
  checksumSha256,
  storagePath,
  documentId = randomUUID(),
}: QueueStoredDocumentInput) => {
  if (!library.activeIndexId) {
    return {
      ok: false as const,
      code: 'LIBRARY_INDEX_MISSING',
      message: 'Library does not have an active index.',
    }
  }

  const created = await prisma.$transaction(async tx => {
    const document = await tx.document.create({
      data: {
        id: documentId,
        libraryId: library.id,
        title: getDocumentTitle(filename),
        originalName: filename,
        mimeType,
        sizeBytes,
        checksumSha256,
        storagePath,
      },
    })

    const documentIndexState = await tx.documentIndexState.create({
      data: {
        documentId,
        libraryIndexId: library.activeIndexId!,
        status: 'QUEUED',
      },
    })

    const job = await tx.indexJob.create({
      data: {
        documentId,
        libraryId: library.id,
        libraryIndexId: library.activeIndexId!,
        documentIndexStateId: documentIndexState.id,
        type: 'INDEX_DOCUMENT',
        status: 'QUEUED',
      },
    })

    return {
      document,
      documentIndexState,
      job,
    }
  })

  return {
    ok: true as const,
    data: created,
  }
}

export const DocumentService = (app: WebApplication) => {
  const list = async (currentDomainId: string, libraryId: string) => {
    const library = await app.$prisma.library.findFirst({
      where: {
        id: libraryId,
        domainId: currentDomainId,
      },
      select: {
        id: true,
        activeIndexId: true,
      },
    })

    if (!library) {
      return null
    }

    const documents = await app.$prisma.document.findMany({
      where: {
        libraryId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        indexStates: library.activeIndexId
          ? {
              where: {
                libraryIndexId: library.activeIndexId,
              },
              take: 1,
            }
          : false,
      },
    })

    return documents.map(document => {
      const [currentIndexState] = document.indexStates

      return toDocumentSummary({
        ...document,
        currentIndexState: currentIndexState || null,
      })
    })
  }

  const upload = async (input: UploadDocumentInput) => {
    const { currentDomainId, libraryId, file } = input
    const library = await app.$prisma.library.findFirst({
      where: {
        id: libraryId,
        domainId: currentDomainId,
      },
      include: {
        domain: true,
      },
    })

    if (!library) {
      return {
        ok: false as const,
        code: 'LIBRARY_NOT_FOUND',
        message: 'Library was not found in the current domain.',
      }
    }

    if (!library.activeIndexId) {
      return {
        ok: false as const,
        code: 'LIBRARY_INDEX_MISSING',
        message: 'Library does not have an active index.',
      }
    }

    const documentId = randomUUID()
    const filename = file.filename || 'document'
    const { relativePath, absoluteDirectory, absolutePath } = getDocumentStoragePaths(
      library,
      documentId,
      filename,
    )

    await mkdir(absoluteDirectory, { recursive: true })

    let saved = false

    try {
      const fileSummary = await saveSourceFile(file, absolutePath)
      saved = true

      const queued = await queueStoredDocument({
        prisma: app.$prisma,
        library,
        documentId,
        filename,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: fileSummary.sizeBytes,
        checksumSha256: fileSummary.checksumSha256,
        storagePath: relativePath,
      })

      if (!queued.ok) {
        return queued
      }

      const created = queued.data

      return {
        ok: true as const,
        data: {
          document: toDocumentSummary(created.document),
          documentIndexState: {
            id: created.documentIndexState.id,
            status: created.documentIndexState.status,
            stage: created.documentIndexState.stage,
            lastIndexedAt: created.documentIndexState.lastIndexedAt,
            errorMessage: created.documentIndexState.errorMessage,
            updatedAt: created.documentIndexState.updatedAt,
          },
          job: {
            id: created.job.id,
            status: created.job.status,
            stage: created.job.stage,
            progressCurrent: created.job.progressCurrent,
            progressTotal: created.job.progressTotal,
            progressUnit: created.job.progressUnit,
            createdAt: created.job.createdAt,
          },
        },
      }
    } catch (error) {
      if (saved) {
        await rm(absoluteDirectory, { recursive: true, force: true })
      }

      throw error
    }
  }

  return {
    list,
    upload,
  }
}
