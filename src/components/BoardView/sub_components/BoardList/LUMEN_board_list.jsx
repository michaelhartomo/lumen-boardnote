import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useNavigate } from 'react-router';
import {
  FolderKanban,
  Plus,
  Search,
  X,
  Grid,
  Move,
  Copy,
  Trash2,
  ArrowRight,
  LayoutTemplate,
  RefreshCw,
  Check,
  Share2,
  Lock,
  Globe,
  Users,
  HardDrive,
  Database,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File,
  Download,
  Eye,
  Cloud,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  ShieldCheck,
  Sparkles,
  Cpu,
  Mic,
  Code2,
  TrendingUp,
  CheckSquare,
  RotateCcw,
} from 'lucide-react';

import styles from './LUMEN_board_list.module.css';
import {
  boardsDirectorySignal,
  isBoardsDirectoryLoadingSignal,
  fetchBoardsFromServer,
  setActiveBoard,
  createNewBoard,
  deleteBoard,
  duplicateBoard,
  isTemplateModalOpenSignal,
  showToast,
  openShareModal,
  normalize_board_sharing,
  openImageViewer,
  openFileViewerModal,
  purgeDeletedFileFromBoards,
  fetch_bandwidth_usage,
  is_bandwidth_loading_signal,
  fetch_ai_usage,
  is_ai_usage_loading_signal,
} from '../../signals/boardState.js';
import {
  AI_AVAILABLE_MODELS,
  AI_TASK_CATEGORIES,
  aiTaskRoutingSignal,
  getAiModelById,
  setSelectedAiModelForTask,
  setAllAiTasksToModel,
  resetAiTaskRouting,
} from '../../signals/aiState.js';
import {
  lumenAuthSignal,
  currentUserSignal,
} from '../../signals/realtimeState.js';
import {
  api_get_storage_usage,
  api_delete_file,
} from '../../utils/lumenApi.js';

/**
 * Format timestamp into concise relative time
 */
function format_relative_time(timestamp) {
  if (!timestamp) return 'Recently';
  const diff_ms = Date.now() - new Date(timestamp).getTime();
  const diff_mins = Math.floor(diff_ms / 60000);
  if (diff_mins < 1) return 'Just now';
  if (diff_mins < 60) return `${diff_mins}m ago`;
  const diff_hours = Math.floor(diff_mins / 60);
  if (diff_hours < 24) return `${diff_hours}h ago`;
  const diff_days = Math.floor(diff_hours / 24);
  if (diff_days < 30) return `${diff_days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format byte count into human-readable string (B, KB, MB, GB)
 */
function format_file_size_bytes(bytes) {
  const num_bytes = Number(bytes || 0);
  if (!num_bytes || num_bytes <= 0) return '0 B';
  if (num_bytes < 1024) return `${num_bytes} B`;
  if (num_bytes < 1024 * 1024) return `${(num_bytes / 1024).toFixed(1)} KB`;
  if (num_bytes < 1024 * 1024 * 1024) return `${(num_bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(num_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Resolve file category from MIME type or filename
 */
function resolve_file_category(file_type = '', file_name = '') {
  const mime = String(file_type || '').toLowerCase();
  const name = String(file_name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(name)) {
    return 'image';
  }
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(name)) {
    return 'audio';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('text') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('json') ||
    mime.includes('csv') ||
    /\.(pdf|txt|md|doc|docx|xls|xlsx|csv|json|ppt|pptx)$/.test(name)
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * LUMEN_board_list Component
 *
 * Workspace dashboard displayed when no board is currently selected or active.
 * Shows available boards from PostgreSQL owned by the user, search filter, new board creation,
 * template picker, and User Storage & Uploaded Files management section.
 */
export default function LUMEN_board_list({
  auth,
  on_select_board,
  on_create_board,
} = {}) {
  useSignals();
  const navigate = useNavigate();
  const [search_query, set_search_query] = useState('');
  const [confirm_delete_id, set_confirm_delete_id] = useState(null);
  const [deleting_id, set_deleting_id] = useState(null);

  // User Storage & Uploaded Files state
  const [storage_data, set_storage_data] = useState(null);
  const [is_storage_loading, set_is_storage_loading] = useState(false);
  const [is_storage_expanded, set_is_storage_expanded] = useState(true);
  const [file_search_query, set_file_search_query] = useState('');
  const [file_type_filter, set_file_type_filter] = useState('all'); // 'all' | 'image' | 'document' | 'media'
  const [confirm_delete_file_id, set_confirm_delete_file_id] = useState(null);
  const [deleting_file_id, set_deleting_file_id] = useState(null);

  // Multi-file selection & bulk deletion state
  const [selected_file_ids, set_selected_file_ids] = useState([]);
  const [confirm_bulk_delete, set_confirm_bulk_delete] = useState(false);
  const [is_bulk_deleting, set_is_bulk_deleting] = useState(false);

  // Files pagination state
  const [files_page, set_files_page] = useState(1);
  const [files_per_page, set_files_per_page] = useState(10);

  // AI Model Selector state on Board List
  const [is_ai_selector_expanded, set_is_ai_selector_expanded] = useState(true);
  const ai_task_routing = aiTaskRoutingSignal.value || {};

  const effective_auth = auth !== undefined ? auth : lumenAuthSignal.value;
  const owner_user_account = effective_auth?.user_account
    ? String(effective_auth.user_account).trim()
    : (currentUserSignal.value?.user_account ? String(currentUserSignal.value.user_account).trim() : null);

  const boards_list = boardsDirectorySignal.value || [];
  const is_loading = isBoardsDirectoryLoadingSignal.value;

  // Fetch authoritative storage usage, bandwidth usage, AI usage, and files list from server
  const handle_fetch_storage_data = async (show_toast_msg = false) => {
    set_is_storage_loading(true);
    try {
      const [data] = await Promise.all([
        api_get_storage_usage(owner_user_account || ''),
        fetch_bandwidth_usage('', owner_user_account || ''),
        fetch_ai_usage('', owner_user_account || ''),
      ]);
      if (data) {
        set_storage_data(data);
        if (show_toast_msg) {
          showToast('Synced user storage, bandwidth & AI usage');
        }
      }
    } catch (err) {
      console.warn('[LUMEN_board_list] Storage fetch error:', err);
    } finally {
      set_is_storage_loading(false);
    }
  };

  // Fetch authoritative boards list and user storage from PostgreSQL when workspace list mounts or user_account changes
  useEffect(() => {
    fetchBoardsFromServer(effective_auth);
    handle_fetch_storage_data(false);
  }, [owner_user_account]);

  // Map board_id -> board_title for quick lookup in file rows
  const board_title_map = {};
  for (const b of boards_list) {
    if (b) {
      const bid = b.id || b.board_code;
      if (bid) {
        board_title_map[bid] = b.title || b.board_name || 'Untitled Board';
      }
    }
  }

  // Filter boards to only boards owned by the user, and matching search query
  const owned_boards = owner_user_account
    ? boards_list.filter((b) => b && b.user_account === owner_user_account)
    : [];
  const trimmed_board_query = search_query.trim().toLowerCase();
  const filtered_boards = !trimmed_board_query
    ? owned_boards
    : owned_boards.filter((b) => {
        const title = (b.title || b.board_name || '').toLowerCase();
        const desc = (b.description || b.board_description || '').toLowerCase();
        const id = (b.id || b.board_code || '').toLowerCase();
        return (
          title.includes(trimmed_board_query) ||
          desc.includes(trimmed_board_query) ||
          id.includes(trimmed_board_query)
        );
      });

  // Process uploaded files list & filters
  const raw_files = Array.isArray(storage_data?.files) ? storage_data.files : [];
  const trimmed_file_query = file_search_query.trim().toLowerCase();

  let image_files_count = 0;
  let document_files_count = 0;
  let media_files_count = 0;

  for (const f of raw_files) {
    const cat = resolve_file_category(f.file_type, f.file_name);
    if (cat === 'image') image_files_count += 1;
    else if (cat === 'document') document_files_count += 1;
    else media_files_count += 1;
  }

  const filtered_files = raw_files.filter((file_item) => {
    const cat = resolve_file_category(file_item.file_type, file_item.file_name);
    if (file_type_filter === 'image' && cat !== 'image') return false;
    if (file_type_filter === 'document' && cat !== 'document') return false;
    if (file_type_filter === 'media' && (cat === 'image' || cat === 'document')) return false;

    if (!trimmed_file_query) return true;
    const f_name = String(file_item.file_name || '').toLowerCase();
    const f_type = String(file_item.file_type || '').toLowerCase();
    const f_id = String(file_item.file_storage_code || file_item.file_id || '').toLowerCase();
    const b_code = file_item.board_code || file_item.board_id;
    const b_title = String(board_title_map[b_code] || b_code || '').toLowerCase();
    return (
      f_name.includes(trimmed_file_query) ||
      f_type.includes(trimmed_file_query) ||
      f_id.includes(trimmed_file_query) ||
      b_title.includes(trimmed_file_query)
    );
  });

  // Reset pagination to page 1 when filter or search query or page size changes
  useEffect(() => {
    set_files_page(1);
  }, [file_type_filter, file_search_query, files_per_page]);

  // Prune selected_file_ids if files were removed from raw_files
  useEffect(() => {
    const existing_ids = new Set(raw_files.map((f) => f.file_storage_code || f.file_id));
    set_selected_file_ids((prev) => {
      const next = prev.filter((id) => existing_ids.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [raw_files]);

  // Pagination calculations
  const total_filtered_files = filtered_files.length;
  const total_files_pages = Math.max(1, Math.ceil(total_filtered_files / files_per_page));
  const safe_files_page = Math.min(Math.max(1, files_page), total_files_pages);
  const page_start_index = (safe_files_page - 1) * files_per_page;
  const page_end_index = Math.min(page_start_index + files_per_page, total_filtered_files);
  const paginated_files = filtered_files.slice(page_start_index, page_end_index);

  // Selection derived state
  const selected_id_set = new Set(selected_file_ids);
  const page_file_ids = paginated_files.map((f) => f.file_storage_code || f.file_id).filter(Boolean);
  const are_all_page_selected =
    page_file_ids.length > 0 && page_file_ids.every((id) => selected_id_set.has(id));
  const are_some_page_selected =
    page_file_ids.some((id) => selected_id_set.has(id)) && !are_all_page_selected;
  const are_all_filtered_selected =
    filtered_files.length > 0 && filtered_files.every((f) => selected_id_set.has(f.file_storage_code || f.file_id));
  const selected_files_list = raw_files.filter((f) => selected_id_set.has(f.file_storage_code || f.file_id));
  const selected_total_bytes = selected_files_list.reduce(
    (sum, f) => sum + Number(f.file_size || 0),
    0
  );

  // Toggle selection of a single file
  const handle_toggle_select_file = (e, file_id) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (!file_id) return;
    set_selected_file_ids((prev) => {
      const exists = prev.includes(file_id);
      const next = exists ? prev.filter((id) => id !== file_id) : [...prev, file_id];
      if (next.length === 0) {
        set_confirm_bulk_delete(false);
      }
      return next;
    });
  };

  // Toggle selection of all files on the current page
  const handle_toggle_select_page = () => {
    if (page_file_ids.length === 0) return;
    set_selected_file_ids((prev) => {
      const prev_set = new Set(prev);
      const all_page_in_prev = page_file_ids.every((id) => prev_set.has(id));
      let next;
      if (all_page_in_prev) {
        const page_set = new Set(page_file_ids);
        next = prev.filter((id) => !page_set.has(id));
      } else {
        for (const id of page_file_ids) {
          prev_set.add(id);
        }
        next = Array.from(prev_set);
      }
      if (next.length === 0) {
        set_confirm_bulk_delete(false);
      }
      return next;
    });
  };

  // Select all files matching current filter across all pages
  const handle_select_all_filtered = () => {
    const all_ids = filtered_files.map((f) => f.file_storage_code || f.file_id).filter(Boolean);
    set_selected_file_ids((prev) => {
      const merged = new Set([...prev, ...all_ids]);
      return Array.from(merged);
    });
  };

  // Clear all selected files
  const handle_clear_file_selection = () => {
    set_selected_file_ids([]);
    set_confirm_bulk_delete(false);
  };

  // Bulk delete selected files
  const handle_request_bulk_delete = () => {
    if (selected_file_ids.length === 0 || is_bulk_deleting) return;
    set_confirm_bulk_delete(true);
  };

  const handle_cancel_bulk_delete = () => {
    set_confirm_bulk_delete(false);
  };

  const handle_confirm_bulk_delete = async () => {
    if (selected_files_list.length === 0 || is_bulk_deleting) return;
    set_is_bulk_deleting(true);
    set_confirm_bulk_delete(false);

    const targets = [...selected_files_list];
    const deleted_ids = new Set();
    let deleted_bytes = 0;
    let fail_count = 0;

    try {
      for (const file_item of targets) {
        const target_file_id = file_item?.file_storage_code || file_item?.file_id;
        const target_board_id = file_item?.board_code || file_item?.board_id || '';
        if (!target_file_id) continue;
        try {
          const del_res = await api_delete_file(target_file_id, {
            board_id: target_board_id,
            file_name: file_item.file_name || '',
            user_account: owner_user_account || '',
          });

          await purgeDeletedFileFromBoards(
            target_file_id,
            target_board_id || null,
            file_item.file_name || '',
            del_res?.affected_board_ids || []
          );

          deleted_ids.add(target_file_id);
          deleted_bytes += Number(file_item.file_size || 0);
        } catch (file_err) {
          console.error('[LUMEN_board_list] Bulk delete item error:', target_file_id, file_err);
          fail_count += 1;
        }
      }

      if (deleted_ids.size > 0) {
        set_storage_data((prev) => {
          if (!prev) return prev;
          const next_files = (prev.files || []).filter(
            (f) => !deleted_ids.has(f.file_storage_code || f.file_id)
          );
          const next_used_bytes = Math.max(0, Number(prev.used_bytes || 0) - deleted_bytes);
          const limit_bytes = Number(prev.limit_bytes || 104857600);
          const next_remaining_bytes = Math.max(0, limit_bytes - next_used_bytes);
          const next_percent =
            limit_bytes > 0
              ? Math.min(100, Number(((next_used_bytes / limit_bytes) * 100).toFixed(2)))
              : 0;

          return {
            ...prev,
            used_bytes: next_used_bytes,
            remaining_bytes: next_remaining_bytes,
            used_mb: Number((next_used_bytes / 1024 ** 2).toFixed(2)),
            remaining_mb: Number((next_remaining_bytes / 1024 ** 2).toFixed(2)),
            percent: next_percent,
            total_files: next_files.length,
            files: next_files,
          };
        });

        set_selected_file_ids((prev) => prev.filter((id) => !deleted_ids.has(id)));
      }

      if (fail_count > 0) {
        showToast(`Deleted ${deleted_ids.size} files (${fail_count} failed)`);
      } else {
        showToast(
          `Deleted ${deleted_ids.size} file${deleted_ids.size === 1 ? '' : 's'} (${format_file_size_bytes(
            deleted_bytes
          )} freed)`
        );
      }

      handle_fetch_storage_data(false);
      fetchBoardsFromServer(effective_auth);
    } finally {
      set_is_bulk_deleting(false);
    }
  };

  // Open target board
  const handle_open_board = (target_id) => {
    if (!target_id) return;
    setActiveBoard(target_id);
    if (typeof on_select_board === 'function') {
      on_select_board(target_id);
    } else {
      navigate(`/board/${target_id}`);
    }
  };

  // Create new board
  const handle_create_new = async (type = 'snap_grid') => {
    const title = 'New Board';
    const new_id = createNewBoard(title, type);
    if (typeof on_select_board === 'function') {
      on_select_board(new_id);
    } else {
      navigate(`/board/${new_id}`);
    }
  };

  // Duplicate board
  const handle_duplicate = async (e, target_id) => {
    e.stopPropagation();
    if (typeof duplicateBoard === 'function') {
      await duplicateBoard(target_id);
    }
  };

  // Step 1: Prompt inline delete confirmation for board (no window.confirm)
  const handle_request_delete = (e, target_id) => {
    e.stopPropagation();
    set_confirm_delete_id(target_id);
  };

  // Step 2: Cancel inline delete confirmation for board
  const handle_cancel_delete = (e) => {
    e.stopPropagation();
    set_confirm_delete_id(null);
  };

  // Step 3: Execute board deletion on PostgreSQL and state
  const handle_confirm_delete = async (e, target_id, board_title) => {
    e.stopPropagation();
    if (!target_id || deleting_id === target_id) return;
    set_deleting_id(target_id);
    set_confirm_delete_id(null);
    try {
      await deleteBoard(target_id);
      showToast(`Deleted board "${board_title || 'Board'}"`);
    } catch (err) {
      console.error('[LUMEN_board_list] Delete error:', err);
      showToast('Failed to delete board');
    } finally {
      set_deleting_id(null);
    }
  };

  const handle_refresh_boards = async () => {
    await Promise.all([
      fetchBoardsFromServer(effective_auth),
      handle_fetch_storage_data(false),
    ]);
    showToast('Synced workspace boards and storage data');
  };

  // Preview a file in the modal viewer
  const handle_preview_file = (file_item) => {
    if (!file_item) return;
    const f_id = file_item.file_storage_code || file_item.file_id;
    const cat = resolve_file_category(file_item.file_type, file_item.file_name);
    const view_url = file_item.view_url || `/api/files/view/${f_id}`;
    const download_url = file_item.download_url || `/api/files/download/${f_id}`;

    if (cat === 'image') {
      openImageViewer({
        cardId: null,
        title: file_item.file_name || 'Image Preview',
        slides: [
          {
            id: f_id,
            url: view_url,
            caption: file_item.file_name || '',
          },
        ],
        activeIndex: 0,
        initialMode: 'fit',
      });
    } else {
      openFileViewerModal({
        cardId: null,
        fileName: file_item.file_name || 'File Preview',
        fileType: file_item.file_type || 'application/octet-stream',
        fileUrl: download_url,
        viewUrl: view_url,
        fileSize: Number(file_item.file_size || 0),
      });
    }
  };

  // Delete an uploaded file with inline confirmation
  const handle_request_delete_file = (e, file_id) => {
    e.stopPropagation();
    set_confirm_delete_file_id(file_id);
  };

  const handle_cancel_delete_file = (e) => {
    e.stopPropagation();
    set_confirm_delete_file_id(null);
  };

  const handle_confirm_delete_file = async (e, file_item) => {
    e.stopPropagation();
    const target_file_id = file_item?.file_storage_code || file_item?.file_id;
    const target_board_id = file_item?.board_code || file_item?.board_id || '';
    if (!target_file_id || deleting_file_id === target_file_id) return;

    set_deleting_file_id(target_file_id);
    set_confirm_delete_file_id(null);

    try {
      const del_res = await api_delete_file(target_file_id, {
        board_id: target_board_id,
        file_name: file_item.file_name || '',
        user_account: owner_user_account || '',
      });

      await purgeDeletedFileFromBoards(
        target_file_id,
        target_board_id || null,
        file_item.file_name || '',
        del_res?.affected_board_ids || []
      );

      // Optimistically update local storage state immediately
      set_storage_data((prev) => {
        if (!prev) return prev;
        const removed_size = Number(file_item.file_size || 0);
        const next_files = (prev.files || []).filter(
          (f) => (f.file_storage_code || f.file_id) !== target_file_id
        );
        const next_used_bytes = Math.max(0, Number(prev.used_bytes || 0) - removed_size);
        const limit_bytes = Number(prev.limit_bytes || 104857600);
        const next_remaining_bytes = Math.max(0, limit_bytes - next_used_bytes);
        const next_percent = limit_bytes > 0
          ? Math.min(100, Number(((next_used_bytes / limit_bytes) * 100).toFixed(2)))
          : 0;

        return {
          ...prev,
          used_bytes: next_used_bytes,
          remaining_bytes: next_remaining_bytes,
          used_mb: Number((next_used_bytes / (1024 ** 2)).toFixed(2)),
          remaining_mb: Number((next_remaining_bytes / (1024 ** 2)).toFixed(2)),
          percent: next_percent,
          total_files: next_files.length,
          files: next_files,
        };
      });

      set_selected_file_ids((prev) => prev.filter((id) => id !== target_file_id));

      showToast(`Deleted file "${file_item.file_name || target_file_id}"`);
      // Refresh authoritative stats and boards from server
      handle_fetch_storage_data(false);
      fetchBoardsFromServer(effective_auth);
    } catch (err) {
      console.error('[LUMEN_board_list] File delete error:', err);
      showToast(err.message || 'Failed to delete file');
    } finally {
      set_deleting_file_id(null);
    }
  };

  // Calculate storage bar metrics
  const used_bytes = Number(storage_data?.used_bytes || 0);
  const limit_bytes = Number(storage_data?.limit_bytes || 100 * 1024 * 1024);
  const remaining_bytes = Math.max(0, limit_bytes - used_bytes);
  const limit_mb = Number(storage_data?.limit_mb || 100);
  const used_percent = storage_data?.percent !== undefined
    ? Number(storage_data.percent)
    : (limit_bytes > 0 ? Math.min(100, Number(((used_bytes / limit_bytes) * 100).toFixed(2))) : 0);
  const visual_bar_width = used_bytes > 0 ? Math.max(1.2, Math.min(100, used_percent)) : 0;

  return (
    <div className={styles['lumen-board-list-container']}>
      <div className={styles['lumen-board-list-inner']}>
        {/* Header & Control Section */}
        <div className={styles['lumen-board-list-header']}>
          <div className={styles['lumen-board-list-title-zone']}>
            <div className={styles['lumen-board-list-heading-wrap']}>
              <h1 className={styles['lumen-board-list-title']}>
                <div className={styles['lumen-board-list-icon-badge']}>
                  <FolderKanban size={18} />
                </div>
                <span>Workspace Boards</span>
              </h1>
              <p className={styles['lumen-board-list-desc']}>
                Select a visual canvas board to open or start a new workspace.
              </p>
            </div>

            <div className={styles['lumen-board-list-actions']}>
              <button
                type="button"
                className={styles['lumen-board-btn-secondary']}
                onClick={handle_refresh_boards}
                disabled={is_loading || is_storage_loading}
                title="Refresh boards and storage from PostgreSQL database"
              >
                <RefreshCw
                  size={14}
                  className={is_loading || is_storage_loading ? styles['lumen-board-icon-spin'] : ''}
                />
                <span>{is_loading || is_storage_loading ? 'Syncing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                className={styles['lumen-board-btn-secondary']}
                onClick={() => (isTemplateModalOpenSignal.value = true)}
                title="Browse curated workspace templates"
              >
                <LayoutTemplate size={14} />
                <span>Templates</span>
              </button>

              <button
                type="button"
                className={styles['lumen-board-btn-primary']}
                onClick={() => handle_create_new('snap_grid')}
                title="Create a new Snap to Grid workspace board"
              >
                <Plus size={15} />
                <span>New Board</span>
              </button>
            </div>
          </div>

          {/* Search toolbar */}
          <div className={styles['lumen-board-list-toolbar']}>
            <div className={styles['lumen-board-search-wrap']}>
              <Search size={14} className={styles['lumen-board-search-icon']} />
              <input
                type="text"
                className={styles['lumen-board-search-input']}
                placeholder="Search boards by name, keyword, or tag..."
                value={search_query}
                onChange={(e) => set_search_query(e.target.value)}
              />
              {search_query && (
                <button
                  type="button"
                  className={styles['lumen-board-search-clear']}
                  onClick={() => set_search_query('')}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className={styles['lumen-board-list-count-text']}>
              {is_loading
                ? 'Loading database boards...'
                : `${filtered_boards.length} board${filtered_boards.length !== 1 ? 's' : ''} in database`}
            </div>
          </div>
        </div>

        {/* Boards Grid View */}
        <div className={styles['lumen-board-grid']}>
          {filtered_boards.length === 0 ? (
            <div className={styles['lumen-board-empty-state']}>
              <div className={styles['lumen-board-empty-icon']}>
                <FolderKanban size={24} />
              </div>
              <div className={styles['lumen-board-empty-title']}>
                {is_loading ? 'Loading boards...' : 'No boards found'}
              </div>
              <div className={styles['lumen-board-empty-text']}>
                {search_query
                  ? `No workspace boards match "${search_query}". Try another search term.`
                  : 'Your PostgreSQL database has no active boards yet. Create your first board to get started.'}
              </div>
              {search_query ? (
                <button
                  type="button"
                  className={styles['lumen-board-btn-secondary']}
                  onClick={() => set_search_query('')}
                >
                  Clear Search Filter
                </button>
              ) : (
                <button
                  type="button"
                  className={styles['lumen-board-btn-primary']}
                  onClick={() => handle_create_new('snap_grid')}
                >
                  <Plus size={14} />
                  <span>Create First Board</span>
                </button>
              )}
            </div>
          ) : (
            filtered_boards.map((board) => {
              const board_id = board.id || board.board_code;
              const board_title = board.title || board.board_name || 'Untitled Board';
              const board_desc = board.description || board.board_description || '';
              const b_type = board.boardType || board.board_type || 'snap_grid';
              const is_free = b_type === 'free_position';
              const card_count =
                board.cardCount !== undefined
                  ? board.cardCount
                  : (Array.isArray(board.cards) ? board.cards.length : 0);
              const updated_at =
                board.updatedAt ||
                board.time_modify ||
                board.time_modified ||
                board.time_create ||
                board.time_created;
              const is_confirming = confirm_delete_id === board_id;
              const is_deleting = deleting_id === board_id;
              const sharing = normalize_board_sharing(
                board.sharing || board.board_setting?.sharing
              );
              const is_public = sharing.visibility === 'public';
              const shared_users_count = Array.isArray(sharing.shared_users)
                ? sharing.shared_users.length
                : 0;

              return (
                <div
                  key={board_id}
                  className={styles['lumen-board-card']}
                  onClick={() => handle_open_board(board_id)}
                  title={`Open board: ${board_title}`}
                >
                  {/* Visual Banner Header */}
                  <div className={styles['lumen-board-card-banner']}>
                    <div className={styles['lumen-board-card-pattern']} />
                    <div className={styles['lumen-board-card-badge-wrap']}>
                      <span className={styles['lumen-board-card-type-badge']}>
                        {is_free ? <Move size={11} /> : <Grid size={11} />}
                        <span>{is_free ? 'Free Canvas' : '24px Grid'}</span>
                      </span>

                      <button
                        type="button"
                        className={`${styles['lumen-board-card-visibility-badge']} ${
                          is_public
                            ? styles['lumen-board-card-visibility-public']
                            : styles['lumen-board-card-visibility-private']
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openShareModal(board_id);
                        }}
                        title={
                          is_public
                            ? `Public (${sharing.public_role || 'viewer'}) — Click to manage sharing`
                            : 'Private (Restricted) — Click to share board'
                        }
                      >
                        {is_public ? <Globe size={11} /> : <Lock size={11} />}
                        <span>
                          {is_public
                            ? `Public (${sharing.public_role || 'viewer'})`
                            : 'Private'}
                        </span>
                        {shared_users_count > 0 && (
                          <span className={styles['lumen-board-card-shared-count']}>
                            <Users size={10} />
                            {shared_users_count}
                          </span>
                        )}
                      </button>
                    </div>

                    <div
                      className={styles['lumen-board-card-actions']}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {is_confirming ? (
                        <div className={styles['lumen-board-delete-confirm']}>
                          <span className={styles['lumen-board-delete-confirm-label']}>
                            Delete?
                          </span>
                          <button
                            type="button"
                            className={styles['lumen-board-delete-confirm-yes']}
                            onClick={(e) => handle_confirm_delete(e, board_id, board_title)}
                            disabled={is_deleting}
                            title="Confirm permanent deletion"
                          >
                            <Check size={12} />
                            <span>Yes</span>
                          </button>
                          <button
                            type="button"
                            className={styles['lumen-board-delete-confirm-no']}
                            onClick={handle_cancel_delete}
                            title="Cancel deletion"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles['lumen-board-card-action-btn']}
                            onClick={(e) => {
                              e.stopPropagation();
                              openShareModal(board_id);
                            }}
                            title="Share board (Private / Public)"
                          >
                            <Share2 size={13} />
                          </button>
                          {typeof duplicateBoard === 'function' && (
                            <button
                              type="button"
                              className={styles['lumen-board-card-action-btn']}
                              onClick={(e) => handle_duplicate(e, board_id)}
                              title="Duplicate board"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles['lumen-board-card-action-btn']} ${styles['lumen-board-card-action-delete']}`}
                            onClick={(e) => handle_request_delete(e, board_id)}
                            disabled={is_deleting}
                            title="Delete board"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className={styles['lumen-board-card-body']}>
                    <h2 className={styles['lumen-board-card-title']}>
                      {board_title}
                    </h2>
                    <p className={styles['lumen-board-card-desc']}>
                      {board_desc || 'No description provided. Click to open and edit cards.'}
                    </p>
                  </div>

                  {/* Footer Meta & Open Button */}
                  <div className={styles['lumen-board-card-footer']}>
                    <div className={styles['lumen-board-card-meta']}>
                      <span className={styles['lumen-board-card-count']}>
                        {card_count} {card_count === 1 ? 'card' : 'cards'}
                      </span>
                      <span>•</span>
                      <span>{format_relative_time(updated_at)}</span>
                    </div>

                    <button
                      type="button"
                      className={styles['lumen-board-card-btn-open']}
                      onClick={(e) => {
                        e.stopPropagation();
                        handle_open_board(board_id);
                      }}
                    >
                      <span>Open</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* AI Model Selector (Per-Task AI Routing) Section */}
        <section
          className={styles['lumen-ai-selector-section']}
          aria-label="AI Model Selector"
        >
          <div className={styles['lumen-ai-selector-header']}>
            <div className={styles['lumen-ai-selector-title-zone']}>
              <div className={styles['lumen-ai-selector-icon-badge']}>
                <Cpu size={16} />
              </div>
              <div className={styles['lumen-ai-selector-heading-wrap']}>
                <div className={styles['lumen-ai-selector-title-row']}>
                  <h2 className={styles['lumen-ai-selector-title']}>
                    AI Model Selector
                  </h2>
                  <span className={styles['lumen-ai-selector-count-pill']}>
                    {AI_AVAILABLE_MODELS.length} AI Models Available
                  </span>
                </div>
                <p className={styles['lumen-ai-selector-desc']}>
                  Select which AI model to use for each capability across your boards (e.g. Text Prompt: Gemini, Image Gen: Muse, Sound Transcribe: Gemini, Coding: Claude).
                </p>
              </div>
            </div>

            <div className={styles['lumen-ai-selector-actions']}>
              <div className={styles['lumen-ai-selector-preset-wrap']}>
                <label
                  htmlFor="lumen-board-list-ai-all-select"
                  className={styles['lumen-ai-selector-preset-label']}
                >
                  Apply to All:
                </label>
                <select
                  id="lumen-board-list-ai-all-select"
                  className={styles['lumen-ai-selector-preset-select']}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setAllAiTasksToModel(e.target.value);
                    }
                  }}
                >
                  <option value="" disabled>
                    Choose model for all...
                  </option>
                  {AI_AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.full_name})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className={styles['lumen-board-btn-secondary']}
                onClick={resetAiTaskRouting}
                title="Reset to recommended AI models per task (Text: Gemini, Image: Muse, Sound: Gemini, Coding: Claude)"
              >
                <RotateCcw size={13} />
                <span>Recommended Defaults</span>
              </button>

              <button
                type="button"
                className={styles['lumen-board-btn-secondary']}
                onClick={() => set_is_ai_selector_expanded((prev) => !prev)}
                title={is_ai_selector_expanded ? 'Collapse AI selector' : 'Expand AI selector'}
              >
                {is_ai_selector_expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{is_ai_selector_expanded ? 'Hide Selector' : 'Configure AI'}</span>
              </button>
            </div>
          </div>

          {/* Summary Pills when collapsed */}
          {!is_ai_selector_expanded && (
            <div className={styles['lumen-ai-selector-summary-bar']}>
              {AI_TASK_CATEGORIES.map((task) => {
                const selected_model = getAiModelById(
                  ai_task_routing[task.id] || task.default_model_id
                );
                return (
                  <div
                    key={task.id}
                    className={styles['lumen-ai-selector-summary-chip']}
                    onClick={() => set_is_ai_selector_expanded(true)}
                    title={`${task.label}: ${selected_model.full_name} — Click to change`}
                  >
                    <span className={styles['lumen-ai-selector-summary-task']}>
                      {task.short_label}:
                    </span>
                    <span
                      className={styles['lumen-ai-selector-summary-model']}
                      style={{
                        color: selected_model.color,
                        backgroundColor: selected_model.bgLight,
                        borderColor: selected_model.borderLight,
                      }}
                    >
                      {selected_model.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Interactive Per-Task AI Selector Grid */}
          {is_ai_selector_expanded && (
            <div className={styles['lumen-ai-selector-body']}>
              <div className={styles['lumen-ai-selector-grid']}>
                {AI_TASK_CATEGORIES.map((task) => {
                  const selected_model_id =
                    ai_task_routing[task.id] || task.default_model_id;
                  const selected_model = getAiModelById(selected_model_id);

                  const TaskIcon =
                    task.id === 'text_prompt'
                      ? Sparkles
                      : task.id === 'image_gen'
                      ? ImageIcon
                      : task.id === 'sound_transcribe'
                      ? Mic
                      : task.id === 'coding'
                      ? Code2
                      : task.id === 'market_data'
                      ? TrendingUp
                      : task.id === 'task_planning'
                      ? CheckSquare
                      : Globe;

                  return (
                    <div
                      key={task.id}
                      className={styles['lumen-ai-task-card']}
                    >
                      <div className={styles['lumen-ai-task-top']}>
                        <div className={styles['lumen-ai-task-label-wrap']}>
                          <span
                            className={styles['lumen-ai-task-icon']}
                            style={{
                              color: selected_model.color,
                              backgroundColor: selected_model.bgLight,
                            }}
                          >
                            <TaskIcon size={14} />
                          </span>
                          <span className={styles['lumen-ai-task-label']}>
                            {task.label}
                          </span>
                        </div>

                        <span
                          className={styles['lumen-ai-task-active-badge']}
                          style={{
                            color: selected_model.color,
                            backgroundColor: selected_model.bgLight,
                            borderColor: selected_model.borderLight,
                          }}
                        >
                          {selected_model.name}
                        </span>
                      </div>

                      <p className={styles['lumen-ai-task-desc']}>
                        {task.description}
                      </p>

                      <div className={styles['lumen-ai-task-select-wrap']}>
                        <select
                          aria-label={`Select AI model for ${task.label}`}
                          className={styles['lumen-ai-task-select']}
                          value={selected_model.id}
                          onChange={(e) =>
                            setSelectedAiModelForTask(task.id, e.target.value)
                          }
                        >
                          {AI_AVAILABLE_MODELS.map((model) => {
                            const is_recommended =
                              model.id === task.default_model_id;
                            return (
                              <option key={model.id} value={model.id}>
                                {model.name} — {model.full_name}
                                {is_recommended ? ' ★ Recommended' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className={styles['lumen-ai-task-model-meta']}>
                        <span className={styles['lumen-ai-task-provider-tag']}>
                          {selected_model.provider_name}
                        </span>
                        <span className={styles['lumen-ai-task-model-fullname']}>
                          {selected_model.full_name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complete Catalog Bar of All Currently Available AI Models */}
              <div className={styles['lumen-ai-models-catalog-bar']}>
                <span className={styles['lumen-ai-models-catalog-label']}>
                  Available AI Models ({AI_AVAILABLE_MODELS.length}):
                </span>
                <div className={styles['lumen-ai-models-catalog-list']}>
                  {AI_AVAILABLE_MODELS.map((model) => {
                    const active_tasks_for_model = AI_TASK_CATEGORIES.filter(
                      (t) =>
                        (ai_task_routing[t.id] || t.default_model_id) ===
                        model.id
                    );
                    const is_used = active_tasks_for_model.length > 0;
                    return (
                      <span
                        key={model.id}
                        className={`${styles['lumen-ai-model-catalog-pill']} ${
                          is_used ? styles['lumen-ai-model-catalog-pill-active'] : ''
                        }`}
                        style={
                          is_used
                            ? {
                                color: model.color,
                                backgroundColor: model.bgLight,
                                borderColor: model.borderLight,
                              }
                            : undefined
                        }
                        title={`${model.full_name}: ${model.description}${
                          is_used
                            ? ` (Active for: ${active_tasks_for_model
                                .map((t) => t.short_label)
                                .join(', ')})`
                            : ''
                        }`}
                      >
                        <span
                          className={styles['lumen-ai-model-dot']}
                          style={{ backgroundColor: model.color }}
                        />
                        <span>{model.name}</span>
                        {is_used && (
                          <span className={styles['lumen-ai-model-task-count']}>
                            {active_tasks_for_model.length}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* User Storage & Uploaded Files Management Section */}
        <section className={styles['lumen-storage-section']} aria-label="User Storage and Uploaded Files">
          <div className={styles['lumen-storage-header']}>
            <div className={styles['lumen-storage-title-zone']}>
              <div className={styles['lumen-storage-heading-wrap']}>
                <div className={styles['lumen-storage-title-row']}>
                  <div className={styles['lumen-storage-icon-badge']}>
                    <HardDrive size={17} />
                  </div>
                  <h2 className={styles['lumen-storage-title']}>
                    User Storage, Bandwidth, AI Usage & Uploaded Files
                  </h2>
                </div>
                <p className={styles['lumen-storage-desc']}>
                  Manage your storage quota, live monthly/daily bandwidth usage, AI token limits, and all uploaded files across your boards for account{' '}
                  <strong>@{storage_data?.owner_account || owner_user_account || 'user'}</strong>.
                </p>
              </div>

              <div className={styles['lumen-storage-header-actions']}>
                <button
                  type="button"
                  className={styles['lumen-board-btn-secondary']}
                  onClick={() => set_is_storage_expanded((prev) => !prev)}
                  title={is_storage_expanded ? 'Collapse file list' : 'Expand file list'}
                >
                  {is_storage_expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{is_storage_expanded ? 'Hide Files' : `Show Files (${raw_files.length})`}</span>
                </button>
              </div>
            </div>

            {/* Quota Summary Card */}
            <div className={styles['lumen-storage-quota-card']}>
              <div className={styles['lumen-storage-quota-top']}>
                <div className={styles['lumen-storage-quota-stats']}>
                  <span className={styles['lumen-storage-used-primary']}>
                    {format_file_size_bytes(used_bytes)}
                  </span>
                  <span className={styles['lumen-storage-used-secondary']}>
                    of {limit_mb} MB used ({used_percent}%)
                  </span>
                </div>

                <div className={styles['lumen-storage-quota-right']}>
                  <span className={styles['lumen-storage-free-badge']}>
                    {format_file_size_bytes(remaining_bytes)} available
                  </span>
                  <span className={styles['lumen-storage-files-count-badge']}>
                    <Database size={11} />
                    <span>
                      {raw_files.length} {raw_files.length === 1 ? 'file' : 'files'}
                    </span>
                  </span>
                </div>
              </div>

              <div className={styles['lumen-storage-progress-track']}>
                <div
                  className={`${styles['lumen-storage-progress-fill']} ${
                    used_percent >= 90
                      ? styles['lumen-storage-progress-fill-danger']
                      : used_percent >= 75
                      ? styles['lumen-storage-progress-fill-warn']
                      : ''
                  }`}
                  style={{ width: `${visual_bar_width}%` }}
                />
              </div>

              <div className={styles['lumen-storage-quota-footer']}>
                <div className={styles['lumen-storage-category-pills']}>
                  <span className={styles['lumen-storage-category-item']}>
                    <ImageIcon size={12} />
                    <span>{image_files_count} Images</span>
                  </span>
                  <span className={styles['lumen-storage-category-item']}>
                    <FileText size={12} />
                    <span>{document_files_count} Documents</span>
                  </span>
                  <span className={styles['lumen-storage-category-item']}>
                    <Film size={12} />
                    <span>{media_files_count} Media & Other</span>
                  </span>
                </div>

                {storage_data?.bucket && (
                  <div className={styles['lumen-storage-bucket-meta']}>
                    Bucket: <code>{storage_data.bucket}/{storage_data.starting_path || 'boardnote'}/{storage_data.owner_account || owner_user_account}</code>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Uploaded Files List */}
          {is_storage_expanded && (
            <div className={styles['lumen-storage-files-panel']}>
              {/* Files Filter, Search, Multi-Select & Bulk Action Toolbar */}
              <div className={styles['lumen-storage-files-toolbar']}>
                <div className={styles['lumen-storage-toolbar-top']}>
                  <div className={styles['lumen-storage-filter-tabs']}>
                    <button
                      type="button"
                      className={`${styles['lumen-storage-filter-tab']} ${
                        file_type_filter === 'all' ? styles['lumen-storage-filter-tab-active'] : ''
                      }`}
                      onClick={() => set_file_type_filter('all')}
                    >
                      All ({raw_files.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles['lumen-storage-filter-tab']} ${
                        file_type_filter === 'image' ? styles['lumen-storage-filter-tab-active'] : ''
                      }`}
                      onClick={() => set_file_type_filter('image')}
                    >
                      Images ({image_files_count})
                    </button>
                    <button
                      type="button"
                      className={`${styles['lumen-storage-filter-tab']} ${
                        file_type_filter === 'document' ? styles['lumen-storage-filter-tab-active'] : ''
                      }`}
                      onClick={() => set_file_type_filter('document')}
                    >
                      Documents ({document_files_count})
                    </button>
                    <button
                      type="button"
                      className={`${styles['lumen-storage-filter-tab']} ${
                        file_type_filter === 'media' ? styles['lumen-storage-filter-tab-active'] : ''
                      }`}
                      onClick={() => set_file_type_filter('media')}
                    >
                      Media / Other ({media_files_count})
                    </button>
                  </div>

                  <div className={styles['lumen-storage-toolbar-controls']}>
                    <div className={styles['lumen-storage-search-wrap']}>
                      <Search size={13} className={styles['lumen-board-search-icon']} />
                      <input
                        type="text"
                        className={styles['lumen-storage-search-input']}
                        placeholder="Filter files by name, type, or board..."
                        value={file_search_query}
                        onChange={(e) => set_file_search_query(e.target.value)}
                      />
                      {file_search_query && (
                        <button
                          type="button"
                          className={styles['lumen-board-search-clear']}
                          onClick={() => set_file_search_query('')}
                          title="Clear file search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className={styles['lumen-storage-per-page-wrap']}>
                      <label
                        htmlFor="lumen-files-per-page-select"
                        className={styles['lumen-storage-per-page-label']}
                      >
                        Show
                      </label>
                      <select
                        id="lumen-files-per-page-select"
                        className={styles['lumen-storage-per-page-select']}
                        value={files_per_page}
                        onChange={(e) => set_files_per_page(Number(e.target.value) || 10)}
                      >
                        <option value={10}>10 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Multi-File Selection & Bulk Delete Action Bar */}
                {filtered_files.length > 0 && (
                  <div
                    className={`${styles['lumen-storage-bulk-bar']} ${
                      selected_file_ids.length > 0 ? styles['lumen-storage-bulk-bar-active'] : ''
                    }`}
                  >
                    <div className={styles['lumen-storage-bulk-left']}>
                      <button
                        type="button"
                        className={`${styles['lumen-storage-checkbox-btn']} ${
                          are_all_page_selected
                            ? styles['lumen-storage-checkbox-checked']
                            : are_some_page_selected
                            ? styles['lumen-storage-checkbox-indeterminate']
                            : ''
                        }`}
                        onClick={handle_toggle_select_page}
                        disabled={is_bulk_deleting || paginated_files.length === 0}
                        title={
                          are_all_page_selected
                            ? 'Deselect all files on this page'
                            : 'Select all files on this page'
                        }
                      >
                        {are_all_page_selected ? (
                          <Check size={12} strokeWidth={3} />
                        ) : are_some_page_selected ? (
                          <span className={styles['lumen-storage-checkbox-dash']} />
                        ) : null}
                      </button>

                      <span
                        className={styles['lumen-storage-bulk-status']}
                        onClick={handle_toggle_select_page}
                      >
                        {selected_file_ids.length > 0 ? (
                          <>
                            <strong>{selected_file_ids.length}</strong> file
                            {selected_file_ids.length === 1 ? '' : 's'} selected (
                            <strong>{format_file_size_bytes(selected_total_bytes)}</strong>)
                          </>
                        ) : (
                          `Select page (${paginated_files.length} of ${total_filtered_files})`
                        )}
                      </span>

                      {total_filtered_files > paginated_files.length && !are_all_filtered_selected && (
                        <button
                          type="button"
                          className={styles['lumen-storage-bulk-link-btn']}
                          onClick={handle_select_all_filtered}
                          disabled={is_bulk_deleting}
                        >
                          Select all {total_filtered_files} files
                        </button>
                      )}

                      {selected_file_ids.length > 0 && (
                        <button
                          type="button"
                          className={styles['lumen-storage-bulk-link-btn']}
                          onClick={handle_clear_file_selection}
                          disabled={is_bulk_deleting}
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    <div className={styles['lumen-storage-bulk-right']}>
                      {selected_file_ids.length > 0 ? (
                        confirm_bulk_delete ? (
                          <div className={styles['lumen-storage-bulk-confirm']}>
                            <span className={styles['lumen-storage-bulk-confirm-text']}>
                              Delete {selected_file_ids.length} file
                              {selected_file_ids.length === 1 ? '' : 's'} (
                              {format_file_size_bytes(selected_total_bytes)}) permanently?
                            </span>
                            <button
                              type="button"
                              className={styles['lumen-board-delete-confirm-yes']}
                              onClick={handle_confirm_bulk_delete}
                              disabled={is_bulk_deleting}
                            >
                              <Check size={12} />
                              <span>
                                {is_bulk_deleting
                                  ? 'Deleting...'
                                  : `Yes, Delete (${selected_file_ids.length})`}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={styles['lumen-board-delete-confirm-no']}
                              onClick={handle_cancel_bulk_delete}
                              disabled={is_bulk_deleting}
                              title="Cancel bulk deletion"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles['lumen-storage-bulk-delete-btn']}
                            onClick={handle_request_bulk_delete}
                            disabled={is_bulk_deleting}
                            title="Delete all selected files from storage and boards"
                          >
                            <Trash2 size={13} />
                            <span>
                              {is_bulk_deleting
                                ? 'Deleting...'
                                : `Delete Selected (${selected_file_ids.length})`}
                            </span>
                          </button>
                        )
                      ) : (
                        <span className={styles['lumen-storage-bulk-hint']}>
                          Page {safe_files_page} of {total_files_pages}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Files List */}
              {filtered_files.length === 0 ? (
                <div className={styles['lumen-storage-files-empty']}>
                  <HardDrive size={22} />
                  <div className={styles['lumen-storage-files-empty-title']}>
                    {is_storage_loading
                      ? 'Loading uploaded files...'
                      : raw_files.length === 0
                      ? 'No uploaded files in your storage'
                      : 'No files match your current filter'}
                  </div>
                  <div className={styles['lumen-storage-files-empty-desc']}>
                    {raw_files.length === 0
                      ? 'Files and images uploaded to your boards will appear here with their size and storage location.'
                      : 'Try clearing the search query or switching to the "All" category tab.'}
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles['lumen-storage-files-list']}>
                    {paginated_files.map((file_item) => {
                      const file_id = file_item.file_storage_code || file_item.file_id;
                      const file_name = file_item.file_name || file_id;
                      const file_size = Number(file_item.file_size || 0);
                      const file_type = file_item.file_type || 'application/octet-stream';
                      const category = resolve_file_category(file_type, file_name);
                      const view_url = file_item.view_url || `/api/files/view/${file_id}`;
                      const download_url = file_item.download_url || `/api/files/download/${file_id}`;
                      const board_id = file_item.board_code || file_item.board_id || null;
                      const board_label = board_id
                        ? (board_title_map[board_id] || `Board ${String(board_id).slice(0, 8)}`)
                        : null;
                      const is_confirming_file = confirm_delete_file_id === file_id;
                      const is_deleting_file = deleting_file_id === file_id;
                      const is_file_selected = selected_id_set.has(file_id);
                      const ext_label = file_name.includes('.')
                        ? file_name.split('.').pop().toUpperCase().slice(0, 6)
                        : file_type.split('/').pop().toUpperCase().slice(0, 6);

                      return (
                        <div
                          key={file_id}
                          className={`${styles['lumen-storage-file-row']} ${
                            is_file_selected ? styles['lumen-storage-file-row-selected'] : ''
                          }`}
                        >
                          {/* Multi-Select Checkbox */}
                          <button
                            type="button"
                            className={`${styles['lumen-storage-checkbox-btn']} ${
                              is_file_selected ? styles['lumen-storage-checkbox-checked'] : ''
                            }`}
                            onClick={(e) => handle_toggle_select_file(e, file_id)}
                            disabled={is_bulk_deleting || is_deleting_file}
                            title={is_file_selected ? `Deselect ${file_name}` : `Select ${file_name}`}
                            aria-label={`Select ${file_name}`}
                          >
                            {is_file_selected ? <Check size={12} strokeWidth={3} /> : null}
                          </button>

                          {/* Thumbnail / File Type Icon */}
                          <div
                            className={styles['lumen-storage-file-thumb']}
                            onClick={() => handle_preview_file(file_item)}
                            title={`Preview ${file_name}`}
                          >
                            {category === 'image' ? (
                              <img
                                src={view_url}
                                alt={file_name}
                                loading="lazy"
                                className={styles['lumen-storage-file-thumb-img']}
                              />
                            ) : category === 'video' ? (
                              <Film size={18} />
                            ) : category === 'audio' ? (
                              <Music size={18} />
                            ) : category === 'document' ? (
                              <FileText size={18} />
                            ) : (
                              <File size={18} />
                            )}
                          </div>

                          {/* File Name & Metadata */}
                          <div className={styles['lumen-storage-file-info']}>
                            <div className={styles['lumen-storage-file-name-row']}>
                              <button
                                type="button"
                                className={styles['lumen-storage-file-name-btn']}
                                onClick={() => handle_preview_file(file_item)}
                                title={`Preview ${file_name}`}
                              >
                                {file_name}
                              </button>
                              <span className={styles['lumen-storage-file-ext-badge']}>
                                {ext_label || 'FILE'}
                              </span>
                            </div>

                            <div className={styles['lumen-storage-file-meta']}>
                              <span className={styles['lumen-storage-file-size']}>
                                {format_file_size_bytes(file_size)}
                              </span>
                              <span>•</span>
                              <span
                                className={styles['lumen-storage-file-bandwidth-stat']}
                                title="File bandwidth usage: Auto-load views + Direct downloads"
                              >
                                {Number(file_item.auto_load_count || 0)} views •{' '}
                                {Number(file_item.download_count || 0)} dls •{' '}
                                <strong>
                                  {format_file_size_bytes(
                                    file_item.total_egress_bytes !== undefined
                                      ? file_item.total_egress_bytes
                                      : Number(file_item.auto_load_byte || 0) + Number(file_item.download_byte || 0)
                                  )}
                                </strong>{' '}
                                egress
                              </span>
                              <span>•</span>
                              <span>{format_relative_time(file_item.time_create || file_item.time_created)}</span>
                              {board_id && (
                                <>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    className={styles['lumen-storage-file-board-link']}
                                    onClick={() => handle_open_board(board_id)}
                                    title={`Open board: ${board_label}`}
                                  >
                                    <FolderKanban size={11} />
                                    <span>{board_label}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* File Actions (Preview, Download, Delete) */}
                          <div className={styles['lumen-storage-file-actions']}>
                            {is_confirming_file ? (
                              <div className={styles['lumen-board-delete-confirm']}>
                                <span className={styles['lumen-board-delete-confirm-label']}>
                                  Delete file?
                                </span>
                                <button
                                  type="button"
                                  className={styles['lumen-board-delete-confirm-yes']}
                                  onClick={(e) => handle_confirm_delete_file(e, file_item)}
                                  disabled={is_deleting_file}
                                  title="Confirm permanent file deletion"
                                >
                                  <Check size={12} />
                                  <span>{is_deleting_file ? 'Deleting...' : 'Yes'}</span>
                                </button>
                                <button
                                  type="button"
                                  className={styles['lumen-board-delete-confirm-no']}
                                  onClick={handle_cancel_delete_file}
                                  title="Cancel deletion"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={styles['lumen-storage-file-action-btn']}
                                  onClick={() => handle_preview_file(file_item)}
                                  title="Preview file"
                                >
                                  <Eye size={14} />
                                </button>
                                <a
                                  href={download_url}
                                  download={file_name}
                                  className={styles['lumen-storage-file-action-btn']}
                                  title="Download file"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download size={14} />
                                </a>
                                <button
                                  type="button"
                                  className={`${styles['lumen-storage-file-action-btn']} ${styles['lumen-storage-file-action-delete']}`}
                                  onClick={(e) => handle_request_delete_file(e, file_id)}
                                  disabled={is_deleting_file}
                                  title="Delete file from storage"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Footer Bar */}
                  <div className={styles['lumen-storage-pagination']}>
                    <div className={styles['lumen-storage-pagination-info']}>
                      Showing <strong>{page_start_index + 1}</strong>–
                      <strong>{page_end_index}</strong> of{' '}
                      <strong>{total_filtered_files}</strong> file
                      {total_filtered_files === 1 ? '' : 's'}
                      {selected_file_ids.length > 0 && (
                        <span className={styles['lumen-storage-pagination-selected']}>
                          {' '}
                          • {selected_file_ids.length} selected
                        </span>
                      )}
                    </div>

                    <div className={styles['lumen-storage-pagination-controls']}>
                      <button
                        type="button"
                        className={styles['lumen-storage-page-btn']}
                        onClick={() => set_files_page(1)}
                        disabled={safe_files_page <= 1}
                        title="First page"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-storage-page-btn']}
                        onClick={() => set_files_page((p) => Math.max(1, p - 1))}
                        disabled={safe_files_page <= 1}
                        title="Previous page"
                      >
                        <ChevronLeft size={14} />
                        <span>Prev</span>
                      </button>

                      <div className={styles['lumen-storage-page-numbers']}>
                        {Array.from({ length: total_files_pages }, (_, idx) => idx + 1)
                          .filter((page_num) => {
                            if (total_files_pages <= 7) return true;
                            if (page_num === 1 || page_num === total_files_pages) return true;
                            return Math.abs(page_num - safe_files_page) <= 1;
                          })
                          .reduce((acc, page_num, idx, arr) => {
                            if (idx > 0 && page_num - arr[idx - 1] > 1) {
                              acc.push(`ellipsis-${page_num}`);
                            }
                            acc.push(page_num);
                            return acc;
                          }, [])
                          .map((item) =>
                            typeof item === 'string' ? (
                              <span key={item} className={styles['lumen-storage-page-ellipsis']}>
                                …
                              </span>
                            ) : (
                              <button
                                key={item}
                                type="button"
                                className={`${styles['lumen-storage-page-num-btn']} ${
                                  safe_files_page === item
                                    ? styles['lumen-storage-page-num-active']
                                    : ''
                                }`}
                                onClick={() => set_files_page(item)}
                              >
                                {item}
                              </button>
                            )
                          )}
                      </div>

                      <button
                        type="button"
                        className={styles['lumen-storage-page-btn']}
                        onClick={() => set_files_page((p) => Math.min(total_files_pages, p + 1))}
                        disabled={safe_files_page >= total_files_pages}
                        title="Next page"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-storage-page-btn']}
                        onClick={() => set_files_page(total_files_pages)}
                        disabled={safe_files_page >= total_files_pages}
                        title="Last page"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


