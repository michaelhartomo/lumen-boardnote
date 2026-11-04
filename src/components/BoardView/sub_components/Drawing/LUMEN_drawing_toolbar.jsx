import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  PenLine,
  Eraser,
  Undo2,
  Redo2,
  Check,
  PenTool,
  Hand,
  Fingerprint,
  Pointer,
  Layers,
  ImagePlus,
} from 'lucide-react';

import styles from './LUMEN_drawing_toolbar.module.css';
import LUMEN_drawing_layer_panel from './LUMEN_drawing_layer_panel.jsx';
import {
  activeBoardSignal,
  isDrawingModeSignal,
  drawingToolSignal,
  drawingColorSignal,
  drawingWidthSignal,
  drawingOpacitySignal,
  exitDrawingSession,
  undo,
  redo,
  palmRejectionModeSignal,
  isPalmRestingSignal,
  setPalmRejectionMode,
  isDrawingLayerPanelOpenSignal,
  addDrawingImage,
  showToast,
} from '../../signals/boardState.js';

const COLOR_PRESETS = [
  { label: 'Slate', value: '#1e293b' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Green', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'White', value: '#ffffff' },
];

const STROKE_WIDTH_OPTIONS = [
  { label: 'Fine (2px)', width: 2, opacity: 1 },
  { label: 'Medium (4px)', width: 4, opacity: 1 },
  { label: 'Bold (8px)', width: 8, opacity: 1 },
  { label: 'Highlighter (16px)', width: 16, opacity: 0.35 },
];

export default function LUMEN_drawing_toolbar() {
  useSignals();

  const [is_color_popover_open, set_is_color_popover_open] = useState(false);
  const [is_width_popover_open, set_is_width_popover_open] = useState(false);
  const [is_palm_popover_open, set_is_palm_popover_open] = useState(false);

  const toolbar_ref = useRef(null);
  const file_input_ref = useRef(null);

  const current_tool = drawingToolSignal.value;
  const current_color = drawingColorSignal.value;
  const current_width = drawingWidthSignal.value;
  const current_opacity = drawingOpacitySignal.value;
  const current_palm_mode = palmRejectionModeSignal.value;
  const is_stylus_mode = current_palm_mode !== 'off';
  const is_palm_resting = isPalmRestingSignal.value;
  const is_layers_open = isDrawingLayerPanelOpenSignal.value;

  const drawings = activeBoardSignal.value?.drawings || [];
  const image_count = drawings.filter((d) => d.type === 'image').length;

  // Close popovers when clicking outside toolbar
  useEffect(() => {
    const handle_outside_click = (e) => {
      if (toolbar_ref.current && !toolbar_ref.current.contains(e.target)) {
        set_is_color_popover_open(false);
        set_is_width_popover_open(false);
        set_is_palm_popover_open(false);
      }
    };
    window.addEventListener('mousedown', handle_outside_click);
    return () => window.removeEventListener('mousedown', handle_outside_click);
  }, []);

  if (!isDrawingModeSignal.value) {
    return null;
  }

  const handle_select_pen = () => {
    drawingToolSignal.value = 'pen';
    set_is_color_popover_open(false);
    set_is_width_popover_open(false);
    set_is_palm_popover_open(false);
  };

  const handle_select_pointer = () => {
    drawingToolSignal.value = 'select';
    set_is_color_popover_open(false);
    set_is_width_popover_open(false);
    set_is_palm_popover_open(false);
  };

  const handle_select_hand = () => {
    drawingToolSignal.value = 'hand';
    set_is_color_popover_open(false);
    set_is_width_popover_open(false);
    set_is_palm_popover_open(false);
  };

  const handle_select_eraser = () => {
    drawingToolSignal.value = 'eraser';
    set_is_color_popover_open(false);
    set_is_width_popover_open(false);
    set_is_palm_popover_open(false);
  };

  const handle_choose_color = (color_val) => {
    drawingColorSignal.value = color_val;
    drawingToolSignal.value = 'pen';
    set_is_color_popover_open(false);
  };

  const handle_choose_width = (width_val, opacity_val) => {
    drawingWidthSignal.value = width_val;
    drawingOpacitySignal.value = opacity_val;
    drawingToolSignal.value = 'pen';
    set_is_width_popover_open(false);
  };

  const handle_toggle_layers = () => {
    isDrawingLayerPanelOpenSignal.value = !isDrawingLayerPanelOpenSignal.value;
    set_is_color_popover_open(false);
    set_is_width_popover_open(false);
    set_is_palm_popover_open(false);
  };

  const handle_trigger_upload = () => {
    if (file_input_ref.current) {
      file_input_ref.current.click();
    }
  };

  const handle_toolbar_file_chosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid PNG or image file');
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
        const max_dim = 400;

        if (w > max_dim || h > max_dim) {
          if (w >= h) {
            h = Math.round((h * max_dim) / w);
            w = max_dim;
          } else {
            w = Math.round((w * max_dim) / h);
            h = max_dim;
          }
        }

        const is_gif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
        const is_svg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

        let final_data_url = raw_data_url;
        if (!is_gif && !is_svg) {
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
        }

        const is_png = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const clean_name = file.name.replace(/\.[^/.]+$/, '');
        const display_name = is_gif
          ? `${clean_name} (GIF)`
          : is_png
          ? `${clean_name} (PNG)`
          : clean_name;

        addDrawingImage({
          src: final_data_url,
          name: display_name,
          width: Math.max(40, w),
          height: Math.max(40, h),
          naturalWidth: natural_w,
          naturalHeight: natural_h,
        });

        isDrawingLayerPanelOpenSignal.value = true;

        if (file_input_ref.current) {
          file_input_ref.current.value = '';
        }
      };
      img.src = raw_data_url;
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Hidden file input for direct image upload from toolbar */}
      <input
        ref={file_input_ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        style={{ display: 'none' }}
        onChange={handle_toolbar_file_chosen}
      />

      {/* Floating Drawing Layer Panel Popup */}
      <LUMEN_drawing_layer_panel />

      <div
        ref={toolbar_ref}
        className={styles['lumen-drawing-toolbar-wrapper']}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Line 1: Primary Tools & Styling */}
        <div className={styles['lumen-drawing-toolbar-group']}>
          {/* 1. Pen Tool (Active outline matching design) */}
          <button
            type="button"
            className={`${styles['lumen-drawing-tool-btn']} ${
              current_tool === 'pen' ? styles['lumen-drawing-tool-btn-active'] : ''
            }`}
            onClick={handle_select_pen}
            title="Draw freehand pen"
          >
            <PenLine size={16} />
          </button>

          {/* 2. Hand Tool (Move around board & pinch zoom) */}
          <button
            type="button"
            className={`${styles['lumen-drawing-tool-btn']} ${
              current_tool === 'hand' ? styles['lumen-drawing-tool-btn-active'] : ''
            }`}
            onClick={handle_select_hand}
            title="Hand tool: drag to move around board & pinch to zoom"
          >
            <Hand size={16} />
          </button>

          {/* 3. Eraser Tool */}
          <button
            type="button"
            className={`${styles['lumen-drawing-tool-btn']} ${
              current_tool === 'eraser' ? styles['lumen-drawing-tool-btn-active'] : ''
            }`}
            onClick={handle_select_eraser}
            title="Eraser: click or drag across strokes to remove"
          >
            <Eraser size={16} />
          </button>

          {/* 4. Pointer / Select Tool (next on the right of eraser) */}
          <button
            type="button"
            className={`${styles['lumen-drawing-tool-btn']} ${
              current_tool === 'select' ? styles['lumen-drawing-tool-btn-active'] : ''
            }`}
            onClick={handle_select_pointer}
            title="Select & Transform tool: select, move, resize & rotate image layers"
          >
            <Pointer size={16} />
          </button>

          {/* Divider */}
          <div className={styles['lumen-drawing-divider']} />

          {/* 5. Color Swatch Box */}
          <div className={styles['lumen-drawing-control-slot']}>
            <div
              className={styles['lumen-drawing-color-box']}
              style={{ backgroundColor: current_color }}
              onClick={() => {
                set_is_color_popover_open(!is_color_popover_open);
                set_is_width_popover_open(false);
                set_is_palm_popover_open(false);
              }}
              title="Change drawing stroke color"
            />

            {is_color_popover_open && (
              <div className={styles['lumen-drawing-popover']}>
                {COLOR_PRESETS.map((col) => (
                  <div
                    key={col.value}
                    className={`${styles['lumen-drawing-color-option']} ${
                      current_color === col.value ? styles['lumen-drawing-color-option-active'] : ''
                    }`}
                    style={{ backgroundColor: col.value }}
                    onClick={() => handle_choose_color(col.value)}
                    title={col.label}
                  >
                    {current_color === col.value && (
                      <Check size={12} color={col.value === '#ffffff' ? '#0f172a' : '#ffffff'} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Stroke Thickness Squiggle Button */}
          <div className={styles['lumen-drawing-control-slot']}>
            <button
              type="button"
              className={`${styles['lumen-drawing-squiggle-btn']} ${
                is_width_popover_open ? styles['lumen-drawing-squiggle-active'] : ''
              }`}
              onClick={() => {
                set_is_width_popover_open(!is_width_popover_open);
                set_is_color_popover_open(false);
                set_is_palm_popover_open(false);
              }}
              title="Change stroke width & style"
            >
              <svg
                width="20"
                height="14"
                viewBox="0 0 24 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 7C4.5 2 7.5 2 10 7C12.5 12 15.5 12 18 7C19.5 4 21 4 22 7"
                  stroke={current_color || '#1e293b'}
                  strokeWidth={Math.min(4, Math.max(2, current_width / 1.5))}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={current_opacity || 1}
                />
              </svg>
            </button>

            {is_width_popover_open && (
              <div className={styles['lumen-drawing-width-popover']}>
                {STROKE_WIDTH_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.label}
                    className={`${styles['lumen-drawing-width-item']} ${
                      current_width === opt.width && current_opacity === opt.opacity
                        ? styles['lumen-drawing-width-item-active']
                        : ''
                    }`}
                    onClick={() => handle_choose_width(opt.width, opt.opacity)}
                  >
                    <span>{opt.label}</span>
                    <div
                      className={styles['lumen-drawing-width-preview-line']}
                      style={{
                        height: `${Math.min(10, Math.max(2, opt.width / 1.5))}px`,
                        backgroundColor: current_color,
                        opacity: opt.opacity,
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className={styles['lumen-drawing-divider']} />

          {/* 7. Input Mode Toggle Button: [All Touch] vs Stylus */}
          <div className={styles['lumen-drawing-control-slot']}>
            <button
              type="button"
              className={`${styles['lumen-drawing-palm-btn']} ${
                is_stylus_mode
                  ? is_palm_resting
                    ? styles['lumen-drawing-palm-active']
                    : styles['lumen-drawing-palm-stylus']
                  : ''
              }`}
              onClick={() => {
                const next_mode = is_stylus_mode ? 'off' : 'smart';
                setPalmRejectionMode(next_mode);
                set_is_color_popover_open(false);
                set_is_width_popover_open(false);
              }}
              title={
                is_stylus_mode
                  ? is_palm_resting
                    ? 'Stylus Mode (Palm Detected - Click to switch to All Touch)'
                    : 'Stylus Mode (Click to switch to All Touch)'
                  : 'All Touch Mode (Click to switch to Stylus)'
              }
              aria-pressed={is_stylus_mode}
            >
              {is_stylus_mode ? (
                <>
                  <PenTool size={14} />
                  <span className={styles['lumen-drawing-palm-btn-label']}>Stylus</span>
                </>
              ) : (
                <>
                  <Fingerprint size={14} />
                  <span className={styles['lumen-drawing-palm-btn-label']}>All Touch</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Desktop divider between tool groups */}
        <div className={styles['lumen-drawing-divider-desktop']} />

        {/* Line 2: Layers, Image Upload, History & Actions */}
        <div className={styles['lumen-drawing-toolbar-group']}>
          {/* 8. Layers Panel Toggle Button */}
          <button
            type="button"
            className={`${styles['lumen-drawing-tool-btn']} ${styles['lumen-drawing-layer-btn']} ${
              is_layers_open ? styles['lumen-drawing-tool-btn-active'] : ''
            }`}
            onClick={handle_toggle_layers}
            title="Open Drawing Layers & Image Manipulation Panel"
          >
            <Layers size={16} />
            {image_count > 0 && (
              <span className={styles['lumen-drawing-layer-badge']}>
                {image_count}
              </span>
            )}
          </button>

          {/* 9. Direct Upload PNG / Image Button */}
          <button
            type="button"
            className={styles['lumen-drawing-tool-btn']}
            onClick={handle_trigger_upload}
            title="Upload PNG / image layer to drawing board"
          >
            <ImagePlus size={16} />
          </button>

          {/* Divider */}
          <div className={styles['lumen-drawing-divider']} />

          {/* 10. Undo Button */}
          <button
            type="button"
            className={styles['lumen-drawing-history-btn']}
            onClick={undo}
            title="Undo drawing stroke or layer change"
          >
            <Undo2 size={16} />
          </button>

          {/* 11. Redo Button */}
          <button
            type="button"
            className={styles['lumen-drawing-history-btn']}
            onClick={redo}
            title="Redo drawing stroke or layer change"
          >
            <Redo2 size={16} />
          </button>

          {/* Divider */}
          <div className={styles['lumen-drawing-divider']} />

          {/* 12. Combined Exit Button */}
          <button
            type="button"
            className={`${styles['lumen-drawing-save-btn']} ${styles['lumen-drawing-save-btn-active']}`}
            onClick={exitDrawingSession}
            title="Exit drawing mode"
          >
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
