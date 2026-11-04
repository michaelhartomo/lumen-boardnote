import { useState, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Layers,
  X,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  FileText,
  StickyNote,
  CheckSquare,
  Image as ImageIcon,
  PenTool,
  Link2,
  Table,
  Palette,
  Code2,
  Plus,
  Mic,
  Radio,
  Calendar,
  Clock,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

import styles from './LUMEN_layer_panel.module.css';
import {
  activeBoardSignal,
  selectedCardsSignal,
  selectedDrawingImageIdSignal,
  isDrawingModeSignal,
  drawingToolSignal,
  toggleCardLock,
  toggleCardVisibility,
  toggleDrawingImageLock,
  toggleDrawingImageVisibility,
  updateDrawingImage,
  moveUnifiedLayer,
  reorderUnifiedLayers,
  deleteCard,
  deleteDrawingImage,
  addDrawingImage,
  getUnifiedBoardLayers,
  closeLayerPanel,
  showToast,
  activeTimeRangeFilterSignal,
  setTimeRangeFilter,
} from '../../signals/boardState.js';
import { does_card_match_time_filter } from '../../utils/googleCalendarSync.js';

function get_layer_icon(layer) {
  if (layer.kind === 'drawing_image') {
    return <ImageIcon size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
  }

  switch (layer.type) {
    case 'note':
      return <StickyNote size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'tasklist':
      return <CheckSquare size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'image':
      return <ImageIcon size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'canvas':
      return <PenTool size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'link':
      return <Link2 size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'table':
    case 'sheets':
      return <Table size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'code':
      return <Code2 size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'palette':
      return <Palette size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'sound_recorder':
      return <Mic size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    case 'embed':
    case 'social':
      return <Radio size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
    default:
      return <FileText size={13} className={styles['lumen-layer-icon'] || styles.lumenLayerIcon} />;
  }
}

export function LUMEN_layer_panel() {
  useSignals();
  const [filter_text, set_filter_text] = useState('');
  const [dragged_id, set_dragged_id] = useState(null);
  const [drop_target, set_drop_target] = useState(null); // { id: string, position: 'before' | 'after' }

  const touch_drag_ref = useRef(null);
  const file_input_ref = useRef(null);

  const active_board = activeBoardSignal.value;
  const active_time_filter = activeTimeRangeFilterSignal.value || { mode: 'all' };
  const board_cards_by_id = new Map((active_board?.cards || []).map((c) => [c.id, c]));

  // Unified layers: Cards and PNG Stickers sorted Top to Bottom (highest zIndex first)
  const unified_layers = getUnifiedBoardLayers(active_board);
  const selected_card_ids = selectedCardsSignal.value || [];
  const selected_image_id = selectedDrawingImageIdSignal.value;

  const filtered_layers = unified_layers.filter((l) => {
    if (filter_text.trim()) {
      const title = (l.title || l.type || '').toLowerCase();
      if (!title.includes(filter_text.toLowerCase())) return false;
    }
    if (active_time_filter.mode && active_time_filter.mode !== 'all') {
      if (l.kind !== 'card') return false;
      const card_obj = board_cards_by_id.get(l.id);
      if (!card_obj || !does_card_match_time_filter(card_obj, active_time_filter)) {
        return false;
      }
    }
    return true;
  });

  const handle_select_layer = (layer) => {
    if (layer.kind === 'card') {
      selectedCardsSignal.value = [layer.id];
      selectedDrawingImageIdSignal.value = null;
    } else {
      selectedDrawingImageIdSignal.value = layer.id;
      selectedCardsSignal.value = [];
      // Seamlessly activate drawing select mode so gizmo shows up to decorate card
      isDrawingModeSignal.value = true;
      drawingToolSignal.value = 'select';
    }
  };

  const handle_reorder = (source_id, target_id, position) => {
    if (!source_id || !target_id || source_id === target_id) return;
    const current_ordered_ids = unified_layers.map((l) => l.id);
    const from_idx = current_ordered_ids.indexOf(source_id);
    if (from_idx === -1) return;

    const new_ids = [...current_ordered_ids];
    new_ids.splice(from_idx, 1);

    const to_idx = new_ids.indexOf(target_id);
    if (to_idx === -1) return;

    const insert_idx = position === 'before' ? to_idx : to_idx + 1;
    new_ids.splice(insert_idx, 0, source_id);

    reorderUnifiedLayers(new_ids);
  };

  // Upload a PNG or transparent sticker image directly into drawing image layer
  const handle_upload_sticker = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (load_evt) => {
      const raw_data_url = load_evt.target?.result;
      if (!raw_data_url) return;

      const img = new Image();
      img.onload = () => {
        const natural_w = img.naturalWidth || 320;
        const natural_h = img.naturalHeight || 240;
        let w = natural_w;
        let h = natural_h;
        const max_dim = 360;

        if (w > max_dim || h > max_dim) {
          const scale = Math.min(max_dim / w, max_dim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        let final_data_url = raw_data_url;
        try {
          const max_store_dim = 1200;
          if (natural_w > max_store_dim || natural_h > max_store_dim || file.size > 800000) {
            const canvas = document.createElement('canvas');
            const store_scale = Math.min(max_store_dim / natural_w, max_store_dim / natural_h, 1);
            canvas.width = Math.round(natural_w * store_scale);
            canvas.height = Math.round(natural_h * store_scale);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            final_data_url = canvas.toDataURL('image/png');
          }
        } catch (_) {}

        const clean_name = file.name.replace(/\.[^/.]+$/, '');
        addDrawingImage({
          src: final_data_url,
          name: clean_name,
          width: Math.max(40, w),
          height: Math.max(40, h),
          naturalWidth: natural_w,
          naturalHeight: natural_h,
        });

        isDrawingModeSignal.value = true;
        drawingToolSignal.value = 'select';

        if (file_input_ref.current) {
          file_input_ref.current.value = '';
        }
      };
      img.src = raw_data_url;
    };
    reader.readAsDataURL(file);
  };

  // HTML5 Drag Handlers
  const handle_drag_start = (e, item_id) => {
    set_dragged_id(item_id);
    e.dataTransfer.setData('application/lumen-layer-id', item_id);
    e.dataTransfer.setData('text/plain', item_id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handle_drag_over = (e, target_id) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (target_id === dragged_id) {
      if (drop_target) set_drop_target(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const is_before = e.clientY - rect.top < rect.height / 2;
    const pos = is_before ? 'before' : 'after';

    if (!drop_target || drop_target.id !== target_id || drop_target.position !== pos) {
      set_drop_target({ id: target_id, position: pos });
    }
  };

  const handle_drop = (e, target_id) => {
    e.preventDefault();
    e.stopPropagation();
    const source_id = e.dataTransfer.getData('application/lumen-layer-id') || dragged_id;
    if (source_id && target_id && source_id !== target_id && drop_target) {
      handle_reorder(source_id, target_id, drop_target.position);
    }
    set_dragged_id(null);
    set_drop_target(null);
  };

  const handle_drag_end = () => {
    set_dragged_id(null);
    set_drop_target(null);
  };

  // Touch Drag Handlers (for mobile touchscreen reordering)
  const handle_touch_start = (item_id, e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touch_drag_ref.current = {
      item_id,
      startX: t.clientX,
      startY: t.clientY,
      is_dragging: false,
    };
  };

  const handle_touch_move = (e) => {
    if (!touch_drag_ref.current) return;
    const t = e.touches[0];
    const dy = Math.abs(t.clientY - touch_drag_ref.current.startY);
    const dx = Math.abs(t.clientX - touch_drag_ref.current.startX);

    if (dy > 6 || dx > 6) {
      touch_drag_ref.current.is_dragging = true;
      set_dragged_id(touch_drag_ref.current.item_id);

      const el = document.elementFromPoint(t.clientX, t.clientY);
      const row = el?.closest('[data-layer-id]');
      if (row) {
        const target_id = row.getAttribute('data-layer-id');
        if (target_id && target_id !== touch_drag_ref.current.item_id) {
          const rect = row.getBoundingClientRect();
          const is_before = t.clientY - rect.top < rect.height / 2;
          set_drop_target({ id: target_id, position: is_before ? 'before' : 'after' });
          if (e.cancelable) e.preventDefault();
          return;
        }
      }
      set_drop_target(null);
    }
  };

  const handle_touch_end = () => {
    if (touch_drag_ref.current?.is_dragging && drop_target) {
      handle_reorder(touch_drag_ref.current.item_id, drop_target.id, drop_target.position);
    }
    touch_drag_ref.current = null;
    set_dragged_id(null);
    set_drop_target(null);
  };

  return (
    <aside
      className={styles['lumen-layer-panel'] || styles.lumenLayerPanel}
      aria-label="Layers Panel"
      onWheel={(e) => e.stopPropagation()}
      data-lumen-menu="true"
    >
      <div className={styles['lumen-layer-header'] || styles.lumenLayerHeader}>
        <div className={styles['lumen-layer-title'] || styles.lumenLayerTitle}>
          <Layers size={14} />
          <span>Layers ({unified_layers.length})</span>
        </div>

        <div className={styles['lumen-layer-header-actions'] || styles.lumenLayerHeaderActions}>
          {/* Direct Add PNG Sticker Button */}
          <button
            type="button"
            className={styles['lumen-layer-add-sticker-btn'] || styles.lumenLayerAddStickerBtn}
            onClick={() => file_input_ref.current?.click()}
            title="Upload PNG Sticker or image to decorate cards"
          >
            <Plus size={12} />
            <span>Sticker</span>
          </button>
          <input
            ref={file_input_ref}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handle_upload_sticker}
          />

          <button
            type="button"
            className={styles['lumen-layer-close-btn'] || styles.lumenLayerCloseBtn}
            onClick={closeLayerPanel}
            title="Close Layers Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={styles['lumen-layer-search-box'] || styles.lumenLayerSearchBox}>
        <input
          type="text"
          placeholder="Filter cards & stickers..."
          value={filter_text}
          onChange={(e) => set_filter_text(e.target.value)}
          className={styles['lumen-layer-search-input'] || styles.lumenLayerSearchInput}
        />
      </div>

      <div className={styles['lumen-layer-time-filter-bar'] || styles.lumenLayerTimeFilterBar}>
        {[
          { id: 'all', label: 'All' },
          { id: 'has_time_range', label: 'Scheduled' },
          { id: 'active_now', label: 'Active' },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'synced_gcal', label: 'GCal' },
        ].map((chip) => {
          const is_chip_active = (active_time_filter.mode || 'all') === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={`${styles['lumen-layer-time-filter-chip'] || styles.lumenLayerTimeFilterChip} ${
                is_chip_active ? (styles['lumen-layer-time-filter-chip-active'] || styles.lumenLayerTimeFilterChipActive) : ''
              }`}
              onClick={() => setTimeRangeFilter({ mode: chip.id })}
              title={`Filter board & layers by ${chip.label}`}
            >
              {chip.id === 'synced_gcal' ? <Calendar size={10} /> : chip.id !== 'all' ? <Clock size={10} /> : null}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className={styles['lumen-layer-list'] || styles.lumenLayerList}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            set_drop_target(null);
          }
        }}
      >
        {filtered_layers.map((layer) => {
          const is_selected =
            layer.kind === 'card'
              ? selected_card_ids.includes(layer.id)
              : selected_image_id === layer.id;
          const is_locked = Boolean(layer.isLocked);
          const is_hidden = Boolean(layer.isHidden);
          const is_being_dragged = dragged_id === layer.id;
          const is_drop_target = drop_target && drop_target.id === layer.id;
          const is_sticker = layer.kind === 'drawing_image';
          const card_obj = !is_sticker ? board_cards_by_id.get(layer.id) : null;
          const card_time_start = card_obj?.time_range_start || card_obj?.timeRangeStart || '';
          const card_time_end = card_obj?.time_range_end || card_obj?.timeRangeEnd || '';
          const has_card_time = Boolean(card_time_start || card_time_end);
          const is_gcal_synced = Boolean(card_obj?.calendar_event_id);

          return (
            <div
              key={layer.id}
              data-layer-id={layer.id}
              draggable={true}
              onDragStart={(e) => handle_drag_start(e, layer.id)}
              onDragOver={(e) => handle_drag_over(e, layer.id)}
              onDrop={(e) => handle_drop(e, layer.id)}
              onDragEnd={handle_drag_end}
              title="Drag to reorder card and sticker stacking"
              className={`${styles['lumen-layer-item'] || styles.lumenLayerItem} ${
                is_selected ? (styles['lumen-layer-item-active'] || styles.lumenLayerItemActive) : ''
              } ${is_being_dragged ? (styles['lumen-layer-item-dragging'] || styles.lumenLayerItemDragging) : ''}`}
              onClick={() => handle_select_layer(layer)}
            >
              {/* Visual Drop Line Insertion Indicator */}
              {is_drop_target && (
                <div
                  className={
                    drop_target.position === 'before'
                      ? (styles['lumen-layer-drop-line-top'] || styles.lumenLayerDropLineTop)
                      : (styles['lumen-layer-drop-line-bottom'] || styles.lumenLayerDropLineBottom)
                  }
                  aria-hidden="true"
                />
              )}

              {/* Line 1: Header row with Drag Handle, Thumbnail/Icon, Title, and Badge */}
              <div className={styles['lumen-layer-item-top'] || styles.lumenLayerItemTop}>
                {/* Drag Grip Handle */}
                <div
                  className={styles['lumen-layer-drag-handle'] || styles.lumenLayerDragHandle}
                  title="Drag handle: reorder layer"
                  onTouchStart={(e) => handle_touch_start(layer.id, e)}
                  onTouchMove={handle_touch_move}
                  onTouchEnd={handle_touch_end}
                  onTouchCancel={handle_touch_end}
                >
                  <GripVertical size={14} />
                </div>

                {/* Thumbnail Preview for PNG Stickers & Image Cards */}
                {layer.src ? (
                  <img
                    src={layer.src}
                    alt={layer.title}
                    className={styles['lumen-layer-thumbnail'] || styles.lumenLayerThumbnail}
                    draggable={false}
                  />
                ) : (
                  get_layer_icon(layer)
                )}

                <span
                  className={styles['lumen-layer-item-title'] || styles.lumenLayerItemTitle}
                  title={layer.title || (is_sticker ? 'PNG Sticker' : 'Card')}
                >
                  {layer.title || (is_sticker ? 'PNG Sticker' : 'Card')}
                </span>

                <span
                  className={`${styles['lumen-layer-item-badge'] || styles.lumenLayerItemBadge} ${
                    is_sticker
                      ? (styles['lumen-layer-badge-sticker'] || styles.lumenLayerBadgeSticker)
                      : ''
                  }`}
                >
                  {is_sticker ? 'PNG Sticker' : (layer.type === 'embed' || layer.type === 'social' ? 'embed' : (layer.type || 'card'))}
                </span>
              </div>

              {has_card_time && (
                <div
                  className={styles['lumen-layer-item-time-row'] || styles.lumenLayerItemTimeRow}
                  title={`${card_time_start || 'Start'} → ${card_time_end || 'End'}`}
                >
                  <Clock size={10} style={{ flexShrink: 0, color: '#2563eb' }} />
                  <span className={styles['lumen-layer-item-time-text'] || styles.lumenLayerItemTimeText}>
                    {card_time_start || 'Start'} → {card_time_end || 'End'}
                  </span>
                  {is_gcal_synced && (
                    <span className={styles['lumen-layer-item-gcal-tag'] || styles.lumenLayerItemGcalTag}>
                      GCal
                    </span>
                  )}
                </div>
              )}

              {/* Line 2: Actions button toolbar row */}
              <div
                className={styles['lumen-layer-actions'] || styles.lumenLayerActions}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles['lumen-layer-actions-group'] || styles.lumenLayerActionsGroup}>
                  <button
                    type="button"
                    className={styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn}
                    onClick={() => moveUnifiedLayer(layer.id, 'up', true)}
                    title="Bring forward (Up)"
                  >
                    <ChevronUp size={13} />
                    <span>Up</span>
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn}
                    onClick={() => moveUnifiedLayer(layer.id, 'down', true)}
                    title="Send backward (Down)"
                  >
                    <ChevronDown size={13} />
                    <span>Down</span>
                  </button>
                </div>

                <div className={styles['lumen-layer-actions-group'] || styles.lumenLayerActionsGroup}>
                  {is_sticker && (
                    <>
                      <button
                        type="button"
                        className={`${styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn} ${
                          layer.raw?.flipHorizontal
                            ? (styles['lumen-layer-action-btn-active'] || styles.lumenLayerActionBtnActive)
                            : ''
                        }`}
                        onClick={() => {
                          if (is_locked) {
                            showToast('Unlock layer to flip');
                            return;
                          }
                          updateDrawingImage(
                            layer.id,
                            { flipHorizontal: !layer.raw?.flipHorizontal },
                            true,
                          );
                        }}
                        title="Flip Horizontal"
                      >
                        <FlipHorizontal size={12} />
                      </button>
                      <button
                        type="button"
                        className={`${styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn} ${
                          layer.raw?.flipVertical
                            ? (styles['lumen-layer-action-btn-active'] || styles.lumenLayerActionBtnActive)
                            : ''
                        }`}
                        onClick={() => {
                          if (is_locked) {
                            showToast('Unlock layer to flip');
                            return;
                          }
                          updateDrawingImage(
                            layer.id,
                            { flipVertical: !layer.raw?.flipVertical },
                            true,
                          );
                        }}
                        title="Flip Vertical"
                      >
                        <FlipVertical size={12} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={`${styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn} ${
                      is_locked ? (styles['lumen-layer-action-btn-active'] || styles.lumenLayerActionBtnActive) : ''
                    }`}
                    onClick={() => {
                      if (is_sticker) {
                        toggleDrawingImageLock(layer.id);
                      } else {
                        toggleCardLock(layer.id, true);
                      }
                    }}
                    title={is_locked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {is_locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                  </button>
                  <button
                    type="button"
                    className={`${styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn} ${
                      is_hidden ? (styles['lumen-layer-action-btn-active'] || styles.lumenLayerActionBtnActive) : ''
                    }`}
                    onClick={() => {
                      if (is_sticker) {
                        toggleDrawingImageVisibility(layer.id);
                      } else {
                        toggleCardVisibility(layer.id, true);
                      }
                    }}
                    title={is_hidden ? 'Show layer' : 'Hide layer'}
                  >
                    {is_hidden ? <EyeOff size={12} color="#94a3b8" /> : <Eye size={12} />}
                  </button>
                  <button
                    type="button"
                    className={`${styles['lumen-layer-action-btn'] || styles.lumenLayerActionBtn} ${
                      styles['lumen-layer-action-delete'] || styles.lumenLayerActionDelete
                    }`}
                    onClick={() => {
                      if (is_sticker) {
                        deleteDrawingImage(layer.id);
                      } else {
                        deleteCard(layer.id, true);
                      }
                    }}
                    title="Delete layer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default LUMEN_layer_panel;
