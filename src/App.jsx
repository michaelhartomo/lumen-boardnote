import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useSignals } from '@preact/signals-react/runtime';

import styles from './App.module.css';
import BoardView from './components/BoardView/LUMEN_board_view.jsx';

// Import signals and API server function handlers from self-contained BoardView package subfolders
import {
  activeBoardIdSignal,
  fetchBoardsFromServer,
  setActiveBoard,
} from './components/BoardView/signals/boardState.js';
import { setLumenAuth } from './components/BoardView/signals/realtimeState.js';
import {
  api_upload_file,
  api_create_new_board,
  api_export_board,
  api_share_board,
  api_save_board,
  api_load_board,
  api_post_comment,
  api_delete_comment,
  api_ask_ai,
} from './components/BoardView/utils/lumenApi.js';

// LUMEN User Authentication Session Object
const lumen_auth = {
  vendor_code: 'lumen',
  master_code: 'mysuperid',
  project_code: 'mysuperid',
  session_code: 'ce6cebd7-9486-442d-b3df-90752171f777',
  auth_type: 'auth_type_session_code',
  permission_code: '',
  permission_type: '',
  time_created: '2026-09-27T20:30:50+08:00',
  time_expire: '2026-10-04T20:30:50+08:00',
  user_account: 'user007',
  user_avatar: 'https://mysuperid.com/assets/avatar.jpg',
  user_auth_token: 'ee5319ee-d294-4125-9c8a-08c069e25755',
  user_auth_token_ttl: '2026-10-04T20:30:50+08:00',
  user_full_name: null,
  user_primary_email: 'user007@mysuperid.com',
  user_primary_email_status: null,
  user_primary_phone: null,
  user_primary_phone_status: null,
  user_status: 'active',
  user_time_created: null,
  user_time_modified: null,
};

// Synchronize lumen_auth before any component or API request runs
setLumenAuth(lumen_auth);

// Helper to extract board ID from ?board=, ?board_id=, #board=, or /board/:boardId
export function extract_board_id_from_url() {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check URLSearchParams: ?board=... or ?board_id=...
    const search_params = new URLSearchParams(window.location.search);
    const param_board = search_params.get('board') || search_params.get('board_id');
    if (param_board && param_board.trim()) {
      return decodeURIComponent(param_board.trim());
    }

    // 2. Check URL hash: #board=... or #/board/...
    const hash = window.location.hash || '';
    if (hash) {
      const hash_cleaned = hash.replace(/^#\/?/, '');
      if (hash_cleaned.startsWith('board=')) {
        const val = hash_cleaned.split('board=')[1]?.split('&')[0];
        if (val) return decodeURIComponent(val.trim());
      }
      if (hash_cleaned.startsWith('board/')) {
        const val = hash_cleaned.split('board/')[1]?.split(/[?&]/)[0];
        if (val) return decodeURIComponent(val.trim());
      }
    }

    // 3. Check pathname: /board/:boardId
    const pathname = window.location.pathname || '';
    const match = pathname.match(/\/board\/([^/?#]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].trim());
    }
  } catch (err) {
    console.warn('[Lumen App] Error parsing board ID from URL:', err);
  }
  return null;
}

export default function App() {
  useSignals();
  const url_board_id = extract_board_id_from_url();
  const current_board_id = activeBoardIdSignal.value || url_board_id;

  useEffect(() => {
    // If a board ID was specified in the URL (query param or hash), activate it directly
    const initial_target_id = extract_board_id_from_url();
    if (initial_target_id) {
      setActiveBoard(initial_target_id);
      return;
    }

    // Otherwise, fetch user workspace boards and prefer the last active board if still present, or first owned board
    fetchBoardsFromServer(lumen_auth).then((boards) => {
      if (!activeBoardIdSignal.value && Array.isArray(boards) && boards.length > 0) {
        let saved_board_id = null;
        try {
          saved_board_id = window.localStorage.getItem('lumen_last_active_board_id_v1');
        } catch (_) {}
        const matched_saved = saved_board_id
          ? boards.find((b) => b && (b.id === saved_board_id || b.board_code === saved_board_id))
          : null;
        const owned = boards.find((b) => b && b.user_account === lumen_auth.user_account);
        const target = matched_saved || owned || boards[0];
        if (target && (target.id || target.board_code)) {
          const target_id = target.id || target.board_code;
          setActiveBoard(target_id);
        }
      }
    });
  }, []);

  return (
    <div className={styles.lumenApp}>
      <Routes>
        <Route
          path="/"
          element={
            current_board_id ? (
              <BoardView
                auth={lumen_auth}
                board_id={current_board_id}
                show_header={true}
                show_dock={true}
                show_minimap={true}
                snap_to_grid={true}
                on_upload_file={api_upload_file}
                on_create_board={api_create_new_board}
                on_export={api_export_board}
                on_share={api_share_board}
                on_save={api_save_board}
                on_load_board={api_load_board}
                on_post_comment={api_post_comment}
                on_delete_comment={api_delete_comment}
                on_ask_ai={api_ask_ai}
              />
            ) : (
              <BoardView
                auth={lumen_auth}
                board_id={null}
                show_header={true}
                show_dock={false}
                show_minimap={false}
                snap_to_grid={true}
                on_upload_file={api_upload_file}
                on_create_board={api_create_new_board}
                on_export={api_export_board}
                on_share={api_share_board}
                on_save={api_save_board}
                on_load_board={api_load_board}
                on_post_comment={api_post_comment}
                on_delete_comment={api_delete_comment}
                on_ask_ai={api_ask_ai}
              />
            )
          }
        />
        <Route
          path="/boards"
          element={
            <BoardView
              auth={lumen_auth}
              board_id={null}
              show_header={true}
              show_dock={false}
              show_minimap={false}
              snap_to_grid={true}
              on_upload_file={api_upload_file}
              on_create_board={api_create_new_board}
              on_export={api_export_board}
              on_share={api_share_board}
              on_save={api_save_board}
              on_load_board={api_load_board}
              on_post_comment={api_post_comment}
              on_delete_comment={api_delete_comment}
              on_ask_ai={api_ask_ai}
            />
          }
        />
        <Route
          path="/board/:boardId"
          element={
            <BoardView
              auth={lumen_auth}
              show_header={true}
              show_dock={true}
              show_minimap={true}
              snap_to_grid={true}
              on_upload_file={api_upload_file}
              on_create_board={api_create_new_board}
              on_export={api_export_board}
              on_share={api_share_board}
              on_save={api_save_board}
              on_load_board={api_load_board}
              on_post_comment={api_post_comment}
              on_delete_comment={api_delete_comment}
              on_ask_ai={api_ask_ai}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
