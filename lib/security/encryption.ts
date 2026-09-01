/**
 * lib/security/encryption.ts
 *
 * AES-256-GCM encryption for sensitive values stored in the database.
 * The encryption key is read from ENCRYPTION_SECRET env variable (32-byte hex).
 *
 * Usage:
 *   const encrypted = encrypt('my_token_value')
 *   const original  = decrypt(encrypted)
 *
 * NEVER expose encrypted values or the key to the browser.
 * This module should only be imported in server-side code.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12    // 96-bit IV recommended for GCM
const TAG_LENGTH = 16   // 128-bit auth tag

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('[encryption] ENCRYPTION_SECRET environment variable is not set')
  }
  const key = Buffer.from(secret, 'hex')
  if (key.length !== 32) {
    throw new Error('[encryption] ENCRYPTION_SECRET must be a 32-byte (64 hex char) string')
  }
  return key
}

/**
 * Encrypts a plaintext string.
 * Returns a base64-encoded string: <iv>:<authTag>:<ciphertext>
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext (all base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a string produced by encrypt().
 * Throws if the ciphertext has been tampered with (auth tag mismatch).
 */
export function decrypt(encryptedData: string): string {
  const key = getKey()
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('[encryption] Invalid encrypted data format')
  }

  const [ivB64, authTagB64, ciphertextB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
