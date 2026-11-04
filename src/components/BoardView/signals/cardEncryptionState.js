/**
 * Lumen Card Encryption State Signal Module
 *
 * Implements client-side quantum-proof symmetrical encryption state using Preact Signals.
 * Unencrypted content is held strictly in ephemeral in-memory signals and never written
 * to disk or transmitted across the network in plaintext.
 */

import { signal } from '@preact/signals-react';
import {
  encrypt_content_post_quantum,
  decrypt_content_post_quantum,
  is_quantum_encrypted,
} from '../utils/lumenCrypto.js';
import {
  activeBoardSignal,
  addCard,
  updateCard,
  patchCardOnServer,
  showToast,
} from './boardState.js';
import {
  verify_can_attempt_unlock,
  record_failed_unlock_attempt,
  record_successful_unlock,
} from '../utils/card_encryption_guard.js';

/**
 * Ephemeral session map of unlocked cards.
 * Key: card_id
 * Value: { plaintext: string, password: string, unlocked_at: number }
 */
export const unlockedCardsSignal = signal({});

/**
 * Modal state for creating an encrypted card or encrypting an existing card.
 */
export const cardEncryptionModalSignal = signal({
  is_open: false,
  mode: 'create', // 'create' | 'encrypt_existing'
  target_config: null,
  card_id: null,
  initial_title: '',
  initial_content: '',
});

/**
 * Open the encryption modal.
 * @param {Object} [config] - Target card configuration or existing card
 * @param {'create'|'encrypt_existing'} [mode='create']
 * @param {string} [card_id=null]
 */
export function open_card_encryption_modal(config = null, mode = 'create', card_id = null) {
  cardEncryptionModalSignal.value = {
    is_open: true,
    mode,
    target_config: config,
    card_id: card_id || config?.id || null,
    initial_title: config?.title || (mode === 'create' ? 'Encrypted Note' : ''),
    initial_content: config?.content || '',
  };
}

/**
 * Close the encryption modal.
 */
export function close_card_encryption_modal() {
  cardEncryptionModalSignal.value = {
    is_open: false,
    mode: 'create',
    target_config: null,
    card_id: null,
    initial_title: '',
    initial_content: '',
  };
}

/**
 * Check if a card is currently unlocked in the active session.
 * @param {string} card_id
 * @returns {boolean}
 */
export function is_card_session_unlocked(card_id) {
  if (!card_id) return false;
  const entry = unlockedCardsSignal.value[card_id];
  return Boolean(entry && typeof entry.plaintext === 'string');
}

/**
 * Get decrypted in-memory plaintext for an unlocked card.
 * @param {string} card_id
 * @returns {string|null}
 */
export function get_session_card_content(card_id) {
  if (!card_id) return null;
  const entry = unlockedCardsSignal.value[card_id];
  return entry ? entry.plaintext : null;
}

/**
 * Unlock a card in the current session upon successful decryption.
 * @param {string} card_id
 * @param {string} plaintext
 * @param {string} password
 */
export function unlock_card_in_session(card_id, plaintext, password) {
  if (!card_id) return;
  unlockedCardsSignal.value = {
    ...unlockedCardsSignal.value,
    [card_id]: {
      plaintext: plaintext || '',
      password: password || '',
      unlocked_at: Date.now(),
    },
  };
}

/**
 * Lock a single card by removing its in-memory decrypted content.
 * @param {string} card_id
 */
export function lock_card_in_session(card_id) {
  if (!card_id) return;
  const next = { ...unlockedCardsSignal.value };
  delete next[card_id];
  unlockedCardsSignal.value = next;
  showToast('Card locked');
}

/**
 * Lock all encrypted cards in the workspace session.
 */
export function lock_all_encrypted_cards() {
  unlockedCardsSignal.value = {};
  showToast('All encrypted cards locked');
}

/**
 * Attempt to decrypt a card using the user's password.
 * @param {Object} card
 * @param {string} password
 * @returns {Promise<string>} Plaintext content
 */
export async function decrypt_and_unlock_card(card, password) {
  if (!card || !password) {
    throw new Error('Password is required');
  }

  // Enforce brute force protection rate limiting and lockouts
  verify_can_attempt_unlock(card.id);

  const payload = card.encrypted_payload || card.content;
  try {
    const plaintext = await decrypt_content_post_quantum(payload, password);
    record_successful_unlock(card.id);
    unlock_card_in_session(card.id, plaintext, password);
    showToast('Card decrypted successfully');
    return plaintext;
  } catch (err) {
    await record_failed_unlock_attempt(card.id);
    throw err;
  }
}

/**
 * Encrypt and create a new card on the board.
 * Plaintext is encrypted into post-quantum ciphertext before being added or sent to the server.
 *
 * @param {Object} config - Card parameters (position, type, color, title, etc.)
 * @param {string} password - User-provided note password
 * @param {string} [initial_content=''] - Initial note content
 * @param {string} [hint=''] - Optional password reminder hint
 * @returns {Promise<Object>} Created card
 */
export async function encrypt_and_create_card(config, password, initial_content = '', hint = '') {
  if (!password) {
    throw new Error('A password is required to encrypt this card');
  }

  // Encrypt locally using post-quantum AES-256-GCM
  const encrypted_payload = await encrypt_content_post_quantum(initial_content, password, { hint });
  const ciphertext_string = JSON.stringify(encrypted_payload);

  const card_title = (config.title || 'Encrypted Note').trim();
  const card_color = config.color || 'yellow';

  // Construct card with encrypted ciphertext in content
  const card_config = {
    ...config,
    type: config.type === 'encrypted_note' ? 'note' : (config.type || 'note'),
    title: card_title,
    content: ciphertext_string,
    is_encrypted: true,
    encrypted_payload,
    color: card_color,
  };

  // Add to board state
  const created_card = addCard(card_config);

  // Keep unlocked in the author's local session so they can immediately read/edit it
  unlock_card_in_session(created_card.id, initial_content, password);

  // Directly persist ciphertext to server
  patchCardOnServer(created_card.id, {
    content: ciphertext_string,
    is_encrypted: true,
    encrypted_payload,
  }).catch(() => {});

  showToast('Quantum-encrypted card created (AES-256-GCM)');
  return created_card;
}

/**
 * Encrypt an existing unencrypted card on the board.
 * @param {string} card_id
 * @param {string} password
 * @param {string} [hint='']
 */
export async function encrypt_existing_card(card_id, password, hint = '') {
  const current_cards = activeBoardSignal.value?.cards || [];
  const target = current_cards.find((c) => c.id === card_id);
  if (!target) throw new Error('Card not found');

  const current_plaintext = target.content || '';
  const encrypted_payload = await encrypt_content_post_quantum(current_plaintext, password, { hint });
  const ciphertext_string = JSON.stringify(encrypted_payload);

  // Update card state
  updateCard(
    card_id,
    {
      is_encrypted: true,
      encrypted_payload,
      content: ciphertext_string,
    },
    true
  );

  // Retain unlocked in current session
  unlock_card_in_session(card_id, current_plaintext, password);

  // Sync ciphertext to server
  patchCardOnServer(card_id, {
    content: ciphertext_string,
    is_encrypted: true,
    encrypted_payload,
  }).catch(() => {});

  showToast('Card converted to Quantum-Encrypted Note');
}

/**
 * Re-encrypt and update an unlocked card's content when the user edits the note.
 * Plaintext is held in session; ciphertext is saved to board and transmitted to server.
 *
 * @param {string} card_id
 * @param {string} new_plaintext
 */
let debounce_timers = {};
export function update_encrypted_card_content(card_id, new_plaintext) {
  const session = unlockedCardsSignal.value[card_id];
  if (!session) return;

  // Immediate in-memory update for fluid typing
  unlockedCardsSignal.value = {
    ...unlockedCardsSignal.value,
    [card_id]: {
      ...session,
      plaintext: new_plaintext,
    },
  };

  // Debounce encryption & server patching
  if (debounce_timers[card_id]) {
    clearTimeout(debounce_timers[card_id]);
  }

  debounce_timers[card_id] = setTimeout(async () => {
    try {
      const card = (activeBoardSignal.value?.cards || []).find((c) => c.id === card_id);
      const hint = card?.encrypted_payload?.hint || '';
      const new_payload = await encrypt_content_post_quantum(new_plaintext, session.password, { hint });
      const ciphertext_string = JSON.stringify(new_payload);

      // Update active board with encrypted content
      updateCard(
        card_id,
        {
          content: ciphertext_string,
          encrypted_payload: new_payload,
          is_encrypted: true,
        },
        false
      );

      // Transmit strictly ciphertext to server
      patchCardOnServer(card_id, {
        content: ciphertext_string,
        encrypted_payload: new_payload,
        is_encrypted: true,
      }).catch(() => {});
    } catch (err) {
      console.warn('[Lumen Encryption] Error re-encrypting card content:', err);
    }
  }, 350);
}
