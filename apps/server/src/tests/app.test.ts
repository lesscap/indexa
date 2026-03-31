import { describe, expect, it, vi } from 'vitest'
import { getAppConfig } from '../runners/server/config.js'
import { createApp } from '../runners/server/index.js'
import { hashPassword } from '../utils/password.js'

const login = async (
  app: ReturnType<typeof createApp>,
  payload: { username: string; password: string },
) => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/console/session',
    payload,
  })
  const setCookieHeader = response.headers['set-cookie']
  const cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader

  return {
    response,
    cookie: cookie?.split(';')[0] || '',
  }
}

describe('Indexa server', () => {
  it('returns a healthy status payload', async () => {
    const app = createApp({ config: getAppConfig('console') })
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      data: {
        status: 'ok',
      },
    })

    await app.close()
  })

  it('exposes swagger docs', async () => {
    const app = createApp({ config: getAppConfig('console') })
    const response = await app.inject({
      method: 'GET',
      url: '/docs',
    })

    expect(response.statusCode).toBe(200)

    await app.close()
  })

  it('requires currentDomainId in session for console libraries', async () => {
    const app = createApp({ config: getAppConfig('console') })
    const response = await app.inject({
      method: 'GET',
      url: '/api/console/libraries',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      success: false,
      code: 'CURRENT_DOMAIN_REQUIRED',
      message: 'currentDomainId is required in session.',
    })

    await app.close()
  })

  it('creates a session and exposes the current session payload', async () => {
    const salt = 'test-salt-000000'
    const mockPrisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-1',
          domainId: 'domain-1',
          username: 'admin',
          name: 'Indexa Admin',
          passwordSalt: salt,
          passwordHashed: hashPassword('indexa123456', salt),
          disabled: false,
          domain: {
            id: 'domain-1',
            slug: 'dev-console',
            name: 'Dev Console Domain',
          },
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          domainId: 'domain-1',
          username: 'admin',
          name: 'Indexa Admin',
          disabled: false,
          domain: {
            id: 'domain-1',
            slug: 'dev-console',
            name: 'Dev Console Domain',
          },
        }),
      },
      $disconnect: vi.fn(),
    }
    const app = createApp({
      config: getAppConfig('console'),
      services: {
        $prisma: mockPrisma as never,
      },
    })
    const { response: loginResponse, cookie } = await login(app, {
      username: 'admin',
      password: 'indexa123456',
    })
    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/console/session',
      headers: {
        cookie,
      },
    })

    expect(loginResponse.statusCode).toBe(200)
    expect(loginResponse.json()).toEqual({
      success: true,
      data: {
        session: {
          id: 'user-1',
          username: 'admin',
          name: 'Indexa Admin',
          currentDomainId: 'domain-1',
          domain: {
            id: 'domain-1',
            slug: 'dev-console',
            name: 'Dev Console Domain',
          },
        },
      },
    })
    expect(sessionResponse.statusCode).toBe(200)
    expect(sessionResponse.json()).toEqual({
      success: true,
      data: {
        session: {
          id: 'user-1',
          username: 'admin',
          name: 'Indexa Admin',
          currentDomainId: 'domain-1',
          domain: {
            id: 'domain-1',
            slug: 'dev-console',
            name: 'Dev Console Domain',
          },
        },
      },
    })

    await app.close()
  })

  it('lists libraries for the current domain', async () => {
    const salt = 'test-salt-000000'
    const mockPrisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-1',
          domainId: 'domain-1',
          username: 'admin',
          name: 'Indexa Admin',
          passwordSalt: salt,
          passwordHashed: hashPassword('indexa123456', salt),
          disabled: false,
          domain: {
            id: 'domain-1',
            slug: 'dev-console',
            name: 'Dev Console Domain',
          },
        }),
      },
      library: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'library-1',
            domainId: 'domain-1',
            slug: 'software-quality',
            name: 'Software Quality',
            description: 'Library for quality docs',
            status: 'ACTIVE',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
            activeIndex: {
              id: 'index-1',
              version: 1,
              status: 'ACTIVE',
              embeddingProfile: {
                id: 'embedding-1',
                slug: 'qwen-text-embedding-v3',
                name: 'Qwen Text Embedding V3',
                provider: 'QWEN',
                model: 'text-embedding-v3',
              },
            },
          },
        ]),
      },
      $disconnect: vi.fn(),
    }
    const app = createApp({
      config: getAppConfig('console'),
      services: {
        $prisma: mockPrisma as never,
      },
    })
    const { cookie } = await login(app, {
      username: 'admin',
      password: 'indexa123456',
    })
    const response = await app.inject({
      method: 'GET',
      url: '/api/console/libraries',
      headers: {
        cookie,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(mockPrisma.library.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          domainId: 'domain-1',
        },
      }),
    )
    expect(response.json()).toEqual({
      success: true,
      data: {
        list: [
          {
            id: 'library-1',
            domainId: 'domain-1',
            slug: 'software-quality',
            name: 'Software Quality',
            description: 'Library for quality docs',
            status: 'ACTIVE',
            createdAt: '2026-03-31T00:00:00.000Z',
            activeIndex: {
              id: 'index-1',
              version: 1,
              status: 'ACTIVE',
              embeddingMethod: {
                id: 'embedding-1',
                slug: 'qwen-text-embedding-v3',
                name: 'Qwen Text Embedding V3',
                provider: 'QWEN',
                model: 'text-embedding-v3',
              },
            },
          },
        ],
      },
    })

    await app.close()
  })
})
