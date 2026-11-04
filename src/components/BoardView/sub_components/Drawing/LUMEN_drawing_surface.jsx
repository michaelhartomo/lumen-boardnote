import { useState, useRef, useCallback, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';

import styles from './LUMEN_drawing_surface.module.css';
import {
  activeBoardSignal,
  updateViewport,
  isDrawingModeSignal,
  drawingToolSignal,
  drawingColorSignal,
  drawingWidthSignal,
  drawingOpacitySignal,
  hoveredEraseStrokeIdSignal,
  addDrawingStroke,
  eraseDrawingStroke,
  createId,
  palmRejectionModeSignal,
  isStylusActiveSignal,
  isPalmRestingSignal,
  selectedDrawingImageIdSignal,
} from '../../signals/boardState.js';

// Distance from point to line segment for precise eraser hit testing
function dist_to_segment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function is_stroke_near_point(stroke, point, threshold = 14) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;
  const stroke_radius = (stroke.width || 3) / 2;
  const effective_threshold = threshold + stroke_radius;

  if (pts.length === 1) {
    return Math.hypot(point.x - pts[0].x, point.y - pts[0].y) <= effective_threshold;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const d = dist_to_segment(point, pts[i], pts[i + 1]);
    if (d <= effective_threshold) {
      return true;
    }
  }
  return false;
}

// Converts spatial points directly to screen coordinates for zero-latency active stroke preview
function points_to_screen_path(points, panX, panY, zoom) {
  if (!points || points.length === 0) return '';
  const to_s = (p) => ({ x: p.x * zoom + panX, y: p.y * zoom + panY });
  const s0 = to_s(points[0]);
  if (points.length === 1) {
    return `M ${s0.x} ${s0.y} L ${s0.x + 0.1} ${s0.y + 0.1}`;
  }
  if (points.length === 2) {
    const s1 = to_s(points[1]);
    return `M ${s0.x} ${s0.y} L ${s1.x} ${s1.y}`;
  }
  let d = `M ${s0.x} ${s0.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = to_s(points[i]);
    const p2 = to_s(points[i + 1]);
    const mid_x = (p1.x + p2.x) / 2;
    const mid_y = (p1.y + p2.y) / 2;
    d += ` Q ${p1.x} ${p1.y}, ${mid_x} ${mid_y}`;
  }
  const last = to_s(points[points.length - 1]);
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Returns the visual viewport scale so screen-space contact patch sizes and distances
 * remain physically invariant across all browser pinch-zoom and board zoom levels.
 */
function get_vv_scale() {
  if (
    typeof window !== 'undefined' &&
    window.visualViewport &&
    typeof window.visualViewport.scale === 'number'
  ) {
    return Math.max(0.25, Math.min(5, window.visualViewport.scale));
  }
  return 1;
}

/**
 * Analyzes pointer contact geometry in a zoom-independent way to distinguish:
 * - Universal capacitive stylus with a transparent precision disc tip (~6-8mm conductive disc
 *   on a ball-joint swivel, which reports e.pointerType === 'touch', diameter ~4-44px in CSS
 *   pixels, and can report elliptical aspect up to ~2.25 when angled on its swivel or across
 *   rectangular capacitive grid nodes)
 * - Unmistakable resting palm / side of hand blob (broad contact > 48px, area > 1850,
 *   or large elongated edge > 34px with aspect > 2.35)
 */
function get_contact_profile(e) {
  const vv = get_vv_scale();
  const raw_w = typeof e.width === 'number' && e.width > 0 ? e.width : 0;
  const raw_h = typeof e.height === 'number' && e.height > 0 ? e.height : 0;
  const w = raw_w * vv;
  const h = raw_h * vv;
  const has_size = raw_w > 0 && raw_h > 0 && !(raw_w === 1 && raw_h === 1);
  const max_dim = Math.max(w, h, raw_w, raw_ry_fallback(e));
  const min_dim = Math.max(0.5, Math.min(w || 1, h || 1));
  const aspect = has_size ? Math.max(w, h) / min_dim : 1;
  const area = Math.max(w * h, raw_w * raw_h);

  // Never disqualify a touch contact based on static size/aspect alone because when a full palm
  // rests on a capacitive screen, hardware self-capacitance coupling can inflate reported width/height
  // on the universal transparent disc stylus as well.
  return {
    w: has_size ? w : 12,
    h: has_size ? h : 12,
    area: has_size ? area : 144,
    aspect,
    has_size,
    is_large_palm: has_size && (max_dim > 64.0 || area > 2800),
    is_huge_palm: has_size && (max_dim > 96.0 || area > 5600),
    is_disc_candidate: true,
  };
}

function raw_ry_fallback(e) {
  return typeof e.height === 'number' && e.height > 0 ? e.height : 0;
}

function get_disp_since(p_rec, since_time, vv) {
  if (!p_rec) return 0;
  const hist = p_rec.history;
  if (!hist || hist.length === 0) {
    return Math.hypot(p_rec.last_x - p_rec.start_x, p_rec.last_y - p_rec.start_y) * vv;
  }
  let ref_pt = hist[0];
  for (let i = hist.length - 1; i >= 0; i--) {
    ref_pt = hist[i];
    if (ref_pt.time <= since_time) {
      break;
    }
  }
  return Math.hypot(p_rec.last_x - ref_pt.x, p_rec.last_y - ref_pt.y) * vv;
}

export default function LUMEN_drawing_surface({
  containerRef,
  isSpacePressed,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  useSignals();

  const is_drawing_mode = isDrawingModeSignal.value;
  const current_tool = drawingToolSignal.value;
  const current_color = drawingColorSignal.value;
  const current_width = drawingWidthSignal.value;
  const current_opacity = drawingOpacitySignal.value;

  const [live_stroke, set_live_stroke] = useState(null);
  const [is_hand_panning, set_is_hand_panning] = useState(false);
  const surface_ref = useRef(null);
  const is_drawing_ref = useRef(false);
  const stroke_points_ref = useRef([]);
  const active_stroke_id_ref = useRef(null);

  // Real-time tracker for all pointers currently touching the screen (resting palm + stylus)
  const active_pointers_ref = useRef(new Map());
  const active_pointer_id_ref = useRef(null);
  const native_touch_count_ref = useRef(0);

  // Deduplicated Touch.identifier -> pointerId bridge map & canceled touch tracker
  const touch_bridge_map_ref = useRef(new Map());
  const canceled_touch_ids_ref = useRef(new Set());
  const pointer_handlers_ref = useRef({
    down: null,
    move: null,
    end: null,
  });

  // Palm Area + Stylus Stroke Line Neighborhood Tracker
  const stylus_tracker_ref = useRef({
    palm_detected: false,
    palm_pointer_ids: new Set(),
    palm_x: null,
    palm_y: null,
    palm_first_down_time: 0,
    last_palm_activity_time: 0,
    stroke_line_detected: false,
    tracked_x: null,
    tracked_y: null,
    tracked_vx: 0,
    tracked_vy: 0,
    last_stylus_time: 0,
    tracking_radius: 195,
    palm_hold_timer: null,
    palm_release_timer: null,
  });

  // Hand tool pan / pinch-zoom state ref
  const hand_gesture_ref = useRef(null);

  // Keep latest reactive values in refs for global window listeners
  const tool_ref = useRef(current_tool);
  tool_ref.current = current_tool;
  const color_ref = useRef(current_color);
  color_ref.current = current_color;
  const width_ref = useRef(current_width);
  width_ref.current = current_width;
  const opacity_ref = useRef(current_opacity);
  opacity_ref.current = current_opacity;
  const space_ref = useRef(isSpacePressed);
  space_ref.current = isSpacePressed;

  // Converts client mouse/stylus coordinates to canvas spatial coordinates with high precision at all zoom levels
  const get_canvas_coords = useCallback(
    (clientX, clientY) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const current_viewport = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
      const zoom = Math.max(0.1, current_viewport.zoom || 1);
      const x = (clientX - rect.left - current_viewport.panX) / zoom;
      const y = (clientY - rect.top - current_viewport.panY) / zoom;
      return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    },
    [containerRef]
  );

  // Commits any active stroke points to board state and clears live stroke buffer
  const commit_current_stroke = useCallback(() => {
    const final_points = stroke_points_ref.current;
    if (tool_ref.current === 'pen' && final_points.length > 0) {
      addDrawingStroke({
        id: active_stroke_id_ref.current || createId('stroke'),
        points: [...final_points],
        color: color_ref.current,
        width: width_ref.current,
        opacity: opacity_ref.current,
      });
    }

    is_drawing_ref.current = false;
    active_pointer_id_ref.current = null;
    active_stroke_id_ref.current = null;
    stroke_points_ref.current = [];
    set_live_stroke(null);
  }, []);

  // Resets the Palm + Stylus neighborhood tracker ONLY when all touches have left the screen
  const reset_stylus_tracker = useCallback(() => {
    const tracker = stylus_tracker_ref.current;
    if (tracker.palm_hold_timer) {
      clearTimeout(tracker.palm_hold_timer);
      tracker.palm_hold_timer = null;
    }
    if (tracker.palm_release_timer) {
      clearTimeout(tracker.palm_release_timer);
      tracker.palm_release_timer = null;
    }
    tracker.palm_detected = false;
    tracker.palm_pointer_ids.clear();
    tracker.palm_x = null;
    tracker.palm_y = null;
    tracker.palm_first_down_time = 0;
    tracker.last_palm_activity_time = 0;
    tracker.stroke_line_detected = false;
    tracker.tracked_x = null;
    tracker.tracked_y = null;
    tracker.tracked_vx = 0;
    tracker.tracked_vy = 0;
    tracker.last_stylus_time = 0;
    if (isPalmRestingSignal.value) {
      isPalmRestingSignal.value = false;
    }
  }, []);

  // Registers a pointer as part of the resting palm area, resets its local anchor to its current
  // resting coordinate, clears any tentative palm-slide stroke on it, and turns ON the Palm Resting
  // indicator solidly without ever flickering off while the hand remains on the screen.
  const mark_pointer_as_palm = useCallback((p_rec, lock_permanently = false) => {
    if (!p_rec) return;
    if (p_rec.settle_timer) {
      clearTimeout(p_rec.settle_timer);
      p_rec.settle_timer = null;
    }
    const now = Date.now();
    p_rec.is_palm = true;
    if (lock_permanently) {
      p_rec.is_palm_locked = true;
    }
    p_rec.is_stylus = false;
    p_rec.confirmed_stylus = false;
    p_rec.is_stylus_candidate = false;
    p_rec.anchor_x = p_rec.last_x;
    p_rec.anchor_y = p_rec.last_y;
    p_rec.anchor_time = now;
    p_rec.pending_screen_points = [{ x: p_rec.last_x, y: p_rec.last_y, time: now }];

    const tracker = stylus_tracker_ref.current;
    if (tracker.palm_release_timer) {
      clearTimeout(tracker.palm_release_timer);
      tracker.palm_release_timer = null;
    }
    if (!tracker.palm_detected) {
      tracker.palm_first_down_time = p_rec.start_time || now;
    }
    tracker.palm_detected = true;
    tracker.last_palm_activity_time = now;
    tracker.palm_pointer_ids.add(p_rec.pointer_id);

    if (palmRejectionModeSignal.value !== 'off' && !isPalmRestingSignal.value) {
      isPalmRestingSignal.value = true;
    }

    // If this pointer was holding active_pointer_id_ref as a tentative palm-settle roll before being
    // recognized as a resting palm, discard its uncommitted points immediately so it leaves no stray mark!
    if (active_pointer_id_ref.current === p_rec.pointer_id) {
      active_pointer_id_ref.current = null;
      is_drawing_ref.current = false;
      active_stroke_id_ref.current = null;
      stroke_points_ref.current = [];
      set_live_stroke(null);
    }

    // Recompute palm area center from all active palm pointers
    const pointers = active_pointers_ref.current;
    let sum_x = 0;
    let sum_y = 0;
    let count = 0;
    for (const pid of tracker.palm_pointer_ids) {
      const pr = pointers.get(pid);
      if (pr) {
        sum_x += pr.last_x;
        sum_y += pr.last_y;
        count++;
      }
    }
    if (count > 0) {
      tracker.palm_x = sum_x / count;
      tracker.palm_y = sum_y / count;
    } else {
      tracker.palm_x = p_rec.last_x;
      tracker.palm_y = p_rec.last_y;
    }
  }, []);

  // Schedules a per-pointer settling-palm check:
  // Even if a full palm slid 15-40px when first placed on the glass, once it settles stationary
  // (< 3.8px movement in the last 65ms) without having drawn a long stroke (< 44px),
  // it is marked as a resting palm (turning ON Palm Detection solidly and clearing any palm-slide line).
  const schedule_settling_palm_check = useCallback(
    (pointer_id, delay_ms = 140) => {
      const rec = active_pointers_ref.current.get(pointer_id);
      if (!rec) return;
      if (rec.settle_timer) {
        clearTimeout(rec.settle_timer);
      }
      rec.settle_timer = setTimeout(() => {
        rec.settle_timer = null;
        if (palmRejectionModeSignal.value === 'off') return;
        const pointers = active_pointers_ref.current;
        const cur = pointers.get(pointer_id);
        if (
          !cur ||
          cur.is_palm_locked ||
          cur.confirmed_stylus ||
          cur.pointer_type === 'pen' ||
          cur.pointer_type === 'mouse'
        ) {
          return;
        }
        // If this pointer has already drawn a real stroke (>= 44px), never mark it as palm
        if (cur.is_stylus && cur.max_dist_from_start >= 44) {
          return;
        }
        const now = Date.now();
        const vv = get_vv_scale();
        const recent_65 = get_disp_since(cur, now - 65, vv);
        const dist_from_anchor =
          Math.hypot(cur.last_x - cur.anchor_x, cur.last_y - cur.anchor_y) * vv;

        const is_stationary_now = recent_65 < 3.8 || dist_from_anchor < 4.2;

        if (is_stationary_now && cur.max_dist_from_start < 44.0) {
          const has_newer_pointer = Array.from(pointers.values()).some(
            (p) => p.pointer_id !== cur.pointer_id && p.start_time > cur.start_time
          );
          const another_is_active =
            active_pointer_id_ref.current !== null &&
            active_pointer_id_ref.current !== cur.pointer_id;

          if (pointers.size >= 2 || cur.max_dist_from_start < 20.0) {
            // Lock permanently only if another pointer is already active or newer;
            // otherwise soft-mark so a solitary aiming stylus can still unlock when it starts moving!
            mark_pointer_as_palm(cur, Boolean(has_newer_pointer || another_is_active));
          }
        }
      }, delay_ms);
    },
    [mark_pointer_as_palm]
  );

  // Updates the tracked stylus stroke neighborhood around the latest stylus point & velocity
  const update_stylus_tracker_point = useCallback((clientX, clientY, now, is_stroke_line = false) => {
    const tracker = stylus_tracker_ref.current;
    if (tracker.tracked_x !== null && tracker.tracked_y !== null && tracker.last_stylus_time > 0) {
      const dt = Math.max(1, Math.min(200, now - tracker.last_stylus_time));
      const vx = (clientX - tracker.tracked_x) / dt;
      const vy = (clientY - tracker.tracked_y) / dt;
      tracker.tracked_vx = 0.55 * tracker.tracked_vx + 0.45 * vx;
      tracker.tracked_vy = 0.55 * tracker.tracked_vy + 0.45 * vy;
    }
    tracker.tracked_x = clientX;
    tracker.tracked_y = clientY;
    tracker.last_stylus_time = now;
    if (is_stroke_line) {
      tracker.stroke_line_detected = true;
    }
  }, []);

  // Starts a new drawing/erasing stroke on the designated stylus pointer, replaying any buffered start points
  const activate_stylus_pointer = useCallback(
    (e, pointer_rec, should_commit_previous = false) => {
      if (should_commit_previous && stroke_points_ref.current.length >= 2) {
        commit_current_stroke();
      } else {
        stroke_points_ref.current = [];
        active_stroke_id_ref.current = null;
        set_live_stroke(null);
      }

      const tracker = stylus_tracker_ref.current;
      const pointers = active_pointers_ref.current;
      if (tracker.palm_release_timer) {
        clearTimeout(tracker.palm_release_timer);
        tracker.palm_release_timer = null;
      }
      if (pointer_rec.settle_timer) {
        clearTimeout(pointer_rec.settle_timer);
        pointer_rec.settle_timer = null;
      }

      const now = Date.now();
      pointer_rec.is_stylus = true;
      pointer_rec.is_stylus_candidate = false;
      pointer_rec.is_palm = false;
      pointer_rec.is_palm_locked = false;
      if (pointers.size >= 2 || tracker.palm_detected) {
        pointer_rec.confirmed_stylus = true;
      }
      tracker.palm_pointer_ids.delete(pointer_rec.pointer_id);

      // Recompute palm center from remaining palm pointers if any.
      // CRITICAL: Never set isPalmRestingSignal.value = false here so the palm indicator stays ON solidly!
      if (tracker.palm_pointer_ids.size > 0) {
        let sx = 0;
        let sy = 0;
        let cnt = 0;
        for (const pid of tracker.palm_pointer_ids) {
          const pr = pointers.get(pid);
          if (pr) {
            sx += pr.last_x;
            sy += pr.last_y;
            cnt++;
          }
        }
        if (cnt > 0) {
          tracker.palm_x = sx / cnt;
          tracker.palm_y = sy / cnt;
        }
      }

      pointer_rec.last_sample_x = e.clientX;
      pointer_rec.last_sample_y = e.clientY;
      pointer_rec.last_sample_time = now;
      pointer_rec.last_step_dist = 0;
      pointer_rec.last_dx = 0;
      pointer_rec.last_dy = 0;

      active_pointer_id_ref.current = pointer_rec.pointer_id;
      is_drawing_ref.current = true;

      if (!isStylusActiveSignal.value) {
        isStylusActiveSignal.value = true;
      }

      if (e.pointerType === 'pen' || !tracker.stroke_line_detected) {
        update_stylus_tracker_point(e.clientX, e.clientY, now, false);
      }

      const current_zoom = Math.max(0.1, activeBoardSignal.value?.viewport?.zoom || 1);
      const min_world_step = 0.65 / current_zoom;

      // Build initial stroke points from buffered pending_screen_points so universal disc-tip
      // stylus strokes begin at the exact millimeter of initial touch-down with zero lost tail!
      const initial_pts = [];
      const pending = pointer_rec.pending_screen_points || [];
      for (let i = 0; i < pending.length; i++) {
        const pt = get_canvas_coords(pending[i].x, pending[i].y);
        if (
          initial_pts.length === 0 ||
          Math.hypot(
            pt.x - initial_pts[initial_pts.length - 1].x,
            pt.y - initial_pts[initial_pts.length - 1].y
          ) >= min_world_step
        ) {
          initial_pts.push(pt);
        }
      }
      const cur_pt = get_canvas_coords(e.clientX, e.clientY);
      if (
        initial_pts.length === 0 ||
        Math.hypot(
          cur_pt.x - initial_pts[initial_pts.length - 1].x,
          cur_pt.y - initial_pts[initial_pts.length - 1].y
        ) >= min_world_step
      ) {
        initial_pts.push(cur_pt);
      }

      const tool = tool_ref.current;

      if (tool === 'pen') {
        const stroke_id = createId('stroke');
        active_stroke_id_ref.current = stroke_id;
        stroke_points_ref.current = initial_pts;
        set_live_stroke({
          id: stroke_id,
          points: [...initial_pts],
          color: color_ref.current,
          width: width_ref.current,
          opacity: opacity_ref.current,
        });
      } else if (tool === 'eraser') {
        active_stroke_id_ref.current = null;
        stroke_points_ref.current = [];
        set_live_stroke(null);
        const current_drawings = activeBoardSignal.value?.drawings || [];
        const hit_threshold = 14 / current_zoom;
        const hit = current_drawings.find((s) => is_stroke_near_point(s, cur_pt, hit_threshold));
        if (hit) {
          eraseDrawingStroke(hit.id);
        }
      }
    },
    [get_canvas_coords, update_stylus_tracker_point, commit_current_stroke]
  );

  // Global pointermove / pointerup / pointercancel listeners for drawing & palm+stylus tracking
  useEffect(() => {
    if (!is_drawing_mode || current_tool === 'select' || current_tool === 'hand') {
      commit_current_stroke();
      active_pointers_ref.current.clear();
      touch_bridge_map_ref.current.clear();
      canceled_touch_ids_ref.current.clear();
      native_touch_count_ref.current = 0;
      reset_stylus_tracker();
      return;
    }

    const handle_window_pointer_move = (move_evt) => {
      if (space_ref.current) return;

      const pointers = active_pointers_ref.current;
      const rec = pointers.get(move_evt.pointerId);
      const palm_rejection_on = palmRejectionModeSignal.value !== 'off';
      const tracker = stylus_tracker_ref.current;
      const now = Date.now();
      const vv = get_vv_scale();

      if (rec) {
        if (!move_evt.is_synthetic_touch) {
          rec.last_native_pointer_time = now;
        }
        const raw_step_dist = Math.hypot(move_evt.clientX - rec.last_x, move_evt.clientY - rec.last_y);
        const step_dist = raw_step_dist * vv;
        rec.last_x = move_evt.clientX;
        rec.last_y = move_evt.clientY;
        rec.total_screen_dist += step_dist;

        // Maintain 160ms sliding history buffer for exact equal-window displacement comparisons
        if (!rec.history) {
          rec.history = [];
        }
        rec.history.push({ x: move_evt.clientX, y: move_evt.clientY, time: now });
        while (rec.history.length > 2 && now - rec.history[0].time > 160) {
          rec.history.shift();
        }

        const dist_from_start =
          Math.hypot(move_evt.clientX - rec.start_x, move_evt.clientY - rec.start_y) * vv;
        if (dist_from_start > rec.max_dist_from_start) {
          rec.max_dist_from_start = dist_from_start;
        }
        if (step_dist >= 0.4) {
          rec.last_move_time = now;
        }

        // Buffer early screen points so when a universal disc stylus activates, its stroke starts from origin
        if (!rec.is_stylus && !rec.is_palm_locked && rec.pending_screen_points) {
          const last_pending = rec.pending_screen_points[rec.pending_screen_points.length - 1];
          if (
            !last_pending ||
            Math.hypot(move_evt.clientX - last_pending.x, move_evt.clientY - last_pending.y) * vv >= 0.5
          ) {
            if (rec.pending_screen_points.length < 64) {
              rec.pending_screen_points.push({
                x: move_evt.clientX,
                y: move_evt.clientY,
                time: now,
              });
            }
          }
        }

        // 1. If this pointer is permanently locked as a resting palm (e.g., because the stylus
        // landed after it or took over from it), ignore all palm rocking/shifting completely!
        if (rec.is_palm_locked) {
          return;
        }

        const dist_from_anchor =
          Math.hypot(move_evt.clientX - rec.anchor_x, move_evt.clientY - rec.anchor_y) * vv;

        // If this pointer is not yet marked as palm and shifts >= 4px while still within initial hand-slide range (< 42px),
        // advance its anchor and reschedule the 140ms settling check so a sliding palm settles as a palm once it stops!
        if (dist_from_anchor >= 4.0 && !rec.is_palm && !rec.confirmed_stylus) {
          rec.anchor_x = move_evt.clientX;
          rec.anchor_y = move_evt.clientY;
          rec.anchor_time = now;
          if (rec.max_dist_from_start < 42.0) {
            schedule_settling_palm_check(rec.pointer_id, 140);
          }
        }

        // 2. If this pointer was soft-marked `is_palm = true` (e.g. solitary stylus paused >140ms to aim):
        // It can ONLY unlock if NO stylus is currently active (`active_pointer_id_ref.current === null`)
        // AND it translates purposefully (`dist_from_anchor >= 2.8` and `disp_45 >= 2.5`).
        if (rec.is_palm) {
          if (active_pointer_id_ref.current !== null) {
            return;
          }
          const disp_45 = get_disp_since(rec, now - 45, vv);
          if (step_dist < 1.1 && disp_45 < 2.2) {
            rec.anchor_x = move_evt.clientX;
            rec.anchor_y = move_evt.clientY;
            rec.anchor_time = now;
            return;
          }
          if (dist_from_anchor >= 2.8 && disp_45 >= 2.5) {
            rec.is_palm = false;
            rec.is_stylus_candidate = true;
            tracker.palm_pointer_ids.delete(rec.pointer_id);
          } else {
            return;
          }
        }

        // 3. Pointer Arbitration (Applies to BOTH Stylus Mode and All Touch Mode when a palm is resting!):
        // Decides when a moving pointer `rec` should activate as the stylus or take over from a resting palm.
        const min_move_to_start = pointers.size === 1 ? 0.8 : 0.9;

        if (
          rec.pointer_id !== active_pointer_id_ref.current &&
          rec.max_dist_from_start >= min_move_to_start
        ) {
          const current_active =
            active_pointer_id_ref.current !== null
              ? pointers.get(active_pointer_id_ref.current)
              : null;

          // Case 3A: No pointer is currently active -> activate `rec` immediately!
          if (!current_active) {
            for (const other of pointers.values()) {
              if (other.pointer_id === rec.pointer_id) continue;
              if (get_disp_since(other, now - 45, vv) < 4.5) {
                mark_pointer_as_palm(other, true);
              }
            }
            activate_stylus_pointer(move_evt, rec, false);
            update_stylus_tracker_point(move_evt.clientX, move_evt.clientY, now, true);
          } else {
            // Case 3B: Another pointer (`current_active`) holds `active_pointer_id_ref.current`.
            // Rule 1: An OLDER touch (`rec.start_time < current_active.start_time - 20`) must NEVER
            // steal `active_pointer_id_ref` back from a newer active stylus! Lock the older touch as palm!
            if (
              rec.start_time < current_active.start_time - 20 &&
              get_disp_since(current_active, now - 90, vv) >= 1.2
            ) {
              mark_pointer_as_palm(rec, true);
              return;
            }

            // Rule 2: If `current_active` has ALREADY drawn a real stroke (>= 18px) OR is a confirmed
            // multi-touch stylus AND is still actively moving in the last 65ms, it IS the stylus mid-stroke!
            // Any new touch that lands/rolls while the stylus is actively moving is a palm crease sub-touch.
            const active_disp_65 = get_disp_since(current_active, now - 65, vv);
            const active_is_drawing_stroke_now =
              !current_active.is_palm &&
              !current_active.is_palm_locked &&
              active_disp_65 >= 3.2 &&
              (current_active.max_dist_from_start >= 18 ||
                (current_active.confirmed_stylus && current_active.max_dist_from_start >= 6));

            if (!active_is_drawing_stroke_now) {
              // Compare `rec` and `current_active` over the EXACT SAME recent time window!
              const dt_win = Math.max(14, Math.min(45, now - rec.start_time));
              const rec_disp = get_disp_since(rec, now - dt_win, vv);
              const active_disp = get_disp_since(current_active, now - dt_win, vv);

              if (active_disp < 3.8 || rec_disp >= active_disp * 0.85) {
                const should_commit_prev = Boolean(
                  !current_active.is_palm &&
                    current_active.max_dist_from_start >= 60 &&
                    stroke_points_ref.current.length >= 6
                );

                for (const other of pointers.values()) {
                  if (other.pointer_id === rec.pointer_id) continue;
                  mark_pointer_as_palm(other, true);
                }

                activate_stylus_pointer(move_evt, rec, should_commit_prev);
                update_stylus_tracker_point(move_evt.clientX, move_evt.clientY, now, true);
              }
            }
          }
        }
      }

      // Strictly ignore any pointer that is not the registered stylus (ignores resting palm movements)
      if (!is_drawing_ref.current || move_evt.pointerId !== active_pointer_id_ref.current) {
        return;
      }
      if (rec && (rec.is_palm || rec.is_palm_locked)) {
        return;
      }

      if (move_evt.cancelable) {
        move_evt.preventDefault();
      }

      if (!isStylusActiveSignal.value) {
        isStylusActiveSignal.value = true;
      }

      // Kinematics check on the active stylus pointer to prevent hardware cross-screen lift-jump artifacts
      // while never breaking continuous fast strokes from a universal transparent disc stylus:
      let split_into_new_stroke = false;
      if (rec && palm_rejection_on) {
        const dt_sample = Math.max(1, now - (rec.last_sample_time || now));
        const dx_sample = (move_evt.clientX - (rec.last_sample_x ?? move_evt.clientX)) * vv;
        const dy_sample = (move_evt.clientY - (rec.last_sample_y ?? move_evt.clientY)) * vv;
        const jump_dist = Math.hypot(dx_sample, dy_sample);

        if (stroke_points_ref.current.length >= 2 && jump_dist >= 85) {
          const prev_dist = rec.last_step_dist || 0;
          let cos_angle = 1;
          if (prev_dist >= 2.0 && (rec.last_dx || rec.last_dy)) {
            const mag1 = Math.hypot(rec.last_dx, rec.last_dy);
            if (mag1 > 0 && jump_dist > 0) {
              cos_angle = (dx_sample * rec.last_dx + dy_sample * rec.last_dy) / (jump_dist * mag1);
            }
          }

          const hovered_between_strokes = dt_sample >= 95 && jump_dist >= 85;
          const jumped_after_stop = prev_dist < 5 && jump_dist >= 110;
          const sharp_turn_jump = jump_dist >= 120 && cos_angle < -0.15;

          if (hovered_between_strokes || jumped_after_stop || sharp_turn_jump) {
            split_into_new_stroke = true;
          }
        }

        rec.last_sample_x = move_evt.clientX;
        rec.last_sample_y = move_evt.clientY;
        rec.last_sample_time = now;
        rec.last_step_dist = jump_dist;
        rec.last_dx = dx_sample;
        rec.last_dy = dy_sample;
      }

      // As soon as the stylus moves >= 2px to form a stroke line, update the neighborhood tracker
      if (rec && rec.total_screen_dist >= 2.0) {
        update_stylus_tracker_point(move_evt.clientX, move_evt.clientY, now, true);
      }

      const tool = tool_ref.current;
      const current_zoom = Math.max(0.1, activeBoardSignal.value?.viewport?.zoom || 1);
      const min_world_step = 0.65 / current_zoom;

      // If a cross-screen lift-jump between strokes was detected, commit the finished stroke and start a fresh one
      if (split_into_new_stroke && tool === 'pen') {
        const finished_pts = stroke_points_ref.current;
        if (finished_pts.length > 0) {
          addDrawingStroke({
            id: active_stroke_id_ref.current || createId('stroke'),
            points: [...finished_pts],
            color: color_ref.current,
            width: width_ref.current,
            opacity: opacity_ref.current,
          });
        }
        const new_stroke_id = createId('stroke');
        const new_start_pt = get_canvas_coords(move_evt.clientX, move_evt.clientY);
        active_stroke_id_ref.current = new_stroke_id;
        stroke_points_ref.current = [new_start_pt];
        set_live_stroke({
          id: new_stroke_id,
          points: [new_start_pt],
          color: color_ref.current,
          width: width_ref.current,
          opacity: opacity_ref.current,
        });
        return;
      }

      // Use coalesced events when available for high-precision universal disc stylus curves
      const coalesced =
        typeof move_evt.getCoalescedEvents === 'function'
          ? move_evt.getCoalescedEvents()
          : null;
      const events_to_process = coalesced && coalesced.length > 0 ? coalesced : [move_evt];

      if (tool === 'pen') {
        const pts = stroke_points_ref.current;
        if (pts.length === 0) return;
        let did_append = false;

        for (let i = 0; i < events_to_process.length; i++) {
          const ev = events_to_process[i];
          const pt = get_canvas_coords(ev.clientX, ev.clientY);
          const last_pt = pts[pts.length - 1];
          // Zoom-normalized spatial threshold (~0.65 screen pixels at any zoom level)
          if (Math.hypot(pt.x - last_pt.x, pt.y - last_pt.y) >= min_world_step) {
            pts.push(pt);
            did_append = true;
          }
        }

        if (did_append) {
          if (pts.length >= 2 && rec && rec.total_screen_dist >= 2.0) {
            tracker.stroke_line_detected = true;
          }
          set_live_stroke({
            id: active_stroke_id_ref.current,
            points: [...pts],
            color: color_ref.current,
            width: width_ref.current,
            opacity: opacity_ref.current,
          });
        }
      } else if (tool === 'eraser') {
        const hit_threshold = 14 / current_zoom;
        for (let i = 0; i < events_to_process.length; i++) {
          const ev = events_to_process[i];
          const pt = get_canvas_coords(ev.clientX, ev.clientY);
          const drawings = activeBoardSignal.value?.drawings || [];
          const hit_stroke = drawings.find((s) => is_stroke_near_point(s, pt, hit_threshold));
          if (hit_stroke) {
            eraseDrawingStroke(hit_stroke.id);
          }
        }
      }
    };

    const handle_pointer_end = (end_evt) => {
      const pointers = active_pointers_ref.current;
      const rec = pointers.get(end_evt.pointerId);
      const tracker = stylus_tracker_ref.current;
      const palm_rejection_on = palmRejectionModeSignal.value !== 'off';
      const now = Date.now();
      const is_os_cancel = end_evt.type === 'pointercancel';

      if (rec && rec.settle_timer) {
        clearTimeout(rec.settle_timer);
        rec.settle_timer = null;
      }

      // Helper to schedule resetting the palm tracker ONLY after all touches have physically left the screen
      const schedule_palm_release_if_idle = (delay_ms = 220) => {
        if (
          pointers.size > 0 ||
          native_touch_count_ref.current > 0 ||
          is_drawing_ref.current
        ) {
          return;
        }
        if (tracker.palm_release_timer) {
          clearTimeout(tracker.palm_release_timer);
        }
        tracker.palm_release_timer = setTimeout(() => {
          tracker.palm_release_timer = null;
          if (
            active_pointers_ref.current.size === 0 &&
            native_touch_count_ref.current === 0 &&
            !is_drawing_ref.current
          ) {
            reset_stylus_tracker();
          }
        }, delay_ms);
      };

      // If the OS/browser fired pointercancel on a touch pointer, record its mapped Touch.identifier
      // in `canceled_touch_ids_ref` so a canceled palm touch is never resurrected as a new pointer!
      if (is_os_cancel) {
        for (const [tid, mapped_pid] of touch_bridge_map_ref.current.entries()) {
          if (mapped_pid === end_evt.pointerId) {
            canceled_touch_ids_ref.current.add(tid);
          }
        }
      }

      if (is_os_cancel && rec && rec.pointer_type === 'touch') {
        const was_real_stylus_stroke =
          end_evt.pointerId === active_pointer_id_ref.current &&
          !rec.is_palm &&
          !rec.is_palm_locked &&
          (rec.confirmed_stylus || rec.max_dist_from_start >= 16);

        if (was_real_stylus_stroke) {
          commit_current_stroke();
        } else {
          mark_pointer_as_palm(rec, true);
        }
        pointers.delete(end_evt.pointerId);
        tracker.palm_pointer_ids.delete(end_evt.pointerId);
        tracker.palm_detected = true;
        tracker.last_palm_activity_time = now;
        if (palm_rejection_on && !isPalmRestingSignal.value) {
          isPalmRestingSignal.value = true;
        }
        schedule_palm_release_if_idle(2800);
        return;
      }

      pointers.delete(end_evt.pointerId);
      tracker.palm_pointer_ids.delete(end_evt.pointerId);

      // Case 1: A non-active pointer lifted
      if (end_evt.pointerId !== active_pointer_id_ref.current) {
        // If this was a clean tap or micro-stroke with a universal transparent disc stylus
        // that lifted before reaching the movement threshold, commit it as a dot/short stroke or erase!
        if (
          rec &&
          !rec.is_palm_locked &&
          !rec.is_palm &&
          active_pointer_id_ref.current === null &&
          now - rec.start_time <= 380
        ) {
          activate_stylus_pointer(end_evt, rec, false);
          update_stylus_tracker_point(end_evt.clientX, end_evt.clientY, now, true);
          commit_current_stroke();
        }
        schedule_palm_release_if_idle();
        return;
      }

      // Case 2: The active pointer lifted
      const was_palm = Boolean(rec && (rec.is_palm_locked || rec.is_palm));
      const was_stationary_palm_hold = Boolean(
        palm_rejection_on &&
          rec &&
          rec.pointer_type === 'touch' &&
          rec.max_dist_from_start < 4.0 &&
          now - rec.start_time >= 380
      );

      if (was_palm || was_stationary_palm_hold) {
        is_drawing_ref.current = false;
        active_pointer_id_ref.current = null;
        active_stroke_id_ref.current = null;
        stroke_points_ref.current = [];
        set_live_stroke(null);
        schedule_palm_release_if_idle();
        return;
      }

      if (rec) {
        update_stylus_tracker_point(end_evt.clientX, end_evt.clientY, now, true);
      }

      // Immediately commit the stroke on stylus lift
      commit_current_stroke();

      // Schedule palm tracker reset only if all touches (including palm) have left the screen
      schedule_palm_release_if_idle();
    };

    pointer_handlers_ref.current.move = handle_window_pointer_move;
    pointer_handlers_ref.current.end = handle_pointer_end;

    window.addEventListener('pointermove', handle_window_pointer_move, { passive: false });
    window.addEventListener('pointerup', handle_pointer_end);
    window.addEventListener('pointercancel', handle_pointer_end);

    return () => {
      window.removeEventListener('pointermove', handle_window_pointer_move);
      window.removeEventListener('pointerup', handle_pointer_end);
      window.removeEventListener('pointercancel', handle_pointer_end);
    };
  }, [
    is_drawing_mode,
    current_tool,
    get_canvas_coords,
    activate_stylus_pointer,
    commit_current_stroke,
    reset_stylus_tracker,
    mark_pointer_as_palm,
    schedule_settling_palm_check,
    update_stylus_tracker_point,
  ]);

  // Native touch listeners on drawing surface:
  // - In Hand tool mode (or when Spacebar is held): enables smooth 1-finger board pan and 2-finger pinch-to-zoom.
  // - In Stylus / All Touch mode:
  //   1) Calls preventDefault() on touchstart & touchmove so 3-6 simultaneous touches (full palm + stylus)
  //      never trigger mobile browser multi-finger system gestures or touchcancel/pointercancel.
  //   2) Provides a clean 1-to-1 TouchEvent -> PointerEvent fallback bridge ONLY when a touch has no native
  //      PointerEvent (without ever colliding with iOS Safari's large native pointerIds or resurrecting canceled palms).
  useEffect(() => {
    const el = surface_ref.current;
    if (!el || !is_drawing_mode || current_tool === 'select') return;

    const is_hand_active = () => tool_ref.current === 'hand' || space_ref.current;

    const update_native_touch_palm_presence = (e) => {
      native_touch_count_ref.current = e.touches ? e.touches.length : 0;
      if (palmRejectionModeSignal.value === 'off') return;
      const tracker = stylus_tracker_ref.current;

      if (e.touches && e.touches.length >= 2) {
        if (tracker.palm_release_timer) {
          clearTimeout(tracker.palm_release_timer);
          tracker.palm_release_timer = null;
        }
        if (!tracker.palm_detected) {
          tracker.palm_detected = true;
          tracker.palm_first_down_time = Date.now();
        }
        if (!isPalmRestingSignal.value) {
          isPalmRestingSignal.value = true;
        }
      }
    };

    // Matches a native Touch to its corresponding unclaimed pointer record in active_pointers_ref
    const find_matching_pointer_id = (t) => {
      const bridge_map = touch_bridge_map_ref.current;
      const pointers = active_pointers_ref.current;
      const existing_mapped = bridge_map.get(t.identifier);
      if (existing_mapped !== undefined && pointers.has(existing_mapped)) {
        return existing_mapped;
      }

      // Build set of pointerIds already claimed by other Touch.identifiers so two touches never share one pointerId
      const claimed_pids = new Set();
      for (const [other_tid, mapped_pid] of bridge_map.entries()) {
        if (other_tid !== t.identifier && pointers.has(mapped_pid)) {
          claimed_pids.add(mapped_pid);
        }
      }

      const vv = get_vv_scale();
      let best_pid = null;
      let best_dist = 48;
      for (const p_rec of pointers.values()) {
        if (p_rec.pointer_type !== 'touch') continue;
        if (claimed_pids.has(p_rec.pointer_id)) continue;
        const d = Math.hypot(p_rec.last_x - t.clientX, p_rec.last_y - t.clientY) * vv;
        if (d < best_dist) {
          best_dist = d;
          best_pid = p_rec.pointer_id;
        }
      }

      if (best_pid !== null) {
        bridge_map.set(t.identifier, best_pid);
        return best_pid;
      }
      return null;
    };

    const create_synthetic_pointer_event = (t, pointer_id, type) => {
      const rx = typeof t.radiusX === 'number' && t.radiusX > 0 ? t.radiusX : 6;
      const ry = typeof t.radiusY === 'number' && t.radiusY > 0 ? t.radiusY : 6;
      return {
        pointerId: pointer_id,
        pointerType: 'touch',
        type,
        clientX: t.clientX,
        clientY: t.clientY,
        width: rx * 2,
        height: ry * 2,
        button: 0,
        buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        cancelable: false,
        is_synthetic_touch: true,
        preventDefault() {},
        stopPropagation() {},
      };
    };

    const handle_touch_start = (e) => {
      if (!is_hand_active()) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        if (typeof window !== 'undefined' && window.getSelection) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            sel.removeAllRanges();
          }
        }
        update_native_touch_palm_presence(e);

        if (e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            canceled_touch_ids_ref.current.delete(t.identifier);
            find_matching_pointer_id(t);
          }
        }
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();

      const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

      if (e.touches.length === 1) {
        const t = e.touches[0];
        set_is_hand_panning(true);
        hand_gesture_ref.current = {
          type: 'pan',
          start_x: t.clientX,
          start_y: t.clientY,
          initial_pan_x: vp.panX,
          initial_pan_y: vp.panY,
        };
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const mid_x = (t1.clientX + t2.clientX) / 2 - rect.left;
        const mid_y = (t1.clientY + t2.clientY) / 2 - rect.top;
        set_is_hand_panning(true);
        hand_gesture_ref.current = {
          type: 'pinch',
          start_dist: Math.max(10, dist),
          start_zoom: vp.zoom,
          world_x: (mid_x - vp.panX) / vp.zoom,
          world_y: (mid_y - vp.panY) / vp.zoom,
        };
      }
    };

    const handle_touch_move = (e) => {
      if (!is_hand_active()) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        update_native_touch_palm_presence(e);

        const now = Date.now();
        const pointers = active_pointers_ref.current;
        if (e.changedTouches && pointer_handlers_ref.current.move) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (canceled_touch_ids_ref.current.has(t.identifier)) {
              continue;
            }
            let pid = find_matching_pointer_id(t);
            if (pid === null && pointer_handlers_ref.current.down) {
              pid = -200000 - (Math.abs(t.identifier) % 100000);
              touch_bridge_map_ref.current.set(t.identifier, pid);
              const syn_down = create_synthetic_pointer_event(t, pid, 'pointerdown');
              pointer_handlers_ref.current.down(syn_down);
            }
            const rec = pid !== null ? pointers.get(pid) : null;
            if (rec) {
              const dist_delta = Math.hypot(t.clientX - rec.last_x, t.clientY - rec.last_y);
              const native_stale = now - (rec.last_native_pointer_time || 0) >= 28;
              if ((rec.is_synthetic_touch || native_stale) && dist_delta >= 0.4) {
                const syn_move = create_synthetic_pointer_event(t, pid, 'pointermove');
                pointer_handlers_ref.current.move(syn_move);
              }
            }
          }
        }
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();

      const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

      if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const mid_x = (t1.clientX + t2.clientX) / 2 - rect.left;
        const mid_y = (t1.clientY + t2.clientY) / 2 - rect.top;

        if (!hand_gesture_ref.current || hand_gesture_ref.current.type !== 'pinch') {
          hand_gesture_ref.current = {
            type: 'pinch',
            start_dist: Math.max(10, dist),
            start_zoom: vp.zoom,
            world_x: (mid_x - vp.panX) / vp.zoom,
            world_y: (mid_y - vp.panY) / vp.zoom,
          };
          return;
        }

        const st = hand_gesture_ref.current;
        const scale = dist / st.start_dist;
        const new_zoom = Math.min(2.5, Math.max(0.25, st.start_zoom * scale));
        const new_pan_x = mid_x - st.world_x * new_zoom;
        const new_pan_y = mid_y - st.world_y * new_zoom;
        updateViewport(new_pan_x, new_pan_y, new_zoom);
      } else if (e.touches.length === 1 && hand_gesture_ref.current?.type === 'pan') {
        const t = e.touches[0];
        const dx = t.clientX - hand_gesture_ref.current.start_x;
        const dy = t.clientY - hand_gesture_ref.current.start_y;
        updateViewport(
          hand_gesture_ref.current.initial_pan_x + dx,
          hand_gesture_ref.current.initial_pan_y + dy,
          vp.zoom
        );
      }
    };

    const handle_touch_end = (e) => {
      native_touch_count_ref.current = e.touches ? e.touches.length : 0;
      if (!is_hand_active()) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        const pointers = active_pointers_ref.current;
        if (e.changedTouches && pointer_handlers_ref.current.end) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            canceled_touch_ids_ref.current.delete(t.identifier);
            const mapped_pid = touch_bridge_map_ref.current.get(t.identifier);
            touch_bridge_map_ref.current.delete(t.identifier);
            if (mapped_pid !== undefined && pointers.has(mapped_pid)) {
              const rec = pointers.get(mapped_pid);
              const native_stale = Date.now() - (rec?.last_native_pointer_time || 0) >= 28;
              if (rec?.is_synthetic_touch || native_stale) {
                const end_type = e.type === 'touchcancel' ? 'pointercancel' : 'pointerup';
                const syn_end = create_synthetic_pointer_event(t, mapped_pid, end_type);
                pointer_handlers_ref.current.end(syn_end);
              }
            }
          }
        }
        const tracker = stylus_tracker_ref.current;
        if (e.type === 'touchcancel' && palmRejectionModeSignal.value !== 'off') {
          tracker.palm_detected = true;
          if (!isPalmRestingSignal.value) {
            isPalmRestingSignal.value = true;
          }
        }
        // Only allow palm state to clear once all native touches and pointers are gone
        if (
          native_touch_count_ref.current === 0 &&
          active_pointers_ref.current.size === 0 &&
          !is_drawing_ref.current
        ) {
          if (tracker.palm_release_timer) {
            clearTimeout(tracker.palm_release_timer);
          }
          const release_delay = e.type === 'touchcancel' ? 2800 : 220;
          tracker.palm_release_timer = setTimeout(() => {
            tracker.palm_release_timer = null;
            if (
              native_touch_count_ref.current === 0 &&
              active_pointers_ref.current.size === 0 &&
              !is_drawing_ref.current
            ) {
              reset_stylus_tracker();
            }
          }, release_delay);
        }
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();

      if (e.touches.length === 0) {
        hand_gesture_ref.current = null;
        set_is_hand_panning(false);
      } else if (e.touches.length === 1) {
        const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
        const t = e.touches[0];
        hand_gesture_ref.current = {
          type: 'pan',
          start_x: t.clientX,
          start_y: t.clientY,
          initial_pan_x: vp.panX,
          initial_pan_y: vp.panY,
        };
      }
    };

    el.addEventListener('touchstart', handle_touch_start, { passive: false });
    el.addEventListener('touchmove', handle_touch_move, { passive: false });
    el.addEventListener('touchend', handle_touch_end, { passive: false });
    el.addEventListener('touchcancel', handle_touch_end, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handle_touch_start);
      el.removeEventListener('touchmove', handle_touch_move);
      el.removeEventListener('touchend', handle_touch_end);
      el.removeEventListener('touchcancel', handle_touch_end);
    };
  }, [
    is_drawing_mode,
    current_tool,
    isSpacePressed,
    containerRef,
    reset_stylus_tracker,
  ]);

  // Global guard while Drawing Mode is active:
  // Blocks long-press "Select All" blue highlight overlay, native contextmenu callout popups,
  // and accidental DOM text selection anywhere on the board during finger/stylus hold.
  useEffect(() => {
    if (!is_drawing_mode) return;

    const is_editable_target = (target) => {
      const el = target && target.nodeType === 1 ? target : target?.parentElement;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        Boolean(el.isContentEditable)
      );
    };

    const clear_dom_selection = () => {
      if (typeof window !== 'undefined' && window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const anchor = sel.anchorNode;
          if (!is_editable_target(anchor)) {
            sel.removeAllRanges();
          }
        }
      }
    };

    clear_dom_selection();

    const handle_select_start = (e) => {
      if (!is_editable_target(e.target)) {
        if (e.cancelable) {
          e.preventDefault();
        }
        clear_dom_selection();
      }
    };

    const handle_context_menu = (e) => {
      if (!is_editable_target(e.target)) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
      }
    };

    const handle_selection_change = () => {
      clear_dom_selection();
    };

    document.addEventListener('selectstart', handle_select_start, true);
    document.addEventListener('contextmenu', handle_context_menu, true);
    document.addEventListener('selectionchange', handle_selection_change, true);

    return () => {
      document.removeEventListener('selectstart', handle_select_start, true);
      document.removeEventListener('contextmenu', handle_context_menu, true);
      document.removeEventListener('selectionchange', handle_selection_change, true);
    };
  }, [is_drawing_mode]);

  // If drawing mode is off, or if select/pointer tool is active, don't block canvas interactions
  if (!is_drawing_mode || current_tool === 'select') {
    return null;
  }

  const handle_pointer_down = (e) => {
    // Hand tool or Spacebar held: allow mouse / stylus drag to pan around the board
    if (current_tool === 'hand' || isSpacePressed) {
      if (e.pointerType === 'touch') {
        // Handled by native touch listeners above for 1-finger pan + 2-finger pinch-zoom
        return;
      }
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();

      const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
      const start_x = e.clientX;
      const start_y = e.clientY;
      const start_pan_x = vp.panX;
      const start_pan_y = vp.panY;
      set_is_hand_panning(true);

      let is_cleaned_up = false;

      const on_pan_up = () => {
        if (is_cleaned_up) return;
        is_cleaned_up = true;
        set_is_hand_panning(false);
        window.removeEventListener('pointermove', on_pan_move);
        window.removeEventListener('mousemove', on_pan_move);
        window.removeEventListener('pointerup', on_pan_up);
        window.removeEventListener('pointerup', on_pan_up, true);
        window.removeEventListener('mouseup', on_pan_up, true);
        window.removeEventListener('pointercancel', on_pan_up, true);
        window.removeEventListener('blur', on_pan_up);
        document.documentElement?.removeEventListener('mouseleave', on_pan_up);
      };

      const on_pan_move = (move_evt) => {
        if (typeof move_evt.buttons === 'number' && move_evt.buttons === 0) {
          on_pan_up();
          return;
        }
        const dx = move_evt.clientX - start_x;
        const dy = move_evt.clientY - start_y;
        const cur_zoom = activeBoardSignal.value?.viewport?.zoom || vp.zoom;
        updateViewport(start_pan_x + dx, start_pan_y + dy, cur_zoom);
      };

      window.addEventListener('pointermove', on_pan_move);
      window.addEventListener('mousemove', on_pan_move);
      window.addEventListener('pointerup', on_pan_up);
      window.addEventListener('pointerup', on_pan_up, true);
      window.addEventListener('mouseup', on_pan_up, true);
      window.addEventListener('pointercancel', on_pan_up, true);
      window.addEventListener('blur', on_pan_up);
      document.documentElement?.removeEventListener('mouseleave', on_pan_up);
      return;
    }

    // Only primary button for mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    if (selectedDrawingImageIdSignal.value) {
      selectedDrawingImageIdSignal.value = null;
    }

    const now = Date.now();
    const vv = get_vv_scale();
    const pointers = active_pointers_ref.current;
    const tracker = stylus_tracker_ref.current;

    // If this is a real browser pointerdown event and our TouchEvent fallback bridge already
    // created a synthetic pointer (`is_synthetic_touch === true`) at this spot, replace it cleanly.
    if (!e.is_synthetic_touch) {
      for (const [pid, p_rec] of pointers.entries()) {
        if (
          p_rec.is_synthetic_touch &&
          now - p_rec.start_time < 120 &&
          Math.hypot(p_rec.start_x - e.clientX, p_rec.start_y - e.clientY) * vv < 42
        ) {
          if (p_rec.settle_timer) {
            clearTimeout(p_rec.settle_timer);
          }
          if (active_pointer_id_ref.current === pid) {
            active_pointer_id_ref.current = e.pointerId;
          }
          pointers.delete(pid);
          tracker.palm_pointer_ids.delete(pid);
          for (const [tid, mapped_pid] of touch_bridge_map_ref.current.entries()) {
            if (mapped_pid === pid) {
              touch_bridge_map_ref.current.set(tid, e.pointerId);
            }
          }
        }
      }
    }

    // Prune any stale pointer records older than 8 seconds
    for (const [pid, p_rec] of pointers.entries()) {
      if (now - p_rec.last_move_time > 8000 && pid !== active_pointer_id_ref.current) {
        if (p_rec.settle_timer) {
          clearTimeout(p_rec.settle_timer);
        }
        pointers.delete(pid);
        tracker.palm_pointer_ids.delete(pid);
      }
    }

    const profile = get_contact_profile(e);

    const new_rec = {
      pointer_id: e.pointerId,
      pointer_type: e.pointerType || 'touch',
      is_synthetic_touch: Boolean(e.is_synthetic_touch),
      start_x: e.clientX,
      start_y: e.clientY,
      anchor_x: e.clientX,
      anchor_y: e.clientY,
      anchor_time: now,
      last_x: e.clientX,
      last_y: e.clientY,
      last_native_pointer_time: e.is_synthetic_touch ? 0 : now,
      history: [{ x: e.clientX, y: e.clientY, time: now }],
      last_sample_x: e.clientX,
      last_sample_y: e.clientY,
      last_sample_time: now,
      last_step_dist: 0,
      last_dx: 0,
      last_dy: 0,
      start_time: now,
      last_move_time: now,
      total_screen_dist: 0,
      max_dist_from_start: 0,
      has_size: profile.has_size,
      contact_width: profile.w,
      contact_height: profile.h,
      contact_area: profile.area,
      is_large_palm: profile.is_large_palm,
      is_huge_palm: profile.is_huge_palm,
      is_disc_candidate: true,
      is_palm: false,
      is_palm_locked: false,
      is_stylus: false,
      confirmed_stylus: false,
      is_stylus_candidate: true,
      pending_screen_points: [{ x: e.clientX, y: e.clientY, time: now }],
      settle_timer: null,
    };

    const other_pointers = Array.from(pointers.values()).filter(
      (p) => p.pointer_id !== e.pointerId
    );
    pointers.set(e.pointerId, new_rec);

    const palm_rejection_on = palmRejectionModeSignal.value !== 'off';

    if (tracker.palm_release_timer) {
      clearTimeout(tracker.palm_release_timer);
      tracker.palm_release_timer = null;
    }

    // 1. Hardware active stylus ('pen') always takes priority over any touch
    if (e.pointerType === 'pen') {
      if (!isStylusActiveSignal.value) {
        isStylusActiveSignal.value = true;
      }
      other_pointers.forEach((p) => mark_pointer_as_palm(p, true));
      activate_stylus_pointer(e, new_rec, true);
      return;
    }

    // 2. Desktop mouse always draws directly
    if (e.pointerType === 'mouse') {
      activate_stylus_pointer(e, new_rec, true);
      return;
    }

    // 3. Multi-touch arbitration when 1+ touches are ALREADY on the screen (Palm is resting!):
    if (other_pointers.length >= 1) {
      if (!tracker.palm_detected) {
        tracker.palm_detected = true;
        tracker.palm_first_down_time = other_pointers[0].start_time || now;
      }
      if (palm_rejection_on && !isPalmRestingSignal.value) {
        isPalmRestingSignal.value = true;
      }

      const current_active =
        active_pointer_id_ref.current !== null
          ? pointers.get(active_pointer_id_ref.current)
          : null;

      // Is `current_active` ALREADY the stylus actively drawing a real stroke right now?
      const active_disp_55 = current_active ? get_disp_since(current_active, now - 55, vv) : 0;
      const active_is_drawing_real_stroke = Boolean(
        current_active &&
          !current_active.is_palm &&
          !current_active.is_palm_locked &&
          active_disp_55 >= 3.2 &&
          (current_active.max_dist_from_start >= 18 ||
            (current_active.confirmed_stylus && current_active.max_dist_from_start >= 6))
      );

      if (active_is_drawing_real_stroke) {
        // `current_active` is the user's stylus mid-stroke! Any new touch landing while the
        // stylus is actively moving across the screen is a secondary palm crease sub-touch.
        mark_pointer_as_palm(new_rec, true);
        return;
      }

      // Otherwise, lock any existing pointers that have settled (< 4.2px in last 50ms) as confirmed palms!
      // If `current_active` was just a resting palm (even if it slid 15-40px when first placed down),
      // locking it releases `active_pointer_id_ref.current = null` so `new_rec` (the stylus) can draw immediately!
      for (const p of other_pointers) {
        const p_disp_50 = get_disp_since(p, now - 50, vv);
        if (p_disp_50 < 4.2) {
          if (
            p.pointer_id === active_pointer_id_ref.current &&
            !p.is_palm &&
            p.max_dist_from_start >= 60 &&
            stroke_points_ref.current.length >= 6
          ) {
            commit_current_stroke();
          }
          mark_pointer_as_palm(p, true);
        }
      }
    } else {
      tracker.palm_first_down_time = now;
    }

    // In [All Touch] mode: activate immediately if no pointer holds `active_pointer_id_ref`
    if (!palm_rejection_on) {
      if (active_pointer_id_ref.current === null) {
        activate_stylus_pointer(e, new_rec, false);
      }
      return;
    }

    schedule_settling_palm_check(new_rec.pointer_id, 140);
  };
  pointer_handlers_ref.current.down = handle_pointer_down;

  const handle_hover_move = (e) => {
    if (current_tool === 'eraser' && !is_drawing_ref.current) {
      const pt = get_canvas_coords(e.clientX, e.clientY);
      const current_zoom = Math.max(0.1, activeBoardSignal.value?.viewport?.zoom || 1);
      const hit_threshold = 14 / current_zoom;
      const drawings = activeBoardSignal.value?.drawings || [];
      const hit = drawings.find((s) => is_stroke_near_point(s, pt, hit_threshold));
      hoveredEraseStrokeIdSignal.value = hit ? hit.id : null;
    }
  };

  const handle_pointer_leave = () => {
    hoveredEraseStrokeIdSignal.value = null;
  };

  const current_vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
  const is_hand_mode = current_tool === 'hand' || isSpacePressed;
  const cursor_class = is_hand_mode
    ? is_hand_panning
      ? styles['lumen-drawing-surface-hand-panning']
      : styles['lumen-drawing-surface-hand']
    : current_tool === 'eraser'
    ? styles['lumen-drawing-surface-eraser']
    : styles['lumen-drawing-surface-pen'];

  return (
    <div
      ref={surface_ref}
      className={`${styles['lumen-drawing-surface-overlay']} ${cursor_class}`}
      onPointerDown={handle_pointer_down}
      onPointerMove={handle_hover_move}
      onPointerLeave={handle_pointer_leave}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Live active stroke preview directly in surface coordinate system for zero-lag rendering */}
      {live_stroke && live_stroke.points && live_stroke.points.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {live_stroke.points.length === 1 ? (
            <circle
              cx={live_stroke.points[0].x * current_vp.zoom + current_vp.panX}
              cy={live_stroke.points[0].y * current_vp.zoom + current_vp.panY}
              r={(live_stroke.width * current_vp.zoom) / 2}
              fill={live_stroke.color}
              opacity={live_stroke.opacity}
            />
          ) : (
            <path
              d={points_to_screen_path(
                live_stroke.points,
                current_vp.panX,
                current_vp.panY,
                current_vp.zoom
              )}
              stroke={live_stroke.color}
              strokeWidth={live_stroke.width * current_vp.zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={live_stroke.opacity}
            />
          )}
        </svg>
      )}
    </div>
  );
}
