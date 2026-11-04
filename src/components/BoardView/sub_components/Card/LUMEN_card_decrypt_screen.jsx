import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, HelpCircle, ShieldCheck } from 'lucide-react';
import styles from './LUMEN_card_decrypt_screen.module.css';
import { decrypt_and_unlock_card } from '../../signals/cardEncryptionState.js';
import {
  cardSecurityGuardSignal,
  get_card_security_status,
  track_card_lockout,
} from '../../utils/card_encryption_guard.js';

export function LUMEN_card_decrypt_screen({ card }) {
  useSignals();

  const [password, set_password] = useState('');
  const [show_password, set_show_password] = useState(false);
  const [error_msg, set_error_msg] = useState('');
  const [is_decrypting, set_is_decrypting] = useState(false);

  const card_id = card?.id;

  // Real-time security guard status
  const guard_status = card_id
    ? cardSecurityGuardSignal.value[card_id] || get_card_security_status(card_id)
    : { is_locked_out: false, remaining_seconds: 0, failed_attempts: 0 };

  const is_locked_out = guard_status.is_locked_out;
  const remaining_seconds = guard_status.remaining_seconds;
  const failed_attempts = guard_status.failed_attempts || 0;

  useEffect(() => {
    if (card_id) {
      track_card_lockout(card_id);
    }
  }, [card_id]);

  // Extract hint if stored in encrypted_payload
  const hint = card?.encrypted_payload?.hint || (() => {
    if (typeof card?.content === 'string') {
      try {
        const parsed = JSON.parse(card.content);
        return parsed?.hint || '';
      } catch {
        return '';
      }
    }
    return '';
  })();

  const handle_decrypt = async (e) => {
    if (e) e.preventDefault();
    set_error_msg('');

    if (is_locked_out) {
      set_error_msg(`Brute-force protection: card locked for ${remaining_seconds}s.`);
      return;
    }

    if (!password) {
      set_error_msg('Please enter the password to view this card.');
      return;
    }

    set_is_decrypting(true);
    try {
      await decrypt_and_unlock_card(card, password);
    } catch (err) {
      console.warn('[Lumen Decrypt Screen] Decryption failure:', err.message);
      const current_status = get_card_security_status(card.id);
      if (current_status.is_locked_out) {
        set_error_msg(`Too many failed attempts. Temporary cooldown of ${current_status.remaining_seconds}s activated.`);
      } else {
        const attempts = current_status.failed_attempts;
        set_error_msg(
          attempts >= 2
            ? `Incorrect password (Attempt ${attempts} failed. Cooldown pending).`
            : 'Incorrect password. Cryptographic authentication failed.'
        );
      }
    } finally {
      set_is_decrypting(false);
    }
  };

  return (
    <div
      className={styles['lumen-decrypt-container']}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles['lumen-decrypt-icon-wrap']}>
        <div className={styles['lumen-decrypt-pulse-ring']} />
        {is_locked_out ? <ShieldAlert size={20} color="#dc2626" /> : <Lock size={20} />}
      </div>

      <div className={styles['lumen-decrypt-title']}>
        {card?.title ? card.title : 'Quantum-Encrypted Note'}
      </div>
      <div className={styles['lumen-decrypt-subtitle']}>
        <ShieldCheck size={12} color="#059669" />
        <span>Post-Quantum AES-256 + 310k PBKDF2</span>
      </div>

      {hint && (
        <div className={styles['lumen-decrypt-hint-badge']} title="Creator Password Hint">
          <HelpCircle size={11} color="#64748b" />
          <span>Hint: {hint}</span>
        </div>
      )}

      {/* Lockout countdown warning banner */}
      {is_locked_out && (
        <div className={styles['lumen-decrypt-lockout-banner']}>
          <ShieldAlert size={13} />
          <span>Protection Active: Retry in {remaining_seconds}s</span>
        </div>
      )}

      <form className={styles['lumen-decrypt-form']} onSubmit={handle_decrypt}>
        <div className={styles['lumen-decrypt-input-wrap']}>
          <input
            type={show_password ? 'text' : 'password'}
            className={styles['lumen-decrypt-input']}
            value={password}
            onChange={(e) => {
              set_password(e.target.value);
              if (error_msg) set_error_msg('');
            }}
            placeholder={is_locked_out ? `Locked: wait ${remaining_seconds}s` : 'Enter note password'}
            autoFocus={!is_locked_out}
            disabled={is_decrypting || is_locked_out}
          />
          <button
            type="button"
            className={styles['lumen-decrypt-toggle-btn']}
            onClick={() => set_show_password(!show_password)}
            title={show_password ? 'Hide password' : 'Show password'}
            disabled={is_locked_out}
          >
            {show_password ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        <button
          type="submit"
          className={styles['lumen-decrypt-btn']}
          disabled={is_decrypting || is_locked_out || !password}
        >
          {is_decrypting ? (
            <>
              <div className={styles['lumen-decrypt-spinner']} />
              <span>Verifying AES-GCM...</span>
            </>
          ) : is_locked_out ? (
            <>
              <ShieldAlert size={13} />
              <span>Locked ({remaining_seconds}s)</span>
            </>
          ) : (
            <>
              <KeyRound size={13} />
              <span>Decrypt & View</span>
            </>
          )}
        </button>

        {error_msg && (
          <div className={styles['lumen-decrypt-error']}>
            {error_msg}
          </div>
        )}

        {!is_locked_out && !error_msg && failed_attempts > 0 && (
          <div className={styles['lumen-decrypt-security-pill']}>
            <ShieldAlert size={10} color="#f97316" />
            <span>Attempt {failed_attempts} failed</span>
          </div>
        )}
      </form>
    </div>
  );
}

export default LUMEN_card_decrypt_screen;
