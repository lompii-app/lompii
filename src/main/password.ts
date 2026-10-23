import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// Passwords kept as 'salt:hash' in hex (scrypt), never the password itself.

// the archive's PIN: exactly six digits
export const isPin = (v: unknown): v is string => typeof v === 'string' && /^\d{6}$/.test(v)

export function sealPassword(password: string): string {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`
}

export function passwordMatches(password: unknown, sealed: string): boolean {
  const [salt, want] = sealed.split(':').map((h) => Buffer.from(h, 'hex'))
  const got = scryptSync(String(password), salt, 32)
  return want.length === got.length && timingSafeEqual(got, want)
}
