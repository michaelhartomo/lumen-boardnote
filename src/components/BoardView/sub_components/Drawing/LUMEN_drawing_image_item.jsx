import { useState, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Layers,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

import styles from './LUMEN_drawing_image_item.module.css';
import {
  activeBoardSignal,
  isDrawingModeSignal,
  drawingToolSignal,
  selectedDrawingImageIdSignal,
  updateDrawingImage,
  deleteDrawingImage,
  reorderDrawingImage,
  getUnifiedBoardLayers,
  showToast,
} from '../../signals/boardState.js';

export default function LUMEN_drawing_image_item({ item, layer_index = 0 }) {
  useSignals();

  const [is_rotating, set_is_rotating] = useState(false);
  const [live_rotation, set_live_rotation] = useState(null);

  const container_ref = useRef(null);

  if (!item || item.visible === false) {
    return null;
  }

  const is_drawing_mode = Boolean(isDrawingModeSignal.value);
  const is_selected = selectedDrawingImageIdSignal.value === item.id;
  const current_tool = drawingToolSignal.value;
  const is_select_tool_active = current_tool === 'select';
  const is_interactive = Boolean(is_drawing_mode && is_select_tool_active);
  const show_transform_gizmo = is_selected && is_interactive;

  const current_rot = live_rotation !== null ? live_rotation : (item.rotation || 0);
  const flip_x = item.flipHorizontal ? -1 : 1;
  const flip_y = item.flipVertical ? -1 : 1;

  // Drag to Move on Canvas (only when Select/Pointer tool is active in drawing mode)
  const handle_pointer_down_move = (e) => {
    if (!is_interactive) return;
    // Only primary button
    if (e.button !== 0) return;
    e.stopPropagation();

    selectedDrawingImageIdSignal.value = item.id;

    if (item.locked) return;

    const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const start_x = item.x;
    const start_y = item.y;
    const start_client_x = e.clientX;
    const start_client_y = e.clientY;

    const on_pointer_move = (move_evt) => {
      const cur_vp = activeBoardSignal.value?.viewport || vp;
      const dx = (move_evt.clientX - start_client_x) / cur_vp.zoom;
      const dy = (move_evt.clientY - start_client_y) / cur_vp.zoom;
      updateDrawingImage(item.id, {
        x: Math.round(start_x + dx),
        y: Math.round(start_y + dy),
      }, false);
    };

    const on_pointer_up = () => {
      window.removeEventListener('pointermove', on_pointer_move);
      window.removeEventListener('pointerup', on_pointer_up);
      window.removeEventListener('pointercancel', on_pointer_up);
      updateDrawingImage(item.id, {}, true); // record history snapshot
    };

    window.addEventListener('pointermove', on_pointer_move);
    window.addEventListener('pointerup', on_pointer_up);
    window.addEventListener('pointercancel', on_pointer_up);
  };

  // Corner Resize Handles (SE, SW, NE, NW)
  const handle_pointer_down_resize = (e, corner) => {
    e.stopPropagation();
    if (item.locked) return;

    const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const w0 = item.width;
    const h0 = item.height;
    const x0 = item.x;
    const y0 = item.y;
    const start_client_x = e.clientX;
    const start_client_y = e.clientY;
    const aspect_ratio = w0 / Math.max(1, h0);
    const lock_aspect = item.aspectRatioLocked || e.shiftKey;

    const on_resize_move = (move_evt) => {
      const cur_vp = activeBoardSignal.value?.viewport || vp;
      const dx = (move_evt.clientX - start_client_x) / cur_vp.zoom;
      const dy = (move_evt.clientY - start_client_y) / cur_vp.zoom;

      let next_w = w0;
      let next_h = h0;
      let next_x = x0;
      let next_y = y0;

      if (corner === 'se') {
        if (lock_aspect) {
          const max_d = Math.max(dx, dy * aspect_ratio);
          next_w = Math.max(24, Math.round(w0 + max_d));
          next_h = Math.max(24, Math.round(next_w / aspect_ratio));
        } else {
          next_w = Math.max(24, Math.round(w0 + dx));
          next_h = Math.max(24, Math.round(h0 + dy));
        }
      } else if (corner === 'sw') {
        if (lock_aspect) {
          const max_d = Math.max(-dx, dy * aspect_ratio);
          next_w = Math.max(24, Math.round(w0 + max_d));
          next_h = Math.max(24, Math.round(next_w / aspect_ratio));
          next_x = Math.round(x0 + (w0 - next_w));
        } else {
          next_w = Math.max(24, Math.round(w0 - dx));
          next_h = Math.max(24, Math.round(h0 + dy));
          next_x = Math.round(x0 + dx);
        }
      } else if (corner === 'ne') {
        if (lock_aspect) {
          const max_d = Math.max(dx, -dy * aspect_ratio);
          next_w = Math.max(24, Math.round(w0 + max_d));
          next_h = Math.max(24, Math.round(next_w / aspect_ratio));
          next_y = Math.round(y0 + (h0 - next_h));
        } else {
          next_w = Math.max(24, Math.round(w0 + dx));
          next_h = Math.max(24, Math.round(h0 - dy));
          next_y = Math.round(y0 + dy);
        }
      } else if (corner === 'nw') {
        if (lock_aspect) {
          const max_d = Math.max(-dx, -dy * aspect_ratio);
          next_w = Math.max(24, Math.round(w0 + max_d));
          next_h = Math.max(24, Math.round(next_w / aspect_ratio));
          next_x = Math.round(x0 + (w0 - next_w));
          next_y = Math.round(y0 + (h0 - next_h));
        } else {
          next_w = Math.max(24, Math.round(w0 - dx));
          next_h = Math.max(24, Math.round(h0 - dy));
          next_x = Math.round(x0 + dx);
          next_y = Math.round(y0 + dy);
        }
      }

      updateDrawingImage(item.id, {
        width: next_w,
        height: next_h,
        x: next_x,
        y: next_y,
      }, false);
    };

    const on_resize_up = () => {
      window.removeEventListener('pointermove', on_resize_move);
      window.removeEventListener('pointerup', on_resize_up);
      window.removeEventListener('pointercancel', on_resize_up);
      updateDrawingImage(item.id, {}, true); // record history
    };

    window.addEventListener('pointermove', on_resize_move);
    window.addEventListener('pointerup', on_resize_up);
    window.addEventListener('pointercancel', on_resize_up);
  };

  // Top Rotation Knob
  const handle_pointer_down_rotate = (e) => {
    e.stopPropagation();
    if (item.locked) return;

    set_is_rotating(true);

    const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const center_x = item.x + item.width / 2;
    const center_y = item.y + item.height / 2;

    const on_rotate_move = (move_evt) => {
      // Find canvas container rect
      const canvas_el = document.getElementById('lumen-canvas-main');
      const rect = canvas_el ? canvas_el.getBoundingClientRect() : { left: 0, top: 0 };
      const cur_vp = activeBoardSignal.value?.viewport || vp;

      const pointer_x = (move_evt.clientX - rect.left - cur_vp.panX) / cur_vp.zoom;
      const pointer_y = (move_evt.clientY - rect.top - cur_vp.panY) / cur_vp.zoom;

      const angle_rad = Math.atan2(pointer_y - center_y, pointer_x - center_x);
      // Offset by 90deg because rotation knob is positioned at the top
      let deg = Math.round(((angle_rad + Math.PI / 2) * 180) / Math.PI);
      deg = ((deg % 360) + 360) % 360;

      // Snap to 15deg increments if Shift is held
      if (move_evt.shiftKey) {
        deg = Math.round(deg / 15) * 15;
      }

      set_live_rotation(deg);
      updateDrawingImage(item.id, { rotation: deg }, false);
    };

    const on_rotate_up = () => {
      set_is_rotating(false);
      set_live_rotation(null);
      window.removeEventListener('pointermove', on_rotate_move);
      window.removeEventListener('pointerup', on_rotate_up);
      window.removeEventListener('pointercancel', on_rotate_up);
      updateDrawingImage(item.id, {}, true); // record history
    };

    window.addEventListener('pointermove', on_rotate_move);
    window.addEventListener('pointerup', on_rotate_up);
    window.addEventListener('pointercancel', on_rotate_up);
  };

  // Delete layer directly from interactive canvas gizmo
  const handle_delete_layer = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (item.locked) {
      showToast('Unlock layer to delete');
      return;
    }
    deleteDrawingImage(item.id);
  };

  // Flip image layer horizontally directly from interactive gizmo
  const handle_flip_horizontal = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (item.locked) {
      showToast('Unlock layer to flip');
      return;
    }
    updateDrawingImage(item.id, { flipHorizontal: !item.flipHorizontal }, true);
  };

  // Flip image layer vertically directly from interactive gizmo
  const handle_flip_vertical = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (item.locked) {
      showToast('Unlock layer to flip');
      return;
    }
    updateDrawingImage(item.id, { flipVertical: !item.flipVertical }, true);
  };

  // Reorder z-index layer hierarchy directly from interactive gizmo
  const handle_reorder_layer = (e, direction) => {
    e.stopPropagation();
    e.preventDefault();
    if (item.locked) {
      showToast('Unlock layer to change hierarchy');
      return;
    }
    reorderDrawingImage(item.id, direction);
  };

  const cursor_class = is_interactive
    ? item.locked
      ? styles['lumen-drawing-image-locked']
      : styles['lumen-drawing-image-move-cursor']
    : '';

  // Calculate bottom position of the interactive image border in canvas coordinates
  // so the action buttons island always stays horizontal at the visual bottom without rotating
  const rad = ((current_rot || 0) * Math.PI) / 180;
  const hw = (item.width || 0) / 2;
  const hh = (item.height || 0) / 2;
  const max_dy = Math.abs(hw * Math.sin(rad)) + Math.abs(hh * Math.cos(rad));
  const island_x = Math.round(item.x + hw);
  const island_y = Math.round(item.y + hh + max_dy + 12);

  // Unified stacking calculation with cards
  const unified_layers = getUnifiedBoardLayers(activeBoardSignal.value);
  const total_layers = Math.max(1, unified_layers.length);
  const unified_idx = unified_layers.findIndex((l) => l.id === item.id);
  const layer_pos = unified_idx !== -1 ? total_layers - unified_idx : Math.max(1, layer_index + 1);

  const item_z = typeof item.zIndex === 'number' ? item.zIndex : (layer_index + 1);
  const base_z = Math.max(0, item_z) * 10 + 2;
  const visual_z = (is_selected ? 70 : 0) + base_z + (is_selected ? 4 : 0);

  const is_at_bottom = layer_pos <= 1;
  const is_at_top = layer_pos >= total_layers;

  return (
    <>
      <div
        ref={container_ref}
        data-lumen-drawing-image="true"
        className={`${styles['lumen-drawing-image-container']} ${cursor_class}`}
        style={{
          left: `${item.x}px`,
          top: `${item.y}px`,
          width: `${item.width}px`,
          height: `${item.height}px`,
          transform: `rotate(${current_rot}deg)`,
          transformOrigin: 'center center',
          opacity: item.opacity !== undefined ? item.opacity : 1,
          zIndex: visual_z,
          pointerEvents: is_interactive ? 'auto' : 'none',
        }}
        onPointerDown={is_interactive ? handle_pointer_down_move : undefined}
      >
        {/* Real image with full PNG transparency support */}
        <img
          src={item.src}
          alt={item.name || 'Drawing layer'}
          className={styles['lumen-drawing-image-element']}
          style={{
            pointerEvents: is_interactive ? 'auto' : 'none',
            transform: `scale(${flip_x}, ${flip_y})`,
            transformOrigin: 'center center',
          }}
          draggable={false}
          onError={() => {
            if (typeof item.src === 'string' && item.src.includes('/api/files/')) {
              deleteDrawingImage(item.id);
            }
          }}
        />

        {/* Interactive Transform Bounding Box & Handles (only when Pointer/Select tool is active) */}
        {show_transform_gizmo && (
          <div className={styles['lumen-image-transform-box']}>
            {/* Degree badge tooltip while actively rotating */}
            {is_rotating && (
              <div className={styles['lumen-image-degree-badge']}>
                {current_rot}°
              </div>
            )}

            {/* Top Rotation Knob & Indicator Stem */}
            {!item.locked && (
              <>
                <div className={styles['lumen-image-rotation-stem']} />
                <div
                  data-lumen-transform-handle="true"
                  className={`${styles['lumen-image-rotation-knob']} ${
                    is_rotating ? styles['lumen-image-rotation-knob-active'] : ''
                  }`}
                  onPointerDown={handle_pointer_down_rotate}
                  title="Drag to rotate image layer (Hold Shift to snap 15°)"
                />
              </>
            )}

            {/* 4 Corner Resize Handles */}
            {!item.locked && (
              <>
                <div
                  data-lumen-transform-handle="true"
                  className={`${styles['lumen-image-handle']} ${styles['lumen-image-handle-nw']}`}
                  onPointerDown={(e) => handle_pointer_down_resize(e, 'nw')}
                  title="Resize Top-Left"
                />
                <div
                  data-lumen-transform-handle="true"
                  className={`${styles['lumen-image-handle']} ${styles['lumen-image-handle-ne']}`}
                  onPointerDown={(e) => handle_pointer_down_resize(e, 'ne')}
                  title="Resize Top-Right"
                />
                <div
                  data-lumen-transform-handle="true"
                  className={`${styles['lumen-image-handle']} ${styles['lumen-image-handle-sw']}`}
                  onPointerDown={(e) => handle_pointer_down_resize(e, 'sw')}
                  title="Resize Bottom-Left"
                />
                <div
                  data-lumen-transform-handle="true"
                  className={`${styles['lumen-image-handle']} ${styles['lumen-image-handle-se']}`}
                  onPointerDown={(e) => handle_pointer_down_resize(e, 'se')}
                  title="Resize Bottom-Right"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons Island (Flip, Z-Index Reorder & Delete) - Always stays at the bottom of the interactive image border */}
      {show_transform_gizmo && (
        <div
          data-lumen-transform-handle="true"
          className={styles['lumen-image-gizmo-zindex-bar']}
          style={{
            left: `${island_x}px`,
            top: `${island_y}px`,
            zIndex: Math.max(visual_z + 15, 950),
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Flip Horizontal */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-zindex-btn']} ${
              item.flipHorizontal ? styles['lumen-gizmo-flip-btn-active'] : ''
            } ${item.locked ? styles['lumen-gizmo-zindex-btn-disabled'] : ''}`}
            onClick={handle_flip_horizontal}
            title={item.locked ? 'Layer is locked' : 'Flip Horizontal (Mirror X)'}
            aria-label="Flip Horizontal"
            aria-pressed={Boolean(item.flipHorizontal)}
            disabled={item.locked}
          >
            <FlipHorizontal size={13} strokeWidth={2.2} />
          </button>

          {/* Flip Vertical */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-zindex-btn']} ${
              item.flipVertical ? styles['lumen-gizmo-flip-btn-active'] : ''
            } ${item.locked ? styles['lumen-gizmo-zindex-btn-disabled'] : ''}`}
            onClick={handle_flip_vertical}
            title={item.locked ? 'Layer is locked' : 'Flip Vertical (Mirror Y)'}
            aria-label="Flip Vertical"
            aria-pressed={Boolean(item.flipVertical)}
            disabled={item.locked}
          >
            <FlipVertical size={13} strokeWidth={2.2} />
          </button>

          {/* Divider */}
          <div className={styles['lumen-gizmo-divider']} />

          {/* Send to Back */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-zindex-btn']} ${
              is_at_bottom ? styles['lumen-gizmo-zindex-btn-disabled'] : ''
            }`}
            onClick={(e) => handle_reorder_layer(e, 'back')}
            title={is_at_bottom ? 'Already at back' : 'Send to back'}
            aria-label="Send to back"
            disabled={is_at_bottom}
          >
            <ChevronsDown size={13} strokeWidth={2.2} />
          </button>

          {/* Send Backward (Down) */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-zindex-btn']} ${
              is_at_bottom ? styles['lumen-gizmo-zindex-btn-disabled'] : ''
            }`}
            onClick={(e) => handle_reorder_layer(e, 'down')}
            title={is_at_bottom ? 'Already at bottom' : 'Send backward (Down)'}
            aria-label="Send backward"
            disabled={is_at_bottom}
          >
            <ChevronDown size={13} strokeWidth={2.2} />
          </button>

          {/* Layer Depth Badge */}
          <div
            className={styles['lumen-gizmo-zindex-badge']}
            title={`Layer ${layer_pos} of ${total_layers}`}
          >
            <Layers size={11} strokeWidth={2} />
            <span className={styles['lumen-gizmo-zindex-text']}>
              {layer_pos}/{total_layers}
            </span>
          </div>

          {/* Bring Forward (Up) */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-zindex-btn']} ${
              is_at_top ? styles['lumen-gizmo-zindex-btn-disabled'] : ''
            }`}
            onClick={(e) => handle_reorder_layer(e, 'up')}
            title={is_at_top ? 'Already at top' : 'Bring forward (Up)'}
            aria-label="Bring forward"
            disabled={is_at_top}
          >
            <ChevronUp size={13} strokeWidth={2.2} />
          </button>

          {/* Bring to Front */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-zindex-btn']} ${
              is_at_top ? styles['lumen-gizmo-zindex-btn-disabled'] : ''
            }`}
            onClick={(e) => handle_reorder_layer(e, 'front')}
            title={is_at_top ? 'Already at front' : 'Bring to front'}
            aria-label="Bring to front"
            disabled={is_at_top}
          >
            <ChevronsUp size={13} strokeWidth={2.2} />
          </button>

          {/* Divider */}
          <div className={styles['lumen-gizmo-divider']} />

          {/* Delete Layer Button */}
          <button
            type="button"
            className={`${styles['lumen-gizmo-delete-btn']} ${
              item.locked ? styles['lumen-gizmo-delete-btn-locked'] : ''
            }`}
            onClick={handle_delete_layer}
            title={item.locked ? 'Layer is locked (Unlock in layers panel)' : 'Delete image layer'}
            aria-label="Delete image layer"
            disabled={item.locked}
          >
            <Trash2 size={13} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </>
  );
}
