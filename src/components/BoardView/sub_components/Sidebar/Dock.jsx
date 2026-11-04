import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  StickyNote,
  CheckSquare,
  Heading,
  Image as ImageIcon,
  PenTool,
  Boxes,
  Music,
  Instagram,
  FolderKanban,
  FileText,
  MapPin,
  TrendingUp,
  Palette,
  FileCode,
  Code2,
  Table,
  Link2,
  Layers,
  Settings,
  Sparkles,
  Plus,
  Minus,
  ZoomIn,
  RotateCcw,
  X,
  GripVertical,
  MousePointer,
  Hand,
  History,
  Lock,
  Loader2,
  Search,
  Mic,
  Coins,
  Clock,
} from 'lucide-react';

import styles from './Dock.module.css';
import {
  addCard,
  createCardId,
  activeBoardSignal,
  activeToolSignal,
  updateViewport,
  isLayerPanelOpenSignal,
  toggleLayerPanel,
  closeLayerPanel,
  isBoardSettingsPanelOpenSignal,
  toggleBoardSettingsPanel,
  closeBoardSettingsPanel,
  isDrawingModeSignal,
  selectedDrawingImageIdSignal,
  exitDrawingSession,
  showToast,
  selectedCardsSignal,
  unlockedCardsSignal,
} from '../../signals/boardState.js';
import {
  isAiPanelOpenSignal,
  isAiLoadingSignal,
  isCardAiProcessingSignal,
  toggleAiPanel,
} from '../../signals/aiState.js';
import {
  isActivityDrawerOpenSignal,
  toggleActivityDrawer,
} from '../../signals/realtimeState.js';
import { encrypt_card_data } from '../../utils/lumen_encryption.js';

import design_item_image from '../../assets/images/lumen_mood_design_1791015845283.jpg';
import palette_item_image from '../../assets/images/lumen_mood_palette_1791015859220.jpg';
import reel_item_image from '../../assets/images/social_reel_arch_1791019455630.jpg';
import LUMEN_zoom_popup from '../Zoom/LUMEN_zoom_popup.jsx';
import LUMEN_create_encrypted_card_modal from '../Modal/LUMEN_create_encrypted_card_modal.jsx';

export function LUMEN_dock({ read_only = false } = {}) {
  useSignals();
  const [is_card_menu_open, set_is_card_menu_open] = useState(false);
  const [card_search_query, set_card_search_query] = useState('');
  const [encrypt_modal_item, set_encrypt_modal_item] = useState(null);
  const card_menu_ref = useRef(null);
  const card_search_input_ref = useRef(null);
  const [is_zoom_popup_open, set_is_zoom_popup_open] = useState(false);
  const zoom_popup_ref = useRef(null);
  const zoom_btn_ref = useRef(null);

  const is_layer_open = isLayerPanelOpenSignal.value;
  const is_settings_open = isBoardSettingsPanelOpenSignal.value;
  const is_ai_open = isAiPanelOpenSignal.value;
  const is_ai_working = Boolean(isAiLoadingSignal.value || isCardAiProcessingSignal.value);
  const is_drawing = isDrawingModeSignal.value;
  const is_hand_tool = activeToolSignal.value === 'hand';

  // Read current board viewport zoom level
  const viewport = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
  const current_zoom = viewport.zoom || 1;

  const handle_zoom_to = (target_zoom) => {
    const clamped_zoom = Math.min(2.0, Math.max(0.3, Number(target_zoom.toFixed(2))));
    const center_x = window.innerWidth / 2;
    const center_y = window.innerHeight / 2;
    const old_zoom = current_zoom;
    const new_pan_x = center_x - (center_x - viewport.panX) * (clamped_zoom / old_zoom);
    const new_pan_y = center_y - (center_y - viewport.panY) * (clamped_zoom / old_zoom);
    updateViewport(new_pan_x, new_pan_y, clamped_zoom);
  };

  const handle_slider_change = (e) => {
    const target_percent = Number(e.target.value);
    handle_zoom_to(target_percent / 100);
  };

  const handle_step_zoom = (delta) => {
    handle_zoom_to(current_zoom + delta);
  };

  const handle_reset_zoom = () => {
    const center_x = window.innerWidth / 2;
    const center_y = window.innerHeight / 2;
    const old_zoom = current_zoom;
    const new_pan_x = center_x - (center_x - viewport.panX) * (1 / old_zoom);
    const new_pan_y = center_y - (center_y - viewport.panY) * (1 / old_zoom);
    updateViewport(new_pan_x, new_pan_y, 1);
  };

  const ensure_exit_drawing_mode = () => {
    if (isDrawingModeSignal.value) {
      exitDrawingSession();
    }
  };

  const handle_toggle_zoom = (e) => {
    e?.stopPropagation();
    ensure_exit_drawing_mode();
    set_is_card_menu_open(false);
    closeLayerPanel();
    closeBoardSettingsPanel();
    set_is_zoom_popup_open((prev) => !prev);
  };

  const handle_toggle_tool = () => {
    ensure_exit_drawing_mode();
    set_is_card_menu_open(false);
    set_is_zoom_popup_open(false);
    closeLayerPanel();
    closeBoardSettingsPanel();
    if (activeToolSignal.value === 'hand') {
      activeToolSignal.value = 'select';
    } else {
      activeToolSignal.value = 'hand';
    }
  };

  // Close menus on outside click
  useEffect(() => {
    function handle_click_outside(e) {
      if (card_menu_ref.current && !card_menu_ref.current.contains(e.target)) {
        if (!e.target.closest('[data-lumen-dock-toggle="true"]')) {
          set_is_card_menu_open(false);
        }
      }
      if (zoom_popup_ref.current && !zoom_popup_ref.current.contains(e.target)) {
        if (!e.target.closest('[data-lumen-zoom-toggle="true"]')) {
          set_is_zoom_popup_open(false);
        }
      }
    }
    document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, []);

  const handle_add_card = (type_config) => {
    ensure_exit_drawing_mode();
    set_is_card_menu_open(false);
    set_is_zoom_popup_open(false);
    closeLayerPanel();
    closeBoardSettingsPanel();
    const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const center_x = Math.round((-vp.panX + window.innerWidth / 2 - 160) / (vp.zoom || 1));
    const center_y = Math.round((-vp.panY + window.innerHeight / 2 - 120) / (vp.zoom || 1));

    addCard({
      ...type_config,
      x: center_x,
      y: center_y,
    });
  };

  const handle_create_encrypted_card = async ({ passkey, passkey_hint }) => {
    if (!encrypt_modal_item) return;
    ensure_exit_drawing_mode();
    set_is_card_menu_open(false);
    set_is_zoom_popup_open(false);
    closeLayerPanel();
    closeBoardSettingsPanel();

    const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const center_x = Math.round((-vp.panX + window.innerWidth / 2 - 160) / (vp.zoom || 1));
    const center_y = Math.round((-vp.panY + window.innerHeight / 2 - 120) / (vp.zoom || 1));

    const initial_config = encrypt_modal_item.config || {};
    const card_title = initial_config.title || encrypt_modal_item.label || 'Encrypted Card';
    const plain_payload = {
      title: card_title,
      content: initial_config.content || '',
      description: initial_config.description || '',
      items: initial_config.items || (initial_config.type === 'tasklist' ? [{ id: 't1', text: 'First task', done: false }] : []),
      url: initial_config.url || '',
      symbol: initial_config.symbol || '',
    };

    const encryption_meta = await encrypt_card_data(plain_payload, passkey, passkey_hint);
    const new_card_id = typeof createCardId === 'function' ? createCardId() : `card_enc_${Date.now()}`;

    // Store in ephemeral session so author can immediately type & edit without re-entering password
    unlockedCardsSignal.value = {
      ...unlockedCardsSignal.value,
      [new_card_id]: {
        payload: plain_payload,
        passkey,
        passkey_hint,
        unlockedAt: Date.now(),
      },
    };

    addCard({
      ...initial_config,
      id: new_card_id,
      title: card_title,
      content: initial_config.content || '',
      items: plain_payload.items || [],
      x: center_x,
      y: center_y,
      card_encryption: encryption_meta,
      cardEncryption: encryption_meta,
      is_encryption_unlocked: true,
    });

    selectedCardsSignal.value = [new_card_id];
    showToast(`Created Encrypted ${encrypt_modal_item.label} · Unlocked for editing`);
  };

  const CARD_CREATION_ITEMS = [
    {
      type: 'note',
      label: 'Sticky Note',
      description: 'Color-coded ideas, quick thoughts & markdown',
      price: 'Free',
      category: 'Notes',
      gradient: 'linear-gradient(135deg, #fef08a 0%, #facc15 100%)',
      icon: StickyNote,
      config: { type: 'note', title: 'New Note', content: '', color: 'yellow' },
    },
    {
      type: 'tasklist',
      label: 'Checklist / Tasks',
      description: 'Interactive checklists with progress track',
      price: 'Free',
      category: 'Tasks',
      gradient: 'linear-gradient(135deg, #5eead4 0%, #0d9488 100%)',
      icon: CheckSquare,
      config: { type: 'tasklist', title: 'Checklist', items: [{ id: 't1', text: 'First task', done: false }], color: 'teal' },
    },
    {
      type: 'link',
      label: 'Web Bookmark',
      description: 'Live website cards with preview & favicon',
      price: 'Free',
      category: 'Link',
      gradient: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
      icon: Link2,
      config: { type: 'link', title: 'Design Systems Repository', url: 'https://designsystemsrepo.com', description: 'Curated design systems and UI pattern repositories', color: 'blue', width: 360, height: 216 },
    },
    {
      type: 'image',
      label: 'Image Carousel',
      description: 'Multi-slide image carousel & zoom studio',
      price: 'Media',
      category: 'Media',
      imageUrl: design_item_image,
      gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
      icon: ImageIcon,
      config: { type: 'image', title: 'Image Carousel', images: [], imageUrl: '' },
    },
    {
      type: 'canvas',
      label: 'Canvas Sketch',
      description: 'Vector sketching, whiteboard & brush tools',
      price: 'Draw',
      category: 'Draw',
      gradient: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)',
      icon: PenTool,
      config: { type: 'canvas', title: 'Drawing Sketch' },
    },
    {
      type: 'group',
      label: 'Column Group Frame',
      description: 'Auto-stacking vertical kanban columns',
      price: 'Frame',
      category: 'Organize',
      gradient: 'linear-gradient(135deg, #a5b4fc 0%, #4f46e5 100%)',
      icon: Boxes,
      config: { type: 'group', title: 'Group Column' },
    },
    {
      type: 'sheets',
      label: 'Data Spreadsheet',
      description: 'Spreadsheet grid with cells & formulas',
      price: 'Data',
      category: 'Data',
      gradient: 'linear-gradient(135deg, #6ee7b7 0%, #059669 100%)',
      icon: Table,
      config: {
        type: 'sheets',
        title: 'Spreadsheet Sheet',
        sheets_data: {
          cols: ['A', 'B', 'C', 'D', 'E', 'F'],
          rows_count: 8,
          cells: {},
        },
      },
    },
    {
      type: 'docs',
      label: 'Rich Document',
      description: 'Markdown spec, code snippets & notes',
      price: 'Docs',
      category: 'Docs',
      gradient: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
      icon: FileCode,
      config: { type: 'docs', title: 'Documentation Spec' },
    },
    {
      type: 'code',
      label: 'Code Snippet',
      description: 'Multi-file syntax-highlighted code editor for sharing',
      price: 'Code',
      category: 'Dev',
      gradient: 'linear-gradient(135deg, #38bdf8 0%, #0f172a 100%)',
      icon: Code2,
      config: {
        type: 'code',
        title: 'Code Snippet',
        code_data: {
          active_file_id: 'file_1',
          theme: 'dark',
          word_wrap: false,
          font_size: 13,
          files: [
            {
              id: 'file_1',
              name: 'snippet.js',
              language: 'javascript',
              code: '',
              pinned_lines: [],
            },
          ],
        },
      },
    },
    {
      type: 'stock',
      label: 'Stock Market Ticker',
      description: 'Real-time ticker quotes & price changes',
      price: 'Finance',
      category: 'Finance',
      gradient: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 100%)',
      icon: TrendingUp,
      config: { type: 'stock', title: 'Stock Card', symbol: 'MAPI.JK', width: 550, height: 600 },
    },
    {
      type: 'currency',
      label: 'Currency Card',
      description: 'Multi-currency calculator — change any currency to update all simultaneously',
      price: 'Currency FX',
      category: 'Finance Currency Calculator Exchange FX',
      gradient: 'linear-gradient(135deg, #34d399 0%, #0d9488 100%)',
      icon: Coins,
      config: {
        type: 'currency',
        title: 'Currency Calculator',
        width: 420,
        height: 460,
        currency_data: {
          selected_codes: ['USD', 'EUR', 'IDR', 'JPY', 'GBP', 'SGD'],
          base_code: 'USD',
          base_amount: 100,
          theme: 'dark',
        },
      },
    },
    {
      type: 'clock',
      label: 'Clock Card',
      description: 'Realtime world clock with date, complete UTC selector, stopwatch, countdown & alarm',
      price: 'Time',
      category: 'Time Clock UTC Stopwatch Countdown Alarm Timer',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      icon: Clock,
      config: {
        type: 'clock',
        title: 'World Clock & Timer',
        width: 396,
        height: 440,
        clock_data: {
          mode: 'clock',
          utc_offset: 'LOCAL',
          show_date: true,
          show_seconds: true,
          use_24h: true,
          show_analog: true,
          theme: 'dark',
          sound_enabled: true,
          stopwatch_running: false,
          stopwatch_elapsed_ms: 0,
          stopwatch_started_at: null,
          stopwatch_laps: [],
          countdown_duration_sec: 300,
          countdown_remaining_ms: 300000,
          countdown_running: false,
          countdown_target_ts: null,
          alarms: [
            { id: 'alarm_1', time: '09:00', label: 'Morning Standup', enabled: true },
          ],
        },
      },
    },
    {
      type: 'geo',
      label: 'Location Map Pin',
      description: 'Interactive maps & geographic coordinates',
      price: 'Map',
      category: 'Map',
      gradient: 'linear-gradient(135deg, #fda4af 0%, #e11d48 100%)',
      icon: MapPin,
      config: { type: 'geo', title: 'Location Pin' },
    },
    {
      type: 'palette',
      label: 'Color Palette',
      description: 'HEX swatches, contrast & token sets',
      price: 'Design',
      category: 'Design',
      imageUrl: palette_item_image,
      gradient: 'linear-gradient(135deg, #d8b4fe 0%, #9333ea 100%)',
      icon: Palette,
      config: { type: 'palette', title: 'Color System' },
    },
    {
      type: 'heading',
      label: 'Section Header',
      description: 'Bold visual banners for spatial zones',
      price: 'Title',
      category: 'Layout',
      gradient: 'linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)',
      icon: Heading,
      config: { type: 'heading', title: 'Section Title', content: 'Subheading description', color: 'slate' },
    },
    {
      type: 'file_3d',
      label: '3D Character Player',
      description: '3D character & GLB/FBX showcase with Walk, Run, Jump animations',
      price: '3D Studio',
      category: '3D',
      gradient: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
      icon: Boxes,
      config: {
        type: 'file',
        title: '3D Character Showcase',
        file_name: 'Cyber_Explorer_Rig.glb',
        file_extension: 'glb',
        file_type: 'model/gltf-binary',
        is_3d: true,
        active_animation: 'walk',
        character_skin: 'cyber',
        content: 'Interactive 3D character showcase with Walk, Run, Jump, Idle, Wave & Spin animations. Drag & drop your own .GLB, .GLTF, .FBX, or .OBJ character file anytime.',
        color: 'blue',
        width: 410,
        height: 495,
      },
    },
    {
      type: 'file',
      label: 'File Attachment',
      description: 'PDF previews, attachments & uploads',
      price: 'Asset',
      category: 'Asset',
      gradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
      icon: FileText,
      config: { type: 'file', title: 'File Attachment' },
    },
    {
      type: 'sound_recorder',
      label: 'Sound Recorder',
      description: 'Record microphone audio to Cloud Storage, AI transcribe & translate',
      price: 'Audio AI',
      category: 'Audio',
      gradient: 'linear-gradient(135deg, #f87171 0%, #4f46e5 100%)',
      icon: Mic,
      config: {
        type: 'sound_recorder',
        title: 'Sound Recorder',
        width: 384,
        height: 264,
        target_language: 'English',
        transcript: '',
        translated_text: '',
        recordings: [],
        color: 'white',
      },
    },
    {
      type: 'embed',
      label: 'Web Embed',
      description: 'Spotify, YouTube, Instagram Reels, TikTok, X.com, Threads.com, Vimeo, SoundCloud & Pinterest embeds',
      price: 'Web Embed',
      category: 'Embed Media Social Audio Video Spotify YouTube Instagram Reel TikTok X Twitter Threads Pinterest',
      imageUrl: reel_item_image,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #10b981 100%)',
      icon: Music,
      config: {
        type: 'embed',
        title: 'Web Embed',
        platform: 'spotify',
        social_type: 'track',
        url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      },
    },
    {
      type: 'board',
      label: 'Nested Sub-Board',
      description: 'Deep spatial canvas workspace in canvas',
      price: 'Board',
      category: 'Board',
      gradient: 'linear-gradient(135deg, #ddd6fe 0%, #6d28d9 100%)',
      icon: FolderKanban,
      config: { type: 'board', title: 'Sub-Workspace' },
    },
  ];

  const normalized_search_query = card_search_query.trim().toLowerCase();
  const filtered_card_items = normalized_search_query
    ? CARD_CREATION_ITEMS.filter((item) => {
        const searchable_text = [
          item.label,
          item.description,
          item.category,
          item.price,
          item.type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable_text.includes(normalized_search_query);
      })
    : CARD_CREATION_ITEMS;

  return (
    <div
      className={`${styles['lumen-dock-container'] || styles.lumenDockContainer} ${
        is_drawing
          ? (styles['lumen-dock-container-drawing-hidden'] || styles.lumenDockContainerDrawingHidden || '')
          : ''
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      data-lumen-menu="true"
    >
      <div className={styles['lumen-dock-bar'] || styles.lumenDockBar}>
        {/* Toggle between Pointer (Cursor) and Hand (Pan) tool */}
        <button
          type="button"
          className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${
            is_hand_tool
              ? (styles['lumen-dock-btn-hand-active'] || styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive)
              : ''
          }`}
          onClick={handle_toggle_tool}
          title={
            is_hand_tool
              ? 'Hand Tool active: touch or drag anywhere to pan canvas. Click to switch to Cursor'
              : 'Cursor Tool active: click/drag cards. Click to switch to Hand pan tool'
          }
          aria-label={is_hand_tool ? 'Switch to Cursor tool' : 'Switch to Hand tool'}
        >
          {is_hand_tool ? <Hand size={17} /> : <MousePointer size={17} />}
        </button>

        {/* Zoom & View Controller (Popup with Slider & Reset Zoom) */}
        <button
          ref={zoom_btn_ref}
          type="button"
          data-lumen-zoom-toggle="true"
          className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${
            is_zoom_popup_open ? (styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive) : ''
          }`}
          onClick={handle_toggle_zoom}
          title={`Zoom (${Math.round(current_zoom * 100)}%) - Click for slider & reset`}
          aria-label="Toggle zoom popup slider and reset"
        >
          <ZoomIn size={17} />
        </button>

        {/* Add Card Menu Trigger (Editable Only) */}
        {!read_only && (
          <button
            type="button"
            data-lumen-dock-toggle="true"
            className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${is_card_menu_open ? (styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive) : ''}`}
            onClick={() => {
              ensure_exit_drawing_mode();
              const next_open = !is_card_menu_open;
              set_is_card_menu_open(next_open);
              if (next_open) {
                set_card_search_query('');
                setTimeout(() => {
                  card_search_input_ref.current?.focus();
                }, 40);
              }
              set_is_zoom_popup_open(false);
              closeLayerPanel();
              closeBoardSettingsPanel();
            }}
            title="Add New Card (N)"
          >
            <Plus size={18} />
          </button>
        )}

        {/* Freehand Drawing Mode (Editable Only) */}
        {!read_only && (
          <button
            type="button"
            className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${is_drawing ? (styles['lumen-dock-btn-draw-active'] || styles.lumenDockBtnDrawActive) : ''}`}
            onClick={() => {
              set_is_card_menu_open(false);
              set_is_zoom_popup_open(false);
              closeLayerPanel();
              closeBoardSettingsPanel();
              if (isDrawingModeSignal.value) {
                exitDrawingSession();
              } else {
                isDrawingModeSignal.value = true;
              }
            }}
            title="Draw on Canvas (D)"
          >
            <PenTool size={17} />
          </button>
        )}

        <div className={styles['lumen-dock-divider'] || styles.lumenDockDivider} />

        {/* Layer Panel */}
        <button
          type="button"
          className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${is_layer_open ? (styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive) : ''}`}
          onClick={() => {
            ensure_exit_drawing_mode();
            set_is_card_menu_open(false);
            set_is_zoom_popup_open(false);
            closeBoardSettingsPanel();
            toggleLayerPanel();
          }}
          title="Toggle Layers Panel"
        >
          <Layers size={17} />
        </button>

        {/* Board Settings Panel */}
        <button
          type="button"
          className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${is_settings_open ? (styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive) : ''}`}
          onClick={() => {
            ensure_exit_drawing_mode();
            set_is_card_menu_open(false);
            set_is_zoom_popup_open(false);
            closeLayerPanel();
            toggleBoardSettingsPanel();
          }}
          title="Toggle Board Settings"
        >
          <Settings size={17} />
        </button>

        {/* Activity & Collaboration History Log */}
        <button
          type="button"
          className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${isActivityDrawerOpenSignal.value ? (styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive) : ''}`}
          onClick={() => {
            ensure_exit_drawing_mode();
            set_is_card_menu_open(false);
            set_is_zoom_popup_open(false);
            closeLayerPanel();
            closeBoardSettingsPanel();
            if (!isActivityDrawerOpenSignal.value) {
              isAiPanelOpenSignal.value = false;
            }
            toggleActivityDrawer();
          }}
          title="Toggle Activity & Collaboration History Log"
        >
          <History size={17} />
        </button>

        {/* AI Co-Pilot Assistant */}
        <button
          type="button"
          className={`${styles['lumen-dock-btn'] || styles.lumenDockBtn} ${
            styles['lumen-dock-btn-ai'] || styles.lumenDockBtnAi
          } ${is_ai_open ? (styles['lumen-dock-btn-active'] || styles.lumenDockBtnActive) : ''} ${
            is_ai_working ? styles['lumen-dock-btn-ai-working'] : ''
          }`}
          onClick={() => {
            ensure_exit_drawing_mode();
            set_is_card_menu_open(false);
            set_is_zoom_popup_open(false);
            closeLayerPanel();
            closeBoardSettingsPanel();
            if (!is_ai_open) {
              isActivityDrawerOpenSignal.value = false;
            }
            toggleAiPanel();
          }}
          title={is_ai_working ? 'Lumen AI is working...' : 'Ask Lumen Board AI'}
        >
          {is_ai_working ? (
            <Loader2 size={17} className={styles['lumen-dock-ai-spin']} />
          ) : (
            <Sparkles size={17} />
          )}
        </button>
      </div>

      {/* Floating Card Type Selector Menu rendered into document.body to prevent any container truncation */}
      {is_card_menu_open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className={styles['lumen-dock-backdrop'] || styles.lumenDockBackdrop}
              onClick={() => set_is_card_menu_open(false)}
            />
            <div
              ref={card_menu_ref}
              className={styles['lumen-dock-card-menu'] || styles.lumenDockCardMenu}
              onWheel={(e) => e.stopPropagation()}
              data-lumen-menu="true"
            >
              {/* Mobile Bottom Sheet Pull Indicator */}
              <div className={styles['lumen-dock-pull-handle'] || styles.lumenDockPullHandle} />

              <div className={styles['lumen-dock-card-menu-header'] || styles.lumenDockCardMenuHeader}>
                <div className={styles['lumen-dock-card-menu-header-top'] || styles.lumenDockCardMenuHeaderTop}>
                  <div className={styles['lumen-dock-card-menu-title-wrap'] || styles.lumenDockCardMenuTitleWrap}>
                    <span className={styles['lumen-dock-card-menu-title'] || styles.lumenDockCardMenuTitle}>Add Modules</span>
                    <span className={styles['lumen-dock-card-menu-sub'] || styles.lumenDockCardMenuSub}>Drag onto canvas or tap + to add</span>
                  </div>
                  <button
                    type="button"
                    className={styles['lumen-dock-card-menu-close'] || styles.lumenDockCardMenuClose}
                    onClick={() => set_is_card_menu_open(false)}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search Input Bar for Add Modules Panel */}
                <div className={styles['lumen-dock-card-search-wrap'] || styles.lumenDockCardSearchWrap}>
                  <Search
                    size={15}
                    className={styles['lumen-dock-card-search-icon'] || styles.lumenDockCardSearchIcon}
                  />
                  <input
                    ref={card_search_input_ref}
                    type="text"
                    value={card_search_query}
                    onChange={(e) => set_card_search_query(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') {
                        if (card_search_query) {
                          set_card_search_query('');
                        } else {
                          set_is_card_menu_open(false);
                        }
                      } else if (e.key === 'Enter' && filtered_card_items.length > 0) {
                        e.preventDefault();
                        handle_add_card(filtered_card_items[0].config);
                      }
                    }}
                    placeholder="Search modules by name, category, or feature..."
                    className={styles['lumen-dock-card-search-input'] || styles.lumenDockCardSearchInput}
                    aria-label="Search modules"
                  />
                  {card_search_query && (
                    <>
                      <span className={styles['lumen-dock-card-search-count'] || styles.lumenDockCardSearchCount}>
                        {filtered_card_items.length}
                      </span>
                      <button
                        type="button"
                        className={styles['lumen-dock-card-search-clear'] || styles.lumenDockCardSearchClear}
                        onClick={() => {
                          set_card_search_query('');
                          card_search_input_ref.current?.focus();
                        }}
                        title="Clear search"
                        aria-label="Clear search"
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className={styles['lumen-dock-card-menu-scroll'] || styles.lumenDockCardMenuScroll}>
                {filtered_card_items.length === 0 ? (
                  <div className={styles['lumen-dock-card-empty'] || styles.lumenDockCardEmpty}>
                    <Search size={24} className={styles['lumen-dock-card-empty-icon'] || styles.lumenDockCardEmptyIcon} />
                    <p className={styles['lumen-dock-card-empty-title'] || styles.lumenDockCardEmptyTitle}>
                      No modules match &ldquo;{card_search_query.trim()}&rdquo;
                    </p>
                    <p className={styles['lumen-dock-card-empty-sub'] || styles.lumenDockCardEmptySub}>
                      Try searching for note, pdf, image, table, code, chart, or map.
                    </p>
                    <button
                      type="button"
                      className={styles['lumen-dock-card-empty-reset'] || styles.lumenDockCardEmptyReset}
                      onClick={() => {
                        set_card_search_query('');
                        card_search_input_ref.current?.focus();
                      }}
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  filtered_card_items.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={item.type}
                        role="button"
                        tabIndex={0}
                        draggable={true}
                        className={styles['lumen-dock-card-item'] || styles.lumenDockCardItem}
                        onClick={() => handle_add_card(item.config)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handle_add_card(item.config);
                          }
                        }}
                        onDragStart={(e) => {
                          closeLayerPanel();
                          closeBoardSettingsPanel();
                          const payload = JSON.stringify(item.config);
                          e.dataTransfer.setData('application/lumen-module', payload);
                          e.dataTransfer.setData('text/plain', payload);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => {
                          set_is_card_menu_open(false);
                        }}
                        title={`Click or drag onto canvas: ${item.label}`}
                      >
                        {/* Top Image Preview Box matching module-item-design.png */}
                        <div
                          className={styles['lumen-dock-card-image'] || styles.lumenDockCardImage}
                          style={{ background: item.gradient || '#8b5cf6' }}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.label}
                              className={styles['lumen-dock-card-img'] || styles.lumenDockCardImg}
                              loading="lazy"
                            />
                          ) : (
                            <IconComponent
                              size={28}
                              className={styles['lumen-dock-card-image-icon'] || styles.lumenDockCardImageIcon}
                            />
                          )}
                          <div className={styles['lumen-dock-card-drag-hint'] || styles.lumenDockCardDragHint}>
                            <GripVertical size={11} />
                            <span>Drag</span>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <div className={styles['lumen-dock-card-info'] || styles.lumenDockCardInfo}>
                          <h4 className={styles['lumen-dock-card-title'] || styles.lumenDockCardTitle}>{item.label}</h4>
                          <p className={styles['lumen-dock-card-desc'] || styles.lumenDockCardDesc}>{item.description}</p>
                        </div>

                        {/* Bottom Row: Price / Category & Action Buttons */}
                        <div className={styles['lumen-dock-card-bottom'] || styles.lumenDockCardBottom}>
                          <span className={styles['lumen-dock-card-price'] || styles.lumenDockCardPrice}>
                            {item.price || item.category || 'Free'}
                          </span>
                          <div className={styles['lumen-dock-card-actions'] || styles.lumenDockCardActions}>
                            <button
                              type="button"
                              className={styles['lumen-dock-card-encrypt-btn'] || styles.lumenDockCardEncryptBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                set_is_card_menu_open(false);
                                set_encrypt_modal_item(item);
                              }}
                              title={`Create Encrypted ${item.label} (Protected by Passkey)`}
                              aria-label={`Create Encrypted ${item.label}`}
                            >
                              <Lock size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles['lumen-dock-card-add-btn'] || styles.lumenDockCardAddBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handle_add_card(item.config);
                              }}
                              title={`Add ${item.label}`}
                              aria-label={`Add ${item.label}`}
                            >
                              <Plus size={16} strokeWidth={2.6} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}

      {/* Create Encrypted Card Modal */}
      <LUMEN_create_encrypted_card_modal
        is_open={Boolean(encrypt_modal_item)}
        type_item={encrypt_modal_item}
        on_close={() => set_encrypt_modal_item(null)}
        on_create_encrypted={handle_create_encrypted_card}
      />

      {/* Floating Zoom Popup with Slider and Reset Zoom */}
      <LUMEN_zoom_popup
        is_open={is_zoom_popup_open}
        on_close={() => set_is_zoom_popup_open(false)}
        anchor_ref={zoom_btn_ref}
        position_mode="dock"
      />
    </div>
  );
}

export default LUMEN_dock;
export { LUMEN_dock as Dock };
