import { hash, generateSalt } from '../src/lib/crypto'

describe('crypto.hash', () => {
  it('produces different hashes for different salts', async () => {
    const key = 'SuperSecretMasterKey'
    const salt1 = generateSalt()
    const salt2 = generateSalt()
    const hash1 = await hash(key, salt1)
    const hash2 = await hash(key, salt2)
    expect(hash1).not.toEqual(hash2)
  })

  it('produces the same hash for same key+salt', async () => {
    const key = 'SuperSecretMasterKey'
    const salt = generateSalt()
    const hash1 = await hash(key, salt)
    const hash2 = await hash(key, salt)
    expect(hash1).toEqual(hash2)
  })

  it('returns a string of reasonable length', async () => {
    const key = 'SuperSecretMasterKey'
    const salt = generateSalt()
    const hashed = await hash(key, salt)
    expect(typeof hashed).toBe('string')
    expect(hashed.length).toBeGreaterThan(10)
  })
})
