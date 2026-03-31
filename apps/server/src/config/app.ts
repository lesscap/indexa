import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

export const server = {
  port: +(process.env.PORT || 4110),
  host: process.env.HOST || '0.0.0.0',
}

export const app = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
}

export const session = {
  secret: process.env.SESSION_SECRET || 'indexa-dev-session-secret-32-characters-minimum',
  salt: process.env.SESSION_SALT || 'indexa-salt-1234',
}

export const storage = {
  documentRoot: process.env.DOCUMENT_STORAGE_ROOT || path.join(appRoot, 'storage'),
  uploadRoot: process.env.UPLOAD_STORAGE_ROOT || path.join(appRoot, 'storage', '_uploads'),
}
