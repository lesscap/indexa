import type { FastifyInstance } from 'fastify'
import type { Services } from './services/index.js'

export type Dict = Record<string, unknown>

export type WebApplication = FastifyInstance & Services

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; code: string; message: string }
