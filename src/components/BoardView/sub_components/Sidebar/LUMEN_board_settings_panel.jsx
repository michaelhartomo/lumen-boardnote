import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import { useNavigate } from 'react-router';
import {
  Settings,
  X,
  Trash2,
  RotateCcw,
  Palette,
  Grid,
  FileText,
  Layers,
  Sparkles,
  Check,
  RefreshCw,
  HardDrive,
  Database,
  Cloud,
  History,
  Sun,
  Moon,
  Lock,
  Globe,
  Share2,
  AlertTriangle,
  Search,
  Eraser,
  Copy,
  Download,
  Upload,
  FileCode,
} from 'lucide-react';
import {
  toggleActivityDrawer,
  activityLogsSignal,
  get_lumen_auth_headers,
} from '../../signals/realtimeState.js';
import styles from './LUMEN_board_settings_panel.module.css';
import {
  activeBoardSignal,
  setActiveBoard,
  boardsDirectorySignal,
  snapToGridSignal,
  showGridDotsSignal,
  gridDimensionSignal,
  setGridDimension,
  updateBoardSetting,
  BOARD_THEMES,
  applyBoardThemeToDocument,
  applyCardCornerStyleToDocument,
  applyCardStyleToDocument,
  closeBoardSettingsPanel,
  showToast,
  saveCurrentBoardToStore,
  clearBoard,
  clearDrawingStrokes,
  deleteBoard,
  duplicateBoard,
  downloadBoardConfigurationJson,
  copyBoardConfigurationJson,
  createBoardFromExportConfig,
  lastServerSyncTimeSignal,
  isServerSyncingSignal,
  serverSyncStatusSignal,
  boardSizeBytesSignal,
  forceSyncCurrentBoard,
  openShareModal,
  normalize_board_sharing,
  FREE_COMMERCIAL_GOOGLE_FONTS,
  googleFontsCatalogSignal,
  ensure_all_google_fonts_loaded,
  search_google_fonts,
  load_google_font,
  get_google_font_css_stack,
  applyBoardFontToDocument,
} from '../../signals/boardState.js';
import { format_board_size } from '../../lib/lumenIndexedDb.js';

const CARD_COLOR_PRESETS = [
  { id: 'yellow', name: 'Yellow', bg: '#fef9c3', border: '#fef08a' },
  { id: 'white', name: 'White', bg: '#ffffff', border: '#e2e8f0' },
  { id: 'slate', name: 'Slate', bg: '#f1f5f9', border: '#cbd5e1' },
  { id: 'peach', name: 'Peach', bg: '#ffedd5', border: '#fed7aa' },
  { id: 'mint', name: 'Mint', bg: '#dcfce7', border: '#bbf7d0' },
  { id: 'lavender', name: 'Lavender', bg: '#f3e8ff', border: '#e9d5ff' },
  { id: 'rose', name: 'Rose', bg: '#ffe4e6', border: '#fecdd3' },
  { id: 'sky', name: 'Sky', bg: '#e0f2fe', border: '#bae6fd' },
];

const GRID_STYLE_OPTIONS = [
  { id: 'dots', label: 'Dots', hint: 'Dot Matrix' },
  { id: 'lines', label: 'Lines', hint: 'Graph Grid' },
  { id: 'crosses', label: 'Crosses', hint: 'Technical' },
  { id: 'none', label: 'Clean', hint: 'No Pattern' },
];

const CARD_STYLE_OPTIONS = [
  {
    id: 'full',
    label: 'Full',
    hint: 'Current card style with header bar, quick toolbar, and action buttons',
  },
  {
    id: 'seamless',
    label: 'Seamless',
    hint: 'True card content only with minimal border to move card and open card panel',
  },
];

const CORNER_STYLE_OPTIONS = [
  { id: 'rounded', label: 'Rounded (10px)' },
  { id: 'sharp', label: 'Sharp (3px)' },
  { id: 'soft', label: 'Soft (16px)' },
];

const DRAG_DROP_IMAGES_OPTIONS = [
  {
    id: 'carousel',
    label: 'Image Carousel',
    hint: 'Combine multiple dropped images into a single carousel card',
  },
  {
    id: 'each_card',
    label: 'Each Image Card',
    hint: 'Each dropped image gets its own card on the board for an easy bird view',
  },
];

export function LUMEN_board_settings_panel() {
  useSignals();
  const navigate = useNavigate();
  const [confirm_modal_mode, set_confirm_modal_mode] = useState(null); // null | 'clear_cards' | 'delete_board'
  const [confirm_input_text, set_confirm_input_text] = useState('');
  const [board_font_search, set_board_font_search] = useState('');
  const [is_duplicating, set_is_duplicating] = useState(false);
  const [copied_config, set_copied_config] = useState(false);
  const [show_import_paste, set_show_import_paste] = useState(false);
  const [import_json_text, set_import_json_text] = useState('');
  const config_file_input_ref = useRef(null);

  useEffect(() => {
    ensure_all_google_fonts_loaded();
  }, []);

  const all_commercial_fonts = googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS;
  const filtered_board_fonts = search_google_fonts(board_font_search, 'all');
  const active_board = activeBoardSignal.value || {};
  const current_grid_dim = gridDimensionSignal.value || 24;
  const board_settings = active_board.board_setting || {};

  const current_theme_id = board_settings.color_theme || 'default';
  const current_description = board_settings.description !== undefined
    ? board_settings.description
    : (active_board.description || '');
  const current_grid_style = board_settings.grid_style || 'dots';
  const current_card_style = board_settings.card_style === 'seamless' ? 'seamless' : 'full';
  const current_corner_style = board_settings.card_corner_style || 'rounded';
  const current_card_color = board_settings.default_card_color || (active_board.boardType === 'snap_grid' ? 'yellow' : 'peach');
  const current_show_shadows = board_settings.show_card_shadows !== false;
  const current_drag_drop_images_action =
    board_settings.drag_drop_images_action === 'each_card' ||
    board_settings.drag_drop_images_action === 'separate_cards'
      ? 'each_card'
      : 'carousel';

  const last_sync_time = lastServerSyncTimeSignal.value;
  const is_syncing = isServerSyncingSignal.value;
  const sync_status = serverSyncStatusSignal.value;
  const board_size_bytes = boardSizeBytesSignal.value || 0;
  const formatted_size = format_board_size(board_size_bytes);
  const is_large_board = board_size_bytes > 800000;

  // Periodic tick for live relative time display
  const [, set_tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => set_tick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const format_last_sync = (ts) => {
    if (!ts) return 'Pending initial sync';
    const diff = Date.now() - ts;
    const time_str = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (diff < 5000) return `Just now (${time_str})`;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago (${time_str})`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago (${time_str})`;
    return `${new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time_str}`;
  };

  const handle_force_sync = async () => {
    if (is_syncing) return;
    await forceSyncCurrentBoard();
  };

  const handle_title_change = (e) => {
    const next_title = e.target.value;
    const current_id = activeBoardSignal.value?.id;
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      title: next_title,
      board_name: next_title,
      updatedAt: Date.now(),
    };
    if (current_id && Array.isArray(boardsDirectorySignal.value)) {
      const next_list = boardsDirectorySignal.value.map((b) =>
        (b.id || b.board_code) === current_id
          ? { ...b, title: next_title, board_name: next_title, updatedAt: Date.now() }
          : b
      );
      boardsDirectorySignal.value = next_list;
    }
    saveCurrentBoardToStore();
  };

  const handle_title_blur = () => {
    saveCurrentBoardToStore({ immediate: true });
  };

  const handle_description_change = (e) => {
    updateBoardSetting('description', e.target.value);
  };

  const handle_description_blur = () => {
    saveCurrentBoardToStore({ immediate: true });
  };

  const handle_theme_select = (theme_id) => {
    updateBoardSetting('color_theme', theme_id);
    showToast(`Canvas theme: ${BOARD_THEMES[theme_id]?.name || theme_id}`);
  };

  const handle_grid_style_select = (style_id) => {
    updateBoardSetting('grid_style', style_id);
    showToast(`Canvas grid pattern: ${style_id}`);
  };

  const handle_card_style_select = (style_id) => {
    applyCardStyleToDocument(style_id);
    updateBoardSetting('card_style', style_id);
    showToast(
      style_id === 'seamless'
        ? 'Board default card style: Seamless (Content only with minimal border)'
        : 'Board default card style: Full (Standard card controls)'
    );
  };

  const overridden_cards_count = (active_board?.cards || []).filter(
    (c) => c.card_style === 'full' || c.card_style === 'seamless'
  ).length;

  const handle_reset_card_style_overrides = () => {
    if (!active_board || !Array.isArray(active_board.cards)) return;
    const next_cards = active_board.cards.map((c) => {
      if (!c.card_style) return c;
      const copy = { ...c };
      delete copy.card_style;
      return copy;
    });
    setActiveBoard({ ...active_board, cards: next_cards });
    saveCurrentBoardToStore();
    showToast('Reset all individual card style overrides to follow Board Default');
  };

  const handle_corner_style_select = (corner_id) => {
    applyCardCornerStyleToDocument(corner_id);
    updateBoardSetting('card_corner_style', corner_id);
    showToast(`Card corner style: ${corner_id}`);
  };

  const handle_default_color_select = (color_id) => {
    updateBoardSetting('default_card_color', color_id);
    showToast(`Default card color: ${color_id}`);
  };

  const handle_shadow_toggle = (e) => {
    updateBoardSetting('show_card_shadows', e.target.checked);
  };

  const handle_drag_drop_images_action_select = (action_id) => {
    updateBoardSetting('drag_drop_images_action', action_id);
    showToast(
      action_id === 'each_card'
        ? 'Drag & drop images: Each image gets its own card (Bird View)'
        : 'Drag & drop images: Combined into Image Carousel'
    );
  };

  const handle_grid_dimension_change = (raw_val) => {
    const val = Math.max(1, Math.min(240, Math.round(Number(raw_val) || 1)));
    setGridDimension(val);
    updateBoardSetting('grid_dimension', val);
    showToast(`Grid dimension set to ${val}px`);
  };

  const open_confirm_modal = (mode, e) => {
    if (e) {
      e.stopPropagation();
    }
    set_confirm_input_text('');
    set_confirm_modal_mode(mode);
  };

  const close_confirm_modal = (e) => {
    if (e) {
      e.stopPropagation();
    }
    set_confirm_modal_mode(null);
    set_confirm_input_text('');
  };

  const is_confirm_ready = confirm_input_text.trim().toLowerCase() === 'delete';

  const handle_clear_drawing_strokes = (e) => {
    if (e) {
      e.stopPropagation();
    }
    clearDrawingStrokes();
  };

  const handle_clear_board = (e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!is_confirm_ready) return;
    set_confirm_modal_mode(null);
    set_confirm_input_text('');
    clearBoard();
    showToast('All cards cleared from board (Undo: Ctrl+Z)');
  };

  const handle_delete_board = async (e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!is_confirm_ready) return;
    const current_id = activeBoardSignal.value?.id;
    const current_title = activeBoardSignal.value?.title || 'Board';
    set_confirm_modal_mode(null);
    set_confirm_input_text('');
    closeBoardSettingsPanel();
    const next_id = await deleteBoard(current_id);
    showToast(`Deleted board "${current_title}"`);
    if (next_id) {
      navigate(`/board/${next_id}`);
    } else {
      navigate('/boards');
    }
  };

  const handle_duplicate_board = async (e) => {
    if (e) e.stopPropagation();
    if (is_duplicating) return;
    const current_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code;
    if (!current_id) return;
    set_is_duplicating(true);
    try {
      const new_board_id = await duplicateBoard(current_id, { activate: true });
      if (new_board_id) {
        closeBoardSettingsPanel();
        navigate(`/board/${new_board_id}`);
      }
    } finally {
      set_is_duplicating(false);
    }
  };

  const handle_export_board_config = (e) => {
    if (e) e.stopPropagation();
    downloadBoardConfigurationJson(activeBoardSignal.value);
  };

  const handle_copy_board_config = async (e) => {
    if (e) e.stopPropagation();
    const ok = await copyBoardConfigurationJson(activeBoardSignal.value);
    if (ok) {
      set_copied_config(true);
      setTimeout(() => set_copied_config(false), 2000);
    }
  };

  const handle_import_config_file = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw_text = await file.text();
      const parsed = JSON.parse(raw_text);
      const new_board_id = createBoardFromExportConfig(parsed, {
        activate: true,
        toastMessage: `Imported shared board "${parsed.title || parsed.board_name || file.name.replace(/\.json$/i, '')}"`,
      });
      if (new_board_id) {
        closeBoardSettingsPanel();
        navigate(`/board/${new_board_id}`);
      }
    } catch (err) {
      console.error('Board config import error:', err);
      showToast('Invalid board configuration JSON file');
    } finally {
      if (config_file_input_ref.current) {
        config_file_input_ref.current.value = '';
      }
    }
  };

  const handle_apply_pasted_config = () => {
    const trimmed = import_json_text.trim();
    if (!trimmed) {
      showToast('Paste a valid board configuration JSON first');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const new_board_id = createBoardFromExportConfig(parsed, {
        activate: true,
        toastMessage: `Created board from shared configuration "${parsed.title || parsed.board_name || 'Shared Board'}"`,
      });
      if (new_board_id) {
        set_import_json_text('');
        set_show_import_paste(false);
        closeBoardSettingsPanel();
        navigate(`/board/${new_board_id}`);
      }
    } catch (err) {
      showToast('Invalid JSON format in pasted board configuration');
    }
  };

  return (
    <aside
      className={styles['lumen-settings-panel'] || styles.lumenSettingsPanel}
      aria-label="Board Settings"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      data-lumen-menu="true"
    >
      <div className={styles['lumen-settings-header'] || styles.lumenSettingsHeader}>
        <div className={styles['lumen-settings-title'] || styles.lumenSettingsTitle}>
          <Settings size={14} />
          <span>Board Settings</span>
        </div>
        <button
          type="button"
          className={styles['lumen-settings-close-btn'] || styles.lumenSettingsCloseBtn}
          onClick={closeBoardSettingsPanel}
          title="Close Settings"
        >
          <X size={14} />
        </button>
      </div>

      <div
        className={styles['lumen-settings-body'] || styles.lumenSettingsBody}
        style={{ overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}
      >
        {/* Section 1: Board Identity */}
        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
            Board Name
          </label>
          <input
            type="text"
            value={active_board.title !== undefined ? active_board.title : (active_board.board_name || '')}
            onChange={handle_title_change}
            onBlur={handle_title_blur}
            className={styles['lumen-settings-input'] || styles.lumenSettingsInput}
            placeholder="Untitled Workspace"
          />
        </div>

        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
            Board Description
          </label>
          <textarea
            rows={2}
            value={current_description}
            onChange={handle_description_change}
            onBlur={handle_description_blur}
            placeholder="Add brief project notes, visual guidelines, or board manifesto..."
            className={styles['lumen-settings-textarea'] || styles.lumenSettingsTextarea}
          />
        </div>

        {/* Section 1b: Board Sharing & Access */}
        {(() => {
          const sharing = normalize_board_sharing(
            active_board.sharing || board_settings.sharing
          );
          const is_public = sharing.visibility === 'public';
          return (
            <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
              <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
                <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
                  Board Sharing & Access
                </label>
                <span className={styles['lumen-settings-badge'] || styles.lumenSettingsBadge}>
                  {is_public ? `Public (${sharing.public_role || 'viewer'})` : 'Private'}
                </span>
              </div>
              <button
                type="button"
                className={styles['lumen-settings-view-activity-btn'] || styles.lumenSettingsViewActivityBtn}
                onClick={() => openShareModal(active_board.id)}
                title="Configure Private / Public visibility and collaborator roles"
              >
                {is_public ? <Globe size={13} color="#16a34a" /> : <Lock size={13} />}
                <span>
                  {is_public
                    ? `Public Link (${sharing.public_role || 'viewer'}) — Manage Sharing`
                    : 'Private (Restricted) — Share Board'}
                </span>
              </button>
            </div>
          );
        })()}

        {/* Section 2: Board Color Theme */}
        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
            <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
              Canvas Color Theme
            </label>
            <span className={styles['lumen-settings-badge'] || styles.lumenSettingsBadge}>
              {BOARD_THEMES[current_theme_id]?.name || 'Default'}
            </span>
          </div>

          <div className={styles['lumen-settings-themes-grid'] || styles.lumenSettingsThemesGrid}>
            {Object.values(BOARD_THEMES).map((theme) => {
              const is_active = current_theme_id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`${styles['lumen-settings-theme-card'] || styles.lumenSettingsThemeCard} ${
                    is_active ? (styles['lumen-settings-theme-card-active'] || styles.lumenSettingsThemeCardActive) : ''
                  }`}
                  onClick={() => handle_theme_select(theme.id)}
                  title={`Apply ${theme.name} theme`}
                >
                  <div
                    className={styles['lumen-settings-theme-preview'] || styles.lumenSettingsThemePreview}
                    style={{ backgroundColor: theme.canvasBg }}
                  >
                    <span
                      className={styles['lumen-settings-theme-dot'] || styles.lumenSettingsThemeDot}
                      style={{ backgroundColor: theme.canvasDot }}
                    />
                    {is_active && (
                      <span className={styles['lumen-settings-theme-check'] || styles.lumenSettingsThemeCheck}>
                        <Check size={11} color={theme.isDark ? '#38bdf8' : '#2563eb'} />
                      </span>
                    )}
                  </div>
                  <span className={styles['lumen-settings-theme-name'] || styles.lumenSettingsThemeName}>
                    {theme.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Spatial Grid & Snapping */}
        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          {/* Snap to grid toggle */}
          <label className={styles['lumen-settings-toggle-row'] || styles.lumenSettingsToggleRow}>
            <span className={styles['lumen-settings-toggle-label'] || styles.lumenSettingsToggleLabel}>
              Snap to Grid ({current_grid_dim}px)
            </span>
            <input
              type="checkbox"
              checked={snapToGridSignal.value}
              onChange={(e) => {
                snapToGridSignal.value = e.target.checked;
                showToast(e.target.checked ? `Grid snapping on (${current_grid_dim}px)` : 'Free placement on');
              }}
            />
          </label>

          {/* Grid Dimension Adjuster */}
          <div className={styles['lumen-settings-dimension-header'] || styles.lumenSettingsDimensionHeader}>
            <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
              Grid Dimension
            </label>
          </div>

          <div className={styles['lumen-settings-dimension-row'] || styles.lumenSettingsDimensionRow}>
            <input
              type="range"
              min="1"
              max="120"
              step="1"
              value={current_grid_dim}
              onChange={(e) => handle_grid_dimension_change(e.target.value)}
              className={styles['lumen-settings-slider'] || styles.lumenSettingsSlider}
              title="Adjust grid snapping dimension (from 1px)"
            />
            <div className={styles['lumen-settings-num-input-wrap'] || styles.lumenSettingsNumInputWrap}>
              <input
                type="number"
                min="1"
                max="240"
                step="1"
                value={current_grid_dim}
                onChange={(e) => handle_grid_dimension_change(e.target.value)}
                className={styles['lumen-settings-num-input'] || styles.lumenSettingsNumInput}
                title="Custom grid dimension in pixels (from 1px)"
              />
              <span className={styles['lumen-settings-num-unit'] || styles.lumenSettingsNumUnit}>px</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className={styles['lumen-settings-presets'] || styles.lumenSettingsPresets}>
            {[1, 8, 12, 16, 24, 32, 48].map((size) => (
              <button
                key={size}
                type="button"
                className={`${styles['lumen-settings-preset-btn'] || styles.lumenSettingsPresetBtn} ${
                  current_grid_dim === size
                    ? (styles['lumen-settings-preset-btn-active'] || styles.lumenSettingsPresetBtnActive)
                    : ''
                }`}
                onClick={() => handle_grid_dimension_change(size)}
                title={`Set grid dimension to ${size}px`}
              >
                {`${size}px`}
              </button>
            ))}
          </div>

          {/* Grid Pattern Style */}
          <div style={{ marginTop: 8 }}>
            <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel} style={{ marginBottom: 4 }}>
              Grid Pattern Style
            </label>
            <div className={styles['lumen-settings-segmented-group'] || styles.lumenSettingsSegmentedGroup}>
              {GRID_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles['lumen-settings-segmented-btn'] || styles.lumenSettingsSegmentedBtn} ${
                    current_grid_style === opt.id
                      ? (styles['lumen-settings-segmented-btn-active'] || styles.lumenSettingsSegmentedBtnActive)
                      : ''
                  }`}
                  onClick={() => handle_grid_style_select(opt.id)}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid dots toggle */}
          <label className={styles['lumen-settings-toggle-row'] || styles.lumenSettingsToggleRow} style={{ marginTop: 8 }}>
            <span className={styles['lumen-settings-toggle-label'] || styles.lumenSettingsToggleLabel}>
              Show Canvas Grid Pattern
            </span>
            <input
              type="checkbox"
              checked={showGridDotsSignal.value}
              onChange={(e) => {
                showGridDotsSignal.value = e.target.checked;
              }}
            />
          </label>
        </div>

        {/* Section 4: Card Defaults & Aesthetics */}
        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
            <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
              Board Card Style (Default)
            </label>
            <span className={styles['lumen-settings-badge'] || styles.lumenSettingsBadge}>
              {current_card_style === 'seamless' ? 'Seamless' : 'Full'}
            </span>
          </div>
          <div className={styles['lumen-settings-segmented-group'] || styles.lumenSettingsSegmentedGroup}>
            {CARD_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`${styles['lumen-settings-segmented-btn'] || styles.lumenSettingsSegmentedBtn} ${
                  current_card_style === opt.id
                    ? (styles['lumen-settings-segmented-btn-active'] || styles.lumenSettingsSegmentedBtnActive)
                    : ''
                }`}
                onClick={() => handle_card_style_select(opt.id)}
                title={opt.hint}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className={styles['lumen-settings-dimension-hint'] || styles.lumenSettingsDimensionHint}>
            {current_card_style === 'seamless'
              ? 'Default for all cards on this board: shows true card content with minimal border. Individual cards can override this in Card Properties.'
              : 'Default for all cards on this board: displays full card with header bar and action buttons. Individual cards can override this in Card Properties.'}
          </span>
          {overridden_cards_count > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 6,
                padding: '6px 10px',
                borderRadius: 8,
                backgroundColor: 'rgba(37, 99, 235, 0.06)',
                border: '1px solid rgba(37, 99, 235, 0.18)',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--lumen-text-secondary, #475569)', fontWeight: 500 }}>
                {overridden_cards_count} {overridden_cards_count === 1 ? 'card has' : 'cards have'} custom style override
              </span>
              <button
                type="button"
                onClick={handle_reset_card_style_overrides}
                style={{
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  background: '#ffffff',
                  color: '#2563eb',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Clear per-card overrides so all cards use the board default style"
              >
                Reset Overrides
              </button>
            </div>
          )}

          {/* Board Default Google Font (100% Free Commercial - SIL OFL & Apache 2.0) */}
          <div style={{ marginTop: 10 }}>
            <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
              <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
                Default Google Font (Free Commercial)
              </label>
              <span className={styles['lumen-settings-badge'] || styles.lumenSettingsBadge}>
                {board_settings.font_family && board_settings.font_family !== 'default'
                  ? board_settings.font_family
                  : 'Inter (Default)'}
              </span>
            </div>

            {/* Search Font Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4, marginBottom: 6 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, color: '#64748b', pointerEvents: 'none' }} />
              <input
                type="text"
                value={board_font_search}
                onChange={(e) => set_board_font_search(e.target.value)}
                placeholder={`Search ${all_commercial_fonts.length.toLocaleString()} free commercial Google Fonts...`}
                className={styles['lumen-settings-input'] || styles.lumenSettingsInput}
                style={{ paddingLeft: 28, paddingRight: board_font_search ? 26 : 10, fontSize: 12 }}
              />
              {board_font_search && (
                <button
                  type="button"
                  onClick={() => set_board_font_search('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear font search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Instant Search Results List when searching */}
            {board_font_search.trim() && (
              <div
                style={{
                  maxHeight: 165,
                  overflowY: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: 7,
                  background: '#ffffff',
                  marginBottom: 6,
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {filtered_board_fonts.length === 0 ? (
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                    No free commercial Google Fonts match "{board_font_search}"
                  </div>
                ) : (
                  filtered_board_fonts.slice(0, 35).map((gf) => {
                    load_google_font(gf.family);
                    const is_selected = board_settings.font_family === gf.family;
                    return (
                      <button
                        key={gf.family}
                        type="button"
                        onClick={() => {
                          load_google_font(gf.family);
                          applyBoardFontToDocument(gf.family);
                          updateBoardSetting('font_family', gf.family);
                          set_board_font_search('');
                          showToast(`Board default Google Font: ${gf.family} (${gf.license || 'SIL OFL 1.1'})`);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: 5,
                          border: is_selected ? '1px solid #6366f1' : '1px solid transparent',
                          background: is_selected ? '#eef2ff' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: '#0f172a',
                            fontFamily: get_google_font_css_stack(gf.family),
                          }}
                        >
                          {gf.family}
                        </span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>
                          {gf.category} • {gf.license || 'SIL OFL 1.1'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            <select
              value={board_settings.font_family || 'default'}
              onChange={(e) => {
                const val = e.target.value;
                if (val && val !== 'default') load_google_font(val);
                applyBoardFontToDocument(val);
                updateBoardSetting('font_family', val === 'default' ? null : val);
                showToast(
                  val === 'default'
                    ? 'Board default font set to Inter'
                    : `Board default Google Font: ${val} (Free Commercial)`
                );
              }}
              className={styles['lumen-settings-input'] || styles.lumenSettingsInput}
              style={{
                marginTop: 2,
                fontWeight: 500,
                fontFamily:
                  board_settings.font_family && board_settings.font_family !== 'default'
                    ? get_google_font_css_stack(board_settings.font_family)
                    : undefined,
              }}
            >
              <option value="default">Inter — Default UI Sans (SIL OFL 1.1)</option>
              <optgroup label="Sans-Serif (SIL OFL / Apache 2.0)">
                {all_commercial_fonts.filter((f) => f.category === 'sans-serif').map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family} — {f.sample || 'Free Commercial'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Serif (SIL OFL 1.1)">
                {all_commercial_fonts.filter((f) => f.category === 'serif').map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family} — {f.sample || 'Free Commercial'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Display & Headline (SIL OFL 1.1)">
                {all_commercial_fonts.filter((f) => f.category === 'display').map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family} — {f.sample || 'Free Commercial'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Handwriting & Script (OFL / Apache)">
                {all_commercial_fonts.filter((f) => f.category === 'handwriting').map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family} — {f.sample || 'Free Commercial'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Monospace (SIL OFL 1.1)">
                {all_commercial_fonts.filter((f) => f.category === 'monospace').map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family} — {f.sample || 'Free Commercial'}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className={styles['lumen-settings-dimension-hint'] || styles.lumenSettingsDimensionHint}>
              {all_commercial_fonts.length.toLocaleString()} open-source Google Fonts (SIL OFL 1.1 / Apache 2.0) — 100% free for commercial use. Individual cards can override this in Card Properties.
            </span>
          </div>

          <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel} style={{ marginTop: 8 }}>
            Default Card Color
          </label>
          <div className={styles['lumen-settings-color-swatches'] || styles.lumenSettingsColorSwatches}>
            {CARD_COLOR_PRESETS.map((color) => {
              const is_selected = current_card_color === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  className={`${styles['lumen-settings-color-swatch'] || styles.lumenSettingsColorSwatch} ${
                    is_selected ? (styles['lumen-settings-color-swatch-active'] || styles.lumenSettingsColorSwatchActive) : ''
                  }`}
                  style={{ backgroundColor: color.bg, borderColor: color.border }}
                  onClick={() => handle_default_color_select(color.id)}
                  title={`${color.name} default card`}
                >
                  {is_selected && <Check size={11} color="#0f172a" />}
                </button>
              );
            })}
          </div>

          <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel} style={{ marginTop: 8 }}>
            Card Corner Radius
          </label>
          <div className={styles['lumen-settings-segmented-group'] || styles.lumenSettingsSegmentedGroup}>
            {CORNER_STYLE_OPTIONS.map((corner) => (
              <button
                key={corner.id}
                type="button"
                className={`${styles['lumen-settings-segmented-btn'] || styles.lumenSettingsSegmentedBtn} ${
                  current_corner_style === corner.id
                    ? (styles['lumen-settings-segmented-btn-active'] || styles.lumenSettingsSegmentedBtnActive)
                    : ''
                }`}
                onClick={() => handle_corner_style_select(corner.id)}
              >
                {corner.label}
              </button>
            ))}
          </div>

          <label className={styles['lumen-settings-toggle-row'] || styles.lumenSettingsToggleRow} style={{ marginTop: 8 }}>
            <span className={styles['lumen-settings-toggle-label'] || styles.lumenSettingsToggleLabel}>
              Card Elevation Shadows
            </span>
            <input
              type="checkbox"
              checked={current_show_shadows}
              onChange={handle_shadow_toggle}
            />
          </label>

          <div style={{ marginTop: 10 }}>
            <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
              <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
                Drag & Drop Images Action
              </label>
              <span className={styles['lumen-settings-badge'] || styles.lumenSettingsBadge}>
                {current_drag_drop_images_action === 'each_card' ? 'Each Card' : 'Carousel'}
              </span>
            </div>
            <div className={styles['lumen-settings-segmented-group'] || styles.lumenSettingsSegmentedGroup}>
              {DRAG_DROP_IMAGES_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles['lumen-settings-segmented-btn'] || styles.lumenSettingsSegmentedBtn} ${
                    current_drag_drop_images_action === opt.id
                      ? (styles['lumen-settings-segmented-btn-active'] || styles.lumenSettingsSegmentedBtnActive)
                      : ''
                  }`}
                  onClick={() => handle_drag_drop_images_action_select(opt.id)}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className={styles['lumen-settings-dimension-hint'] || styles.lumenSettingsDimensionHint}>
              {current_drag_drop_images_action === 'each_card'
                ? 'Each dropped image gets its own card in a grid for an easy bird’s-eye view.'
                : 'Multiple dropped images are combined into a single Image Carousel card.'}
            </span>
          </div>
        </div>

        {/* Section 5: Server Synchronization */}
        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
            <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
              Server Sync
            </label>
          </div>

          <div className={styles['lumen-settings-sync-box'] || styles.lumenSettingsSyncBox}>
            <div className={styles['lumen-settings-sync-status-row'] || styles.lumenSettingsSyncStatusRow}>
              <div className={styles['lumen-settings-sync-status-left'] || styles.lumenSettingsSyncStatusLeft}>
                <span
                  className={`${styles['lumen-settings-sync-dot'] || styles.lumenSettingsSyncDot} ${
                    is_syncing
                      ? (styles['lumen-settings-sync-dot-syncing'] || styles.lumenSettingsSyncDotSyncing)
                      : sync_status === 'error'
                      ? (styles['lumen-settings-sync-dot-error'] || styles.lumenSettingsSyncDotError)
                      : (styles['lumen-settings-sync-dot-active'] || styles.lumenSettingsSyncDotActive)
                  }`}
                />
                <span className={styles['lumen-settings-sync-status-text'] || styles.lumenSettingsSyncStatusText}>
                  {is_syncing
                    ? 'Synchronizing with server...'
                    : sync_status === 'error'
                    ? 'Sync warning (offline cached)'
                    : 'Synced with Server'}
                </span>
              </div>
              <span className={styles['lumen-settings-sync-size-tag'] || styles.lumenSettingsSyncSizeTag}>
                {formatted_size}
              </span>
            </div>

            <div className={styles['lumen-settings-sync-meta-list'] || styles.lumenSettingsSyncMetaList}>
              <div className={styles['lumen-settings-sync-meta-item'] || styles.lumenSettingsSyncMetaItem}>
                <span className={styles['lumen-settings-sync-meta-label'] || styles.lumenSettingsSyncMetaLabel}>
                  Last Server Sync
                </span>
                <span className={styles['lumen-settings-sync-meta-value'] || styles.lumenSettingsSyncMetaValue}>
                  {format_last_sync(last_sync_time)}
                </span>
              </div>

              <div className={styles['lumen-settings-sync-meta-item'] || styles.lumenSettingsSyncMetaItem}>
                <span className={styles['lumen-settings-sync-meta-label'] || styles.lumenSettingsSyncMetaLabel}>
                  Board Content
                </span>
                <span className={styles['lumen-settings-sync-meta-value'] || styles.lumenSettingsSyncMetaValue}>
                  {(active_board.cards || []).length} cards • {(active_board.connections || []).length} links • {(active_board.drawings || []).length} drawings
                </span>
              </div>
            </div>

            <button
              type="button"
              className={`${styles['lumen-settings-force-sync-btn'] || styles.lumenSettingsForceSyncBtn} ${
                is_syncing ? (styles['lumen-settings-force-sync-btn-disabled'] || styles.lumenSettingsForceSyncBtnDisabled) : ''
              }`}
              onClick={handle_force_sync}
              disabled={is_syncing}
              title="Force immediate synchronization of board state to server and database"
            >
              <RefreshCw
                size={13}
                className={is_syncing ? (styles['lumen-settings-spin'] || styles.lumenSettingsSpin) : ''}
              />
              <span>{is_syncing ? 'Syncing with Server...' : 'Force Sync with Server'}</span>
            </button>

            <button
              type="button"
              className={styles['lumen-settings-view-activity-btn'] || styles.lumenSettingsViewActivityBtn}
              onClick={toggleActivityDrawer}
              title="Open audit trail & user activity log"
            >
              <History size={13} />
              <span>User Activity & Audit Log ({activityLogsSignal.value.length})</span>
            </button>
          </div>
        </div>

        {/* Section 5.5: Board Duplicate & Configuration Export */}
        <div className={styles['lumen-settings-field'] || styles.lumenSettingsField}>
          <div className={styles['lumen-settings-section-header'] || styles.lumenSettingsSectionHeader}>
            <label className={styles['lumen-settings-label'] || styles.lumenSettingsLabel}>
              Board Duplicate & Export Config
            </label>
            <span className={styles['lumen-settings-badge-count'] || styles.lumenSettingsBadgeCount}>
              Template Format
            </span>
          </div>

          <div className={styles['lumen-settings-config-box'] || styles.lumenSettingsConfigBox}>
            <button
              type="button"
              className={styles['lumen-settings-duplicate-btn'] || styles.lumenSettingsDuplicateBtn}
              onClick={handle_duplicate_board}
              disabled={is_duplicating}
              title="Duplicate this board including all cards, groups, connections, drawings, and settings"
            >
              <Copy size={13} />
              <span>{is_duplicating ? 'Duplicating Board...' : 'Duplicate Board'}</span>
            </button>

            <div className={styles['lumen-settings-config-divider'] || styles.lumenSettingsConfigDivider} />

            <input
              ref={config_file_input_ref}
              type="file"
              accept=".json,application/json"
              onChange={handle_import_config_file}
              style={{ display: 'none' }}
            />

            <div className={styles['lumen-settings-config-btn-grid'] || styles.lumenSettingsConfigBtnGrid}>
              <button
                type="button"
                className={styles['lumen-settings-export-btn'] || styles.lumenSettingsExportBtn}
                onClick={handle_export_board_config}
                title="Download portable board configuration (.json) to share with other users"
              >
                <Download size={13} />
                <span>Export Board</span>
              </button>

              <button
                type="button"
                className={`${styles['lumen-settings-export-btn'] || styles.lumenSettingsExportBtn} ${
                  copied_config ? (styles['lumen-settings-export-btn-active'] || styles.lumenSettingsExportBtnActive) : ''
                }`}
                onClick={handle_copy_board_config}
                title="Copy portable board configuration JSON (compatible with BOARD_TEMPLATES)"
              >
                {copied_config ? <Check size={13} /> : <FileCode size={13} />}
                <span>{copied_config ? 'Copied JSON!' : 'Copy Board JSON'}</span>
              </button>

              <button
                type="button"
                className={styles['lumen-settings-export-btn'] || styles.lumenSettingsExportBtn}
                onClick={() => config_file_input_ref.current?.click()}
                title="Create a new board from a shared .json board configuration file"
              >
                <Upload size={13} />
                <span>Import Board</span>
              </button>

              <button
                type="button"
                className={`${styles['lumen-settings-export-btn'] || styles.lumenSettingsExportBtn} ${
                  show_import_paste ? (styles['lumen-settings-export-btn-active'] || styles.lumenSettingsExportBtnActive) : ''
                }`}
                onClick={() => set_show_import_paste((prev) => !prev)}
                title="Paste shared board configuration JSON"
              >
                <FileText size={13} />
                <span>{show_import_paste ? 'Hide Paste' : 'Paste Board JSON'}</span>
              </button>
            </div>

            {show_import_paste && (
              <div className={styles['lumen-settings-paste-box'] || styles.lumenSettingsPasteBox}>
                <textarea
                  rows={4}
                  value={import_json_text}
                  onChange={(e) => set_import_json_text(e.target.value)}
                  placeholder='Paste shared board JSON ({"format": "lumen_board_export", ...})'
                  className={styles['lumen-settings-paste-textarea'] || styles.lumenSettingsPasteTextarea}
                />
                <button
                  type="button"
                  className={styles['lumen-settings-paste-apply-btn'] || styles.lumenSettingsPasteApplyBtn}
                  onClick={handle_apply_pasted_config}
                >
                  Create Board from JSON
                </button>
              </div>
            )}

            <span className={styles['lumen-settings-config-hint'] || styles.lumenSettingsConfigHint}>
              Shares portable <code>lumen_board_export</code> format compatible with templates.
            </span>
          </div>
        </div>

        {/* Section 6: Board Actions */}
        <div className={styles['lumen-settings-actions'] || styles.lumenSettingsActions}>
          <div className={styles['lumen-settings-divider'] || styles.lumenSettingsDivider} />

          {/* Clear all drawing strokes */}
          <button
            type="button"
            className={styles['lumen-settings-clear-btn'] || styles.lumenSettingsClearBtn}
            onClick={handle_clear_drawing_strokes}
            title="Clear all drawing strokes from canvas (Undo: Ctrl+Z)"
          >
            <Eraser size={13} style={{ marginRight: 6, verticalAlign: -1 }} />
            <span>Clear All Drawing Strokes</span>
          </button>

          {/* Clear cards */}
          <button
            type="button"
            className={styles['lumen-settings-clear-btn'] || styles.lumenSettingsClearBtn}
            onClick={(e) => open_confirm_modal('clear_cards', e)}
            title="Clear all cards from canvas"
          >
            <RotateCcw size={13} style={{ marginRight: 6, verticalAlign: -1 }} />
            <span>Clear All Cards</span>
          </button>

          {/* Delete board button */}
          <button
            type="button"
            className={styles['lumen-settings-delete-btn'] || styles.lumenSettingsDeleteBtn}
            onClick={(e) => open_confirm_modal('delete_board', e)}
            title="Delete this board from workspace"
          >
            <Trash2 size={13} style={{ marginRight: 6, verticalAlign: -1 }} />
            <span>Delete Board</span>
          </button>
        </div>
      </div>

      {/* Destructive Action Confirmation Popup Modal */}
      {confirm_modal_mode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles['lumen-settings-modal-backdrop'] || styles.lumenSettingsModalBackdrop}
            onClick={close_confirm_modal}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            data-lumen-menu="true"
          >
            <div
              className={styles['lumen-settings-modal-card'] || styles.lumenSettingsModalCard}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lumen-destructive-modal-title"
            >
              <div className={styles['lumen-settings-modal-header'] || styles.lumenSettingsModalHeader}>
                <div className={styles['lumen-settings-modal-title-row'] || styles.lumenSettingsModalTitleRow}>
                  <span
                    className={`${styles['lumen-settings-modal-icon'] || styles.lumenSettingsModalIcon} ${
                      confirm_modal_mode === 'clear_cards'
                        ? (styles['lumen-settings-modal-icon-warn'] || styles.lumenSettingsModalIconWarn)
                        : (styles['lumen-settings-modal-icon-danger'] || styles.lumenSettingsModalIconDanger)
                    }`}
                  >
                    {confirm_modal_mode === 'clear_cards' ? <AlertTriangle size={16} /> : <Trash2 size={16} />}
                  </span>
                  <h3
                    id="lumen-destructive-modal-title"
                    className={styles['lumen-settings-modal-title'] || styles.lumenSettingsModalTitle}
                  >
                    {confirm_modal_mode === 'clear_cards' ? 'Clear All Cards' : 'Delete Board'}
                  </h3>
                </div>
                <button
                  type="button"
                  className={styles['lumen-settings-close-btn'] || styles.lumenSettingsCloseBtn}
                  onClick={close_confirm_modal}
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <div className={styles['lumen-settings-modal-body'] || styles.lumenSettingsModalBody}>
                <p className={styles['lumen-settings-modal-desc'] || styles.lumenSettingsModalDesc}>
                  {confirm_modal_mode === 'clear_cards' ? (
                    <>
                      Are you sure you want to remove all{' '}
                      <strong>{(active_board.cards || []).length} cards</strong> from{' '}
                      <strong>"{active_board.title || 'Untitled Board'}"</strong>?
                    </>
                  ) : (
                    <>
                      Are you sure you want to permanently delete{' '}
                      <strong>"{active_board.title || 'Untitled Board'}"</strong> and all of its contents? This action cannot be undone.
                    </>
                  )}
                </p>

                <label className={styles['lumen-settings-modal-prompt'] || styles.lumenSettingsModalPrompt}>
                  Please type <strong>delete</strong> below to confirm:
                </label>

                <input
                  type="text"
                  value={confirm_input_text}
                  onChange={(e) => set_confirm_input_text(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      close_confirm_modal(e);
                    } else if (e.key === 'Enter' && is_confirm_ready) {
                      if (confirm_modal_mode === 'clear_cards') {
                        handle_clear_board(e);
                      } else {
                        handle_delete_board(e);
                      }
                    }
                  }}
                  placeholder="Type delete to confirm"
                  autoFocus
                  className={styles['lumen-settings-modal-input'] || styles.lumenSettingsModalInput}
                />
              </div>

              <div className={styles['lumen-settings-modal-footer'] || styles.lumenSettingsModalFooter}>
                <button
                  type="button"
                  className={styles['lumen-settings-cancel-btn'] || styles.lumenSettingsCancelBtn}
                  onClick={close_confirm_modal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!is_confirm_ready}
                  className={`${styles['lumen-settings-delete-confirm-btn'] || styles.lumenSettingsDeleteConfirmBtn} ${
                    !is_confirm_ready
                      ? (styles['lumen-settings-delete-confirm-btn-disabled'] || styles.lumenSettingsDeleteConfirmBtnDisabled)
                      : ''
                  }`}
                  onClick={confirm_modal_mode === 'clear_cards' ? handle_clear_board : handle_delete_board}
                >
                  {confirm_modal_mode === 'clear_cards' ? 'Delete All Cards' : 'Delete Board'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </aside>
  );
}

export default LUMEN_board_settings_panel;
