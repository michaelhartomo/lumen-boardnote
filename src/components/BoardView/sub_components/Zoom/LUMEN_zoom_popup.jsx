import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  ZoomIn,
  ZoomOut,
  Minus,
  Plus,
  X,
  Sliders,
} from 'lucide-react';

import styles from './LUMEN_zoom_popup.module.css';
import {
  activeBoardSignal,
  updateViewport,
} from '../../signals/boardState.js';

export function LUMEN_zoom_popup({
  is_open = false,
  on_close,
  anchor_ref,
  position_mode = 'dock',
}) {
  useSignals();
  const card_ref = useRef(null);
  const [coords, set_coords] = useState({ top: 0, left: 0 });

  const active_board = activeBoardSignal.value;
  const current_zoom = active_board?.viewport?.zoom || 1;
  const zoom_percent = Math.round(current_zoom * 100);

  // Calculate dynamic popup position relative to trigger anchor
  useEffect(() => {
    if (!is_open) return;

    const calculate_position = () => {
      const is_mobile = window.innerWidth <= 768;

      if (anchor_ref && anchor_ref.current) {
        const rect = anchor_ref.current.getBoundingClientRect();

        if (position_mode === 'dock') {
          if (is_mobile) {
            // Mobile Dock at bottom: center popup right above dock bar
            const popup_width = Math.min(280, window.innerWidth - 32);
            const target_left = Math.max(16, (window.innerWidth - popup_width) / 2);
            const target_top = Math.max(16, rect.top - 200);
            set_coords({ top: target_top, left: target_left });
          } else {
            // Desktop Left Dock: popup opens to the right of the button
            const target_left = rect.right + 12;
            const target_top = Math.max(16, Math.min(rect.top - 20, window.innerHeight - 230));
            set_coords({ top: target_top, left: target_left });
          }
        } else if (position_mode === 'header') {
          if (is_mobile) {
            // Mobile Header: drop down from top-right quick bar
            const popup_width = Math.min(280, window.innerWidth - 32);
            const target_left = Math.max(16, window.innerWidth - popup_width - 12);
            const target_top = rect.bottom + 8;
            set_coords({ top: target_top, left: target_left });
          } else {
            // Desktop Header: drop down centered below zoom control
            const popup_width = 280;
            const center_x = rect.left + rect.width / 2;
            const target_left = Math.max(16, Math.min(center_x - popup_width / 2, window.innerWidth - popup_width - 16));
            const target_top = rect.bottom + 8;
            set_coords({ top: target_top, left: target_left });
          }
        } else {
          // General default
          set_coords({ top: rect.bottom + 8, left: Math.max(16, rect.left) });
        }
      } else {
        // Fallback fixed positioning if anchor_ref not available
        if (is_mobile) {
          const popup_width = Math.min(280, window.innerWidth - 32);
          set_coords({
            top: window.innerHeight - 220,
            left: (window.innerWidth - popup_width) / 2,
          });
        } else {
          set_coords({ top: 60, left: 60 });
        }
      }
    };

    calculate_position();
    window.addEventListener('resize', calculate_position);
    window.addEventListener('scroll', calculate_position, true);
    return () => {
      window.removeEventListener('resize', calculate_position);
      window.removeEventListener('scroll', calculate_position, true);
    };
  }, [is_open, anchor_ref, position_mode]);

  // Close on Escape key
  useEffect(() => {
    if (!is_open) return;
    const handle_keydown = (e) => {
      if (e.key === 'Escape') {
        on_close?.();
      }
    };
    document.addEventListener('keydown', handle_keydown);
    return () => document.removeEventListener('keydown', handle_keydown);
  }, [is_open, on_close]);

  if (!is_open) return null;

  // Zoom math handler centering around window middle
  const handle_zoom_to = (target_zoom) => {
    const clamped_zoom = Math.min(2.0, Math.max(0.3, Number(target_zoom.toFixed(2))));
    const viewport = active_board?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const center_x = window.innerWidth / 2;
    const center_y = window.innerHeight / 2;
    const old_zoom = viewport.zoom || 1;
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
    const viewport = active_board?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const center_x = window.innerWidth / 2;
    const center_y = window.innerHeight / 2;
    const old_zoom = viewport.zoom || 1;
    const new_pan_x = center_x - (center_x - viewport.panX) * (1 / old_zoom);
    const new_pan_y = center_y - (center_y - viewport.panY) * (1 / old_zoom);
    updateViewport(new_pan_x, new_pan_y, 1);
  };

  // Preset percentage buttons
  const preset_values = [50, 75, 100, 125, 150, 200];

  // Calculate percentage fill for range slider styling track
  const slider_fill_percent = Math.round(((zoom_percent - 30) / (200 - 30)) * 100);

  const content = (
    <div className={styles['lumen-zoom-popup-portal']}>
      {/* Invisible backdrop to capture outside clicks */}
      <div
        className={styles['lumen-zoom-popup-backdrop']}
        onClick={on_close}
        aria-hidden="true"
      />

      <div
        ref={card_ref}
        className={styles['lumen-zoom-popup-card']}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          '--lumen-slider-fill': `${Math.min(100, Math.max(0, slider_fill_percent))}%`,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Canvas Zoom Controls"
      >
        {/* Header with Title and Current Percentage */}
        <div className={styles['lumen-zoom-popup-header']}>
          <div className={styles['lumen-zoom-popup-title-wrap']}>
            <span className={styles['lumen-zoom-popup-title']}>Canvas Zoom</span>
            <span className={styles['lumen-zoom-popup-badge']}>{zoom_percent}%</span>
          </div>
          <button
            type="button"
            className={styles['lumen-zoom-popup-close-btn']}
            onClick={on_close}
            aria-label="Close zoom menu"
          >
            <X size={15} />
          </button>
        </div>

        {/* Interactive Zoom Slider and Stepper Controls */}
        <div className={styles['lumen-zoom-popup-slider-section']}>
          <div className={styles['lumen-zoom-popup-slider-row']}>
            <button
              type="button"
              className={styles['lumen-zoom-popup-step-btn']}
              onClick={() => handle_step_zoom(-0.1)}
              disabled={zoom_percent <= 30}
              title="Zoom Out (-10%)"
              aria-label="Zoom Out"
            >
              <Minus size={14} />
            </button>

            <input
              type="range"
              min="30"
              max="200"
              step="1"
              value={zoom_percent}
              onChange={handle_slider_change}
              className={styles['lumen-zoom-popup-slider']}
              aria-label="Zoom Slider"
            />

            <button
              type="button"
              className={styles['lumen-zoom-popup-step-btn']}
              onClick={() => handle_step_zoom(0.1)}
              disabled={zoom_percent >= 200}
              title="Zoom In (+10%)"
              aria-label="Zoom In"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className={styles['lumen-zoom-popup-scale-labels']}>
            <span>30%</span>
            <span>100%</span>
            <span>200%</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className={styles['lumen-zoom-popup-presets']}>
          {preset_values.map((val) => {
            const is_active = Math.abs(zoom_percent - val) <= 1;
            return (
              <button
                key={val}
                type="button"
                className={`${styles['lumen-zoom-popup-preset-btn']} ${
                  is_active ? styles['lumen-zoom-popup-preset-btn-active'] : ''
                }`}
                onClick={() => handle_zoom_to(val / 100)}
                title={`Set zoom to ${val}%`}
              >
                {val}%
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default LUMEN_zoom_popup;
