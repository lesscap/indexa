import type { WebApplication } from '../../../types.js'
import { verifyPassword } from '../../../utils/password.js'

export const SessionService = (app: WebApplication) => {
  const login = async (username: string, password: string) => {
    const user = await app.$prisma.user.findFirst({
      where: {
        username,
      },
      include: {
        domain: true,
      },
    })

    if (!user) {
      return {
        ok: false as const,
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      }
    }

    if (user.disabled) {
      return {
        ok: false as const,
        code: 'USER_DISABLED',
        message: 'User is disabled.',
      }
    }

    if (!verifyPassword(password, user.passwordSalt, user.passwordHashed)) {
      return {
        ok: false as const,
        code: 'INVALID_PASSWORD',
        message: 'Password is incorrect.',
      }
    }

    return {
      ok: true as const,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        currentDomainId: user.domainId,
        domain: {
          id: user.domain.id,
          slug: user.domain.slug,
          name: user.domain.name,
        },
      },
    }
  }

  const getCurrent = async (userId: string) => {
    const user = await app.$prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        domain: true,
      },
    })

    if (!user || user.disabled) {
      return null
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      currentDomainId: user.domainId,
      domain: {
        id: user.domain.id,
        slug: user.domain.slug,
        name: user.domain.name,
      },
    }
  }

  return {
    login,
    getCurrent,
  }
}
