import { BrowserRouter, useRoutes } from 'react-router-dom'
import { routes } from './routes'

export const AppRoutes = () => {
  return useRoutes(routes)
}

export const App = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
