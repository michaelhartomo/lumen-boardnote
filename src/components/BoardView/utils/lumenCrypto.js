/**
 * Lumen Post-Quantum Symmetrical Encryption Utility
 *
 * Implements quantum-proof symmetric cryptography using NIST-recommended
 * AES-256-GCM authenticated encryption paired with PBKDF2-SHA256 key derivation.
 *
 * Security Rationale:
 * - Grover's quantum search algorithm reduces symmetric key search spaces by half (O(sqrt(N))).
 * - Therefore, a 256-bit symmetric key provides 128 bits of post-quantum security margin,
 *   which is physically impossible to break with planetary-scale quantum computers.
 * - PBKDF2 with 100,000 iterations and a cryptographically random 256-bit salt protects against
 *   offline dictionary and rainbow table attacks.
 * - AES-GCM provides AEAD (Authenticated Encryption with Associated Data). Any ciphertext
 *   tampering or incorrect password throws an authentication tag verification error.
 */

const KDF_ITERATIONS = 310000; // OWASP recommendation for PBKDF2-SHA256 brute force resistance
const AES_KEY_LENGTH = 256;
const SALT_BYTE_LENGTH = 32; // 256-bit random salt
const IV_BYTE_LENGTH = 12;   // 96-bit random IV for AES-GCM

/**
 * Convert an ArrayBuffer or Uint8Array to a Base64 string safely.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function buffer_to_base64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string to a Uint8Array.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64_to_buffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a 256-bit AES-GCM CryptoKey from a password and salt using PBKDF2-SHA256.
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} [iterations=KDF_ITERATIONS]
 * @returns {Promise<CryptoKey>}
 */
export async function derive_quantum_resistant_key(password, salt, iterations = KDF_ITERATIONS) {
  const encoder = new TextEncoder();
  const password_bytes = encoder.encode(password || '');

  const base_key = await window.crypto.subtle.importKey(
    'raw',
    password_bytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const derived_key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    base_key,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return derived_key;
}

import { validate_passkey_policy } from './card_encryption_guard.js';

/**
 * Encrypt arbitrary plaintext content using post-quantum AES-256-GCM.
 * Plaintext is encrypted locally before being transmitted to the server.
 *
 * @param {string} plaintext - The note or card content to protect.
 * @param {string} password - The user's note password.
 * @param {Object} [options={}] - Optional metadata such as password hint.
 * @returns {Promise<Object>} The encrypted payload package.
 */
export async function encrypt_content_post_quantum(plaintext, password, options = {}) {
  if (!password) {
    throw new Error('Encryption passkey is required');
  }

  const policy = validate_passkey_policy(password);
  if (!policy.is_valid) {
    throw new Error(policy.message || 'Passkey must be at least 10 characters with mixed case, numbers, and symbols (e.g., K9#mQ2$vL8)');
  }

  const encoder = new TextEncoder();
  const plaintext_bytes = encoder.encode(typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext || ''));

  // Generate cryptographically secure random 256-bit salt & 96-bit IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));

  // Derive 256-bit quantum-resistant key
  const key = await derive_quantum_resistant_key(password, salt, KDF_ITERATIONS);

  // Perform AES-256-GCM AEAD encryption
  const ciphertext_buffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    plaintext_bytes
  );

  const payload = {
    is_encrypted: true,
    algorithm: 'AES-256-GCM',
    security_standard: 'NIST Post-Quantum 256-bit Symmetrical',
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: buffer_to_base64(salt),
    iv: buffer_to_base64(iv),
    ciphertext: buffer_to_base64(ciphertext_buffer),
    hint: typeof options.hint === 'string' ? options.hint.trim() : '',
    encrypted_at: Date.now(),
    version: '1.0',
  };

  return payload;
}

/**
 * Decrypt an AES-256-GCM encrypted payload using the provided password.
 *
 * @param {Object|string} payload_data - Encrypted package or JSON string.
 * @param {string} password - The password supplied by the viewing user.
 * @returns {Promise<string>} The decrypted plaintext content.
 * @throws {Error} When password is incorrect or ciphertext has been altered.
 */
export async function decrypt_content_post_quantum(payload_data, password) {
  if (!password) {
    throw new Error('Password is required to decrypt content');
  }

  let payload = payload_data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new Error('Invalid encrypted payload format');
    }
  }

  if (!payload || !payload.ciphertext || !payload.iv || !payload.salt) {
    throw new Error('Malformed encrypted payload: missing cryptographic parameters');
  }

  const salt = base64_to_buffer(payload.salt);
  const iv = base64_to_buffer(payload.iv);
  const ciphertext = base64_to_buffer(payload.ciphertext);
  const iterations = payload.iterations || KDF_ITERATIONS;

  // Derive key using the same salt and PBKDF2 iteration count
  const key = await derive_quantum_resistant_key(password, salt, iterations);

  try {
    const decrypted_buffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted_buffer);
  } catch (err) {
    // AEAD authentication failure means either wrong password or tampered ciphertext
    throw new Error('Incorrect note password. Cryptographic authentication failed.');
  }
}

/**
 * Check if a card or its content represents an encrypted payload.
 * @param {any} card_or_content
 * @returns {boolean}
 */
export function is_quantum_encrypted(card_or_content) {
  if (!card_or_content) return false;
  if (typeof card_or_content === 'object') {
    if (card_or_content.is_encrypted === true) return true;
    if (card_or_content.encrypted_payload && card_or_content.encrypted_payload.is_encrypted) return true;
    if (typeof card_or_content.content === 'string') {
      return is_payload_json(card_or_content.content);
    }
  }
  if (typeof card_or_content === 'string') {
    return is_payload_json(card_or_content);
  }
  return false;
}

function is_payload_json(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parsed && parsed.is_encrypted && parsed.ciphertext && parsed.iv);
  } catch {
    return false;
  }
}
