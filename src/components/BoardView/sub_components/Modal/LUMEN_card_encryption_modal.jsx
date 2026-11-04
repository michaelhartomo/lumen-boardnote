import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  KeyRound,
  Sparkles,
  Dices,
  Check,
  Copy,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import styles from './LUMEN_card_encryption_modal.module.css';
import {
  cardEncryptionModalSignal,
  close_card_encryption_modal,
  encrypt_and_create_card,
  encrypt_existing_card,
} from '../../signals/cardEncryptionState.js';
import { activeBoardSignal } from '../../signals/boardState.js';
import {
  calculate_brute_force_entropy,
  generate_strong_passkey,
  validate_passkey_policy,
} from '../../utils/card_encryption_guard.js';

export function LUMEN_card_encryption_modal() {
  useSignals();
  const modal_state = cardEncryptionModalSignal.value;

  const [title, set_title] = useState(modal_state.initial_title || 'Confidential Note');
  const [password, set_password] = useState('');
  const [confirm_password, set_confirm_password] = useState('');
  const [hint, set_hint] = useState('');
  const [content, set_content] = useState(modal_state.initial_content || '');
  const [color, set_color] = useState('yellow');
  const [show_password, set_show_password] = useState(false);
  const [error_msg, set_error_msg] = useState('');
  const [is_submitting, set_is_submitting] = useState(false);
  const [copied_generated, set_copied_generated] = useState(false);

  if (!modal_state.is_open) return null;

  const is_create_mode = modal_state.mode === 'create';
  const entropy = calculate_brute_force_entropy(password);
  const policy = validate_passkey_policy(password);
  const is_match = Boolean(password && confirm_password && password === confirm_password);
  const is_mismatch = Boolean(confirm_password && password !== confirm_password);

  const handle_generate_passkey = () => {
    const strong_pass = generate_strong_passkey(16);
    set_password(strong_pass);
    set_confirm_password(strong_pass);
    set_show_password(true);
    set_error_msg('');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(strong_pass).catch(() => {});
      set_copied_generated(true);
      setTimeout(() => set_copied_generated(false), 2500);
    }
  };

  const handle_submit = async (e) => {
    if (e) e.preventDefault();
    set_error_msg('');

    if (!password || password.trim().length === 0) {
      set_error_msg('Note passkey is required to encrypt content.');
      return;
    }

    if (!policy.is_valid) {
      set_error_msg(policy.message || 'Passkey must be at least 10 characters with mixed case, numbers, and symbols (e.g., K9#mQ2$vL8).');
      return;
    }

    if (!entropy.is_acceptable) {
      set_error_msg(entropy.feedback || 'Passkey is too weak against brute-force attacks.');
      return;
    }

    if (password !== confirm_password) {
      set_error_msg('Passwords do not match. Please verify.');
      return;
    }

    set_is_submitting(true);
    try {
      if (is_create_mode) {
        // Calculate center viewport position if not provided
        const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
        const center_x = Math.round((-vp.panX + window.innerWidth / 2 - 160) / (vp.zoom || 1));
        const center_y = Math.round((-vp.panY + window.innerHeight / 2 - 120) / (vp.zoom || 1));

        const card_config = {
          ...(modal_state.target_config || {}),
          title: title.trim() || modal_state.target_config?.title || 'Encrypted Note',
          x: modal_state.target_config?.x !== undefined ? modal_state.target_config.x : center_x,
          y: modal_state.target_config?.y !== undefined ? modal_state.target_config.y : center_y,
          color: color || modal_state.target_config?.color || 'yellow',
          width: modal_state.target_config?.width || 320,
          height: modal_state.target_config?.height || 220,
        };

        await encrypt_and_create_card(card_config, password, content, hint);
      } else {
        // Encrypt existing card
        await encrypt_existing_card(modal_state.card_id, password, hint);
      }

      close_card_encryption_modal();
    } catch (err) {
      console.error('[Lumen Card Encryption] Submit error:', err);
      set_error_msg(err.message || 'Failed to encrypt card.');
    } finally {
      set_is_submitting(false);
    }
  };

  const CARD_COLORS = [
    { id: 'yellow', bg: '#fef08a' },
    { id: 'peach', bg: '#fed7aa' },
    { id: 'green', bg: '#bbf7d0' },
    { id: 'blue', bg: '#bfdbfe' },
    { id: 'purple', bg: '#e9d5ff' },
    { id: 'slate', bg: '#e2e8f0' },
  ];

  const modal_content = (
    <div
      className={styles['lumen-modal-backdrop']}
      onClick={close_card_encryption_modal}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        className={styles['lumen-modal-window']}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lumen-encryption-title"
      >
        <div className={styles['lumen-modal-header']}>
          <div className={styles['lumen-modal-title-group']}>
            <div className={styles['lumen-modal-icon-badge']}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div id="lumen-encryption-title" className={styles['lumen-modal-title']}>
                {is_create_mode ? 'Create Quantum-Proof Encrypted Card' : 'Encrypt Note with Password'}
              </div>
              <div className={styles['lumen-modal-subtitle']}>
                256-Bit AES-GCM + 310,000 PBKDF2 Rounds + Brute-Force Rate Limiting
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles['lumen-modal-close-btn']}
            onClick={close_card_encryption_modal}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form className={styles['lumen-modal-form']} onSubmit={handle_submit}>
          <div className={styles['lumen-modal-body']}>
            {/* Post-quantum & brute-force protection information banner */}
            <div className={styles['lumen-quantum-badge-banner']}>
              <Sparkles size={16} className={styles['lumen-quantum-shield-icon']} />
              <div>
                <strong>Zero-Knowledge & Anti-Brute-Force Protected:</strong> Content is encrypted strictly
                in your browser before transmission. Decryption requires 310,000 PBKDF2 rounds, and online
                attempts are throttled with exponential backoff lockout.
              </div>
            </div>

            {error_msg && (
              <div className={styles['lumen-error-banner']}>
                <AlertCircle size={15} />
                <span>{error_msg}</span>
              </div>
            )}

            {/* Card Title */}
            <div className={styles['lumen-form-group']}>
              <label className={styles['lumen-form-label']}>
                <span>Card Title</span>
              </label>
              <input
                type="text"
                className={styles['lumen-form-input']}
                value={title}
                onChange={(e) => set_title(e.target.value)}
                placeholder="e.g., Financial Credentials, Private Key"
              />
            </div>

            {/* Password */}
            <div className={styles['lumen-form-group']}>
              <div className={styles['lumen-form-label']}>
                <span>
                  Note Passkey <span className={styles['lumen-form-label-required']}>* (10+ chars, Mixed Case & Symbols)</span>
                </span>
                <span style={{ fontSize: '11px', color: entropy.color, fontWeight: 700 }}>
                  {entropy.label}
                </span>
              </div>

              <div className={styles['lumen-password-input-wrap']}>
                <input
                  type={show_password ? 'text' : 'password'}
                  className={styles['lumen-form-input']}
                  value={password}
                  onChange={(e) => {
                    set_password(e.target.value);
                    if (error_msg) set_error_msg('');
                  }}
                  placeholder="e.g., K9#mQ2$vL8"
                  required
                />
                <button
                  type="button"
                  className={styles['lumen-password-toggle-btn']}
                  onClick={() => set_show_password(!show_password)}
                  title={show_password ? 'Hide password' : 'Show password'}
                >
                  {show_password ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Policy Enforcement Live Checklist */}
              <div className={styles['lumen-policy-box']}>
                <div className={styles['lumen-policy-header']}>
                  <span className={styles['lumen-policy-title']}>
                    Policy: 10 chars (Mixed + Symbols) (e.g., K9#mQ2$vL8)
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
                    <span>10+ Chars ({password.length}/10)</span>
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

              {/* Entropy & Brute Force Cracking Resistance Meter */}
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

                {/* Quick Generator Button */}
                <div className={styles['lumen-passkey-actions']}>
                  <button
                    type="button"
                    className={styles['lumen-generate-passkey-btn']}
                    onClick={handle_generate_passkey}
                    title="Generate high-entropy 16-character passkey matching policy"
                  >
                    <Dices size={13} />
                    <span>{copied_generated ? 'Generated & Copied!' : 'Generate Strong Passkey'}</span>
                  </button>
                  {copied_generated && (
                    <span style={{ fontSize: '10.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Check size={12} /> Copied to clipboard
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Confirm Password */}
            <div className={styles['lumen-form-group']}>
              <label className={styles['lumen-form-label']}>
                <span>
                  Confirm Passkey <span className={styles['lumen-form-label-required']}>*</span>
                </span>
                {confirm_password.length > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: is_match ? '#10b981' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    {is_match ? <Check size={12} /> : <AlertCircle size={12} />}
                    {is_match ? 'Passkeys match' : 'Passkeys do not match'}
                  </span>
                )}
              </label>
              <input
                type={show_password ? 'text' : 'password'}
                className={styles['lumen-form-input']}
                value={confirm_password}
                onChange={(e) => {
                  set_confirm_password(e.target.value);
                  if (error_msg) set_error_msg('');
                }}
                placeholder="e.g., K9#mQ2$vL8"
                required
              />
            </div>

            {/* Password Hint (Optional) */}
            <div className={styles['lumen-form-group']}>
              <label className={styles['lumen-form-label']}>
                <span>Password Reminder Hint (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--lumen-text-muted)' }}>Never put the passkey itself</span>
              </label>
              <input
                type="text"
                className={styles['lumen-form-input']}
                value={hint}
                onChange={(e) => set_hint(e.target.value)}
                placeholder="e.g., Year of graduation + childhood pet"
              />
            </div>

            {/* Note Content (if create mode) */}
            {is_create_mode && (
              <div className={styles['lumen-form-group']}>
                <label className={styles['lumen-form-label']}>Note Content (Plaintext to Encrypt)</label>
                <textarea
                  className={styles['lumen-form-textarea']}
                  value={content}
                  onChange={(e) => set_content(e.target.value)}
                  placeholder="Enter secret message, keys, codes, or private notes..."
                  rows={4}
                />
              </div>
            )}

            {/* Card Background Color */}
            {is_create_mode && (
              <div className={styles['lumen-form-group']}>
                <label className={styles['lumen-form-label']}>Card Note Accent Color</label>
                <div className={styles['lumen-color-selector']}>
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`${styles['lumen-color-dot']} ${
                        color === c.id ? styles['lumen-color-dot-active'] : ''
                      }`}
                      style={{ backgroundColor: c.bg }}
                      onClick={() => set_color(c.id)}
                      title={`Select ${c.id}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles['lumen-modal-footer']}>
            <button
              type="button"
              className={styles['lumen-btn-secondary']}
              onClick={close_card_encryption_modal}
              disabled={is_submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles['lumen-btn-primary']}
              disabled={is_submitting || !policy.is_valid || !is_match}
            >
              {is_submitting ? (
                <>
                  <div className={styles['lumen-spinner']} />
                  <span>Deriving 310k Key...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>{is_create_mode ? 'Create Protected Card' : 'Encrypt Card'}</span>
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

export default LUMEN_card_encryption_modal;
