/**
 * Lumen Board View - Spatial Visual Canvas Workspace
 * Plug-and-play npm module component
 *
 * @module @lumen/board-view
 */

import LUMEN_board_view, { BoardView } from './LUMEN_board_view.jsx';

export default LUMEN_board_view;
export { LUMEN_board_view, BoardView };

// Export Signals for external programmatic access if needed
export {
  activeBoardSignal,
  activeBoardIdSignal,
  selectedCardsSignal,
  setActiveBoard,
  createNewBoard,
  updateCard,
  deleteCard,
  duplicateCard,
  bringToFront,
  sendToBack,
  showToast,
  toggleCardPropertyPanel,
  gridDimensionSignal,
  setGridDimension,
  updateBoardSetting,
  BOARD_THEMES,
  applyBoardThemeToDocument,
  applyCardCornerStyleToDocument,
} from './signals/boardState.js';

export {
  currentUserSignal,
  activeUsersSignal,
  isWsConnectedSignal,
  lumenAuthSignal,
  setLumenAuth,
} from './signals/realtimeState.js';

// Export API helpers
export {
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
