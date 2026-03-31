import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/utils/password.js'

const prisma = new PrismaClient()

const seed = async () => {
  const domain = await prisma.domain.upsert({
    where: {
      slug: 'dev-console',
    },
    update: {
      name: 'Dev Console Domain',
      description: 'Seeded development domain for local console work.',
      status: 'ACTIVE',
    },
    create: {
      slug: 'dev-console',
      name: 'Dev Console Domain',
      description: 'Seeded development domain for local console work.',
      status: 'ACTIVE',
    },
  })

  await prisma.embeddingProfile.upsert({
    where: {
      domainId_slug: {
        domainId: domain.id,
        slug: 'qwen-text-embedding-v3',
      },
    },
    update: {
      name: 'Qwen Text Embedding V3',
      provider: 'QWEN',
      model: 'text-embedding-v3',
      dimensions: 1024,
      distanceMetric: 'COSINE',
      status: 'ACTIVE',
      isDefault: true,
    },
    create: {
      domainId: domain.id,
      slug: 'qwen-text-embedding-v3',
      name: 'Qwen Text Embedding V3',
      provider: 'QWEN',
      model: 'text-embedding-v3',
      dimensions: 1024,
      distanceMetric: 'COSINE',
      status: 'ACTIVE',
      isDefault: true,
    },
  })

  const passwordSalt = randomBytes(16).toString('hex')
  const password = 'indexa123456'

  const user = await prisma.user.upsert({
    where: {
      username: 'admin',
    },
    update: {
      domainId: domain.id,
      name: 'Indexa Admin',
      passwordSalt,
      passwordHashed: hashPassword(password, passwordSalt),
      disabled: false,
    },
    create: {
      domainId: domain.id,
      username: 'admin',
      name: 'Indexa Admin',
      passwordSalt,
      passwordHashed: hashPassword(password, passwordSalt),
      disabled: false,
    },
  })

  console.log(
    JSON.stringify(
      {
        domain: {
          id: domain.id,
          slug: domain.slug,
        },
        user: {
          id: user.id,
          username: user.username,
          password,
        },
      },
      null,
      2,
    ),
  )
}

seed()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async error => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
