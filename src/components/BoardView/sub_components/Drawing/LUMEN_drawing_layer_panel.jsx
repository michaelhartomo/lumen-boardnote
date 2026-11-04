import { useState, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Layers,
  ImagePlus,
  X,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  PenTool,
  Sliders,
  GripVertical,
} from 'lucide-react';

import styles from './LUMEN_drawing_layer_panel.module.css';
import {
  activeBoardSignal,
  isDrawingLayerPanelOpenSignal,
  selectedDrawingImageIdSignal,
  addDrawingImage,
  updateDrawingImage,
  deleteDrawingImage,
  duplicateDrawingImage,
  reorderDrawingImage,
  reorderDrawingLayersByList,
  toggleDrawingImageVisibility,
  toggleDrawingImageLock,
  showToast,
} from '../../signals/boardState.js';

export default function LUMEN_drawing_layer_panel() {
  useSignals();

  const file_input_ref = useRef(null);
  const [drag_source_index, set_drag_source_index] = useState(null);
  const [drag_target_index, set_drag_target_index] = useState(null);

  if (!isDrawingLayerPanelOpenSignal.value) {
    return null;
  }

  const drawings = activeBoardSignal.value?.drawings || [];
  const selected_id = selectedDrawingImageIdSignal.value;
  const selected_layer = drawings.find((d) => d.id === selected_id);

  // Group layers: All images + strokes summary
  const image_layers = drawings.filter((d) => d.type === 'image');
  const stroke_count = drawings.filter((d) => d.type !== 'image').length;

  // Process chosen file for image upload (PNG with transparency, JPG, WebP, SVG)
  const handle_file_chosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid PNG or image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (load_evt) => {
      const data_url = load_evt.target?.result;
      if (!data_url) return;

      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || 320;
        let h = img.naturalHeight || 240;
        const max_dim = 400;

        // Scale proportionally if oversized
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
        const is_png = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const clean_name = file.name.replace(/\.[^/.]+$/, '');
        const display_name = is_gif
          ? `${clean_name} (GIF)`
          : is_png
          ? `${clean_name} (PNG)`
          : clean_name;

        addDrawingImage({
          src: data_url,
          name: display_name,
          width: Math.max(40, w),
          height: Math.max(40, h),
          naturalWidth: img.naturalWidth || w,
          naturalHeight: img.naturalHeight || h,
        });

        if (file_input_ref.current) {
          file_input_ref.current.value = '';
        }
      };
      img.src = data_url;
    };
    reader.readAsDataURL(file);
  };

  const handle_trigger_upload = () => {
    if (file_input_ref.current) {
      file_input_ref.current.click();
    }
  };

  const handle_close_panel = () => {
    isDrawingLayerPanelOpenSignal.value = false;
  };

  // Reorder / Layer Hierarchy
  const handle_bring_front = () => {
    if (selected_id) reorderDrawingImage(selected_id, 'front');
  };
  const handle_send_back = () => {
    if (selected_id) reorderDrawingImage(selected_id, 'back');
  };
  const handle_bring_up = () => {
    if (selected_id) reorderDrawingImage(selected_id, 'up');
  };
  const handle_send_down = () => {
    if (selected_id) reorderDrawingImage(selected_id, 'down');
  };

  // Rotation manipulation
  const handle_rotation_change = (deg_val) => {
    if (!selected_id) return;
    const normalized = ((Math.round(deg_val) % 360) + 360) % 360;
    updateDrawingImage(selected_id, { rotation: normalized });
  };

  const handle_rotate_delta = (delta) => {
    if (!selected_layer) return;
    const current_rot = selected_layer.rotation || 0;
    handle_rotation_change(current_rot + delta);
  };

  // Opacity manipulation
  const handle_opacity_change = (opacity_percent) => {
    if (!selected_id) return;
    const val = Math.max(0, Math.min(100, Math.round(opacity_percent))) / 100;
    updateDrawingImage(selected_id, { opacity: val });
  };

  // Dimension manipulation (maintaining aspect ratio if locked)
  const handle_width_change = (new_w_val) => {
    if (!selected_layer) return;
    const next_w = Math.max(20, Math.round(Number(new_w_val) || 20));
    const updates = { width: next_w };
    if (selected_layer.aspectRatioLocked && selected_layer.width > 0) {
      const ratio = selected_layer.height / selected_layer.width;
      updates.height = Math.max(20, Math.round(next_w * ratio));
    }
    updateDrawingImage(selected_id, updates);
  };

  const handle_height_change = (new_h_val) => {
    if (!selected_layer) return;
    const next_h = Math.max(20, Math.round(Number(new_h_val) || 20));
    const updates = { height: next_h };
    if (selected_layer.aspectRatioLocked && selected_layer.height > 0) {
      const ratio = selected_layer.width / selected_layer.height;
      updates.width = Math.max(20, Math.round(next_h * ratio));
    }
    updateDrawingImage(selected_id, updates);
  };

  const handle_flip_h = () => {
    if (!selected_layer) return;
    updateDrawingImage(selected_id, { flipHorizontal: !selected_layer.flipHorizontal });
  };

  const handle_flip_v = () => {
    if (!selected_layer) return;
    updateDrawingImage(selected_id, { flipVertical: !selected_layer.flipVertical });
  };

  const handle_toggle_aspect = () => {
    if (!selected_layer) return;
    updateDrawingImage(selected_id, { aspectRatioLocked: !selected_layer.aspectRatioLocked });
  };

  const handle_panel_drag_over = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handle_panel_drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/lumen-layer-drag')) {
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const isImageFile = (f) =>
        (f.type && f.type.startsWith('image/')) ||
        /\.(png|jpe?g|webp|svg|gif|bmp|ico|avif)$/i.test(f.name);
      const imageFiles = Array.from(files).filter(isImageFile);
      if (imageFiles.length > 0) {
        imageFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (load_evt) => {
            const data_url = load_evt.target?.result;
            if (!data_url) return;
            const img = new Image();
            img.onload = () => {
              let w = img.naturalWidth || 320;
              let h = img.naturalHeight || 240;
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
              const is_png = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
              const clean_name = file.name.replace(/\.[^/.]+$/, '');
              addDrawingImage({
                src: data_url,
                name: is_png ? `${clean_name} (PNG)` : clean_name,
                width: Math.max(40, w),
                height: Math.max(40, h),
                naturalWidth: img.naturalWidth || w,
                naturalHeight: img.naturalHeight || h,
              });
            };
            img.src = data_url;
          };
          reader.readAsDataURL(file);
        });
        showToast(
          imageFiles.length > 1
            ? `Added ${imageFiles.length} images to layers`
            : `Added layer "${imageFiles[0].name.replace(/\.[^/.]+$/, '')}"`
        );
      }
    }
  };

  // Layer Draggable Reorder Handlers
  const handle_layer_drag_start = (e, index, layer) => {
    if (layer.locked) {
      e.preventDefault();
      showToast('Unlock layer to reorder');
      return;
    }
    set_drag_source_index(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/lumen-layer-drag', layer.id);
    e.dataTransfer.setData('text/plain', layer.id);
  };

  const handle_layer_drag_over = (e, index) => {
    if (drag_source_index === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (drag_target_index !== index) {
      set_drag_target_index(index);
    }
  };

  const handle_layer_drag_leave = (e, index) => {
    if (drag_target_index === index) {
      set_drag_target_index(null);
    }
  };

  const handle_layer_drop = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const source_idx = drag_source_index;
    set_drag_source_index(null);
    set_drag_target_index(null);

    if (source_idx === null || source_idx === index) return;

    // reversed_image_layers is top -> bottom
    const list = [...reversed_image_layers];
    const [dragged_item] = list.splice(source_idx, 1);
    list.splice(index, 0, dragged_item);

    // Canvas render order is bottom -> top, so we reverse it
    const new_ordered_ids = list.map((item) => item.id).reverse();
    reorderDrawingLayersByList(new_ordered_ids);
  };

  const handle_layer_drag_end = () => {
    set_drag_source_index(null);
    set_drag_target_index(null);
  };

  // Reversed list so topmost layers render on top of the list
  const reversed_image_layers = [...image_layers].reverse();

  return (
    <div
      className={styles['lumen-drawing-layer-panel']}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDragOver={handle_panel_drag_over}
      onDrop={handle_panel_drop}
    >
      {/* Hidden file input supporting PNG, JPG, WebP, SVG */}
      <input
        ref={file_input_ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        style={{ display: 'none' }}
        onChange={handle_file_chosen}
      />

      {/* Header */}
      <div className={styles['lumen-layer-panel-header']}>
        <div className={styles['lumen-layer-panel-title-group']}>
          <Layers size={16} color="#2563eb" />
          <span className={styles['lumen-layer-panel-title']}>Drawing Layers</span>
          <span className={styles['lumen-layer-panel-count-badge']}>
            {image_layers.length} {image_layers.length === 1 ? 'image' : 'images'}
          </span>
        </div>

        <div className={styles['lumen-layer-panel-header-actions']}>
          <button
            type="button"
            className={styles['lumen-layer-panel-icon-btn']}
            onClick={handle_close_panel}
            title="Close Layers Panel"
            aria-label="Close Layers Panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Upload Action Trigger Bar */}
      <div className={styles['lumen-layer-panel-upload-bar']}>
        <button
          type="button"
          className={styles['lumen-layer-upload-trigger-btn']}
          onClick={handle_trigger_upload}
          title="Upload PNG with transparency, JPG, or WebP onto board"
        >
          <ImagePlus size={15} />
          <span>Upload PNG / Image</span>
        </button>
      </div>

      {/* Scrollable Body: Layers list & selected layer inspector */}
      <div className={styles['lumen-layer-panel-body']}>
        {/* Empty state prompt */}
        {image_layers.length === 0 && stroke_count === 0 && (
          <div
            className={styles['lumen-layer-empty-state']}
            onClick={handle_trigger_upload}
          >
            <div className={styles['lumen-layer-empty-icon']}>
              <ImagePlus size={20} />
            </div>
            <div className={styles['lumen-layer-empty-title']}>No Layers Yet</div>
            <div className={styles['lumen-layer-empty-subtitle']}>
              Upload a transparent PNG, illustration, or graphic to start manipulating layers on your drawing board.
            </div>
          </div>
        )}

        {/* Freehand Strokes Group Layer (if strokes exist) */}
        {stroke_count > 0 && (
          <div
            className={`${styles['lumen-layer-item']} ${
              selected_id === 'strokes_group' ? styles['lumen-layer-item-active'] : ''
            }`}
            onClick={() => {
              selectedDrawingImageIdSignal.value = 'strokes_group';
            }}
          >
            <div className={styles['lumen-layer-thumb-container']}>
              <div className={styles['lumen-layer-stroke-thumb']}>
                <PenTool size={16} />
              </div>
            </div>
            <div className={styles['lumen-layer-info']}>
              <span className={styles['lumen-layer-name']}>Freehand Strokes</span>
              <span className={styles['lumen-layer-meta']}>
                {stroke_count} stroke{stroke_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Image Layers List (Top to bottom) with Draggable Reorder */}
        {reversed_image_layers.map((layer, index) => {
          const is_active = selected_id === layer.id;
          const is_gif =
            layer.name?.toLowerCase().includes('gif') ||
            layer.src?.startsWith('data:image/gif') ||
            /\.gif(\?|$)/i.test(layer.src || '');
          const is_png =
            !is_gif &&
            (layer.name?.toLowerCase().includes('png') || layer.src?.startsWith('data:image/png'));
          const is_being_dragged = drag_source_index === index;
          const is_drag_over = drag_target_index === index && drag_source_index !== index;

          return (
            <div
              key={layer.id}
              draggable={!layer.locked}
              onDragStart={(e) => handle_layer_drag_start(e, index, layer)}
              onDragOver={(e) => handle_layer_drag_over(e, index)}
              onDragLeave={(e) => handle_layer_drag_leave(e, index)}
              onDrop={(e) => handle_layer_drop(e, index)}
              onDragEnd={handle_layer_drag_end}
              className={`${styles['lumen-layer-item']} ${
                is_active ? styles['lumen-layer-item-active'] : ''
              } ${is_being_dragged ? styles['lumen-layer-item-dragging'] : ''} ${
                is_drag_over ? styles['lumen-layer-item-drag-over'] : ''
              }`}
              onClick={() => {
                selectedDrawingImageIdSignal.value = layer.id;
              }}
            >
              {/* Drag Grip Handle */}
              <div
                className={`${styles['lumen-layer-drag-handle']} ${
                  layer.locked ? styles['lumen-layer-drag-handle-disabled'] : ''
                }`}
                title={layer.locked ? 'Layer is locked' : 'Drag to reorder z-index hierarchy'}
              >
                <GripVertical size={13} />
              </div>

              {/* Checkerboard thumbnail for PNG/GIF transparency */}
              <div className={styles['lumen-layer-thumb-container']}>
                <img
                  src={layer.src}
                  alt={layer.name}
                  className={styles['lumen-layer-thumb-img']}
                />
              </div>

              {/* Name & metadata */}
              <div className={styles['lumen-layer-info']}>
                <span className={styles['lumen-layer-name']}>{layer.name || 'Image'}</span>
                <div className={styles['lumen-layer-meta']}>
                  {is_gif && <span className={styles['lumen-layer-tag-png']}>GIF</span>}
                  {is_png && <span className={styles['lumen-layer-tag-png']}>PNG</span>}
                  <span>
                    {Math.round(layer.width)}×{Math.round(layer.height)}
                  </span>
                  {layer.rotation ? <span>· {Math.round(layer.rotation)}°</span> : null}
                </div>
              </div>

              {/* Fast row actions: Visibility, Lock, Delete */}
              <div className={styles['lumen-layer-actions']}>
                <button
                  type="button"
                  className={`${styles['lumen-layer-btn']} ${
                    layer.visible === false ? styles['lumen-layer-btn-muted'] : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDrawingImageVisibility(layer.id);
                  }}
                  title={layer.visible === false ? 'Show layer' : 'Hide layer'}
                >
                  {layer.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>

                <button
                  type="button"
                  className={`${styles['lumen-layer-btn']} ${
                    layer.locked ? styles['lumen-layer-btn-muted'] : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDrawingImageLock(layer.id);
                  }}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                >
                  {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                <button
                  type="button"
                  className={`${styles['lumen-layer-btn']} ${styles['lumen-layer-btn-delete']}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDrawingImage(layer.id);
                  }}
                  title="Delete layer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Selected Layer Manipulation Inspector */}
        {selected_layer && selected_layer.type === 'image' && (
          <div className={styles['lumen-layer-inspector']}>
            <div className={styles['lumen-inspector-header']}>
              <span>Layer Transform & Manipulation</span>
              <Sliders size={13} />
            </div>

            {/* Dimensions: W and H */}
            <div className={styles['lumen-inspector-section']}>
              <div className={styles['lumen-inspector-label-row']}>
                <span>Dimensions</span>
                <button
                  type="button"
                  className={`${styles['lumen-inspector-btn']} ${
                    selected_layer.aspectRatioLocked ? styles['lumen-inspector-btn-active'] : ''
                  }`}
                  style={{ width: 'auto', padding: '1px 6px', height: '20px' }}
                  onClick={handle_toggle_aspect}
                  title={selected_layer.aspectRatioLocked ? 'Aspect Ratio Locked' : 'Unlock Aspect Ratio'}
                >
                  {selected_layer.aspectRatioLocked ? <Lock size={10} /> : <Unlock size={10} />}
                  <span style={{ fontSize: '10px' }}>Lock Ratio</span>
                </button>
              </div>

              <div className={styles['lumen-inspector-input-row']}>
                <div className={styles['lumen-inspector-field']}>
                  <span className={styles['lumen-inspector-field-prefix']}>W</span>
                  <input
                    type="number"
                    className={styles['lumen-inspector-input']}
                    value={Math.round(selected_layer.width)}
                    onChange={(e) => handle_width_change(e.target.value)}
                  />
                  <span className={styles['lumen-inspector-field-prefix']}>px</span>
                </div>
                <div className={styles['lumen-inspector-field']}>
                  <span className={styles['lumen-inspector-field-prefix']}>H</span>
                  <input
                    type="number"
                    className={styles['lumen-inspector-input']}
                    value={Math.round(selected_layer.height)}
                    onChange={(e) => handle_height_change(e.target.value)}
                  />
                  <span className={styles['lumen-inspector-field-prefix']}>px</span>
                </div>
              </div>
            </div>

            {/* Position: X and Y */}
            <div className={styles['lumen-inspector-section']}>
              <div className={styles['lumen-inspector-label-row']}>
                <span>Canvas Position</span>
              </div>
              <div className={styles['lumen-inspector-input-row']}>
                <div className={styles['lumen-inspector-field']}>
                  <span className={styles['lumen-inspector-field-prefix']}>X</span>
                  <input
                    type="number"
                    className={styles['lumen-inspector-input']}
                    value={Math.round(selected_layer.x)}
                    onChange={(e) =>
                      updateDrawingImage(selected_layer.id, { x: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className={styles['lumen-inspector-field']}>
                  <span className={styles['lumen-inspector-field-prefix']}>Y</span>
                  <input
                    type="number"
                    className={styles['lumen-inspector-input']}
                    value={Math.round(selected_layer.y)}
                    onChange={(e) =>
                      updateDrawingImage(selected_layer.id, { y: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Rotation Controls: Slider, Number input, 90 deg buttons */}
            <div className={styles['lumen-inspector-section']}>
              <div className={styles['lumen-inspector-label-row']}>
                <span>Rotation</span>
                <span className={styles['lumen-inspector-val']}>
                  {Math.round(selected_layer.rotation || 0)}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                className={styles['lumen-inspector-slider']}
                value={Math.round(selected_layer.rotation || 0)}
                onChange={(e) => handle_rotation_change(Number(e.target.value))}
              />

              <div className={styles['lumen-inspector-button-group']}>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={() => handle_rotate_delta(-90)}
                  title="Rotate -90°"
                >
                  <RotateCcw size={12} />
                  <span>-90°</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={() => handle_rotate_delta(90)}
                  title="Rotate +90°"
                >
                  <RotateCw size={12} />
                  <span>+90°</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={() => handle_rotation_change(0)}
                  title="Reset rotation to 0°"
                >
                  <span>Reset (0°)</span>
                </button>
              </div>
            </div>

            {/* Opacity Controls */}
            <div className={styles['lumen-inspector-section']}>
              <div className={styles['lumen-inspector-label-row']}>
                <span>Opacity</span>
                <span className={styles['lumen-inspector-val']}>
                  {Math.round((selected_layer.opacity !== undefined ? selected_layer.opacity : 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                className={styles['lumen-inspector-slider']}
                value={Math.round((selected_layer.opacity !== undefined ? selected_layer.opacity : 1) * 100)}
                onChange={(e) => handle_opacity_change(Number(e.target.value))}
              />
            </div>

            {/* Flip Transformations */}
            <div className={styles['lumen-inspector-section']}>
              <div className={styles['lumen-inspector-label-row']}>
                <span>Flip Transform</span>
              </div>
              <div className={styles['lumen-inspector-button-group']}>
                <button
                  type="button"
                  className={`${styles['lumen-inspector-btn']} ${
                    selected_layer.flipHorizontal ? styles['lumen-inspector-btn-active'] : ''
                  }`}
                  onClick={handle_flip_h}
                  title="Flip Horizontally"
                >
                  <FlipHorizontal size={13} />
                  <span>Flip X</span>
                </button>
                <button
                  type="button"
                  className={`${styles['lumen-inspector-btn']} ${
                    selected_layer.flipVertical ? styles['lumen-inspector-btn-active'] : ''
                  }`}
                  onClick={handle_flip_v}
                  title="Flip Vertically"
                >
                  <FlipVertical size={13} />
                  <span>Flip Y</span>
                </button>
              </div>
            </div>

            {/* Z-Index Layer Ordering */}
            <div className={styles['lumen-inspector-section']}>
              <div className={styles['lumen-inspector-label-row']}>
                <span>Layer Hierarchy</span>
              </div>
              <div className={styles['lumen-inspector-button-group']}>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={handle_bring_front}
                  title="Bring to Front"
                >
                  <ChevronsUp size={13} />
                  <span>Front</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={handle_bring_up}
                  title="Bring Forward"
                >
                  <ChevronUp size={13} />
                  <span>Up</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={handle_send_down}
                  title="Send Backward"
                >
                  <ChevronDown size={13} />
                  <span>Down</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-inspector-btn']}
                  onClick={handle_send_back}
                  title="Send to Back"
                >
                  <ChevronsDown size={13} />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {/* Actions: Duplicate & Delete */}
            <div className={styles['lumen-inspector-button-group']}>
              <button
                type="button"
                className={styles['lumen-inspector-btn']}
                onClick={() => duplicateDrawingImage(selected_layer.id)}
                title="Duplicate this layer"
              >
                <Copy size={13} />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                className={styles['lumen-inspector-danger-btn']}
                onClick={() => deleteDrawingImage(selected_layer.id)}
                title="Delete this layer"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
