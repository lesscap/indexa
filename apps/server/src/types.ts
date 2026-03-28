import type { FastifyInstance } from 'fastify'

export type Dict = Record<string, unknown>

export type WebApplication = FastifyInstance

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; code: string; message: string }
