import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { KnowledgeBasesPage } from '@/pages/knowledge-bases'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/knowledge-bases" replace /> },
      { path: 'knowledge-bases', element: <KnowledgeBasesPage /> },
    ],
  },
]
