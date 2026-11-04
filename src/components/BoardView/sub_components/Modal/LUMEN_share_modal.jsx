import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  X,
  Copy,
  Check,
  Lock,
  Globe,
  UserPlus,
  Settings,
  Trash2,
  Link2,
  Eye,
  MessageSquare,
  Edit3,
} from 'lucide-react';
import styles from './LUMEN_share_modal.module.css';
import {
  isShareModalOpenSignal,
  shareModalTargetBoardIdSignal,
  closeShareModal,
  activeBoardSignal,
  boardsDirectorySignal,
  normalize_board_sharing,
  updateBoardSharing,
  showToast,
} from '../../signals/boardState.js';
import {
  lumenAuthSignal,
  currentUserSignal,
} from '../../signals/realtimeState.js';

const AVATAR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#db2777',
  '#0284c7',
];

function get_avatar_initials(name_or_acc) {
  const s = String(name_or_acc || 'U').trim();
  if (!s) return 'U';
  const parts = s.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

export function LUMEN_share_modal({ on_share } = {}) {
  useSignals();
  const [copied, set_copied] = useState(false);
  const [invite_input, set_invite_input] = useState('');
  const [invite_role, set_invite_role] = useState('editor');
  const [show_settings, set_show_settings] = useState(false);

  const target_id =
    shareModalTargetBoardIdSignal.value ||
    activeBoardSignal.value?.id ||
    activeBoardSignal.value?.board_code;

  const target_board =
    (activeBoardSignal.value &&
      (activeBoardSignal.value.id === target_id ||
        activeBoardSignal.value.board_code === target_id)
      ? activeBoardSignal.value
      : null) ||
    (boardsDirectorySignal.value || []).find(
      (b) => (b.id || b.board_code) === target_id
    ) ||
    activeBoardSignal.value ||
    {};

  const board_id = target_board.id || target_board.board_code || target_id || '';
  const board_title = target_board.title || target_board.board_name || 'Untitled Board';
  const sharing = normalize_board_sharing(
    target_board.sharing || target_board.board_setting?.sharing
  );

  const is_public = sharing.visibility === 'public';
  const public_role = sharing.public_role || 'viewer';
  const shared_users = Array.isArray(sharing.shared_users) ? sharing.shared_users : [];

  const auth = lumenAuthSignal.value;
  const current_user = currentUserSignal.value;
  const owner_account =
    target_board.user_account ||
    auth?.user_account ||
    current_user?.user_account ||
    'user007';
  const owner_email =
    owner_account === auth?.user_account && auth?.user_primary_email
      ? auth.user_primary_email
      : `${owner_account}@mysuperid.com`;

  const get_board_share_url = (target_id) => {
    if (typeof window === 'undefined' || !target_id) return '';
    try {
      const loc = window.location;
      // Strip any trailing /board/<id> or /boards to get clean root pathname
      let base_path = (loc.pathname || '/')
        .replace(/\/board\/[^/]+$/, '')
        .replace(/\/boards\/?$/, '');
      if (!base_path || !base_path.startsWith('/')) {
        base_path = '/';
      }
      if (!base_path.endsWith('/')) {
        base_path = `${base_path}/`;
      }
      // Construct canonical share URL with query param ?board=<id>
      // Root GET requests are 100% routed by cloud proxies and Google GFE without 404
      const url = new URL(`${loc.origin}${base_path}`);
      url.searchParams.set('board', target_id);
      return url.toString();
    } catch (e) {
      return `${window.location.origin}/?board=${encodeURIComponent(target_id)}`;
    }
  };

  const share_url = get_board_share_url(board_id);

  const handle_close = () => {
    closeShareModal();
  };

  const handle_visibility_change = async (next_visibility) => {
    const is_next_public = next_visibility === 'public';
    const updated = await updateBoardSharing(board_id, {
      visibility: is_next_public ? 'public' : 'private',
      general_access: is_next_public ? 'anyone_with_link' : 'restricted',
    });
    if (typeof on_share === 'function' && board_id) {
      on_share(board_id, { sharing: updated, url: share_url }).catch(() => {});
    }
    showToast(
      is_next_public
        ? `Board is now Public (Anyone with link: ${public_role})`
        : 'Board is now Private (Restricted to people with access)'
    );
  };

  const handle_public_role_change = async (e) => {
    const next_role = e.target.value;
    const updated = await updateBoardSharing(board_id, {
      visibility: 'public',
      general_access: 'anyone_with_link',
      public_role: next_role,
    });
    if (typeof on_share === 'function' && board_id) {
      on_share(board_id, { sharing: updated, url: share_url }).catch(() => {});
    }
    const role_label =
      next_role === 'editor'
        ? 'Editor (can edit)'
        : next_role === 'commenter'
        ? 'Commenter (can comment)'
        : 'Viewer (can view)';
    showToast(`Public link permission updated to ${role_label}`);
  };

  const handle_invite_user = async (e) => {
    if (e) e.preventDefault();
    const raw = invite_input.trim();
    if (!raw || !board_id) return;

    const entries = raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (entries.length === 0) return;

    const next_users = [...shared_users];
    let added_count = 0;

    entries.forEach((entry, i) => {
      const clean_entry = entry.replace(/^@/, '');
      const is_email = clean_entry.includes('@');
      const user_acc = is_email ? clean_entry.split('@')[0] : clean_entry;
      const email = is_email ? clean_entry.toLowerCase() : `${clean_entry}@mysuperid.com`;

      if (user_acc.toLowerCase() === String(owner_account).toLowerCase()) {
        return;
      }

      const existing_idx = next_users.findIndex(
        (u) =>
          (u.user_account || '').toLowerCase() === user_acc.toLowerCase() ||
          (u.email || '').toLowerCase() === email.toLowerCase()
      );

      const color = AVATAR_COLORS[(next_users.length + i) % AVATAR_COLORS.length];
      if (existing_idx !== -1) {
        next_users[existing_idx] = {
          ...next_users[existing_idx],
          role: invite_role,
        };
        added_count++;
      } else {
        next_users.push({
          id: `share_${user_acc.toLowerCase()}`,
          user_account: user_acc,
          email,
          name: user_acc,
          color,
          role: invite_role,
          added_at: Date.now(),
          added_by: auth?.user_account || owner_account,
        });
        added_count++;
      }
    });

    set_invite_input('');
    if (added_count > 0) {
      const updated = await updateBoardSharing(board_id, {
        shared_users: next_users,
      });
      if (typeof on_share === 'function' && board_id) {
        on_share(board_id, { sharing: updated, url: share_url }).catch(() => {});
      }
      showToast(`Shared board with ${entries.join(', ')} (${invite_role})`);
    } else {
      showToast('User is already the board owner');
    }
  };

  const handle_user_role_change = async (target_user_key, next_role) => {
    if (next_role === '__remove__') {
      await handle_remove_user(target_user_key);
      return;
    }
    const next_users = shared_users.map((u) => {
      const key = (u.user_account || u.email || u.id || '').toLowerCase();
      if (key === target_user_key.toLowerCase()) {
        return { ...u, role: next_role };
      }
      return u;
    });
    const updated = await updateBoardSharing(board_id, {
      shared_users: next_users,
    });
    if (typeof on_share === 'function' && board_id) {
      on_share(board_id, { sharing: updated, url: share_url }).catch(() => {});
    }
    showToast(`Updated access role to ${next_role}`);
  };

  const handle_remove_user = async (target_user_key) => {
    const next_users = shared_users.filter((u) => {
      const key = (u.user_account || u.email || u.id || '').toLowerCase();
      return key !== target_user_key.toLowerCase();
    });
    const updated = await updateBoardSharing(board_id, {
      shared_users: next_users,
    });
    if (typeof on_share === 'function' && board_id) {
      on_share(board_id, { sharing: updated, url: share_url }).catch(() => {});
    }
    showToast('Removed user access');
  };

  const handle_setting_toggle = async (key, checked) => {
    await updateBoardSharing(board_id, {
      [key]: checked,
    });
    showToast('Updated board sharing preferences');
  };

  const handle_copy_link = async () => {
    let success = false;
    try {
      if (navigator?.clipboard?.writeText && share_url) {
        await navigator.clipboard.writeText(share_url);
        success = true;
      }
    } catch (_) {}

    if (!success && typeof document !== 'undefined') {
      try {
        const input = document.getElementById('lumen-share-link-input');
        if (input) {
          input.select();
          document.execCommand('copy');
          success = true;
        }
      } catch (_) {}
    }

    if (!success && typeof on_share === 'function') {
      try {
        await on_share(board_id, { url: share_url, sharing });
        success = true;
      } catch (_) {}
    }

    set_copied(true);
    showToast(is_public ? 'Public link copied to clipboard' : 'Link copied to clipboard');
    setTimeout(() => set_copied(false), 2000);
  };

  const get_public_access_description = () => {
    if (!is_public) {
      return 'Only people with access can open with the link';
    }
    if (public_role === 'editor') {
      return 'Anyone on the internet with the link can organize, add, and edit cards';
    }
    if (public_role === 'commenter') {
      return 'Anyone on the internet with the link can view and comment';
    }
    return 'Anyone on the internet with the link can view';
  };

  return (
    <div
      className={styles['lumen-modal-backdrop'] || styles.lumenModalBackdrop}
      onClick={handle_close}
    >
      <div
        className={styles['lumen-modal-window'] || styles.lumenModalWindow}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${board_title}`}
      >
        {/* Modal Header */}
        <div className={styles['lumen-modal-header'] || styles.lumenModalHeader}>
          <div className={styles['lumen-modal-title-group']}>
            <div className={styles['lumen-modal-title'] || styles.lumenModalTitle}>
              Share &ldquo;{board_title}&rdquo;
            </div>
            <span
              className={`${styles['lumen-header-status-pill']} ${
                is_public
                  ? styles['lumen-header-status-public']
                  : styles['lumen-header-status-private']
              }`}
            >
              {is_public ? <Globe size={11} /> : <Lock size={11} />}
              <span>{is_public ? 'Public' : 'Private'}</span>
            </span>
          </div>

          <div className={styles['lumen-header-actions']}>
            <button
              type="button"
              className={`${styles['lumen-modal-icon-btn']} ${
                show_settings ? styles['lumen-modal-icon-btn-active'] : ''
              }`}
              onClick={() => set_show_settings(!show_settings)}
              title="Share settings"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              className={styles['lumen-modal-close-btn'] || styles.lumenModalCloseBtn}
              onClick={handle_close}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles['lumen-share-body'] || styles.lumenShareBody}>
          {/* Optional Google Drive Gear Settings Box */}
          {show_settings && (
            <div className={styles['lumen-share-settings-box']}>
              <div className={styles['lumen-share-settings-title']}>
                <Settings size={13} />
                <span>Sharing Permissions Settings</span>
              </div>
              <label className={styles['lumen-share-checkbox-row']}>
                <input
                  type="checkbox"
                  checked={sharing.allow_editors_to_share !== false}
                  onChange={(e) =>
                    handle_setting_toggle('allow_editors_to_share', e.target.checked)
                  }
                />
                <span>Editors can change permissions and share</span>
              </label>
              <label className={styles['lumen-share-checkbox-row']}>
                <input
                  type="checkbox"
                  checked={sharing.allow_viewers_to_copy !== false}
                  onChange={(e) =>
                    handle_setting_toggle('allow_viewers_to_copy', e.target.checked)
                  }
                />
                <span>
                  Viewers and commenters can see the option to download, export, and duplicate
                </span>
              </label>
            </div>
          )}

          {/* Section 1: Add People and Groups */}
          <form className={styles['lumen-share-section']} onSubmit={handle_invite_user}>
            <div className={styles['lumen-share-section-label']}>
              Share with people
            </div>
            <div className={styles['lumen-share-invite-row']}>
              <div className={styles['lumen-share-invite-input-wrap']}>
                <UserPlus size={14} className={styles['lumen-share-invite-icon']} />
                <input
                  type="text"
                  value={invite_input}
                  onChange={(e) => set_invite_input(e.target.value)}
                  placeholder="Add user_account or email (e.g. user008, alex@company.com)"
                  className={styles['lumen-share-invite-input']}
                />
              </div>

              <select
                value={invite_role}
                onChange={(e) => set_invite_role(e.target.value)}
                className={styles['lumen-share-role-select']}
                aria-label="Permission role for invited person"
              >
                <option value="viewer">Viewer</option>
                <option value="commenter">Commenter</option>
                <option value="editor">Editor</option>
              </select>

              <button
                type="submit"
                className={styles['lumen-share-invite-btn']}
                disabled={!invite_input.trim()}
              >
                <span>Share</span>
              </button>
            </div>
          </form>

          {/* Section 2: People with access */}
          <div className={styles['lumen-share-section']}>
            <div className={styles['lumen-share-section-label']}>
              People with access ({1 + shared_users.length})
            </div>
            <div className={styles['lumen-share-people-list']}>
              {/* Board Owner Row */}
              <div className={styles['lumen-share-person-row']}>
                <div className={styles['lumen-share-person-left']}>
                  <div
                    className={styles['lumen-share-avatar']}
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    {get_avatar_initials(owner_account)}
                  </div>
                  <div className={styles['lumen-share-person-meta']}>
                    <span className={styles['lumen-share-person-name']}>
                      @{owner_account}{' '}
                      {auth?.user_account === owner_account ? '(you)' : ''}
                    </span>
                    <span className={styles['lumen-share-person-sub']}>
                      {owner_email}
                    </span>
                  </div>
                </div>
                <span className={styles['lumen-share-owner-badge']}>Owner</span>
              </div>

              {/* Explicitly Shared Users */}
              {shared_users.map((person) => {
                const u_key = person.user_account || person.email || person.id;
                return (
                  <div key={u_key} className={styles['lumen-share-person-row']}>
                    <div className={styles['lumen-share-person-left']}>
                      <div
                        className={styles['lumen-share-avatar']}
                        style={{ backgroundColor: person.color || '#7c3aed' }}
                      >
                        {get_avatar_initials(person.name || person.user_account)}
                      </div>
                      <div className={styles['lumen-share-person-meta']}>
                        <span className={styles['lumen-share-person-name']}>
                          @{person.user_account || person.name}
                        </span>
                        <span className={styles['lumen-share-person-sub']}>
                          {person.email}
                        </span>
                      </div>
                    </div>

                    <div className={styles['lumen-share-person-controls']}>
                      <select
                        value={person.role || 'viewer'}
                        onChange={(e) =>
                          handle_user_role_change(u_key, e.target.value)
                        }
                        className={styles['lumen-share-role-select']}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="commenter">Commenter</option>
                        <option value="editor">Editor</option>
                        <option value="__remove__">Remove access</option>
                      </select>

                      <button
                        type="button"
                        className={styles['lumen-share-remove-btn']}
                        onClick={() => handle_remove_user(u_key)}
                        title={`Remove @${person.user_account}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: General Access (Private vs Public -> Sharing like Google Drive) */}
          <div className={styles['lumen-share-section']}>
            <div className={styles['lumen-share-section-label']}>
              General access
            </div>

            <div className={styles['lumen-general-access-card']}>
              {/* Quick Mode Switcher: Private vs Public */}
              <div className={styles['lumen-general-access-mode-tabs']}>
                <button
                  type="button"
                  className={`${styles['lumen-access-mode-card']} ${
                    !is_public ? styles['lumen-access-mode-card-active-private'] : ''
                  }`}
                  onClick={() => handle_visibility_change('private')}
                >
                  <div
                    className={`${styles['lumen-access-icon-circle']} ${styles['lumen-access-icon-private']}`}
                  >
                    <Lock size={15} />
                  </div>
                  <div className={styles['lumen-access-mode-text']}>
                    <span className={styles['lumen-access-mode-title']}>
                      Private
                    </span>
                    <span className={styles['lumen-access-mode-subtitle']}>
                      Restricted access
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${styles['lumen-access-mode-card']} ${
                    is_public ? styles['lumen-access-mode-card-active-public'] : ''
                  }`}
                  onClick={() => handle_visibility_change('public')}
                >
                  <div
                    className={`${styles['lumen-access-icon-circle']} ${styles['lumen-access-icon-public']}`}
                  >
                    <Globe size={15} />
                  </div>
                  <div className={styles['lumen-access-mode-text']}>
                    <span className={styles['lumen-access-mode-title']}>
                      Public
                    </span>
                    <span className={styles['lumen-access-mode-subtitle']}>
                      Anyone with the link
                    </span>
                  </div>
                </button>
              </div>

              {/* Google Drive General Access Row */}
              <div className={styles['lumen-general-access-row']}>
                <div className={styles['lumen-general-access-left']}>
                  <div
                    className={`${styles['lumen-access-icon-circle']} ${
                      is_public
                        ? styles['lumen-access-icon-public']
                        : styles['lumen-access-icon-private']
                    }`}
                  >
                    {is_public ? <Globe size={16} /> : <Lock size={16} />}
                  </div>

                  <div className={styles['lumen-general-access-details']}>
                    <select
                      value={is_public ? 'public' : 'private'}
                      onChange={(e) => handle_visibility_change(e.target.value)}
                      className={styles['lumen-general-access-select']}
                      aria-label="General access visibility"
                    >
                      <option value="private">Private — Restricted</option>
                      <option value="public">Public — Anyone with the link</option>
                    </select>
                    <span className={styles['lumen-general-access-desc']}>
                      {get_public_access_description()}
                    </span>
                  </div>
                </div>

                {/* Public -> Sharing Role Selector (Viewer / Commenter / Editor) */}
                {is_public && (
                  <div className={styles['lumen-public-role-box']}>
                    {public_role === 'editor' ? (
                      <Edit3 size={13} color="#15803d" />
                    ) : public_role === 'commenter' ? (
                      <MessageSquare size={13} color="#15803d" />
                    ) : (
                      <Eye size={13} color="#15803d" />
                    )}
                    <select
                      value={public_role}
                      onChange={handle_public_role_change}
                      className={styles['lumen-share-role-select']}
                      aria-label="Public link access role"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="commenter">Commenter</option>
                      <option value="editor">Editor</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Share Link Input Preview */}
          <div className={styles['lumen-share-link-row'] || styles.lumenShareLinkRow}>
            <input
              id="lumen-share-link-input"
              type="text"
              readOnly
              value={share_url}
              onClick={(e) => e.target.select()}
              className={styles['lumen-share-input'] || styles.lumenShareInput}
            />
          </div>
        </div>

        {/* Google Drive-style Modal Footer */}
        <div className={styles['lumen-modal-footer']}>
          <button
            type="button"
            className={styles['lumen-share-copy-link-btn']}
            onClick={handle_copy_link}
          >
            {copied ? <Check size={14} /> : <Link2 size={14} />}
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>

          <button
            type="button"
            className={styles['lumen-share-done-btn']}
            onClick={handle_close}
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LUMEN_share_modal;
export { LUMEN_share_modal as ShareModal };
