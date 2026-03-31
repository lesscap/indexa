import { scryptSync, timingSafeEqual } from 'node:crypto'

export const hashPassword = (password: string, salt: string) => {
  return scryptSync(password, salt, 32).toString('hex')
}

export const verifyPassword = (password: string, salt: string, hashed: string) => {
  const actual = Buffer.from(hashPassword(password, salt), 'hex')
  const expected = Buffer.from(hashed, 'hex')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
