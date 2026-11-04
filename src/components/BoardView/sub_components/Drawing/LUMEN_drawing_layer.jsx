import { useSignals } from '@preact/signals-react/runtime';

import styles from './LUMEN_drawing_layer.module.css';
import LUMEN_drawing_image_item from './LUMEN_drawing_image_item.jsx';
import {
  activeBoardSignal,
  activeStrokeSignal,
  hoveredEraseStrokeIdSignal,
} from '../../signals/boardState.js';

// Converts a series of 2D points into a smooth curved SVG path using quadratic beziers
export function points_to_svg_path(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const mid_x = (p1.x + p2.x) / 2;
    const mid_y = (p1.y + p2.y) / 2;
    d += ` Q ${p1.x} ${p1.y}, ${mid_x} ${mid_y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export default function LUMEN_drawing_layer() {
  useSignals();

  const raw_drawings = activeBoardSignal.value?.drawings;
  const raw_board_drawing = activeBoardSignal.value?.board_drawing;
  const drawings = Array.isArray(raw_drawings)
    ? raw_drawings
    : (Array.isArray(raw_board_drawing) ? raw_board_drawing : []);
  const cards = activeBoardSignal.value?.cards || [];
  const current_stroke = activeStrokeSignal.value;
  const hovered_id = hoveredEraseStrokeIdSignal.value;

  const stroke_items = drawings.filter((d) => d.type !== 'image');
  const image_items = drawings.filter((d) => d.type === 'image');

  // Ensure freehand strokes SVG layer always renders above all image layers
  const max_image_z = image_items.reduce((acc, item, idx) => {
    const z = typeof item.zIndex === 'number' ? item.zIndex : idx + 1;
    return Math.max(acc, z);
  }, 0);
  const max_card_z = cards.reduce((acc, c, idx) => {
    const z = typeof c.zIndex === 'number' ? c.zIndex : idx + 1;
    return Math.max(acc, z);
  }, 0);
  const max_layer_z = Math.max(max_image_z, max_card_z, image_items.length + cards.length);
  const strokes_svg_z_index = Math.max(900, max_layer_z * 10 + 200);

  return (
    <div className={styles['lumen-drawing-layer-container']} style={{ pointerEvents: 'none' }}>
      {/* Render Drawing Board Image Layers first (below freehand strokes) */}
      {image_items.map((img_item, img_idx) => (
        <LUMEN_drawing_image_item
          key={img_item.id}
          item={img_item}
          layer_index={img_idx}
          total_layers={image_items.length}
        />
      ))}

      {/* SVG Path Layer for Freehand Strokes (rendered above all image layers) */}
      <svg
        className={styles['lumen-drawing-layer-svg']}
        viewBox="0 0 100000 100000"
        style={{
          pointerEvents: 'none',
          zIndex: strokes_svg_z_index,
        }}
      >
        <g transform="translate(50000, 50000)" style={{ pointerEvents: 'none' }}>
          {/* Render all persistent board drawing strokes */}
          {stroke_items.map((stroke) => {
            const is_highlighted = hovered_id === stroke.id;
            const pts = stroke.points || [];
            if (pts.length === 0) return null;
            if (pts.length === 1) {
              return (
                <circle
                  key={stroke.id}
                  cx={pts[0].x}
                  cy={pts[0].y}
                  r={(stroke.width || 3) / 2}
                  fill={is_highlighted ? '#ef4444' : stroke.color || '#1e293b'}
                  opacity={stroke.opacity || 1}
                  className={`${styles['lumen-drawing-stroke']} ${
                    is_highlighted ? styles['lumen-drawing-stroke-hover-erase'] : ''
                  }`}
                  style={{ pointerEvents: 'none' }}
                />
              );
            }
            return (
              <path
                key={stroke.id}
                d={points_to_svg_path(pts)}
                stroke={is_highlighted ? '#ef4444' : stroke.color || '#1e293b'}
                strokeWidth={stroke.width || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={stroke.opacity || 1}
                className={`${styles['lumen-drawing-stroke']} ${
                  is_highlighted ? styles['lumen-drawing-stroke-hover-erase'] : ''
                }`}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* Render the stroke currently being drawn in real time */}
          {current_stroke && current_stroke.points && current_stroke.points.length > 0 && (
            current_stroke.points.length === 1 ? (
              <circle
                cx={current_stroke.points[0].x}
                cy={current_stroke.points[0].y}
                r={(current_stroke.width || 3) / 2}
                fill={current_stroke.color || '#1e293b'}
                opacity={current_stroke.opacity || 1}
                className={styles['lumen-drawing-stroke']}
                style={{ pointerEvents: 'none' }}
              />
            ) : (
              <path
                d={points_to_svg_path(current_stroke.points)}
                stroke={current_stroke.color || '#1e293b'}
                strokeWidth={current_stroke.width || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={current_stroke.opacity || 1}
                className={styles['lumen-drawing-stroke']}
                style={{ pointerEvents: 'none' }}
              />
            )
          )}
        </g>
      </svg>
    </div>
  );
}
