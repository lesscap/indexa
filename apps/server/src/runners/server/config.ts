import { Routes as ConsoleRoutes } from '../../apps/console/routes.js'
import { Routes as SystemRoutes } from '../../apps/system/routes.js'

export type AppType = 'console' | 'runtime'

export type AppConfig = {
  routes: Record<string, unknown>
  port: number
  name: string
}

export const getAppConfig = (appType: AppType): AppConfig => {
  const configs: Record<AppType, AppConfig> = {
    console: {
      routes: { ...SystemRoutes, ...ConsoleRoutes },
      port: 4110,
      name: 'Indexa Console API',
    },
    runtime: {
      routes: { ...SystemRoutes },
      port: 4120,
      name: 'Indexa Runtime API',
    },
  }

  return configs[appType]
}
