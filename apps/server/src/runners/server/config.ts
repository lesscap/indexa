import { Routes as KnowledgeBaseRoutes } from '../../apps/knowledge-base/routes.js'
import { Routes as SystemRoutes } from '../../apps/system/routes.js'

export type AppType = 'knowledge-base'

export type AppConfig = {
  routes: Record<string, unknown>
  port: number
  name: string
}

export const getAppConfig = (appType: AppType): AppConfig => {
  const configs: Record<AppType, AppConfig> = {
    'knowledge-base': {
      routes: { ...SystemRoutes, ...KnowledgeBaseRoutes },
      port: 4110,
      name: 'Indexa Knowledge Base API',
    },
  }

  return configs[appType]
}
