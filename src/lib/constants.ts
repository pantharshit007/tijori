/**
 * Tijori Crypto Constants
 *
 * Centralized cryptographic configuration.
 */

export const CRYPTO = {
  /** AES-GCM encryption algorithm */
  ALGORITHM: 'AES-GCM',
  /** Key length in bits */
  KEY_LENGTH: 256,
  /** IV length in bytes (96 bits for AES-GCM) */
  IV_LENGTH: 12,
  /** Salt length in bytes (128 bits) */
  SALT_LENGTH: 16,
  /** PBKDF2 iterations for key derivation */
  PBKDF2_ITERATIONS: 100000,
  /** Hash algorithm for PBKDF2 and hashing */
  HASH_ALGORITHM: 'SHA-256',
} as const

export type CryptoConfig = typeof CRYPTO

/**
 * Share expiry duration options
 * Used in ShareDialog and validated in Convex mutations
 */
export const SHARE_EXPIRY_OPTIONS = [
  { value: '10m', label: '10 minutes', ms: 10 * 60 * 1000 },
  { value: '30m', label: '30 minutes', ms: 30 * 60 * 1000 },
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'never', label: 'Never expires', ms: null },
] as const

export type ShareExpiryValue = typeof SHARE_EXPIRY_OPTIONS[number]['value']
