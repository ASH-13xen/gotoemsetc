const crypto = require('node:crypto');
const env = require('../config/env');

// AES-256-GCM: authenticated encryption (tamper-evident, not just opaque) —
// this is for values that must be *read back* (e.g. a mailbox password HR
// needs to actually log in with), unlike login credentials which only ever
// need one-way verification and stay on bcrypt (see auth.service.js).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the standard/recommended size for GCM
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

// EXTRA_DETAILS_ENCRYPTION_KEY is a 64-char hex string (32 bytes) — hashed
// through SHA-256 anyway so any equally high-entropy secret works too, but
// the env var is documented/generated as 32-byte hex for clarity.
const key = crypto.createHash('sha256').update(env.extraDetailsEncryptionKey).digest();

function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function decrypt(value) {
  if (!isEncrypted(value)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, isEncrypted };
