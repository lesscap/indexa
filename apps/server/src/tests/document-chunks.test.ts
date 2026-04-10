import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { readChunkText } from '../apps/console/services/document.js'
import { storage as storageConfig } from '../config/app.js'
import { getAppConfig } from '../runners/server/config.js'
import { createApp } from '../runners/server/index.js'
import { hashPassword } from '../utils/password.js'

const SALT = 'test-salt-000000'

const buildAuthenticatedApp = async (mockPrisma: object) => {
  const app = createApp({
    config: getAppConfig('console'),
    services: {
      $prisma: mockPrisma as never,
      $qdrant: {} as never,
    },
  })
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/console/session',
    payload: { username: 'admin', password: 'indexa123456' },
  })
  const setCookieHeader = loginResponse.headers['set-cookie']
  const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
  return { app, cookie: cookie?.split(';')[0] || '' }
}

const adminUserMock = () => ({
  id: 'user-1',
  domainId: 'domain-1',
  username: 'admin',
  name: 'Indexa Admin',
  passwordSalt: SALT,
  passwordHashed: hashPassword('indexa123456', SALT),
  disabled: false,
  domain: {
    id: 'domain-1',
    slug: 'dev-console',
    name: 'Dev Console Domain',
  },
})

describe('readChunkText', () => {
  it('reads a chunk file from inside the given storage root', async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), 'indexa-chunks-'))
    const relative = 'chunks/lib/doc/chunk-00000.txt'
    const absolute = path.join(tmp, relative)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, 'hello chunks', { encoding: 'utf-8' })
    await expect(readChunkText(tmp, relative)).resolves.toBe('hello chunks')
  })

  it('rejects a traversal path that escapes the storage root', async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), 'indexa-chunks-'))
    await expect(readChunkText(tmp, '../escape.txt')).rejects.toThrow(/escapes storage root/)
  })
})

describe('GET /api/console/libraries/:libraryId/documents/:documentId/chunks', () => {
  it('returns the document, libraryIndexId, and chunks with text from disk', async () => {
    // The integration test reads from the live storage root that the server
    // computed at module-load time. Mirror its layout so loadChunkText finds
    // the file we wrote.
    const chunkRelative = 'chunks/index-1/doc-1/chunk-00000.txt'
    const chunkAbsolute = path.join(storageConfig.documentRoot, chunkRelative)
    await mkdir(path.dirname(chunkAbsolute), { recursive: true })
    await writeFile(chunkAbsolute, 'first chunk text', { encoding: 'utf-8' })

    const documentRow = {
      id: 'doc-1',
      libraryId: 'library-1',
      title: 'Sample Doc',
      originalName: 'sample.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234n,
      checksumSha256: 'abc',
      storagePath: 'domains/dev/libraries/lib/documents/doc-1/source.pdf',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:01.000Z'),
      library: {
        id: 'library-1',
        activeIndexId: 'index-1',
        activeIndex: {
          id: 'index-1',
          qdrantCollectionName: 'library_test_v1',
        },
      },
      indexStates: [
        {
          id: 'state-1',
          status: 'READY',
          stage: null,
          lastIndexedAt: new Date('2026-04-01T00:00:02.000Z'),
          errorMessage: null,
          updatedAt: new Date('2026-04-01T00:00:02.000Z'),
        },
      ],
    }

    const mockPrisma = {
      user: { findFirst: vi.fn().mockResolvedValue(adminUserMock()) },
      document: { findFirst: vi.fn().mockResolvedValue(documentRow) },
      documentChunk: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'chunk-row-1',
            chunkNo: 0,
            charCount: 16,
            contentHash: 'hash0',
            qdrantPointId: 'point-0',
            textPath: chunkRelative,
          },
        ]),
      },
      $disconnect: vi.fn(),
    }

    const { app, cookie } = await buildAuthenticatedApp(mockPrisma)
    const response = await app.inject({
      method: 'GET',
      url: '/api/console/libraries/library-1/documents/doc-1/chunks',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as {
      success: boolean
      data: {
        document: { id: string; title: string }
        libraryIndexId: string
        chunks: Array<{ chunkNo: number; text: string; charCount: number }>
      }
    }
    expect(body.success).toBe(true)
    expect(body.data.document.id).toBe('doc-1')
    expect(body.data.libraryIndexId).toBe('index-1')
    expect(body.data.chunks).toEqual([
      {
        id: 'chunk-row-1',
        chunkNo: 0,
        charCount: 16,
        contentHash: 'hash0',
        qdrantPointId: 'point-0',
        text: 'first chunk text',
      },
    ])
    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'doc-1',
          libraryId: 'library-1',
          library: { domainId: 'domain-1' },
        }),
      }),
    )
    expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: 'doc-1', libraryIndexId: 'index-1' },
        orderBy: { chunkNo: 'asc' },
      }),
    )

    await app.close()
  })
})
