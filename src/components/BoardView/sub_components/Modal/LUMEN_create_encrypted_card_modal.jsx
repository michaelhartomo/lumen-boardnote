import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Lock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  X,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  Dices,
} from 'lucide-react';
import styles from './LUMEN_create_encrypted_card_modal.module.css';
import {
  validate_passkey_policy,
  calculate_brute_force_entropy,
  generate_strong_passkey,
} from '../../utils/card_encryption_guard.js';

export default function LUMEN_create_encrypted_card_modal({
  is_open,
  type_item,
  on_close,
  on_create_encrypted,
}) {
  const [passkey, set_passkey] = useState('');
  const [confirm_passkey, set_confirm_passkey] = useState('');
  const [passkey_hint, set_passkey_hint] = useState('');
  const [show_passkey, set_show_passkey] = useState(false);
  const [error_msg, set_error_msg] = useState('');
  const [is_creating, set_is_creating] = useState(false);
  const [copied_generated, set_copied_generated] = useState(false);

  if (!is_open) return null;

  const item_label = type_item?.label || 'Card';
  const policy = validate_passkey_policy(passkey);
  const entropy = calculate_brute_force_entropy(passkey);
  const is_match = Boolean(passkey && confirm_passkey && passkey === confirm_passkey);

  const handle_close = () => {
    set_passkey('');
    set_confirm_passkey('');
    set_passkey_hint('');
    set_error_msg('');
    set_copied_generated(false);
    if (typeof on_close === 'function') {
      on_close();
    }
  };

  const handle_generate_passkey = () => {
    const strong_pass = generate_strong_passkey(16);
    set_passkey(strong_pass);
    set_confirm_passkey(strong_pass);
    set_show_passkey(true);
    set_error_msg('');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(strong_pass).catch(() => {});
      set_copied_generated(true);
      setTimeout(() => set_copied_generated(false), 2500);
    }
  };

  const handle_submit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!passkey || passkey.trim().length === 0) {
      set_error_msg('Please enter a passkey to encrypt this card.');
      return;
    }
    if (!policy.is_valid) {
      set_error_msg(
        policy.message ||
          'Passkey must be at least 10 characters with uppercase, lowercase, numbers, and symbols (e.g., K9#mQ2$vL8).'
      );
      return;
    }
    if (!entropy.is_acceptable) {
      set_error_msg(
        entropy.feedback || 'Passkey is too weak against brute-force attacks.'
      );
      return;
    }
    if (passkey !== confirm_passkey) {
      set_error_msg('Passkeys do not match. Please verify.');
      return;
    }

    set_error_msg('');
    set_is_creating(true);

    try {
      await on_create_encrypted({
        passkey,
        passkey_hint: passkey_hint.trim(),
      });
      set_passkey('');
      set_confirm_passkey('');
      set_passkey_hint('');
      set_copied_generated(false);
      on_close();
    } catch (err) {
      set_error_msg(err.message || 'Failed to create encrypted card');
    } finally {
      set_is_creating(false);
    }
  };

  const modal_content = (
    <div
      className={styles['lumen-modal-backdrop']}
      onClick={handle_close}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        className={styles['lumen-modal-window']}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lumen-create-encrypted-card-title"
      >
        <div className={styles['lumen-modal-header']}>
          <div className={styles['lumen-modal-title-group']}>
            <div className={styles['lumen-modal-shield-icon']}>
              <Shield size={18} />
            </div>
            <div>
              <h3
                id="lumen-create-encrypted-card-title"
                className={styles['lumen-modal-title']}
              >
                Create Encrypted {item_label}
              </h3>
              <div className={styles['lumen-modal-subtitle']}>
                AES-256-GCM + 310,000 PBKDF2 Rounds + Password Policy Guard
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles['lumen-modal-close-btn']}
            onClick={handle_close}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form className={styles['lumen-modal-form']} onSubmit={handle_submit}>
          <div className={styles['lumen-modal-body']}>
            {error_msg && (
              <div className={styles['lumen-modal-error-banner']}>
                <AlertCircle size={14} />
                <span>{error_msg}</span>
              </div>
            )}

            <div className={styles['lumen-modal-field']}>
              <div className={styles['lumen-modal-label-row']}>
                <label className={styles['lumen-modal-label']}>
                  Set Card Passkey{' '}
                  <span className={styles['lumen-modal-label-required']}>
                    * (10+ chars, Mixed Case &amp; Symbols)
                  </span>
                </label>
                <span
                  className={styles['lumen-modal-entropy-badge']}
                  style={{ color: entropy.color }}
                >
                  {entropy.label}
                </span>
              </div>
              <div className={styles['lumen-modal-input-wrap']}>
                <input
                  type={show_passkey ? 'text' : 'password'}
                  className={styles['lumen-modal-input']}
                  value={passkey}
                  onChange={(e) => {
                    set_passkey(e.target.value);
                    if (error_msg) set_error_msg('');
                  }}
                  placeholder="e.g., K9#mQ2$vL8"
                  autoFocus
                />
                <button
                  type="button"
                  className={styles['lumen-modal-toggle-eye']}
                  onClick={() => set_show_passkey(!show_passkey)}
                  title={show_passkey ? 'Hide passkey' : 'Show passkey'}
                  tabIndex={-1}
                >
                  {show_passkey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Password Policy Live Checklist Box */}
              <div className={styles['lumen-policy-box']}>
                <div className={styles['lumen-policy-header']}>
                  <span className={styles['lumen-policy-title']}>
                    Password Policy: 10+ chars (Mixed + Symbols)
                  </span>
                  <span
                    className={`${styles['lumen-policy-counter']} ${
                      policy.is_valid ? styles['lumen-policy-counter-valid'] : ''
                    }`}
                  >
                    {policy.passed_count}/5 Requirements
                  </span>
                </div>
                <div className={styles['lumen-policy-grid']}>
                  <div
                    className={`${styles['lumen-policy-pill']} ${
                      policy.length ? styles['lumen-policy-pill-valid'] : ''
                    }`}
                  >
                    {policy.length ? (
                      <Check size={11} className={styles['lumen-policy-icon']} />
                    ) : (
                      <span className={styles['lumen-policy-dot']} />
                    )}
                    <span>10+ Chars ({passkey.length}/10)</span>
                  </div>
                  <div
                    className={`${styles['lumen-policy-pill']} ${
                      policy.upper ? styles['lumen-policy-pill-valid'] : ''
                    }`}
                  >
                    {policy.upper ? (
                      <Check size={11} className={styles['lumen-policy-icon']} />
                    ) : (
                      <span className={styles['lumen-policy-dot']} />
                    )}
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div
                    className={`${styles['lumen-policy-pill']} ${
                      policy.lower ? styles['lumen-policy-pill-valid'] : ''
                    }`}
                  >
                    {policy.lower ? (
                      <Check size={11} className={styles['lumen-policy-icon']} />
                    ) : (
                      <span className={styles['lumen-policy-dot']} />
                    )}
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div
                    className={`${styles['lumen-policy-pill']} ${
                      policy.number ? styles['lumen-policy-pill-valid'] : ''
                    }`}
                  >
                    {policy.number ? (
                      <Check size={11} className={styles['lumen-policy-icon']} />
                    ) : (
                      <span className={styles['lumen-policy-dot']} />
                    )}
                    <span>Number (0-9)</span>
                  </div>
                  <div
                    className={`${styles['lumen-policy-pill']} ${
                      policy.symbol ? styles['lumen-policy-pill-valid'] : ''
                    }`}
                  >
                    {policy.symbol ? (
                      <Check size={11} className={styles['lumen-policy-icon']} />
                    ) : (
                      <span className={styles['lumen-policy-dot']} />
                    )}
                    <span>Symbol (!@#$...)</span>
                  </div>
                </div>
              </div>

              {/* Brute-Force Entropy & Cracking Resistance Meter */}
              <div className={styles['lumen-entropy-meter-wrap']}>
                <div className={styles['lumen-entropy-bars']}>
                  <div
                    className={styles['lumen-entropy-bar']}
                    style={{
                      backgroundColor: entropy.score >= 1 ? entropy.color : undefined,
                    }}
                  />
                  <div
                    className={styles['lumen-entropy-bar']}
                    style={{
                      backgroundColor: entropy.score >= 2 ? entropy.color : undefined,
                    }}
                  />
                  <div
                    className={styles['lumen-entropy-bar']}
                    style={{
                      backgroundColor: entropy.score >= 3 ? entropy.color : undefined,
                    }}
                  />
                  <div
                    className={styles['lumen-entropy-bar']}
                    style={{
                      backgroundColor: entropy.score >= 4 ? entropy.color : undefined,
                    }}
                  />
                </div>

                <div className={styles['lumen-entropy-labels']}>
                  <span className={styles['lumen-entropy-crack-time']}>
                    Est. crack time: <strong>{entropy.crack_time_estimate}</strong> ({entropy.entropy_bits} bits entropy)
                  </span>
                </div>

                <div className={styles['lumen-passkey-actions']}>
                  <button
                    type="button"
                    className={styles['lumen-generate-passkey-btn']}
                    onClick={handle_generate_passkey}
                    title="Generate high-entropy 16-character passkey matching password policy"
                  >
                    <Dices size={13} />
                    <span>{copied_generated ? 'Generated & Copied!' : 'Generate Strong Passkey'}</span>
                  </button>
                  {copied_generated && (
                    <span className={styles['lumen-copied-indicator']}>
                      <Check size={12} /> Copied to clipboard
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles['lumen-modal-field']}>
              <div className={styles['lumen-modal-label-row']}>
                <label className={styles['lumen-modal-label']}>
                  Confirm Passkey <span className={styles['lumen-modal-label-required']}>*</span>
                </label>
                {confirm_passkey.length > 0 && (
                  <span
                    className={`${styles['lumen-match-status']} ${
                      is_match ? styles['lumen-match-status-valid'] : styles['lumen-match-status-invalid']
                    }`}
                  >
                    {is_match ? <Check size={12} /> : <AlertCircle size={12} />}
                    <span>{is_match ? 'Passkeys match' : 'Passkeys do not match'}</span>
                  </span>
                )}
              </div>
              <div className={styles['lumen-modal-input-wrap']}>
                <input
                  type={show_passkey ? 'text' : 'password'}
                  className={styles['lumen-modal-input']}
                  value={confirm_passkey}
                  onChange={(e) => {
                    set_confirm_passkey(e.target.value);
                    if (error_msg) set_error_msg('');
                  }}
                  placeholder="Repeat passkey (e.g., K9#mQ2$vL8)..."
                />
              </div>
            </div>

            <div className={styles['lumen-modal-field']}>
              <div className={styles['lumen-modal-label-row']}>
                <label className={styles['lumen-modal-label']}>Passkey Hint (Optional)</label>
                <span className={styles['lumen-modal-label-muted']}>Never include the passkey itself</span>
              </div>
              <div className={styles['lumen-modal-input-wrap']}>
                <input
                  type="text"
                  className={styles['lumen-modal-input']}
                  value={passkey_hint}
                  onChange={(e) => set_passkey_hint(e.target.value)}
                  placeholder="e.g. My favorite studio project..."
                />
              </div>
            </div>
          </div>

          <div className={styles['lumen-modal-footer']}>
            <button
              type="button"
              className={styles['lumen-modal-btn-cancel']}
              onClick={handle_close}
              disabled={is_creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles['lumen-modal-btn-submit']}
              disabled={is_creating || !policy.is_valid || !entropy.is_acceptable || !is_match}
            >
              {is_creating ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Encrypting...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Create Encrypted Card</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modal_content, document.body)
    : null;
}

