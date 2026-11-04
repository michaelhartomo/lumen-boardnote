import React, { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  History,
  X,
  Search,
  ArrowUpRight,
  Download,
  Trash2,
  FileText,
  CheckSquare,
  Image as ImageIcon,
  MessageSquare,
  Tag,
  Link2,
  Radio,
  Pencil,
  MapPin,
  SmilePlus,
  Filter,
  Boxes,
} from 'lucide-react';

import styles from './LUMEN_activity_log_drawer.module.css';
import LUMEN_user_avatar from '../Common/LUMEN_user_avatar.jsx';
import {
  activityLogsSignal,
  isActivityDrawerOpenSignal,
  closeActivityDrawer,
  clearActivityLogs,
  COLLABORATOR_PROFILES,
  isWsConnectedSignal,
  fetchActivityLogs,
} from '../../signals/realtimeState.js';
import {
  activeBoardSignal,
  updateViewport,
  selectedCardsSignal,
  showToast,
} from '../../signals/boardState.js';

// Helper to format timestamp into friendly relative time
function format_relative_time(timestamp) {
  if (!timestamp) return 'recently';
  const now = Date.now();
  const diff_ms = now - timestamp;
  const diff_sec = Math.floor(diff_ms / 1000);
  const diff_min = Math.floor(diff_sec / 60);
  const diff_hr = Math.floor(diff_min / 60);
  const diff_day = Math.floor(diff_hr / 24);

  if (diff_sec < 45) return 'just now';
  if (diff_min < 60) return `${diff_min}m ago`;
  if (diff_hr < 24) return `${diff_hr}h ago`;
  if (diff_day === 1) return 'yesterday';
  if (diff_day < 7) return `${diff_day}d ago`;
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Helper to categorize log timestamp into date groups
function get_date_group_label(timestamp) {
  if (!timestamp) return 'Earlier';
  const now = new Date();
  const item_date = new Date(timestamp);

  const is_today =
    now.getDate() === item_date.getDate() &&
    now.getMonth() === item_date.getMonth() &&
    now.getFullYear() === item_date.getFullYear();

  if (is_today) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const is_yesterday =
    yesterday.getDate() === item_date.getDate() &&
    yesterday.getMonth() === item_date.getMonth() &&
    yesterday.getFullYear() === item_date.getFullYear();

  if (is_yesterday) return 'Yesterday';

  const diff_days = Math.floor((now.getTime() - item_date.getTime()) / (1000 * 3600 * 24));
  if (diff_days < 7) return 'This Week';

  return item_date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Render icon based on target card type
function render_target_icon(target_type) {
  switch (target_type) {
    case 'note':
      return <FileText size={11} />;
    case 'tasklist':
      return <CheckSquare size={11} />;
    case 'image':
      return <ImageIcon size={11} />;
    case 'comment':
      return <MessageSquare size={11} />;
    case 'tag':
      return <Tag size={11} />;
    case 'link':
      return <Link2 size={11} />;
    case 'group':
      return <Boxes size={11} />;
    default:
      return <FileText size={11} />;
  }
}

// Helper for action badge CSS class
function get_action_badge_class(action_type) {
  if (!action_type) return styles['lumen-activity-badge-update'];
  if (action_type.includes('create') || action_type.includes('add_card')) {
    return styles['lumen-activity-badge-create'];
  }
  if (action_type.includes('delete') || action_type.includes('remove')) {
    return styles['lumen-activity-badge-delete'];
  }
  if (action_type.includes('move')) {
    return styles['lumen-activity-badge-move'];
  }
  if (action_type.includes('comment')) {
    return styles['lumen-activity-badge-comment'];
  }
  if (action_type.includes('react')) {
    return styles['lumen-activity-badge-reaction'];
  }
  if (action_type.includes('tag') || action_type.includes('label')) {
    return styles['lumen-activity-badge-tag'];
  }
  if (action_type.includes('connect')) {
    return styles['lumen-activity-badge-connect'];
  }
  return styles['lumen-activity-badge-update'];
}

// Robust lookup to find existing card on active board
function find_associated_card(act, cards) {
  if (!act || !Array.isArray(cards)) return null;
  const target_id = act.target_id || act.card_id || act.card_code;
  if (target_id) {
    const by_id = cards.find((c) => c && (c.id === target_id || c.card_code === target_id));
    if (by_id) return by_id;
  }
  const target_name = act.target_name || act.card_title;
  if (target_name) {
    const by_title = cards.find(
      (c) => c && c.title && c.title.toLowerCase() === target_name.toLowerCase()
    );
    if (by_title) return by_title;
  }
  return null;
}

export default function LUMEN_activity_log_drawer() {
  useSignals();

  const is_open = isActivityDrawerOpenSignal.value;
  const raw_activities = activityLogsSignal.value || [];
  const active_board = activeBoardSignal.value;
  const is_ws_connected = isWsConnectedSignal.value;

  const [search_query, set_search_query] = useState('');
  const [selected_user_id, set_selected_user_id] = useState('all');
  const [selected_category, set_selected_category] = useState('all');

  // Fetch persisted activity logs from backend when drawer is open
  useEffect(() => {
    if (is_open && active_board?.id) {
      fetchActivityLogs(active_board.id);
    }
  }, [is_open, active_board?.id]);

  // Close on Escape key press
  useEffect(() => {
    const handle_keydown = (e) => {
      if (e.key === 'Escape' && is_open) {
        closeActivityDrawer();
      }
    };
    window.addEventListener('keydown', handle_keydown);
    return () => window.removeEventListener('keydown', handle_keydown);
  }, [is_open]);

  if (!is_open) return null;

  // Filter activities
  const clean_query = search_query.trim().toLowerCase();
  const filtered_activities = raw_activities.filter((item) => {
    if (!item) return false;

    // Filter by User
    const item_user_id = item.user_id || item.user_account;
    if (selected_user_id !== 'all' && item_user_id !== selected_user_id) {
      return false;
    }

    // Filter by Category
    if (selected_category !== 'all') {
      const type = item.action_type || '';
      if (selected_category === 'cards' && !type.includes('card')) return false;
      if (selected_category === 'comments' && !type.includes('comment')) return false;
      if (selected_category === 'reactions' && !type.includes('react')) return false;
      if (selected_category === 'labels' && !type.includes('tag')) return false;
      if (selected_category === 'connections' && !type.includes('connect')) return false;
    }

    // Search query matching
    if (clean_query) {
      const desc = (item.description || item.card_detail?.description || '').toLowerCase();
      const target = (item.target_name || item.card_title || '').toLowerCase();
      const user = (item.user_name || '').toLowerCase();
      const label = (item.action_label || item.card_detail?.action_label || '').toLowerCase();
      return (
        desc.includes(clean_query) ||
        target.includes(clean_query) ||
        user.includes(clean_query) ||
        label.includes(clean_query)
      );
    }

    return true;
  });

  // Group filtered activities by date
  const grouped_activities = {};
  filtered_activities.forEach((item) => {
    const ts = item.timestamp || (item.time_create ? new Date(item.time_create).getTime() : 0);
    const group_key = get_date_group_label(ts);
    if (!grouped_activities[group_key]) {
      grouped_activities[group_key] = [];
    }
    grouped_activities[group_key].push(item);
  });

  // Calculate quick stats
  const total_count = raw_activities.length;
  const today_start = new Date().setHours(0, 0, 0, 0);
  const today_count = raw_activities.filter((a) => {
    const ts = a.timestamp || (a.time_create ? new Date(a.time_create).getTime() : 0);
    return ts && ts >= today_start;
  }).length;

  const active_contributor_ids = new Set(
    raw_activities.map((a) => a.user_id).filter(Boolean)
  );

  // Move / Jump to card handler - smoothly centers canvas on card taking into account the 400px panel
  const handle_jump_to_card = (target_card_id, target_name) => {
    if (!target_card_id) return;
    const cards = active_board?.cards || [];
    const target_card = cards.find((c) => c.id === target_card_id);

    if (!target_card) {
      showToast(`Card "${target_name || target_card_id}" is no longer on the board`);
      return;
    }

    const window_width = window.innerWidth;
    const window_height = window.innerHeight;
    const card_width = target_card.width || 340;
    const card_height = target_card.height || 220;
    const zoom = Math.max(0.75, Math.min(1.2, active_board?.viewport?.zoom || 1));

    // Target pan so card is centered in visible canvas view (accounting for open 400px drawer on right)
    const available_width = window_width > 600 ? window_width - 400 : window_width;
    const center_pan_x = Math.round(available_width / 2 - (target_card.x + card_width / 2) * zoom);
    const center_pan_y = Math.round(window_height / 2 - (target_card.y + card_height / 2) * zoom);

    updateViewport(center_pan_x, center_pan_y, zoom);
    selectedCardsSignal.value = [target_card.id];
    showToast(`Moved to "${target_card.title || 'Card'}"`);
  };

  // Export logs to JSON file
  const handle_export_logs = () => {
    const data_str = JSON.stringify(raw_activities, null, 2);
    const blob = new Blob([data_str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumen_activity_log_${active_board?.id || 'board'}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Activity log exported as JSON');
  };

  const current_board_cards = active_board?.cards || [];

  return (
    <aside
      className={styles['lumen-activity-drawer']}
      aria-label="Lumen Activity & Audit Log"
    >
      {/* Multi-line Header matching AI Panel style without squishing buttons */}
      <div className={styles['lumen-activity-header']}>
        {/* Line 1: Brand / Title and Action Buttons */}
        <div className={styles['lumen-activity-header-top']}>
          <div className={styles['lumen-activity-header-brand']}>
            <div className={styles['lumen-activity-icon-badge']}>
              <History size={16} />
            </div>
            <div className={styles['lumen-activity-title']}>Activity & Audit Log</div>
          </div>

          <div className={styles['lumen-activity-header-actions']}>
            {total_count > 0 && (
              <button
                type="button"
                className={styles['lumen-activity-btn-clear']}
                onClick={clearActivityLogs}
                title="Clear all activity logs"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              className={styles['lumen-activity-btn-icon']}
              onClick={closeActivityDrawer}
              title="Close Activity Log"
              aria-label="Close Activity Log"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Line 2: Contextual Metadata & Live Status */}
        <div className={styles['lumen-activity-header-bottom']}>
          <span className={styles['lumen-activity-board-tag']}>{active_board?.title || 'Workspace'}</span>
          <span className={styles['lumen-activity-dot-sep']}>•</span>
          <span className={styles['lumen-activity-count-tag']}>{total_count} events</span>
          <span className={styles['lumen-activity-dot-sep']}>•</span>
          <span className={styles['lumen-activity-live-indicator']}>
            <Radio size={10} />
            <span>{is_ws_connected ? 'Live Sync' : 'Offline'}</span>
          </span>
        </div>
      </div>

      {/* Metrics bar */}
      <div className={styles['lumen-activity-stats-bar']}>
        <div className={styles['lumen-activity-stat-item']}>
          <span>Today:</span>
          <strong>{today_count}</strong>
        </div>
        <div className={styles['lumen-activity-stat-item']}>
          <span>Contributors:</span>
          <strong>{active_contributor_ids.size || 1}</strong>
        </div>
        <button
          type="button"
          className={styles['lumen-activity-export-btn']}
          onClick={handle_export_logs}
          title="Export activity logs as JSON"
        >
          <Download size={12} />
          <span>Export</span>
        </button>
      </div>

      {/* Filters Box */}
      <div className={styles['lumen-activity-filter-box']}>
        {/* Search input */}
        <div className={styles['lumen-activity-search-wrap']}>
          <Search size={14} className={styles['lumen-activity-search-icon']} />
          <input
            type="text"
            className={styles['lumen-activity-search-input']}
            placeholder="Search activities, cards, or team members..."
            value={search_query}
            onChange={(e) => set_search_query(e.target.value)}
          />
          {search_query && (
            <button
              type="button"
              className={styles['lumen-activity-search-clear']}
              onClick={() => set_search_query('')}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* User selector pills */}
        <div className={styles['lumen-activity-user-pills']}>
          <button
            type="button"
            className={`${styles['lumen-activity-user-pill']} ${
              selected_user_id === 'all' ? styles['lumen-activity-user-pill-active'] : ''
            }`}
            onClick={() => set_selected_user_id('all')}
          >
            <span>All Team</span>
          </button>

          {COLLABORATOR_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`${styles['lumen-activity-user-pill']} ${
                selected_user_id === profile.id ? styles['lumen-activity-user-pill-active'] : ''
              }`}
              onClick={() => set_selected_user_id(profile.id)}
              title={`Filter activities by ${profile.name}`}
            >
              <span
                className={styles['lumen-activity-user-mini-avatar']}
                style={{ backgroundColor: profile.color }}
              >
                {profile.avatar}
              </span>
              <span>{profile.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Action category pills */}
        <div className={styles['lumen-activity-category-row']}>
          {[
            { id: 'all', label: 'All' },
            { id: 'cards', label: 'Cards' },
            { id: 'comments', label: 'Comments' },
            { id: 'reactions', label: 'Reactions' },
            { id: 'labels', label: 'Labels' },
            { id: 'connections', label: 'Connections' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles['lumen-activity-category-pill']} ${
                selected_category === cat.id ? styles['lumen-activity-category-pill-active'] : ''
              }`}
              onClick={() => set_selected_category(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className={styles['lumen-activity-feed']}>
        {filtered_activities.length === 0 ? (
          <div className={styles['lumen-activity-empty']}>
            <div className={styles['lumen-activity-empty-icon']}>
              <Filter size={20} />
            </div>
            <div className={styles['lumen-activity-empty-title']}>No activities found</div>
            <p className={styles['lumen-activity-empty-subtext']}>
              {search_query || selected_user_id !== 'all' || selected_category !== 'all'
                ? 'No activity entries match your current search or collaborator filter.'
                : 'Board activity, edits, and comments will be logged here in real time.'}
            </p>
            {(search_query || selected_user_id !== 'all' || selected_category !== 'all') && (
              <button
                type="button"
                className={styles['lumen-activity-clear-filters-btn']}
                onClick={() => {
                  set_search_query('');
                  set_selected_user_id('all');
                  set_selected_category('all');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          Object.entries(grouped_activities).map(([date_label, items]) => (
            <div key={date_label} className={styles['lumen-activity-date-group']}>
              <div className={styles['lumen-activity-date-label']}>{date_label}</div>

              {items.map((act) => {
                const badge_class = get_action_badge_class(act.action_type);
                const associated_card = find_associated_card(act, current_board_cards);
                const is_deleted = act.action_type === 'card_deleted';

                return (
                  <div key={act.id} className={styles['lumen-activity-item']}>
                    {/* Avatar column */}
                    <div className={styles['lumen-activity-avatar-col']}>
                      <LUMEN_user_avatar
                        user_avatar={act.user_avatar}
                        user_account={act.user_id}
                        user_full_name={act.user_name}
                        size={28}
                        bg_color={act.user_color || '#2563eb'}
                        title={act.user_name || 'Collaborator'}
                      />
                    </div>

                    {/* Content column */}
                    <div className={styles['lumen-activity-content-col']}>
                      <div className={styles['lumen-activity-top-line']}>
                        <div className={styles['lumen-activity-author-wrap']}>
                          <span className={styles['lumen-activity-author-name']}>
                            {act.user_name || 'Collaborator'}
                          </span>
                          {act.user_role && (
                            <span className={styles['lumen-activity-author-role']}>
                              · {act.user_role}
                            </span>
                          )}
                        </div>
                        <span className={styles['lumen-activity-time']}>
                          {format_relative_time(act.timestamp)}
                        </span>
                      </div>

                      {/* Action badge */}
                      <div className={`${styles['lumen-activity-action-badge']} ${badge_class}`}>
                        {act.action_label || 'Updated'}
                      </div>

                      {/* Description */}
                      <div className={styles['lumen-activity-desc']}>
                        {act.description || 'Performed an action'}
                      </div>

                      {/* Card Reference & Move to Card button */}
                      {associated_card ? (
                        <div className={styles['lumen-activity-card-action-bar']}>
                          <button
                            type="button"
                            className={styles['lumen-activity-target-chip']}
                            onClick={() => handle_jump_to_card(associated_card.id, associated_card.title)}
                            title={`Move canvas to "${associated_card.title || 'Card'}"`}
                          >
                            {render_target_icon(associated_card.type || act.target_type)}
                            <span className={styles['lumen-activity-target-chip-title']}>
                              {associated_card.title || act.target_name || 'Card'}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={styles['lumen-activity-move-card-btn']}
                            onClick={() => handle_jump_to_card(associated_card.id, associated_card.title)}
                            title={`Move canvas to "${associated_card.title || 'Card'}"`}
                          >
                            <MapPin size={11} />
                            <span>Move to card</span>
                            <ArrowUpRight size={11} opacity={0.7} />
                          </button>
                        </div>
                      ) : act.target_name ? (
                        <div className={styles['lumen-activity-card-action-bar']}>
                          <div className={styles['lumen-activity-target-chip-deleted']}>
                            {render_target_icon(act.target_type)}
                            <span>{act.target_name} {is_deleted ? '(deleted)' : ''}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className={styles['lumen-activity-footer']}>
        <span className={styles['lumen-activity-footer-text']}>
          Real-time activity synced with server
        </span>

        <button
          type="button"
          className={styles['lumen-activity-clear-all-btn']}
          onClick={clearActivityLogs}
          title="Clear all activity logs on this board"
        >
          Clear History
        </button>
      </div>
    </aside>
  );
}
