import { signal, batch } from '@preact/signals-react';
import { persist } from 'signals-persist';
import {
  activeBoardSignal,
  boardsDirectorySignal,
  selectedCardsSignal,
  snapToGridSignal,
  gridDimensionSignal,
  unlockedCardsSignal,
  fetchBoardsFromServer,
  updateCard,
  showToast,
  saveCurrentBoardToStore,
  safe_parse_response_json,
  should_preserve_local_card_geometry,
  apply_preserved_local_geometry,
  active_interacting_card_ids_set,
  last_local_card_geom_edit_map,
  last_local_card_content_edit_map,
  has_pending_local_board_save,
  server_hydrated_board_ids,
  lastServerSyncTimeSignal,
  deleted_board_ids_set,
  deleted_card_ids_set,
} from './boardState.js';
import { delete_board_from_idb } from '../lib/lumenIndexedDb.js';
import { isAiPanelOpenSignal } from './aiState.js';
import { v4 as uuidv4 } from 'uuid';

// Unique per-window / per-tab client session ID so multiple windows of the same user sync cursors & edits
export const CLIENT_SESSION_ID =
  typeof window !== 'undefined'
    ? `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
    : 'client_server';

const SESSION_CURSOR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#db2777',
  '#0891b2',
  '#e11d48',
  '#4f46e5',
];

export function resolve_peer_user_display(user, client_id) {
  if (!user) return null;
  const peer_id = client_id || user.client_id || user.id;
  const is_same_account_other_window =
    user.id === currentUserSignal.value?.id && peer_id && peer_id !== CLIENT_SESSION_ID;

  if (!is_same_account_other_window) {
    return {
      ...user,
      client_id: peer_id,
    };
  }

  let hash = 0;
  const str = String(peer_id);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const color = SESSION_CURSOR_COLORS[(hash % (SESSION_CURSOR_COLORS.length - 1)) + 1] || '#7c3aed';
  const short_tag = String(peer_id).slice(-3).toUpperCase();

  return {
    ...user,
    client_id: peer_id,
    color,
    name: `${user.name || 'User'} (${short_tag})`,
  };
}

// Predefined collaborative workspace team personas
export const COLLABORATOR_PROFILES = [
  { id: 'user_alex', name: 'Alex Rivers', avatar: 'AR', color: '#2563eb', role: 'Lead Architect' },
  { id: 'user_elena', name: 'Elena Rostova', avatar: 'ER', color: '#7c3aed', role: 'Design Director' },
  { id: 'user_marcus', name: 'Marcus Chen', avatar: 'MC', color: '#059669', role: 'Senior Product Designer' },
  { id: 'user_sophia', name: 'Sophia Vance', avatar: 'SV', color: '#d97706', role: 'Creative Strategist' },
  { id: 'user_michael', name: 'Michael Hartomo', avatar: 'MH', color: '#db2777', role: 'Studio Member' },
];

// Active user identity signal
export const currentUserSignal = persist(
  signal(COLLABORATOR_PROFILES[0]),
  'lumen_collaborator_active_user_v2'
);

// Active LUMEN User Auth System signal
export const lumenAuthSignal = signal(null);

export function get_lumen_auth_payload(override_auth) {
  const auth = override_auth || lumenAuthSignal.value || currentUserSignal.value?.auth;
  if (!auth || typeof auth !== 'object') {
    return {
      vendor_code: null,
      master_code: null,
      project_code: null,
      user_account: currentUserSignal.value?.user_account || currentUserSignal.value?.id || null,
      client_id: CLIENT_SESSION_ID,
    };
  }
  return {
    ...auth,
    vendor_code: auth.vendor_code !== undefined ? auth.vendor_code : null,
    master_code: auth.master_code !== undefined ? auth.master_code : null,
    project_code: auth.project_code !== undefined ? auth.project_code : null,
    user_account: auth.user_account !== undefined ? auth.user_account : null,
    client_id: CLIENT_SESSION_ID,
  };
}

export function get_lumen_auth_headers(override_auth) {
  const auth = get_lumen_auth_payload(override_auth);
  const headers = {
    'X-Lumen-Client-Id': CLIENT_SESSION_ID,
  };
  if (!auth) return headers;
  if (auth.vendor_code !== null && auth.vendor_code !== undefined) {
    headers['X-Lumen-Vendor-Code'] = String(auth.vendor_code);
  }
  if (auth.master_code !== null && auth.master_code !== undefined) {
    headers['X-Lumen-Master-Code'] = String(auth.master_code);
  }
  if (auth.project_code !== null && auth.project_code !== undefined) {
    headers['X-Lumen-Project-Code'] = String(auth.project_code);
  }
  if (auth.user_account !== null && auth.user_account !== undefined) {
    headers['X-Lumen-User-Account'] = String(auth.user_account);
  }
  try {
    headers['X-Lumen-Auth'] = JSON.stringify({
      vendor_code: auth.vendor_code,
      master_code: auth.master_code,
      project_code: auth.project_code,
      session_code: auth.session_code || null,
      user_account: auth.user_account || null,
      client_id: CLIENT_SESSION_ID,
    });
  } catch (e) {}
  return headers;
}


/**
 * Synchronizes LUMEN user auth state into active user signals
 * Checks whether user_account, user_avatar, user_full_name, user_status exist before using,
 * supporting both authenticated users and guest visitors.
 */
export function setLumenAuth(auth) {
  if (!auth) return currentUserSignal.value;
  const prev_account = lumenAuthSignal.value?.user_account;
  lumenAuthSignal.value = auth;

  if (auth && typeof auth === 'object') {
    const has_account = Boolean(auth.user_account && String(auth.user_account).trim());
    const has_name = Boolean(auth.user_full_name && String(auth.user_full_name).trim());
    const has_avatar = Boolean(auth.user_avatar && String(auth.user_avatar).trim());
    const has_status = Boolean(auth.user_status && String(auth.user_status).trim());

    if (has_account || has_name || has_avatar || has_status) {
      const display_name = has_name
        ? String(auth.user_full_name).trim()
        : (has_account ? String(auth.user_account).trim() : 'Lumen User');

      let initials = 'LU';
      if (has_name) {
        initials = display_name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join('') || 'LU';
      } else if (has_account) {
        initials = display_name.slice(0, 2).toUpperCase();
      }

      const role_label = has_status
        ? (auth.user_status.charAt(0).toUpperCase() + auth.user_status.slice(1))
        : 'Active User';

      const user_obj = {
        id: has_account ? auth.user_account : (auth.session_code || 'user_authenticated'),
        name: display_name,
        avatar: has_avatar ? auth.user_avatar : initials,
        user_avatar: has_avatar ? auth.user_avatar : null,
        user_account: has_account ? auth.user_account : null,
        user_full_name: has_name ? auth.user_full_name : null,
        user_status: has_status ? auth.user_status : 'active',
        vendor_code: auth.vendor_code || null,
        master_code: auth.master_code || null,
        project_code: auth.project_code || null,
        role: role_label,
        color: '#2563eb',
        is_guest: false,
        auth: auth,
        lumen_auth: auth,
      };

      currentUserSignal.value = user_obj;
      if (prev_account !== auth.user_account && typeof fetchBoardsFromServer === 'function') {
        fetchBoardsFromServer(auth);
      }
      return user_obj;
    }
  }

  // Guest User visiting (no auth or unauthenticated guest)
  const guest_obj = {
    id: 'user_guest',
    name: 'Guest User',
    avatar: 'GU',
    user_avatar: null,
    user_account: null,
    user_full_name: null,
    user_status: 'guest',
    role: 'Guest Collaborator',
    color: '#64748b',
    is_guest: true,
    auth: auth || null,
    lumen_auth: auth || null,
  };
  currentUserSignal.value = guest_obj;
  return guest_obj;
}

// Connected online users on this board
export const activeUsersSignal = signal(COLLABORATOR_PROFILES.slice(0, 3));


// Card Comments Store: { [cardId]: Array<Comment> }
export const cardCommentsSignal = signal({
  card_note_1: [
    {
      id: 'cm_seed_1',
      card_id: 'card_note_1',
      user_id: 'user_elena',
      user_name: 'Elena Rostova',
      user_avatar: 'ER',
      user_color: '#7c3aed',
      text: 'Love the tactile restraint philosophy. 24px spatial increments provide incredible baseline balance.',
      created_at: Date.now() - 3600000 * 2,
      parent_id: null,
      reply_to_user_name: null,
      reactions: [
        { emoji: '👍', count: 2, users: ['user_alex', 'user_marcus'] },
        { emoji: '❤️', count: 1, users: ['user_sophia'] },
      ],
    },
    {
      id: 'cm_seed_2',
      card_id: 'card_note_1',
      user_id: 'user_marcus',
      user_name: 'Marcus Chen',
      user_avatar: 'MC',
      user_color: '#059669',
      text: 'Should we document travertine and bronze texture sources in a separate swatch book?',
      created_at: Date.now() - 1800000,
      parent_id: 'cm_seed_1',
      reply_to_user_name: 'Elena Rostova',
      reactions: [
        { emoji: '💡', count: 2, users: ['user_alex', 'user_elena'] },
      ],
    },
    {
      id: 'cm_seed_2_reply',
      card_id: 'card_note_1',
      user_id: 'user_alex',
      user_name: 'Alex Rivers',
      user_avatar: 'AR',
      user_color: '#2563eb',
      text: 'Yes! I will curate the physical stone & bronze swatches and document them under Milestone Deliverables.',
      created_at: Date.now() - 900000,
      parent_id: 'cm_seed_1',
      reply_to_user_name: 'Marcus Chen',
    },
  ],
  card_tasks_1: [
    {
      id: 'cm_seed_3',
      card_id: 'card_tasks_1',
      user_id: 'user_alex',
      user_name: 'Alex Rivers',
      user_avatar: 'AR',
      user_color: '#2563eb',
      text: 'Cross-functional review scheduled for 2 PM EST today. Let’s make sure swatches are finalized.',
      created_at: Date.now() - 7200000,
      parent_id: null,
      reply_to_user_name: null,
    },
    {
      id: 'cm_seed_3_reply',
      card_id: 'card_tasks_1',
      user_id: 'user_sophia',
      user_name: 'Sophia Vance',
      user_avatar: 'SV',
      user_color: '#d97706',
      text: 'Calendar invite accepted. I have the moodboard slides queued up for presentation.',
      created_at: Date.now() - 3600000,
      parent_id: 'cm_seed_3',
      reply_to_user_name: 'Alex Rivers',
    },
  ],
  card_img_1: [
    {
      id: 'cm_seed_4',
      card_id: 'card_img_1',
      user_id: 'user_sophia',
      user_name: 'Sophia Vance',
      user_avatar: 'SV',
      user_color: '#d97706',
      text: 'The natural travertine pavilion casts such rich directional shadows in this shot.',
      created_at: Date.now() - 5400000,
      parent_id: null,
      reply_to_user_name: null,
    },
  ],
  card_geo_1: [
    {
      id: 'cm_seed_geo_1',
      card_id: 'card_geo_1',
      user_id: 'user_marcus',
      user_name: 'Marcus Chen',
      user_avatar: 'MC',
      user_color: '#059669',
      text: 'Site visit for natural stone inspection and acoustic field recording is confirmed. Waze and Google Maps route links work great for the team.',
      created_at: Date.now() - 3600000,
      parent_id: null,
      reply_to_user_name: null,
      reactions: [
        { emoji: '📍', count: 2, users: ['user_alex', 'user_elena'] },
        { emoji: '👍', count: 3, users: ['user_alex', 'user_marcus', 'user_sophia'] },
      ],
    },
    {
      id: 'cm_seed_geo_2',
      card_id: 'card_geo_1',
      user_id: 'user_elena',
      user_name: 'Elena Rostova',
      user_avatar: 'ER',
      user_color: '#7c3aed',
      text: 'Make sure to pin the parking entrance coordinates in OpenStreetMap too.',
      created_at: Date.now() - 1800000,
      parent_id: 'cm_seed_geo_1',
      reply_to_user_name: 'Marcus Chen',
      reactions: [
        { emoji: '💡', count: 1, users: ['user_marcus'] },
      ],
    },
  ],
});

// Live WebSocket connection status
export const isWsConnectedSignal = signal(false);

// Active card opened in comments drawer/modal
export const activeCommentsCardIdSignal = signal(null);

// Activity Logs Signal for multi-user audit trail
export const activityLogsSignal = signal([]);

// Activity Drawer Open State
export const isActivityDrawerOpenSignal = signal(false);

export const fetchActivityLogs = async (boardId) => {
  const targetId = boardId || activeBoardSignal.value?.id || 'board_moodboard';
  try {
    const res = await fetch(`/api/boards/${targetId}/activity`, {
      headers: { ...get_lumen_auth_headers() },
    });
    if (res.ok) {
      const data = await safe_parse_response_json(res, null);
      if (data && Array.isArray(data.activities)) {
        activityLogsSignal.value = data.activities;
      }
    }
  } catch (e) {
    console.warn('[Activity Log] fetch error:', e);
  }
};

export const toggleActivityDrawer = () => {
  const next = !isActivityDrawerOpenSignal.value;
  isActivityDrawerOpenSignal.value = next;
  if (next) {
    isAiPanelOpenSignal.value = false;
    fetchActivityLogs(activeBoardSignal.value?.id);
  }
};

export const openActivityDrawer = () => {
  isActivityDrawerOpenSignal.value = true;
  isAiPanelOpenSignal.value = false;
  fetchActivityLogs(activeBoardSignal.value?.id);
};

export const closeActivityDrawer = () => {
  isActivityDrawerOpenSignal.value = false;
};

// Remote collaborator cursors: { [userId]: { user, x, y, lastActive } }
export const remoteCursorsSignal = signal({});

// Remote collaborator card selection outlines: { [cardId]: Array<user> }
export const remoteCardSelectionsSignal = signal({});

// Flag to guard against infinite loop when receiving remote websocket events
export const isRemoteUpdateFlag = { current: false };

let active_socket = null;
let current_board_id = null;
let reconnect_timer = null;
let local_broadcast_channel = null;
let remote_poll_interval_id = null;
let is_remote_poll_in_flight = false;

function build_card_fingerprint(c) {
  if (!c) return '';
  return [
    c.id,
    c.updatedAt || '',
    c.time_modify || '',
    c.title || '',
    c.color || '',
    c.x,
    c.y,
    c.width,
    c.height,
    c.zIndex,
    c.isLocked ? 1 : 0,
    c.group_id || '',
    c.collapsed ? 1 : 0,
    typeof c.content === 'string' ? c.content.length + ':' + c.content.slice(0, 64) + ':' + c.content.slice(-64) : '',
    typeof c.content_html === 'string' ? c.content_html.length : '',
    Array.isArray(c.items) ? JSON.stringify(c.items) : '',
    Array.isArray(c.tags) ? JSON.stringify(c.tags) : '',
    Array.isArray(c.reactions) ? JSON.stringify(c.reactions) : '',
    Array.isArray(c.images) ? c.images.length : '',
    c.imageUrl || '',
    c.code_data ? JSON.stringify(c.code_data) : '',
    c.sheets_data ? JSON.stringify(c.sheets_data) : '',
  ].join('|');
}

export function applyRemoteBoardSync(incoming, options = {}) {
  if (!incoming || !activeBoardSignal.value) return false;
  const target_id = incoming.id || incoming.board_code;
  if (target_id && deleted_board_ids_set.has(target_id)) return false;

  const current_board = activeBoardSignal.value;
  if (target_id && current_board.id && target_id !== current_board.id) return false;

  const incoming_cards = (Array.isArray(incoming.cards)
    ? incoming.cards
    : Array.isArray(incoming.board_card)
    ? incoming.board_card
    : current_board.cards || []
  ).filter((sc) => sc && !deleted_card_ids_set.has(sc.id));

  const now_ms = Date.now();
  const local_cards = current_board.cards || [];
  const incoming_ids_set = new Set(incoming_cards.map((sc) => sc.id));

  const merged_cards = incoming_cards.map((server_card) => {
    const local_card = local_cards.find((c) => c.id === server_card.id);
    const session = unlockedCardsSignal?.value?.[server_card.id];
    if (local_card) {
      const recent_content_ts = last_local_card_content_edit_map.get(server_card.id) || 0;
      if (
        active_interacting_card_ids_set.has(server_card.id) ||
        (recent_content_ts > 0 && now_ms - recent_content_ts < 4500)
      ) {
        return local_card;
      }
    }
    let base_card = server_card;
    if (local_card && should_preserve_local_card_geometry(server_card.id, local_card, server_card)) {
      base_card = apply_preserved_local_geometry(server_card, local_card);
    }
    if (session || (local_card && local_card.is_encryption_unlocked)) {
      return {
        ...base_card,
        content: local_card?.content || session?.payload?.content || '',
        items: local_card?.items || session?.payload?.items || [],
        description: local_card?.description || session?.payload?.description || '',
        notes: local_card?.notes || session?.payload?.notes || '',
        url: local_card?.url || session?.payload?.url || '',
        data: {
          ...(base_card.data || {}),
          content: local_card?.content || session?.payload?.content || '',
        },
        is_encryption_unlocked: true,
      };
    }
    return base_card;
  });

  // Preserve any brand-new local card created in the last 6 seconds that hasn't finished round-tripping
  for (const lc of local_cards) {
    if (lc && lc.id && !incoming_ids_set.has(lc.id) && !deleted_card_ids_set.has(lc.id)) {
      const lc_ts = Number(lc.updatedAt || 0);
      const recent_edit = last_local_card_content_edit_map.get(lc.id) || 0;
      if ((lc_ts > 0 && now_ms - lc_ts < 6000) || (recent_edit > 0 && now_ms - recent_edit < 6000)) {
        merged_cards.push(lc);
      }
    }
  }

  const next_connections = Array.isArray(incoming.connections)
    ? incoming.connections
    : Array.isArray(incoming.board_connection)
    ? incoming.board_connection
    : Array.isArray(incoming.board_conenctions)
    ? incoming.board_conenctions
    : current_board.connections || [];

  const next_drawings = Array.isArray(incoming.drawings)
    ? incoming.drawings
    : Array.isArray(incoming.board_drawing)
    ? incoming.board_drawing
    : current_board.drawings || [];

  const next_setting =
    typeof incoming.board_setting === 'object' && incoming.board_setting !== null
      ? { ...(current_board.board_setting || {}), ...incoming.board_setting }
      : current_board.board_setting;

  const b_type =
    incoming.boardType ||
    incoming.board_type ||
    next_setting?.board_type ||
    current_board.boardType ||
    'snap_grid';
  const g_dim = Number(
    incoming.gridDimension ||
      incoming.grid_dimension ||
      next_setting?.grid_dimension ||
      current_board.gridDimension ||
      24
  );

  if (options.onlyIfChanged) {
    const same_cards =
      local_cards.length === merged_cards.length &&
      local_cards.every((lc, idx) => build_card_fingerprint(lc) === build_card_fingerprint(merged_cards[idx]));
    const same_conns =
      JSON.stringify(current_board.connections || []) === JSON.stringify(next_connections);
    const same_drawings =
      (current_board.drawings || []).length === next_drawings.length;
    const same_meta =
      (current_board.title || '') === (incoming.title || incoming.board_name || current_board.title || '') &&
      (current_board.description || '') === (incoming.description ?? incoming.board_description ?? current_board.description ?? '') &&
      current_board.boardType === b_type &&
      Number(current_board.gridDimension || 24) === g_dim;
    if (same_cards && same_conns && same_drawings && same_meta) {
      return false;
    }
  }

  const prev_flag = isRemoteUpdateFlag.current;
  isRemoteUpdateFlag.current = true;
  try {
    batch(() => {
      activeBoardSignal.value = {
        ...current_board,
        ...incoming,
        title: incoming.title || incoming.board_name || current_board.title,
        board_name: incoming.board_name || incoming.title || current_board.board_name,
        viewport: current_board.viewport || incoming.viewport,
        board_viewport: current_board.viewport || incoming.viewport,
        boardType: b_type,
        board_type: b_type,
        gridDimension: g_dim,
        grid_dimension: g_dim,
        board_setting: next_setting,
        cards: merged_cards,
        board_card: merged_cards,
        connections: next_connections,
        board_connection: next_connections,
        board_conenctions: next_connections,
        drawings: next_drawings,
        board_drawing: next_drawings,
      };
      if (snapToGridSignal) {
        snapToGridSignal.value = b_type !== 'free_position';
      }
      if (gridDimensionSignal && g_dim >= 1) {
        gridDimensionSignal.value = g_dim;
      }
    });
    saveCurrentBoardToStore({ localOnly: true });
    return true;
  } finally {
    isRemoteUpdateFlag.current = prev_flag;
  }
}

async function poll_remote_board_changes() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (is_remote_poll_in_flight || has_pending_local_board_save()) return;
  const active_board = activeBoardSignal.value;
  const board_id = active_board?.id || active_board?.board_code;
  if (!board_id || deleted_board_ids_set.has(board_id) || !server_hydrated_board_ids.has(board_id)) {
    return;
  }

  is_remote_poll_in_flight = true;
  try {
    const res = await fetch(`/api/boards/${encodeURIComponent(board_id)}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        ...get_lumen_auth_headers(),
      },
    });
    if (!res.ok) return;
    const data = await safe_parse_response_json(res, null);
    if (
      data?.board &&
      activeBoardSignal.value?.id === board_id &&
      !has_pending_local_board_save()
    ) {
      const changed = applyRemoteBoardSync(data.board, { onlyIfChanged: true });
      if (changed) {
        lastServerSyncTimeSignal.value = Date.now();
      }
    }
  } catch (_) {
    // Ignore transient network errors during background reconciliation
  } finally {
    is_remote_poll_in_flight = false;
  }
}

function ensure_remote_poll_loop() {
  if (typeof window === 'undefined') return;
  if (!remote_poll_interval_id) {
    remote_poll_interval_id = setInterval(poll_remote_board_changes, 3000);
    window.addEventListener('focus', poll_remote_board_changes);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        poll_remote_board_changes();
      }
    });
  }
}

function ensure_local_broadcast_channel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!local_broadcast_channel) {
    try {
      local_broadcast_channel = new BroadcastChannel('lumen_board_realtime_sync_v1');
      local_broadcast_channel.onmessage = (event) => {
        if (!event || !event.data || typeof event.data !== 'object') return;
        handle_incoming_ws_message(event.data);
      };
    } catch (e) {
      local_broadcast_channel = null;
    }
  }
  return local_broadcast_channel;
}

function send_local_broadcast(message) {
  const channel = ensure_local_broadcast_channel();
  if (!channel || !message) return;
  try {
    channel.postMessage({
      ...message,
      client_id: CLIENT_SESSION_ID,
    });
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  ensure_local_broadcast_channel();
  window.addEventListener('beforeunload', () => {
    send_local_broadcast({
      type: 'user_left',
      board_id: current_board_id || activeBoardSignal.value?.id,
      user_id: currentUserSignal.value?.id,
      client_id: CLIENT_SESSION_ID,
    });
  });
}

// Initialize or switch WebSocket room for real-time collaboration
export const connectRealtimeBoard = (boardId) => {
  if (typeof window === 'undefined') return;
  ensure_local_broadcast_channel();
  ensure_remote_poll_loop();
  const target_board = boardId || activeBoardSignal.value?.id || 'board_moodboard';
  const is_same_board = current_board_id === target_board;
  current_board_id = target_board;

  if (
    active_socket &&
    (active_socket.readyState === WebSocket.OPEN || active_socket.readyState === WebSocket.CONNECTING)
  ) {
    if (active_socket.readyState === WebSocket.OPEN) {
      active_socket.send(
        JSON.stringify({
          type: 'join',
          board_id: current_board_id,
          client_id: CLIENT_SESSION_ID,
          user: currentUserSignal.value,
          lumen_auth: get_lumen_auth_payload(),
        })
      );
    }
    if (!is_same_board) {
      remoteCursorsSignal.value = {};
      remoteCardSelectionsSignal.value = {};
    }
    return;
  }

  // Establish WebSocket connection to backend server & PostgreSQL
  if (active_socket) {
    try {
      active_socket.close();
    } catch (e) {}
    active_socket = null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws_url = `${protocol}//${window.location.host}/ws`;

  try {
    const ws = new WebSocket(ws_url);
    const raw_ws_send = ws.send.bind(ws);
    ws.send = (data) => {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object') {
            if (!parsed.client_id) {
              parsed.client_id = CLIENT_SESSION_ID;
            }
            if (!parsed.lumen_auth) {
              parsed.lumen_auth = get_lumen_auth_payload();
            }
            return raw_ws_send(JSON.stringify(parsed));
          }
        } catch (_) {}
      }
      return raw_ws_send(data);
    };
    active_socket = ws;

    ws.onopen = () => {
      isWsConnectedSignal.value = true;
      // Send join event with active user, client_id, and lumen_auth
      ws.send(JSON.stringify({
        type: 'join',
        board_id: current_board_id,
        client_id: CLIENT_SESSION_ID,
        user: currentUserSignal.value,
        lumen_auth: get_lumen_auth_payload(),
      }));
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data !== 'string' || !event.data.trim().startsWith('{')) return;
        const data = JSON.parse(event.data);
        handle_incoming_ws_message(data);
      } catch (err) {
        console.warn('Failed to parse WS message:', err);
      }
    };

    ws.onclose = () => {
      isWsConnectedSignal.value = false;
      if (active_socket === ws) {
        active_socket = null;
      }
      // Auto-reconnect after 2 seconds
      if (reconnect_timer) clearTimeout(reconnect_timer);
      reconnect_timer = setTimeout(() => {
        connectRealtimeBoard(current_board_id);
      }, 2000);
    };

    ws.onerror = (err) => {
      console.warn('Realtime WS error:', err);
      isWsConnectedSignal.value = false;
    };
  } catch (err) {
    console.warn('Failed to establish WebSocket connection, falling back to REST:', err);
  }
};

// Handle incoming messages from other collaborators or windows
function handle_incoming_ws_message(data) {
  if (!data || typeof data !== 'object') return;
  if (data.client_id && data.client_id === CLIENT_SESSION_ID) return;

  const active_board_id = activeBoardSignal.value?.id || current_board_id;
  if (
    data.board_id &&
    active_board_id &&
    data.board_id !== active_board_id &&
    data.type !== 'board:deleted' &&
    data.type !== 'board:sharing_updated'
  ) {
    return;
  }

  switch (data.type) {
    case 'init': {
      if (data.comments) {
        cardCommentsSignal.value = {
          ...cardCommentsSignal.value,
          ...data.comments,
        };
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        activeUsersSignal.value = data.users;
      }
      if (Array.isArray(data.activities)) {
        activityLogsSignal.value = data.activities;
      }
      if (data.board && activeBoardSignal.value && !has_pending_local_board_save()) {
        applyRemoteBoardSync(data.board, { onlyIfChanged: true });
      }
      break;
    }

    case 'activity:added': {
      if (data.activity) {
        const existing = activityLogsSignal.value.filter((a) => a.id !== data.activity.id);
        activityLogsSignal.value = [data.activity, ...existing];

        // Notify user if another collaborator performed the action
        if (data.activity.user_id !== currentUserSignal.value.id) {
          showToast(`${data.activity.user_name}: ${data.activity.description}`);
        }
      }
      break;
    }

    case 'activity:cleared': {
      activityLogsSignal.value = [];
      showToast('Activity log cleared');
      break;
    }

    case 'board:sharing_updated': {
      if (data.sharing) {
        const current_board = activeBoardSignal.value;
        if (current_board && (!data.board_id || current_board.id === data.board_id)) {
          activeBoardSignal.value = {
            ...current_board,
            sharing: data.sharing,
            board_setting: {
              ...(current_board.board_setting || {}),
              sharing: data.sharing,
            },
          };
        }
        const list = [...(boardsDirectorySignal.value || [])];
        const idx = list.findIndex((b) => (b.id || b.board_code) === (data.board_id || current_board?.id));
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            sharing: data.sharing,
            board_setting: {
              ...(list[idx].board_setting || {}),
              sharing: data.sharing,
            },
          };
          boardsDirectorySignal.value = list;
        }
      }
      break;
    }

    case 'board:card_added': {
      if (data.card && activeBoardSignal.value) {
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const exists = (current_board.cards || []).some((c) => c.id === data.card.id);
          if (!exists) {
            const next_cards = [...(current_board.cards || []), data.card];
            activeBoardSignal.value = {
              ...current_board,
              cards: next_cards,
              board_card: next_cards,
              updatedAt: Date.now(),
            };
            saveCurrentBoardToStore({ localOnly: true });
          }
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:card_updated': {
      // Ignore echoes that originated from this exact client session
      if (data.client_id && data.client_id === CLIENT_SESSION_ID) {
        break;
      }
      if (data.card_id && data.updates && activeBoardSignal.value) {
        if (deleted_card_ids_set.has(data.card_id)) {
          break;
        }
        const local_card = (activeBoardSignal.value.cards || []).find((c) => c.id === data.card_id);
        if (!local_card) {
          // Card doesn't exist locally yet (e.g. created via REST/MCP or missed add event) — insert it if updates has card data
          if (data.updates.type || data.updates.card_type || data.updates.title !== undefined) {
            isRemoteUpdateFlag.current = true;
            try {
              const current_board = activeBoardSignal.value;
              const new_card = {
                id: data.card_id,
                card_code: data.card_id,
                type: data.updates.type || data.updates.card_type || 'note',
                x: Number(data.updates.x ?? data.updates.pos_x ?? 120),
                y: Number(data.updates.y ?? data.updates.pos_y ?? 120),
                width: Number(data.updates.width ?? 360),
                height: Number(data.updates.height ?? 216),
                ...data.updates,
              };
              const next_cards = [...(current_board.cards || []), new_card];
              activeBoardSignal.value = {
                ...current_board,
                cards: next_cards,
                board_card: next_cards,
                updatedAt: Date.now(),
              };
              saveCurrentBoardToStore({ localOnly: true });
            } finally {
              isRemoteUpdateFlag.current = false;
            }
          }
          break;
        }
        let safe_updates = { ...data.updates };
        if (should_preserve_local_card_geometry(data.card_id, local_card, safe_updates)) {
          delete safe_updates.x;
          delete safe_updates.y;
          delete safe_updates.width;
          delete safe_updates.height;
          delete safe_updates.pos_x;
          delete safe_updates.pos_y;
          delete safe_updates.column_width;
        }
        if (Object.keys(safe_updates).length === 0) {
          break;
        }
        isRemoteUpdateFlag.current = true;
        try {
          updateCard(data.card_id, safe_updates, false);
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:card_moved': {
      if (data.client_id && data.client_id === CLIENT_SESSION_ID) {
        break;
      }
      if (data.card_id && activeBoardSignal.value) {
        if (active_interacting_card_ids_set.has(data.card_id)) {
          break;
        }
        const recent_local_ts = last_local_card_geom_edit_map.get(data.card_id);
        if (recent_local_ts && Date.now() - recent_local_ts < 5000) {
          break;
        }
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const updated_cards = (current_board.cards || []).map((c) => {
            if (c.id !== data.card_id) return c;
            const next_card = {
              ...c,
              ...(data.x !== undefined ? { x: data.x, pos_x: data.x } : {}),
              ...(data.y !== undefined ? { y: data.y, pos_y: data.y } : {}),
              ...(data.width !== undefined ? { width: data.width } : {}),
              ...(data.height !== undefined ? { height: data.height } : {}),
              updatedAt: Date.now(),
            };
            if (c.type === 'group' && data.width !== undefined) {
              next_card.column_width = Math.max(280, data.width - 40);
            }
            return next_card;
          });
          activeBoardSignal.value = {
            ...current_board,
            cards: updated_cards,
            board_card: updated_cards,
          };
          if (data.is_final) {
            saveCurrentBoardToStore({ localOnly: true });
          }
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:card_deleted': {
      if (data.card_id) {
        deleted_card_ids_set.add(data.card_id);
      }
      if (data.card_id && activeBoardSignal.value) {
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const next_cards = (current_board.cards || []).filter((c) => c.id !== data.card_id);
          const next_connections = (current_board.connections || []).filter(
            (conn) => conn.fromId !== data.card_id && conn.toId !== data.card_id
          );
          activeBoardSignal.value = {
            ...current_board,
            cards: next_cards,
            board_card: next_cards,
            connections: next_connections,
            board_connection: next_connections,
            board_conenctions: next_connections,
            updatedAt: Date.now(),
          };
          saveCurrentBoardToStore({ localOnly: true });
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:updated':
    case 'board:synced': {
      if (data.board && activeBoardSignal.value) {
        applyRemoteBoardSync(data.board);
      }
      break;
    }

    case 'board:cleared': {
      isRemoteUpdateFlag.current = true;
      try {
        const current_board = activeBoardSignal.value || {};
        activeBoardSignal.value = {
          ...current_board,
          cards: [],
          board_card: [],
          connections: [],
          board_connection: [],
          board_conenctions: [],
          drawings: [],
          board_drawing: [],
          updatedAt: Date.now(),
        };
        selectedCardsSignal.value = [];
      } finally {
        isRemoteUpdateFlag.current = false;
      }
      break;
    }

    case 'board:deleted': {
      if (data.board_id) {
        deleted_board_ids_set.add(data.board_id);
        delete_board_from_idb(data.board_id).catch(() => {});
        boardsDirectorySignal.value = (boardsDirectorySignal.value || []).filter(
          (b) => b.id !== data.board_id && b.board_code !== data.board_id
        );
      }
      break;
    }

    case 'board:connection_added': {
      if (data.connection && activeBoardSignal.value) {
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const exists = (current_board.connections || []).some((c) => c.id === data.connection.id);
          if (!exists) {
            const next_conns = [...(current_board.connections || []), data.connection];
            activeBoardSignal.value = {
              ...current_board,
              connections: next_conns,
              board_connection: next_conns,
              board_conenctions: next_conns,
            };
          }
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:connection_deleted': {
      if (data.conn_id && activeBoardSignal.value) {
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const next_conns = (current_board.connections || []).filter((c) => c.id !== data.conn_id);
          activeBoardSignal.value = {
            ...current_board,
            connections: next_conns,
            board_connection: next_conns,
            board_conenctions: next_conns,
          };
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:drawing_added': {
      if (data.stroke && activeBoardSignal.value) {
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const exists = (current_board.drawings || []).some((s) => s.id === data.stroke.id);
          if (!exists) {
            const next_drawings = [...(current_board.drawings || []), data.stroke];
            activeBoardSignal.value = {
              ...current_board,
              drawings: next_drawings,
              board_drawing: next_drawings,
            };
          }
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'board:drawing_erased': {
      if (data.stroke_id && activeBoardSignal.value) {
        isRemoteUpdateFlag.current = true;
        try {
          const current_board = activeBoardSignal.value;
          const next_drawings = (current_board.drawings || []).filter((s) => s.id !== data.stroke_id);
          activeBoardSignal.value = {
            ...current_board,
            drawings: next_drawings,
            board_drawing: next_drawings,
          };
        } finally {
          isRemoteUpdateFlag.current = false;
        }
      }
      break;
    }

    case 'cursor:update': {
      const peer_key = data.client_id || data.user?.client_id || data.user?.id;
      if (data.user && peer_key && peer_key !== CLIENT_SESSION_ID) {
        const resolved_user = resolve_peer_user_display(data.user, peer_key);
        remoteCursorsSignal.value = {
          ...remoteCursorsSignal.value,
          [peer_key]: {
            client_id: peer_key,
            user: resolved_user,
            x: data.x,
            y: data.y,
            lastActive: Date.now(),
          },
        };
      }
      break;
    }

    case 'card:selection_updated': {
      const peer_key = data.client_id || data.user?.client_id || data.user?.id;
      if (data.user && peer_key && peer_key !== CLIENT_SESSION_ID) {
        const resolved_user = resolve_peer_user_display(data.user, peer_key);
        const nextMap = { ...remoteCardSelectionsSignal.value };
        // Remove this session/user from all previous card selections
        Object.keys(nextMap).forEach((cId) => {
          nextMap[cId] = (nextMap[cId] || []).filter(
            (u) => (u.client_id || u.id) !== peer_key
          );
          if (nextMap[cId].length === 0) delete nextMap[cId];
        });
        // Add this session/user to newly selected cards
        (data.card_ids || []).forEach((cId) => {
          if (!nextMap[cId]) nextMap[cId] = [];
          nextMap[cId].push(resolved_user);
        });
        remoteCardSelectionsSignal.value = nextMap;
      }
      break;
    }

    case 'user_joined': {
      if (data.user) {
        const existing = activeUsersSignal.value.filter((u) => u.id !== data.user.id);
        activeUsersSignal.value = [...existing, data.user];
        if (data.user.id !== currentUserSignal.value.id) {
          showToast(`${data.user.name} joined the board`);
        }
      }
      if (Array.isArray(data.users)) {
        activeUsersSignal.value = data.users;
      }
      break;
    }

    case 'user_left': {
      const left_key = data.client_id || data.user_id;
      if (left_key) {
        const nextCursors = { ...remoteCursorsSignal.value };
        delete nextCursors[left_key];
        remoteCursorsSignal.value = nextCursors;

        const nextSelections = { ...remoteCardSelectionsSignal.value };
        Object.keys(nextSelections).forEach((cId) => {
          nextSelections[cId] = (nextSelections[cId] || []).filter(
            (u) => (u.client_id || u.id) !== left_key
          );
          if (nextSelections[cId].length === 0) delete nextSelections[cId];
        });
        remoteCardSelectionsSignal.value = nextSelections;
      }
      if (Array.isArray(data.users)) {
        activeUsersSignal.value = data.users;
      } else if (data.user_id && !data.client_id) {
        activeUsersSignal.value = activeUsersSignal.value.filter((u) => u.id !== data.user_id);
      }
      break;
    }

    case 'presence:update': {
      if (Array.isArray(data.users)) {
        activeUsersSignal.value = data.users;
      }
      break;
    }

    case 'comment:added': {
      const { card_id, comment } = data;
      if (!card_id || !comment) return;
      const current_list = cardCommentsSignal.value[card_id] || [];
      // Idempotency check: guard against duplicates
      if (current_list.some((c) => c.id === comment.id)) return;

      cardCommentsSignal.value = {
        ...cardCommentsSignal.value,
        [card_id]: [...current_list, comment],
      };

      if (comment.user_id !== currentUserSignal.value.id) {
        if (comment.parent_id) {
          showToast(`${comment.user_name} replied: "${comment.text.slice(0, 30)}${comment.text.length > 30 ? '...' : ''}"`);
        } else {
          showToast(`${comment.user_name} commented on card`);
        }
      }
      break;
    }

    case 'comment:deleted': {
      const { card_id, comment_id } = data;
      if (!card_id || !comment_id) return;
      const current_list = cardCommentsSignal.value[card_id] || [];
      cardCommentsSignal.value = {
        ...cardCommentsSignal.value,
        [card_id]: current_list.filter((c) => c.id !== comment_id && c.parent_id !== comment_id),
      };
      break;
    }

    case 'comment:reaction_updated': {
      const { card_id, comment_id, reactions, user, emoji } = data;
      if (!card_id || !comment_id || !reactions) return;
      const current_list = cardCommentsSignal.value[card_id] || [];
      cardCommentsSignal.value = {
        ...cardCommentsSignal.value,
        [card_id]: current_list.map((c) => (c.id === comment_id ? { ...c, reactions } : c)),
      };
      if (user && user.id !== currentUserSignal.value.id) {
        showToast(`${user.name} reacted with ${emoji} to a comment`);
      }
      break;
    }

    case 'card:reaction_updated': {
      const { card_id, reactions, user, emoji } = data;
      if (!card_id || !reactions) return;
      isRemoteUpdateFlag.current = true;
      try {
        updateCard(card_id, { reactions }, false);
      } finally {
        isRemoteUpdateFlag.current = false;
      }
      if (user && user.id !== currentUserSignal.value.id) {
        showToast(`${user.name} reacted with ${emoji}`);
      }
      break;
    }

    case 'card:tags_updated': {
      const { card_id, tags, user } = data;
      if (!card_id || !tags) return;
      isRemoteUpdateFlag.current = true;
      try {
        updateCard(card_id, { tags }, false);
      } finally {
        isRemoteUpdateFlag.current = false;
      }
      if (user && user.id !== currentUserSignal.value.id) {
        showToast(`${user.name} updated tags on card`);
      }
      break;
    }
  }
}

// Switch current user profile (for multi-user testing & collaboration)
export const switchUserProfile = (profile) => {
  if (!profile) return;
  currentUserSignal.value = profile;

  // Notify server of switched user identity
  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'user:switch',
      board_id: current_board_id || activeBoardSignal.value?.id,
      client_id: CLIENT_SESSION_ID,
      user: profile,
    }));
  }

  showToast(`Switched active collaborator to ${profile.name}`);
};

// Post a comment or reply to a card (multi-user)
export const postCardComment = async (cardId, text, parentId = null, replyToUserName = null) => {
  if (!cardId || !text || !text.trim()) return;
  const user = currentUserSignal.value;
  const boardId = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || 'board_moodboard';
  const comment_code = uuidv4();
  const now_ms = Date.now();
  const now_iso = new Date(now_ms).toISOString();

  const new_comment = {
    id: comment_code,
    card_comment_code: comment_code,
    card_id: cardId,
    card_code: cardId,
    board_id: boardId,
    board_code: boardId,
    user_account: user.user_account || user.id,
    user_id: user.user_account || user.id,
    user_name: user.name,
    user_avatar: user.avatar,
    user_color: user.color,
    text: text.trim(),
    card_comment_text: text.trim(),
    created_at: now_ms,
    time_create: now_iso,
    time_modify: now_iso,
    parent_id: parentId || null,
    card_comment_code_parent: parentId || null,
    reply_to_user_name: replyToUserName || null,
  };

  // Optimistic update
  const current_list = cardCommentsSignal.value[cardId] || [];
  cardCommentsSignal.value = {
    ...cardCommentsSignal.value,
    [cardId]: [...current_list, new_comment],
  };

  // Real-time send via WebSocket & BroadcastChannel
  const currentBoard = activeBoardSignal.value || {};
  const targetCard = (currentBoard.cards || []).find((c) => c.id === cardId);
  const card_title = targetCard?.title || 'Card';

  send_local_broadcast({
    type: 'comment:added',
    board_id: boardId,
    card_id: cardId,
    comment: new_comment,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'comment:add',
      board_id: boardId,
      board_code: boardId,
      card_id: cardId,
      card_code: cardId,
      comment: new_comment,
      card_title,
    }));
  } else {
    // REST API fallback
    try {
      await fetch(`/api/cards/${cardId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...get_lumen_auth_headers() },
        body: JSON.stringify({
          ...new_comment,
          board_id: boardId,
          board_code: boardId,
          lumen_auth: get_lumen_auth_payload(),
        }),
      });
    } catch (e) {
      console.warn('Comment REST fallback error:', e);
    }
  }
};

// Delete a card comment (and any replies to it)
export const deleteCardComment = async (cardId, commentId) => {
  if (!cardId || !commentId) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';

  // Optimistic delete: remove root comment and any replies referencing it
  const current_list = cardCommentsSignal.value[cardId] || [];
  cardCommentsSignal.value = {
    ...cardCommentsSignal.value,
    [cardId]: current_list.filter((c) => c.id !== commentId && c.parent_id !== commentId),
  };

  send_local_broadcast({
    type: 'comment:deleted',
    board_id: boardId,
    card_id: cardId,
    comment_id: commentId,
  });

  // Broadcast via WebSocket
  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'comment:delete',
      board_id: boardId,
      card_id: cardId,
      comment_id: commentId,
    }));
  } else {
    try {
      await fetch(`/api/cards/${cardId}/comments/${commentId}?board_id=${boardId}`, {
        method: 'DELETE',
        headers: { ...get_lumen_auth_headers() },
      });
    } catch (e) {}
  }
};

// Toggle emoji reaction on a comment or reply (multi-user)
export const toggleCommentReaction = async (cardId, commentId, emoji) => {
  if (!cardId || !commentId || !emoji) return;
  const current_user = currentUserSignal.value;
  const user_id = current_user.id;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';

  const current_list = cardCommentsSignal.value[cardId] || [];
  const target_comment = current_list.find((c) => c.id === commentId);
  if (!target_comment) return;

  const existing_reactions = Array.isArray(target_comment.reactions) ? [...target_comment.reactions] : [];
  const rx_idx = existing_reactions.findIndex((r) => r.emoji === emoji);

  let updated_reactions;
  let did_react = false;

  if (rx_idx !== -1) {
    const rx = existing_reactions[rx_idx];
    const user_ids = Array.isArray(rx.users) ? [...rx.users] : [];
    const has_reacted = user_ids.includes(user_id);

    if (has_reacted) {
      // Toggle OFF for this user
      const filtered_users = user_ids.filter((uid) => uid !== user_id);
      if (filtered_users.length === 0) {
        updated_reactions = existing_reactions.filter((_, idx) => idx !== rx_idx);
      } else {
        updated_reactions = existing_reactions.map((r, idx) =>
          idx === rx_idx
            ? { ...r, count: filtered_users.length, users: filtered_users }
            : r
        );
      }
    } else {
      // Toggle ON for this user
      did_react = true;
      const new_users = [...user_ids, user_id];
      updated_reactions = existing_reactions.map((r, idx) =>
        idx === rx_idx
          ? { ...r, count: new_users.length, users: new_users }
          : r
      );
    }
  } else {
    // Add new emoji reaction by this user
    did_react = true;
    updated_reactions = [
      ...existing_reactions,
      {
        emoji,
        count: 1,
        users: [user_id],
      },
    ];
  }

  // Optimistically update comments signal
  cardCommentsSignal.value = {
    ...cardCommentsSignal.value,
    [cardId]: current_list.map((c) =>
      c.id === commentId ? { ...c, reactions: updated_reactions } : c
    ),
  };

  if (did_react) {
    showToast(`Reacted ${emoji} to comment`);
  }

  send_local_broadcast({
    type: 'comment:reaction_updated',
    board_id: boardId,
    card_id: cardId,
    comment_id: commentId,
    reactions: updated_reactions,
    user: current_user,
    emoji,
  });

  // Broadcast via WebSocket
  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'comment:reaction',
      board_id: boardId,
      card_id: cardId,
      comment_id: commentId,
      reactions: updated_reactions,
      user: current_user,
      emoji,
    }));
  } else {
    try {
      await fetch(`/api/cards/${cardId}/comments/${commentId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...get_lumen_auth_headers() },
        body: JSON.stringify({
          board_id: boardId,
          reactions: updated_reactions,
          user: current_user,
          emoji,
          lumen_auth: get_lumen_auth_payload(),
        }),
      });
    } catch (e) {
      console.warn('Comment reaction REST error:', e);
    }
  }
};

// Multi-User Reaction Toggle:
// Tracks array of reacting user IDs per emoji so multiple distinct users can react!
export const multiUserToggleReaction = (cardId, emoji) => {
  if (!cardId || !emoji) return;
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card) return;

  const current_user = currentUserSignal.value;
  const user_id = current_user.id;
  const boardId = currentBoard.id || 'board_moodboard';

  const existing_reactions = Array.isArray(card.reactions) ? [...card.reactions] : [];
  const rx_idx = existing_reactions.findIndex((r) => r.emoji === emoji);

  let updated_reactions;
  let did_react = false;

  if (rx_idx !== -1) {
    const rx = existing_reactions[rx_idx];
    const user_ids = Array.isArray(rx.users)
      ? [...rx.users]
      : rx.user_reacted ? [user_id] : [];

    const has_reacted = user_ids.includes(user_id) || rx.user_reacted;

    if (has_reacted) {
      // Toggle OFF for this user
      const filtered_users = user_ids.filter((uid) => uid !== user_id);
      if (filtered_users.length === 0) {
        // Remove emoji if no users left
        updated_reactions = existing_reactions.filter((_, idx) => idx !== rx_idx);
      } else {
        updated_reactions = existing_reactions.map((r, idx) =>
          idx === rx_idx
            ? {
                ...r,
                count: filtered_users.length,
                users: filtered_users,
                user_reacted: false,
              }
            : r
        );
      }
    } else {
      // Toggle ON for this user
      did_react = true;
      const new_users = [...user_ids, user_id];
      updated_reactions = existing_reactions.map((r, idx) =>
        idx === rx_idx
          ? {
              ...r,
              count: new_users.length,
              users: new_users,
              user_reacted: true,
            }
          : r
      );
    }
  } else {
    // Add new emoji reaction by this user
    did_react = true;
    updated_reactions = [
      ...existing_reactions,
      {
        emoji,
        count: 1,
        users: [user_id],
        user_reacted: true,
      },
    ];
  }

  // Update card state
  updateCard(cardId, { reactions: updated_reactions }, false);
  saveCurrentBoardToStore();

  if (did_react) {
    showToast(`Reacted with ${emoji}`);
  }

  send_local_broadcast({
    type: 'card:reaction_updated',
    board_id: boardId,
    card_id: cardId,
    emoji,
    user: current_user,
    reactions: updated_reactions,
  });

  // Broadcast to other users over WebSocket
  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'card:reaction',
      board_id: boardId,
      card_id: cardId,
      emoji,
      user: current_user,
      reactions: updated_reactions,
      card_title: card.title || 'Card',
    }));
  }
};

// Multi-User Tag Add
export const multiUserAddTag = (cardId, tagText, tagColor) => {
  if (!tagText || !tagText.trim()) return;
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card) return;

  const current_user = currentUserSignal.value;
  const clean_text = tagText.trim();
  const existing_tags = Array.isArray(card.tags) ? [...card.tags] : [];

  const exists = existing_tags.some((t) =>
    (typeof t === 'string' ? t : t.text).toLowerCase() === clean_text.toLowerCase()
  );
  if (exists) {
    showToast(`Tag "${clean_text}" already exists`);
    return;
  }

  const new_tag = {
    text: clean_text,
    color: tagColor || 'blue',
    added_by: current_user.name,
    added_by_id: current_user.id,
  };

  const updated_tags = [...existing_tags, new_tag];
  updateCard(cardId, { tags: updated_tags }, true);
  saveCurrentBoardToStore();
  showToast(`Added label "${clean_text}"`);

  send_local_broadcast({
    type: 'card:tags_updated',
    board_id: currentBoard.id || 'board_moodboard',
    card_id: cardId,
    tags: updated_tags,
    user: current_user,
  });

  // Broadcast to collaborators
  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'card:update_tags',
      board_id: currentBoard.id || 'board_moodboard',
      card_id: cardId,
      tags: updated_tags,
      user: current_user,
      card_title: card.title || 'Card',
      action_desc: `Tagged "${card.title || 'card'}" with #${clean_text}`,
    }));
  }
};

// Multi-User Tag Remove
export const multiUserRemoveTag = (cardId, tagIdentifier) => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card || !Array.isArray(card.tags)) return;

  const current_user = currentUserSignal.value;
  const updated_tags = card.tags.filter((t, idx) => {
    if (typeof tagIdentifier === 'number') return idx !== tagIdentifier;
    const text = typeof t === 'string' ? t : t.text;
    return text.toLowerCase() !== String(tagIdentifier).toLowerCase();
  });

  updateCard(cardId, { tags: updated_tags }, true);
  saveCurrentBoardToStore();

  send_local_broadcast({
    type: 'card:tags_updated',
    board_id: currentBoard.id || 'board_moodboard',
    card_id: cardId,
    tags: updated_tags,
    user: current_user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'card:update_tags',
      board_id: currentBoard.id || 'board_moodboard',
      card_id: cardId,
      tags: updated_tags,
      user: current_user,
    }));
  }
};

// Open card comments drawer
export const openCardCommentsDrawer = (cardId) => {
  activeCommentsCardIdSignal.value = cardId;
};

// Close card comments drawer
export const closeCardCommentsDrawer = () => {
  activeCommentsCardIdSignal.value = null;
};

// -------------------------------------------------------------
// Real-time Board Operations Broadcast Helpers
// -------------------------------------------------------------

export function broadcastCardAdd(card) {
  if (isRemoteUpdateFlag.current || !card) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  // Zero-data-leak protection: never broadcast plaintext for encrypted cards
  let safe_card = card;
  const is_enc = Boolean(card.card_encryption || card.cardEncryption || card.is_encrypted);
  if (is_enc) {
    safe_card = {
      ...card,
      content: '',
      items: [],
      description: '',
      notes: '',
      url: '',
      canvas_strokes: [],
      data: { ...(typeof card.data === 'object' && card.data !== null ? card.data : {}), content: '', items: [] },
      is_encryption_unlocked: false,
    };
  }

  send_local_broadcast({
    type: 'board:card_added',
    board_id: boardId,
    card: safe_card,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:card_add',
      board_id: boardId,
      card: safe_card,
      user,
    }));
  }
}

export function broadcastCardUpdate(cardId, updates, recordLog = false, logLabel = '', logDesc = '', targetName = '') {
  if (isRemoteUpdateFlag.current || !cardId) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  // Zero-data-leak protection: if this card is encrypted, NEVER broadcast plaintext updates!
  const currentBoard = activeBoardSignal.value;
  const targetCard = (currentBoard?.cards || []).find((c) => c.id === cardId);
  const is_enc = Boolean(targetCard?.card_encryption || targetCard?.cardEncryption || targetCard?.is_encrypted || updates?.card_encryption);

  let safe_updates = updates;
  if (is_enc) {
    safe_updates = { ...updates };
    if (safe_updates.content !== undefined) delete safe_updates.content;
    if (safe_updates.items !== undefined) delete safe_updates.items;
    if (safe_updates.description !== undefined) delete safe_updates.description;
    if (safe_updates.notes !== undefined) delete safe_updates.notes;
    if (safe_updates.data && typeof safe_updates.data === 'object') {
      safe_updates.data = { ...safe_updates.data, content: '', items: [] };
    }
    delete safe_updates.is_encryption_unlocked;
  }

  send_local_broadcast({
    type: 'board:card_updated',
    board_id: boardId,
    card_id: cardId,
    updates: safe_updates,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:card_update',
      board_id: boardId,
      card_id: cardId,
      updates: safe_updates,
      user,
      record_log: recordLog,
      log_label: logLabel,
      log_description: logDesc,
      target_name: targetName,
    }));
  }
}

export function broadcastCardMove(cardId, x, y, isFinal = false, cardTitle = '', targetType = 'card', width = undefined, height = undefined) {
  if (isRemoteUpdateFlag.current || !cardId) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:card_moved',
    board_id: boardId,
    card_id: cardId,
    x,
    y,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    user,
    is_final: isFinal,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:card_move',
      board_id: boardId,
      card_id: cardId,
      x,
      y,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      user,
      is_final: isFinal,
      card_title: cardTitle,
      target_type: targetType,
    }));
  }
}

export function broadcastCardDelete(cardId, cardTitle = '', cardType = 'card') {
  if (isRemoteUpdateFlag.current || !cardId) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:card_deleted',
    board_id: boardId,
    card_id: cardId,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:card_delete',
      board_id: boardId,
      card_id: cardId,
      card_title: cardTitle,
      card_type: cardType,
      user,
    }));
  }
}

export function broadcastBoardSync(board) {
  if (isRemoteUpdateFlag.current) return;
  const targetBoard = board || activeBoardSignal.value;
  if (!targetBoard || !targetBoard.id) return;
  const boardId = targetBoard.id;

  const sanitized_cards = (targetBoard.cards || []).map((card) => {
    const is_enc = Boolean(card.card_encryption || card.cardEncryption || card.is_encrypted);
    if (!is_enc) return card;
    return {
      ...card,
      content: '',
      items: [],
      description: '',
      notes: '',
      url: '',
      canvas_strokes: [],
      data: { ...(typeof card.data === 'object' && card.data !== null ? card.data : {}), content: '', items: [] },
      is_encryption_unlocked: false,
    };
  });

  const safe_board = {
    ...targetBoard,
    cards: sanitized_cards,
    board_card: sanitized_cards,
  };

  send_local_broadcast({
    type: 'board:synced',
    board_id: boardId,
    board: safe_board,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:sync_full',
      board_id: boardId,
      board: safe_board,
    }));
  }
}

export function broadcastBoardClear(boardId) {
  if (isRemoteUpdateFlag.current) return;
  const targetBoardId = boardId || activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:cleared',
    board_id: targetBoardId,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:clear',
      board_id: targetBoardId,
      user,
    }));
  }
}

export function broadcastConnectionAdd(connection, fromTitle = '', toTitle = '') {
  if (isRemoteUpdateFlag.current || !connection) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:connection_added',
    board_id: boardId,
    connection,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:connection_add',
      board_id: boardId,
      connection,
      from_title: fromTitle,
      to_title: toTitle,
      user,
    }));
  }
}

export function broadcastConnectionDelete(connId) {
  if (isRemoteUpdateFlag.current || !connId) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:connection_deleted',
    board_id: boardId,
    conn_id: connId,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:connection_delete',
      board_id: boardId,
      conn_id: connId,
      user,
    }));
  }
}

export function broadcastDrawingAdd(stroke) {
  if (isRemoteUpdateFlag.current || !stroke) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:drawing_added',
    board_id: boardId,
    stroke,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:drawing_add',
      board_id: boardId,
      stroke,
      user,
    }));
  }
}

export function broadcastDrawingErase(strokeId) {
  if (isRemoteUpdateFlag.current || !strokeId) return;
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'board:drawing_erased',
    board_id: boardId,
    stroke_id: strokeId,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'board:drawing_erase',
      board_id: boardId,
      stroke_id: strokeId,
      user,
    }));
  }
}

let last_cursor_emit = 0;
export function broadcastCursorMove(x, y) {
  const now = Date.now();
  if (now - last_cursor_emit < 18) return; // throttle cursor to ~55fps for smooth online-game feel
  last_cursor_emit = now;

  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'cursor:update',
    board_id: boardId,
    x,
    y,
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'cursor:move',
      board_id: boardId,
      x,
      y,
      user,
    }));
  }
}

export function broadcastCardSelect(cardIds) {
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  const user = currentUserSignal.value;

  send_local_broadcast({
    type: 'card:selection_updated',
    board_id: boardId,
    card_ids: cardIds || [],
    user,
  });

  if (active_socket && active_socket.readyState === WebSocket.OPEN) {
    active_socket.send(JSON.stringify({
      type: 'card:select',
      board_id: boardId,
      card_ids: cardIds,
      user,
    }));
  }
}

export const clearActivityLogs = async () => {
  const boardId = activeBoardSignal.value?.id || 'board_moodboard';
  activityLogsSignal.value = [];
  try {
    await fetch(`/api/boards/${boardId}/activity`, {
      method: 'DELETE',
      headers: { ...get_lumen_auth_headers() },
    });
    showToast('Activity history cleared');
  } catch (e) {
    console.warn('Failed to clear activity logs:', e);
  }
};
