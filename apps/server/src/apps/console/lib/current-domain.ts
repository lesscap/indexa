import type { FastifyRequest } from 'fastify'

export const getCurrentDomainId = (request: FastifyRequest) => {
  const currentDomainId = request.session.get('currentDomainId')

  return typeof currentDomainId === 'string' && currentDomainId.length > 0 ? currentDomainId : null
}
