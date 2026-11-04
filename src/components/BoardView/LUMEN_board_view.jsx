import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSignals } from '@preact/signals-react/runtime';
import { Sliders, Lock, Eye, MessageSquare, ArrowLeft, AlertCircle } from 'lucide-react';
import loadable from '@loadable/component';

import styles from './LUMEN_board_view.module.css';

// Direct core components required for primary canvas view
import Header from './sub_components/Header/Header.jsx';
import Dock from './sub_components/Sidebar/Dock.jsx';
import Canvas from './sub_components/Canvas/Canvas.jsx';
import Toast from './sub_components/Modal/Toast.jsx';

// Lazy-loaded workspace modules via @loadable/component (Loaded on demand with seamless null fallback)
const Minimap = loadable(() => import('./sub_components/Minimap/Minimap.jsx'), {
  fallback: null,
});
const LUMEN_layer_panel = loadable(() => import('./sub_components/Sidebar/LUMEN_layer_panel.jsx'), {
  fallback: null,
});
const LUMEN_board_settings_panel = loadable(() => import('./sub_components/Sidebar/LUMEN_board_settings_panel.jsx'), {
  fallback: null,
});
const LUMEN_card_property_panel = loadable(() => import('./sub_components/Panel/LUMEN_card_property_panel.jsx'), {
  fallback: null,
});
const TemplateModal = loadable(() => import('./sub_components/Modal/TemplateModal.jsx'), {
  fallback: null,
});
const LUMEN_export_modal = loadable(() => import('./sub_components/Modal/LUMEN_export_modal.jsx'), {
  fallback: null,
});
const LUMEN_share_modal = loadable(() => import('./sub_components/Modal/LUMEN_share_modal.jsx'), {
  fallback: null,
});
const LUMEN_image_viewer_modal = loadable(() => import('./sub_components/Modal/LUMEN_image_viewer_modal.jsx'), {
  fallback: null,
});
const LUMEN_file_viewer_modal = loadable(() => import('./sub_components/Modal/LUMEN_file_viewer_modal.jsx'), {
  fallback: null,
});
const LUMEN_card_encryption_modal = loadable(() => import('./sub_components/Modal/LUMEN_card_encryption_modal.jsx'), {
  fallback: null,
});
const LUMEN_ai_error_modal = loadable(() => import('./sub_components/Modal/LUMEN_ai_error_modal.jsx'), {
  fallback: null,
});
const LUMEN_ai_board_assistant = loadable(() => import('./sub_components/AI/LUMEN_ai_board_assistant.jsx'), {
  fallback: null,
});
const LUMEN_card_comments_drawer = loadable(() => import('./sub_components/Comments/LUMEN_card_comments_drawer.jsx'), {
  fallback: null,
});
const LUMEN_activity_log_drawer = loadable(() => import('./sub_components/Activity/LUMEN_activity_log_drawer.jsx'), {
  fallback: null,
});
const LUMEN_board_list = loadable(() => import('./sub_components/BoardList/LUMEN_board_list.jsx'), {
  fallback: null,
});

// Built-in API server handlers & persistence fallbacks
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
} from './utils/lumenApi.js';

// Preact Signals State Architecture
import {
  activeBoardIdSignal,
  setActiveBoard,
  activeBoardSignal,
  selectedCardsSignal,
  snapToGridSignal,
  gridDimensionSignal,
  setGridDimension,
  applyBoardThemeToDocument,
  applyCardCornerStyleToDocument,
  isLayerPanelOpenSignal,
  isBoardSettingsPanelOpenSignal,
  isPropertyPanelOpenSignal,
  openPropertyPanel,
  isTemplateModalOpenSignal,
  isExportModalOpenSignal,
  isShareModalOpenSignal,
  boardAccessDeniedSignal,
  boardNotFoundSignal,
  resolve_board_access,
  imageViewerSignal,
  fileViewerModalSignal,
  isServerSyncingSignal,
} from './signals/boardState.js';
import { isAiPanelOpenSignal, aiErrorModalSignal } from './signals/aiState.js';
import { cardEncryptionModalSignal } from './signals/cardEncryptionState.js';
import {
  connectRealtimeBoard,
  activeCommentsCardIdSignal,
  isActivityDrawerOpenSignal,
  currentUserSignal,
  lumenAuthSignal,
  setLumenAuth,
} from './signals/realtimeState.js';

/**
 * LUMEN_board_view Component
 *
 * Full-featured spatial visual canvas workspace packaged as a plug-and-play npm component.
 *
 * Variable Props (State & Configuration):
 * - auth: (object) LUMEN user authentication state object.
 * - lumen_auth: (object) Alias for auth prop.
 * - board_id: (string) Target board ID. Falls back to router `:boardId` or activeBoardIdSignal.
 * - initial_board: (object) Optional initial board seed object.
 * - read_only: (boolean, default: false) If true, disables mutations, edits, and docking tools.

 * - show_header: (boolean, default: true) Whether top navigation header bar is rendered.
 * - show_dock: (boolean, default: true) Whether left tool dock is rendered.
 * - show_minimap: (boolean, default: true) Whether spatial minimap navigator is rendered.
 * - show_layers_panel: (boolean, optional) Explicit controlled override for layers panel.
 * - show_settings_panel: (boolean, optional) Explicit controlled override for board settings panel.
 * - show_property_panel: (boolean, optional) Explicit controlled override for card property panel.
 * - show_ai_assistant: (boolean, optional) Explicit controlled override for AI assistant drawer.
 * - current_user: (object) Current user profile { id, name, role, avatar, color }.
 * - collaborators: (array) Custom collaborator profiles list.
 * - snap_to_grid: (boolean) Enforces 24px spatial grid alignment.
 * - class_name: (string) Additional CSS class name for container.
 * - style: (object) Inline styles for outer container.
 *
 * API Server Function Props (Callbacks & Handlers):
 * - on_upload_file: (file: File, meta?: Object) => Promise<Object>: Handles file upload to server / storage.
 * - on_create_board: (title?: string, type?: string) => Promise<Object>: Handles board creation on server.
 * - on_export: (export_type: string, board_data: Object, options?: Object) => Promise<Object>: Handles export.
 * - on_share: (board_id: string, share_config: Object) => Promise<Object>: Handles board sharing.
 * - on_save: (board_id: string, board_data: Object) => Promise<Object>: Handles board save/persistence.
 * - on_load_board: (board_id: string) => Promise<Object>: Handles loading board from server.
 * - on_post_comment: (card_id: string, payload: Object) => Promise<Object>: Handles posting comments.
 * - on_delete_comment: (card_id: string, comment_id: string) => Promise<Object>: Handles deleting comments.
 * - on_ask_ai: (board_data: Object, prompt: string) => Promise<Object>: Handles querying board AI.
 * - on_navigate_board: (target_board_id: string) => void: Triggered when switching boards.
 * - on_board_change: (board_data: Object) => void: Triggered on board modifications.
 * - on_card_select: (selected_card_ids: Array) => void: Triggered when card selection changes.
 */
export default function LUMEN_board_view({
  // Variable Props (State & Configuration)
  auth,
  lumen_auth,
  board_id,
  initial_board,
  read_only = false,
  show_header = true,
  show_dock = true,
  show_minimap = true,
  show_layers_panel,
  show_settings_panel,
  show_property_panel,
  show_ai_assistant,
  current_user,
  collaborators,
  snap_to_grid,
  grid_dimension,
  class_name = '',
  style = {},

  // API Server & Action Function Props (With fallback to built-in API helpers)
  on_upload_file,
  on_create_board,
  on_export,
  on_share,
  on_save,
  on_load_board,
  on_post_comment,
  on_delete_comment,
  on_ask_ai,
  on_navigate_board,
  on_board_change,
  on_card_select,
} = {}) {
  useSignals();

  // Resolve API handlers: user passed prop OR default built-in server API
  const handle_upload = on_upload_file || api_upload_file;
  const handle_create = on_create_board || api_create_new_board;
  const handle_export = on_export || api_export_board;
  const handle_share = on_share || api_share_board;
  const handle_save = on_save || api_save_board;
  const handle_load = on_load_board || api_load_board;
  const handle_post_comment = on_post_comment || api_post_comment;
  const handle_delete_comment = on_delete_comment || api_delete_comment;
  const handle_ask_ai = on_ask_ai || api_ask_ai;

  // Safely read route parameters and navigate with fallback if used outside React Router
  let route_params = {};
  let navigate = null;
  try {
    route_params = useParams() || {};
    navigate = useNavigate();
  } catch (e) {
    route_params = {};
  }

  const search_board = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('board') ||
       new URLSearchParams(window.location.search).get('board_id') ||
       (window.location.hash.match(/board[=/]([a-zA-Z0-9_-]+)/)?.[1]))
    : null;

  const raw_board_id =
    board_id !== undefined
      ? board_id
      : (route_params?.boardId || search_board || activeBoardIdSignal.value || null);

  const effective_board_id =
    raw_board_id && raw_board_id !== 'null' && raw_board_id !== 'undefined'
      ? raw_board_id
      : null;

  const effective_auth = auth !== undefined ? auth : lumen_auth;
  if (effective_auth && lumenAuthSignal.value !== effective_auth) {
    setLumenAuth(effective_auth);
  }

  // Sync LUMEN user auth state into signals & active user identity
  useEffect(() => {
    if (effective_auth) {
      setLumenAuth(effective_auth);
    }
  }, [effective_auth]);

  // Sync board ID & connect real-time synchronization
  useEffect(() => {
    if (effective_board_id) {
      setActiveBoard(effective_board_id);
      connectRealtimeBoard(effective_board_id);
    } else {
      setActiveBoard(null);
    }
  }, [effective_board_id]);

  // Sync initial board payload if supplied
  useEffect(() => {
    if (initial_board && initial_board.id) {
      activeBoardSignal.value = initial_board;
    }
  }, [initial_board]);

  // Sync current user profile if supplied
  useEffect(() => {
    if (current_user && typeof current_user === 'object' && current_user.id) {
      currentUserSignal.value = current_user;
    }
  }, [current_user]);

  // Sync snap to grid preference if supplied
  useEffect(() => {
    if (typeof snap_to_grid === 'boolean') {
      snapToGridSignal.value = snap_to_grid;
    }
  }, [snap_to_grid]);

  // Sync grid dimension preference if supplied
  useEffect(() => {
    if (typeof grid_dimension === 'number' && grid_dimension >= 1) {
      setGridDimension(grid_dimension);
    }
  }, [grid_dimension]);

  // Synchronize active board theme and card corner style to document custom properties
  useEffect(() => {
    const board = activeBoardSignal.value;
    if (board && board.board_setting) {
      if (board.board_setting.color_theme) {
        applyBoardThemeToDocument(board.board_setting.color_theme);
      }
      if (board.board_setting.card_corner_style) {
        applyCardCornerStyleToDocument(board.board_setting.card_corner_style);
      }
    }
  }, [activeBoardSignal.value?.board_setting?.color_theme, activeBoardSignal.value?.board_setting?.card_corner_style]);

  // Notify parent on board data mutations
  useEffect(() => {
    if (typeof on_board_change === 'function') {
      on_board_change(activeBoardSignal.value);
    }
  }, [activeBoardSignal.value, on_board_change]);

  // Notify parent on card selection changes
  useEffect(() => {
    if (typeof on_card_select === 'function') {
      on_card_select(selectedCardsSignal.value);
    }
  }, [selectedCardsSignal.value, on_card_select]);

  // Don't auto show card property on mobile and small screen size (width <= 1024px)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 1024 && isPropertyPanelOpenSignal.value) {
        isPropertyPanelOpenSignal.value = false;
      }
      const handle_resize = () => {
        if (window.innerWidth <= 1024 && isPropertyPanelOpenSignal.value) {
          isPropertyPanelOpenSignal.value = false;
        }
      };
      window.addEventListener('resize', handle_resize);
      return () => window.removeEventListener('resize', handle_resize);
    }
  }, []);

  // Resolve panel visibility (controlled prop has priority over internal signal)
  const is_layers_visible =
    show_layers_panel !== undefined ? show_layers_panel : isLayerPanelOpenSignal.value;
  const is_settings_visible =
    show_settings_panel !== undefined ? show_settings_panel : isBoardSettingsPanelOpenSignal.value;
  const is_property_visible =
    show_property_panel !== undefined ? show_property_panel : isPropertyPanelOpenSignal.value;
  const is_ai_visible =
    show_ai_assistant !== undefined ? show_ai_assistant : isAiPanelOpenSignal.value;

  const active_board = activeBoardSignal.value;
  const user_acc_str = effective_auth?.user_account || (typeof effective_auth === 'string' ? effective_auth : null);
  const user_email_str = effective_auth?.user_primary_email || null;
  const is_board_matched = Boolean(
    active_board && (
      active_board.id === effective_board_id ||
      active_board.board_code === effective_board_id ||
      active_board.board_uuid === effective_board_id
    )
  );
  const active_access = is_board_matched
    ? (active_board.user_access || resolve_board_access(active_board, user_acc_str, user_email_str))
    : null;
  const effective_read_only = Boolean(
    read_only || (active_access && active_access.allowed && !active_access.can_edit)
  );
  const access_denied_info =
    boardAccessDeniedSignal.value &&
    (boardAccessDeniedSignal.value.board_id === effective_board_id ||
     boardAccessDeniedSignal.value.boardId === effective_board_id)
      ? boardAccessDeniedSignal.value
      : null;
  const not_found_info =
    boardNotFoundSignal.value &&
    (boardNotFoundSignal.value.board_id === effective_board_id ||
     boardNotFoundSignal.value.boardId === effective_board_id)
      ? boardNotFoundSignal.value
      : null;

  const handle_back_to_boards = () => {
    boardAccessDeniedSignal.value = null;
    boardNotFoundSignal.value = null;
    setActiveBoard(null);
    if (typeof on_navigate_board === 'function') {
      on_navigate_board(null);
    } else if (typeof navigate === 'function') {
      navigate('/boards');
    }
  };

  const root_classes = `${styles['lumen-board-view'] || styles.lumenBoardView} ${class_name}`.trim();
  const workspace_classes = show_header
    ? (styles['lumen-board-workspace'] || styles.lumenBoardWorkspace)
    : (styles['lumen-board-workspace-no-header'] || styles.lumenBoardWorkspaceNoHeader);

  return (
    <div className={root_classes} style={style}>
      {show_header && (
        <Header
          auth={effective_auth}
          on_create_board={handle_create}
          on_save={handle_save}
          on_navigate_board={on_navigate_board}
          read_only={effective_read_only}
        />
      )}

      <div className={workspace_classes}>
        {effective_board_id ? (
          access_denied_info ? (
            <div className={styles['lumen-access-denied-screen'] || styles.lumenAccessDeniedScreen}>
              <div className={styles['lumen-access-denied-card'] || styles.lumenAccessDeniedCard}>
                <div className={styles['lumen-access-denied-icon'] || styles.lumenAccessDeniedIcon}>
                  <Lock size={24} />
                </div>
                <h2 className={styles['lumen-access-denied-title'] || styles.lumenAccessDeniedTitle}>
                  You need access
                </h2>
                <p className={styles['lumen-access-denied-desc'] || styles.lumenAccessDeniedDesc}>
                  <strong>{access_denied_info.board_name || 'This board'}</strong> is set to{' '}
                  <strong>Private (Restricted)</strong>. Only the board owner
                  {access_denied_info.owner_account ? ` (@${access_denied_info.owner_account})` : ''} and invited collaborators can open it.
                </p>
                <div className={styles['lumen-access-denied-actions'] || styles.lumenAccessDeniedActions}>
                  <button
                    type="button"
                    className={styles['lumen-access-denied-btn'] || styles.lumenAccessDeniedBtn}
                    onClick={handle_back_to_boards}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Workspace Boards</span>
                  </button>
                </div>
              </div>
            </div>
          ) : not_found_info ? (
            <div className={styles['lumen-access-denied-screen'] || styles.lumenAccessDeniedScreen}>
              <div className={styles['lumen-access-denied-card'] || styles.lumenAccessDeniedCard}>
                <div className={styles['lumen-access-denied-icon'] || styles.lumenAccessDeniedIcon}>
                  <AlertCircle size={24} color="#e11d48" />
                </div>
                <h2 className={styles['lumen-access-denied-title'] || styles.lumenAccessDeniedTitle}>
                  Board Not Found
                </h2>
                <p className={styles['lumen-access-denied-desc'] || styles.lumenAccessDeniedDesc}>
                  The requested board (ID: <code>{effective_board_id}</code>) could not be found. It may have been deleted, or the shared link was entered incorrectly.
                </p>
                <div className={styles['lumen-access-denied-actions'] || styles.lumenAccessDeniedActions}>
                  <button
                    type="button"
                    className={styles['lumen-access-denied-btn'] || styles.lumenAccessDeniedBtn}
                    onClick={handle_back_to_boards}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Workspace Boards</span>
                  </button>
                </div>
              </div>
            </div>
          ) : is_board_matched ? (
            <>
              {active_access && !active_access.is_owner && !active_access.can_edit && (
                <div className={styles['lumen-shared-role-banner'] || styles.lumenSharedRoleBanner}>
                  {active_access.role === 'commenter' ? <MessageSquare size={13} /> : <Eye size={13} />}
                  <span>
                    Shared Mode: <strong>{active_access.role === 'commenter' ? 'Commenter' : 'View Only'}</strong>
                  </span>
                </div>
              )}
              {show_dock && <Dock read_only={effective_read_only} />}
              <Canvas readOnly={effective_read_only} on_upload_file={handle_upload} />
              {is_layers_visible && <LUMEN_layer_panel />}
              {is_settings_visible && <LUMEN_board_settings_panel />}
              {show_minimap && <Minimap />}
              {is_property_visible && <LUMEN_card_property_panel />}

              {/* Card Property Button on the right side */}
              {!is_property_visible && (
                <button
                  type="button"
                  className={styles['lumen-right-property-toggle-btn'] || styles.lumenRightPropertyToggleBtn}
                  onClick={() => {
                    if (selectedCardsSignal.value.length === 0) {
                      const first_card = activeBoardSignal.value?.cards?.[0];
                      if (first_card) {
                        selectedCardsSignal.value = [first_card.id];
                      }
                    }
                    openPropertyPanel(true);
                  }}
                  title={
                    selectedCardsSignal.value.length > 0
                      ? `Open Card Properties (${selectedCardsSignal.value.length} selected)`
                      : "Open Card Properties"
                  }
                  aria-label="Open Card Properties"
                >
                  <Sliders size={15} />
                  <span className={styles['lumen-right-property-label'] || styles.lumenRightPropertyLabel}>
                    Properties
                  </span>
                  {selectedCardsSignal.value.length > 0 && (
                    <span className={styles['lumen-right-property-badge'] || styles.lumenRightPropertyBadge}>
                      {selectedCardsSignal.value.length}
                    </span>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className={styles['lumen-board-view-loader'] || styles.lumenBoardViewLoader}>
              <div className={styles['lumen-board-spinner'] || styles.lumenBoardSpinner} />
              <span>Loading workspace board...</span>
            </div>
          )
        ) : (
          <LUMEN_board_list
            auth={effective_auth}
            on_select_board={on_navigate_board}
            on_create_board={handle_create}
          />
        )}
      </div>

      {/* Heavy modals & drawers lazyloaded on demand via @loadable/component */}
      {!effective_read_only && isTemplateModalOpenSignal.value && <TemplateModal />}
      {effective_board_id && isExportModalOpenSignal.value && <LUMEN_export_modal on_export={handle_export} />}
      {isShareModalOpenSignal.value && <LUMEN_share_modal on_share={handle_share} />}
      {cardEncryptionModalSignal.value?.is_open && <LUMEN_card_encryption_modal />}
      {aiErrorModalSignal.value?.is_open && <LUMEN_ai_error_modal />}
      <Toast />
      {imageViewerSignal.value?.isOpen && <LUMEN_image_viewer_modal />}
      {fileViewerModalSignal.value?.isOpen && <LUMEN_file_viewer_modal />}
      {effective_board_id && is_ai_visible && <LUMEN_ai_board_assistant on_ask_ai={handle_ask_ai} />}
      {effective_board_id && Boolean(activeCommentsCardIdSignal.value) && (
        <LUMEN_card_comments_drawer
          on_post_comment={handle_post_comment}
          on_delete_comment={handle_delete_comment}
        />
      )}
      {isActivityDrawerOpenSignal.value && <LUMEN_activity_log_drawer />}
    </div>
  );
}

// Named alias export for backward compatibility
export { LUMEN_board_view as BoardView };
