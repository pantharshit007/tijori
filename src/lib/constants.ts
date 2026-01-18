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
