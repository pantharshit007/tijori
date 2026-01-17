/**
 * Tijori Crypto Module
 *
 * Client-side encryption utilities using the Web Crypto API.
 * The server (Convex) never sees plaintext secrets.
 *
 * Algorithm: AES-256-GCM
 * KDF: PBKDF2 with SHA-256
 * Iterations: 100,000
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;

/**
 * Convert ArrayBuffer to Base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random salt for PBKDF2.
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToBase64(salt.buffer);
}

/**
 * Generate a random IV for AES-GCM.
 */
export function generateIV(): string {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  return arrayBufferToBase64(iv.buffer);
}

/**
 * Derive an AES-256 key from a passcode using PBKDF2.
 */
export async function deriveKey(
  passcode: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = base64ToArrayBuffer(saltBase64);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns { encryptedValue, iv, authTag } as Base64 strings.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<{ encryptedValue: string; iv: string; authTag: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext),
  );

  // AES-GCM appends the 16-byte auth tag to the ciphertext
  const ciphertextArray = new Uint8Array(ciphertext);
  const authTagStart = ciphertextArray.length - 16;

  const encryptedData = ciphertextArray.slice(0, authTagStart);
  const authTag = ciphertextArray.slice(authTagStart);

  return {
    encryptedValue: arrayBufferToBase64(encryptedData.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    authTag: arrayBufferToBase64(authTag.buffer),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 */
export async function decrypt(
  encryptedValueBase64: string,
  ivBase64: string,
  authTagBase64: string,
  key: CryptoKey,
): Promise<string> {
  const iv = base64ToArrayBuffer(ivBase64);
  const encryptedData = new Uint8Array(base64ToArrayBuffer(encryptedValueBase64));
  const authTag = new Uint8Array(base64ToArrayBuffer(authTagBase64));

  // Reconstruct the full ciphertext (data + authTag)
  const fullCiphertext = new Uint8Array(encryptedData.length + authTag.length);
  fullCiphertext.set(encryptedData);
  fullCiphertext.set(authTag, encryptedData.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    fullCiphertext,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Hash a string using SHA-256.
 * Returns Base64-encoded hash.
 */
export async function hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Generate a random 256-bit key for sharing secrets.
 * Returns the key as a Base64 string.
 */
export function generateShareKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(key.buffer);
}

/**
 * Import a raw Base64 key for AES-GCM operations.
 */
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyBase64);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}
