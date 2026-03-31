import type { FastifyRequest } from 'fastify'

export const getCurrentUserId = (request: FastifyRequest) => {
  const userId = request.session.get('userId')

  if (typeof userId !== 'string' || userId.length === 0) {
    return null
  }

  return userId
}
