import { BrowserRouter, useRoutes } from 'react-router-dom'
import { routes } from './routes'
import { SessionProvider } from './session'

export const AppRoutes = () => {
  return useRoutes(routes)
}

export const App = () => {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  )
}
