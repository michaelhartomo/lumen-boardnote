/**
 * Lumen Card Encryption Utility
 * High-security AES-GCM 256-bit encryption with PBKDF2 key derivation (SHA-256, 100,000 iterations).
 * Conforms to snake_case naming and browser-native Web Crypto API standards.
 */

// Helper: Convert ArrayBuffer to Base64
function buffer_to_base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64_to_buffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Standard PBKDF2-SHA256 iterations matching OWASP recommendations for brute-force resistance
const KDF_STANDARD_ITERATIONS = 310000;
const SALT_BYTE_LENGTH = 32; // 256-bit salt for maximum entropy

// Helper: Derive verification hash from passkey and salt (kept for backward compatibility with legacy cards)
async function compute_verification_hash(passkey, salt_bytes) {
  const enc = new TextEncoder();
  const passkey_bytes = enc.encode(passkey);
  const combined = new Uint8Array(passkey_bytes.length + salt_bytes.length);
  combined.set(passkey_bytes, 0);
  combined.set(salt_bytes, passkey_bytes.length);
  const digest = await crypto.subtle.digest('SHA-256', combined);
  return buffer_to_base64(digest);
}

// Helper: Derive AES-GCM CryptoKey from passkey string using PBKDF2-SHA256
async function derive_encryption_key(passkey, salt_bytes, iterations = KDF_STANDARD_ITERATIONS) {
  const enc = new TextEncoder();
  const key_material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passkey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt_bytes,
      iterations,
      hash: 'SHA-256',
    },
    key_material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

import { validate_passkey_policy } from './card_encryption_guard.js';

/**
 * Encrypt arbitrary card payload object using a passkey.
 * Returns the card_encryption object containing algorithm, salt, iv, and ciphertext.
 * Note: Does not expose an un-stretched verification hash oracle to prevent offline GPU cracking.
 */
export async function encrypt_card_data(plain_payload, passkey, passkey_hint = '') {
  if (!passkey || typeof passkey !== 'string') {
    throw new Error('Valid passkey string is required for card encryption');
  }

  const policy = validate_passkey_policy(passkey);
  if (!policy.is_valid) {
    throw new Error(policy.message || 'Passkey must be at least 10 characters with mixed case, numbers, and symbols (e.g., K9#mQ2$vL8)');
  }

  const salt_bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const iv_bytes = crypto.getRandomValues(new Uint8Array(12));
  const iterations = KDF_STANDARD_ITERATIONS;

  // Full 310,000 iterations PBKDF2 key derivation
  const key = await derive_encryption_key(passkey, salt_bytes, iterations);

  const enc = new TextEncoder();
  const json_string = JSON.stringify(plain_payload || {});
  const encoded_data = enc.encode(json_string);

  const encrypted_buffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv_bytes,
    },
    key,
    encoded_data
  );

  return {
    version: 2,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: buffer_to_base64(salt_bytes),
    iv: buffer_to_base64(iv_bytes),
    ciphertext: buffer_to_base64(encrypted_buffer),
    passkey_hint: (passkey_hint || '').trim(),
    encrypted_at: Date.now(),
    brute_force_protection: '310k-PBKDF2-AEAD',
  };
}

/**
 * Checks if a candidate passkey matches the encrypted card.
 * In version 2, uses authentic AES-GCM verification without fast hash leaks.
 */
export async function verify_card_passkey(card_encryption, candidate_passkey) {
  if (!card_encryption || !card_encryption.salt || !card_encryption.ciphertext) {
    return false;
  }
  try {
    await decrypt_card_data(card_encryption, candidate_passkey);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Decrypts card_encryption object back to original plain card payload.
 * Throws an Error if passkey is invalid or decryption fails.
 */
export async function decrypt_card_data(card_encryption, passkey) {
  if (!card_encryption || !card_encryption.ciphertext) {
    throw new Error('No encrypted ciphertext found in card');
  }
  if (!passkey) {
    throw new Error('Passkey is required');
  }

  const salt_bytes = new Uint8Array(base64_to_buffer(card_encryption.salt));
  const iv_bytes = new Uint8Array(base64_to_buffer(card_encryption.iv));
  const ciphertext_buffer = base64_to_buffer(card_encryption.ciphertext);
  const iterations = card_encryption.iterations || 100000;

  // Legacy verification check for version 1 cards
  if (card_encryption.verification_hash) {
    const expected_hash = await compute_verification_hash(passkey, salt_bytes);
    if (expected_hash !== card_encryption.verification_hash) {
      throw new Error('Incorrect passkey');
    }
  }

  // Derive key & decrypt using authenticated AES-GCM tag verification
  const key = await derive_encryption_key(passkey, salt_bytes, iterations);

  try {
    const decrypted_buffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv_bytes,
      },
      key,
      ciphertext_buffer
    );

    const dec = new TextDecoder();
    const json_string = dec.decode(decrypted_buffer);
    return JSON.parse(json_string);
  } catch (err) {
    throw new Error('Incorrect passkey');
  }
}

/**
 * Extracts sensitive fields from a card object to create the encrypted payload bundle.
 */
export function extract_sensitive_card_payload(card) {
  if (!card) return {};
  const data = card.data || {};
  return {
    content: card.content !== undefined ? card.content : data.content,
    title: card.title || '',
    description: card.description !== undefined ? card.description : data.description,
    code_content: card.code_content !== undefined ? card.code_content : data.code_content,
    items: Array.isArray(card.items) ? card.items : data.items,
    url: card.url !== undefined ? card.url : data.url,
    images: Array.isArray(card.images) ? card.images : data.images,
    imageUrl: card.imageUrl !== undefined ? card.imageUrl : data.imageUrl,
    image_url: card.image_url !== undefined ? card.image_url : data.image_url,
    caption: card.caption !== undefined ? card.caption : data.caption,
    notes: card.notes !== undefined ? card.notes : data.notes,
    ai_notes: card.ai_notes !== undefined ? card.ai_notes : data.ai_notes,
    destinations: Array.isArray(card.destinations) ? card.destinations : data.destinations,
    location_name: card.location_name !== undefined ? card.location_name : data.location_name,
    address: card.address !== undefined ? card.address : data.address,
    latitude: card.latitude !== undefined ? card.latitude : data.latitude,
    longitude: card.longitude !== undefined ? card.longitude : data.longitude,
    zoom: card.zoom !== undefined ? card.zoom : data.zoom,
    canvas_strokes: Array.isArray(card.canvas_strokes) ? card.canvas_strokes : data.canvas_strokes,
    canvas_images: Array.isArray(card.canvas_images) ? card.canvas_images : data.canvas_images,
    cells: card.cells !== undefined ? card.cells : data.cells,
    rows: card.rows !== undefined ? card.rows : data.rows,
    cols: card.cols !== undefined ? card.cols : data.cols,
    file_name: card.file_name !== undefined ? card.file_name : data.file_name,
    file_id: card.file_id !== undefined ? card.file_id : data.file_id,
    file_url: card.file_url !== undefined ? card.file_url : data.file_url,
    view_url: card.view_url !== undefined ? card.view_url : data.view_url,
    file_size: card.file_size !== undefined ? card.file_size : data.file_size,
    file_type: card.file_type !== undefined ? card.file_type : data.file_type,
    symbol: card.symbol !== undefined ? card.symbol : data.symbol,
    tags: Array.isArray(card.tags) ? card.tags : data.tags,
  };
}
