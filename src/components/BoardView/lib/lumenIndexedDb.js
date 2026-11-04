// ==========================================================================
// Lumen IndexedDB Storage Engine
// Provides high-capacity, asynchronous client-side storage for boards
// exceeding the 5MB browser localStorage quota (supports 50MB+ datasets)
// ==========================================================================

const DB_NAME = 'lumen_notes_db';
const DB_VERSION = 1;
const STORE_NAME = 'boards';

let db_instance_promise = null;

function get_idb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }
  return window.indexedDB;
}

export function open_lumen_db() {
  const idb = get_idb();
  if (!idb) return Promise.resolve(null);

  if (db_instance_promise) {
    return db_instance_promise;
  }

  db_instance_promise = new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (err) => {
        console.warn('[Lumen IndexedDB] Failed to open database:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('[Lumen IndexedDB] Open exception:', e);
      resolve(null);
    }
  });

  return db_instance_promise;
}

/**
 * Save board state to IndexedDB asynchronously
 * @param {object} board
 * @returns {Promise<boolean>}
 */
export async function save_board_to_idb(board) {
  if (!board || !board.id) return false;
  try {
    const db = await open_lumen_db();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        ...board,
        _lumen_saved_at: Date.now(),
      });

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[Lumen IndexedDB] Error writing board:', err);
    return false;
  }
}

/**
 * Load board state from IndexedDB
 * @param {string} board_id
 * @returns {Promise<object|null>}
 */
export async function load_board_from_idb(board_id) {
  if (!board_id) return null;
  try {
    const db = await open_lumen_db();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(board_id);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[Lumen IndexedDB] Error reading board:', err);
    return null;
  }
}

/**
 * Delete board from IndexedDB
 * @param {string} board_id
 * @returns {Promise<boolean>}
 */
export async function delete_board_from_idb(board_id) {
  if (!board_id) return false;
  try {
    const db = await open_lumen_db();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(board_id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Calculate exact UTF-8 byte size of a board JSON object
 * @param {object} board
 * @returns {number}
 */
export function calculate_board_size_bytes(board) {
  if (!board) return 0;
  try {
    const str = JSON.stringify(board);
    if (typeof Blob !== 'undefined') {
      return new Blob([str]).size;
    }
    return str.length;
  } catch (e) {
    return 0;
  }
}

/**
 * Format bytes into human-readable label
 * @param {number} bytes
 * @returns {string}
 */
export function format_board_size(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
