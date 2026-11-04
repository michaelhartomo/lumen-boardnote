/**
 * Lumen Board View - Server API Integration Utilities
 *
 * Provides REST API handlers for file upload, board persistence,
 * comment management, and board AI co-pilot queries.
 */

import {
  showToast,
  upload_lumen_file,
  MAX_BOARD_FILE_SIZE_MB,
  MAX_BOARD_FILE_SIZE_BYTES,
  downloadBoardConfigurationJson,
} from '../signals/boardState.js';
import { get_lumen_auth_payload, get_lumen_auth_headers } from '../signals/realtimeState.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload a file attachment to the backend server (up to 88MB).
 * @param {File} file - The file to upload.
 * @param {Object} [meta] - Optional metadata (cardId, boardId, etc.)
 * @returns {Promise<Object>} The uploaded file manifest entry.
 */
export async function api_upload_file(file, meta = {}) {
  try {
    if (!file) throw new Error('No file provided');
    if (file.size > MAX_BOARD_FILE_SIZE_BYTES) {
      const size_mb_str = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `File "${file.name}" (${size_mb_str} MB) exceeds the ${MAX_BOARD_FILE_SIZE_MB} MB upload limit.`
      );
    }
    return await upload_lumen_file(file, meta);
  } catch (err) {
    console.error('[lumenApi] Upload error:', err);
    throw err;
  }
}

/**
 * Create a new board on the backend or in local state.
 * @param {string} [title] - Board title.
 * @param {string} [type] - Board layout type (freeform, moodboard, sprint, etc.)
 * @returns {Promise<Object>} Created board data.
 */
export async function api_create_new_board(title = 'Untitled Board', type = 'snap_grid', initialData = null) {
  try {
    const auth_payload = get_lumen_auth_payload();
    const newId = initialData?.id || initialData?.board_code || uuidv4();
    const now_iso = new Date().toISOString();
    const newBoard = initialData || {
      id: newId,
      board_code: newId,
      title: title || 'Untitled Board',
      board_name: title || 'Untitled Board',
      type: type || 'snap_grid',
      vendor_code: auth_payload?.vendor_code || null,
      master_code: auth_payload?.master_code || null,
      project_code: auth_payload?.project_code || null,
      user_account: auth_payload?.user_account || null,
      lumen_auth: auth_payload,
      viewport: { panX: 160, panY: 100, zoom: 1 },
      board_viewport: { panX: 160, panY: 100, zoom: 1 },
      cards: [],
      board_card: [],
      connections: [],
      board_connection: [],
      drawings: [],
      board_drawing: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      time_create: now_iso,
      time_modify: now_iso,
    };

    const res = await fetch(`/api/boards/${newId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({ board: newBoard, lumen_auth: auth_payload }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.board || newBoard;
    }
    return newBoard;
  } catch (err) {
    console.warn('[lumenApi] Create board error:', err);
    const fallbackId = initialData?.id || initialData?.board_code || uuidv4();
    return initialData || { id: fallbackId, board_code: fallbackId, title, type, cards: [], connections: [], board_connection: [], drawings: [] };
  }
}

/**
 * Export board in specified format.
 * @param {string} export_type - 'pdf' | 'png' | 'svg' | 'json' | 'zip' | 'md'
 * @param {Object} board_data - Board data payload
 * @param {Object} [options] - Export configuration options
 */
export async function api_export_board(export_type, board_data, options = {}) {
  try {
    if (export_type === 'json') {
      const payload = downloadBoardConfigurationJson(board_data);
      return { success: Boolean(payload), payload };
    }
    showToast(`Exporting ${export_type.toUpperCase()}...`);
    return { success: true, type: export_type };
  } catch (err) {
    console.error('[lumenApi] Export error:', err);
    throw err;
  }
}

/**
 * Share board settings (Private / Public / Google Drive-style sharing).
 * @param {string} board_id
 * @param {Object} share_config
 */
export async function api_share_board(board_id, share_config) {
  try {
    if (share_config && (share_config.sharing || share_config.visibility || share_config.general_access)) {
      const auth_payload = get_lumen_auth_payload();
      const res = await fetch(`/api/boards/${encodeURIComponent(board_id)}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          sharing: share_config.sharing || share_config,
          lumen_auth: auth_payload,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    }
    const target_url =
      share_config?.url ||
      (typeof window !== 'undefined' && board_id
        ? `${window.location.origin}/board/${encodeURIComponent(board_id)}`
        : typeof window !== 'undefined'
        ? window.location.href
        : '');
    if (target_url && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(target_url);
    }
    return { success: true, board_id, share_config };
  } catch (err) {
    console.warn('[lumenApi] Share error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Persist board state to backend server.
 * @param {string} board_id
 * @param {Object} board_data
 */
export async function api_save_board(board_id, board_data) {
  try {
    const auth_payload = get_lumen_auth_payload();
    const res = await fetch(`/api/boards/${board_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        ...(board_data || {}),
        lumen_auth: auth_payload,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to save board (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[lumenApi] Save board error:', err);
    return { error: err.message };
  }
}

/**
 * Load board state from backend server.
 * @param {string} board_id
 */
export async function api_load_board(board_id) {
  try {
    const res = await fetch(`/api/boards/${board_id}`, {
      headers: {
        ...get_lumen_auth_headers(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to load board (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[lumenApi] Load board error:', err);
    return null;
  }
}

/**
 * Post a new comment on a card.
 * @param {string} card_id
 * @param {Object} payload
 */
export async function api_post_comment(card_id, payload) {
  try {
    const auth_payload = get_lumen_auth_payload();
    const res = await fetch(`/api/cards/${card_id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        ...(payload || {}),
        lumen_auth: auth_payload,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to post comment (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('[lumenApi] Post comment error:', err);
    throw err;
  }
}

/**
 * Delete a comment on a card.
 * @param {string} card_id
 * @param {string} comment_id
 * @param {string} [board_id]
 */
export async function api_delete_comment(card_id, comment_id, board_id = '') {
  try {
    const url = `/api/cards/${card_id}/comments/${comment_id}${board_id ? `?board_id=${board_id}` : ''}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...get_lumen_auth_headers(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to delete comment (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('[lumenApi] Delete comment error:', err);
    throw err;
  }
}

/**
 * Ask AI Assistant with current board context.
 * @param {Object} board_data
 * @param {string} prompt
 * @param {Array<string>} [selected_card_ids]
 */
export async function api_ask_ai(board_data, prompt, selected_card_ids = undefined) {
  try {
    const res = await fetch('/api/ai/ask-board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        question: prompt,
        board: board_data,
        selected_card_ids: Array.isArray(selected_card_ids) && selected_card_ids.length > 0 ? selected_card_ids : undefined,
        lumen_auth: get_lumen_auth_payload(),
      }),
    });
    if (!res.ok) {
      throw new Error(`AI request failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('[lumenApi] Ask AI error:', err);
    throw err;
  }
}

// Client-side cache for place searches
const clientGeoSearchCache = new Map();

/**
 * Search places and landmarks by text query with backend server + Nominatim fallback.
 * @param {string} query - The search string
 * @returns {Promise<Array>} Array of parsed place items
 */
export async function api_search_places(query) {
  if (!query || !query.trim()) return [];
  const trimmed = query.trim().toLowerCase();

  if (clientGeoSearchCache.has(trimmed)) {
    return clientGeoSearchCache.get(trimmed);
  }

  // 1. Try backend server proxy
  try {
    const res = await fetch(`/api/geo/search-places?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        clientGeoSearchCache.set(trimmed, data.results);
        return data.results;
      }
    }
  } catch (err) {
    console.warn('[lumenApi] Backend search-places request failed:', err);
  }

  // 2. Direct OpenStreetMap Nominatim fallback
  try {
    const osm_res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=8`,
      {
        headers: { Accept: 'application/json' },
      }
    );
    if (osm_res.ok) {
      const osm_data = await osm_res.json();
      if (Array.isArray(osm_data)) {
        const parsed = osm_data.map((item) => ({
          place_id: item.place_id,
          name: item.name || item.display_name?.split(',')?.[0]?.trim() || trimmed,
          display_name: item.display_name || '',
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          type: item.type || item.class || 'place',
          address: item.display_name || '',
          country: item.address?.country || '',
          city: item.address?.city || item.address?.town || item.address?.state || '',
        }));
        if (parsed.length > 0) {
          clientGeoSearchCache.set(trimmed, parsed);
          return parsed;
        }
      }
    }
  } catch (err2) {
    console.warn('[lumenApi] Direct OSM Nominatim fallback failed:', err2);
  }

  return [];
}

/**
 * Fetch storage usage, quota, and uploaded files list for a user / board owner.
 * @param {string} [user_account] - Target user account
 * @param {string} [board_id] - Optional board ID
 * @returns {Promise<Object|null>}
 */
export async function api_get_storage_usage(user_account = '', board_id = '') {
  try {
    const auth_payload = get_lumen_auth_payload();
    const effective_user = user_account || auth_payload?.user_account || '';
    const params = new URLSearchParams();
    if (effective_user) {
      params.set('user_account', effective_user);
    }
    if (board_id) {
      params.set('board_id', board_id);
    }
    const query_str = params.toString();
    const url = `/api/storage/usage${query_str ? `?${query_str}` : ''}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        ...get_lumen_auth_headers(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch storage usage (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[lumenApi] Get storage usage error:', err);
    return null;
  }
}

/**
 * Delete an uploaded file from server, S3/Spaces, and PostgreSQL.
 * @param {string} file_id - Target file ID
 * @param {Object} [meta] - Optional { board_id, file_name, user_account }
 * @returns {Promise<Object>}
 */
export async function api_delete_file(file_id, meta = {}) {
  if (!file_id) {
    throw new Error('file_id is required');
  }
  const params = new URLSearchParams();
  if (meta?.board_id) params.set('board_id', String(meta.board_id));
  if (meta?.file_name) params.set('file_name', String(meta.file_name));
  if (meta?.user_account) params.set('user_account', String(meta.user_account));
  const qs = params.toString();
  const res = await fetch(`/api/files/${encodeURIComponent(file_id)}${qs ? `?${qs}` : ''}`, {
    method: 'DELETE',
    headers: {
      ...get_lumen_auth_headers(),
    },
  });
  if (!res.ok) {
    const err_data = await res.json().catch(() => ({}));
    throw new Error(err_data.error || `Failed to delete file (${res.status})`);
  }
  return await res.json();
}


