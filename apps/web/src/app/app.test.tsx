import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routes'
import { SessionProvider } from './session'

const makeFetchResponse = (body: unknown) => {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  )
}

describe('App routes', () => {
  it('redirects the root route to login when unauthenticated', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    })

    render(
      <SessionProvider
        bootstrap={{
          session: null,
          resolved: true,
        }}
      >
        <RouterProvider router={router} />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /console login/i,
        }),
      ).toBeInTheDocument()
    })
  })

  it('renders libraries for an authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        makeFetchResponse({
          success: true,
          data: {
            list: [
              {
                id: 'library-1',
                domainId: 'domain-1',
                slug: 'policies',
                name: 'Policies',
                description: 'Company policies',
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
        }),
      ),
    )
    const router = createMemoryRouter(routes, {
      initialEntries: ['/libraries'],
    })

    render(
      <SessionProvider
        bootstrap={{
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
          resolved: true,
        }}
      >
        <RouterProvider router={router} />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /knowledge libraries/i,
        }),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('heading', {
        name: 'Policies',
      }),
    ).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
