import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
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

export const readChunkText = async (
  storageRoot: string,
  relativeTextPath: string,
): Promise<string> => {
  // textPath is a POSIX-ish relative path written by the Python worker
  // (e.g. "chunks/<libraryIndexId>/<documentId>/chunk-00003.txt"). Resolve
  // it against the storage root and reject anything that escapes the root
  // to defend against traversal in case a malicious writer slipped in.
  const absolute = path.resolve(storageRoot, relativeTextPath)
  const rootWithSep = path.resolve(storageRoot) + path.sep
  if (!absolute.startsWith(rootWithSep)) {
    throw new Error(`chunk textPath escapes storage root: ${relativeTextPath}`)
  }
  try {
    return await readFile(absolute, 'utf-8')
  } catch (error) {
    throw Object.assign(new Error(`failed to read chunk text: ${relativeTextPath}`), {
      cause: error,
    })
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

    // Wake the Python worker via Postgres LISTEN/NOTIFY. The notification
    // fires only when this transaction commits, so a rollback here never
    // produces a phantom wakeup.
    await tx.$executeRaw`SELECT pg_notify('indexa_job', ${job.id})`

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

  const findDocumentInScope = async (
    currentDomainId: string,
    libraryId: string,
    documentId: string,
  ) => {
    return app.$prisma.document.findFirst({
      where: {
        id: documentId,
        libraryId,
        library: {
          domainId: currentDomainId,
        },
      },
      include: {
        library: {
          select: {
            id: true,
            activeIndexId: true,
            activeIndex: {
              select: {
                id: true,
                qdrantCollectionName: true,
              },
            },
          },
        },
        indexStates: {
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
    })
  }

  const loadChunkText = async (textPath: string): Promise<string> => {
    try {
      return await readChunkText(storageConfig.documentRoot, textPath)
    } catch (error) {
      app.log.warn({ err: error, textPath }, 'failed to read chunk text, returning empty')
      return ''
    }
  }

  const listChunks = async (
    currentDomainId: string,
    libraryId: string,
    documentId: string,
  ) => {
    const document = await findDocumentInScope(currentDomainId, libraryId, documentId)
    if (!document) {
      return { ok: false as const, code: 'DOCUMENT_NOT_FOUND' as const }
    }

    const activeIndexId = document.library.activeIndexId
    const summary = toDocumentSummary({
      ...document,
      currentIndexState: document.indexStates[0] || null,
    })

    if (!activeIndexId) {
      return {
        ok: true as const,
        data: {
          document: summary,
          libraryIndexId: null,
          chunks: [] as Array<{
            id: string
            chunkNo: number
            charCount: number
            contentHash: string
            qdrantPointId: string
            text: string
          }>,
        },
      }
    }

    const chunkRows = await app.$prisma.documentChunk.findMany({
      where: { documentId, libraryIndexId: activeIndexId },
      orderBy: { chunkNo: 'asc' },
      select: {
        id: true,
        chunkNo: true,
        charCount: true,
        contentHash: true,
        qdrantPointId: true,
        textPath: true,
      },
    })

    const chunks = await Promise.all(
      chunkRows.map(async row => ({
        id: row.id,
        chunkNo: row.chunkNo,
        charCount: row.charCount,
        contentHash: row.contentHash,
        qdrantPointId: row.qdrantPointId,
        text: await loadChunkText(row.textPath),
      })),
    )

    return {
      ok: true as const,
      data: {
        document: summary,
        libraryIndexId: activeIndexId,
        chunks,
      },
    }
  }

  const getChunkNeighbors = async (
    currentDomainId: string,
    libraryId: string,
    documentId: string,
    chunkNo: number,
    limit: number,
  ) => {
    const document = await findDocumentInScope(currentDomainId, libraryId, documentId)
    if (!document) {
      return { ok: false as const, code: 'DOCUMENT_NOT_FOUND' as const }
    }

    const activeIndex = document.library.activeIndex
    if (!document.library.activeIndexId || !activeIndex) {
      return { ok: false as const, code: 'LIBRARY_INDEX_MISSING' as const }
    }

    const sourceChunk = await app.$prisma.documentChunk.findFirst({
      where: {
        documentId,
        libraryIndexId: document.library.activeIndexId,
        chunkNo,
      },
      select: { qdrantPointId: true },
    })

    if (!sourceChunk) {
      return { ok: false as const, code: 'CHUNK_NOT_FOUND' as const }
    }

    const recommended = await app.$qdrant.recommend(activeIndex.qdrantCollectionName, {
      positive: [sourceChunk.qdrantPointId],
      limit,
      with_payload: false,
    })

    if (recommended.length === 0) {
      return {
        ok: true as const,
        data: { sourceChunkNo: chunkNo, neighbors: [] },
      }
    }

    const pointIds = recommended.map(point => String(point.id))
    const neighborRows = await app.$prisma.documentChunk.findMany({
      where: {
        libraryIndexId: document.library.activeIndexId,
        qdrantPointId: { in: pointIds },
      },
      select: {
        chunkNo: true,
        charCount: true,
        textPath: true,
        qdrantPointId: true,
        document: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    const byPointId = new Map(neighborRows.map(row => [row.qdrantPointId, row]))

    const neighbors = await Promise.all(
      recommended
        .map(point => ({ point, row: byPointId.get(String(point.id)) }))
        .filter((entry): entry is { point: (typeof recommended)[number]; row: (typeof neighborRows)[number] } => entry.row != null)
        .map(async ({ point, row }) => ({
          score: point.score,
          chunkNo: row.chunkNo,
          charCount: row.charCount,
          documentId: row.document.id,
          documentTitle: row.document.title,
          text: await loadChunkText(row.textPath),
        })),
    )

    return {
      ok: true as const,
      data: { sourceChunkNo: chunkNo, neighbors },
    }
  }

  return {
    list,
    upload,
    listChunks,
    getChunkNeighbors,
  }
}
