import { signal } from '@preact/signals-react';
import { updateCard, showToast, createId, activeBoardSignal, saveCurrentBoardToStore } from './boardState.js';

import imgArch from '../assets/images/lumen_mood_arch_1791015833203.jpg';
import imgDesign from '../assets/images/lumen_mood_design_1791015845283.jpg';
import imgPalette from '../assets/images/lumen_mood_palette_1791015859220.jpg';
import imgReelArch from '../assets/images/social_reel_arch_1791019455630.jpg';

// Preset visual assets for quick insertion
export const CANVAS_PRESET_IMAGES = [
  { id: 'arch', title: 'Architectural Stone', url: imgArch, width: 340, height: 260 },
  { id: 'design', title: 'Design Concept', url: imgDesign, width: 340, height: 260 },
  { id: 'palette', title: 'Atmosphere & Palette', url: imgPalette, width: 340, height: 220 },
  { id: 'pavilion', title: 'Kyoto Pavilion Reel', url: imgReelArch, width: 280, height: 380 },
];

// Active fullscreen canvas card ID (null if closed)
export const activeCanvasCardIdSignal = signal(null);

// Drawing Tools: 'select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle'
export const canvasToolSignal = signal('pen');

// Current drawing attributes
export const canvasColorSignal = signal('#2563eb'); // Default Studio Blue
export const canvasWidthSignal = signal(4);
export const canvasOpacitySignal = signal(1);

// Selected image element on canvas
export const canvasSelectedImageIdSignal = signal(null);

// Fullscreen canvas view navigation
export const canvasZoomSignal = signal(1);
export const canvasPanSignal = signal({ x: 0, y: 0 });

// Undo / Redo history storage per session
export const canvasHistorySignal = signal({ past: [], future: [] });

/**
 * Open fullscreen drawing studio for a specific card
 */
export const openCanvasFullscreen = (cardOrId) => {
  const cardId = typeof cardOrId === 'object' ? cardOrId?.id : cardOrId;
  activeCanvasCardIdSignal.value = cardId;
  canvasSelectedImageIdSignal.value = null;
  canvasZoomSignal.value = 1;
  canvasPanSignal.value = { x: 0, y: 0 };
  canvasHistorySignal.value = { past: [], future: [] };
};

/**
 * Close fullscreen drawing studio
 */
export const closeCanvasFullscreen = () => {
  activeCanvasCardIdSignal.value = null;
  canvasSelectedImageIdSignal.value = null;
};

/**
 * Helper to get the most up-to-date card object from activeBoardSignal
 */
const resolveCard = (cardOrId) => {
  if (!cardOrId) return null;
  const cardId = typeof cardOrId === 'object' ? cardOrId.id : cardOrId;
  return (activeBoardSignal.value?.cards || []).find((c) => c.id === cardId) || (typeof cardOrId === 'object' ? cardOrId : null);
};

/**
 * Record a state snapshot for undo / redo
 */
const pushCanvasSnapshot = (card) => {
  const resolved = resolveCard(card);
  if (!resolved) return;
  const currentSnapshot = {
    strokes: [...(resolved.canvas_strokes || [])],
    images: [...(resolved.canvas_images || [])],
  };
  const history = canvasHistorySignal.value;
  canvasHistorySignal.value = {
    past: [...history.past.slice(-25), currentSnapshot],
    future: [],
  };
};

/**
 * Add a new drawing stroke to the canvas card
 */
export const addCanvasStroke = (cardOrId, stroke) => {
  const card = resolveCard(cardOrId);
  if (!card) return;
  pushCanvasSnapshot(card);

  const strokes = Array.isArray(card.canvas_strokes) ? [...card.canvas_strokes] : [];
  const nextStrokes = [...strokes, stroke];

  updateCard(card.id, {
    canvas_strokes: nextStrokes,
  });
  saveCurrentBoardToStore();
};

/**
 * Erase a stroke by ID from the canvas card
 */
export const eraseCanvasStroke = (cardOrId, strokeId) => {
  const card = resolveCard(cardOrId);
  if (!card || !card.canvas_strokes) return;
  pushCanvasSnapshot(card);

  const nextStrokes = card.canvas_strokes.filter((s) => s.id !== strokeId);
  updateCard(card.id, {
    canvas_strokes: nextStrokes,
  });
  saveCurrentBoardToStore();
};

/**
 * Insert an image onto the canvas card
 */
export const insertCanvasImage = (cardOrId, imageConfig) => {
  const card = resolveCard(cardOrId);
  if (!card) return;
  pushCanvasSnapshot(card);

  const images = Array.isArray(card.canvas_images) ? [...card.canvas_images] : [];
  const imageId = createId('canvas_img');

  const newImage = {
    id: imageId,
    url: imageConfig.url,
    title: imageConfig.title || 'Inserted Image',
    x: imageConfig.x !== undefined ? Math.round(Number(imageConfig.x)) : 100,
    y: imageConfig.y !== undefined ? Math.round(Number(imageConfig.y)) : 80,
    width: Math.max(60, Math.round(Number(imageConfig.width) || 320)),
    height: Math.max(50, Math.round(Number(imageConfig.height) || 240)),
    rotation: imageConfig.rotation || 0,
    opacity: imageConfig.opacity !== undefined ? Number(imageConfig.opacity) : 1,
    zIndex: images.length + 1,
  };

  const nextImages = [...images, newImage];
  canvasSelectedImageIdSignal.value = imageId;
  // Automatically switch to pointer/select tool so image is immediately movable
  canvasToolSignal.value = 'select';

  updateCard(card.id, {
    canvas_images: nextImages,
    imageUrl: nextImages[0]?.url || newImage.url,
  });
  saveCurrentBoardToStore();

  showToast('Image inserted onto canvas');
  return newImage;
};

/**
 * Update an existing image's position, size, or properties
 */
export const updateCanvasImage = (cardOrId, imageId, updates) => {
  const card = resolveCard(cardOrId);
  if (!card) return;

  const currentImages = Array.isArray(card.canvas_images) && card.canvas_images.length > 0
    ? card.canvas_images
    : (card.imageUrl ? [{
        id: 'c_img_fallback',
        url: card.imageUrl,
        title: card.title || 'Canvas Asset',
        x: 24,
        y: 28,
        width: 280,
        height: 210,
        zIndex: 1,
      }] : (Array.isArray(card.images) ? card.images.map((im, idx) => ({
        id: im.id || `c_img_${idx}`,
        url: im.url,
        title: im.caption || 'Canvas Asset',
        x: 24 + idx * 24,
        y: 28 + idx * 24,
        width: 260,
        height: 195,
        zIndex: idx + 1,
      })) : []));

  const nextImages = currentImages.map((img) => (img.id === imageId ? { ...img, ...updates } : img));

  updateCard(card.id, {
    canvas_images: nextImages,
    imageUrl: nextImages[0]?.url || card.imageUrl || '',
  });
};

/**
 * Delete an image from the canvas card
 */
export const deleteCanvasImage = (cardOrId, imageId) => {
  const card = resolveCard(cardOrId);
  if (!card || !card.canvas_images) return;
  pushCanvasSnapshot(card);

  const nextImages = card.canvas_images.filter((img) => img.id !== imageId);
  if (canvasSelectedImageIdSignal.value === imageId) {
    canvasSelectedImageIdSignal.value = null;
  }

  updateCard(card.id, {
    canvas_images: nextImages,
    imageUrl: nextImages[0]?.url || '',
  });
  saveCurrentBoardToStore();

  showToast('Image removed from canvas');
};

/**
 * Reorder image z-index (bring forward or send to back)
 */
export const reorderCanvasImage = (cardOrId, imageId, direction) => {
  const card = resolveCard(cardOrId);
  if (!card || !card.canvas_images) return;
  const images = [...card.canvas_images];
  const idx = images.findIndex((img) => img.id === imageId);
  if (idx === -1) return;

  pushCanvasSnapshot(card);

  const [target] = images.splice(idx, 1);
  if (direction === 'front') {
    images.push(target);
  } else if (direction === 'back') {
    images.unshift(target);
  }

  updateCard(card.id, {
    canvas_images: images,
  });
  saveCurrentBoardToStore();
};

/**
 * Clear all drawings and images on the canvas
 */
export const clearCanvasData = (cardOrId) => {
  const card = resolveCard(cardOrId);
  if (!card) return;
  pushCanvasSnapshot(card);

  canvasSelectedImageIdSignal.value = null;
  updateCard(card.id, {
    canvas_strokes: [],
    canvas_images: [],
    imageUrl: '',
  });
  saveCurrentBoardToStore();

  showToast('Canvas cleared');
};

/**
 * Undo last action
 */
export const undoCanvasAction = (cardOrId) => {
  const card = resolveCard(cardOrId);
  if (!card) return;
  const history = canvasHistorySignal.value;
  if (!history.past || history.past.length === 0) {
    showToast('Nothing to undo');
    return;
  }

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  const currentSnapshot = {
    strokes: [...(card.canvas_strokes || [])],
    images: [...(card.canvas_images || [])],
  };

  canvasHistorySignal.value = {
    past: newPast,
    future: [currentSnapshot, ...history.future],
  };

  updateCard(card.id, {
    canvas_strokes: previous.strokes,
    canvas_images: previous.images,
    imageUrl: previous.images?.[0]?.url || '',
  });
  saveCurrentBoardToStore();

  showToast('Undone');
};

/**
 * Redo last undone action
 */
export const redoCanvasAction = (cardOrId) => {
  const card = resolveCard(cardOrId);
  if (!card) return;
  const history = canvasHistorySignal.value;
  if (!history.future || history.future.length === 0) {
    showToast('Nothing to redo');
    return;
  }

  const next = history.future[0];
  const newFuture = history.future.slice(1);
  const currentSnapshot = {
    strokes: [...(card.canvas_strokes || [])],
    images: [...(card.canvas_images || [])],
  };

  canvasHistorySignal.value = {
    past: [...history.past, currentSnapshot],
    future: newFuture,
  };

  updateCard(card.id, {
    canvas_strokes: next.strokes,
    canvas_images: next.images,
    imageUrl: next.images?.[0]?.url || '',
  });
  saveCurrentBoardToStore();

  showToast('Redone');
};
