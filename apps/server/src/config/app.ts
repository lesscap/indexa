export const server = {
  port: +(process.env.PORT || 4110),
  host: process.env.HOST || '0.0.0.0',
}

export const app = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
}
