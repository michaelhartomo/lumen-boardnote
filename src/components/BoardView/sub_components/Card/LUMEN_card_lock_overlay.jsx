import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import styles from './LUMEN_card_lock_overlay.module.css';
import { unlockCard, selectedCardsSignal } from '../../signals/boardState.js';
import {
  cardSecurityGuardSignal,
  get_card_security_status,
  track_card_lockout,
} from '../../utils/card_encryption_guard.js';

export default function LUMEN_card_lock_overlay({ card }) {
  useSignals();

  const [passkey, set_passkey] = useState('');
  const [show_passkey, set_show_passkey] = useState(false);
  const [error_msg, set_error_msg] = useState('');
  const [is_unlocking, set_is_unlocking] = useState(false);
  const [is_shaking, set_is_shaking] = useState(false);

  const card_id = card?.id;
  const encryption_meta = card?.card_encryption || card?.cardEncryption || {};
  const passkey_hint = encryption_meta.passkey_hint || encryption_meta.hint || '';

  // Get reactive security guard status (lockout, remaining seconds, failed attempts)
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

  const handle_unlock = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (is_locked_out) {
      set_error_msg(`Locked: wait ${remaining_seconds}s before retrying`);
      trigger_shake();
      return;
    }

    if (!passkey.trim()) {
      set_error_msg('Enter passkey');
      trigger_shake();
      return;
    }

    set_error_msg('');
    set_is_unlocking(true);

    try {
      await unlockCard(card.id, passkey.trim());
      set_passkey('');
    } catch (err) {
      const is_incorrect = err.message && (err.message.includes('Incorrect') || err.message.includes('failed'));
      const current_status = get_card_security_status(card.id);

      if (current_status.is_locked_out) {
        set_error_msg(`Too many failed attempts. Cooldown ${current_status.remaining_seconds}s`);
      } else if (is_incorrect) {
        const attempt_count = current_status.failed_attempts;
        set_error_msg(
          attempt_count >= 2
            ? `Incorrect passkey (${attempt_count} attempts)`
            : 'Incorrect passkey'
        );
      } else {
        set_error_msg(err.message || 'Unlock failed');
      }
      trigger_shake();
    } finally {
      set_is_unlocking(false);
    }
  };

  const trigger_shake = () => {
    set_is_shaking(true);
    setTimeout(() => set_is_shaking(false), 450);
  };

  return (
    <div
      className={styles['lumen-card-lock-container']}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={() => {
        selectedCardsSignal.value = [card.id];
      }}
    >
      <div
        className={`${styles['lumen-card-lock-shield']} ${
          is_shaking ? styles['lumen-card-lock-shield-shaking'] : ''
        } ${is_locked_out ? styles['lumen-card-lock-shield-locked'] : ''}`}
      >
        {is_locked_out ? <ShieldAlert size={15} /> : <Lock size={15} />}
      </div>

      <h4 className={styles['lumen-card-lock-title']}>
        {card.title ? card.title : 'Encrypted Card'}
      </h4>

      <form
        className={styles['lumen-card-lock-form']}
        onSubmit={handle_unlock}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className={styles['lumen-card-lock-input-wrap']}>
          <input
            type={show_passkey ? 'text' : 'password'}
            className={styles['lumen-card-lock-input']}
            value={passkey}
            onChange={(e) => {
              set_passkey(e.target.value);
              if (error_msg) set_error_msg('');
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={
              is_locked_out
                ? `Locked: ${remaining_seconds}s remaining`
                : passkey_hint
                ? `Passkey (${passkey_hint})`
                : 'Enter passkey...'
            }
            autoFocus={false}
            disabled={is_unlocking || is_locked_out}
          />
          <button
            type="button"
            className={styles['lumen-card-lock-toggle-visibility']}
            onClick={() => set_show_passkey(!show_passkey)}
            onMouseDown={(e) => e.stopPropagation()}
            title={show_passkey ? 'Hide passkey' : 'Show passkey'}
            tabIndex={-1}
            disabled={is_locked_out}
          >
            {show_passkey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            type="submit"
            className={styles['lumen-card-lock-submit-btn']}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={is_unlocking || is_locked_out || !passkey.trim()}
            title={is_locked_out ? `Wait ${remaining_seconds}s` : 'Unlock card'}
          >
            {is_unlocking ? (
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <ArrowRight size={13} strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Lockout countdown badge */}
        {is_locked_out && (
          <div className={styles['lumen-card-lock-cooldown-badge']}>
            <ShieldAlert size={11} />
            <span>Locked out: retry in {remaining_seconds}s</span>
          </div>
        )}

        {/* Error message when not locked out */}
        {!is_locked_out && error_msg && (
          <span className={styles['lumen-card-lock-error']}>{error_msg}</span>
        )}

        {/* Brute force security indicator */}
        {!is_locked_out && !error_msg && failed_attempts > 0 && (
          <span className={styles['lumen-card-lock-guard-pill']}>
            <ShieldCheck size={10} color="#64748b" />
            <span>Attempt {failed_attempts} failed</span>
          </span>
        )}
      </form>
    </div>
  );
}
