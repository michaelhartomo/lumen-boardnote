import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import styles from './LUMEN_user_avatar.module.css';

/**
 * LUMEN_user_avatar Component
 *
 * Renders user avatar with safe presence checking:
 * - If user_avatar is an image URL, renders <img> with onError fallback to initials.
 * - If user_full_name or user_account exists, renders clean two-letter uppercase initials.
 * - If neither exists (guest user), renders a graceful guest user icon or fallback.
 * - Optional status indicator showing active/inactive/pending/guest state.
 */
export default function LUMEN_user_avatar({
  user_avatar,
  user_account,
  user_full_name,
  user_status,
  size = 22,
  show_status = false,
  bg_color = '#2563eb',
  class_name = '',
  title = '',
} = {}) {
  const [image_failed, set_image_failed] = useState(false);

  useEffect(() => {
    set_image_failed(false);
  }, [user_avatar]);

  // Check if guest user (no account and no full name)
  const is_guest = !user_account && !user_full_name && !user_avatar;

  // Derive display initials safely
  let initials = 'G';
  if (user_full_name && typeof user_full_name === 'string' && user_full_name.trim() !== '') {
    initials = user_full_name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  } else if (user_account && typeof user_account === 'string' && user_account.trim() !== '') {
    initials = user_account.trim().slice(0, 2).toUpperCase();
  }

  // Check if user_avatar is a valid image URL string
  const has_avatar_url = Boolean(
    user_avatar &&
      typeof user_avatar === 'string' &&
      user_avatar.trim() !== '' &&
      !image_failed &&
      (user_avatar.startsWith('http://') ||
        user_avatar.startsWith('https://') ||
        user_avatar.startsWith('/') ||
        user_avatar.startsWith('data:image/'))
  );

  const font_size = Math.max(9, Math.round(size * 0.4));

  // Determine status color class
  let status_class = styles['lumen-status-inactive'] || styles.lumenStatusInactive;
  const status_lower = (user_status || '').toLowerCase().trim();
  if (status_lower === 'active') {
    status_class = styles['lumen-status-active'] || styles.lumenStatusActive;
  } else if (status_lower === 'pending') {
    status_class = styles['lumen-status-pending'] || styles.lumenStatusPending;
  } else if (is_guest || status_lower === 'guest') {
    status_class = styles['lumen-status-guest'] || styles.lumenStatusGuest;
  }

  const tooltip_text =
    title ||
    (is_guest
      ? 'Guest User'
      : `${user_full_name || user_account}${user_status ? ` (${user_status})` : ''}`);

  const container_classes = `${styles['lumen-avatar-container'] || styles.lumenAvatarContainer} ${class_name}`.trim();
  const circle_classes = `${styles['lumen-avatar-circle'] || styles.lumenAvatarCircle} ${
    is_guest ? (styles['lumen-avatar-guest'] || styles.lumenAvatarGuest) : ''
  }`.trim();

  return (
    <div
      className={container_classes}
      style={{ width: size, height: size }}
      title={tooltip_text}
    >
      <div
        className={circle_classes}
        style={{
          backgroundColor: has_avatar_url ? 'transparent' : bg_color,
          fontSize: `${font_size}px`,
        }}
      >
        {has_avatar_url ? (
          <img
            src={user_avatar}
            alt={user_full_name || user_account || 'User Avatar'}
            className={styles['lumen-avatar-image'] || styles.lumenAvatarImage}
            onError={() => set_image_failed(true)}
          />
        ) : is_guest ? (
          <User size={Math.round(size * 0.58)} />
        ) : (
          <span className={styles['lumen-avatar-fallback'] || styles.lumenAvatarFallback}>
            {initials}
          </span>
        )}
      </div>

      {show_status && user_status && (
        <span
          className={`${styles['lumen-status-indicator'] || styles.lumenStatusIndicator} ${status_class}`}
          title={`Status: ${user_status}`}
        />
      )}
    </div>
  );
}
