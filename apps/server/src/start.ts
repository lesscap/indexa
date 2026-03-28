import 'dotenv/config'
import minimist from 'minimist'
import type { AppType } from './runners/server/config.js'
import { getAppConfig } from './runners/server/config.js'
import { createApp, listen } from './runners/server/index.js'

const start = async () => {
  const args = minimist(process.argv.slice(2))
  const appType = (args.app || 'knowledge-base') as AppType
  const port = args.port || args.p

  const config = getAppConfig(appType)
  const app = createApp({ config })

  await listen(app, { port: port || config.port })
}

start().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
