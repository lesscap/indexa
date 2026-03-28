import { describe, expect, it } from 'vitest'
import { getAppConfig } from '../runners/server/config.js'
import { createApp } from '../runners/server/index.js'

describe('Indexa server', () => {
  it('returns a healthy status payload', async () => {
    const app = createApp({ config: getAppConfig('knowledge-base') })
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

  it('returns an empty knowledge base list', async () => {
    const app = createApp({ config: getAppConfig('knowledge-base') })
    const response = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      data: {
        list: [],
      },
    })

    await app.close()
  })
})
