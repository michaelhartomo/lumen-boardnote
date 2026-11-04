import { useState, useRef, useEffect, useCallback } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Tag,
  X,
  Boxes,
  Sparkles,
  Trash2,
  Copy,
  Lock,
  AlignLeft,
  AlignStartVertical,
  AlignHorizontalSpaceAround,
  Clock,
} from 'lucide-react';

import styles from './Canvas.module.css';
import Card from '../Card/Card.jsx';
import ConnectionLines from './ConnectionLines.jsx';
import LUMEN_drawing_layer from '../Drawing/LUMEN_drawing_layer.jsx';
import LUMEN_drawing_surface from '../Drawing/LUMEN_drawing_surface.jsx';
import LUMEN_drawing_toolbar from '../Drawing/LUMEN_drawing_toolbar.jsx';
import LUMEN_collaborator_cursors from './LUMEN_collaborator_cursors.jsx';

import {
  activeBoardSignal,
  updateViewport,
  selectedCardsSignal,
  activeToolSignal,
  snapToGridSignal,
  showGridDotsSignal,
  gridDimensionSignal,
  BOARD_THEMES,
  snapToGrid,
  addCard,
  updateCard,
  addCardToGroup,
  removeCardFromGroup,
  createGroupCard,
  autoLayoutGroupColumn,
  connectingSourceSignal,
  tempConnectionLineSignal,
  isDrawingModeSignal,
  drawingToolSignal,
  activeTagFilterSignal,
  clearTagFilter,
  activeTimeRangeFilterSignal,
  clearTimeRangeFilter,
  deleteSelectedCards,
  duplicateSelectedCards,
  lockSelectedCards,
  alignSelectedCards,
  selectAllCards,
  clearCardSelection,
  selectedDrawingImageIdSignal,
  addDrawingImage,
  deleteDrawingImage,
  duplicateDrawingImage,
  upload_lumen_file,
  MAX_BOARD_FILE_SIZE_MB,
  MAX_BOARD_FILE_SIZE_BYTES,
  showToast,
} from '../../signals/boardState.js';
import design_item_image from '../../assets/images/lumen_mood_design_1791015845283.jpg';
import { askAiAboutSelectedCards } from '../../signals/aiState.js';
import { broadcastCursorMove, broadcastCardSelect } from '../../signals/realtimeState.js';
import { does_card_match_time_filter } from '../../utils/googleCalendarSync.js';
import LUMEN_empty_canvas_prompt from './LUMEN_empty_canvas_prompt.jsx';

// Helper to calculate edge anchor point on card boundary towards target point
function getCardEdgePoint(card, targetX, targetY) {
  const cX = card.x + card.width / 2;
  const cY = card.y + card.height / 2;
  const dx = targetX - cX;
  const dy = targetY - cY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { x: card.x + card.width, y: cY }
      : { x: card.x, y: cY };
  } else {
    return dy > 0
      ? { x: cX, y: card.y + card.height }
      : { x: cX, y: card.y };
  }
}

export default function Canvas({ readOnly = false, on_upload_file } = {}) {
  useSignals();
  const containerRef = useRef(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dropGhost, setDropGhost] = useState(null); // { x, y, width, height }
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY, isSelecting: boolean }
  const initialSelectionRef = useRef([]);
  const activePanCleanupRef = useRef(null);

  const activeBoard = activeBoardSignal.value || {};
  const cards = activeBoard.cards || [];
  const viewport = activeBoard.viewport || { panX: 0, panY: 0, zoom: 1 };

  const tool = activeToolSignal.value;
  const snap = snapToGridSignal.value;
  const gridDots = showGridDotsSignal.value;
  const gridDimension = gridDimensionSignal.value || 24;
  const boardSetting = activeBoard.board_setting || {};
  const currentTheme = BOARD_THEMES[boardSetting.color_theme] || BOARD_THEMES.default;
  const gridStyle = boardSetting.grid_style || 'dots';
  const activeTagFilter = activeTagFilterSignal.value;
  const matchingCount = activeTagFilter
    ? cards.filter((c) =>
        (c.tags || []).some(
          (t) => (typeof t === 'string' ? t : t.text).toLowerCase() === activeTagFilter.toLowerCase()
        )
      ).length
    : 0;

  const activeTimeFilter = activeTimeRangeFilterSignal.value;
  const isTimeFilterActive = Boolean(activeTimeFilter && activeTimeFilter.mode && activeTimeFilter.mode !== 'all');
  const timeMatchingCount = isTimeFilterActive
    ? cards.filter((c) => does_card_match_time_filter(c, activeTimeFilter)).length
    : 0;

  // Global keyboard shortcuts (Space to Pan, Escape to cancel/deselect, Delete/Backspace, Select All, Duplicate)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const targetEl = e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
      const sel = window.getSelection();
      const selNode = sel && sel.rangeCount > 0 && sel.anchorNode
        ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)
        : null;

      // Determine if focus, target, or selection is inside any text input, contenteditable area, code block, spreadsheet, or document editor
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl?.tagName) ||
        Boolean(activeEl?.isContentEditable) ||
        Boolean(activeEl?.closest?.('[contenteditable="true"]')) ||
        Boolean(activeEl?.closest?.('.lumen-docs-code-container')) ||
        Boolean(activeEl?.closest?.('[data-language]')) ||
        Boolean(activeEl?.closest?.('[class*="lumen-docs"]')) ||
        Boolean(activeEl?.closest?.('[class*="lumen-sheets"]')) ||
        Boolean(activeEl?.closest?.('[class*="lumen-code"]')) ||
        Boolean(activeEl?.closest?.('[class*="lumenCardBody"]')) ||
        Boolean(targetEl?.isContentEditable) ||
        Boolean(targetEl?.closest?.('[contenteditable="true"]')) ||
        Boolean(targetEl?.closest?.('.lumen-docs-code-container')) ||
        Boolean(targetEl?.closest?.('[data-language]')) ||
        Boolean(targetEl?.closest?.('[class*="lumen-docs"]')) ||
        Boolean(targetEl?.closest?.('[class*="lumen-sheets"]')) ||
        Boolean(targetEl?.closest?.('[class*="lumen-code"]')) ||
        Boolean(targetEl?.closest?.('[class*="lumenCardBody"]')) ||
        Boolean(selNode?.isContentEditable) ||
        Boolean(selNode?.closest?.('[contenteditable="true"]')) ||
        Boolean(selNode?.closest?.('.lumen-docs-code-container')) ||
        Boolean(selNode?.closest?.('[data-language]')) ||
        Boolean(selNode?.closest?.('[class*="lumen-docs"]')) ||
        Boolean(selNode?.closest?.('[class*="lumen-sheets"]')) ||
        Boolean(selNode?.closest?.('[class*="lumen-code"]')) ||
        Boolean(selNode?.closest?.('[class*="lumenCardBody"]')) ||
        Boolean(document.querySelector('.lumen-docs-modal-backdrop')) ||
        Boolean(document.querySelector('[class*="lumen-sheets-modal-backdrop"]')) ||
        Boolean(document.querySelector('[class*="lumen-code-modal-backdrop"]'));

      if (e.key === 'Escape') {
        connectingSourceSignal.value = null;
        tempConnectionLineSignal.value = null;
        activeToolSignal.value = 'select';
        clearCardSelection();
        selectedDrawingImageIdSignal.value = null;
      }

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Delete or Backspace to delete selected drawing layers or cards
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedDrawingImageIdSignal.value && isDrawingModeSignal.value) {
          e.preventDefault();
          deleteDrawingImage(selectedDrawingImageIdSignal.value);
        } else if (selectedCardsSignal.value.length > 0) {
          e.preventDefault();
          deleteSelectedCards();
        }
      }

      // Cmd+A or Ctrl+A to select all cards (disabled in Drawing Mode)
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'a' || e.key === 'A') &&
        !isInput &&
        !isDrawingModeSignal.value
      ) {
        e.preventDefault();
        selectAllCards();
      }

      // Cmd+D or Ctrl+D to duplicate selected drawing layer or cards
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D') && !isInput) {
        if (selectedDrawingImageIdSignal.value && isDrawingModeSignal.value) {
          e.preventDefault();
          duplicateDrawingImage(selectedDrawingImageIdSignal.value);
        } else if (selectedCardsSignal.value.length > 0) {
          e.preventDefault();
          duplicateSelectedCards();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    const handleWindowBlur = () => {
      setIsSpacePressed(false);
      if (activePanCleanupRef.current) {
        activePanCleanupRef.current();
      } else {
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      if (activePanCleanupRef.current) {
        activePanCleanupRef.current();
      }
    };
  }, []);

  // Ensure any group cards on the board are properly laid out on board load
  useEffect(() => {
    const board = activeBoardSignal.value;
    const groupCards = (board?.cards || []).filter((c) => c.type === 'group');
    groupCards.forEach((g) => {
      autoLayoutGroupColumn(g.id);
    });
  }, [activeBoardSignal.value?.id]);

  // Mouse wheel zoom and pan
  const handleWheel = (e) => {
    const target = e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
    const isHandActive =
      tool === 'hand' ||
      isSpacePressed ||
      (isDrawingModeSignal.value && drawingToolSignal.value === 'hand');

    if (isHandActive) {
      // In Hand Mode, only ignore wheel if inside a floating UI menu/panel/modal/dock outside the board cards
      const isFloatingUiMenu =
        target &&
        target.closest &&
        target.closest(
          '[class*="MultiSelect"], [class*="multi-select"], [class*="multiSelect"],' +
            '[class*="Dock"], [class*="dock"],' +
            '[class*="PropertyPanel"], [class*="property-panel"], [class*="propertyPanel"],' +
            '[class*="LayerPanel"], [class*="layer-panel"], [class*="layerPanel"],' +
            '[class*="BoardSettings"], [class*="board-settings"],' +
            '[class*="AiAssistant"], [class*="ai-assistant"], [class*="aiPanel"],' +
            '[class*="CommentsDrawer"], [class*="comments-drawer"],' +
            '[class*="ActivityDrawer"], [class*="activity-drawer"],' +
            '[class*="Modal"], [class*="modal"], [class*="Popover"], [class*="popover"], [class*="Dropdown"], [class*="dropdown"],' +
            '[class*="Toolbar"], [class*="toolbar"], [class*="Dialog"], [class*="dialog"],' +
            '[class*="Minimap"], [class*="minimap"],' +
            '[data-lumen-menu="true"]'
        );
      if (isFloatingUiMenu) {
        return;
      }
    } else {
      // 1. In Select Mode: if wheel event originated inside any card, menu, panel, drawer, or interactive element:
      // Allow natural vertical/horizontal internal scrolling, but NEVER pan or zoom the canvas board!
      const isInsideCardOrMenu =
        target &&
        target.closest &&
        target.closest(
          // All cards & nested card containers
          '[data-lumen-card="true"], [data-card-id], [class*="lumenCard"], [class*="lumen-card"], [class*="Card"], [class*="card"],' +
            // Form elements & editors inside cards
            'textarea, input, select, pre, code, table, [contenteditable="true"],' +
            // Multi-Select Floating Bar & its scrollable action rows
            '[class*="MultiSelect"], [class*="multi-select"], [class*="multiSelect"],' +
            // Dock & Card creation menu
            '[class*="Dock"], [class*="dock"],' +
            // Side Panels: Properties, Layers, Board Settings, Color Picker
            '[class*="PropertyPanel"], [class*="property-panel"], [class*="propertyPanel"], [class*="property"],' +
            '[class*="LayerPanel"], [class*="layer-panel"], [class*="layerPanel"],' +
            '[class*="BoardSettings"], [class*="board-settings"],' +
            // Drawers: AI Assistant, Comments, Activity Log
            '[class*="AiAssistant"], [class*="ai-assistant"], [class*="aiPanel"],' +
            '[class*="CommentsDrawer"], [class*="comments-drawer"],' +
            '[class*="ActivityDrawer"], [class*="activity-drawer"],' +
            // Modals, Popovers, Dropdowns, Toolbars
            '[class*="Modal"], [class*="modal"], [class*="Popover"], [class*="popover"], [class*="Dropdown"], [class*="dropdown"],' +
            '[class*="Toolbar"], [class*="toolbar"], [class*="Dialog"], [class*="dialog"],' +
            // Minimap
            '[class*="Minimap"], [class*="minimap"],' +
            // Explicit markers or scrollable containers
            '[data-lumen-scrollable="true"], [data-lumen-menu="true"]'
        );

      if (isInsideCardOrMenu) {
        // Natural internal scroll inside card or menu continues; do NOT pan or zoom board!
        return;
      }

      // 2. Also check if any ancestor element up to canvas container has scrollable overflow
      let curr = target;
      while (curr && curr !== containerRef.current && curr !== document.body) {
        try {
          const computed = window.getComputedStyle(curr);
          const oY = computed.overflowY;
          const oX = computed.overflowX;
          const isScrollY = (oY === 'auto' || oY === 'scroll') && curr.scrollHeight > curr.clientHeight;
          const isScrollX = (oX === 'auto' || oX === 'scroll') && curr.scrollWidth > curr.clientWidth;
          if (isScrollY || isScrollX) {
            return;
          }
        } catch (err) {
          // Ignore compute error
        }
        curr = curr.parentElement;
      }
    }

    // If pinch-to-zoom or Ctrl + Wheel on canvas background (or anywhere in Hand mode)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      const newZoom = Math.min(2.0, Math.max(0.3, viewport.zoom * zoomFactor));

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - viewport.panX) * (newZoom / viewport.zoom);
      const newPanY = mouseY - (mouseY - viewport.panY) * (newZoom / viewport.zoom);

      updateViewport(newPanX, newPanY, newZoom);
    } else {
      // Normal panning with scroll wheel
      e.preventDefault();
      const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
      const deltaY = e.shiftKey ? 0 : e.deltaY;
      updateViewport(viewport.panX - deltaX, viewport.panY - deltaY, viewport.zoom);
    }
  };

  const startBoardPanSession = (e) => {
    // Always clean up any previous pan session so listeners can never be orphaned
    if (activePanCleanupRef.current) {
      activePanCleanupRef.current();
    }

    if (
      document.activeElement &&
      containerRef.current &&
      containerRef.current.contains(document.activeElement) &&
      typeof document.activeElement.blur === 'function'
    ) {
      document.activeElement.blur();
    }

    setIsPanning(true);
    const vpStart = viewportRef.current || viewport;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPanX = vpStart.panX;
    const startPanY = vpStart.panY;

    let isCleanedUp = false;

    const stopPan = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (activePanCleanupRef.current === stopPan) {
        activePanCleanupRef.current = null;
      }
      setIsPanning(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopPan);
      window.removeEventListener('mouseup', stopPan, true);
      window.removeEventListener('pointerup', stopPan, true);
      window.removeEventListener('pointercancel', stopPan, true);
      window.removeEventListener('touchend', stopPan, true);
      window.removeEventListener('touchcancel', stopPan, true);
      window.removeEventListener('blur', stopPan);
      window.removeEventListener('contextmenu', stopPan);
      document.documentElement?.removeEventListener('mouseleave', stopPan);
      document.removeEventListener('visibilitychange', stopPan);
    };

    const handleMouseMove = (moveEvent) => {
      // Critical trackpad/iframe guard: if all mouse/trackpad buttons are released (buttons === 0),
      // immediately end the pan session even if mouseup was missed.
      if (typeof moveEvent.buttons === 'number' && moveEvent.buttons === 0) {
        stopPan();
        return;
      }
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const curZoom = viewportRef.current?.zoom || vpStart.zoom;
      updateViewport(startPanX + deltaX, startPanY + deltaY, curZoom);
    };

    activePanCleanupRef.current = stopPan;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopPan);
    window.addEventListener('mouseup', stopPan, true);
    window.addEventListener('pointerup', stopPan, true);
    window.addEventListener('pointercancel', stopPan, true);
    window.addEventListener('touchend', stopPan, true);
    window.addEventListener('touchcancel', stopPan, true);
    window.addEventListener('blur', stopPan);
    window.addEventListener('contextmenu', stopPan);
    document.documentElement?.addEventListener('mouseleave', stopPan);
    document.addEventListener('visibilitychange', stopPan);
  };

  // Capture-phase mousedown so Hand Mode (or Spacebar / Middle-click) ALWAYS pans the board
  // even when clicking directly on cards that call e.stopPropagation() (Note, Currency, Embeds, etc.)
  const handleMouseDownCapture = (e) => {
    if (e.button !== 0 && e.button !== 1) return;

    const isHandOrPanTrigger =
      e.button === 1 ||
      isSpacePressed ||
      tool === 'hand' ||
      (isDrawingModeSignal.value && drawingToolSignal.value === 'hand');

    if (!isHandOrPanTrigger) return;

    const target = e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
    if (
      target &&
      target.closest &&
      target.closest(
        '[data-lumen-menu="true"], [class*="MultiSelect"], [class*="multi-select"], [class*="ActiveTagFilter"], [class*="drawing-toolbar"], [class*="drawing-layer-panel"]'
      )
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    startBoardPanSession(e);
  };

  // Canvas background mousedown (for panning, marquee selection, or deselecting)
  const handleMouseDown = (e) => {
    const isHandOrPanTrigger =
      e.button === 1 ||
      isSpacePressed ||
      tool === 'hand' ||
      (isDrawingModeSignal.value && drawingToolSignal.value === 'hand');

    // If drawing mode is active with pen or eraser (and not Hand pan), do not trigger background pan or deselect
    if (!isHandOrPanTrigger && isDrawingModeSignal.value && drawingToolSignal.value !== 'select') {
      return;
    }

    if (e.button !== 0 && e.button !== 1) return;

    if (isHandOrPanTrigger) {
      e.preventDefault();
      startBoardPanSession(e);
      return;
    }

    // In Drawing Mode (including Select/Pointer tool), never start card marquee selection ("Select All" blue box)
    if (isDrawingModeSignal.value) {
      if (
        containerRef.current &&
        (e.target === containerRef.current ||
          e.target.classList?.contains(styles.lumenViewport) ||
          e.target.classList?.contains(styles.lumenGridDots))
      ) {
        selectedDrawingImageIdSignal.value = null;
        clearCardSelection();
      }
      return;
    }

    // Default select tool on canvas container background: Marquee Selection
    if (
      tool === 'select' &&
      e.button === 0 &&
      containerRef.current &&
      (e.target === containerRef.current ||
        e.target.classList?.contains(styles.lumenViewport) ||
        e.target.classList?.contains(styles.lumenGridDots))
    ) {
      const rect = containerRef.current.getBoundingClientRect();
      const startCanvasX = (e.clientX - rect.left - viewport.panX) / viewport.zoom;
      const startCanvasY = (e.clientY - rect.top - viewport.panY) / viewport.zoom;

      const isMultiKey = e.shiftKey || e.metaKey || e.ctrlKey;
      initialSelectionRef.current = isMultiKey ? [...(selectedCardsSignal.value || [])] : [];

      let hasDragged = false;
      setMarquee({
        startX: startCanvasX,
        startY: startCanvasY,
        currentX: startCanvasX,
        currentY: startCanvasY,
        isSelecting: false,
      });

      const handleMarqueeMouseMove = (moveEvent) => {
        const curCanvasX = (moveEvent.clientX - rect.left - viewport.panX) / viewport.zoom;
        const curCanvasY = (moveEvent.clientY - rect.top - viewport.panY) / viewport.zoom;

        const dist = Math.hypot(curCanvasX - startCanvasX, curCanvasY - startCanvasY);
        if (dist > 4) {
          hasDragged = true;
        }

        if (hasDragged) {
          const minX = Math.min(startCanvasX, curCanvasX);
          const maxX = Math.max(startCanvasX, curCanvasX);
          const minY = Math.min(startCanvasY, curCanvasY);
          const maxY = Math.max(startCanvasY, curCanvasY);

          // Find intersecting cards on canvas
          const currentCards = activeBoardSignal.value.cards || [];
          const intersectingIds = currentCards
            .filter((c) => {
              if (c.hidden) return false;
              const w = c.width || 320;
              const h = c.height || 200;
              return c.x < maxX && c.x + w > minX && c.y < maxY && c.y + h > minY;
            })
            .map((c) => c.id);

          const combined = (moveEvent.shiftKey || moveEvent.metaKey || moveEvent.ctrlKey)
            ? Array.from(new Set([...initialSelectionRef.current, ...intersectingIds]))
            : intersectingIds;

          selectedCardsSignal.value = combined;
          if (typeof broadcastCardSelect === 'function') {
            broadcastCardSelect(combined);
          }

          setMarquee({
            startX: startCanvasX,
            startY: startCanvasY,
            currentX: curCanvasX,
            currentY: curCanvasY,
            isSelecting: true,
          });
        }
      };

      const handleMarqueeMouseUp = () => {
        window.removeEventListener('mousemove', handleMarqueeMouseMove);
        window.removeEventListener('mouseup', handleMarqueeMouseUp);
        setMarquee(null);

        if (!hasDragged) {
          // Simply clicked on empty canvas background: deselect
          clearCardSelection();
          connectingSourceSignal.value = null;
          tempConnectionLineSignal.value = null;
        }
      };

      window.addEventListener('mousemove', handleMarqueeMouseMove);
      window.addEventListener('mouseup', handleMarqueeMouseUp);
    }
  };

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const spaceRef = useRef(isSpacePressed);
  spaceRef.current = isSpacePressed;

  // Mobile Touch Gestures: Single finger panning and two-finger pinch-to-zoom
  const touchStateRef = useRef(null);

  const handleTouchStart = (e) => {
    const isHandMode =
      toolRef.current === 'hand' ||
      spaceRef.current ||
      (isDrawingModeSignal.value && drawingToolSignal.value === 'hand');

    // If drawing mode with pen/eraser is active (and not Hand mode), let drawing layer handle touches
    if (!isHandMode && isDrawingModeSignal.value && drawingToolSignal.value !== 'select') {
      return;
    }

    if (!isHandMode) {
      // In pointer/select mode: let child handle touch if inside card or menu
      if (
        e.target &&
        e.target.closest &&
        e.target.closest(
          '[data-lumen-card="true"], [data-card-id], [class*="lumenCard"], [class*="lumen-card"], [class*="Card"], [class*="card"],' +
          'input, textarea, button, select, pre, code, table, [contenteditable="true"],' +
          '[class*="MultiSelect"], [class*="multi-select"], [class*="multiSelect"],' +
          '[class*="Dock"], [class*="dock"],' +
          '[class*="Panel"], [class*="panel"], [class*="property"],' +
          '[class*="Drawer"], [class*="drawer"],' +
          '[class*="Modal"], [class*="modal"],' +
          '[class*="Menu"], [class*="menu"],' +
          '[class*="Dropdown"], [class*="dropdown"],' +
          '[class*="Minimap"], [class*="minimap"],' +
          '[data-lumen-scrollable="true"], [data-lumen-menu="true"]'
        )
      ) {
        return;
      }
    } else {
      // In Hand tool mode: allow touch pan & pinch zoom everywhere across canvas (even over cards & embeds),
      // only ignore if directly tapping dock buttons, top header buttons, or modal controls
      if (
        e.target &&
        e.target.closest &&
        e.target.closest(
          '[class*="Dock"], [class*="dock"], [class*="Header"], [class*="header"], [class*="Modal"], [class*="modal"], [data-lumen-menu="true"]'
        )
      ) {
        return;
      }
    }

    const vp = viewportRef.current;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStateRef.current = {
        type: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        initialPanX: vp.panX,
        initialPanY: vp.panY,
      };
    } else if (e.touches.length >= 2) {
      if (e.cancelable) e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
      touchStateRef.current = {
        type: 'pinch',
        startDist: Math.max(10, dist),
        startZoom: vp.zoom,
        startPanX: vp.panX,
        startPanY: vp.panY,
        worldX: (midX - vp.panX) / vp.zoom,
        worldY: (midY - vp.panY) / vp.zoom,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (isDrawingModeSignal.value && drawingToolSignal.value !== 'select') {
      touchStateRef.current = null;
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

    if (!touchStateRef.current) {
      // If two fingers are detected without prior touchState, initiate pinch immediately
      if (e.touches.length >= 2) {
        const vp = viewportRef.current;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        touchStateRef.current = {
          type: 'pinch',
          startDist: Math.max(10, dist),
          startZoom: vp.zoom,
          startPanX: vp.panX,
          startPanY: vp.panY,
          worldX: (midX - vp.panX) / vp.zoom,
          worldY: (midY - vp.panY) / vp.zoom,
        };
      } else {
        return;
      }
    }

    // Two-finger pinch-to-zoom (In Hand Mode & canvas)
    if (e.touches.length >= 2) {
      if (e.cancelable) e.preventDefault();
      const vp = viewportRef.current;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      // If we were previously panning with 1 finger and now have 2 fingers, transition to pinch
      if (touchStateRef.current.type !== 'pinch') {
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        touchStateRef.current = {
          type: 'pinch',
          startDist: Math.max(10, dist),
          startZoom: vp.zoom,
          startPanX: vp.panX,
          startPanY: vp.panY,
          worldX: (midX - vp.panX) / vp.zoom,
          worldY: (midY - vp.panY) / vp.zoom,
        };
        return;
      }

      const st = touchStateRef.current;
      if (st.startDist > 0) {
        const scale = dist / st.startDist;
        const newZoom = Math.min(2.5, Math.max(0.3, st.startZoom * scale));
        const curMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const curMidY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const newPanX = curMidX - st.worldX * newZoom;
        const newPanY = curMidY - st.worldY * newZoom;
        updateViewport(newPanX, newPanY, newZoom);
      }
    } else if (e.touches.length === 1 && touchStateRef.current.type === 'pan') {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStateRef.current.startX;
      const deltaY = touch.clientY - touchStateRef.current.startY;
      updateViewport(
        touchStateRef.current.initialPanX + deltaX,
        touchStateRef.current.initialPanY + deltaY,
        viewportRef.current.zoom
      );
    }
  };

  const handleTouchEnd = (e) => {
    if (isDrawingModeSignal.value && drawingToolSignal.value !== 'select') {
      touchStateRef.current = null;
      setIsPanning(false);
      return;
    }

    if (!e.touches || e.touches.length === 0) {
      touchStateRef.current = null;
      setIsPanning(false);
    } else if (e.touches.length === 1) {
      // Seamlessly transition from pinch back to 1-finger pan from current finger position
      const vp = viewportRef.current;
      const touch = e.touches[0];
      touchStateRef.current = {
        type: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        initialPanX: vp.panX,
        initialPanY: vp.panY,
      };
    }
  };

  // Bind native non-passive touch listeners on canvas container for smooth gesture handling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeTouchStart = (e) => handleTouchStart(e);
    const onNativeTouchMove = (e) => handleTouchMove(e);
    const onNativeTouchEnd = (e) => handleTouchEnd(e);
    const onWindowTouchReset = (e) => {
      if (!e.touches || e.touches.length === 0) {
        touchStateRef.current = null;
        if (!activePanCleanupRef.current) {
          setIsPanning(false);
        }
      }
    };

    el.addEventListener('touchstart', onNativeTouchStart, { passive: false });
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    el.addEventListener('touchend', onNativeTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onNativeTouchEnd, { passive: false });
    window.addEventListener('touchend', onWindowTouchReset, { passive: true });
    window.addEventListener('touchcancel', onWindowTouchReset, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onNativeTouchStart);
      el.removeEventListener('touchmove', onNativeTouchMove);
      el.removeEventListener('touchend', onNativeTouchEnd);
      el.removeEventListener('touchcancel', onNativeTouchEnd);
      window.removeEventListener('touchend', onWindowTouchReset);
      window.removeEventListener('touchcancel', onWindowTouchReset);
    };
  }, []);

  // Track cursor when connecting two cards and broadcast cursor position to peers
  const handleMouseMoveCanvas = (e) => {
    // Fail-safe: if pan state is still active when no mouse/trackpad button is held, release immediately
    if ((isPanning || activePanCleanupRef.current) && typeof e.buttons === 'number' && e.buttons === 0) {
      if (activePanCleanupRef.current) {
        activePanCleanupRef.current();
      } else {
        setIsPanning(false);
      }
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cursorCanvasX = (e.clientX - rect.left - viewport.panX) / viewport.zoom;
      const cursorCanvasY = (e.clientY - rect.top - viewport.zoom);
      const actualCursorCanvasY = (e.clientY - rect.top - viewport.panY) / viewport.zoom;
      broadcastCursorMove(Math.round(cursorCanvasX), Math.round(actualCursorCanvasY));
    }

    if (connectingSourceSignal.value && containerRef.current) {
      const sourceCard = cards.find((c) => c.id === connectingSourceSignal.value);
      if (sourceCard) {
        const rect = containerRef.current.getBoundingClientRect();
        const cursorCanvasX = (e.clientX - rect.left - viewport.panX) / viewport.zoom;
        const cursorCanvasY = (e.clientY - rect.top - viewport.panY) / viewport.zoom;

        const startAnchor = getCardEdgePoint(sourceCard, cursorCanvasX, cursorCanvasY);

        // Check if cursor is over or near another card
        const hoveredCard = cards.find(
          (c) =>
            c.id !== sourceCard.id &&
            cursorCanvasX >= c.x - 8 &&
            cursorCanvasX <= c.x + c.width + 8 &&
            cursorCanvasY >= c.y - 8 &&
            cursorCanvasY <= c.y + c.height + 8
        );

        let endX = cursorCanvasX;
        let endY = cursorCanvasY;

        if (hoveredCard) {
          const endAnchor = getCardEdgePoint(hoveredCard, startAnchor.x, startAnchor.y);
          endX = endAnchor.x;
          endY = endAnchor.y;
        }

        tempConnectionLineSignal.value = {
          x1: startAnchor.x,
          y1: startAnchor.y,
          x2: endX,
          y2: endY,
        };
      }
    }
  };

  const last_handled_drop_ref = useRef(null);

  // Global capture-phase listeners so dropGhost NEVER gets stuck when a child card
  // calls e.stopPropagation() on dragover/drop or when a drag is cancelled/leaves the window
  useEffect(() => {
    const clear_drop_ghost = () => {
      setDropGhost((prev) => (prev ? null : prev));
    };

    const handle_window_drag_over_capture = (e) => {
      const target = e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
      const types = Array.from(e.dataTransfer?.types || []);
      const has_files = types.includes('Files');
      const is_internal_item_drag =
        types.includes('application/lumen-currency-code') ||
        types.includes('application/lumen-layer-id') ||
        Boolean(target?.closest?.('[class*="lumen-currency"]'));
      if (
        is_internal_item_drag ||
        (has_files &&
          target?.closest?.(
            '[class*="lumen-docs"], [class*="lumen-file-card"], [class*="lumen-image-carousel"]'
          ))
      ) {
        clear_drop_ghost();
      }
    };

    const handle_window_drag_leave = (e) => {
      if (
        !e.relatedTarget &&
        (e.clientX <= 0 ||
          e.clientY <= 0 ||
          e.clientX >= window.innerWidth ||
          e.clientY >= window.innerHeight)
      ) {
        clear_drop_ghost();
      }
    };

    window.addEventListener('drop', clear_drop_ghost, true);
    window.addEventListener('drop', clear_drop_ghost, false);
    window.addEventListener('dragend', clear_drop_ghost, true);
    window.addEventListener('dragover', handle_window_drag_over_capture, true);
    window.addEventListener('dragleave', handle_window_drag_leave, true);

    return () => {
      window.removeEventListener('drop', clear_drop_ghost, true);
      window.removeEventListener('drop', clear_drop_ghost, false);
      window.removeEventListener('dragend', clear_drop_ghost, true);
      window.removeEventListener('dragover', handle_window_drag_over_capture, true);
      window.removeEventListener('dragleave', handle_window_drag_leave, true);
    };
  }, []);

  // Drag and Drop from Left Dock or OS Files
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
    const types = Array.from(e.dataTransfer?.types || []);
    const has_files = types.includes('Files');
    const is_internal_item_drag =
      types.includes('application/lumen-currency-code') ||
      types.includes('application/lumen-layer-id') ||
      Boolean(target?.closest?.('[class*="lumen-currency"]'));
    if (
      is_internal_item_drag ||
      (has_files &&
        target?.closest?.(
          '[class*="lumen-docs"], [class*="lumen-file-card"], [class*="lumen-image-carousel"]'
        ))
    ) {
      setDropGhost((prev) => (prev ? null : prev));
      return;
    }

    e.dataTransfer.dropEffect = 'copy';

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let rawX = (mouseX - viewport.panX) / viewport.zoom;
      let rawY = (mouseY - viewport.panY) / viewport.zoom;

      if (snap) {
        rawX = snapToGrid(rawX);
        rawY = snapToGrid(rawY);
      }

      setDropGhost({
        x: rawX,
        y: rawY,
        width: 320,
        height: 200,
      });
    }
  };

  const handleDragLeave = (e) => {
    if (!e.relatedTarget || !(e.relatedTarget instanceof Node) || !containerRef.current?.contains(e.relatedTarget)) {
      setDropGhost(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropGhost(null);

    const native_evt = e.nativeEvent || e;
    if (last_handled_drop_ref.current === native_evt) {
      return;
    }
    last_handled_drop_ref.current = native_evt;

    const is_drawing_mode = Boolean(isDrawingModeSignal.value);

    // Support dropping image files directly from operating system onto canvas
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && containerRef.current) {
      const allDroppedFiles = Array.from(files);
      const oversizedFiles = allDroppedFiles.filter((f) => f.size > MAX_BOARD_FILE_SIZE_BYTES);
      if (oversizedFiles.length > 0) {
        const firstOver = oversizedFiles[0];
        const sizeMbStr = (firstOver.size / (1024 * 1024)).toFixed(1);
        showToast(
          `File "${firstOver.name}" (${sizeMbStr} MB) exceeds the ${MAX_BOARD_FILE_SIZE_MB} MB upload limit`
        );
      }
      const validFiles = allDroppedFiles.filter((f) => f.size <= MAX_BOARD_FILE_SIZE_BYTES);
      if (validFiles.length === 0) {
        return;
      }

      const isImageFile = (f) =>
        (f.type && f.type.startsWith('image/')) ||
        /\.(png|jpe?g|webp|svg|gif|bmp|ico|avif)$/i.test(f.name);
      const imageFiles = validFiles.filter(isImageFile);
      if (imageFiles.length > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let x = (mouseX - viewport.panX) / viewport.zoom;
        let y = (mouseY - viewport.panY) / viewport.zoom;

        if (snap) {
          x = snapToGrid(x);
          y = snapToGrid(y);
        } else {
          x = Math.round(x);
          y = Math.round(y);
        }

        const readPromises = imageFiles.map((file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              resolve({
                name: file.name,
                dataUrl: loadEvt.target.result,
              });
            };
            reader.readAsDataURL(file);
          });
        });

        // When in drawing mode, drag drop image puts it on image layer instead of image card
        if (is_drawing_mode) {
          Promise.all(readPromises).then((loadedImages) => {
            loadedImages.forEach((imgData, idx) => {
              const imgEl = new window.Image();
              imgEl.onload = () => {
                const naturalWidth = imgEl.naturalWidth || 400;
                const naturalHeight = imgEl.naturalHeight || 300;
                const maxDim = 480;
                let w = naturalWidth;
                let h = naturalHeight;
                if (w > maxDim || h > maxDim) {
                  const scale = Math.min(maxDim / w, maxDim / h);
                  w = Math.round(w * scale);
                  h = Math.round(h * scale);
                }

                addDrawingImage({
                  src: imgData.dataUrl,
                  name: imgData.name.replace(/\.[^/.]+$/, ''),
                  x: Math.round(x - w / 2 + idx * 24),
                  y: Math.round(y - h / 2 + idx * 24),
                  width: Math.max(40, w),
                  height: Math.max(40, h),
                  naturalWidth,
                  naturalHeight,
                  rotation: 0,
                  opacity: 1,
                  visible: true,
                  locked: false,
                  aspectRatioLocked: true,
                });
              };
              imgEl.onerror = () => {
                addDrawingImage({
                  src: imgData.dataUrl,
                  name: imgData.name.replace(/\.[^/.]+$/, ''),
                  x: Math.round(x - 160 + idx * 24),
                  y: Math.round(y - 120 + idx * 24),
                  width: 320,
                  height: 240,
                  naturalWidth: 320,
                  naturalHeight: 240,
                  rotation: 0,
                  opacity: 1,
                  visible: true,
                  locked: false,
                  aspectRatioLocked: true,
                });
              };
              imgEl.src = imgData.dataUrl;
            });

            showToast(
              imageFiles.length > 1
                ? `Added ${imageFiles.length} images to drawing layers`
                : `Added "${imageFiles[0].name.replace(/\.[^/.]+$/, '')}" to drawing layer`
            );
          });
          return;
        }

        // Standard image card creation when not in drawing select mode
        Promise.all(readPromises).then((loadedImages) => {
          const current_board_setting = activeBoardSignal.value?.board_setting || {};
          const drag_drop_images_action = current_board_setting.drag_drop_images_action || 'carousel';
          const is_each_card_mode =
            drag_drop_images_action === 'each_card' ||
            drag_drop_images_action === 'separate_cards';

          if (is_each_card_mode && loadedImages.length > 1) {
            const dimPromises = loadedImages.map(
              (img) =>
                new Promise((resolve) => {
                  const probe = new window.Image();
                  probe.onload = () => {
                    const ratio = probe.naturalHeight / (probe.naturalWidth || 1);
                    const w = 384;
                    const h = Math.max(220, Math.min(620, Math.round(w * ratio) + 64));
                    resolve({ img, width: w, height: h });
                  };
                  probe.onerror = () => {
                    resolve({ img, width: 384, height: 360 });
                  };
                  probe.src = img.dataUrl;
                })
            );

            Promise.all(dimPromises).then((measuredItems) => {
              const total = measuredItems.length;
              const cols = total <= 3 ? total : Math.min(4, Math.ceil(Math.sqrt(total)));
              const gap = 24;
              const createdCardIds = [];

              // Compute row heights so cards never overlap vertically
              const rowHeights = [];
              for (let i = 0; i < total; i++) {
                const r = Math.floor(i / cols);
                rowHeights[r] = Math.max(rowHeights[r] || 0, measuredItems[i].height);
              }

              const rowOffsetsY = [0];
              for (let r = 1; r < rowHeights.length; r++) {
                rowOffsetsY[r] = rowOffsetsY[r - 1] + rowHeights[r - 1] + gap;
              }

              measuredItems.forEach((item, idx) => {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                let cardX = x + col * (384 + gap);
                let cardY = y + (rowOffsetsY[row] || 0);

                if (snap) {
                  cardX = snapToGrid(cardX);
                  cardY = snapToGrid(cardY);
                } else {
                  cardX = Math.round(cardX);
                  cardY = Math.round(cardY);
                }

                const singleSlide = [
                  {
                    id: `slide_${Date.now()}_${idx}`,
                    url: item.img.dataUrl,
                    caption: item.img.name,
                  },
                ];

                const newCard = addCard({
                  type: 'image',
                  x: cardX,
                  y: cardY,
                  width: item.width,
                  height: item.height,
                  title: item.img.name.replace(/\.[^/.]+$/, ''),
                  imageUrl: singleSlide[0].url,
                  images: singleSlide,
                  active_slide_index: 0,
                  caption: singleSlide[0].caption,
                  color: 'white',
                });
                if (newCard?.id) {
                  createdCardIds.push(newCard.id);
                }
              });

              if (createdCardIds.length > 0) {
                selectedCardsSignal.value = createdCardIds;
              }
              showToast(`Created ${total} separate image cards (Bird View)`);
            });
            return;
          }

          const slides = loadedImages.map((img, idx) => ({
            id: `slide_${Date.now()}_${idx}`,
            url: img.dataUrl,
            caption: img.name,
          }));

          const firstImg = new window.Image();
          firstImg.onload = () => {
            const ratio = firstImg.naturalHeight / (firstImg.naturalWidth || 1);
            const w = 384;
            const h = Math.max(220, Math.min(620, Math.round(w * ratio) + 64));
            addCard({
              type: 'image',
              x,
              y,
              width: w,
              height: h,
              title: imageFiles.length > 1 ? `${imageFiles.length} Image Slides` : imageFiles[0].name.replace(/\.[^/.]+$/, ''),
              imageUrl: slides[0].url,
              images: slides,
              active_slide_index: 0,
              caption: slides[0].caption,
              color: 'white',
            });
            showToast(imageFiles.length > 1 ? `Image carousel created with ${imageFiles.length} slides` : 'Image card created from dropped file');
          };
          firstImg.onerror = () => {
            addCard({
              type: 'image',
              x,
              y,
              width: 384,
              height: 360,
              title: imageFiles.length > 1 ? `${imageFiles.length} Image Slides` : imageFiles[0].name.replace(/\.[^/.]+$/, ''),
              imageUrl: slides[0].url,
              images: slides,
              active_slide_index: 0,
              caption: slides[0].caption,
              color: 'white',
            });
            showToast(imageFiles.length > 1 ? `Image carousel created with ${imageFiles.length} slides` : 'Image card created from dropped file');
          };
          firstImg.src = slides[0].url;
        });
        return;
      }

      const nonImageFiles = validFiles.filter((f) => !isImageFile(f));
      if (nonImageFiles.length > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let x = (mouseX - viewport.panX) / viewport.zoom;
        let y = (mouseY - viewport.panY) / viewport.zoom;

        if (snap) {
          x = snapToGrid(x);
          y = snapToGrid(y);
        } else {
          x = Math.round(x);
          y = Math.round(y);
        }

        nonImageFiles.forEach(async (file, index) => {
          const offsetX = index * 24;
          const offsetY = index * 24;
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          const is_dropped_3d = ['glb', 'gltf', 'obj', 'stl', '3ds', 'fbx', 'step', 'dae'].includes(ext);
          const mime_type = file.type || (is_dropped_3d ? 'model/gltf-binary' : 'application/octet-stream');

          try {
            showToast(`Uploading ${file.name}...`);
            let res_data;
            if (typeof on_upload_file === 'function') {
              res_data = await on_upload_file(file, { x: x + offsetX, y: y + offsetY });
            } else {
              res_data = await upload_lumen_file(file, {
                boardId: activeBoard.id || activeBoard.board_code,
                mimeType: mime_type,
              });
            }

            const resolved_file_code = res_data.file_storage_code || res_data.fileId;
            addCard({
              type: 'file',
              x: x + offsetX,
              y: y + offsetY,
              width: is_dropped_3d ? 396 : 340,
              height: is_dropped_3d ? 440 : 220,
              title: file.name,
              file_name: file.name,
              file_size: file.size,
              file_type: mime_type,
              file_id: resolved_file_code,
              file_storage_code: resolved_file_code,
              file_url: res_data.fileUrl,
              view_url: res_data.viewUrl,
              s3_key: res_data.s3Key,
              file_extension: ext,
              file_data: null,
              is_3d: is_dropped_3d,
              active_animation: is_dropped_3d ? 'walk' : undefined,
              content: `Uploaded from desktop (${file.name})`,
              color: 'blue',
            });
            showToast(is_dropped_3d ? `3D Character Player created for ${file.name}` : `File card created for ${file.name}`);
          } catch (err) {
            console.error('Canvas file drop upload error:', err);
            showToast(err.message || `Failed to upload ${file.name}`);
          }
        });
        return;
      }
    }

    // Support moving an existing card dropped onto the canvas
    const existingCardId = e.dataTransfer.getData('application/lumen-card-id');
    if (existingCardId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let x = (mouseX - viewport.panX) / viewport.zoom;
      let y = (mouseY - viewport.panY) / viewport.zoom;

      if (snap) {
        x = snapToGrid(x);
        y = snapToGrid(y);
      } else {
        x = Math.round(x);
        y = Math.round(y);
      }

      // Check if dropped directly inside an existing group card
      const targetGroup = cards.find(
        (g) =>
          g.id !== existingCardId &&
          g.type === 'group' &&
          x >= g.x - 20 &&
          x <= g.x + g.width + 20 &&
          y >= g.y &&
          y <= g.y + g.height + 30
      );

      if (targetGroup) {
        addCardToGroup(targetGroup.id, existingCardId);
        showToast('Moved card into group container');
      } else {
        const currentCard = cards.find((c) => c.id === existingCardId);
        if (currentCard && currentCard.group_id) {
          removeCardFromGroup(currentCard.group_id, existingCardId);
        }
        updateCard(existingCardId, { x, y, group_id: null }, true);
        showToast('Moved card to canvas position');
      }
      selectedCardsSignal.value = [existingCardId];
      return;
    }

    // Support web image URL drag-and-drop onto drawing image layer
    const uriList = e.dataTransfer.getData('text/uri-list');
    const textData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    const htmlData = e.dataTransfer.getData('text/html');

    let webImageUrl = '';
    if (uriList && (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?.*)?$/i.test(uriList) || uriList.startsWith('data:image/'))) {
      webImageUrl = uriList.trim();
    } else if (textData && (/^https?:\/\/.*\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?.*)?$/i.test(textData) || textData.startsWith('data:image/'))) {
      webImageUrl = textData.trim();
    } else if (htmlData && htmlData.includes('<img')) {
      const match = htmlData.match(/src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["']/i);
      if (match && match[1]) {
        webImageUrl = match[1];
      }
    }

    if (is_drawing_mode && webImageUrl && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let x = (mouseX - viewport.panX) / viewport.zoom;
      let y = (mouseY - viewport.panY) / viewport.zoom;

      if (snap) {
        x = snapToGrid(x);
        y = snapToGrid(y);
      } else {
        x = Math.round(x);
        y = Math.round(y);
      }

      const imgEl = new window.Image();
      imgEl.onload = () => {
        const naturalWidth = imgEl.naturalWidth || 384;
        const naturalHeight = imgEl.naturalHeight || 256;
        const maxDim = 480;
        let w = naturalWidth;
        let h = naturalHeight;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        addDrawingImage({
          src: webImageUrl,
          name: 'Web Image Layer',
          x: Math.round(x - w / 2),
          y: Math.round(y - h / 2),
          width: w,
          height: h,
          naturalWidth,
          naturalHeight,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          aspectRatioLocked: true,
        });
        showToast('Added web image to drawing layer');
      };
      imgEl.onerror = () => {
        addDrawingImage({
          src: webImageUrl,
          name: 'Web Image Layer',
          x: Math.round(x - 160),
          y: Math.round(y - 120),
          width: 320,
          height: 240,
        });
        showToast('Added web image to drawing layer');
      };
      imgEl.src = webImageUrl;
      return;
    }

    const rawData =
      e.dataTransfer.getData('application/lumen-module') ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text');

    if (!rawData || !containerRef.current) return;

    try {
      const config = JSON.parse(rawData);
      if (!config || !config.type) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let x = (mouseX - viewport.panX) / viewport.zoom;
      let y = (mouseY - viewport.panY) / viewport.zoom;

      if (snap) {
        x = snapToGrid(x);
        y = snapToGrid(y);
      } else {
        x = Math.round(x);
        y = Math.round(y);
      }

      // When in drawing mode, drop image module as drawing layer
      if (is_drawing_mode && (config.type === 'image' || config.imageUrl)) {
        const src = config.imageUrl || design_item_image;
        const imgEl = new window.Image();
        imgEl.onload = () => {
          const naturalWidth = imgEl.naturalWidth || 384;
          const naturalHeight = imgEl.naturalHeight || 256;
          const maxDim = 480;
          let w = naturalWidth;
          let h = naturalHeight;
          if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          addDrawingImage({
            src,
            name: config.title || 'Image Layer',
            x: Math.round(x - w / 2),
            y: Math.round(y - h / 2),
            width: w,
            height: h,
            naturalWidth,
            naturalHeight,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            aspectRatioLocked: true,
          });
          showToast(`Added "${config.title || 'Image'}" to drawing layer`);
        };
        imgEl.onerror = () => {
          addDrawingImage({
            src,
            name: config.title || 'Image Layer',
            x: Math.round(x - 160),
            y: Math.round(y - 120),
            width: 320,
            height: 240,
          });
          showToast(`Added "${config.title || 'Image'}" to drawing layer`);
        };
        imgEl.src = src;
        return;
      }

      // Check if dropped directly inside an existing group card
      const targetGroup = cards.find(
        (g) =>
          g.type === 'group' &&
          x >= g.x - 20 &&
          x <= g.x + g.width + 20 &&
          y >= g.y &&
          y <= g.y + g.height + 30
      );

      if (targetGroup) {
        addCard({
          ...config,
          group_id: targetGroup.id,
          width: targetGroup.column_width || 340,
        });
      } else {
        addCard({
          ...config,
          x,
          y,
        });
      }
    } catch (err) {
      console.error('Drop parse error:', err);
    }
  };

  const isHandMode =
    isSpacePressed ||
    tool === 'hand' ||
    isPanning ||
    (isDrawingModeSignal.value && drawingToolSignal.value === 'hand');

  // When entering Hand Mode, blur any focused input/iframe inside the canvas so embeds or editors never trap events
  useEffect(() => {
    if (
      isHandMode &&
      typeof document !== 'undefined' &&
      document.activeElement &&
      containerRef.current &&
      containerRef.current.contains(document.activeElement) &&
      typeof document.activeElement.blur === 'function'
    ) {
      document.activeElement.blur();
    }
  }, [isHandMode]);

  const isDrawingActive = Boolean(isDrawingModeSignal.value);

  useEffect(() => {
    if (isDrawingActive) {
      setMarquee(null);
      if (selectedCardsSignal.value.length > 0) {
        clearCardSelection();
      }
      if (typeof window !== 'undefined' && window.getSelection) {
        window.getSelection()?.removeAllRanges?.();
      }
    }
  }, [isDrawingActive]);

  return (
    <div
      ref={containerRef}
      id="lumen-canvas-main"
      data-lumen-canvas="true"
      className={`${styles.lumenCanvasContainer} ${
        isHandMode ? styles.lumenCanvasContainerHand : ''
      } ${isPanning ? styles.lumenCanvasContainerPanning : ''} ${
        isDrawingActive ? styles.lumenCanvasContainerDrawing : ''
      }`}
      onWheel={handleWheel}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveCanvas}
      onContextMenu={(e) => {
        if (isDrawingActive) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDragStart={(e) => {
        if (isHandMode || isDrawingActive) {
          e.preventDefault();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Background Spatial Grid Pattern Layer */}
      {gridDots && gridStyle !== 'none' && (
        <div
          className={`${
            gridStyle === 'lines'
              ? (styles.lumenGridLines || styles['lumen-grid-lines'])
              : gridStyle === 'crosses'
              ? (styles.lumenGridCrosses || styles['lumen-grid-crosses'])
              : (styles.lumenGridDots || styles['lumen-grid-dots'])
          } ${!snap ? (styles.lumenGridDotsFree || styles['lumen-grid-dots-free']) : ''}`}
          style={{
            backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
            backgroundSize: `${(snap ? gridDimension : 16) * viewport.zoom}px ${(snap ? gridDimension : 16) * viewport.zoom}px`,
            backgroundRepeat: 'repeat',
            WebkitMaskPosition: `${viewport.panX}px ${viewport.panY}px`,
            maskPosition: `${viewport.panX}px ${viewport.panY}px`,
            WebkitMaskSize: `${(snap ? gridDimension : 16) * viewport.zoom}px ${(snap ? gridDimension : 16) * viewport.zoom}px`,
            maskSize: `${(snap ? gridDimension : 16) * viewport.zoom}px ${(snap ? gridDimension : 16) * viewport.zoom}px`,
            WebkitMaskRepeat: gridStyle === 'crosses' ? 'repeat' : 'no-repeat',
            maskRepeat: gridStyle === 'crosses' ? 'repeat' : 'no-repeat',
            WebkitMaskImage: gridStyle === 'crosses' ? 'radial-gradient(circle at 0px 0px, black 4.5px, transparent 5px)' : 'none',
            maskImage: gridStyle === 'crosses' ? 'radial-gradient(circle at 0px 0px, black 4.5px, transparent 5px)' : 'none',
            '--lumen-grid-size': `${gridDimension}px`,
          }}
        />
      )}

      {/* Main Spatial Transform Viewport */}
      <div
        className={styles.lumenViewport}
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        {/* SVG Connection Lines between cards */}
        <ConnectionLines />

        {/* Freehand Drawing & Sketching Canvas Layer */}
        <LUMEN_drawing_layer />

        {/* Card Modules */}
        {cards.map((card) => (
          <Card key={card.id} card={card} />
        ))}

        {/* Remote Collaborators Real-Time Live Cursors */}
        <LUMEN_collaborator_cursors />

        {/* Drop Preview Ghost */}
        {dropGhost && (
          <div
            className={styles.lumenDropGhost}
            style={{
              left: `${dropGhost.x}px`,
              top: `${dropGhost.y}px`,
              width: `${dropGhost.width}px`,
              height: `${dropGhost.height}px`,
            }}
          />
        )}

        {/* Empty State Prompt */}
        {cards.length === 0 && (
          <LUMEN_empty_canvas_prompt viewport={viewport} containerRef={containerRef} />
        )}

        {/* Rubberband / Marquee Selection Box (Disabled in Drawing Mode) */}
        {!isDrawingActive && marquee && marquee.isSelecting && (
          <div
            className={styles.lumenSelectionMarquee}
            style={{
              left: `${Math.min(marquee.startX, marquee.currentX)}px`,
              top: `${Math.min(marquee.startY, marquee.currentY)}px`,
              width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
              height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
            }}
          >
            <div className={styles.lumenMarqueeCountBadge}>
              {selectedCardsSignal.value.length} card{selectedCardsSignal.value.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        )}
      </div>

      {/* Interactive Freehand Drawing Surface & Toolbar (Lazy-loaded on demand) */}
      {isDrawingModeSignal.value && (
        <>
          <LUMEN_drawing_surface
            containerRef={containerRef}
            viewport={viewport}
            isSpacePressed={isSpacePressed}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
          <LUMEN_drawing_toolbar />
        </>
      )}


      {/* Active Tag Filter Banner */}
      {activeTagFilter && (
        <div className={styles.lumenActiveTagFilterBanner}>
          <Tag size={12} color="var(--lumen-accent)" />
          <span>
            Filtered by tag: <strong>#{activeTagFilter}</strong> ({matchingCount} card{matchingCount !== 1 ? 's' : ''})
          </span>
          <button
            type="button"
            className={styles.lumenClearFilterBtn}
            onClick={clearTagFilter}
            title="Clear tag filter"
          >
            <X size={11} />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Active Time Range Filter Banner */}
      {isTimeFilterActive && (
        <div
          className={styles.lumenActiveTagFilterBanner}
          style={activeTagFilter ? { top: 52 } : undefined}
        >
          <Clock size={12} color="var(--lumen-accent)" />
          <span>
            Time Filter:{' '}
            <strong>
              {activeTimeFilter.mode === 'custom'
                ? `${activeTimeFilter.start || '—'} → ${activeTimeFilter.end || '—'}`
                : activeTimeFilter.mode === 'has_time'
                ? 'Has Time Range'
                : activeTimeFilter.mode === 'active_now'
                ? 'Active Now'
                : activeTimeFilter.mode === 'today'
                ? 'Today'
                : activeTimeFilter.mode === 'upcoming'
                ? 'Upcoming'
                : activeTimeFilter.mode === 'overdue'
                ? 'Overdue'
                : activeTimeFilter.mode === 'synced_gcal'
                ? 'Synced to Google Calendar'
                : activeTimeFilter.mode}
            </strong>{' '}
            ({timeMatchingCount} card{timeMatchingCount !== 1 ? 's' : ''})
          </span>
          <button
            type="button"
            className={styles.lumenClearFilterBtn}
            onClick={clearTimeRangeFilter}
            title="Clear time range filter"
          >
            <X size={11} />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Multi-Selection Floating Action Bar (Disabled in Drawing Mode) */}
      {!isDrawingActive && selectedCardsSignal.value.length > 1 && (
        <div
          className={styles.lumenMultiSelectBar}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          data-lumen-menu="true"
        >
          {/* Top Line: Selection Count Header & Deselect Action */}
          <div className={styles.lumenMultiSelectHeader}>
            <div className={styles.lumenMultiSelectCount}>
              <Boxes size={16} color="var(--lumen-accent, #2563eb)" />
              <span className={styles.lumenMultiSelectCountText}>
                {selectedCardsSignal.value.length} cards selected
              </span>
              <span className={styles.lumenMultiSelectHint}>
                Batch Actions & Layout
              </span>
            </div>

            <button
              type="button"
              className={styles.lumenMultiSelectCloseBtn}
              onClick={clearCardSelection}
              title="Deselect all cards (Esc)"
              aria-label="Deselect all cards"
            >
              <X size={14} />
              <span className={styles.lumenMultiSelectCloseLabel}>Deselect</span>
            </button>
          </div>

          {/* Bottom Line: Grouped Actions (Scrollable Area on Mobile) */}
          <div className={styles.lumenMultiSelectActionsRow}>
            {/* Create & AI Group */}
            <div className={styles.lumenMultiSelectGroup}>
              <button
                type="button"
                className={styles.lumenMultiSelectAiBtn}
                onClick={() => askAiAboutSelectedCards()}
                title="Ask Lumen AI to analyze, synthesize, or summarize all selected cards"
              >
                <Sparkles size={14} />
                <span>Ask AI</span>
              </button>

              <button
                type="button"
                className={styles.lumenMultiSelectGroupBtn}
                onClick={() => {
                  createGroupCard({ card_ids: selectedCardsSignal.value });
                }}
                title="Group selected cards into a frame"
              >
                <Boxes size={14} />
                <span>Group</span>
              </button>

              <button
                type="button"
                className={styles.lumenMultiSelectActionBtn}
                onClick={duplicateSelectedCards}
                title="Duplicate all selected cards (Ctrl+D)"
              >
                <Copy size={14} />
                <span>Duplicate</span>
              </button>
            </div>

            <div className={styles.lumenMultiSelectDivider} />

            {/* Alignment & Layout Group */}
            <div className={styles.lumenMultiSelectGroup}>
              <button
                type="button"
                className={styles.lumenMultiSelectActionBtn}
                onClick={() => alignSelectedCards('left')}
                title="Align cards to the left"
              >
                <AlignLeft size={14} />
                <span>Left</span>
              </button>

              <button
                type="button"
                className={styles.lumenMultiSelectActionBtn}
                onClick={() => alignSelectedCards('top')}
                title="Align cards to the top"
              >
                <AlignStartVertical size={14} />
                <span>Top</span>
              </button>

              <button
                type="button"
                className={styles.lumenMultiSelectActionBtn}
                onClick={() => alignSelectedCards('distribute_h')}
                title="Distribute cards evenly horizontally"
              >
                <AlignHorizontalSpaceAround size={14} />
                <span>Distribute</span>
              </button>
            </div>

            <div className={styles.lumenMultiSelectDivider} />

            {/* Lock & Delete Group */}
            <div className={styles.lumenMultiSelectGroup}>
              <button
                type="button"
                className={styles.lumenMultiSelectActionBtn}
                onClick={() => lockSelectedCards()}
                title="Lock or unlock position of selected cards"
              >
                <Lock size={14} />
                <span>Lock</span>
              </button>

              <button
                type="button"
                className={styles.lumenMultiSelectDeleteBtn}
                onClick={deleteSelectedCards}
                title={`Delete ${selectedCardsSignal.value.length} selected cards (Delete/Backspace)`}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
