import { useState, useRef, useEffect, useCallback } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Compass, X } from 'lucide-react';
import styles from './Minimap.module.css';
import {
  activeBoardSignal,
  updateViewport,
  selectedCardsSignal,
  saveCurrentBoardToStore,
} from '../../signals/boardState.js';

export function LUMEN_minimap() {
  useSignals();
  const [is_mobile_open, set_is_mobile_open] = useState(false);
  const [is_dragging, set_is_dragging] = useState(false);

  const container_ref = useRef(null);
  const canvas_ref = useRef(null);
  const is_dragging_ref = useRef(false);
  const drag_offset_ref = useRef({ x: 0, y: 0 });
  const raf_id_ref = useRef(null);

  const active_board = activeBoardSignal.value || {};
  const cards = active_board.cards || [];
  const viewport = active_board.viewport || { panX: 0, panY: 0, zoom: 1 };
  const selected_ids = selectedCardsSignal.value || [];

  // Compute spatial bounding box of all cards
  let min_x = 0;
  let max_x = 3000;
  let min_y = 0;
  let max_y = 2000;

  if (cards.length > 0) {
    cards.forEach((c) => {
      min_x = Math.min(min_x, c.x);
      max_x = Math.max(max_x, c.x + (c.width || 300));
      min_y = Math.min(min_y, c.y);
      max_y = Math.max(max_y, c.y + (c.height || 200));
    });
  }

  // Margin around content
  const margin = 200;
  const content_w = Math.max(1000, max_x - min_x + margin * 2);
  const content_h = Math.max(800, max_y - min_y + margin * 2);

  const [canvas_size, set_canvas_size] = useState({ w: 180, h: 120 });

  useEffect(() => {
    const update_size = () => {
      if (canvas_ref.current) {
        const rect = canvas_ref.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          set_canvas_size({ w: rect.width, h: rect.height });
        }
      }
    };
    update_size();
    window.addEventListener('resize', update_size);
    return () => window.removeEventListener('resize', update_size);
  }, [is_mobile_open]);

  const minimap_w = canvas_size.w || 180;
  const minimap_h = canvas_size.h || 120;
  const scale_x = minimap_w / content_w;
  const scale_y = minimap_h / content_h;
  const scale = Math.min(scale_x, scale_y);

  // Viewport rect in minimap
  const window_w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const window_h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const current_zoom = viewport.zoom || 1;

  const vp_x = (-viewport.panX / current_zoom - (min_x - margin)) * scale;
  const vp_y = (-viewport.panY / current_zoom - (min_y - margin)) * scale;
  const vp_w = Math.max(10, (window_w / current_zoom) * scale);
  const vp_h = Math.max(8, (window_h / current_zoom) * scale);

  // Keep spatial parameters synchronized in refs for zero-latency direct drag
  const bounds_ref = useRef({ min_x, min_y, margin, scale, current_zoom, window_w, window_h });
  bounds_ref.current = { min_x, min_y, margin, scale, current_zoom, window_w, window_h };

  const canvas_rect_ref = useRef(null);

  // Synchronous real-time calculation and viewport update from screen client coordinates
  const apply_minimap_drag = (client_x, client_y) => {
    const rect = canvas_rect_ref.current || canvas_ref.current?.getBoundingClientRect();
    if (!rect) return;
    const click_x = client_x - rect.left;
    const click_y = client_y - rect.top;

    const {
      min_x: mx,
      min_y: my,
      margin: mg,
      scale: sc,
      current_zoom: cz,
      window_w: ww,
      window_h: wh,
    } = bounds_ref.current;

    const safe_scale = sc || 0.1;
    const zoom = cz || 1;

    // Target center of the camera viewport box in minimap coordinates
    const target_minimap_center_x = click_x - drag_offset_ref.current.x;
    const target_minimap_center_y = click_y - drag_offset_ref.current.y;

    // Convert from minimap coordinates back to board world coordinates
    const target_world_x = target_minimap_center_x / safe_scale + (mx - mg);
    const target_world_y = target_minimap_center_y / safe_scale + (my - mg);

    const new_pan_x = ww / 2 - target_world_x * zoom;
    const new_pan_y = wh / 2 - target_world_y * zoom;

    updateViewport(new_pan_x, new_pan_y, zoom);
  };

  // Mouse & Touch Drag Start Handler
  const handle_drag_start = (client_x, client_y, target, e) => {
    // Ignore clicks on header or buttons
    if (
      target?.closest('[class*="Header"]') ||
      target?.closest('[class*="header"]') ||
      target?.closest('button')
    ) {
      return;
    }

    if (e && e.button !== undefined && e.button !== 0) {
      return;
    }

    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    is_dragging_ref.current = true;
    set_is_dragging(true);
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }

    if (canvas_ref.current) {
      const rect = canvas_ref.current.getBoundingClientRect();
      canvas_rect_ref.current = rect;
      const click_x = client_x - rect.left;
      const click_y = client_y - rect.top;

      const is_box_target = Boolean(
        target?.closest('[class*="ViewportBox"]') ||
        target?.closest('[class*="viewport-box"]')
      );

      if (is_box_target) {
        // Grabbed directly inside the active viewport box: preserve offset from box center to avoid jumping
        const box_center_x = vp_x + vp_w / 2;
        const box_center_y = vp_y + vp_h / 2;
        drag_offset_ref.current = {
          x: click_x - box_center_x,
          y: click_y - box_center_y,
        };
      } else {
        // Clicked anywhere on the radar canvas: immediately center viewport and track cursor
        drag_offset_ref.current = { x: 0, y: 0 };
        apply_minimap_drag(client_x, client_y);
      }
    }

    let raf_id = null;
    let pending_coords = null;

    const flush_move = () => {
      raf_id = null;
      if (pending_coords && is_dragging_ref.current) {
        apply_minimap_drag(pending_coords.x, pending_coords.y);
      }
    };

    const handle_move = (move_evt) => {
      if (!is_dragging_ref.current) return;
      if (move_evt.cancelable) move_evt.preventDefault();
      const cx = move_evt.touches ? move_evt.touches[0].clientX : move_evt.clientX;
      const cy = move_evt.touches ? move_evt.touches[0].clientY : move_evt.clientY;

      pending_coords = { x: cx, y: cy };
      if (!raf_id) {
        raf_id = requestAnimationFrame(flush_move);
      }
    };

    const handle_end = () => {
      if (raf_id) {
        cancelAnimationFrame(raf_id);
        raf_id = null;
      }
      if (pending_coords && is_dragging_ref.current) {
        apply_minimap_drag(pending_coords.x, pending_coords.y);
        pending_coords = null;
      }
      is_dragging_ref.current = false;
      canvas_rect_ref.current = null;
      set_is_dragging(false);
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
      window.removeEventListener('mousemove', handle_move);
      window.removeEventListener('mouseup', handle_end);
      window.removeEventListener('touchmove', handle_move);
      window.removeEventListener('touchend', handle_end);
      saveCurrentBoardToStore();
    };

    window.addEventListener('mousemove', handle_move, { passive: false });
    window.addEventListener('mouseup', handle_end);
    window.addEventListener('touchmove', handle_move, { passive: false });
    window.addEventListener('touchend', handle_end);
  };

  return (
    <>
      <button
        type="button"
        className={styles['lumen-minimap-mobile-toggle'] || styles.lumenMinimapMobileToggle}
        onClick={(e) => {
          e.stopPropagation();
          set_is_mobile_open(!is_mobile_open);
        }}
        title="Toggle Radar Minimap"
        aria-label="Toggle Radar Minimap"
      >
        <Compass size={17} />
      </button>

      <div
        ref={container_ref}
        className={`${styles['lumen-minimap-container'] || styles.lumenMinimapContainer} ${
          is_mobile_open ? (styles['lumen-minimap-mobile-open'] || styles.lumenMinimapMobileOpen) : ''
        } ${is_dragging ? (styles['lumen-minimap-container-dragging'] || styles.lumenMinimapContainerDragging) : ''}`}
        title="Real-time Radar: Click or drag to pan workspace"
      >
        <div className={styles['lumen-minimap-header'] || styles.lumenMinimapHeader}>
          <span>Radar</span>
          <button
            type="button"
            className={styles['lumen-minimap-close-btn'] || styles.lumenMinimapCloseBtn}
            onClick={(e) => {
              e.stopPropagation();
              set_is_mobile_open(false);
            }}
            aria-label="Close minimap"
          >
            <X size={12} />
          </button>
        </div>

        <div
          ref={canvas_ref}
          className={`${styles['lumen-minimap-canvas'] || styles.lumenMinimapCanvas} ${
            is_dragging ? (styles['lumen-minimap-canvas-dragging'] || styles.lumenMinimapCanvasDragging) : ''
          }`}
          onMouseDown={(e) => handle_drag_start(e.clientX, e.clientY, e.target, e)}
          onTouchStart={(e) => {
            if (e.touches && e.touches.length === 1) {
              handle_drag_start(e.touches[0].clientX, e.touches[0].clientY, e.target, e);
            }
          }}
        >
          {/* Card markers */}
          {cards.map((c) => {
            const is_selected = selected_ids.includes(c.id);
            const cx = (c.x - (min_x - margin)) * scale;
            const cy = (c.y - (min_y - margin)) * scale;
            const cw = Math.max(3, (c.width || 200) * scale);
            const ch = Math.max(2, (c.height || 150) * scale);

            return (
              <div
                key={c.id}
                className={`${styles['lumen-minimap-card'] || styles.lumenMinimapCard} ${
                  is_selected ? (styles['lumen-minimap-card-selected'] || styles.lumenMinimapCardSelected) : ''
                }`}
                style={{
                  left: `${cx}px`,
                  top: `${cy}px`,
                  width: `${cw}px`,
                  height: `${ch}px`,
                }}
              />
            );
          })}

          {/* Viewport frame indicator */}
          <div
            className={`${styles['lumen-minimap-viewport-box'] || styles.lumenMinimapViewportBox} ${
              is_dragging ? (styles['lumen-minimap-viewport-box-dragging'] || styles.lumenMinimapViewportBoxDragging) : ''
            }`}
            style={{
              left: `${vp_x}px`,
              top: `${vp_y}px`,
              width: `${vp_w}px`,
              height: `${vp_h}px`,
            }}
            title="Camera Viewport: Drag to pan in real-time"
          />
        </div>
      </div>
    </>
  );
}

export default LUMEN_minimap;
export { LUMEN_minimap as Minimap };
