import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routes'

describe('App routes', () => {
  it('redirects the root route to the knowledge base page', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /knowledge bases/i,
        }),
      ).toBeInTheDocument()
    })
  })

  it('renders the knowledge base placeholder page', () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/knowledge-bases'],
    })

    render(<RouterProvider router={router} />)

    expect(screen.getByText(/Fastify skeleton ready/i)).toBeInTheDocument()
  })
})
