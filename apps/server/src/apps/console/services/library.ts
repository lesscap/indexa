import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { WebApplication } from '../../../types.js'

type CreateLibraryInput = {
  currentDomainId: string
  name: string
  slug?: string
  description?: string
  embeddingMethodSlug: string
}

const toLibrarySummary = <
  T extends {
    id: string
    domainId: string
    slug: string
    name: string
    description: string | null
    status: string
    createdAt: Date
    activeIndex: {
      id: string
      version: number
      status: string
      embeddingProfile: {
        id: string
        slug: string
        name: string
        provider: string
        model: string
      }
    } | null
  },
>(
  library: T,
) => {
  return {
    id: library.id,
    domainId: library.domainId,
    slug: library.slug,
    name: library.name,
    description: library.description,
    status: library.status,
    createdAt: library.createdAt,
    activeIndex: library.activeIndex
      ? {
          id: library.activeIndex.id,
          version: library.activeIndex.version,
          status: library.activeIndex.status,
          embeddingMethod: {
            id: library.activeIndex.embeddingProfile.id,
            slug: library.activeIndex.embeddingProfile.slug,
            name: library.activeIndex.embeddingProfile.name,
            provider: library.activeIndex.embeddingProfile.provider,
            model: library.activeIndex.embeddingProfile.model,
          },
        }
      : null,
  }
}

const slugify = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

const ensureSlug = (name: string, slug?: string) => {
  const resolved = slugify(slug || name)

  return resolved || 'library'
}

export const LibraryService = (app: WebApplication) => {
  const list = async (currentDomainId: string) => {
    const libraries = await app.$prisma.library.findMany({
      where: {
        domainId: currentDomainId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        activeIndex: {
          include: {
            embeddingProfile: true,
          },
        },
      },
    })

    return libraries.map(toLibrarySummary)
  }

  const getById = async (currentDomainId: string, libraryId: string) => {
    const library = await app.$prisma.library.findFirst({
      where: {
        id: libraryId,
        domainId: currentDomainId,
      },
      include: {
        activeIndex: {
          include: {
            embeddingProfile: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    })

    if (!library) {
      return null
    }

    return {
      ...toLibrarySummary(library),
      documentCount: library._count.documents,
    }
  }

  const create = async (input: CreateLibraryInput) => {
    const { currentDomainId, name, slug, description, embeddingMethodSlug } = input
    const resolvedSlug = ensureSlug(name, slug)

    const embeddingProfile = await app.$prisma.embeddingProfile.findFirst({
      where: {
        domainId: currentDomainId,
        slug: embeddingMethodSlug,
        status: 'ACTIVE',
      },
    })

    if (!embeddingProfile) {
      return {
        ok: false as const,
        code: 'EMBEDDING_METHOD_NOT_FOUND',
        message: `Embedding method "${embeddingMethodSlug}" was not found in the current domain.`,
      }
    }

    const libraryId = randomUUID()
    const libraryIndexId = randomUUID()
    const version = 1
    const qdrantCollectionName = `library_${currentDomainId}_${libraryId}_v${version}`

    try {
      const library = await app.$prisma.$transaction(async prisma => {
        await prisma.library.create({
          data: {
            id: libraryId,
            domainId: currentDomainId,
            slug: resolvedSlug,
            name,
            ...(description ? { description } : {}),
          },
        })

        await prisma.libraryIndex.create({
          data: {
            id: libraryIndexId,
            libraryId,
            embeddingProfileId: embeddingProfile.id,
            version,
            qdrantCollectionName,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        })

        await prisma.library.update({
          where: {
            id: libraryId,
          },
          data: {
            activeIndexId: libraryIndexId,
          },
        })

        return prisma.library.findUniqueOrThrow({
          where: {
            id: libraryId,
          },
          include: {
            activeIndex: {
              include: {
                embeddingProfile: true,
              },
            },
          },
        })
      })

      return {
        ok: true as const,
        data: toLibrarySummary(library),
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return {
          ok: false as const,
          code: 'LIBRARY_SLUG_EXISTS',
          message: `Library slug "${resolvedSlug}" already exists in the current domain.`,
        }
      }

      throw error
    }
  }

  return {
    list,
    getById,
    create,
  }
}
