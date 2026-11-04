import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  PenTool,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  ArrowUpRight,
  Minus,
  MousePointer,
  ImagePlus,
  Image as ImageIcon,
  Trash2,
  RotateCcw,
  RotateCw,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  Layers,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Check,
} from 'lucide-react';

import styles from './LUMEN_canvas_card.module.css';
import {
  activeCanvasCardIdSignal,
  canvasToolSignal,
  canvasColorSignal,
  canvasWidthSignal,
  canvasOpacitySignal,
  canvasSelectedImageIdSignal,
  canvasZoomSignal,
  canvasPanSignal,
  canvasHistorySignal,
  CANVAS_PRESET_IMAGES,
  openCanvasFullscreen,
  closeCanvasFullscreen,
  addCanvasStroke,
  eraseCanvasStroke,
  insertCanvasImage,
  updateCanvasImage,
  deleteCanvasImage,
  reorderCanvasImage,
  clearCanvasData,
  undoCanvasAction,
  redoCanvasAction,
} from '../../signals/canvasCardState.js';
import { updateCard, showToast, saveCurrentBoardToStore } from '../../signals/boardState.js';

// Predefined drawing colors
const PALETTE_COLORS = [
  { hex: '#1e293b', name: 'Dark Slate' },
  { hex: '#ffffff', name: 'Pure White' },
  { hex: '#2563eb', name: 'Studio Blue' },
  { hex: '#0284c7', name: 'Sky Cyan' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ef4444', name: 'Crimson' },
  { hex: '#8b5cf6', name: 'Violet' },
];

const STROKE_WIDTHS = [2, 4, 8, 14, 22];

// Smooth points to SVG Path
function pointsToSvgPath(points) {
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
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    d += ` Q ${p1.x} ${p1.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export default function LUMEN_canvas_card({ card }) {
  useSignals();

  const [is_fullscreen, set_is_fullscreen] = useState(false);
  const isFullscreen = is_fullscreen || activeCanvasCardIdSignal.value === card.id;

  const handleOpenFullscreen = () => {
    set_is_fullscreen(true);
    openCanvasFullscreen(card.id);
  };

  const handleCloseFullscreen = () => {
    set_is_fullscreen(false);
    closeCanvasFullscreen();
  };

  const currentTool = canvasToolSignal.value;
  const currentColor = canvasColorSignal.value;
  const currentWidth = canvasWidthSignal.value;
  const selectedImageId = canvasSelectedImageIdSignal.value;
  const currentZoom = canvasZoomSignal.value;
  const currentPan = canvasPanSignal.value;
  const history = canvasHistorySignal.value;

  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [liveStroke, setLiveStroke] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [draggingImageId, setDraggingImageId] = useState(null);

  const workspaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const isDrawingRef = useRef(false);
  const activePointersRef = useRef(new Map());
  const activePointerIdRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const imageDragRef = useRef(null);
  const imageResizeRef = useRef(null);

  const strokes = Array.isArray(card.canvas_strokes) ? card.canvas_strokes : [];
  const rawImages = Array.isArray(card.canvas_images) && card.canvas_images.length > 0
    ? card.canvas_images
    : (card.imageUrl ? [{
        id: 'c_img_fallback',
        url: card.imageUrl,
        title: card.title || 'Canvas Asset',
        x: 24,
        y: 24,
        width: 280,
        height: 210,
        zIndex: 1,
      }] : (Array.isArray(card.images) && card.images.length > 0 ? card.images.map((im, idx) => ({
        id: im.id || `c_img_${idx}`,
        url: im.url,
        title: im.caption || 'Canvas Asset',
        x: 24 + idx * 24,
        y: 24 + idx * 24,
        width: 260,
        height: 195,
        zIndex: idx + 1,
      })) : []));
  const images = rawImages;
  const bgStyle = card.canvas_bg_style || 'dots';

  // Responsive size of inline preview wrapper
  const previewWrapRef = useRef(null);
  const [containerSize, setContainerSize] = useState({
    w: card.width || 520,
    h: Math.max((card.height || 380) - 48, 160),
  });

  useEffect(() => {
    if (!previewWrapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ w: Math.round(width), h: Math.round(height) });
        }
      }
    });
    observer.observe(previewWrapRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute bounding box of all canvas items (images and strokes)
  const computeContentBounds = () => {
    if (images.length === 0 && strokes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    images.forEach((img) => {
      const ix = Number(img.x) || 0;
      const iy = Number(img.y) || 0;
      const iw = Number(img.width) || 280;
      const ih = Number(img.height) || 210;
      minX = Math.min(minX, ix);
      minY = Math.min(minY, iy);
      maxX = Math.max(maxX, ix + iw);
      maxY = Math.max(maxY, iy + ih);
    });

    strokes.forEach((s) => {
      if (Array.isArray(s.points) && s.points.length > 0) {
        s.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      }
      if (s.startPoint) {
        minX = Math.min(minX, s.startPoint.x);
        minY = Math.min(minY, s.startPoint.y);
        maxX = Math.max(maxX, s.startPoint.x);
        maxY = Math.max(maxY, s.startPoint.y);
      }
      if (s.endPoint) {
        minX = Math.min(minX, s.endPoint.x);
        minY = Math.min(minY, s.endPoint.y);
        maxX = Math.max(maxX, s.endPoint.x);
        maxY = Math.max(maxY, s.endPoint.y);
      }
    });

    if (minX === Infinity || maxX === -Infinity) return null;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, 40),
      height: Math.max(maxY - minY, 40),
    };
  };

  const contentBounds = computeContentBounds();

  // Scale and center content to seamlessly fit within the board card preview
  const getPreviewTransform = () => {
    if (!contentBounds) {
      return { scale: 1, translateX: 0, translateY: 0 };
    }

    const pad = 16;
    const availW = Math.max(containerSize.w - pad * 2, 60);
    const availH = Math.max(containerSize.h - pad * 2, 60);

    const scaleX = availW / contentBounds.width;
    const scaleY = availH / contentBounds.height;
    const fitScale = Math.min(scaleX, scaleY);
    const scale = Math.min(fitScale, 1.2);

    const scaledW = contentBounds.width * scale;
    const scaledH = contentBounds.height * scale;
    const translateX = (containerSize.w - scaledW) / 2 - contentBounds.minX * scale;
    const translateY = (containerSize.h - scaledH) / 2 - contentBounds.minY * scale;

    return {
      scale: Number(scale.toFixed(4)),
      translateX: Math.round(translateX),
      translateY: Math.round(translateY),
    };
  };

  const previewTransform = getPreviewTransform();

  // Support opening fullscreen modal via custom event from card quickbar
  useEffect(() => {
    const handleEvent = () => {
      set_is_fullscreen(true);
      openCanvasFullscreen(card.id);
    };
    const eventName = `lumen-canvas-fullscreen-${card.id}`;
    window.addEventListener(eventName, handleEvent);
    return () => {
      window.removeEventListener(eventName, handleEvent);
    };
  }, [card.id]);

  // Global keyboard shortcuts in Fullscreen (Escape, Ctrl+Z, Ctrl+Y, Delete)
  useEffect(() => {
    if (!isFullscreen) return;

    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e) => {
      // Escape to close fullscreen
      if (e.key === 'Escape') {
        if (isInsertModalOpen) {
          setIsInsertModalOpen(false);
        } else {
          handleCloseFullscreen();
        }
        return;
      }

      // Delete/Backspace for selected image
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedImageId) {
        e.stopPropagation();
        e.preventDefault();
        deleteCanvasImage(card, selectedImageId);
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undoCanvasAction(card);
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        e.stopPropagation();
        redoCanvasAction(card);
        return;
      }

      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'v' || e.key === 'V') canvasToolSignal.value = 'select';
        if (e.key === 'p' || e.key === 'P') canvasToolSignal.value = 'pen';
        if (e.key === 'h' || e.key === 'H') canvasToolSignal.value = 'highlighter';
        if (e.key === 'e' || e.key === 'E') canvasToolSignal.value = 'eraser';
        if (e.key === 'r' || e.key === 'R') canvasToolSignal.value = 'rect';
        if (e.key === 'c' || e.key === 'C') canvasToolSignal.value = 'circle';
        if (e.key === 'l' || e.key === 'L') canvasToolSignal.value = 'line';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, isInsertModalOpen, selectedImageId, card]);

  // Handle clipboard paste (Ctrl+V image) in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              insertCanvasImage(card, {
                url: loadEvt.target.result,
                title: 'Pasted Image',
                x: 140 - currentPan.x / currentZoom,
                y: 120 - currentPan.y / currentZoom,
                width: 320,
                height: 240,
              });
            };
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isFullscreen, card, currentPan, currentZoom]);

  // Convert client viewport coordinates to workspace canvas coordinates
  const getCanvasCoords = useCallback(
    (clientX, clientY) => {
      if (!workspaceRef.current) return { x: 0, y: 0 };
      const rect = workspaceRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - currentPan.x) / currentZoom;
      const y = (clientY - rect.top - currentPan.y) / currentZoom;
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    },
    [currentPan, currentZoom]
  );

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || 320;
        let h = img.naturalHeight || 240;
        const maxDim = 460;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const placeX = isFullscreen
          ? Math.round(180 - currentPan.x / currentZoom)
          : 28;
        const placeY = isFullscreen
          ? Math.round(140 - currentPan.y / currentZoom)
          : 28;

        insertCanvasImage(card, {
          url: ev.target.result,
          title: file.name,
          x: placeX,
          y: placeY,
          width: w,
          height: h,
        });
        setIsInsertModalOpen(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // URL Image Insert Handler
  const handleUrlInsert = () => {
    if (!urlInput.trim()) return;
    insertCanvasImage(card, {
      url: urlInput.trim(),
      title: 'Web Asset',
      x: Math.round(180 - currentPan.x / currentZoom),
      y: Math.round(140 - currentPan.y / currentZoom),
      width: 320,
      height: 240,
    });
    setUrlInput('');
    setIsInsertModalOpen(false);
  };

  // Drag and drop image/GIF files onto canvas (both inline card and fullscreen studio)
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const is_image_or_gif =
        (file.type && file.type.startsWith('image/')) ||
        /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name || '');
      if (is_image_or_gif) {
        const coords = isFullscreen ? getCanvasCoords(e.clientX, e.clientY) : { x: 28, y: 28 };
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          const data_url = loadEvt.target?.result;
          if (!data_url) return;
          const img = new Image();
          img.onload = () => {
            let w = img.naturalWidth || 320;
            let h = img.naturalHeight || 240;
            const maxDim = 460;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            insertCanvasImage(card, {
              url: data_url,
              title: file.name,
              x: coords.x,
              y: coords.y,
              width: w,
              height: h,
            });
          };
          img.onerror = () => {
            insertCanvasImage(card, {
              url: data_url,
              title: file.name,
              x: coords.x,
              y: coords.y,
              width: 320,
              height: 240,
            });
          };
          img.src = data_url;
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Palm Area + Stylus Stroke Line Neighborhood Tracker for Canvas Card
  const canvasStylusTrackerRef = useRef({
    palmDetected: false,
    palmPointerIds: new Set(),
    palmX: null,
    palmY: null,
    palmFirstDownTime: 0,
    strokeLineDetected: false,
    trackedX: null,
    trackedY: null,
    trackedVx: 0,
    trackedVy: 0,
    lastStylusTime: 0,
    trackingRadius: 165,
    gapBridgeTimer: null,
  });

  const liveStrokeRef = useRef(null);
  liveStrokeRef.current = liveStroke;

  const getCanvasVvScale = () => {
    if (
      typeof window !== 'undefined' &&
      window.visualViewport &&
      typeof window.visualViewport.scale === 'number'
    ) {
      return Math.max(0.25, Math.min(5, window.visualViewport.scale));
    }
    return 1;
  };

  const getCanvasContactProfile = (e) => {
    const vv = getCanvasVvScale();
    const rawW = typeof e.width === 'number' && e.width > 0 ? e.width : 0;
    const rawH = typeof e.height === 'number' && e.height > 0 ? e.height : 0;
    const w = rawW * vv;
    const h = rawH * vv;
    const hasSize = rawW > 0 && rawH > 0 && !(rawW === 1 && rawH === 1);
    const maxDim = Math.max(w, h, rawW, rawH);
    const minDim = Math.max(0.5, Math.min(w || 1, h || 1));
    const aspect = hasSize ? Math.max(w, h) / minDim : 1;
    const area = Math.max(w * h, rawW * rawH);

    if (e.pointerType === 'pen' || e.pointerType === 'mouse') {
      return {
        w: hasSize ? w : 6,
        h: hasSize ? h : 6,
        area: hasSize ? area : 36,
        aspect: 1,
        hasSize,
        isLargePalm: false,
        isDiscCandidate: true,
      };
    }

    const isElongatedPalm = hasSize && maxDim > 13.5 && aspect > 1.40;
    const isBroadPalm = hasSize && (maxDim > 29.5 || area > 760);
    const isLargePalm = isElongatedPalm || isBroadPalm;
    const isDiscCandidate =
      !isLargePalm && (!hasSize || (maxDim <= 29.5 && aspect <= 1.38));

    return {
      w: hasSize ? w : 12,
      h: hasSize ? h : 12,
      area: hasSize ? area : 144,
      aspect,
      hasSize,
      isLargePalm,
      isDiscCandidate,
    };
  };

  const resetCanvasStylusTracker = () => {
    const tr = canvasStylusTrackerRef.current;
    if (tr.gapBridgeTimer) {
      clearTimeout(tr.gapBridgeTimer);
      tr.gapBridgeTimer = null;
    }
    tr.palmDetected = false;
    tr.palmPointerIds.clear();
    tr.palmX = null;
    tr.palmY = null;
    tr.palmFirstDownTime = 0;
    tr.strokeLineDetected = false;
    tr.trackedX = null;
    tr.trackedY = null;
    tr.trackedVx = 0;
    tr.trackedVy = 0;
    tr.lastStylusTime = 0;
  };

  const commitCanvasStrokeNow = () => {
    const tr = canvasStylusTrackerRef.current;
    if (tr.gapBridgeTimer) {
      clearTimeout(tr.gapBridgeTimer);
      tr.gapBridgeTimer = null;
    }
    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    if (liveStrokeRef.current) {
      addCanvasStroke(card, liveStrokeRef.current);
      setLiveStroke(null);
    }
  };

  const markCanvasPointerAsPalm = (pRec, lockPermanently = true) => {
    if (!pRec) return;
    if (pRec.settleTimer) {
      clearTimeout(pRec.settleTimer);
      pRec.settleTimer = null;
    }
    pRec.isPalm = true;
    if (lockPermanently) {
      pRec.isPalmLocked = true;
    }
    pRec.isStylus = false;
    const tr = canvasStylusTrackerRef.current;
    if (!tr.palmDetected) {
      tr.palmFirstDownTime = pRec.startTime || Date.now();
    }
    tr.palmDetected = true;
    tr.palmPointerIds.add(pRec.pointerId);

    if (activePointerIdRef.current === pRec.pointerId) {
      activePointerIdRef.current = null;
      isDrawingRef.current = false;
      setLiveStroke(null);
    }

    const pointers = activePointersRef.current;
    let sx = 0;
    let sy = 0;
    let cnt = 0;
    for (const pid of tr.palmPointerIds) {
      const pr = pointers.get(pid);
      if (pr) {
        sx += pr.lastX;
        sy += pr.lastY;
        cnt++;
      }
    }
    tr.palmX = cnt > 0 ? sx / cnt : pRec.lastX;
    tr.palmY = cnt > 0 ? sy / cnt : pRec.lastY;
  };

  const scheduleCanvasSettlingPalmCheck = (pointerId, delayMs = 60) => {
    const rec = activePointersRef.current.get(pointerId);
    if (!rec) return;
    if (rec.settleTimer) {
      clearTimeout(rec.settleTimer);
    }
    rec.settleTimer = setTimeout(() => {
      rec.settleTimer = null;
      const cur = activePointersRef.current.get(pointerId);
      if (!cur || cur.isPalmLocked || cur.pointerType === 'pen' || cur.pointerType === 'mouse') {
        return;
      }
      const now = Date.now();
      const vv = getCanvasVvScale();
      const maxDisp = (cur.maxDistFromStart || 0) * vv;
      const otherCount = activePointersRef.current.size - 1;
      if (otherCount >= 1 && maxDisp < 18 && now - cur.lastMoveTime >= 42) {
        markCanvasPointerAsPalm(cur, true);
      }
    }, delayMs);
  };

  const updateCanvasStylusTracker = (clientX, clientY, now, isStrokeLine = false) => {
    const tr = canvasStylusTrackerRef.current;
    if (tr.trackedX !== null && tr.trackedY !== null && tr.lastStylusTime > 0) {
      const dt = Math.max(1, Math.min(200, now - tr.lastStylusTime));
      const vx = (clientX - tr.trackedX) / dt;
      const vy = (clientY - tr.trackedY) / dt;
      tr.trackedVx = 0.55 * tr.trackedVx + 0.45 * vx;
      tr.trackedVy = 0.55 * tr.trackedVy + 0.45 * vy;
    }
    tr.trackedX = clientX;
    tr.trackedY = clientY;
    tr.lastStylusTime = now;
    if (isStrokeLine) {
      tr.strokeLineDetected = true;
    }
  };

  const getCanvasStylusZoneMetrics = (clientX, clientY, now) => {
    const tr = canvasStylusTrackerRef.current;
    const vv = getCanvasVvScale();
    const pointers = activePointersRef.current;

    let distToPalm =
      tr.palmX !== null && tr.palmY !== null
        ? Math.hypot(clientX - tr.palmX, clientY - tr.palmY) * vv
        : Infinity;

    for (const pid of tr.palmPointerIds) {
      const pr = pointers.get(pid);
      if (pr && pr.pointerId !== activePointerIdRef.current) {
        const d = Math.hypot(clientX - pr.lastX, clientY - pr.lastY) * vv;
        if (d < distToPalm) {
          distToPalm = d;
        }
      }
    }

    if (tr.trackedX === null || tr.trackedY === null) {
      return { inZone: true, distToStylus: 0, distToPalm };
    }
    const dt = Math.max(0, Math.min(320, now - (tr.lastStylusTime || now)));
    const predX = tr.trackedX + tr.trackedVx * dt;
    const predY = tr.trackedY + tr.trackedVy * dt;
    const distToStylus =
      Math.min(
        Math.hypot(clientX - tr.trackedX, clientY - tr.trackedY),
        Math.hypot(clientX - predX, clientY - predY)
      ) * vv;
    const effectiveRadius = dt < 300 ? tr.trackingRadius + 65 : tr.trackingRadius + 150;
    return { inZone: distToStylus <= effectiveRadius, distToStylus, distToPalm };
  };

  // Helper to begin a fresh drawing stroke on the active stylus pointer
  const startStylusCanvasStroke = (e, rec, shouldCommitPrevious = false) => {
    if (
      shouldCommitPrevious &&
      liveStrokeRef.current &&
      ((liveStrokeRef.current.points && liveStrokeRef.current.points.length >= 2) ||
        liveStrokeRef.current.endPoint)
    ) {
      commitCanvasStrokeNow();
    } else {
      setLiveStroke(null);
    }
    const now = Date.now();
    rec.isStylus = true;
    rec.isPalm = false;
    canvasStylusTrackerRef.current.palmPointerIds.delete(rec.pointerId);
    rec.lastSampleX = e.clientX;
    rec.lastSampleY = e.clientY;
    rec.lastSampleTime = now;
    rec.lastStepDist = 0;
    rec.lastDx = 0;
    rec.lastDy = 0;

    activePointerIdRef.current = rec.pointerId;
    isDrawingRef.current = true;
    if (e.pointerType === 'pen' || !canvasStylusTrackerRef.current.strokeLineDetected) {
      updateCanvasStylusTracker(e.clientX, e.clientY, now, false);
    }

    const zoomVal = Math.max(0.1, canvasZoomSignal.value || 1);
    const minWorldStep = 0.85 / zoomVal;
    const initialPts = [];
    const pending = rec.pendingScreenPoints || [];
    for (let i = 0; i < pending.length; i++) {
      const p = getCanvasCoords(pending[i].x, pending[i].y);
      if (
        initialPts.length === 0 ||
        Math.hypot(
          p.x - initialPts[initialPts.length - 1].x,
          p.y - initialPts[initialPts.length - 1].y
        ) >= minWorldStep
      ) {
        initialPts.push(p);
      }
    }
    const pt = getCanvasCoords(e.clientX, e.clientY);
    if (
      initialPts.length === 0 ||
      Math.hypot(
        pt.x - initialPts[initialPts.length - 1].x,
        pt.y - initialPts[initialPts.length - 1].y
      ) >= minWorldStep
    ) {
      initialPts.push(pt);
    }

    dragStartRef.current = initialPts[0] || pt;

    if (['pen', 'highlighter'].includes(currentTool)) {
      setLiveStroke({
        id: `stroke_${Date.now()}`,
        tool: currentTool,
        points: initialPts,
        color: currentColor,
        width: currentTool === 'highlighter' ? currentWidth * 2.5 : currentWidth,
        opacity: currentTool === 'highlighter' ? 0.4 : 1,
      });
    } else if (['line', 'arrow', 'rect', 'circle'].includes(currentTool)) {
      setLiveStroke({
        id: `stroke_${Date.now()}`,
        tool: currentTool,
        startPoint: initialPts[0] || pt,
        endPoint: pt,
        color: currentColor,
        width: currentWidth,
        opacity: 1,
      });
    } else if (currentTool === 'eraser') {
      setLiveStroke(null);
      eraseStrokeAt(pt);
    }
  };

  // Workspace Pointer Down (Drawing or Pan) with Universal Disc-Tip Stylus & Resting Palm Support
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Spacebar held down -> Pan mode
    if (e.spaceKey || currentTool === 'pan') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - currentPan.x, y: e.clientY - currentPan.y };
      return;
    }

    if (currentTool === 'select') {
      // If clicking empty area, deselect current image
      if (e.target === workspaceRef.current || e.target.tagName === 'svg') {
        canvasSelectedImageIdSignal.value = null;
      }
      return;
    }

    const now = Date.now();
    const pointers = activePointersRef.current;
    const tr = canvasStylusTrackerRef.current;
    for (const [pid, pRec] of pointers.entries()) {
      if (now - pRec.lastMoveTime > 10000 && pid !== activePointerIdRef.current) {
        if (pRec.settleTimer) {
          clearTimeout(pRec.settleTimer);
        }
        pointers.delete(pid);
        tr.palmPointerIds.delete(pid);
      }
    }

    const profile = getCanvasContactProfile(e);

    const newRec = {
      pointerId: e.pointerId,
      pointerType: e.pointerType || 'touch',
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastSampleX: e.clientX,
      lastSampleY: e.clientY,
      lastSampleTime: now,
      lastStepDist: 0,
      lastDx: 0,
      lastDy: 0,
      startTime: now,
      lastMoveTime: now,
      totalDist: 0,
      maxDistFromStart: 0,
      hasSize: profile.hasSize,
      contactArea: profile.area,
      minContactArea: profile.area,
      maxContactArea: profile.area,
      isDiscCandidate: profile.isDiscCandidate,
      isPalm: false,
      isPalmLocked: false,
      isStylus: false,
      pendingScreenPoints: [{ x: e.clientX, y: e.clientY, time: now }],
      settleTimer: null,
    };

    const otherPointers = Array.from(pointers.values()).filter(
      (p) => p.pointerId !== e.pointerId
    );
    pointers.set(e.pointerId, newRec);

    if (e.pointerType === 'pen') {
      otherPointers.forEach((p) => markCanvasPointerAsPalm(p, true));
      startStylusCanvasStroke(e, newRec, true);
      return;
    }

    if (e.pointerType === 'mouse') {
      startStylusCanvasStroke(e, newRec, true);
      return;
    }

    if (profile.isLargePalm) {
      markCanvasPointerAsPalm(newRec, true);
      return;
    }

    const { inZone, distToStylus, distToPalm } = getCanvasStylusZoneMetrics(e.clientX, e.clientY, now);

    if (otherPointers.length === 0) {
      startStylusCanvasStroke(e, newRec, false);
      scheduleCanvasSettlingPalmCheck(newRec.pointerId, 65);
      return;
    }

    // Multiple touches on the Canvas Card:
    const currentActive =
      activePointerIdRef.current !== null
        ? pointers.get(activePointerIdRef.current)
        : null;

    if (currentActive && !currentActive.isPalm && isDrawingRef.current) {
      const currentActiveHasDrawnLine =
        currentActive.maxDistFromStart >= 18 && (liveStrokeRef.current?.points?.length || 0) >= 3;

      if (currentActiveHasDrawnLine) {
        const stillMoving =
          now - currentActive.lastMoveTime < 55 && now - (currentActive.startTime || 0) > 20;
        if (stillMoving) {
          markCanvasPointerAsPalm(newRec, true);
          return;
        }
        commitCanvasStrokeNow();
        markCanvasPointerAsPalm(currentActive, true);
      } else {
        // Previous touch only moved < 18px before second touch landed -> it was the resting palm!
        markCanvasPointerAsPalm(currentActive, now - currentActive.startTime >= 50 || !currentActive.isDiscCandidate);
      }
    }

    for (const p of otherPointers) {
      if (p.pointerId !== activePointerIdRef.current && p.maxDistFromStart < 18) {
        markCanvasPointerAsPalm(p, now - p.startTime >= 50 || !p.isDiscCandidate);
      }
    }

    let minOtherArea = Infinity;
    for (const p of otherPointers) {
      if (p.hasSize && p.contactArea > 0 && p.contactArea < minOtherArea) {
        minOtherArea = p.contactArea;
      }
    }
    if (profile.hasSize && minOtherArea < Infinity && profile.area >= minOtherArea * 1.45) {
      markCanvasPointerAsPalm(newRec, true);
      return;
    }

    if (tr.strokeLineDetected && distToPalm < 60 && !inZone && distToStylus > 140) {
      markCanvasPointerAsPalm(newRec, true);
      return;
    }

    // Wait for >= 2.2px movement in handlePointerMove before starting stroke so multi-point palm contacts never draw dots
    scheduleCanvasSettlingPalmCheck(newRec.pointerId, 60);
  };

  // Pointer Move (Drawing points update or panning)
  const handlePointerMove = (e) => {
    if (isPanning) {
      canvasPanSignal.value = {
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      };
      return;
    }

    const pointers = activePointersRef.current;
    const rec = pointers.get(e.pointerId);
    const tr = canvasStylusTrackerRef.current;
    const now = Date.now();
    const vv = getCanvasVvScale();

    if (rec) {
      const stepDist = Math.hypot(e.clientX - rec.lastX, e.clientY - rec.lastY) * vv;
      rec.lastX = e.clientX;
      rec.lastY = e.clientY;
      rec.totalDist += stepDist;
      const distFromStart = Math.hypot(e.clientX - rec.startX, e.clientY - rec.startY) * vv;
      if (distFromStart > (rec.maxDistFromStart || 0)) {
        rec.maxDistFromStart = distFromStart;
      }
      if (stepDist >= 1.0) {
        rec.lastMoveTime = now;
      }

      if (!rec.isStylus && !rec.isPalmLocked && rec.pendingScreenPoints) {
        const lastP = rec.pendingScreenPoints[rec.pendingScreenPoints.length - 1];
        if (!lastP || Math.hypot(e.clientX - lastP.x, e.clientY - lastP.y) * vv >= 0.8) {
          if (rec.pendingScreenPoints.length < 48) {
            rec.pendingScreenPoints.push({ x: e.clientX, y: e.clientY, time: now });
          }
        }
      }

      const profile = getCanvasContactProfile(e);
      if (profile.hasSize) {
        rec.contactArea = profile.area;
        rec.minContactArea = Math.min(rec.minContactArea || profile.area, profile.area);
        rec.maxContactArea = Math.max(rec.maxContactArea || profile.area, profile.area);
      }
      rec.isDiscCandidate = profile.isDiscCandidate;

      if (rec.isPalmLocked) {
        markCanvasPointerAsPalm(rec, true);
        return;
      }

      const areaExpansion =
        profile.hasSize && rec.minContactArea > 0
          ? rec.maxContactArea / rec.minContactArea
          : 1;
      const isPalmSquash =
        e.pointerType === 'touch' &&
        (profile.isLargePalm || (profile.hasSize && areaExpansion >= 1.42 && profile.w > 16));

      if (rec.maxDistFromStart < 24 && isPalmSquash) {
        markCanvasPointerAsPalm(rec, true);
        return;
      }

      // If this pointer is a moving universal disc stylus while other palm pointers are resting, activate it
      if (
        rec.pointerId !== activePointerIdRef.current &&
        !rec.isPalmLocked &&
        rec.isDiscCandidate &&
        rec.maxDistFromStart >= 2.2 &&
        stepDist >= 0.6
      ) {
        const currentActive =
          activePointerIdRef.current !== null
            ? pointers.get(activePointerIdRef.current)
            : null;
        const { inZone, distToStylus, distToPalm } = getCanvasStylusZoneMetrics(e.clientX, e.clientY, now);

        const busyActive =
          currentActive &&
          !currentActive.isPalm &&
          currentActive.maxDistFromStart >= 18 &&
          now - currentActive.lastMoveTime < 55;

        if (!busyActive && (pointers.size === 1 || rec.maxDistFromStart >= 5.0 || distToPalm >= 45 || inZone || distToStylus < distToPalm)) {
          const shouldCommit = Boolean(
            currentActive && !currentActive.isPalm && currentActive.maxDistFromStart >= 18
          );
          for (const other of pointers.values()) {
            if (other.pointerId !== rec.pointerId && other.maxDistFromStart < 18) {
              markCanvasPointerAsPalm(other, true);
            }
          }
          startStylusCanvasStroke(e, rec, shouldCommit);
          updateCanvasStylusTracker(e.clientX, e.clientY, now, true);
        }
      }
    }

    if (!isDrawingRef.current || e.pointerId !== activePointerIdRef.current || rec?.isPalm || rec?.isPalmLocked) {
      return;
    }

    // Kinematics check to split lift-jumps between strokes (e.g. finishing '-' and moving to top of '|' in 'H')
    let splitIntoNewStroke = false;
    if (rec) {
      const dtSample = Math.max(1, now - (rec.lastSampleTime || now));
      const dxSample = (e.clientX - (rec.lastSampleX ?? e.clientX)) * vv;
      const dySample = (e.clientY - (rec.lastSampleY ?? e.clientY)) * vv;
      const jumpDist = Math.hypot(dxSample, dySample);

      if ((liveStrokeRef.current?.points?.length || 0) >= 2 && jumpDist >= 24) {
        const prevDist = rec.lastStepDist || 0;
        let cosAngle = 1;
        if (prevDist >= 1.5 && (rec.lastDx || rec.lastDy)) {
          const mag1 = Math.hypot(rec.lastDx, rec.lastDy);
          if (mag1 > 0 && jumpDist > 0) {
            cosAngle = (dxSample * rec.lastDx + dySample * rec.lastDy) / (jumpDist * mag1);
          }
        }
        const hoveredBetweenStrokes = dtSample >= 45 && jumpDist >= 24;
        const jumpedAfterStop = prevDist < 9 && jumpDist >= 40;
        const sharpTurnJump = jumpDist >= 46 && cosAngle < 0.1;

        if (hoveredBetweenStrokes || jumpedAfterStop || sharpTurnJump) {
          splitIntoNewStroke = true;
        }
      }

      rec.lastSampleX = e.clientX;
      rec.lastSampleY = e.clientY;
      rec.lastSampleTime = now;
      rec.lastStepDist = jumpDist;
      rec.lastDx = dxSample;
      rec.lastDy = dySample;
    }

    if (rec && rec.totalDist >= 4) {
      updateCanvasStylusTracker(e.clientX, e.clientY, now, true);
    }

    const pt = getCanvasCoords(e.clientX, e.clientY);
    const zoomVal = Math.max(0.1, canvasZoomSignal.value || 1);
    const minWorldStep = 0.85 / zoomVal;

    if (['pen', 'highlighter'].includes(currentTool)) {
      if (splitIntoNewStroke && liveStrokeRef.current) {
        addCanvasStroke(card, liveStrokeRef.current);
        setLiveStroke({
          id: `stroke_${Date.now()}`,
          tool: currentTool,
          points: [pt],
          color: currentColor,
          width: currentTool === 'highlighter' ? currentWidth * 2.5 : currentWidth,
          opacity: currentTool === 'highlighter' ? 0.4 : 1,
        });
        return;
      }

      setLiveStroke((prev) => {
        if (!prev) return null;
        const pts = prev.points;
        const last = pts[pts.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) >= minWorldStep) {
          if (pts.length >= 2 && rec && rec.totalDist >= 6) {
            tr.strokeLineDetected = true;
          }
          return {
            ...prev,
            points: [...pts, pt],
          };
        }
        return prev;
      });
    } else if (['line', 'arrow', 'rect', 'circle'].includes(currentTool)) {
      setLiveStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          endPoint: pt,
        };
      });
    } else if (currentTool === 'eraser') {
      eraseStrokeAt(pt);
    }
  };

  // Pointer Up (Commit stroke immediately when active stylus lifts; keep stylus area tracked while palm is down)
  const handlePointerUp = (e) => {
    const pointers = activePointersRef.current;
    const rec = e && e.pointerId !== undefined ? pointers.get(e.pointerId) : null;
    const tr = canvasStylusTrackerRef.current;

    if (rec && rec.settleTimer) {
      clearTimeout(rec.settleTimer);
      rec.settleTimer = null;
    }

    if (e && e.type === 'pointercancel' && rec && rec.pointerType === 'touch' && rec.maxDistFromStart < 35) {
      markCanvasPointerAsPalm(rec, true);
      pointers.delete(e.pointerId);
      tr.palmPointerIds.delete(e.pointerId);
      return;
    }

    if (e && e.pointerId !== undefined) {
      pointers.delete(e.pointerId);
      tr.palmPointerIds.delete(e.pointerId);
    }

    const remainingPalms = Array.from(pointers.values()).filter(
      (p) => p.isPalm || p.isPalmLocked || tr.palmPointerIds.has(p.pointerId)
    );
    const hasPalmStillDown = remainingPalms.length > 0 || pointers.size > 0;

    if (e && e.pointerId !== undefined && !isPanning && e.pointerId !== activePointerIdRef.current) {
      if (!hasPalmStillDown && !isDrawingRef.current) {
        commitCanvasStrokeNow();
        resetCanvasStylusTracker();
      } else if (!hasPalmStillDown) {
        tr.palmDetected = false;
        tr.palmX = null;
        tr.palmY = null;
      }
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawingRef.current) return;

    if (rec && rec.totalDist >= 2.5 && e && typeof e.clientX === 'number') {
      updateCanvasStylusTracker(e.clientX, e.clientY, Date.now(), true);
    }

    commitCanvasStrokeNow();
    if (!hasPalmStillDown) {
      resetCanvasStylusTracker();
    }
  };

  // Erase stroke nearest to point (zoom-normalized hit threshold)
  const eraseStrokeAt = (pt) => {
    const zoomVal = Math.max(0.1, canvasZoomSignal.value || 1);
    const threshold = 18 / zoomVal;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.points && s.points.length > 0) {
        for (const p of s.points) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) <= threshold) {
            eraseCanvasStroke(card, s.id);
            return;
          }
        }
      } else if (s.startPoint && s.endPoint) {
        const midX = (s.startPoint.x + s.endPoint.x) / 2;
        const midY = (s.startPoint.y + s.endPoint.y) / 2;
        if (Math.hypot(pt.x - midX, pt.y - midY) <= threshold * 1.5) {
          eraseCanvasStroke(card, s.id);
          return;
        }
      }
    }
  };

  // Image Dragging (Moves smoothly on any tool; automatically selects pointer tool)
  const handleImageMouseDown = (e, img) => {
    e.stopPropagation();
    e.preventDefault();
    canvasSelectedImageIdSignal.value = img.id;
    canvasToolSignal.value = 'select';
    setDraggingImageId(img.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = Number(img.x) || 0;
    const initialY = Number(img.y) || 0;
    const zoom = canvasZoomSignal.value || 1;

    const handleWindowMove = (moveEvt) => {
      moveEvt.preventDefault();
      const dx = (moveEvt.clientX - startX) / zoom;
      const dy = (moveEvt.clientY - startY) / zoom;

      updateCanvasImage(card.id, img.id, {
        x: Math.round(initialX + dx),
        y: Math.round(initialY + dy),
      });
    };

    const handleWindowUp = () => {
      setDraggingImageId(null);
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
      saveCurrentBoardToStore();
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
  };

  // Image Resizing (Supports SE, SW, NE, NW corner handles)
  const handleResizeMouseDown = (e, img, handle = 'se') => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = Number(img.width) || 280;
    const initialHeight = Number(img.height) || 210;
    const initialX = Number(img.x) || 0;
    const initialY = Number(img.y) || 0;
    const zoom = canvasZoomSignal.value || 1;

    const handleWindowMove = (moveEvt) => {
      moveEvt.preventDefault();
      const dx = (moveEvt.clientX - startX) / zoom;
      const dy = (moveEvt.clientY - startY) / zoom;

      if (handle === 'se') {
        const nextW = Math.max(60, Math.round(initialWidth + dx));
        const nextH = Math.max(50, Math.round(initialHeight + dy));
        updateCanvasImage(card.id, img.id, { width: nextW, height: nextH });
      } else if (handle === 'sw') {
        const nextW = Math.max(60, Math.round(initialWidth - dx));
        const nextH = Math.max(50, Math.round(initialHeight + dy));
        const nextX = Math.round(initialX + (initialWidth - nextW));
        updateCanvasImage(card.id, img.id, { width: nextW, height: nextH, x: nextX });
      } else if (handle === 'ne') {
        const nextW = Math.max(60, Math.round(initialWidth + dx));
        const nextH = Math.max(50, Math.round(initialHeight - dy));
        const nextY = Math.round(initialY + (initialHeight - nextH));
        updateCanvasImage(card.id, img.id, { width: nextW, height: nextH, y: nextY });
      } else if (handle === 'nw') {
        const nextW = Math.max(60, Math.round(initialWidth - dx));
        const nextH = Math.max(50, Math.round(initialHeight - dy));
        const nextX = Math.round(initialX + (initialWidth - nextW));
        const nextY = Math.round(initialY + (initialHeight - nextH));
        updateCanvasImage(card.id, img.id, { width: nextW, height: nextH, x: nextX, y: nextY });
      }
    };

    const handleWindowUp = () => {
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
      saveCurrentBoardToStore();
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
  };

  // Export Full Canvas to PNG file
  const handleExportPng = () => {
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 1920;
      exportCanvas.height = 1080;
      const ctx = exportCanvas.getContext('2d');

      // Draw background
      ctx.fillStyle = bgStyle === 'dark' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Render placed images
      let loadedImages = 0;
      const totalImages = images.length;

      const renderStrokes = () => {
        strokes.forEach((s) => {
          ctx.strokeStyle = s.color || '#1e293b';
          ctx.lineWidth = s.width || 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = s.opacity || 1;

          if (s.points && s.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(s.points[0].x, s.points[0].y);
            s.points.forEach((p) => ctx.lineTo(p.x, p.y));
            ctx.stroke();
          } else if (s.tool === 'line' && s.startPoint && s.endPoint) {
            ctx.beginPath();
            ctx.moveTo(s.startPoint.x, s.startPoint.y);
            ctx.lineTo(s.endPoint.x, s.endPoint.y);
            ctx.stroke();
          } else if (s.tool === 'rect' && s.startPoint && s.endPoint) {
            ctx.beginPath();
            const rx = Math.min(s.startPoint.x, s.endPoint.x);
            const ry = Math.min(s.startPoint.y, s.endPoint.y);
            const rw = Math.abs(s.endPoint.x - s.startPoint.x);
            const rh = Math.abs(s.endPoint.y - s.startPoint.y);
            ctx.strokeRect(rx, ry, rw, rh);
          } else if (s.tool === 'circle' && s.startPoint && s.endPoint) {
            const cx = (s.startPoint.x + s.endPoint.x) / 2;
            const cy = (s.startPoint.y + s.endPoint.y) / 2;
            const radius = Math.hypot(s.endPoint.x - s.startPoint.x, s.endPoint.y - s.startPoint.y) / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        });

        // Trigger download
        const url = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${card.title || 'Lumen_Canvas'}.png`;
        link.href = url;
        link.click();
        showToast('Canvas exported as PNG');
      };

      if (totalImages === 0) {
        renderStrokes();
      } else {
        images.forEach((imgObj) => {
          const imgElem = new Image();
          imgElem.crossOrigin = 'anonymous';
          imgElem.onload = () => {
            ctx.drawImage(imgElem, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
            loadedImages++;
            if (loadedImages === totalImages) {
              renderStrokes();
            }
          };
          imgElem.onerror = () => {
            loadedImages++;
            if (loadedImages === totalImages) {
              renderStrokes();
            }
          };
          imgElem.src = imgObj.url;
        });
      }
    } catch {
      showToast('Could not export canvas');
    }
  };

  // Copy Canvas Image to Clipboard
  const handleCopyClipboard = () => {
    handleExportPng();
    showToast('PNG generated and saved');
  };

  // Helper to render an individual stroke to SVG
  const renderStrokeElement = (s) => {
    if (s.points && s.points.length > 0) {
      const d = pointsToSvgPath(s.points);
      return (
        <path
          key={s.id}
          d={d}
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={s.opacity || 1}
          fill="none"
        />
      );
    }
    if (s.tool === 'line' && s.startPoint && s.endPoint) {
      return (
        <line
          key={s.id}
          x1={s.startPoint.x}
          y1={s.startPoint.y}
          x2={s.endPoint.x}
          y2={s.endPoint.y}
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeOpacity={s.opacity || 1}
        />
      );
    }
    if (s.tool === 'arrow' && s.startPoint && s.endPoint) {
      const angle = Math.atan2(s.endPoint.y - s.startPoint.y, s.endPoint.x - s.startPoint.x);
      const headLen = Math.max(12, s.width * 2.5);
      const x1 = s.endPoint.x - headLen * Math.cos(angle - Math.PI / 6);
      const y1 = s.endPoint.y - headLen * Math.sin(angle - Math.PI / 6);
      const x2 = s.endPoint.x - headLen * Math.cos(angle + Math.PI / 6);
      const y2 = s.endPoint.y - headLen * Math.sin(angle + Math.PI / 6);

      return (
        <g key={s.id}>
          <line
            x1={s.startPoint.x}
            y1={s.startPoint.y}
            x2={s.endPoint.x}
            y2={s.endPoint.y}
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
          />
          <path
            d={`M ${s.endPoint.x} ${s.endPoint.y} L ${x1} ${y1} M ${s.endPoint.x} ${s.endPoint.y} L ${x2} ${y2}`}
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    if (s.tool === 'rect' && s.startPoint && s.endPoint) {
      const rx = Math.min(s.startPoint.x, s.endPoint.x);
      const ry = Math.min(s.startPoint.y, s.endPoint.y);
      const rw = Math.abs(s.endPoint.x - s.startPoint.x);
      const rh = Math.abs(s.endPoint.y - s.startPoint.y);
      return (
        <rect
          key={s.id}
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          rx={6}
          stroke={s.color}
          strokeWidth={s.width}
          fill="none"
          strokeOpacity={s.opacity || 1}
        />
      );
    }
    if (s.tool === 'circle' && s.startPoint && s.endPoint) {
      const cx = (s.startPoint.x + s.endPoint.x) / 2;
      const cy = (s.startPoint.y + s.endPoint.y) / 2;
      const rx = Math.abs(s.endPoint.x - s.startPoint.x) / 2;
      const ry = Math.abs(s.endPoint.y - s.startPoint.y) / 2;
      return (
        <ellipse
          key={s.id}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={s.color}
          strokeWidth={s.width}
          fill="none"
          strokeOpacity={s.opacity || 1}
        />
      );
    }
    return null;
  };

  const bgStyleClass =
    bgStyle === 'dots'
      ? styles['lumen-canvas-bg-dots']
      : bgStyle === 'grid'
      ? styles['lumen-canvas-bg-grid']
      : bgStyle === 'dark'
      ? styles['lumen-canvas-bg-dark']
      : styles['lumen-canvas-bg-blank'];

  return (
    <div
      className={`${styles['lumen-canvas-card']} ${bgStyle === 'dark' ? styles['lumen-canvas-card-dark'] : ''}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleOpenFullscreen();
      }}
    >
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Card Inline Header Bar */}
      <div className={styles['lumen-canvas-card-topbar']}>
        <div className={styles['lumen-canvas-badge']}>
          <PenTool size={12} />
          <span>{strokes.length} strokes · {images.length} {images.length === 1 ? 'img' : 'imgs'}</span>
        </div>

        <div className={styles['lumen-canvas-card-actions']}>
          <button
            type="button"
            className={styles['lumen-canvas-card-btn']}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            title="Insert image from computer"
          >
            <ImagePlus size={12} />
            <span>Add Image</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-canvas-card-btn']} ${styles['lumen-canvas-card-btn-primary']}`}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenFullscreen();
            }}
            title="Open canvas fullscreen to draw & insert images"
          >
            <Maximize2 size={12} />
            <span>Fullscreen</span>
          </button>
        </div>
      </div>

      {/* Inline Card Workspace Preview */}
      <div
        ref={previewWrapRef}
        className={`${styles['lumen-canvas-surface-wrap']} ${bgStyleClass}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Scaled & Centered Canvas Content Container for Board Card */}
        <div
          className={styles['lumen-canvas-preview-content']}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            transform: `translate(${previewTransform.translateX}px, ${previewTransform.translateY}px) scale(${previewTransform.scale})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
          }}
        >
          {/* Render Placed Images */}
          <div className={styles['lumen-canvas-image-layer']}>
            {images.map((img) => (
              <div
                key={img.id}
                className={styles['lumen-canvas-placed-image']}
                style={{
                  position: 'absolute',
                  left: `${Number(img.x) || 0}px`,
                  top: `${Number(img.y) || 0}px`,
                  width: `${Number(img.width) || 280}px`,
                  height: `${Number(img.height) || 210}px`,
                  zIndex: img.zIndex || 1,
                  opacity: img.opacity !== undefined ? Number(img.opacity) : 1,
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={img.url}
                  alt={img.title || 'Canvas Asset'}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Render SVG Drawing Strokes (above placed images) */}
          <svg
            className={styles['lumen-canvas-preview-svg']}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            {strokes.map((s) => renderStrokeElement(s))}
          </svg>
        </div>

        {/* Empty State Banner if Nothing is Drawn */}
        {strokes.length === 0 && images.length === 0 && (
          <div className={styles['lumen-canvas-empty-state']}>
            <div className={styles['lumen-canvas-empty-title']}>Creative Canvas Ready</div>
            <div className={styles['lumen-canvas-empty-desc']}>
              Click Fullscreen or Add Image to draw freehand and insert inspiration assets.
            </div>
          </div>
        )}

        {/* Image Pill Indicator at bottom-left */}
        {images.length > 0 && (
          <div className={styles['lumen-canvas-card-image-chip']}>
            <ImageIcon size={11} />
            <span>{images.length} {images.length === 1 ? 'image' : 'images'} on canvas</span>
          </div>
        )}

        {/* Hover Quick Open Fullscreen Pill */}
        <div className={styles['lumen-canvas-card-hover-overlay']}>
          <button
            type="button"
            className={styles['lumen-canvas-card-hover-btn']}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenFullscreen();
            }}
          >
            <Maximize2 size={13} />
            <span>Open Fullscreen Studio</span>
          </button>
        </div>
      </div>

      {/* ==========================================================================
          FULLSCREEN DRAWING & IMAGE COLLAGE STUDIO MODAL
          ========================================================================== */}
      {isFullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles['lumen-canvas-modal-overlay']}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
          {/* Top Navigation Bar */}
          <header className={styles['lumen-canvas-modal-topbar']}>
            <div className={styles['lumen-canvas-modal-title-area']}>
              <div className={styles['lumen-canvas-modal-icon-badge']}>
                <PenTool size={16} />
              </div>
              <input
                type="text"
                className={styles['lumen-canvas-title-input']}
                value={card.title || 'Creative Canvas'}
                onChange={(e) => updateCard(card.id, { title: e.target.value })}
                title="Click to rename canvas"
              />
              <div className={styles['lumen-canvas-stat-pill']}>
                <span>✏️ {strokes.length} strokes</span>
                <span>•</span>
                <span>🖼️ {images.length} images</span>
              </div>
            </div>

            <div className={styles['lumen-canvas-modal-actions']}>
              {/* Undo / Redo */}
              <button
                type="button"
                className={styles['lumen-canvas-studio-btn']}
                onClick={() => undoCanvasAction(card)}
                disabled={!history.past || history.past.length === 0}
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                className={styles['lumen-canvas-studio-btn']}
                onClick={() => redoCanvasAction(card)}
                disabled={!history.future || history.future.length === 0}
                title="Redo (Ctrl+Shift+Z)"
              >
                <RotateCw size={14} />
              </button>

              <div className={styles['lumen-canvas-divider-vertical']} />

              {/* Clear Canvas */}
              <button
                type="button"
                className={`${styles['lumen-canvas-studio-btn']} ${styles['lumen-canvas-studio-btn-danger']}`}
                onClick={() => {
                  if (window.confirm('Clear all drawings and images on this canvas?')) {
                    clearCanvasData(card);
                  }
                }}
                title="Clear all drawings and images"
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>

              {/* Insert Image Button */}
              <button
                type="button"
                className={`${styles['lumen-canvas-studio-btn']} ${styles['lumen-canvas-studio-btn-primary']}`}
                onClick={() => setIsInsertModalOpen(!isInsertModalOpen)}
                title="Insert Image (Upload, Presets, or Link)"
              >
                <ImagePlus size={14} />
                <span>+ Insert Image</span>
              </button>

              {/* Export PNG */}
              <button
                type="button"
                className={styles['lumen-canvas-studio-btn']}
                onClick={handleExportPng}
                title="Export high-resolution PNG"
              >
                <Download size={14} />
                <span>Export PNG</span>
              </button>

              <div className={styles['lumen-canvas-divider-vertical']} />

              {/* Exit Fullscreen */}
              <button
                type="button"
                className={styles['lumen-canvas-studio-btn']}
                onClick={handleCloseFullscreen}
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 size={14} />
                <span>Exit Fullscreen</span>
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-studio-btn']} ${styles['lumen-canvas-studio-btn-danger']}`}
                onClick={handleCloseFullscreen}
                title="Close Studio (Esc)"
                style={{ padding: '6px 9px' }}
              >
                <X size={15} />
              </button>
            </div>
          </header>

          {/* Insert Image Flyout / Modal */}
          {isInsertModalOpen && (
            <div className={styles['lumen-canvas-insert-modal']}>
              <div className={styles['lumen-canvas-insert-header']}>
                <span className={styles['lumen-canvas-insert-title']}>Insert Image onto Canvas</span>
                <button
                  type="button"
                  className={styles['lumen-canvas-image-tb-btn']}
                  onClick={() => setIsInsertModalOpen(false)}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                className={styles['lumen-canvas-dropzone']}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={22} color="#3b82f6" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#f8fafc' }}>
                  Upload from Device
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  PNG, JPG, GIF, WEBP, or SVG
                </span>
              </div>

              {/* Preset Gallery */}
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
                  Or Choose Architectural Inspiration Preset:
                </span>
                <div className={styles['lumen-canvas-preset-grid']}>
                  {CANVAS_PRESET_IMAGES.map((preset) => (
                    <div
                      key={preset.id}
                      className={styles['lumen-canvas-preset-item']}
                      onClick={() => {
                        insertCanvasImage(card, {
                          url: preset.url,
                          title: preset.title,
                          x: 200 - currentPan.x / currentZoom,
                          y: 140 - currentPan.y / currentZoom,
                          width: preset.width,
                          height: preset.height,
                        });
                        setIsInsertModalOpen(false);
                      }}
                    >
                      <img src={preset.url} alt={preset.title} />
                      <div className={styles['lumen-canvas-preset-label']}>{preset.title}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* URL Input */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Paste image URL (https://...)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlInsert()}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: '#ffffff',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  className={styles['lumen-canvas-studio-btn']}
                  onClick={handleUrlInsert}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Floating Studio Toolbar (Top Center) */}
          <div className={styles['lumen-canvas-floating-toolbar']}>
            {/* Tool Selection Group */}
            <div className={styles['lumen-canvas-tool-group']}>
              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'select' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'select';
                }}
                title="Select & Transform Images (V)"
              >
                <MousePointer size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'pen' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'pen';
                }}
                title="Pen / Pencil (P)"
              >
                <Pencil size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'highlighter' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'highlighter';
                }}
                title="Highlighter / Marker (H)"
              >
                <Highlighter size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'line' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'line';
                }}
                title="Line Tool (L)"
              >
                <Minus size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'arrow' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'arrow';
                }}
                title="Arrow Tool"
              >
                <ArrowUpRight size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'rect' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'rect';
                }}
                title="Rectangle Tool (R)"
              >
                <Square size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'circle' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'circle';
                }}
                title="Circle / Ellipse (C)"
              >
                <Circle size={16} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-canvas-tool-btn']} ${currentTool === 'eraser' ? styles['lumen-canvas-tool-btn-active'] : ''}`}
                onClick={() => {
                  canvasToolSignal.value = 'eraser';
                }}
                title="Eraser (E)"
              >
                <Eraser size={16} />
              </button>
            </div>

            <div className={styles['lumen-canvas-divider-vertical']} />

            {/* Color Palette Swatches */}
            <div className={styles['lumen-canvas-color-swatches']}>
              {PALETTE_COLORS.map((col) => (
                <div
                  key={col.hex}
                  className={`${styles['lumen-canvas-color-dot']} ${currentColor === col.hex ? styles['lumen-canvas-color-dot-active'] : ''}`}
                  style={{ backgroundColor: col.hex }}
                  onClick={() => {
                    canvasColorSignal.value = col.hex;
                  }}
                  title={col.name}
                />
              ))}

              {/* Custom Color Input */}
              <div
                className={styles['lumen-canvas-custom-color-wrap']}
                style={{ backgroundColor: currentColor }}
                title="Choose custom color"
              >
                <input
                  type="color"
                  className={styles['lumen-canvas-custom-color-input']}
                  value={currentColor}
                  onChange={(e) => {
                    canvasColorSignal.value = e.target.value;
                  }}
                />
              </div>
            </div>

            <div className={styles['lumen-canvas-divider-vertical']} />

            {/* Stroke Width Selector */}
            <div className={styles['lumen-canvas-width-group']}>
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`${styles['lumen-canvas-width-btn']} ${currentWidth === w ? styles['lumen-canvas-width-btn-active'] : ''}`}
                  onClick={() => {
                    canvasWidthSignal.value = w;
                  }}
                  title={`${w}px stroke`}
                >
                  <div
                    className={styles['lumen-canvas-width-dot']}
                    style={{ width: Math.max(3, w / 1.5), height: Math.max(3, w / 1.5) }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Fullscreen Workspace Center */}
          <div
            ref={workspaceRef}
            className={`${styles['lumen-canvas-modal-workspace']} ${bgStyleClass}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              touchAction: 'none',
              cursor:
                currentTool === 'select'
                  ? 'default'
                  : currentTool === 'eraser'
                  ? 'cell'
                  : currentTool === 'pan' || isPanning
                  ? 'grab'
                  : 'crosshair',
            }}
          >
            {/* Viewport Transform Container (Pan & Zoom) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translate(${currentPan.x}px, ${currentPan.y}px) scale(${currentZoom})`,
                transformOrigin: '0 0',
                pointerEvents: 'none',
              }}
            >
              {/* Placed Images Layer (Transparent pass-through with interactive images, below strokes) */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                {images.map((img) => {
                  const isSelected = selectedImageId === img.id;
                  const isCurrentDragging = draggingImageId === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`${styles['lumen-canvas-placed-image']} ${
                        isSelected ? styles['lumen-canvas-placed-image-selected'] : ''
                      } ${isCurrentDragging ? styles['lumen-canvas-placed-image-active'] : ''}`}
                      style={{
                        position: 'absolute',
                        left: `${Number(img.x) || 0}px`,
                        top: `${Number(img.y) || 0}px`,
                        width: `${Number(img.width) || 280}px`,
                        height: `${Number(img.height) || 210}px`,
                        zIndex: img.zIndex || 1,
                        pointerEvents: 'auto',
                        cursor: isCurrentDragging ? 'grabbing' : 'grab',
                        touchAction: 'none',
                      }}
                      onPointerDown={(e) => handleImageMouseDown(e, img)}
                      onMouseDown={(e) => handleImageMouseDown(e, img)}
                    >
                      <img
                        src={img.url}
                        alt={img.title || 'Placed Asset'}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                          pointerEvents: 'none',
                          userSelect: 'none',
                          display: 'block',
                        }}
                      />

                      {/* Selected Image Actions & Handles */}
                      {isSelected && (
                        <>
                          {/* Floating mini-toolbar */}
                          <div className={styles['lumen-canvas-image-selected-toolbar']}>
                            <button
                              type="button"
                              className={styles['lumen-canvas-image-tb-btn']}
                              onClick={(e) => {
                                e.stopPropagation();
                                reorderCanvasImage(card, img.id, 'front');
                              }}
                              title="Bring to Front"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              className={styles['lumen-canvas-image-tb-btn']}
                              onClick={(e) => {
                                e.stopPropagation();
                                reorderCanvasImage(card, img.id, 'back');
                              }}
                              title="Send to Back"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              className={`${styles['lumen-canvas-image-tb-btn']} ${styles['lumen-canvas-image-tb-btn-danger']}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCanvasImage(card, img.id);
                              }}
                              title="Delete Image (Del)"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {/* 4 Corner Resize Handles */}
                          <div
                            className={`${styles['lumen-canvas-resize-handle']} ${styles['lumen-canvas-resize-se']}`}
                            onPointerDown={(e) => handleResizeMouseDown(e, img, 'se')}
                            onMouseDown={(e) => handleResizeMouseDown(e, img, 'se')}
                            title="Resize Bottom-Right"
                          />
                          <div
                            className={`${styles['lumen-canvas-resize-handle']} ${styles['lumen-canvas-resize-sw']}`}
                            onPointerDown={(e) => handleResizeMouseDown(e, img, 'sw')}
                            onMouseDown={(e) => handleResizeMouseDown(e, img, 'sw')}
                            title="Resize Bottom-Left"
                          />
                          <div
                            className={`${styles['lumen-canvas-resize-handle']} ${styles['lumen-canvas-resize-ne']}`}
                            onPointerDown={(e) => handleResizeMouseDown(e, img, 'ne')}
                            onMouseDown={(e) => handleResizeMouseDown(e, img, 'ne')}
                            title="Resize Top-Right"
                          />
                          <div
                            className={`${styles['lumen-canvas-resize-handle']} ${styles['lumen-canvas-resize-nw']}`}
                            onPointerDown={(e) => handleResizeMouseDown(e, img, 'nw')}
                            onMouseDown={(e) => handleResizeMouseDown(e, img, 'nw')}
                            title="Resize Top-Left"
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rendered Strokes SVG Layer (above all image layers) */}
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'visible',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                {strokes.map((s) => renderStrokeElement(s))}
                {liveStroke && renderStrokeElement(liveStroke)}
              </svg>
            </div>
          </div>

          {/* Fullscreen Studio Bottom Bar */}
          <footer className={styles['lumen-canvas-modal-bottombar']}>
            {/* Background Style & Tips on Left */}
            <div className={styles['lumen-canvas-bottom-left']}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Grid:</span>
              <button
                type="button"
                className={styles['lumen-canvas-width-btn']}
                style={{ fontSize: 11, padding: '2px 6px', width: 'auto' }}
                onClick={() => updateCard(card.id, { canvas_bg_style: 'dots' })}
                title="Dot Grid Pattern"
              >
                Dots
              </button>
              <button
                type="button"
                className={styles['lumen-canvas-width-btn']}
                style={{ fontSize: 11, padding: '2px 6px', width: 'auto' }}
                onClick={() => updateCard(card.id, { canvas_bg_style: 'grid' })}
                title="Square Grid Pattern"
              >
                Grid
              </button>
              <button
                type="button"
                className={styles['lumen-canvas-width-btn']}
                style={{ fontSize: 11, padding: '2px 6px', width: 'auto' }}
                onClick={() => updateCard(card.id, { canvas_bg_style: 'blank' })}
                title="Blank White Canvas"
              >
                Blank
              </button>
              <button
                type="button"
                className={styles['lumen-canvas-width-btn']}
                style={{ fontSize: 11, padding: '2px 6px', width: 'auto' }}
                onClick={() => updateCard(card.id, { canvas_bg_style: 'dark' })}
                title="Dark Blueprint Canvas"
              >
                Dark
              </button>
            </div>

            {/* Zoom Controls & Tips on Right */}
            <div className={styles['lumen-canvas-bottom-right']}>
              <span className={styles['lumen-canvas-tip-text']}>
                <kbd className={styles['lumen-canvas-tip-kbd']}>Space</kbd> + Drag to Pan
                <kbd className={styles['lumen-canvas-tip-kbd']}>Ctrl+V</kbd> Paste Image
                <kbd className={styles['lumen-canvas-tip-kbd']}>Esc</kbd> Exit
              </span>

              <div className={styles['lumen-canvas-divider-vertical']} />

              <button
                type="button"
                className={styles['lumen-canvas-image-tb-btn']}
                onClick={() => {
                  canvasZoomSignal.value = Math.max(0.4, Number((currentZoom - 0.15).toFixed(2)));
                }}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>

              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#cbd5e1',
                  minWidth: 38,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  canvasZoomSignal.value = 1;
                  canvasPanSignal.value = { x: 0, y: 0 };
                }}
                title="Click to reset zoom"
              >
                {Math.round(currentZoom * 100)}%
              </span>

              <button
                type="button"
                className={styles['lumen-canvas-image-tb-btn']}
                onClick={() => {
                  canvasZoomSignal.value = Math.min(3, Number((currentZoom + 0.15).toFixed(2)));
                }}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </footer>
        </div>,
        document.body
      )}
    </div>
  );
}
