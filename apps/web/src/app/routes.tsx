import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { DocumentDetailPage } from '@/pages/document-detail'
import { LibrariesPage } from '@/pages/libraries'
import { LibraryDetailPage } from '@/pages/library-detail'
import { LoginPage } from '@/pages/login'

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/libraries" replace /> },
      { path: 'libraries', element: <LibrariesPage /> },
      { path: 'libraries/:libraryId', element: <LibraryDetailPage /> },
      {
        path: 'libraries/:libraryId/documents/:documentId',
        element: <DocumentDetailPage />,
      },
    ],
  },
]
