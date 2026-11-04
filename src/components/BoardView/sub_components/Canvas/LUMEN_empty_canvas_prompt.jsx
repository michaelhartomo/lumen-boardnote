import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  StickyNote,
  CheckSquare,
  ImageIcon,
  PenTool,
  LayoutTemplate,
  Compass,
} from 'lucide-react';
import {
  addCard,
  isDrawingModeSignal,
  isTemplateModalOpenSignal,
  activeBoardSignal,
  snapToGridSignal,
  snapToGrid,
  showToast,
} from '../../signals/boardState.js';
import styles from './LUMEN_empty_canvas_prompt.module.css';

/**
 * LUMEN_empty_canvas_prompt
 * Simple, clean empty state prompt for the spatial canvas workspace.
 * Floats gently and moves dynamically to stay precisely centered in the viewport.
 */
export default function LUMEN_empty_canvas_prompt({ viewport, containerRef } = {}) {
  useSignals();
  const [dimensions, set_dimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  // Track viewport container dimensions on resize
  useEffect(() => {
    function update_size() {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          set_dimensions({ width: rect.width, height: rect.height });
          return;
        }
      }
      if (typeof window !== 'undefined') {
        set_dimensions({ width: window.innerWidth, height: window.innerHeight });
      }
    }
    update_size();
    window.addEventListener('resize', update_size);
    return () => window.removeEventListener('resize', update_size);
  }, [containerRef]);

  // Compute exact center of visible screen in world viewport coordinates
  const cur_viewport = viewport || activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
  const zoom = cur_viewport.zoom || 1;
  const center_x = Math.round((-cur_viewport.panX + dimensions.width / 2) / zoom);
  const center_y = Math.round((-cur_viewport.panY + dimensions.height / 2) / zoom);

  // Helper to compute coordinates for created cards relative to current center
  const get_spawn_coordinates = (offset_x = 0, offset_y = 0) => {
    const raw_x = center_x - 140 + offset_x;
    const raw_y = center_y - 90 + offset_y;
    return {
      x: snapToGridSignal.value ? snapToGrid(raw_x) : raw_x,
      y: snapToGridSignal.value ? snapToGrid(raw_y) : raw_y,
    };
  };

  // Quick Action Handlers
  const handle_add_note = (e) => {
    e.stopPropagation();
    const coords = get_spawn_coordinates(0, 0);
    addCard({
      type: 'note',
      title: 'Idea / Memo',
      content: 'Write notes, project briefs, or thoughts here.',
      color: 'yellow',
      x: coords.x,
      y: coords.y,
    });
    showToast('Sticky note added to canvas');
  };

  const handle_add_checklist = (e) => {
    e.stopPropagation();
    const coords = get_spawn_coordinates(32, 24);
    addCard({
      type: 'tasklist',
      title: 'Sprint Checklist',
      items: [
        { id: 'item_1', text: 'Curate design references and palettes', done: false },
        { id: 'item_2', text: 'Assemble structural wireframes', done: false },
        { id: 'item_3', text: 'Review spatial layout deliverables', done: false },
      ],
      color: 'teal',
      x: coords.x,
      y: coords.y,
    });
    showToast('Checklist card added to canvas');
  };

  const handle_add_image = (e) => {
    e.stopPropagation();
    const coords = get_spawn_coordinates(-32, 24);
    addCard({
      type: 'image',
      title: 'Visual Reference',
      x: coords.x,
      y: coords.y,
    });
    showToast('Image card added to canvas');
  };

  const handle_open_drawing = (e) => {
    e.stopPropagation();
    isDrawingModeSignal.value = true;
  };

  const handle_open_templates = (e) => {
    e.stopPropagation();
    isTemplateModalOpenSignal.value = true;
  };

  return (
    <div
      className={styles['lumen-empty-prompt-wrapper']}
      data-lumen-empty-prompt="true"
      style={{
        left: `${center_x}px`,
        top: `${center_y}px`,
      }}
    >
      <div className={styles['lumen-empty-prompt-card']}>
        {/* Simple Clean Icon Badge */}
        <div className={styles['lumen-empty-prompt-icon-badge']}>
          <Compass size={22} />
        </div>

        {/* Clean Title & Simple Info */}
        <h2 className={styles['lumen-empty-prompt-title']}>Spatial Canvas Ready</h2>

        <p className={styles['lumen-empty-prompt-desc']}>
          Your workspace is ready. Click below to add your first card, or drag modules from the left dock.
        </p>

        {/* Quick Action Buttons */}
        <div className={styles['lumen-empty-prompt-actions']}>
          <button
            type="button"
            className={`${styles['lumen-empty-prompt-btn']} ${styles['lumen-empty-prompt-btn-note']}`}
            onClick={handle_add_note}
            title="Create a Sticky Note (Press N or Click)"
          >
            <StickyNote size={14} />
            <span>+ Note</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-empty-prompt-btn']} ${styles['lumen-empty-prompt-btn-task']}`}
            onClick={handle_add_checklist}
            title="Create a Checklist Card"
          >
            <CheckSquare size={14} />
            <span>+ Checklist</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-empty-prompt-btn']} ${styles['lumen-empty-prompt-btn-image']}`}
            onClick={handle_add_image}
            title="Create an Image Card"
          >
            <ImageIcon size={14} />
            <span>+ Image</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-empty-prompt-btn']} ${styles['lumen-empty-prompt-btn-draw']}`}
            onClick={handle_open_drawing}
            title="Start Freehand Drawing & Sketching"
          >
            <PenTool size={14} />
            <span>+ Sketch</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-empty-prompt-btn']} ${styles['lumen-empty-prompt-btn-template']}`}
            onClick={handle_open_templates}
            title="Explore Curated Board Templates"
          >
            <LayoutTemplate size={14} />
            <span>Templates</span>
          </button>
        </div>

        {/* Clean Shortcut Guidance */}
        <div className={styles['lumen-empty-prompt-hint']}>
          <span>Double-click canvas to create note</span>
          <span>•</span>
          <span>
            Hold <kbd className={styles['lumen-empty-prompt-hint-kbd']}>Space</kbd> to pan
          </span>
        </div>
      </div>
    </div>
  );
}
