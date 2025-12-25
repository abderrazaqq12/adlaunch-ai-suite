/**
 * Token Encryption Utilities
 * AES-256-GCM encryption for OAuth tokens at rest
 *
 * Requires OAUTH_ENCRYPTION_KEY environment variable (32-byte hex string)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 16

/**
 * Get the encryption key from environment, deriving it with scrypt for added security
 */
function getEncryptionKey(): Buffer {
    const envKey = process.env.OAUTH_ENCRYPTION_KEY
    if (!envKey) {
        throw new Error('OAUTH_ENCRYPTION_KEY environment variable is required')
    }

    // If the key is 64 hex chars (32 bytes), use it directly
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
        return Buffer.from(envKey, 'hex')
    }

    // Otherwise, derive a key using scrypt with a static salt
    // This allows for arbitrary length passwords while still being secure
    const salt = Buffer.from('adlaunch-oauth-salt', 'utf8')
    return scryptSync(envKey, salt, 32)
}

/**
 * Encrypt a plaintext string
 * Returns: base64 encoded string containing salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ])

    const authTag = cipher.getAuthTag()

    // Combine: iv (16 bytes) + authTag (16 bytes) + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted])
    return combined.toString('base64')
}

/**
 * Decrypt a base64 encoded encrypted string
 */
export function decrypt(encryptedBase64: string): string {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedBase64, 'base64')

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ])

    return decrypted.toString('utf8')
}

/**
 * Generate a cryptographically secure random state token for OAuth CSRF protection
 */
export function generateStateToken(): string {
    return randomBytes(32).toString('hex')
}

/**
 * Check if encryption key is available
 */
export function isEncryptionConfigured(): boolean {
    return !!process.env.OAUTH_ENCRYPTION_KEY
}
