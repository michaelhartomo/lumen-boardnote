import { signal, batch } from '@preact/signals-react';
import { persist } from 'signals-persist';
import {
  save_board_to_idb,
  load_board_from_idb,
  delete_board_from_idb,
  calculate_board_size_bytes,
  format_board_size,
} from '../lib/lumenIndexedDb.js';

import imgReelArch from '../assets/images/social_reel_arch_1791019455630.jpg';
import imgArch from '../assets/images/lumen_mood_arch_1791015833203.jpg';
import imgDesign from '../assets/images/lumen_mood_design_1791015845283.jpg';
import imgPalette from '../assets/images/lumen_mood_palette_1791015859220.jpg';
import { DEFAULT_DOC_TEMPLATE } from '../sub_components/Card/LUMEN_docs_card.jsx';
import {
  encrypt_card_data,
  decrypt_card_data,
  verify_card_passkey,
  extract_sensitive_card_payload,
} from '../utils/lumen_encryption.js';
import {
  verify_can_attempt_unlock,
  record_failed_unlock_attempt,
  record_successful_unlock,
} from '../utils/card_encryption_guard.js';
import {
  broadcastCardAdd,
  broadcastCardUpdate,
  broadcastCardDelete,
  broadcastCardMove,
  broadcastCardSelect,
  broadcastConnectionAdd,
  broadcastConnectionDelete,
  broadcastDrawingAdd,
  broadcastDrawingErase,
  broadcastBoardClear,
  broadcastBoardSync,
  connectRealtimeBoard,
  isRemoteUpdateFlag,
  get_lumen_auth_payload,
  get_lumen_auth_headers,
} from './realtimeState.js';
import { v4 as uuidv4, v7 as uuidv7, validate as uuidValidate } from 'uuid';

export { get_lumen_auth_headers, get_lumen_auth_payload };

// Helper to generate UUIDv4 globally unique card & board _code values (with UUIDv7 helper for *_uuid columns)
export const createUuidV7 = () => uuidv7();
export const createCardId = () => uuidv4();
export const createBoardId = () => uuidv4();

// Helper to generate unique IDs
export const createId = (prefix = 'lumen') => {
  if (prefix === 'card' || prefix === 'group' || prefix === 'board' || prefix === 'comment' || prefix === 'file') {
    return uuidv4();
  }
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};

// Adjustable grid dimension signal (supports 1px to 240px, default 24px)
export const gridDimensionSignal = persist(
  signal(24),
  'lumen_grid_dimension_v1'
);

// Helper to set and propagate adjustable grid dimension across active board & styles
export const setGridDimension = (newDim) => {
  const dim = Math.max(1, Math.min(240, Math.round(Number(newDim) || 24)));
  gridDimensionSignal.value = dim;
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--lumen-grid-size', `${dim}px`);
  }
  if (activeBoardSignal && activeBoardSignal.value) {
    const cur_settings = activeBoardSignal.value.board_setting || {};
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      gridDimension: dim,
      grid_dimension: dim,
      board_setting: {
        ...cur_settings,
        grid_dimension: dim,
      },
      updatedAt: Date.now(),
    };
    saveCurrentBoardToStore();
  }
};

// Grid snap helper using adjustable grid dimension (from 1px up to 240px)
export const snapToGrid = (value, gridSize = null) => {
  const size = Math.max(
    1,
    typeof gridSize === 'number' && gridSize >= 1
      ? gridSize
      : (gridDimensionSignal.value || 24)
  );
  if (size <= 1) return Math.round(value);
  return Math.round(value / size) * size;
};

// Board Themes Definition for Spatial Canvases
export const BOARD_THEMES = {
  default: {
    id: 'default',
    name: 'Studio Minimal',
    canvasBg: '#f8fafc',
    canvasDot: '#94a3b8',
    accent: '#2563eb',
    isDark: false,
  },
  dark: {
    id: 'dark',
    name: 'Dark Theme',
    canvasBg: '#0f172a',
    canvasDot: '#334155',
    accent: '#38bdf8',
    isDark: true,
  },
  graphite: {
    id: 'graphite',
    name: 'Obsidian Noir',
    canvasBg: '#111827',
    canvasDot: '#475569',
    accent: '#38bdf8',
    isDark: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Blue',
    canvasBg: '#090d16',
    canvasDot: '#1e293b',
    accent: '#60a5fa',
    isDark: true,
  },
  warm_stone: {
    id: 'warm_stone',
    name: 'Warm Stone',
    canvasBg: '#fbf9f5',
    canvasDot: '#c4ab93',
    accent: '#b45309',
    isDark: false,
  },
  nordic_ice: {
    id: 'nordic_ice',
    name: 'Nordic Ice',
    canvasBg: '#f0f7ff',
    canvasDot: '#93c5fd',
    accent: '#0284c7',
    isDark: false,
  },
  sage_atelier: {
    id: 'sage_atelier',
    name: 'Sage Botanical',
    canvasBg: '#f3f6f3',
    canvasDot: '#86a789',
    accent: '#15803d',
    isDark: false,
  },
  terracotta: {
    id: 'terracotta',
    name: 'Terracotta Earth',
    canvasBg: '#faf5f0',
    canvasDot: '#d4a373',
    accent: '#c2410c',
    isDark: false,
  },
};

// Helper to apply active board theme colors to CSS custom properties & data attributes
export const applyBoardThemeToDocument = (themeId = 'default') => {
  if (typeof document === 'undefined') return;
  const theme = BOARD_THEMES[themeId] || (themeId === 'dark' ? BOARD_THEMES.dark : BOARD_THEMES.default);
  const is_dark = Boolean(theme?.isDark || themeId === 'dark' || themeId === 'graphite' || themeId === 'midnight');

  // Toggle dark mode classes & data-theme attributes on html root and #root
  document.documentElement.setAttribute('data-theme', is_dark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', is_dark);
  document.documentElement.classList.toggle('lumen-theme-dark', is_dark);

  const root_el = document.getElementById('root');
  if (root_el) {
    root_el.setAttribute('data-theme', is_dark ? 'dark' : 'light');
    root_el.classList.toggle('dark', is_dark);
    root_el.classList.toggle('lumen-theme-dark', is_dark);
  }

  // Canvas background and dot grid
  document.documentElement.style.setProperty('--lumen-canvas-bg', theme.canvasBg);
  document.documentElement.style.setProperty('--lumen-canvas-dot', theme.canvasDot);
  if (theme.accent) {
    document.documentElement.style.setProperty('--lumen-accent', theme.accent);
  }

  // Dynamically update card & menu tokens so cards and menus instantly reflect dark mode
  if (is_dark) {
    document.documentElement.style.setProperty('--lumen-surface', '#1e293b');
    document.documentElement.style.setProperty('--lumen-surface-elevated', '#283548');
    document.documentElement.style.setProperty('--lumen-surface-subtle', '#0f172a');
    document.documentElement.style.setProperty('--lumen-surface-hover', '#334155');
    document.documentElement.style.setProperty('--lumen-surface-active', '#475569');
    document.documentElement.style.setProperty('--lumen-border', '#334155');
    document.documentElement.style.setProperty('--lumen-border-strong', '#475569');
    document.documentElement.style.setProperty('--lumen-text-primary', '#f8fafc');
    document.documentElement.style.setProperty('--lumen-text-secondary', '#cbd5e1');
    document.documentElement.style.setProperty('--lumen-text-muted', '#94a3b8');
    document.documentElement.style.setProperty('--lumen-text-inverse', '#0f172a');
    document.documentElement.style.setProperty('--lumen-accent-subtle', 'rgba(56, 189, 248, 0.2)');
    document.documentElement.style.setProperty('--lumen-accent-hover', '#0284c7');
    document.documentElement.style.setProperty('--lumen-canvas-grid-line', 'rgba(255, 255, 255, 0.08)');
    document.documentElement.style.setProperty('--lumen-shadow-xs', '0 1px 2px rgba(0, 0, 0, 0.5)');
    document.documentElement.style.setProperty('--lumen-shadow-sm', '0 2px 5px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(0, 0, 0, 0.4)');
    document.documentElement.style.setProperty('--lumen-shadow-card', '0 4px 16px -2px rgba(0, 0, 0, 0.65), 0 2px 6px -2px rgba(0, 0, 0, 0.5)');
    document.documentElement.style.setProperty('--lumen-shadow-card-hover', '0 12px 28px -4px rgba(0, 0, 0, 0.75), 0 4px 10px -2px rgba(0, 0, 0, 0.6)');
    document.documentElement.style.setProperty('--lumen-shadow-card-active', '0 18px 40px -6px rgba(0, 0, 0, 0.85), 0 8px 16px -3px rgba(0, 0, 0, 0.7)');
    document.documentElement.style.setProperty('--lumen-shadow-overlay', '0 24px 48px -8px rgba(0, 0, 0, 0.9)');
  } else {
    document.documentElement.style.setProperty('--lumen-surface', '#ffffff');
    document.documentElement.style.setProperty('--lumen-surface-elevated', '#ffffff');
    document.documentElement.style.setProperty('--lumen-surface-subtle', '#f8fafc');
    document.documentElement.style.setProperty('--lumen-surface-hover', '#f1f5f9');
    document.documentElement.style.setProperty('--lumen-surface-active', '#e2e8f0');
    document.documentElement.style.setProperty('--lumen-border', '#e2e8f0');
    document.documentElement.style.setProperty('--lumen-border-strong', '#cbd5e1');
    document.documentElement.style.setProperty('--lumen-accent-subtle', '#eff6ff');
    document.documentElement.style.setProperty('--lumen-accent-hover', '#1d4ed8');
    document.documentElement.style.setProperty('--lumen-text-primary', '#0f172a');
    document.documentElement.style.setProperty('--lumen-text-secondary', '#475569');
    document.documentElement.style.setProperty('--lumen-text-muted', '#94a3b8');
    document.documentElement.style.setProperty('--lumen-text-inverse', '#ffffff');
    document.documentElement.style.setProperty('--lumen-canvas-grid-line', 'rgba(15, 23, 42, 0.05)');
    document.documentElement.style.setProperty('--lumen-shadow-xs', '0 1px 2px rgba(15, 23, 42, 0.05)');
    document.documentElement.style.setProperty('--lumen-shadow-sm', '0 2px 5px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)');
    document.documentElement.style.setProperty('--lumen-shadow-card', '0 4px 14px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)');
    document.documentElement.style.setProperty('--lumen-shadow-card-hover', '0 10px 24px -4px rgba(15, 23, 42, 0.12), 0 4px 8px -2px rgba(15, 23, 42, 0.06)');
    document.documentElement.style.setProperty('--lumen-shadow-card-active', '0 16px 36px -6px rgba(15, 23, 42, 0.18), 0 6px 14px -3px rgba(15, 23, 42, 0.08)');
    document.documentElement.style.setProperty('--lumen-shadow-overlay', '0 20px 40px -8px rgba(15, 23, 42, 0.22)');
  }
};

// Helper to apply active card corner radius style to CSS custom properties
export const applyCardCornerStyleToDocument = (cornerStyle = 'rounded') => {
  if (typeof document === 'undefined') return;
  const radii = {
    sharp: '2px',
    rounded: '10px',
    soft: '18px',
  };
  const radius = radii[cornerStyle] || '10px';
  document.documentElement.style.setProperty('--lumen-card-radius', radius);
  document.documentElement.style.setProperty('--lumen-radius-md', radius);
};

const CATEGORY_SAMPLE_MAP = {
  'sans-serif': 'Clean geometric & humanist sans-serif typography',
  serif: 'Refined editorial & literary serif typography',
  display: 'Expressive studio & headline display lettering',
  handwriting: 'Natural handwritten & calligraphic script',
  monospace: 'Technical developer & tabular monospace',
};

const BUILTIN_FONT_RAW = [
  // Sans-Serif (60+)
  ['Inter', 'sans-serif', '400;500;600;700', 'Clean geometric interface & UI legibility'],
  ['Roboto', 'sans-serif', '400;500;700', 'Neo-grotesque mechanical skeleton', 'Apache 2.0 (Free Commercial)'],
  ['Open Sans', 'sans-serif', '400;500;600;700', 'Humanist neutral legibility across screens'],
  ['Montserrat', 'sans-serif', '400;500;600;700', 'Urban architectural signage sans'],
  ['Poppins', 'sans-serif', '400;500;600;700', 'Friendly circular geometric sans'],
  ['Lato', 'sans-serif', '400;700', 'Warm semi-rounded humanist sans'],
  ['Plus Jakarta Sans', 'sans-serif', '400;500;600;700', 'Contemporary brand & editorial sans'],
  ['DM Sans', 'sans-serif', '400;500;600;700', 'Low-contrast geometric clarity'],
  ['Space Grotesk', 'sans-serif', '400;500;600;700', 'Technical proportional grotesque'],
  ['Outfit', 'sans-serif', '400;500;600;700', 'Modern brand-ready geometric sans'],
  ['Manrope', 'sans-serif', '400;500;600;700', 'Semi-condensed modern precision'],
  ['Work Sans', 'sans-serif', '400;500;600;700', 'Optimized for on-screen medium text'],
  ['Nunito', 'sans-serif', '400;600;700', 'Well-balanced rounded terminal sans'],
  ['Nunito Sans', 'sans-serif', '400;600;700', 'Clean humanist sans with straight terminals'],
  ['Raleway', 'sans-serif', '400;500;600;700', 'Elegant thin-to-bold display sans'],
  ['Ubuntu', 'sans-serif', '400;500;700', 'Humanist clarity with distinct curves', 'Ubuntu Font License (Free Commercial)'],
  ['Rubik', 'sans-serif', '400;500;600;700', 'Slightly rounded corners & balanced rhythm'],
  ['Oswald', 'sans-serif', '400;500;600;700', 'Reworked classic condensed alternate gothic'],
  ['Kanit', 'sans-serif', '400;500;600;700', 'Loop-less modern geometric sans'],
  ['Mulish', 'sans-serif', '400;500;600;700', 'Minimalist display and text sans'],
  ['Quicksand', 'sans-serif', '400;500;600;700', 'Rounded geometric display sans'],
  ['Barlow', 'sans-serif', '400;500;600;700', 'Slightly rounded low-contrast grotesk'],
  ['Barlow Condensed', 'sans-serif', '400;500;600;700', 'Compact industrial condensed grotesk'],
  ['Heebo', 'sans-serif', '400;500;600;700', 'Clean modern humanist sans'],
  ['IBM Plex Sans', 'sans-serif', '400;500;600;700', 'Engineered neo-grotesque clarity'],
  ['Karla', 'sans-serif', '400;500;600;700', 'Quirky grotesque sans-serif'],
  ['Josefin Sans', 'sans-serif', '400;500;600;700', '1920s geometric vintage elegance'],
  ['Libre Franklin', 'sans-serif', '400;500;600;700', 'Modern expansion of classic Franklin Gothic'],
  ['Cabin', 'sans-serif', '400;500;600;700', 'Humanist sans inspired by Gill & Johnston'],
  ['Arimo', 'sans-serif', '400;500;600;700', 'Metric-compatible crisp screen sans', 'Apache 2.0 (Free Commercial)'],
  ['Titillium Web', 'sans-serif', '400;600;700', 'Academic & technical geometric sans'],
  ['PT Sans', 'sans-serif', '400;700', 'Universal humanist Russian & Latin sans'],
  ['Hind', 'sans-serif', '400;500;600;700', 'Open-counter UI & screen legibility'],
  ['Oxygen', 'sans-serif', '400;700', 'Desktop & web interface clarity'],
  ['Dosis', 'sans-serif', '400;500;600;700', 'Rounded narrow sci-fi geometric sans'],
  ['Anton', 'sans-serif', '400', 'Bold advertising impact sans'],
  ['Fira Sans', 'sans-serif', '400;500;600;700', 'Mozilla humanist interface typeface'],
  ['Prompt', 'sans-serif', '400;500;600;700', 'Wide airy geometric proportions'],
  ['Exo 2', 'sans-serif', '400;500;600;700', 'Futuristic technological geometric sans'],
  ['Asap', 'sans-serif', '400;500;600;700', 'Standardized metric width sans'],
  ['Overpass', 'sans-serif', '400;500;600;700', 'Highway signage inspired sans'],
  ['Public Sans', 'sans-serif', '400;500;600;700', 'Strong neutral civic & editorial sans'],
  ['Urbanist', 'sans-serif', '400;500;600;700', 'Modernist low-contrast geometric sans'],
  ['Sora', 'sans-serif', '400;500;600;700', 'Crisp digital-first geometric sans'],
  ['Lexend', 'sans-serif', '400;500;600;700', 'Scientifically designed for reading fluency'],
  ['Figtree', 'sans-serif', '400;500;600;700', 'Clean friendly geometric UI sans'],
  ['Onest', 'sans-serif', '400;500;600;700', 'Hybrid geometric & humanist legibility'],
  ['Bricolage Grotesque', 'sans-serif', '400;500;600;700', 'Expressive historical grotesk blend'],
  ['Schibsted Grotesk', 'sans-serif', '400;500;600;700', 'Nordic digital editorial grotesk'],
  ['Hanken Grotesk', 'sans-serif', '400;500;600;700', 'Friendly functional neo-grotesk'],
  ['Albert Sans', 'sans-serif', '400;500;600;700', 'Modern geometric versatility'],
  [' Epilogue'.trim(), 'sans-serif', '400;500;600;700', 'Variable neo-grotesque with sharp angles'],
  ['Red Hat Display', 'sans-serif', '400;500;600;700', 'Open-source geometric headline sans'],
  ['Red Hat Text', 'sans-serif', '400;500;600;700', 'Open-source body text legibility'],
  ['Be Vietnam Pro', 'sans-serif', '400;500;600;700', 'Engineered neo-grotesque structure'],
  ['Chivo', 'sans-serif', '400;500;600;700', 'Strong grotesque for headlines & body'],
  ['Questrial', 'sans-serif', '400', 'Modern circular full-curve sans'],
  ['Maven Pro', 'sans-serif', '400;500;600;700', 'Unique flowing curvature sans'],
  ['Signika', 'sans-serif', '400;500;600;700', 'Gentle low-contrast signage sans'],
  ['Catamaran', 'sans-serif', '400;500;600;700', 'Balanced contemporary text sans'],
  ['Alegreya Sans', 'sans-serif', '400;500;700', 'Humanist calligraphic rhythm sans'],
  ['Source Sans 3', 'sans-serif', '400;500;600;700', 'Adobe open-source UI & text workhorse'],
  ['Noto Sans', 'sans-serif', '400;500;600;700', 'Global harmonious sans-serif'],

  // Serif (35+)
  ['Playfair Display', 'serif', '400;500;600;700', 'High-contrast luxury & editorial serif'],
  ['Instrument Serif', 'serif', '400', 'Refined contemporary magazine display'],
  ['Cormorant Garamond', 'serif', '400;500;600;700', 'Classical atelier & gallery typography'],
  ['Fraunces', 'serif', '400;500;600;700', 'Expressive old-style soft serif'],
  ['Lora', 'serif', '400;500;600;700', 'Calligraphic brushed literary serif'],
  ['Merriweather', 'serif', '400;700', 'Warm high-readability editorial serif'],
  ['Libre Baskerville', 'serif', '400;700', 'Classic book & long-form reading serif'],
  ['PT Serif', 'serif', '400;700', 'Transitional universal literary serif'],
  ['Crimson Text', 'serif', '400;600;700', 'Old-style Garamond book production serif'],
  ['Crimson Pro', 'serif', '400;500;600;700', 'Refined contemporary book serif'],
  ['EB Garamond', 'serif', '400;500;600;700', 'Classical 16th-century Claude Garamont revival'],
  ['Bitter', 'serif', '400;500;600;700', 'Contemporary slab serif for screen reading'],
  ['Arvo', 'serif', '400;700', 'Geometric monolinear slab serif'],
  ['zilla Slab'.replace(/^z/, 'Z'), 'serif', '400;500;600;700', 'Mozilla contemporary journalistic slab serif'],
  ['DM Serif Display', 'serif', '400', 'High-contrast dramatic headline serif'],
  ['DM Serif Text', 'serif', '400', 'Companion editorial text serif'],
  ['Spectral', 'serif', '400;500;600;700', 'Screen-first responsive French editorial serif'],
  ['Newsreader', 'serif', '400;500;600;700', 'Designed for long-form digital journalism'],
  ['Bodoni Moda', 'serif', '400;500;600;700', 'Digital-era high-fashion Didone serif'],
  ['Cinzel', 'serif', '400;500;600;700', 'First-century Roman monumental inscription serif'],
  ['Prata', 'serif', '400', 'Elegant Didone with teardrop terminals'],
  ['Cardo', 'serif', '400;700', 'Renaissance scholarly & classicists serif'],
  ['Vollkorn', 'serif', '400;500;600;700', 'Quiet robust everyday bread-and-butter serif'],
  ['Alegreya', 'serif', '400;500;600;700', 'Award-winning dynamic literary serif'],
  ['Domine', 'serif', '400;500;600;700', 'Clarendon-inspired newspaper body serif'],
  ['Bree Serif', 'serif', '400', 'Friendly upright italic slab serif'],
  ['Rokkitt', 'serif', '400;500;600;700', 'Geometric Egyptian display slab serif'],
  ['IBM Plex Serif', 'serif', '400;500;600;700', 'Transitional engineered editorial serif'],
  ['Source Serif 4', 'serif', '400;500;600;700', 'Contemporary transitional reading serif'],
  ['Noto Serif', 'serif', '400;500;600;700', 'Global harmonious editorial serif'],
  ['Young Serif', 'serif', '400', 'Heavy old-style warm bracketed serif'],
  ['Literata', 'serif', '400;500;600;700', 'Digital e-book & long-form flagship serif'],

  // Display (25+)
  ['Syne', 'display', '400;500;600;700;800', 'Art center & avant-garde studio display'],
  ['Bebas Neue', 'display', '400', 'Condensed all-caps poster headline'],
  ['Archivo Black', 'display', '400', 'Heavy impact grotesque headline'],
  ['Righteous', 'display', '400', 'Geometric deco poster lettering'],
  ['Abril Fatface', 'display', '400', 'Heavy titling Didone poster display'],
  ['Alfa Slab One', 'display', '400', 'Extreme weight Egyptian slab display'],
  ['Lobster', 'display', '400', 'Bold condensed ligature script display'],
  ['Comfortaa', 'display', '400;500;600;700', 'Rounded geometric futuristic display'],
  ['Fredoka', 'display', '400;500;600;700', 'Soft rounded approachable display'],
  ['Yeseva One', 'display', '400', 'Feminine high-contrast display serif'],
  ['Orbitron', 'display', '400;500;600;700', 'Geometric sci-fi & aerospace display'],
  ['Cinzel Decorative', 'display', '400;700', 'Ornamental calligraphic Roman capitals'],
  ['Playfair Display SC', 'display', '400;700', 'Small-caps editorial luxury titling'],
  ['Monoton', 'display', '400', 'Pure metal-prism multiline neon display'],
  ['Bungee', 'display', '400', 'Urban vertical-friendly signage display'],
  ['Press Start 2P', 'display', '400', 'Classic 8-bit arcade pixel bitmap display'],
  ['Special Elite', 'display', '400', 'Vintage inked analog typewriter display', 'Apache 2.0 (Free Commercial)'],
  ['Unbounded', 'display', '400;500;600;700', 'Expansive web3 & contemporary display sans'],
  ['Dela Gothic One', 'display', '400', 'Ultra-bold flat poster display'],
  ['Climate Crisis', 'display', '400', 'High-impact variable poster display'],
  ['Poiret One', 'display', '400', 'Sleek Art Deco geometric linear display'],
  ['Gruppo', 'display', '400', 'Minimalist wide technical display'],

  // Handwriting & Script (20+)
  ['Caveat', 'handwriting', '400;500;600;700', 'Natural handwritten studio annotations'],
  ['Kalam', 'handwriting', '400;700', 'Informal felt-pen sketchboard notes'],
  ['Permanent Marker', 'handwriting', '400', 'Bold studio marker sticky note', 'Apache 2.0 (Free Commercial)'],
  ['Dancing Script', 'handwriting', '400;500;600;700', 'Lively flowing cursive script'],
  ['Pacifico', 'handwriting', '400', '1950s American surf culture brush script'],
  ['Shadows Into Light', 'handwriting', '400', 'Clean neat personal handwriting'],
  ['Indie Flower', 'handwriting', '400', 'Carefree open bubbly handwriting'],
  ['Amatic SC', 'handwriting', '400;700', 'Hand-drawn condensed all-caps titling'],
  ['Architects Daughter', 'handwriting', '400', 'Architectural drafting block hand-lettering'],
  ['Patrick Hand', 'handwriting', '400', 'Friendly legible marker handwriting'],
  ['Satisfy', 'handwriting', '400', 'Timeless classic brush script'],
  ['Great Vibes', 'handwriting', '400', 'Formal calligraphy with flowing loops'],
  ['Sacramento', 'handwriting', '400', 'Monoline semi-connected 1950s script'],
  ['Gloria Hallelujah', 'handwriting', '400', 'Comic-book style casual handwriting'],
  ['Courgette', 'handwriting', '400', 'Medium-contrast brush italic script'],
  ['Yellowtail', 'handwriting', '400', 'Flat-brush vintage sign-painter script', 'Apache 2.0 (Free Commercial)'],
  ['Homemade Apple', 'handwriting', '400', 'Authentic vintage cursive penmanship', 'Apache 2.0 (Free Commercial)'],
  ['Reenie Beanie', 'handwriting', '400', 'Quick ballpoint storyboard sketch script'],
  ['Handlee', 'handwriting', '400', 'Consistent human-touch note script'],
  ['Marck Script', 'handwriting', '400', 'Relaxed felt-tip freestyle script'],

  // Monospace (15+)
  ['JetBrains Mono', 'monospace', '400;500;600;700', 'Developer & architecture spec mono'],
  ['Space Mono', 'monospace', '400;700', 'Editorial geometric typewriter mono'],
  ['Fira Code', 'monospace', '400;500;600;700', 'Technical code & data tabular mono'],
  ['IBM Plex Mono', 'monospace', '400;500;600;700', 'Engineered industrial monospace'],
  ['Roboto Mono', 'monospace', '400;500;600;700', 'Optimized for source code & tabular data', 'Apache 2.0 (Free Commercial)'],
  ['Source Code Pro', 'monospace', '400;500;600;700', 'Adobe open-source coding monospace'],
  ['Inconsolata', 'monospace', '400;500;600;700', 'Humanist programmer & terminal mono'],
  ['Ubuntu Mono', 'monospace', '400;700', 'Distinctive compact terminal monospace', 'Ubuntu Font License (Free Commercial)'],
  ['DM Mono', 'monospace', '400;500', 'Refined low-contrast editorial mono'],
  ['Azeret Mono', 'monospace', '400;500;600;700', 'Contemporary brutalist & UI monospace'],
  ['Courier Prime', 'monospace', '400;700', 'Screenplay & classic typewriter monospace'],
  ['Anonymous Pro', 'monospace', '400;700', 'Fixed-width coding & technical mono'],
  ['VT323', 'monospace', '400', 'DEC VT320 retro CRT terminal monospace'],
  ['Red Hat Mono', 'monospace', '400;500;600;700', 'Distinguishable technical monospace'],
  ['Overpass Mono', 'monospace', '400;500;600;700', 'Industrial stencil-inspired monospace'],
];

// Curated catalog of 100% Free Commercial Google Fonts (SIL Open Font License 1.1 & Apache 2.0)
export const FREE_COMMERCIAL_GOOGLE_FONTS = BUILTIN_FONT_RAW.map((row, idx) => ({
  family: row[0],
  category: row[1],
  weights: row[2] || '400;500;600;700',
  sample: row[3] || CATEGORY_SAMPLE_MAP[row[1]] || 'Open-source commercial typography',
  license: row[4] || 'SIL OFL 1.1 (Free Commercial)',
  popularity: idx + 1,
}));

// Reactive signal containing all Free Commercial Google Fonts (starts with 155+ built-in, expands to 1,600+ from /api/google-fonts)
export const googleFontsCatalogSignal = signal(FREE_COMMERCIAL_GOOGLE_FONTS);
export const isGoogleFontsLoadingSignal = signal(false);
let has_fetched_full_google_fonts = false;

export const ensure_all_google_fonts_loaded = async () => {
  if (has_fetched_full_google_fonts || isGoogleFontsLoadingSignal.value) return;
  if (typeof window === 'undefined') return;
  isGoogleFontsLoadingSignal.value = true;
  try {
    const resp = await fetch('/api/google-fonts');
    if (resp.ok) {
      const data = await resp.json();
      if (data?.ok && Array.isArray(data.fonts) && data.fonts.length > 0) {
        const builtin_map = new Map(
          FREE_COMMERCIAL_GOOGLE_FONTS.map((f) => [f.family.toLowerCase(), f])
        );
        const merged = [];
        const seen = new Set();

        // Keep rich custom sample descriptions for built-in curated fonts while preserving popularity order
        for (const remote_font of data.fonts) {
          const key = String(remote_font.family || '').toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          const builtin = builtin_map.get(key);
          merged.push({
            family: remote_font.family,
            category: remote_font.category || builtin?.category || 'sans-serif',
            license: remote_font.license || builtin?.license || 'SIL OFL 1.1 (Free Commercial)',
            weights: remote_font.weights || builtin?.weights || '400;500;600;700',
            sample: builtin?.sample || remote_font.sample || CATEGORY_SAMPLE_MAP[remote_font.category] || 'Open-source commercial typography',
            popularity: remote_font.popularity || 999,
          });
        }

        // Ensure any built-in font not in remote list is also included
        for (const b_font of FREE_COMMERCIAL_GOOGLE_FONTS) {
          const key = b_font.family.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(b_font);
          }
        }

        googleFontsCatalogSignal.value = merged;
        has_fetched_full_google_fonts = true;
      }
    }
  } catch (_) {
    // Keep built-in 155+ catalog on offline/error
  } finally {
    isGoogleFontsLoadingSignal.value = false;
  }
};

// Search & filter across all Free Commercial Google Fonts
export const search_google_fonts = (query = '', category = 'all') => {
  const all_fonts = googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS;
  const q = String(query || '').trim().toLowerCase();
  return all_fonts.filter((gf) => {
    if (category && category !== 'all' && gf.category !== category) {
      return false;
    }
    if (!q) return true;
    return (
      gf.family.toLowerCase().includes(q) ||
      gf.category.toLowerCase().includes(q) ||
      (gf.sample && gf.sample.toLowerCase().includes(q))
    );
  });
};

const loaded_google_fonts_cache = new Set();

// Dynamically inject a Google Fonts stylesheet link into document.head
export const load_google_font = (font_family) => {
  if (typeof document === 'undefined' || !font_family) return;
  const cleaned = String(font_family).trim();
  if (!cleaned || cleaned === 'default' || cleaned === 'board_default') return;

  if (loaded_google_fonts_cache.has(cleaned.toLowerCase())) return;

  const slug = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const link_id = `lumen-google-font-${slug}`;
  if (document.getElementById(link_id)) {
    loaded_google_fonts_cache.add(cleaned.toLowerCase());
    return;
  }

  const all_fonts = googleFontsCatalogSignal?.value || FREE_COMMERCIAL_GOOGLE_FONTS;
  const catalog_entry = all_fonts.find(
    (f) => f.family.toLowerCase() === cleaned.toLowerCase()
  );
  const family_param = encodeURIComponent(catalog_entry ? catalog_entry.family : cleaned).replace(
    /%20/g,
    '+'
  );
  const weights_suffix = catalog_entry?.weights
    ? `:wght@${catalog_entry.weights}`
    : ':wght@400;500;600;700';

  const link_el = document.createElement('link');
  link_el.id = link_id;
  link_el.rel = 'stylesheet';
  link_el.href = `https://fonts.googleapis.com/css2?family=${family_param}${weights_suffix}&display=swap`;
  document.head.appendChild(link_el);
  loaded_google_fonts_cache.add(cleaned.toLowerCase());
};

// Build a CSS font-family value with fallback stack for a Google Font family name
export const get_google_font_css_stack = (font_family) => {
  if (!font_family || font_family === 'default' || font_family === 'board_default') {
    return null;
  }
  const cleaned = String(font_family).trim();
  if (!cleaned) return null;
  load_google_font(cleaned);
  const all_fonts = googleFontsCatalogSignal?.value || FREE_COMMERCIAL_GOOGLE_FONTS;
  const catalog_entry = all_fonts.find(
    (f) => f.family.toLowerCase() === cleaned.toLowerCase()
  );
  const fam_name = catalog_entry ? catalog_entry.family : cleaned;
  const cat = catalog_entry?.category || 'sans-serif';
  if (cat === 'serif') return `'${fam_name}', Georgia, serif`;
  if (cat === 'monospace') return `'${fam_name}', monospace`;
  if (cat === 'handwriting') return `'${fam_name}', cursive, sans-serif`;
  return `'${fam_name}', -apple-system, BlinkMacSystemFont, sans-serif`;
};

// Apply board-level default Google Font to document root
export const applyBoardFontToDocument = (font_family = 'default') => {
  if (typeof document === 'undefined') return;
  const stack = get_google_font_css_stack(font_family);
  if (stack) {
    document.documentElement.style.setProperty('--lumen-board-font-family', stack);
  } else {
    document.documentElement.style.removeProperty('--lumen-board-font-family');
  }
};

// Resolve effective CSS font-family stack for a card (per-card override > board default > null)
export const resolve_card_font_family = (card, board = null) => {
  const card_font = card?.font_family || card?.data?.font_family;
  if (card_font && card_font !== 'board_default' && card_font !== 'default') {
    return get_google_font_css_stack(card_font);
  }
  const target_board = board || activeBoardSignal?.value;
  const board_font = target_board?.board_setting?.font_family;
  if (board_font && board_font !== 'default') {
    return get_google_font_css_stack(board_font);
  }
  return null;
};

// Helper to apply active card style ('full' | 'seamless') to document root
export const applyCardStyleToDocument = (cardStyle = 'full') => {
  if (typeof document === 'undefined') return;
  const normalized = cardStyle === 'seamless' ? 'seamless' : 'full';
  document.documentElement.setAttribute('data-card-style', normalized);
};

// Resolve effective card style ('full' | 'seamless'): per-card override takes precedence over board_setting.card_style
export const resolve_card_style = (card, board = null) => {
  const override = card?.card_style;
  if (override === 'full' || override === 'seamless') {
    return override;
  }
  const target_board = board || activeBoardSignal?.value;
  return target_board?.board_setting?.card_style === 'seamless' ? 'seamless' : 'full';
};

// Helper to update board_setting object (persisted to database JSONB column)
export const updateBoardSetting = (key_or_patch, val) => {
  if (!activeBoardSignal || !activeBoardSignal.value) return;
  const current_settings = activeBoardSignal.value.board_setting || {};
  let next_settings;
  if (typeof key_or_patch === 'string') {
    next_settings = { ...current_settings, [key_or_patch]: val };
  } else if (key_or_patch && typeof key_or_patch === 'object') {
    next_settings = { ...current_settings, ...key_or_patch };
  } else {
    return;
  }

  // If color_theme changed, apply immediately to document
  if (next_settings.color_theme) {
    applyBoardThemeToDocument(next_settings.color_theme);
  }

  // If card_corner_style changed, apply immediately to document
  if (next_settings.card_corner_style !== undefined) {
    applyCardCornerStyleToDocument(next_settings.card_corner_style);
  }

  // If card_style changed, apply immediately to document
  if (next_settings.card_style !== undefined) {
    applyCardStyleToDocument(next_settings.card_style);
  }

  // If font_family changed, apply immediately to document
  if (next_settings.font_family !== undefined) {
    applyBoardFontToDocument(next_settings.font_family);
  }

  // If board_type changed, sync top-level boardType & snapToGridSignal
  if (next_settings.board_type !== undefined) {
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      boardType: next_settings.board_type,
      board_type: next_settings.board_type,
    };
    snapToGridSignal.value = next_settings.board_type !== 'free_position';
  }

  // If grid_dimension changed, sync top-level gridDimension & CSS variable
  if (next_settings.grid_dimension !== undefined) {
    const dim = Math.max(1, Math.min(240, Math.round(Number(next_settings.grid_dimension) || 24)));
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      gridDimension: dim,
      grid_dimension: dim,
    };
    gridDimensionSignal.value = dim;
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--lumen-grid-size', `${dim}px`);
    }
  }

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    board_setting: next_settings,
    updatedAt: Date.now(),
  };

  // Sync description to top-level if description updated
  if (next_settings.description !== undefined) {
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      description: next_settings.description,
      board_description: next_settings.description,
    };
  }

  saveCurrentBoardToStore();
};

/**
 * Builds a standardized, portable, user-agnostic board export & template payload
 * (`format: "lumen_board_export"`) that strips session/owner credentials so other users
 * can import it or use it directly as a board template in BOARD_TEMPLATES.
 */
export function build_board_export_payload(board_source = null) {
  const raw_input = board_source || activeBoardSignal?.value || {};
  const src =
    raw_input && typeof raw_input === 'object' && raw_input.board && typeof raw_input.board === 'object'
      ? { ...raw_input, ...raw_input.board }
      : raw_input || {};

  const raw_setting =
    typeof src.board_setting === 'string'
      ? (() => {
          try {
            return JSON.parse(src.board_setting);
          } catch (_) {
            return {};
          }
        })()
      : src.board_setting || {};

  const b_type =
    src.boardType || src.board_type || raw_setting.board_type || raw_setting.boardType || 'snap_grid';
  const g_dim = Number(
    src.gridDimension || src.grid_dimension || raw_setting.grid_dimension || raw_setting.gridDimension || 24
  );
  const resolved_title =
    (src.title !== undefined && String(src.title).trim() !== ''
      ? String(src.title).trim()
      : src.board_name) || 'Untitled Board';
  const resolved_desc =
    src.description !== undefined
      ? String(src.description)
      : src.board_description !== undefined
      ? String(src.board_description)
      : raw_setting.description || '';

  const clean_setting = {
    board_type: b_type,
    grid_dimension: g_dim,
    color_theme: raw_setting.color_theme || 'default',
    grid_style: raw_setting.grid_style || 'dots',
    card_style: raw_setting.card_style === 'seamless' ? 'seamless' : 'full',
    card_corner_style: raw_setting.card_corner_style || 'rounded',
    default_card_color:
      raw_setting.default_card_color || (b_type === 'free_position' ? 'peach' : 'yellow'),
    show_card_shadows: raw_setting.show_card_shadows !== false,
    font_family: raw_setting.font_family || null,
    drag_drop_images_action: raw_setting.drag_drop_images_action || 'carousel',
    description: resolved_desc,
    ...(src.is_nested || raw_setting.is_nested ? { is_nested: true } : {}),
    ...(src.parent_board_id || raw_setting.parent_board_id
      ? { parent_board_id: src.parent_board_id || raw_setting.parent_board_id }
      : {}),
  };

  const raw_viewport = src.viewport || src.board_viewport || { panX: 120, panY: 80, zoom: 1 };
  const clean_viewport = {
    panX: Number(raw_viewport.panX ?? 120),
    panY: Number(raw_viewport.panY ?? 80),
    zoom: Number(raw_viewport.zoom ?? 1),
  };

  const raw_cards = Array.isArray(src.cards)
    ? src.cards
    : Array.isArray(src.board_card)
    ? src.board_card
    : [];

  const clean_cards = raw_cards
    .filter((c) => c && typeof c === 'object')
    .map((c, idx) => {
      const copy = JSON.parse(JSON.stringify(c));
      const card_id = copy.id || copy.card_code || `tpl_card_${idx + 1}`;
      copy.id = card_id;
      copy.card_code = card_id;
      // Strip private owner/tenant identifiers
      delete copy.vendor_code;
      delete copy.master_code;
      delete copy.project_code;
      delete copy.user_account;
      delete copy.card_uuid;
      delete copy.time_create;
      delete copy.time_modify;
      delete copy.updatedAt;

      // Zero-data-leak: if card is encrypted, never export decrypted session plaintext
      const enc = copy.card_encryption || copy.cardEncryption;
      const is_enc = Boolean(
        enc &&
          ((typeof enc === 'object' && enc.ciphertext) ||
            (typeof enc === 'string' && enc.includes('ciphertext')))
      );
      if (is_enc) {
        copy.content = '';
        copy.items = [];
        copy.description = '';
        copy.notes = '';
        copy.url = '';
        copy.is_encryption_unlocked = false;
        if (copy.data && typeof copy.data === 'object') {
          copy.data = {
            ...copy.data,
            content: '',
            items: [],
            description: '',
            notes: '',
            url: '',
          };
        }
      }
      return copy;
    });

  const raw_connections = Array.isArray(src.connections)
    ? src.connections
    : Array.isArray(src.board_connection)
    ? src.board_connection
    : Array.isArray(src.board_conenctions)
    ? src.board_conenctions
    : [];

  const clean_connections = raw_connections
    .filter((conn) => conn && conn.fromId && conn.toId)
    .map((conn, idx) => ({
      id: conn.id || `conn_${idx + 1}`,
      fromId: conn.fromId,
      toId: conn.toId,
      ...(conn.label !== undefined ? { label: conn.label } : {}),
      ...(conn.style !== undefined ? { style: conn.style } : {}),
      ...(conn.color !== undefined ? { color: conn.color } : {}),
    }));

  const raw_drawings = Array.isArray(src.drawings)
    ? src.drawings
    : Array.isArray(src.board_drawing)
    ? src.board_drawing
    : [];
  const clean_drawings = JSON.parse(JSON.stringify(raw_drawings));

  const board_config = {
    ...(src.id ? { id: src.id } : {}),
    title: resolved_title,
    board_name: resolved_title,
    description: resolved_desc,
    board_description: resolved_desc,
    boardType: b_type,
    board_type: b_type,
    gridDimension: g_dim,
    grid_dimension: g_dim,
    ...(src.parent_board_id ? { parent_board_id: src.parent_board_id } : {}),
    ...(src.is_nested ? { is_nested: Boolean(src.is_nested) } : {}),
    board_setting: clean_setting,
    viewport: clean_viewport,
    board_viewport: clean_viewport,
    cards: clean_cards,
    board_card: clean_cards,
    connections: clean_connections,
    board_connection: clean_connections,
    drawings: clean_drawings,
    board_drawing: clean_drawings,
  };

  return {
    format: 'lumen_board_export',
    version: '1.0',
    exported_at: src.exported_at || new Date(src.updatedAt || Date.now()).toISOString(),
    ...board_config,
    board: board_config,
  };
}

export const exportBoardConfiguration = build_board_export_payload;

// Default initial templates (wrapped into the unified lumen_board_export format below)
const RAW_BOARD_TEMPLATES = {
  moodboard: {
    id: 'board_moodboard',
    title: 'Brand Direction & Spatial Workspace',
    description: 'Tactile moodboard exploring architectural geometry, physical prototyping, and materials.',
    boardType: 'snap_grid',
    board_type: 'snap_grid',
    gridDimension: 24,
    grid_dimension: 24,
    board_setting: {
      board_type: 'snap_grid',
      grid_dimension: 24,
      color_theme: 'default',
      grid_style: 'dots',
      card_style: 'full',
      card_corner_style: 'rounded',
      default_card_color: 'yellow',
      show_card_shadows: true,
    },
    updatedAt: 1700000000000,
    viewport: { panX: 120, panY: 60, zoom: 0.95 },
    cards: [
      {
        id: 'card_group_manifesto',
        type: 'group',
        x: 72,
        y: 48,
        width: 408,
        height: 640,
        title: 'Identity & Philosophy Group',
        description: 'Core brand direction notes and spatial guidelines',
        color: 'slate',
        card_ids: ['card_header_1', 'card_note_1'],
        collapsed: false,
        zIndex: 0,
      },
      {
        id: 'card_header_1',
        type: 'heading',
        group_id: 'card_group_manifesto',
        x: 92,
        y: 260,
        width: 368,
        height: 96,
        title: '01. Spatial Identity & Material System',
        content: 'Exploration for spring physical & digital brand systems.',
        color: 'white',
        zIndex: 1,
      },
      {
        id: 'card_note_1',
        type: 'note',
        group_id: 'card_group_manifesto',
        x: 92,
        y: 372,
        width: 368,
        height: 216,
        title: 'Design Philosophy: Tactile Restraint',
        content: 'Prioritize physical presence over synthetic styling.\n\n• Unvarnished stone and honest metallic textures\n• Generous whitespace rhythm (24px spatial increments)\n• High-contrast legibility with zero decorative clutter',
        ai_notes: 'Primary creative manifesto note. Explains tactile restraint, 24px spatial increments, and honest materiality. High priority for design direction queries.',
        tags: [
          { text: 'Manifesto', color: 'purple', added_by: 'Elena Rostova', added_by_id: 'user_elena' },
          { text: 'Design', color: 'blue', added_by: 'Alex Rivers', added_by_id: 'user_alex' },
          { text: 'Architecture', color: 'slate', added_by: 'Marcus Chen', added_by_id: 'user_marcus' },
        ],
        reactions: [
          { emoji: '🔥', count: 4, users: ['user_alex', 'user_elena', 'user_marcus', 'user_sophia'], user_reacted: true },
          { emoji: '❤️', count: 2, users: ['user_elena', 'user_marcus'], user_reacted: false },
          { emoji: '💡', count: 1, users: ['user_sophia'], user_reacted: false },
        ],
        color: 'yellow',
        zIndex: 2,
      },
      {
        id: 'card_tasks_1',
        type: 'tasklist',
        x: 96,
        y: 432,
        width: 360,
        height: 264,
        title: 'Milestone Deliverables',
        items: [
          { id: 't1', text: 'Establish 24px geometric spatial grid', done: true },
          { id: 't2', text: 'Curate physical stone & bronze material swatches', done: true },
          { id: 't3', text: 'Assemble high-resolution moodboard modules', done: true },
          { id: 't4', text: 'Conduct cross-functional creative review', done: false },
          { id: 't5', text: 'Export modular layout package to team', done: false },
        ],
        ai_notes: 'Sprint deliverables tracker. Tasks t4 (creative review) and t5 (export package) are open and pending completion.',
        tags: [
          { text: 'Sprint', color: 'green', added_by: 'Alex Rivers', added_by_id: 'user_alex' },
          { text: 'Urgent', color: 'rose', added_by: 'Elena Rostova', added_by_id: 'user_elena' },
        ],
        reactions: [
          { emoji: '🚀', count: 3, users: ['user_elena', 'user_marcus', 'user_sophia'], user_reacted: false },
          { emoji: '👍', count: 4, users: ['user_alex', 'user_marcus', 'user_sophia', 'user_michael'], user_reacted: true },
        ],
        color: 'green',
        zIndex: 3,
      },
      {
        id: 'card_img_1',
        type: 'image',
        x: 480,
        y: 96,
        width: 408,
        height: 384,
        title: 'Architectural Monolith & Material Studies',
        caption: 'Minimalist travertine pavilion casting soft morning directional shadows.',
        tags: [
          { text: 'Inspiration', color: 'yellow', added_by: 'Sophia Vance', added_by_id: 'user_sophia' },
          { text: 'Materiality', color: 'peach', added_by: 'Marcus Chen', added_by_id: 'user_marcus' },
        ],
        reactions: [
          { emoji: '✨', count: 3, users: ['user_alex', 'user_elena', 'user_sophia'], user_reacted: true },
          { emoji: '👀', count: 2, users: ['user_marcus', 'user_michael'], user_reacted: false },
        ],
        imageUrl: imgArch,
        images: [
          {
            id: 'slide_1',
            url: imgArch,
            caption: 'Minimalist travertine pavilion casting soft morning directional shadows.',
          },
          {
            id: 'slide_2',
            url: imgDesign,
            caption: 'Precision drafting instruments, brass mechanical tools, and ceramic molds.',
          },
          {
            id: 'slide_3',
            url: imgPalette,
            caption: 'Raw oatmeal linen, brushed golden brass hardware, and terra-cotta tile.',
          },
        ],
        active_slide_index: 0,
        color: 'white',
        zIndex: 2,
      },
      {
        id: 'card_quote_1',
        type: 'quote',
        x: 480,
        y: 504,
        width: 408,
        height: 192,
        title: 'Core Quotation',
        content: 'Simplicity is about subtracting the obvious and adding the meaningful.',
        author: 'John Maeda, The Laws of Simplicity',
        color: 'peach',
        zIndex: 3,
      },
      {
        id: 'card_img_2',
        type: 'image',
        x: 912,
        y: 96,
        width: 408,
        height: 360,
        title: 'Industrial Prototypes & Tools',
        caption: 'Precision drafting instruments, brass mechanical tools, and ceramic molds.',
        imageUrl: imgDesign,
        images: [
          {
            id: 'slide_2_1',
            url: imgDesign,
            caption: 'Precision drafting instruments, brass mechanical tools, and ceramic molds.',
          },
          {
            id: 'slide_2_2',
            url: imgPalette,
            caption: 'Color calibration swatches and terra-cotta clay samples.',
          },
          {
            id: 'slide_2_3',
            url: imgArch,
            caption: 'Architectural model study with dynamic lighting.',
          },
        ],
        active_slide_index: 0,
        color: 'white',
        zIndex: 2,
      },
      {
        id: 'card_img_3',
        type: 'image',
        x: 912,
        y: 480,
        width: 408,
        height: 384,
        title: 'Material Swatch Matrix',
        caption: 'Raw oatmeal linen, brushed golden brass hardware, and terra-cotta tile.',
        imageUrl: imgPalette,
        color: 'white',
        zIndex: 2,
      },
      {
        id: 'card_link_1',
        type: 'link',
        x: 96,
        y: 720,
        width: 360,
        height: 320,
        title: 'Design Systems Repository',
        url: 'https://designsystemsrepo.com',
        description: 'Organize notes, ideas, research, and creative projects into visual boards.',
        og_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=630&q=85',
        web_status: 200,
        web_status_text: '200 OK',
        favicon: 'https://www.google.com/s2/favicons?domain=designsystemsrepo.com&sz=64',
        domain: 'designsystemsrepo.com',
        color: 'blue',
        zIndex: 2,
      },
      {
        id: 'card_col_1',
        type: 'column',
        x: 1344,
        y: 96,
        width: 336,
        height: 600,
        title: 'Design Principles Staging',
        content: '1. Function precedes ornamentation\n2. Spatial math strictly adheres to 24px multiples\n3. Zero pill-shaped artificial metadata\n4. Honest materials and tactile digital craftsmanship\n5. Immediate drag-and-drop feedback',
        color: 'purple',
        zIndex: 1,
      },
      {
        id: 'card_stock_mapi',
        type: 'stock',
        x: 1728,
        y: 96,
        width: 550,
        height: 600,
        title: 'Stock Card',
        description: 'Retail & Lifestyle brand portfolio tracking (Zara, Starbucks, Foot Locker)',
        url: 'https://www.idx.co.id/en/listed-companies/company-profiles/MAPI',
        symbol: 'MAPI.JK',
        exchange: 'IDX - Jakarta',
        range: '1d',
        color: 'slate',
        zIndex: 2,
      },
      {
        id: 'card_sheets_1',
        type: 'sheets',
        x: 2160,
        y: 96,
        width: 540,
        height: 380,
        title: 'Project Budget & Task Sheet',
        color: 'green',
        zIndex: 2,
      },
      {
        id: 'card_embed_spotify_1',
        type: 'embed',
        x: 1344,
        y: 440,
        width: 384,
        height: 232,
        title: 'Spotify Track · M83 Midnight City',
        platform: 'spotify',
        social_type: 'track',
        url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        content: '',
        color: 'green',
        zIndex: 3,
      },
      {
        id: 'card_social_1',
        type: 'embed',
        x: 1344,
        y: 720,
        width: 384,
        height: 540,
        title: 'Instagram Reel',
        platform: 'instagram',
        social_type: 'reel',
        url: 'https://www.instagram.com/reel/C8x9Y2mKq4Z/',
        shortcode: 'C8x9Y2mKq4Z',
        content: '',
        color: 'white',
        zIndex: 2,
      },
      {
        id: 'card_board_brand_sub',
        type: 'board',
        x: 912,
        y: 480,
        width: 360,
        height: 220,
        title: 'Brand Guidelines & Design Tokens',
        description: 'Core brand identity system, color tokens, and nested typography specs.',
        target_board_id: 'board_brand',
        color: 'purple',
        zIndex: 4,
      },
      {
        id: 'card_file_spec_1',
        type: 'file',
        x: 912,
        y: 720,
        width: 360,
        height: 360,
        title: 'File Attachment',
        color: 'peach',
        zIndex: 5,
      },
      {
        id: 'card_file_audio_1',
        type: 'file',
        x: 912,
        y: 960,
        width: 340,
        height: 210,
        title: 'Lumen_Ambient_Chime.wav',
        file_name: 'Lumen_Ambient_Chime.wav',
        file_id: 'file_seed_audio_ambient',
        file_size: 264644,
        file_type: 'audio/wav',
        file_url: '/api/files/download/file_seed_audio_ambient',
        view_url: '/api/files/view/file_seed_audio_ambient',
        file_extension: 'wav',
        download_count: 2,
        uploaded_at: Date.now() - 43200000,
        content: 'Original studio audio chime asset for tactile interactions and notifications.',
        color: 'green',
        zIndex: 5,
      },
      {
        id: 'card_file_3d_pavilion',
        type: 'file',
        x: 912,
        y: 1200,
        width: 360,
        height: 440,
        title: 'Architectural_Pavilion_Model.glb',
        file_name: 'Architectural_Pavilion_Model.glb',
        file_id: 'file_seed_model_pavilion',
        file_size: 1420500,
        file_type: 'model/gltf-binary',
        file_url: '/api/files/download/file_seed_model_pavilion',
        view_url: '/api/files/view/file_seed_model_pavilion',
        file_extension: 'glb',
        download_count: 8,
        uploaded_at: Date.now() - 172800000,
        content: 'Tactile architectural earth pavilion study with travertine plinths, terracotta partition screen, and brushed bronze columns.',
        ai_notes: 'Interactive 3D model prototype featuring OrbitControls, Travertine plinth, and Brushed Bronze structural columns.',
        color: 'slate',
        zIndex: 5,
      },
      {
        id: 'card_geo_1',
        type: 'geo',
        x: 480,
        y: 840,
        width: 384,
        height: 420,
        title: 'Kyoto Design Pavilion',
        location_name: 'Kyoto Design Pavilion',
        address: 'Kiyomizu 1-chome, Higashiyama Ward, Kyoto 605-0862, Japan',
        latitude: 34.9949,
        longitude: 135.7850,
        zoom: 15,
        url: 'https://www.google.com/maps/dir/?api=1&origin=34.994900,135.785000&destination=35.011600,135.677700&waypoints=34.967100,135.772700&travelmode=driving',
        notes: 'Site visit for natural stone inspection, travertine sourcing, and ambient acoustic field recording.',
        travel_mode: 'driving',
        destinations: [
          {
            id: 'dest_kyoto_1',
            name: 'Kyoto Design Pavilion',
            address: 'Kiyomizu 1-chome, Higashiyama Ward, Kyoto 605-0862, Japan',
            latitude: 34.9949,
            longitude: 135.7850,
          },
          {
            id: 'dest_kyoto_2',
            name: 'Fushimi Stone Quarry',
            address: '68 Fukakusa, Fushimi Ward, Kyoto 612-0882, Japan',
            latitude: 34.9671,
            longitude: 135.7727,
          },
          {
            id: 'dest_kyoto_3',
            name: 'Arashiyama Bamboo Atelier',
            address: 'Ukyo Ward, Kyoto 616-8385, Japan',
            latitude: 35.0116,
            longitude: 135.6777,
          },
        ],
        color: 'blue',
        zIndex: 4,
        tags: [
          { text: 'SiteVisit', color: 'blue', added_by: 'Alex Rivers', added_by_id: 'user_alex' },
          { text: 'Architecture', color: 'purple', added_by: 'Elena Rostova', added_by_id: 'user_elena' },
        ],
        reactions: [
          { emoji: '📍', count: 3, users: ['user_alex', 'user_elena', 'user_marcus'], user_reacted: true },
          { emoji: '✨', count: 2, users: ['user_sophia', 'user_elena'], user_reacted: false },
        ],
      },
      {
        id: 'card_palette_1',
        type: 'palette',
        x: 480,
        y: 1296,
        width: 384,
        height: 256,
        title: 'Architectural Earth & Travertine',
        description: 'Natural stone, warm taupe, terracotta & raw linen',
        color_format: 'hex',
        palette_layout: 'bars',
        colors: [
          { id: 'c1', hex: '#2A2421', name: 'Charcoal Umber', role: 'Base' },
          { id: 'c2', hex: '#7D6B5D', name: 'Warm Taupe', role: 'Mid' },
          { id: 'c3', hex: '#C28460', name: 'Terracotta', role: 'Accent' },
          { id: 'c4', hex: '#D7C4B7', name: 'Travertine', role: 'Neutral' },
          { id: 'c5', hex: '#F4ECE4', name: 'Raw Linen', role: 'Light' },
        ],
        color: 'white',
        zIndex: 4,
        tags: [
          { text: 'Design Tokens', color: 'peach', added_by: 'Sophia Vance', added_by_id: 'user_sophia' },
          { text: 'Materiality', color: 'blue', added_by: 'Marcus Chen', added_by_id: 'user_marcus' },
        ],
        reactions: [
          { emoji: '🎨', count: 4, users: ['user_alex', 'user_elena', 'user_sophia', 'user_marcus'], user_reacted: true },
          { emoji: '✨', count: 3, users: ['user_alex', 'user_elena', 'user_sophia'], user_reacted: false },
        ],
      },
      {
        id: 'card_embed_pinterest_1',
        type: 'embed',
        x: 1344,
        y: 1296,
        width: 384,
        height: 520,
        title: 'Pinterest · iOS App Design & Visual Craft',
        platform: 'pinterest',
        social_type: 'pin',
        pin_size: 'large',
        pin_terse: true,
        url: 'https://www.pinterest.com/pin/424605071093691246/',
        content: 'Pinterest Pin widget (Size L, 100% width, description removed).',
        color: 'rose',
        zIndex: 3,
        tags: [
          { text: 'Inspiration', color: 'rose', added_by: 'Elena Rostova', added_by_id: 'user_elena' },
          { text: 'Pinterest', color: 'slate', added_by: 'Alex Rivers', added_by_id: 'user_alex' },
        ],
        reactions: [
          { emoji: '📌', count: 4, users: ['user_alex', 'user_elena'], user_reacted: true },
          { emoji: '✨', count: 3, users: ['user_marcus'], user_reacted: false },
        ],
      },
      {
        id: 'card_docs_1',
        type: 'docs',
        x: 840,
        y: 1296,
        width: 540,
        height: 560,
        title: 'Design System & API Architecture Spec',
        doc_font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        doc_font_size: '14px',
        doc_format: 'infinite',
        content: DEFAULT_DOC_TEMPLATE,
        color: 'blue',
        zIndex: 3,
        tags: [
          { text: 'Documentation', color: 'blue', added_by: 'Elena Rostova', added_by_id: 'user_elena' },
          { text: 'Architecture', color: 'purple', added_by: 'Alex Rivers', added_by_id: 'user_alex' },
        ],
        reactions: [
          { emoji: '📄', count: 5, users: ['user_alex', 'user_elena'], user_reacted: true },
          { emoji: '✨', count: 3, users: ['user_marcus'], user_reacted: false },
        ],
      },
    ],
    connections: [
      {
        id: 'conn_1',
        fromId: 'card_header_1',
        toId: 'card_note_1',
        label: 'Informs',
        style: 'solid',
        color: '#2563eb',
      },
      {
        id: 'conn_2',
        fromId: 'card_note_1',
        toId: 'card_img_1',
        label: 'Visual anchor',
        style: 'dashed',
        color: '#64748b',
      },
      {
        id: 'conn_3',
        fromId: 'card_img_1',
        toId: 'card_quote_1',
        label: 'Reinforces',
        style: 'solid',
        color: '#d97706',
      },
      {
        id: 'conn_4',
        fromId: 'card_img_2',
        toId: 'card_img_3',
        label: 'Material companion',
        style: 'dashed',
        color: '#059669',
      },
      {
        id: 'conn_5',
        fromId: 'card_col_1',
        toId: 'card_social_1',
        label: 'Reel Inspiration',
        style: 'solid',
        color: '#cc2366',
      },
    ],
  },
  roadmap: {
    id: 'board_roadmap',
    title: 'Product Architecture & Sprint Canvas',
    description: 'Visual tracking for engineering sprints, core services, and user experience flows.',
    boardType: 'snap_grid',
    board_type: 'snap_grid',
    gridDimension: 24,
    grid_dimension: 24,
    board_setting: {
      board_type: 'snap_grid',
      grid_dimension: 24,
      color_theme: 'default',
      grid_style: 'dots',
      card_corner_style: 'rounded',
      default_card_color: 'blue',
      show_card_shadows: true,
    },
    updatedAt: 1700000000000,
    viewport: { panX: 100, panY: 80, zoom: 0.9 },
    cards: [
      {
        id: 'card_rd_h1',
        type: 'heading',
        x: 96,
        y: 96,
        width: 384,
        height: 96,
        title: 'Spatial Canvas Architecture',
        content: 'System engineering breakdown',
        color: 'white',
        zIndex: 1,
      },
      {
        id: 'card_rd_col1',
        type: 'column',
        x: 96,
        y: 192,
        width: 336,
        height: 480,
        title: 'Phase 1: Freeform Grid',
        content: '• Infinite 2D Pan and Zoom Canvas\n• 24px Snapping Engine\n• Drag preview coordinate resolution\n• Resizing with proportional constraints\n• Minimap radar navigation',
        color: 'blue',
        zIndex: 2,
      },
      {
        id: 'card_rd_col2',
        type: 'column',
        x: 456,
        y: 192,
        width: 336,
        height: 480,
        title: 'Phase 2: Note Modules',
        content: '• Rich Sticky Notes\n• Interactive Task Lists\n• High-res Media Moodboards\n• Direct URL Bookmarks\n• Editorial Quotation Cards',
        color: 'green',
        zIndex: 2,
      },
      {
        id: 'card_rd_col3',
        type: 'column',
        x: 816,
        y: 192,
        width: 336,
        height: 480,
        title: 'Phase 3: Persistence & State',
        content: '• @preact/signals-react integration\n• signals-persist localStorage sync\n• Multi-board routing (React Router 8)\n• JSON Board Import & Export\n• Undo / Redo command history',
        color: 'purple',
        zIndex: 2,
      },
    ],
    connections: [
      {
        id: 'conn_rd_1',
        fromId: 'card_rd_col1',
        toId: 'card_rd_col2',
        label: 'Flows to',
        style: 'solid',
        color: '#2563eb',
      },
      {
        id: 'conn_rd_2',
        fromId: 'card_rd_col2',
        toId: 'card_rd_col3',
        label: 'Enables',
        style: 'solid',
        color: '#059669',
      },
    ],
  },
  blank: {
    id: 'board_blank',
    title: 'Untitled Free Position Workspace',
    description: 'Clean spatial board with smooth pixel-perfect placement for spontaneous creative thinking.',
    boardType: 'free_position',
    board_type: 'free_position',
    gridDimension: 24,
    grid_dimension: 24,
    board_setting: {
      board_type: 'free_position',
      grid_dimension: 24,
      color_theme: 'default',
      grid_style: 'dots',
      card_corner_style: 'rounded',
      default_card_color: 'peach',
      show_card_shadows: true,
    },
    updatedAt: 1700000000000,
    viewport: { panX: 200, panY: 150, zoom: 1 },
    cards: [
      {
        id: 'card_blank_welcome',
        type: 'note',
        x: 240,
        y: 192,
        width: 360,
        height: 240,
        title: 'Free Position Workspace',
        content: 'Drag note modules from the left dock onto this free canvas.\n\n• Cards move and resize pixel-perfect without grid snap\n• Seamless freeform spatial placement anywhere\n• Switch anytime to "Snap to Grid" via the top bar toggle\n• Spacebar + drag to pan canvas',
        color: 'peach',
        zIndex: 1,
      },
    ],
    connections: [],
  },
  grid_blank: {
    id: 'board_grid_blank',
    title: 'Clean Grid Workspace',
    description: 'Structured 24px spatial grid canvas for organized layouts and aligned blocks.',
    boardType: 'snap_grid',
    board_type: 'snap_grid',
    gridDimension: 24,
    grid_dimension: 24,
    board_setting: {
      board_type: 'snap_grid',
      grid_dimension: 24,
      color_theme: 'default',
      grid_style: 'dots',
      card_corner_style: 'rounded',
      default_card_color: 'yellow',
      show_card_shadows: true,
    },
    updatedAt: 1700000000000,
    viewport: { panX: 200, panY: 150, zoom: 1 },
    cards: [
      {
        id: 'card_grid_welcome',
        type: 'note',
        x: 240,
        y: 192,
        width: 360,
        height: 240,
        title: 'Snap to Grid Board',
        content: 'All cards and modules align to the 24px spatial grid.\n\n• Drag cards by header to snap cleanly to grid lines\n• Resize to snap to grid intervals\n• Switch anytime to "Free Position" in the top bar',
        color: 'yellow',
        zIndex: 1,
      },
    ],
    connections: [],
  },
  brand: {
    id: 'board_brand',
    title: 'Brand Guidelines & Design Tokens',
    description: 'Core brand identity system, color tokens, and nested design specs.',
    parent_board_id: 'board_moodboard',
    is_nested: true,
    boardType: 'snap_grid',
    board_type: 'snap_grid',
    gridDimension: 24,
    grid_dimension: 24,
    board_setting: {
      board_type: 'snap_grid',
      grid_dimension: 24,
      color_theme: 'default',
      grid_style: 'dots',
      card_corner_style: 'rounded',
      default_card_color: 'slate',
      show_card_shadows: true,
    },
    updatedAt: 1700000000000,
    viewport: { panX: 120, panY: 100, zoom: 1 },
    cards: [
      {
        id: 'card_brand_h1',
        type: 'heading',
        x: 96,
        y: 96,
        width: 384,
        height: 96,
        title: 'Brand Architecture',
        content: 'Design system tokens & foundations',
        color: 'white',
        zIndex: 1,
      },
      {
        id: 'card_brand_note1',
        type: 'note',
        x: 96,
        y: 216,
        width: 336,
        height: 200,
        title: 'Spatial Principles',
        content: '• 24px spatial alignment scale\n• High contrast typographic rhythm\n• Visual cards act as self-contained atomic units\n• Nested boards enable infinite hierarchical organization',
        color: 'yellow',
        zIndex: 2,
      },
      {
        id: 'card_brand_sub_typo',
        type: 'board',
        x: 456,
        y: 216,
        width: 360,
        height: 220,
        title: 'Typography & Type Scale',
        description: 'Multi-nested board detailing font pairings, line heights, and weights.',
        target_board_id: 'board_typography',
        color: 'purple',
        zIndex: 3,
      },
      {
        id: 'card_brand_palette_1',
        type: 'palette',
        x: 96,
        y: 440,
        width: 384,
        height: 256,
        title: 'Primary Brand Color Tokens',
        description: 'Core brand identity palette & design system foundations',
        color_format: 'hex',
        palette_layout: 'chips',
        colors: [
          { id: 'cb1', hex: '#14213D', name: 'Midnight Indigo', role: 'Primary' },
          { id: 'cb2', hex: '#3A506B', name: 'Slate Wave', role: 'Secondary' },
          { id: 'cb3', hex: '#E5A93C', name: 'Raw Ochre', role: 'Accent' },
          { id: 'cb4', hex: '#E0DDCF', name: 'Washi Paper', role: 'Neutral' },
          { id: 'cb5', hex: '#FAF8F5', name: 'Pure Chalk', role: 'Base' },
        ],
        color: 'white',
        zIndex: 4,
      },
    ],
    connections: [],
  },
  typography: {
    id: 'board_typography',
    title: 'Typography & Type Scale',
    description: 'Multi-nested board detailing font pairings, line heights, and weights.',
    parent_board_id: 'board_brand',
    is_nested: true,
    boardType: 'snap_grid',
    board_type: 'snap_grid',
    gridDimension: 24,
    grid_dimension: 24,
    board_setting: {
      board_type: 'snap_grid',
      grid_dimension: 24,
      color_theme: 'default',
      grid_style: 'dots',
      card_corner_style: 'rounded',
      default_card_color: 'green',
      show_card_shadows: true,
    },
    updatedAt: 1700000000000,
    viewport: { panX: 120, panY: 100, zoom: 1 },
    cards: [
      {
        id: 'card_typo_h1',
        type: 'heading',
        x: 96,
        y: 96,
        width: 384,
        height: 96,
        title: 'Typography System',
        content: 'Nested 2-levels deep inside Brand Guidelines',
        color: 'purple',
        zIndex: 1,
      },
      {
        id: 'card_typo_note',
        type: 'note',
        x: 96,
        y: 216,
        width: 360,
        height: 200,
        title: 'Display & Body Fonts',
        content: '• Display Headings: Plus Jakarta Sans / Inter SemiBold\n• Body Text: Inter Regular, 13px baseline\n• Code / Badges: JetBrains Mono / SF Mono\n• Micro Labels: 11px uppercase tabular',
        color: 'green',
        zIndex: 2,
      },
    ],
    connections: [],
  },
};

export const BOARD_TEMPLATES = Object.fromEntries(
  Object.entries(RAW_BOARD_TEMPLATES).map(([key, tpl]) => [key, build_board_export_payload(tpl)])
);

// Boards directory signal (always fetched directly from PostgreSQL /api/boards)
export const boardsDirectorySignal = signal([]);
export const isBoardsDirectoryLoadingSignal = signal(false);

export function normalize_board_sharing(raw_sharing) {
  const src = raw_sharing && typeof raw_sharing === 'object' ? raw_sharing : {};
  const is_public =
    src.visibility === 'public' ||
    src.general_access === 'anyone_with_link' ||
    src.is_public === true;
  const visibility = is_public ? 'public' : 'private';
  const general_access = is_public ? 'anyone_with_link' : 'restricted';
  const valid_roles = ['viewer', 'commenter', 'editor'];
  const raw_role = String(src.public_role || src.role || 'viewer').toLowerCase();
  const public_role = valid_roles.includes(raw_role) ? raw_role : 'viewer';
  const allow_editors_to_share = src.allow_editors_to_share !== false;
  const allow_viewers_to_copy = src.allow_viewers_to_copy !== false;
  const raw_users = Array.isArray(src.shared_users) ? src.shared_users : [];
  const seen = new Set();
  const shared_users = raw_users
    .map((u) => {
      if (!u || typeof u !== 'object') return null;
      const acc = u.user_account ? String(u.user_account).trim() : '';
      const email = u.email ? String(u.email).trim().toLowerCase() : '';
      const key = (acc || email).toLowerCase();
      if (!key || seen.has(key)) return null;
      seen.add(key);
      const u_role_raw = String(u.role || 'viewer').toLowerCase();
      const u_role = valid_roles.includes(u_role_raw) ? u_role_raw : 'viewer';
      return {
        id: u.id || `share_${key}`,
        user_account: acc || (email ? email.split('@')[0] : ''),
        email: email || (acc.includes('@') ? acc : `${acc}@mysuperid.com`),
        name: u.name || acc || email,
        avatar: u.avatar || null,
        color: u.color || '#2563eb',
        role: u_role,
        added_at: u.added_at || Date.now(),
        added_by: u.added_by || null,
      };
    })
    .filter(Boolean);

  return {
    visibility,
    general_access,
    public_role,
    allow_editors_to_share,
    allow_viewers_to_copy,
    shared_users,
  };
}

export function resolve_board_access(board, user_account = null, user_email = null) {
  if (!board) {
    return {
      allowed: false,
      role: 'none',
      can_view: false,
      can_comment: false,
      can_edit: false,
      can_manage_sharing: false,
    };
  }
  const auth_payload = get_lumen_auth_payload();
  let raw_acc = user_account;
  let raw_email = user_email;
  if (user_account && typeof user_account === 'object') {
    raw_acc = user_account.user_account || user_account.account_handle || user_account.id;
    raw_email = user_account.user_primary_email || user_account.email || user_email;
  }
  const req_acc = (raw_acc !== null && raw_acc !== undefined ? raw_acc : auth_payload?.user_account)
    ? String(raw_acc !== null && raw_acc !== undefined ? raw_acc : auth_payload?.user_account).trim()
    : null;
  const req_email = (raw_email !== null && raw_email !== undefined ? raw_email : auth_payload?.user_primary_email)
    ? String(raw_email !== null && raw_email !== undefined ? raw_email : auth_payload?.user_primary_email).trim().toLowerCase()
    : null;
  const owner_acc = board.user_account ? String(board.user_account).trim() : null;
  const raw_sharing = board.sharing || board.board_setting?.sharing;
  const sharing = normalize_board_sharing(raw_sharing);

  // 1. Owner always has full access to their own board (public or private)
  if (owner_acc && req_acc && owner_acc.toLowerCase() === req_acc.toLowerCase()) {
    return {
      allowed: true,
      role: 'owner',
      can_view: true,
      can_comment: true,
      can_edit: true,
      can_manage_sharing: true,
    };
  }

  // 2. Private board: strictly ONLY the board owner can access it
  if (sharing.visibility !== 'public') {
    const explicitly_private =
      raw_sharing &&
      typeof raw_sharing === 'object' &&
      (raw_sharing.visibility === 'private' || raw_sharing.general_access === 'restricted');
    if (owner_acc || explicitly_private) {
      return {
        allowed: false,
        role: 'none',
        can_view: false,
        can_comment: false,
        can_edit: false,
        can_manage_sharing: false,
      };
    }
    // Unowned default seed board not marked private
    return {
      allowed: true,
      role: 'owner',
      can_view: true,
      can_comment: true,
      can_edit: true,
      can_manage_sharing: true,
    };
  }

  // 3. Public board: everyone can access according to public_role (or higher shared_users role)
  const role_rank = {
    none: 0,
    viewer: 1,
    commenter: 2,
    editor: 3,
    owner: 4,
  };

  let matched_role = 'none';
  if (req_acc || req_email) {
    const matched = sharing.shared_users.find((u) => {
      if (!u) return false;
      const u_acc = (u.user_account || '').toLowerCase();
      const u_mail = (u.email || '').toLowerCase();
      if (req_acc && (u_acc === req_acc.toLowerCase() || u_mail === req_acc.toLowerCase())) {
        return true;
      }
      if (req_email && (u_mail === req_email || u_acc === req_email)) {
        return true;
      }
      return false;
    });
    if (matched && matched.role) {
      matched_role = matched.role;
    }
  }

  const link_role = sharing.public_role || 'viewer';
  const effective_role =
    (role_rank[matched_role] || 0) >= (role_rank[link_role] || 0)
      ? matched_role
      : link_role;

  return {
    allowed: true,
    role: effective_role,
    can_view: true,
    can_comment: effective_role === 'commenter' || effective_role === 'editor',
    can_edit: effective_role === 'editor',
    can_manage_sharing: effective_role === 'editor' && sharing.allow_editors_to_share !== false,
  };
}

export function normalize_board_meta(b) {
  if (!b || typeof b !== 'object') return null;
  const parsed_setting = typeof b.board_setting === 'string'
    ? (() => { try { return JSON.parse(b.board_setting); } catch (e) { return {}; } })()
    : (b.board_setting || {});
  const id = b.id || b.board_code;
  if (!id) return null;
  const title = b.title || b.board_name || 'Untitled Board';
  const description = b.description !== undefined && b.description !== null
    ? b.description
    : (b.board_description || '');
  const b_type = b.boardType || b.board_type || parsed_setting.board_type || parsed_setting.boardType || 'snap_grid';
  const g_dim = Number(b.gridDimension || b.grid_dimension || parsed_setting.grid_dimension || parsed_setting.gridDimension || 24);
  const normalized_sharing = normalize_board_sharing(b.sharing || parsed_setting.sharing);
  const card_count = b.cardCount !== undefined
    ? Number(b.cardCount)
    : b.card_count !== undefined
    ? Number(b.card_count)
    : Array.isArray(b.cards)
    ? b.cards.length
    : Array.isArray(b.board_card)
    ? b.board_card.length
    : 0;
  const updated_at = b.updatedAt
    ? Number(new Date(b.updatedAt).getTime())
    : b.time_modify
    ? Number(new Date(b.time_modify).getTime())
    : b.time_modified
    ? Number(new Date(b.time_modified).getTime())
    : Date.now();
  const created_at = b.createdAt
    ? Number(new Date(b.createdAt).getTime())
    : b.time_create
    ? Number(new Date(b.time_create).getTime())
    : b.time_created
    ? Number(new Date(b.time_created).getTime())
    : updated_at;

  return {
    ...b,
    id,
    board_code: id,
    title,
    board_name: title,
    description,
    board_description: description,
    cardCount: card_count,
    boardType: b_type,
    board_type: b_type,
    gridDimension: g_dim,
    grid_dimension: g_dim,
    board_setting: {
      ...parsed_setting,
      board_type: b_type,
      grid_dimension: g_dim,
      sharing: normalized_sharing,
    },
    sharing: normalized_sharing,
    vendor_code: b.vendor_code || null,
    master_code: b.master_code || null,
    project_code: b.project_code || null,
    user_account: b.user_account || null,
    parent_board_id: b.parent_board_id || parsed_setting.parent_board_id || null,
    is_nested: Boolean(b.is_nested || parsed_setting.is_nested),
    createdAt: created_at,
    updatedAt: updated_at,
    time_create: b.time_create || new Date(created_at).toISOString(),
    time_modify: b.time_modify || new Date(updated_at).toISOString(),
  };
}

// Track in-flight board save promises so setActiveBoard / fetchBoardsFromServer wait for creation/save before reading
const pending_board_saves = new Map();

/**
 * Safely parses a Fetch Response as JSON without throwing SyntaxError when an upstream
 * proxy, gateway, or dev server returns an empty body or HTML page.
 */
export async function safe_parse_response_json(res, fallback = null) {
  if (!res) return fallback;
  try {
    const text = await res.text();
    if (!text) return fallback;
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('<')) {
      return fallback;
    }
    return JSON.parse(trimmed);
  } catch (_) {
    return fallback;
  }
}

export async function fetchBoardsFromServer(override_auth) {
  if (typeof fetch === 'undefined') return [];
  if (pending_board_saves.size > 0) {
    await Promise.allSettled(Array.from(pending_board_saves.values()));
  }
  const auth_payload = get_lumen_auth_payload(override_auth);
  const owner_account = auth_payload?.user_account
    ? String(auth_payload.user_account).trim()
    : null;
  if (!owner_account) {
    boardsDirectorySignal.value = [];
    isBoardsDirectoryLoadingSignal.value = false;
    return [];
  }

  isBoardsDirectoryLoadingSignal.value = true;
  try {
    const params = new URLSearchParams();
    params.set('user_account', owner_account);
    if (auth_payload?.vendor_code) params.set('vendor_code', String(auth_payload.vendor_code));
    if (auth_payload?.master_code) params.set('master_code', String(auth_payload.master_code));
    if (auth_payload?.project_code) params.set('project_code', String(auth_payload.project_code));

    const res = await fetch(`/api/boards?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Accept: 'application/json',
        ...get_lumen_auth_headers(override_auth),
      },
    });
    if (res.ok) {
      const data = await safe_parse_response_json(res, null);
      if (data && Array.isArray(data.boards)) {
        const normalized = data.boards
          .map(normalize_board_meta)
          .filter((b) => b && b.user_account === owner_account);
        boardsDirectorySignal.value = normalized;
        isBoardsDirectoryLoadingSignal.value = false;
        return normalized;
      }
    }
  } catch (err) {
    console.warn('[Lumen Boards] Notice fetching boards from server:', err?.message || err);
  }
  isBoardsDirectoryLoadingSignal.value = false;
  return (boardsDirectorySignal.value || []).filter((b) => b && b.user_account === owner_account);
}

if (typeof window !== 'undefined') {
  // Purge legacy localStorage board caches so stale local boards never appear
  try {
    localStorage.removeItem('lumen_workspace_boards_list_v5');
    localStorage.removeItem('lumen_workspace_active_id_v5');
    localStorage.removeItem('lumen_workspace_board_data_v5');
    const stale_keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('lumen_board_') && k.endsWith('_v4')) {
        stale_keys.push(k);
      }
    }
    stale_keys.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
  fetchBoardsFromServer();
}

// Construct an in-memory board shell when needed prior to server response
export const getInitialBoardData = (boardId) => {
  const targetId = boardId || 'board_moodboard';
  const existingMeta = (boardsDirectorySignal.value || []).find(
    (b) => (b.id || b.board_code) === targetId
  );

  const fallback_b_type = existingMeta?.boardType || 'snap_grid';
  const fallback_grid_dim = Number(existingMeta?.gridDimension || 24);
  return {
    id: targetId,
    board_code: targetId,
    title: existingMeta?.title || 'Untitled Board',
    board_name: existingMeta?.title || 'Untitled Board',
    description: existingMeta?.description || '',
    board_description: existingMeta?.description || '',
    boardType: fallback_b_type,
    board_type: fallback_b_type,
    gridDimension: fallback_grid_dim,
    grid_dimension: fallback_grid_dim,
    board_setting: existingMeta?.board_setting || {
      board_type: fallback_b_type,
      grid_dimension: fallback_grid_dim,
      color_theme: 'default',
      grid_style: 'dots',
      card_corner_style: 'rounded',
      default_card_color: 'yellow',
      show_card_shadows: true,
    },
    parent_board_id: existingMeta?.parent_board_id || null,
    is_nested: Boolean(existingMeta?.is_nested),
    updatedAt: existingMeta?.updatedAt || Date.now(),
    viewport: existingMeta?.viewport || { panX: 100, panY: 100, zoom: 1 },
    cards: [],
    connections: [],
    drawings: [],
  };
};

export const getBoardDataById = (boardId) => {
  if (!boardId) return null;
  if (activeBoardSignal.value?.id === boardId) {
    return activeBoardSignal.value;
  }
  return getInitialBoardData(boardId);
};

export const getBoardAncestors = (boardId) => {
  const ancestors = [];
  let currentId = boardId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const boardMeta = (boardsDirectorySignal.value || []).find((b) => b.id === currentId);
    const boardData = getBoardDataById(currentId);
    const parentId = boardData?.parent_board_id || boardMeta?.parent_board_id;

    if (!parentId || parentId === currentId) break;

    const parentMeta = (boardsDirectorySignal.value || []).find((b) => b.id === parentId);
    const parentData = getBoardDataById(parentId);
    ancestors.unshift({
      id: parentId,
      title: parentMeta?.title || parentData?.title || 'Parent Board',
    });

    currentId = parentId;
  }

  return ancestors;
};

// Active board ID signal (null if no board is selected / active)
export const activeBoardIdSignal = signal(null);

// Server synchronization tracking signals
export const lastServerSyncTimeSignal = signal(Date.now());
export const isServerSyncingSignal = signal(false);
export const serverSyncStatusSignal = signal('synced'); // 'synced' | 'syncing' | 'error'
export const boardSizeBytesSignal = signal(0);

// Debounce timer for server synchronization (avoids network flooding on 1MB+ boards)
let server_sync_timeout_id = null;
let local_storage_debounce_id = null;
let board_save_sequence_counter = 0;
const latest_board_save_seq = new Map();

// Track cards currently being dragged/resized and recent local geometry (x, y, width, height) edit timestamps
export const active_interacting_card_ids_set = new Set();
export const last_local_card_geom_edit_map = new Map();
export const last_local_card_content_edit_map = new Map();
const pending_card_patch_timers = new Map();
const pending_card_patch_accumulators = new Map();

export function has_pending_local_board_save() {
  return Boolean(
    server_sync_timeout_id ||
      isServerSyncingSignal.value ||
      pending_board_saves.size > 0 ||
      pending_card_patch_timers.size > 0 ||
      active_interacting_card_ids_set.size > 0
  );
}

export function schedule_card_patch_on_server(card_id, updates, immediate = false) {
  if (!card_id || !updates || deleted_card_ids_set.has(card_id)) return;
  const prev_acc = pending_card_patch_accumulators.get(card_id) || {};
  const next_acc = { ...prev_acc, ...updates };
  if (prev_acc.data && updates.data && typeof prev_acc.data === 'object' && typeof updates.data === 'object') {
    next_acc.data = { ...prev_acc.data, ...updates.data };
  }
  pending_card_patch_accumulators.set(card_id, next_acc);

  if (pending_card_patch_timers.has(card_id)) {
    clearTimeout(pending_card_patch_timers.get(card_id));
    pending_card_patch_timers.delete(card_id);
  }

  const flush_patch = () => {
    pending_card_patch_timers.delete(card_id);
    const payload = pending_card_patch_accumulators.get(card_id);
    pending_card_patch_accumulators.delete(card_id);
    if (payload && !deleted_card_ids_set.has(card_id)) {
      patchCardOnServer(card_id, payload).then((ok) => {
        if (!ok && !deleted_card_ids_set.has(card_id)) {
          saveCurrentBoardToStore();
        }
      }).catch(() => {});
    }
  };

  if (immediate) {
    flush_patch();
  } else {
    const tid = setTimeout(flush_patch, 220);
    pending_card_patch_timers.set(card_id, tid);
  }
}

export function mark_card_interaction_start(card_ids) {
  const ids = Array.isArray(card_ids) ? card_ids : [card_ids];
  const now = Date.now();
  ids.forEach((id) => {
    if (id) {
      active_interacting_card_ids_set.add(id);
      last_local_card_geom_edit_map.set(id, now);
    }
  });
}

export function mark_card_interaction_end(card_ids) {
  const ids = Array.isArray(card_ids) ? card_ids : [card_ids];
  const now = Date.now();
  ids.forEach((id) => {
    if (id) {
      active_interacting_card_ids_set.delete(id);
      last_local_card_geom_edit_map.set(id, now);
    }
  });
}

export function should_preserve_local_card_geometry(card_id, local_card, incoming_card) {
  if (!card_id || !local_card) return false;
  if (active_interacting_card_ids_set.has(card_id)) return true;
  const last_geom_ts = last_local_card_geom_edit_map.get(card_id);
  if (last_geom_ts && Date.now() - last_geom_ts < 8000) return true;
  const local_ts = Number(local_card.updatedAt || 0);
  const incoming_ts = Number(incoming_card?.updatedAt || 0);
  if (local_ts > 0 && incoming_ts > 0 && local_ts > incoming_ts) return true;
  return false;
}

export function apply_preserved_local_geometry(server_card, local_card) {
  if (!local_card || !server_card) return server_card;
  return {
    ...server_card,
    x: local_card.x !== undefined ? local_card.x : server_card.x,
    y: local_card.y !== undefined ? local_card.y : server_card.y,
    width: local_card.width !== undefined ? local_card.width : server_card.width,
    height: local_card.height !== undefined ? local_card.height : server_card.height,
    ...(local_card.column_width !== undefined ? { column_width: local_card.column_width } : {}),
    ...(local_card.user_resized_image_card !== undefined
      ? { user_resized_image_card: local_card.user_resized_image_card }
      : {}),
    ...(local_card.image_note_height !== undefined
      ? { image_note_height: local_card.image_note_height }
      : {}),
    updatedAt: Math.max(Number(local_card.updatedAt || 0), Number(server_card.updatedAt || 0)) || Date.now(),
  };
}

// Active board data signal (always fetched from server, null if no board is selected / active)
export const activeBoardSignal = signal(null);

function execute_local_storage_save(current) {
  if (!current || !current.id) return;
  try {
    // 1. Calculate live serialized byte size
    const size_bytes = calculate_board_size_bytes(current);
    boardSizeBytesSignal.value = size_bytes;

    // 2. Persist to local IndexedDB for immediate recovery across page reloads
    save_board_to_idb(current).catch(() => {});

    // 3. Update directory metadata in memory
    const list = [...boardsDirectorySignal.value];
    const idx = list.findIndex((b) => (b.id || b.board_code) === current.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        title: current.title,
        board_name: current.title,
        description: current.description !== undefined ? current.description : list[idx].description,
        cardCount: (current.cards || []).length,
        updatedAt: current.updatedAt || Date.now(),
      };
      boardsDirectorySignal.value = list;
    }
  } catch (err) {
    console.warn('[Lumen Storage] Metadata update error:', err);
  }
}

export const LAST_ACTIVE_BOARD_STORAGE_KEY = 'lumen_last_active_board_id_v1';
export const server_hydrated_board_ids = new Set();
let active_loading_board_id = null;

export function saveCurrentBoardToStore(options = {}) {
  const current = activeBoardSignal.value;
  if (!current || !current.id) return;
  const target_board_id = current.id;
  if (deleted_board_ids_set.has(target_board_id)) return;
  // Never persist or broadcast a board before its authoritative PostgreSQL state has finished loading
  if (!server_hydrated_board_ids.has(target_board_id) || active_loading_board_id === target_board_id) {
    return;
  }

  // If this save was triggered while applying a remote update or is local-only, update local IndexedDB/directory only
  if (isRemoteUpdateFlag.current || options.localOnly) {
    execute_local_storage_save(current);
    return;
  }

  const should_broadcast_sync = !isRemoteUpdateFlag.current;

  if (options.immediate) {
    if (local_storage_debounce_id) {
      clearTimeout(local_storage_debounce_id);
      local_storage_debounce_id = null;
    }
    execute_local_storage_save(current);
    if (should_broadcast_sync) {
      broadcastBoardSync(current);
    }

    if (server_sync_timeout_id) {
      clearTimeout(server_sync_timeout_id);
      server_sync_timeout_id = null;
    }
    execute_server_save(current);
  } else {
    if (local_storage_debounce_id) {
      clearTimeout(local_storage_debounce_id);
    }
    local_storage_debounce_id = setTimeout(() => {
      local_storage_debounce_id = null;
      const live =
        activeBoardSignal.value && activeBoardSignal.value.id === target_board_id
          ? activeBoardSignal.value
          : current;
      if (!live || !live.id || !server_hydrated_board_ids.has(live.id)) return;
      execute_local_storage_save(live);
      if (should_broadcast_sync && !isRemoteUpdateFlag.current && activeBoardSignal.value?.id === target_board_id) {
        broadcastBoardSync(live);
      }
    }, 120);

    // Network Sync: debounced by 500ms to avoid network thrashing
    if (server_sync_timeout_id) {
      clearTimeout(server_sync_timeout_id);
    }
    server_sync_timeout_id = setTimeout(() => {
      server_sync_timeout_id = null;
      const live =
        activeBoardSignal.value && activeBoardSignal.value.id === target_board_id
          ? activeBoardSignal.value
          : current;
      if (!live || !live.id || !server_hydrated_board_ids.has(live.id)) return;
      execute_server_save(live);
    }, 500);
  }
}

if (typeof window !== 'undefined') {
  const flush_pending_board_save_on_unload = () => {
    if (server_sync_timeout_id) {
      clearTimeout(server_sync_timeout_id);
      server_sync_timeout_id = null;
      const live = activeBoardSignal.value;
      if (live && live.id && server_hydrated_board_ids.has(live.id) && !deleted_board_ids_set.has(live.id)) {
        execute_local_storage_save(live);
        execute_server_save(live);
      }
    }
  };
  window.addEventListener('beforeunload', flush_pending_board_save_on_unload);
  window.addEventListener('pagehide', flush_pending_board_save_on_unload);
}

async function sanitize_cards_for_server_sync(raw_cards) {
  if (!Array.isArray(raw_cards)) return [];
  return Promise.all(
    raw_cards.map(async (card) => {
      let enc = card.card_encryption || card.cardEncryption;
      const is_encrypted = Boolean(
        enc && (
          (typeof enc === 'object' && enc.ciphertext) ||
          (typeof enc === 'string' && enc.includes('ciphertext'))
        )
      );

      if (is_encrypted) {
        // If the card is currently unlocked in author's session, re-encrypt latest edits using session passkey
        const session = unlockedCardsSignal.value[card.id];
        if (session?.passkey) {
          try {
            const sensitive_payload = extract_sensitive_card_payload(card);
            const hint = enc?.passkey_hint || enc?.hint || session.passkey_hint || '';
            enc = await encrypt_card_data(sensitive_payload, session.passkey, hint);
            // Also update in-memory card's encryption metadata
            card.card_encryption = enc;
            card.cardEncryption = enc;
          } catch (e) {
            console.warn('[Lumen Server Sync] Notice re-encrypting card before sync:', e);
          }
        }

        // STRICT ZERO-DATA-LEAK: Zero out all plaintext fields for the server payload!
        const safe_data = typeof card.data === 'object' && card.data !== null && !Array.isArray(card.data)
          ? { ...card.data }
          : {};
        safe_data.content = '';
        safe_data.items = [];
        safe_data.description = '';
        safe_data.notes = '';
        safe_data.url = '';
        safe_data.destinations = [];
        safe_data.canvas_strokes = [];

        return {
          ...card,
          content: '',
          data: safe_data,
          items: [],
          description: '',
          notes: '',
          url: '',
          destinations: [],
          canvas_strokes: [],
          card_encryption: enc,
          cardEncryption: enc,
          is_encryption_unlocked: false,
        };
      }

      // Normal unencrypted card
      const content = card.content !== undefined 
        ? String(card.content) 
        : (card.data?.content !== undefined ? String(card.data.content) : '');
      const data = typeof card.data === 'object' && card.data !== null && !Array.isArray(card.data)
        ? { ...card.data }
        : {};
      data.content = content;
      return {
        ...card,
        content,
        data,
      };
    })
  );
}

// Client-side tombstone sets to prevent in-flight saves or IndexedDB hydration from restoring deleted boards/cards
export const deleted_board_ids_set = new Set();
export const deleted_card_ids_set = new Set();

async function execute_server_save(current) {
  if (!current || !current.id) return;
  const target_id = current.id;
  if (deleted_board_ids_set.has(target_id)) return;
  const my_seq = ++board_save_sequence_counter;
  latest_board_save_seq.set(target_id, my_seq);
  isServerSyncingSignal.value = true;
  serverSyncStatusSignal.value = 'syncing';

  const save_task = (async () => {
    try {
      if (deleted_board_ids_set.has(target_id)) return;
      // Always read the freshest activeBoardSignal state if still on the same board
      const freshest =
        activeBoardSignal.value && activeBoardSignal.value.id === target_id
          ? activeBoardSignal.value
          : current;
      const raw_cards = (Array.isArray(freshest.cards)
        ? freshest.cards
        : Array.isArray(freshest.board_card)
        ? freshest.board_card
        : []
      ).filter((c) => c && !deleted_card_ids_set.has(c.id));
      const normalized_cards = await sanitize_cards_for_server_sync(raw_cards);

      if (deleted_board_ids_set.has(target_id)) return;

      // Re-apply any local geometry changes that happened while async encryption/sanitization ran,
      // and filter out any cards that were deleted while encryption/sanitization was running!
      const live_board =
        activeBoardSignal.value && activeBoardSignal.value.id === target_id
          ? activeBoardSignal.value
          : freshest;
      const is_still_active_board =
        activeBoardSignal.value && activeBoardSignal.value.id === target_id;
      const live_cards_map = new Map(
        (live_board.cards || []).map((c) => [c.id, c])
      );
      const fresh_normalized_cards = normalized_cards
        .filter((nc) => {
          if (!nc || deleted_card_ids_set.has(nc.id)) return false;
          if (is_still_active_board && !live_cards_map.has(nc.id)) return false;
          return true;
        })
        .map((nc) => {
          const live_c = live_cards_map.get(nc.id);
          if (live_c && should_preserve_local_card_geometry(nc.id, live_c, nc)) {
            return apply_preserved_local_geometry(nc, live_c);
          }
          return nc;
        });

      // If a newer save was already started or board was deleted while we prepared this one, abort sending stale snapshot
      if ((latest_board_save_seq.get(target_id) || 0) > my_seq || deleted_board_ids_set.has(target_id)) {
        return;
      }

      const auth_payload = get_lumen_auth_payload();
      const current_drawings = Array.isArray(live_board.drawings)
        ? live_board.drawings
        : Array.isArray(live_board.board_drawing)
        ? live_board.board_drawing
        : [];
      const current_connections = Array.isArray(live_board.connections)
        ? live_board.connections
        : Array.isArray(live_board.board_connection)
        ? live_board.board_connection
        : Array.isArray(live_board.board_conenctions)
        ? live_board.board_conenctions
        : [];

      const resolved_title =
        live_board.title !== undefined && String(live_board.title).trim() !== ''
          ? String(live_board.title)
          : live_board.board_name || 'Untitled Board';
      const resolved_desc =
        live_board.description !== undefined
          ? String(live_board.description)
          : live_board.board_description || '';

      const now_ms = Date.now();
      const now_iso = new Date(now_ms).toISOString();
      const payload = {
        ...live_board,
        title: resolved_title,
        board_name: resolved_title,
        description: resolved_desc,
        board_description: resolved_desc,
        vendor_code: auth_payload?.vendor_code || live_board.vendor_code || null,
        master_code: auth_payload?.master_code || live_board.master_code || null,
        project_code: auth_payload?.project_code || live_board.project_code || null,
        user_account: auth_payload?.user_account || live_board.user_account || null,
        lumen_auth: auth_payload,
        cards: fresh_normalized_cards,
        board_card: fresh_normalized_cards,
        drawings: current_drawings,
        board_drawing: current_drawings,
        connections: current_connections,
        board_connection: current_connections,
        board_conenctions: current_connections,
        updatedAt: now_ms,
        time_modify: now_iso,
        time_modified: now_iso,
      };

      // Sync to production PostgreSQL backend
      if (typeof fetch !== 'undefined') {
        const res = await fetch(`/api/boards/${encodeURIComponent(payload.id)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...get_lumen_auth_headers(),
          },
          body: JSON.stringify({
            board: payload,
            lumen_auth: auth_payload,
            deleted_card_ids: Array.from(deleted_card_ids_set),
          }),
        });
        if (res.ok && latest_board_save_seq.get(target_id) === my_seq) {
          const json = await safe_parse_response_json(res, null);
          lastServerSyncTimeSignal.value = json?.syncedAt || Date.now();
          if (json?.sizeBytes) {
            boardSizeBytesSignal.value = json.sizeBytes;
          }
          // If server merged any concurrent cards created/updated by another user in PostgreSQL, reconcile them locally
          if (
            json?.board &&
            Array.isArray(json.board.cards) &&
            activeBoardSignal.value &&
            activeBoardSignal.value.id === target_id
          ) {
            const local_cards = activeBoardSignal.value.cards || [];
            const local_map = new Map(local_cards.map((c) => [c.id, c]));
            let has_remote_diff = false;
            const reconciled_cards = [...local_cards];
            for (const sc of json.board.cards) {
              if (!sc || !sc.id || deleted_card_ids_set.has(sc.id)) continue;
              const lc = local_map.get(sc.id);
              if (!lc) {
                reconciled_cards.push(sc);
                has_remote_diff = true;
              } else {
                const sc_ts = Number(sc.updatedAt || 0);
                const lc_ts = Number(lc.updatedAt || 0);
                const recent_edit = last_local_card_content_edit_map.get(sc.id) || 0;
                if (
                  sc_ts > lc_ts + 300 &&
                  Date.now() - recent_edit > 4000 &&
                  !active_interacting_card_ids_set.has(sc.id)
                ) {
                  const idx = reconciled_cards.findIndex((c) => c.id === sc.id);
                  if (idx !== -1) {
                    reconciled_cards[idx] = should_preserve_local_card_geometry(sc.id, lc, sc)
                      ? apply_preserved_local_geometry(sc, lc)
                      : sc;
                    has_remote_diff = true;
                  }
                }
              }
            }
            if (has_remote_diff) {
              const prev_flag = isRemoteUpdateFlag.current;
              isRemoteUpdateFlag.current = true;
              try {
                activeBoardSignal.value = {
                  ...activeBoardSignal.value,
                  cards: reconciled_cards,
                  board_card: reconciled_cards,
                };
                execute_local_storage_save(activeBoardSignal.value);
              } finally {
                isRemoteUpdateFlag.current = prev_flag;
              }
            }
          }
        }
      }

      if (latest_board_save_seq.get(target_id) === my_seq) {
        isServerSyncingSignal.value = false;
        serverSyncStatusSignal.value = 'synced';
        lastServerSyncTimeSignal.value = Date.now();
      }
    } catch (err) {
      console.warn('[Lumen Server Sync] Background sync notice:', err?.message || err);
      if (latest_board_save_seq.get(target_id) === my_seq) {
        isServerSyncingSignal.value = false;
        serverSyncStatusSignal.value = 'error';
      }
    }
  })();

  const tracked_promise = save_task.finally(() => {
    if (pending_board_saves.get(target_id) === tracked_promise) {
      pending_board_saves.delete(target_id);
    }
    if (deleted_board_ids_set.has(target_id)) {
      return;
    }
    const exists_in_dir = (boardsDirectorySignal.value || []).some(
      (b) => b && (b.id === target_id || b.board_code === target_id)
    );
    if (!exists_in_dir) {
      fetchBoardsFromServer();
    }
  });

  pending_board_saves.set(target_id, tracked_promise);
  return tracked_promise;
}

/**
 * Force manual synchronization of the active board to the server and database
 */
export async function forceSyncCurrentBoard() {
  const current = activeBoardSignal.value;
  if (!current || !current.id) return false;

  showToast('Synchronizing board with server...');
  isServerSyncingSignal.value = true;
  serverSyncStatusSignal.value = 'syncing';

  // Cancel any pending debounced auto-sync to avoid race conditions
  if (server_sync_timeout_id) {
    clearTimeout(server_sync_timeout_id);
    server_sync_timeout_id = null;
  }

  try {
    const raw_cards = Array.isArray(current.cards) ? current.cards : (Array.isArray(current.board_card) ? current.board_card : []);
    const normalized_cards = await sanitize_cards_for_server_sync(raw_cards);

    const auth_payload = get_lumen_auth_payload();
    const current_drawings = Array.isArray(current.drawings)
      ? current.drawings
      : (Array.isArray(current.board_drawing) ? current.board_drawing : []);
    const current_connections = Array.isArray(current.connections)
      ? current.connections
      : Array.isArray(current.board_connection)
      ? current.board_connection
      : (Array.isArray(current.board_conenctions) ? current.board_conenctions : []);

    const resolved_title =
      current.title !== undefined && String(current.title).trim() !== ''
        ? String(current.title)
        : current.board_name || 'Untitled Board';
    const resolved_desc =
      current.description !== undefined
        ? String(current.description)
        : current.board_description || '';

    const payload = {
      ...current,
      title: resolved_title,
      board_name: resolved_title,
      description: resolved_desc,
      board_description: resolved_desc,
      vendor_code: auth_payload?.vendor_code || current.vendor_code || null,
      master_code: auth_payload?.master_code || current.master_code || null,
      project_code: auth_payload?.project_code || current.project_code || null,
      user_account: auth_payload?.user_account || current.user_account || null,
      lumen_auth: auth_payload,
      cards: normalized_cards,
      board_card: normalized_cards,
      drawings: current_drawings,
      board_drawing: current_drawings,
      connections: current_connections,
      board_connection: current_connections,
      board_conenctions: current_connections,
      updatedAt: Date.now(),
      time_modify: new Date().toISOString(),
    };

    const size_bytes = calculate_board_size_bytes(payload);
    boardSizeBytesSignal.value = size_bytes;

    // Immediately persist to IndexedDB
    await save_board_to_idb(current);

    // Persist to server backend (PostgreSQL)
    let server_ok = false;
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/api/boards/${encodeURIComponent(payload.id)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({ board: payload, lumen_auth: auth_payload }),
      });
      if (res.ok) {
        server_ok = true;
        const json = await safe_parse_response_json(res, null);
        lastServerSyncTimeSignal.value = json?.syncedAt || Date.now();
        if (json?.board && Array.isArray(json.board.cards)) {
          const merged_cards = json.board.cards.map((server_card) => {
            const local_card = (activeBoardSignal.value.cards || []).find((c) => c.id === server_card.id);
            const session = unlockedCardsSignal.value[server_card.id];
            let base_card = server_card;
            if (local_card && should_preserve_local_card_geometry(server_card.id, local_card, server_card)) {
              base_card = apply_preserved_local_geometry(server_card, local_card);
            }
            if (session || (local_card && local_card.is_encryption_unlocked)) {
              return {
                ...base_card,
                content: local_card?.content || session?.payload?.content || '',
                items: local_card?.items || session?.payload?.items || [],
                description: local_card?.description || session?.payload?.description || '',
                notes: local_card?.notes || session?.payload?.notes || '',
                url: local_card?.url || session?.payload?.url || '',
                data: {
                  ...(base_card.data || {}),
                  content: local_card?.content || session?.payload?.content || '',
                },
                is_encryption_unlocked: true,
              };
            }
            return base_card;
          });

          activeBoardSignal.value = {
            ...activeBoardSignal.value,
            ...json.board,
            cards: merged_cards,
            board_card: merged_cards,
          };
          save_board_to_idb(activeBoardSignal.value).catch(() => {});
        }
        if (json?.sizeBytes) {
          boardSizeBytesSignal.value = json.sizeBytes;
        }
      }
    }

    isServerSyncingSignal.value = false;
    serverSyncStatusSignal.value = 'synced';
    lastServerSyncTimeSignal.value = Date.now();
    showToast(`Board successfully synchronized with PostgreSQL (${format_board_size(size_bytes)})`);
    return true;
  } catch (err) {
    isServerSyncingSignal.value = false;
    serverSyncStatusSignal.value = 'error';
    showToast('Sync warning: saved to local IndexedDB, server offline');
    return false;
  }
}

/**
 * Granular Single-Card Patching (Delta Update):
 * Persists single card changes (position, dimension, content, styling)
 * directly to PostgreSQL board_cards table without reserializing the entire board.
 */
export async function patchCardOnServer(cardId, patch) {
  if (!cardId || !patch || deleted_card_ids_set.has(cardId)) return false;
  const current = activeBoardSignal.value;
  const boardId = current?.id || 'board_moodboard';
  if (deleted_board_ids_set.has(boardId)) return false;

  try {
    const card = (current?.cards || []).find((c) => c.id === cardId);
    let enc = patch.card_encryption || patch.cardEncryption || card?.card_encryption || card?.cardEncryption;
    const is_encrypted = Boolean(
      enc && (
        (typeof enc === 'object' && enc.ciphertext) ||
        (typeof enc === 'string' && enc.includes('ciphertext'))
      )
    );

    let safe_patch = { ...patch };
    if (is_encrypted) {
      const session = unlockedCardsSignal.value[cardId];
      if (session?.passkey && card) {
        try {
          const sensitive_payload = extract_sensitive_card_payload({ ...card, ...patch });
          const hint = enc?.passkey_hint || enc?.hint || session.passkey_hint || '';
          enc = await encrypt_card_data(sensitive_payload, session.passkey, hint);
          safe_patch.card_encryption = enc;
          safe_patch.cardEncryption = enc;
        } catch (e) {
          console.warn('[Lumen Card Delta] Notice re-encrypting card patch:', e);
        }
      }
      safe_patch.content = '';
      if (safe_patch.data && typeof safe_patch.data === 'object' && !Array.isArray(safe_patch.data)) {
        safe_patch.data = { ...safe_patch.data, content: '', items: [], description: '', notes: '', url: '' };
      }
      safe_patch.items = [];
      safe_patch.description = '';
      safe_patch.notes = '';
      safe_patch.url = '';
      safe_patch.destinations = [];
      safe_patch.canvas_strokes = [];
      safe_patch.is_encryption_unlocked = false;
    }

    if (typeof fetch !== 'undefined') {
      const auth_payload = get_lumen_auth_payload();
      const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({ board_id: boardId, lumen_auth: auth_payload, ...safe_patch }),
      });
      if (res.ok) {
        lastServerSyncTimeSignal.value = Date.now();
        return true;
      }
    }
  } catch (err) {
    console.warn('[Lumen Card Delta] Notice updating card:', err);
  }
  return false;
}

/**
 * Spatial Viewport Windowing Query:
 * Queries cards intersecting the user's active screen viewport bounding box
 * from the normalized PostgreSQL board_cards table.
 */
export async function fetchCardsInViewport(boardId, bounds, padding = 400) {
  if (!boardId || !bounds) return null;
  try {
    const params = new URLSearchParams({
      min_x: String(Math.round(bounds.min_x)),
      max_x: String(Math.round(bounds.max_x)),
      min_y: String(Math.round(bounds.min_y)),
      max_y: String(Math.round(bounds.max_y)),
      padding: String(padding),
    });
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/cards?${params.toString()}`, {
      headers: {
        ...get_lumen_auth_headers(),
      },
    });
    if (res.ok) {
      const json = await safe_parse_response_json(res, null);
      return json;
    }
  } catch (err) {
    console.warn('[Lumen Spatial Viewport] Query notice:', err);
  }
  return null;
}

// UI state signals (transient, non-persisted)
export const selectedCardsSignal = signal([]); // array of card IDs
export const activeToolSignal = signal('select'); // 'select' | 'hand' | 'connect'
export const isDraggingCanvasSignal = signal(false);
export const connectingSourceSignal = signal(null); // card ID being connected from
export const tempConnectionLineSignal = signal(null); // { x1, y1, x2, y2 }
export const snapToGridSignal = signal(true);
export const showGridDotsSignal = signal(true);
export const isExportModalOpenSignal = signal(false);
export const isTemplateModalOpenSignal = signal(false);
export const isShareModalOpenSignal = signal(false);
export const isBoardSettingsModalOpenSignal = signal(false);
// Don't auto show card property on mobile and small screen size (width <= 1024px)
const get_initial_property_panel_open = () => {
  if (typeof window !== 'undefined') {
    if (window.innerWidth <= 1024) {
      return false;
    }
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumen_auto_open_properties');
      if (saved !== null) {
        return saved === 'true';
      }
    }
  } catch (e) {}
  return true;
};

export const isPropertyPanelOpenSignal = signal(get_initial_property_panel_open());
export const activeDropTargetGroupIdSignal = signal(null); // Group ID currently hovered as drop target

export const openBoardSettingsModal = () => {
  isBoardSettingsModalOpenSignal.value = true;
};

export const closeBoardSettingsModal = () => {
  isBoardSettingsModalOpenSignal.value = false;
};

export const toggleBoardSettingsModal = () => {
  isBoardSettingsModalOpenSignal.value = !isBoardSettingsModalOpenSignal.value;
};

// Share & Collaboration Access Signals
export const shareAccessRoleSignal = persist(
  signal('edit'), // 'view' | 'comment' | 'edit'
  'lumen_share_access_role_v1'
);

export const shareGeneralAccessSignal = persist(
  signal('anyone_with_link'), // 'anyone_with_link' | 'restricted'
  'lumen_share_general_access_v1'
);

export const boardPublicPublishedSignal = persist(
  signal(false),
  'lumen_board_public_published_v1'
);

export const invitedCollaboratorsSignal = persist(
  signal([
    {
      id: 'invite_1',
      name: 'Elena Rostova',
      email: 'elena.rostova@lumen.studio',
      role: 'owner',
      avatar: 'ER',
      color: '#6366f1',
      status: 'active',
    },
    {
      id: 'invite_2',
      name: 'Alex Rivers',
      email: 'alex.rivers@lumen.studio',
      role: 'editor',
      avatar: 'AR',
      color: '#2563eb',
      status: 'active',
    },
    {
      id: 'invite_3',
      name: 'Marcus Chen',
      email: 'marcus.chen@lumen.studio',
      role: 'editor',
      avatar: 'MC',
      color: '#0d9488',
      status: 'active',
    },
    {
      id: 'invite_4',
      name: 'Sophia Vance',
      email: 'sophia.vance@lumen.studio',
      role: 'commenter',
      avatar: 'SV',
      color: '#d97706',
      status: 'active',
    },
  ]),
  'lumen_invited_collaborators_v1'
);

export const shareModalTargetBoardIdSignal = signal(null);
export const boardAccessDeniedSignal = signal(null);
export const boardNotFoundSignal = signal(null);

export const openShareModal = (targetBoardId = null) => {
  shareModalTargetBoardIdSignal.value =
    (typeof targetBoardId === 'string' && targetBoardId)
      ? targetBoardId
      : (activeBoardSignal.value?.id || activeBoardIdSignal.value || null);
  isShareModalOpenSignal.value = true;
};

export const closeShareModal = () => {
  isShareModalOpenSignal.value = false;
  shareModalTargetBoardIdSignal.value = null;
};

export const toggleShareModal = () => {
  if (isShareModalOpenSignal.value) {
    closeShareModal();
  } else {
    openShareModal();
  }
};

export async function updateBoardSharing(targetBoardId, sharingUpdates) {
  const boardId =
    targetBoardId ||
    shareModalTargetBoardIdSignal.value ||
    activeBoardSignal.value?.id ||
    activeBoardIdSignal.value;
  if (!boardId) return null;

  const activeBoard = activeBoardSignal.value?.id === boardId ? activeBoardSignal.value : null;
  const dirBoard = (boardsDirectorySignal.value || []).find(
    (b) => (b.id || b.board_code) === boardId
  );
  const currentSharing = normalize_board_sharing(
    activeBoard?.sharing ||
    activeBoard?.board_setting?.sharing ||
    dirBoard?.sharing ||
    dirBoard?.board_setting?.sharing
  );

  const mergedInput = {
    ...currentSharing,
    ...(sharingUpdates || {}),
  };
  if (sharingUpdates?.visibility === 'public' && !sharingUpdates?.general_access) {
    mergedInput.general_access = 'anyone_with_link';
  } else if (sharingUpdates?.visibility === 'private' && !sharingUpdates?.general_access) {
    mergedInput.general_access = 'restricted';
  } else if (sharingUpdates?.general_access === 'anyone_with_link' && !sharingUpdates?.visibility) {
    mergedInput.visibility = 'public';
  } else if (sharingUpdates?.general_access === 'restricted' && !sharingUpdates?.visibility) {
    mergedInput.visibility = 'private';
  }

  const nextSharing = normalize_board_sharing(mergedInput);

  batch(() => {
    if (activeBoardSignal.value && (activeBoardSignal.value.id === boardId || activeBoardSignal.value.board_code === boardId)) {
      const curSetting = activeBoardSignal.value.board_setting || {};
      activeBoardSignal.value = {
        ...activeBoardSignal.value,
        sharing: nextSharing,
        board_setting: {
          ...curSetting,
          sharing: nextSharing,
        },
        updatedAt: Date.now(),
      };
    }

    const list = [...(boardsDirectorySignal.value || [])];
    const idx = list.findIndex((b) => (b.id || b.board_code) === boardId);
    if (idx !== -1) {
      const curDirSetting = list[idx].board_setting || {};
      list[idx] = {
        ...list[idx],
        sharing: nextSharing,
        board_setting: {
          ...curDirSetting,
          sharing: nextSharing,
        },
        updatedAt: Date.now(),
      };
      boardsDirectorySignal.value = list;
    }
  });

  if (typeof fetch !== 'undefined') {
    try {
      const auth_payload = get_lumen_auth_payload();
      const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          sharing: nextSharing,
          lumen_auth: auth_payload,
        }),
      });
      if (res.ok) {
        const json = await safe_parse_response_json(res, null);
        lastServerSyncTimeSignal.value = Date.now();
        return json?.sharing || nextSharing;
      }
    } catch (err) {
      console.warn('[Lumen Sharing] Failed to sync sharing settings:', err);
    }
  }
  return nextSharing;
}

// Layer Panel & Board Settings Panel Signals (Left Sidebar — closed by default when opening app/board)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('lumen_layer_panel_open_v1');
  } catch (e) {}
}

export const isLayerPanelOpenSignal = signal(false);

export const isBoardSettingsPanelOpenSignal = signal(false);

export const openLayerPanel = () => {
  isLayerPanelOpenSignal.value = true;
  isBoardSettingsPanelOpenSignal.value = false;
};

export const closeLayerPanel = () => {
  isLayerPanelOpenSignal.value = false;
};

export const toggleLayerPanel = () => {
  if (isLayerPanelOpenSignal.value) {
    isLayerPanelOpenSignal.value = false;
  } else {
    isLayerPanelOpenSignal.value = true;
    isBoardSettingsPanelOpenSignal.value = false;
  }
};

export const openBoardSettingsPanel = () => {
  isBoardSettingsPanelOpenSignal.value = true;
  isLayerPanelOpenSignal.value = false;
};

export const closeBoardSettingsPanel = () => {
  isBoardSettingsPanelOpenSignal.value = false;
};

export const toggleBoardSettingsPanel = () => {
  if (isBoardSettingsPanelOpenSignal.value) {
    isBoardSettingsPanelOpenSignal.value = false;
  } else {
    isBoardSettingsPanelOpenSignal.value = true;
    isLayerPanelOpenSignal.value = false;
  }
};

// Board Tag Filter Signal (Multi-User Label Filter)
export const activeTagFilterSignal = signal(null);
export const setTagFilter = (tag) => {
  const current = activeTagFilterSignal.value;
  activeTagFilterSignal.value = current === tag ? null : tag;
};
export const clearTagFilter = () => {
  activeTagFilterSignal.value = null;
};

// Board Time Range Filter Signal (Event / Due Date Filter)
// mode: 'all' | 'has_time' | 'active_now' | 'today' | 'upcoming' | 'overdue' | 'synced_gcal' | 'custom'
export const activeTimeRangeFilterSignal = signal({
  mode: 'all',
  start: '01-01-2027 00:00:00',
  end: '01-01-2027 00:00:00',
});

export const setTimeRangeFilter = (next_filter) => {
  if (!next_filter) {
    activeTimeRangeFilterSignal.value = {
      mode: 'all',
      start: '01-01-2027 00:00:00',
      end: '01-01-2027 00:00:00',
    };
    return;
  }
  if (typeof next_filter === 'string') {
    const current_mode = activeTimeRangeFilterSignal.value?.mode || 'all';
    const resolved_mode =
      current_mode === next_filter && next_filter !== 'custom' ? 'all' : next_filter;
    activeTimeRangeFilterSignal.value = {
      ...(activeTimeRangeFilterSignal.value || {}),
      mode: resolved_mode,
    };
    return;
  }
  activeTimeRangeFilterSignal.value = {
    ...(activeTimeRangeFilterSignal.value || {
      mode: 'all',
      start: '01-01-2027 00:00:00',
      end: '01-01-2027 00:00:00',
    }),
    ...next_filter,
  };
};

export const clearTimeRangeFilter = () => {
  activeTimeRangeFilterSignal.value = {
    mode: 'all',
    start: '01-01-2027 00:00:00',
    end: '01-01-2027 00:00:00',
  };
};

// Auto-open Card Properties preference on wide screens
const get_initial_auto_open = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumen_auto_open_properties');
      if (saved !== null) return saved === 'true';
    }
  } catch (e) {}
  return true;
};

export const isAutoOpenPropertyEnabledSignal = signal(get_initial_auto_open());

export const toggleAutoOpenProperty = () => {
  const next_val = !isAutoOpenPropertyEnabledSignal.value;
  isAutoOpenPropertyEnabledSignal.value = next_val;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumen_auto_open_properties', String(next_val));
    }
  } catch (e) {}
  return next_val;
};

export const openPropertyPanel = (force = false) => {
  // If explicitly requested (e.g. clicking card property button), open unconditionally
  if (force) {
    isPropertyPanelOpenSignal.value = true;
    return;
  }

  // Don't auto show card property on mobile and small screen size (width <= 1024px)
  if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
    return;
  }

  // For wide screen, respect the auto open card property switch button
  if (!isAutoOpenPropertyEnabledSignal.value) {
    return;
  }

  isPropertyPanelOpenSignal.value = true;
};

export const closePropertyPanel = () => {
  isPropertyPanelOpenSignal.value = false;
};

export const togglePropertyPanel = () => {
  isPropertyPanelOpenSignal.value = !isPropertyPanelOpenSignal.value;
};

export const toggleCardPropertyPanel = (cardId) => {
  if (!cardId) {
    togglePropertyPanel();
    return;
  }
  const is_open = Boolean(isPropertyPanelOpenSignal.value);
  const current_selected = selectedCardsSignal.value || [];
  const is_currently_selected = current_selected.includes(cardId);

  // If property panel is already open and this card is selected, close it
  if (is_open && is_currently_selected) {
    isPropertyPanelOpenSignal.value = false;
  } else {
    selectedCardsSignal.value = [cardId];
    isPropertyPanelOpenSignal.value = true;
  }
};
export const imageViewerSignal = signal({
  isOpen: false,
  cardId: null,
  title: '',
  slides: [],
  activeIndex: 0,
  initialMode: 'fit',
});

export const openImageViewer = ({ cardId, title, slides, activeIndex = 0, initialMode = 'fit' }) => {
  imageViewerSignal.value = {
    isOpen: true,
    cardId: cardId || null,
    title: title || 'Image Viewer',
    slides: Array.isArray(slides) ? slides : [],
    activeIndex: Math.max(0, activeIndex),
    initialMode: initialMode || 'fit',
  };
};

export const closeImageViewer = () => {
  imageViewerSignal.value = {
    ...imageViewerSignal.value,
    isOpen: false,
  };
};

export const fileViewerModalSignal = signal({
  isOpen: false,
  cardId: null,
  fileName: '',
  fileType: '',
  fileUrl: '',
  fileSize: 0,
  fileExtension: '',
  fileData: null,
  content: '',
});

export const openFileViewerModal = (fileData) => {
  fileViewerModalSignal.value = {
    ...fileData,
    isOpen: true,
    cardId: fileData?.cardId || null,
    fileName: fileData?.fileName || fileData?.title || 'File Preview',
    fileType: fileData?.fileType || '',
    fileUrl: fileData?.fileUrl || '',
    viewUrl: fileData?.viewUrl || fileData?.fileUrl || '',
    fileSize: fileData?.fileSize || 0,
    fileExtension: fileData?.fileExtension || (fileData?.fileName ? fileData.fileName.split('.').pop() : ''),
    fileData: fileData?.fileData || null,
    content: fileData?.content || '',
    is_fullscreen: fileData?.is_fullscreen !== undefined ? Boolean(fileData.is_fullscreen) : true,
    initial_page: fileData?.initial_page || 1,
  };
};

export const closeFileViewerModal = () => {
  fileViewerModalSignal.value = {
    isOpen: false,
    cardId: null,
    fileName: '',
    fileType: '',
    fileUrl: '',
    viewUrl: '',
    fileSize: 0,
    fileExtension: '',
    fileData: null,
    content: '',
  };
};

export const toastMessageSignal = signal(null);

// History stacks for Undo / Redo
const undoHistory = [];
const redoHistory = [];

export const pushHistorySnapshot = () => {
  const currentSnapshot = JSON.stringify(activeBoardSignal.value);
  undoHistory.push(currentSnapshot);
  if (undoHistory.length > 30) undoHistory.shift();
  // Clear redo history on new action
  redoHistory.length = 0;
};

export const showToast = (message) => {
  toastMessageSignal.value = message;
  setTimeout(() => {
    if (toastMessageSignal.value === message) {
      toastMessageSignal.value = null;
    }
  }, 2400);
};

// ==========================================
// Board State Actions (Signals mutations)
// ==========================================

export const setActiveBoard = (boardId) => {
  boardAccessDeniedSignal.value = null;
  boardNotFoundSignal.value = null;

  if (!boardId) {
    batch(() => {
      activeBoardIdSignal.value = null;
      activeBoardSignal.value = null;
    });
    fetchBoardsFromServer();
    return;
  }

  // Flush any pending debounced saves for the PREVIOUS board before switching activeBoardIdSignal
  const prev_board = activeBoardSignal.value;
  const prev_board_id = activeBoardIdSignal.value;
  if (prev_board && prev_board.id && prev_board.id !== boardId && server_hydrated_board_ids.has(prev_board.id) && !deleted_board_ids_set.has(prev_board.id)) {
    if (local_storage_debounce_id) {
      clearTimeout(local_storage_debounce_id);
      local_storage_debounce_id = null;
      execute_local_storage_save(prev_board);
    }
    if (server_sync_timeout_id) {
      clearTimeout(server_sync_timeout_id);
      server_sync_timeout_id = null;
      execute_server_save(prev_board);
    }
  } else {
    if (local_storage_debounce_id) {
      clearTimeout(local_storage_debounce_id);
      local_storage_debounce_id = null;
    }
    if (server_sync_timeout_id) {
      clearTimeout(server_sync_timeout_id);
      server_sync_timeout_id = null;
    }
  }

  if (prev_board_id !== boardId) {
    isLayerPanelOpenSignal.value = false;
  }
  activeBoardIdSignal.value = boardId;
  active_loading_board_id = boardId;

  if (typeof window !== 'undefined' && !deleted_board_ids_set.has(boardId)) {
    try {
      window.localStorage.setItem(LAST_ACTIVE_BOARD_STORAGE_KEY, boardId);
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && typeof connectRealtimeBoard === 'function') {
    connectRealtimeBoard(boardId);
  }

  // Always fetch latest authoritative board state and boards list directly from PostgreSQL server first
  // (Never pre-populate activeBoardSignal from stale IndexedDB before GET /api/boards/:boardId completes)
  if (typeof fetch !== 'undefined' && boardId) {
    isServerSyncingSignal.value = true;
    serverSyncStatusSignal.value = 'syncing';

    (async () => {
      try {
        // Wait for any in-flight save for this board (e.g. just created via New Board) before querying GET
        if (pending_board_saves.has(boardId)) {
          await pending_board_saves.get(boardId);
        }

        fetchBoardsFromServer();

        const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            ...get_lumen_auth_headers(),
          },
        });

        if (res.status === 403) {
          const errData = await safe_parse_response_json(res, {});
          if (active_loading_board_id === boardId) active_loading_board_id = null;
          isServerSyncingSignal.value = false;
          serverSyncStatusSignal.value = 'synced';
          boardAccessDeniedSignal.value = {
            boardId,
            board_id: boardId,
            owner_account: errData?.owner_account || null,
            board_name: errData?.board_name || 'Private Board',
            visibility: errData?.visibility || 'private',
          };
          if (activeBoardIdSignal.value === boardId) {
            activeBoardSignal.value = null;
          }
          return;
        }

        const data = res.ok ? await safe_parse_response_json(res, null) : null;
        isServerSyncingSignal.value = false;

        if (data && data.access_denied) {
          if (active_loading_board_id === boardId) active_loading_board_id = null;
          boardAccessDeniedSignal.value = {
            boardId,
            board_id: boardId,
            owner_account: data.owner_account || null,
            board_name: data.board_name || 'Private Board',
            visibility: data.visibility || 'private',
          };
          if (activeBoardIdSignal.value === boardId) {
            activeBoardSignal.value = null;
          }
          serverSyncStatusSignal.value = 'synced';
          return;
        }

        if ((data && data.board === null) || res.status === 404) {
          // Guard: if a save for this board started while GET was in flight, do not clear it
          if (pending_board_saves.has(boardId)) {
            if (active_loading_board_id === boardId) active_loading_board_id = null;
            serverSyncStatusSignal.value = 'synced';
            return;
          }
          if (active_loading_board_id === boardId) active_loading_board_id = null;
          server_hydrated_board_ids.delete(boardId);
          delete_board_from_idb(boardId).catch(() => {});
          // Board does not exist on server
          boardsDirectorySignal.value = (boardsDirectorySignal.value || []).filter(
            (b) => (b.id || b.board_code) !== boardId
          );
          boardNotFoundSignal.value = {
            boardId,
            board_id: boardId,
          };
          if (activeBoardIdSignal.value === boardId) {
            activeBoardSignal.value = null;
          }
          serverSyncStatusSignal.value = 'synced';
          return;
        }

        if (data && data.board) {
          boardNotFoundSignal.value = null;
          boardAccessDeniedSignal.value = null;
          const server_cards = (Array.isArray(data.board.cards)
            ? data.board.cards
            : Array.isArray(data.board.board_card)
            ? data.board.board_card
            : []
          ).filter((sc) => sc && !deleted_card_ids_set.has(sc.id));
          // Authoritative PostgreSQL hydration: use server cards directly (preserving only in-session unlocked passkey state)
          const merged_cards = server_cards.map((server_card) => {
            const session = unlockedCardsSignal.value[server_card.id];
            if (session && session.payload) {
              return {
                ...server_card,
                content: session.payload.content || '',
                items: session.payload.items || [],
                description: session.payload.description || '',
                notes: session.payload.notes || '',
                url: session.payload.url || '',
                data: {
                  ...(server_card.data || {}),
                  content: session.payload.content || '',
                },
                is_encryption_unlocked: true,
              };
            }
            return server_card;
          });

          const parsed_setting = typeof data.board.board_setting === 'string'
            ? (() => { try { return JSON.parse(data.board.board_setting); } catch (e) { return {}; } })()
            : (data.board.board_setting || {});
          const b_type = data.board.boardType || data.board.board_type || parsed_setting.board_type || 'snap_grid';
          const g_dim = Number(data.board.gridDimension || data.board.grid_dimension || parsed_setting.grid_dimension || 24);
          const normalized_sharing = normalize_board_sharing(data.board.sharing || parsed_setting.sharing);

          const resolved_drawings = Array.isArray(data.board.drawings)
            ? data.board.drawings
            : (Array.isArray(data.board.board_drawing) ? data.board.board_drawing : []);

          const resolved_connections = Array.isArray(data.board.connections)
            ? data.board.connections
            : Array.isArray(data.board.board_connection)
            ? data.board.board_connection
            : (Array.isArray(data.board.board_conenctions) ? data.board.board_conenctions : []);

          const resolved_board = {
            ...data.board,
            id: data.board.id || data.board.board_code || boardId,
            board_code: data.board.board_code || data.board.id || boardId,
            title: data.board.title || data.board.board_name || 'Untitled Board',
            board_name: data.board.board_name || data.board.title || 'Untitled Board',
            description: data.board.description !== undefined ? data.board.description : (data.board.board_description || ''),
            boardType: b_type,
            board_type: b_type,
            gridDimension: g_dim,
            grid_dimension: g_dim,
            board_setting: {
              ...parsed_setting,
              board_type: b_type,
              grid_dimension: g_dim,
              sharing: normalized_sharing,
            },
            sharing: normalized_sharing,
            user_access: data.board.user_access || data.access || resolve_board_access({ ...data.board, sharing: normalized_sharing }),
            viewport: data.board.viewport || data.board.board_viewport || { panX: 100, panY: 100, zoom: 1 },
            connections: resolved_connections,
            board_connection: resolved_connections,
            board_conenctions: resolved_connections,
            drawings: resolved_drawings,
            board_drawing: resolved_drawings,
            cards: merged_cards,
            board_card: merged_cards,
          };

          if (active_loading_board_id === boardId) {
            active_loading_board_id = null;
          }
          server_hydrated_board_ids.add(boardId);
          if (resolved_board.id) {
            server_hydrated_board_ids.add(resolved_board.id);
          }

          save_board_to_idb(resolved_board).catch(() => {});

          if (activeBoardIdSignal.value === boardId) {
            const prev_remote_flag = isRemoteUpdateFlag.current;
            isRemoteUpdateFlag.current = true;
            try {
              batch(() => {
                boardAccessDeniedSignal.value = null;
                activeBoardSignal.value = resolved_board;
                snapToGridSignal.value = b_type !== 'free_position';
                if (g_dim >= 1) {
                  gridDimensionSignal.value = g_dim;
                  if (typeof document !== 'undefined') {
                    document.documentElement.style.setProperty('--lumen-grid-size', `${g_dim}px`);
                  }
                }
                applyBoardThemeToDocument(parsed_setting.color_theme || 'default');
                applyCardCornerStyleToDocument(parsed_setting.card_corner_style || 'rounded');
              });
            } finally {
              isRemoteUpdateFlag.current = prev_remote_flag;
            }
          }

          lastServerSyncTimeSignal.value = data.syncedAt || Date.now();
          boardSizeBytesSignal.value = data.sizeBytes || calculate_board_size_bytes(resolved_board);
          serverSyncStatusSignal.value = 'synced';
        } else {
          if (active_loading_board_id === boardId) active_loading_board_id = null;
          serverSyncStatusSignal.value = 'synced';
        }
      } catch (_) {
        if (active_loading_board_id === boardId) active_loading_board_id = null;
        isServerSyncingSignal.value = false;
        serverSyncStatusSignal.value = 'synced';
        // Offline fallback ONLY when network request to server fails
        if (typeof window !== 'undefined' && activeBoardIdSignal.value === boardId && !activeBoardSignal.value && !deleted_board_ids_set.has(boardId)) {
          load_board_from_idb(boardId).then((cached) => {
            if (cached && activeBoardIdSignal.value === boardId && !activeBoardSignal.value && !deleted_board_ids_set.has(boardId)) {
              server_hydrated_board_ids.add(boardId);
              activeBoardSignal.value = cached;
            }
          }).catch(() => {});
        }
      }
    })();
  }
};

export const setBoardType = (type) => {
  pushHistorySnapshot();
  const isSnap = type === 'snap_grid';
  batch(() => {
    const cur_settings = activeBoardSignal.value?.board_setting || {};
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      boardType: type,
      board_type: type,
      board_setting: {
        ...cur_settings,
        board_type: type,
      },
      updatedAt: Date.now(),
    };
    snapToGridSignal.value = isSnap;

    // Sync in directory list
    const currentId = activeBoardSignal.value.id;
    const list = [...boardsDirectorySignal.value];
    const idx = list.findIndex((b) => b.id === currentId);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        boardType: type,
        board_type: type,
        board_setting: {
          ...(list[idx].board_setting || {}),
          board_type: type,
        },
        updatedAt: Date.now(),
      };
      boardsDirectorySignal.value = list;
    }
  });
  saveCurrentBoardToStore();
  showToast(
    isSnap
      ? 'Board type: Snap to Grid (24px alignment)'
      : 'Board type: Free Position (fluid freeform canvas)'
  );
};

export const updateBoardMeta = (updates) => {
  pushHistorySnapshot();
  const normalized_updates = { ...updates };
  if (normalized_updates.title !== undefined) {
    normalized_updates.board_name = normalized_updates.title;
  }
  if (normalized_updates.description !== undefined) {
    normalized_updates.board_description = normalized_updates.description;
  }
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    ...normalized_updates,
    updatedAt: Date.now(),
  };
  saveCurrentBoardToStore();
};

export const updateBoardTitleAndMeta = (updates) => {
  pushHistorySnapshot();
  const currentId = activeBoardSignal.value.id;
  const normalized_updates = { ...updates };
  if (normalized_updates.title !== undefined) {
    normalized_updates.board_name = normalized_updates.title;
  }
  if (normalized_updates.description !== undefined) {
    normalized_updates.board_description = normalized_updates.description;
  }
  batch(() => {
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      ...normalized_updates,
      updatedAt: Date.now(),
    };
    const list = [...boardsDirectorySignal.value];
    const idx = list.findIndex((b) => (b.id || b.board_code) === currentId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...normalized_updates, updatedAt: Date.now() };
      boardsDirectorySignal.value = list;
    }
  });
  saveCurrentBoardToStore({ immediate: true });
};

export const autoArrangeCards = () => {
  const currentCards = activeBoardSignal.value.cards || [];
  if (currentCards.length === 0) {
    showToast('No cards to arrange');
    return;
  }
  pushHistorySnapshot();

  const isSnap = snapToGridSignal.value;
  const colCount = Math.min(Math.max(2, Math.ceil(Math.sqrt(currentCards.length * 1.5))), 4);
  const colWidth = 380;
  const colHeights = Array(colCount).fill(120);

  const arranged = currentCards.map((card) => {
    let minColIdx = 0;
    for (let i = 1; i < colCount; i++) {
      if (colHeights[i] < colHeights[minColIdx]) {
        minColIdx = i;
      }
    }

    const x = 120 + minColIdx * (colWidth + 32);
    const y = colHeights[minColIdx];
    const cardH = card.height || 260;
    colHeights[minColIdx] += cardH + 32;

    return {
      ...card,
      x: isSnap ? snapToGrid(x) : Math.round(x),
      y: isSnap ? snapToGrid(y) : Math.round(y),
    };
  });

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: arranged,
    updatedAt: Date.now(),
  };
  saveCurrentBoardToStore();
  showToast('Cards auto-arranged neatly');
};

export const updateViewport = (panX, panY, zoom) => {
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    viewport: {
      panX: Math.round(panX),
      panY: Math.round(panY),
      zoom: Number(zoom.toFixed(2)),
    },
  };
};

/**
 * Returns initial card dimensions based on card type via switch-case.
 */
export function get_card_initial_dimension(type) {
  switch (type) {
    case 'note':
      return { width: 360, height: 216 };
    case 'checklist':
    case 'tasklist':
      return { width: 360, height: 288 };
    case 'heading':
      return { width: 360, height: 168 };
    case 'image carousel':
    case 'image':
      return { width: 360, height: 360 };
    case 'sketch':
    case 'canvas':
      return { width: 520, height: 360 };
    case 'group':
      return { width: 388, height: 528 };
    case 'rich document':
    case 'docs':
    case 'document':
      return { width: 528, height: 528 };
    case 'code':
    case 'code snippet':
      return { width: 528, height: 384 };
    case 'spreadsheet':
    case 'sheets':
      return { width: 672, height: 528 };
    case 'stock':
      return { width: 550, height: 600 };
    case 'location':
    case 'geo':
      return { width: 360, height: 528 };
    case 'color':
    case 'palette':
      return { width: 360, height: 336 };
    case 'file':
      return { width: 360, height: 360 };
    case 'sound_recorder':
    case 'sound recorder':
      return { width: 384, height: 264 };
    case 'media':
    case 'embed':
      return { width: 388, height: 388 };
    case 'social media link':
    case 'social':
      return { width: 360, height: 720 };
    case 'nested board':
    case 'board':
      return { width: 360, height: 360 };
    case 'link':
      return { width: 360, height: 216 };
    case 'item':
    case 'product':
      return { width: 340, height: 380 };
    case 'currency':
      return { width: 420, height: 460 };
    case 'clock':
      return { width: 396, height: 440 };
    default:
      return { width: 360, height: 216 };
  }
}

export const get_max_board_layer_z = (board = activeBoardSignal.value) => {
  if (!board) return 1;
  const cards_max = (board.cards || []).reduce(
    (max, c) => Math.max(max, typeof c.zIndex === 'number' ? c.zIndex : 1),
    1
  );
  const images_max = (board.drawings || [])
    .filter((d) => d.type === 'image')
    .reduce(
      (max, img) => Math.max(max, typeof img.zIndex === 'number' ? img.zIndex : 1),
      1
    );
  return Math.max(cards_max, images_max, 1);
};

export const addCard = (cardConfig) => {
  pushHistorySnapshot();
  const currentCards = Array.isArray(activeBoardSignal.value?.cards)
    ? activeBoardSignal.value.cards
    : [];
  const maxZ = get_max_board_layer_z();
  
  const snap = snapToGridSignal.value;
  const x = snap ? snapToGrid(cardConfig.x || 120) : (cardConfig.x || 120);
  const y = snap ? snapToGrid(cardConfig.y || 120) : (cardConfig.y || 120);

  // If this is a nested board card, ensure a target child board exists
  let target_board_id = cardConfig.target_board_id;
  if (cardConfig.type === 'board') {
    if (!target_board_id) {
      target_board_id = createBoardId();
    }
    const parentId = activeBoardSignal.value.id || 'board_moodboard';
    const childTitle = cardConfig.title || 'Untitled Sub-Board';

    // Register child board in directory and localStorage if not exists
    const existingIdx = (boardsDirectorySignal.value || []).findIndex((b) => b.id === target_board_id);
    if (existingIdx === -1) {
      const auth_payload = get_lumen_auth_payload();
      const child_vendor_code = auth_payload?.vendor_code || activeBoardSignal.value?.vendor_code || 'lumen';
      const child_master_code = auth_payload?.master_code || activeBoardSignal.value?.master_code || 'mysuperid';
      const child_project_code = auth_payload?.project_code || activeBoardSignal.value?.project_code || 'mysuperid';
      const child_user_account = auth_payload?.user_account || activeBoardSignal.value?.user_account || null;
      const newChildBoardMeta = {
        id: target_board_id,
        board_code: target_board_id,
        title: childTitle,
        board_name: childTitle,
        description: cardConfig.description || 'Nested workspace board',
        board_description: cardConfig.description || 'Nested workspace board',
        updatedAt: Date.now(),
        cardCount: 1,
        accentColor: '#7c3aed',
        boardType: activeBoardSignal.value.boardType || 'snap_grid',
        board_type: activeBoardSignal.value.boardType || 'snap_grid',
        parent_board_id: parentId,
        is_nested: true,
        vendor_code: child_vendor_code,
        master_code: child_master_code,
        project_code: child_project_code,
        user_account: child_user_account,
      };

      const welcome_card_id = createId('card');
      const welcome_card = {
        id: welcome_card_id,
        card_code: welcome_card_id,
        type: 'note',
        card_type: 'note',
        x: 144,
        y: 120,
        width: 336,
        height: 180,
        title: 'Welcome to this Nested Board',
        card_name: 'Welcome to this Nested Board',
        content: 'This is a sub-board nested inside the parent workspace.\n\n• Add notes, tasks, images, or even more nested boards\n• Use the breadcrumbs in the top bar to navigate back',
        color: 'purple',
        zIndex: 1,
        vendor_code: child_vendor_code,
        master_code: child_master_code,
        project_code: child_project_code,
        user_account: child_user_account,
      };

      const newChildBoardData = {
        id: target_board_id,
        board_code: target_board_id,
        title: childTitle,
        board_name: childTitle,
        description: cardConfig.description || 'Nested workspace board',
        board_description: cardConfig.description || 'Nested workspace board',
        boardType: activeBoardSignal.value.boardType || 'snap_grid',
        board_type: activeBoardSignal.value.boardType || 'snap_grid',
        parent_board_id: parentId,
        is_nested: true,
        vendor_code: child_vendor_code,
        master_code: child_master_code,
        project_code: child_project_code,
        user_account: child_user_account,
        lumen_auth: auth_payload,
        updatedAt: Date.now(),
        time_create: new Date().toISOString(),
        time_modify: new Date().toISOString(),
        viewport: { panX: 100, panY: 100, zoom: 1 },
        board_viewport: { panX: 100, panY: 100, zoom: 1 },
        cards: [welcome_card],
        board_card: [welcome_card],
        connections: [],
        board_connection: [],
        board_conenctions: [],
        drawings: [],
        board_drawing: [],
      };

      boardsDirectorySignal.value = [...boardsDirectorySignal.value, newChildBoardMeta];
      if (typeof fetch !== 'undefined') {
        fetch(`/api/boards/${encodeURIComponent(target_board_id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...get_lumen_auth_headers() },
          body: JSON.stringify({ board: newChildBoardData, lumen_auth: auth_payload }),
        })
          .then(() => fetchBoardsFromServer())
          .catch(() => {});
      }
    }
  }

  const initial_dim = get_card_initial_dimension(cardConfig.type || 'note');
  const card_width = cardConfig.width || initial_dim.width;
  const card_height = cardConfig.height || initial_dim.height;

  const card_id = cardConfig.id || cardConfig.card_code || createId('card');
  const enc_meta = cardConfig.card_encryption || cardConfig.cardEncryption || null;
  const is_unlocked = Boolean(cardConfig.is_encryption_unlocked);
  const card_auth = get_lumen_auth_payload();

  const newCard = {
    ...cardConfig,
    id: card_id,
    card_code: card_id,
    type: cardConfig.type || 'note',
    card_type: cardConfig.type || 'note',
    vendor_code: cardConfig.vendor_code || card_auth?.vendor_code || activeBoardSignal.value?.vendor_code || 'lumen',
    master_code: cardConfig.master_code || card_auth?.master_code || activeBoardSignal.value?.master_code || 'mysuperid',
    project_code: cardConfig.project_code || card_auth?.project_code || activeBoardSignal.value?.project_code || 'mysuperid',
    user_account: cardConfig.user_account || card_auth?.user_account || activeBoardSignal.value?.user_account || null,
    x,
    y,
    width: card_width,
    height: card_height,
    title: cardConfig.title !== undefined ? cardConfig.title : (cardConfig.type === 'code' ? 'Code Snippet' : cardConfig.type === 'currency' ? 'Currency Calculator' : cardConfig.type === 'clock' ? 'World Clock & Timer' : cardConfig.type === 'stock' ? 'Stock Card' : cardConfig.type === 'canvas' ? 'Drawing Canvas' : cardConfig.type === 'link' ? 'Design Systems Repository' : cardConfig.type === 'group' ? '1-Column Group' : cardConfig.type === 'heading' ? 'Section Header' : cardConfig.type === 'embed' ? 'Web Embed' : cardConfig.type === 'social' ? 'Web Embed' : cardConfig.type === 'board' ? 'Sub-Board' : cardConfig.type === 'file' ? 'Brand_Guidelines_Spec_v2.pdf' : cardConfig.type === 'sound_recorder' ? 'Sound Recorder' : cardConfig.type === 'geo' ? 'Kyoto Design Pavilion' : 'New Note'),
    target_board_id,
    content: (enc_meta && !is_unlocked) ? '' : (cardConfig.content !== undefined ? cardConfig.content : (cardConfig.type === 'file' ? 'Official architectural brand specifications, color values, and vector assets for team review.' : '')),
    color: cardConfig.color || (cardConfig.type === 'canvas' ? 'white' : cardConfig.type === 'group' ? 'slate' : cardConfig.type === 'board' ? 'purple' : cardConfig.type === 'file' ? 'peach' : cardConfig.type === 'embed' ? 'green' : cardConfig.type === 'geo' ? 'blue' : 'white'),
    canvas_strokes: Array.isArray(cardConfig.canvas_strokes) ? cardConfig.canvas_strokes : [],
    canvas_images: Array.isArray(cardConfig.canvas_images) ? cardConfig.canvas_images : [],
    canvas_bg_style: cardConfig.canvas_bg_style || 'dots',
    sheets_data: cardConfig.sheets_data || (cardConfig.type === 'sheets' ? { cols: ['A', 'B', 'C', 'D', 'E', 'F'], rows_count: 8, cells: {} } : undefined),
    code_data: cardConfig.code_data || (cardConfig.type === 'code' ? { active_file_id: 'file_1', theme: 'dark', word_wrap: false, font_size: 13, files: [{ id: 'file_1', name: 'snippet.js', language: 'javascript', code: '', pinned_lines: [] }] } : undefined),
    currency_data: cardConfig.currency_data || (cardConfig.type === 'currency' ? { selected_codes: ['USD', 'EUR', 'IDR', 'JPY', 'GBP', 'SGD'], base_code: 'USD', base_amount: 100, theme: 'dark' } : undefined),
    clock_data: cardConfig.clock_data || (cardConfig.type === 'clock' ? {
      mode: 'clock',
      utc_offset: 'LOCAL',
      show_date: true,
      show_seconds: true,
      use_24h: true,
      show_analog: true,
      theme: 'dark',
      sound_enabled: true,
      stopwatch_running: false,
      stopwatch_elapsed_ms: 0,
      stopwatch_started_at: null,
      stopwatch_laps: [],
      countdown_duration_sec: 300,
      countdown_remaining_ms: 300000,
      countdown_running: false,
      countdown_target_ts: null,
      alarms: [
        { id: 'alarm_1', time: '09:00', label: 'Morning Standup', enabled: true },
      ],
    } : undefined),
    card_ids: Array.isArray(cardConfig.card_ids) ? cardConfig.card_ids : [],
    group_id: cardConfig.group_id || null,
    collapsed: Boolean(cardConfig.collapsed),
    layout: cardConfig.layout || (cardConfig.type === 'group' ? 'column' : undefined),
    column_width: cardConfig.column_width || (cardConfig.type === 'group' ? 348 : undefined),
    location_name: cardConfig.location_name || (cardConfig.type === 'geo' ? (cardConfig.title || 'Kyoto Design Pavilion') : undefined),
    address: cardConfig.address || (cardConfig.type === 'geo' ? 'Kiyomizu 1-chome, Higashiyama Ward, Kyoto 605-0862, Japan' : undefined),
    latitude: cardConfig.latitude !== undefined ? cardConfig.latitude : (cardConfig.type === 'geo' ? 34.9949 : undefined),
    longitude: cardConfig.longitude !== undefined ? cardConfig.longitude : (cardConfig.type === 'geo' ? 135.7850 : undefined),
    zoom: cardConfig.zoom || (cardConfig.type === 'geo' ? 15 : undefined),
    notes: cardConfig.notes || (cardConfig.type === 'geo' ? 'Site visit for natural stone inspection, travertine sourcing, and ambient acoustic field recording.' : undefined),
    destinations: cardConfig.destinations || (cardConfig.type === 'geo' ? [] : undefined),
    travel_mode: cardConfig.travel_mode || (cardConfig.type === 'geo' ? 'driving' : undefined),
    file_name: cardConfig.file_name || undefined,
    file_id: cardConfig.file_id || undefined,
    file_size: cardConfig.file_size || undefined,
    file_type: cardConfig.file_type || undefined,
    file_url: cardConfig.file_url || undefined,
    view_url: cardConfig.view_url || undefined,
    file_extension: cardConfig.file_extension || undefined,
    download_count: cardConfig.download_count || 0,
    uploaded_at: cardConfig.uploaded_at || undefined,
    transcript: cardConfig.transcript || (cardConfig.type === 'sound_recorder' ? '' : undefined),
    translated_text: cardConfig.translated_text || (cardConfig.type === 'sound_recorder' ? '' : undefined),
    target_language: cardConfig.target_language || (cardConfig.type === 'sound_recorder' ? 'English' : undefined),
    detected_language: cardConfig.detected_language || undefined,
    audio_duration: cardConfig.audio_duration || (cardConfig.type === 'sound_recorder' ? 0 : undefined),
    recordings: Array.isArray(cardConfig.recordings) ? cardConfig.recordings : (cardConfig.type === 'sound_recorder' ? [] : undefined),
    items: (enc_meta && !is_unlocked) ? [] : (cardConfig.items !== undefined ? cardConfig.items : (cardConfig.type === 'tasklist' ? [{ id: 't1', text: 'Task item', done: false }] : undefined)),
    imageUrl: cardConfig.imageUrl || undefined,
    images: cardConfig.images || (cardConfig.type === 'image' ? (cardConfig.imageUrl ? [{ id: createId('slide'), url: cardConfig.imageUrl, caption: cardConfig.caption || '' }] : []) : undefined),
    active_slide_index: 0,
    caption: cardConfig.caption || '',
    url: cardConfig.url || (cardConfig.type === 'link' ? 'https://designsystemsrepo.com' : cardConfig.type === 'embed' ? 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' : cardConfig.type === 'social' ? 'https://www.instagram.com/reel/C8x9Y2mKq4Z/' : cardConfig.type === 'geo' ? 'https://www.google.com/maps/search/?api=1&query=Kyoto+Design+Pavilion+Higashiyama+Kyoto+Japan' : undefined),
    description: cardConfig.description || (cardConfig.type === 'group' ? 'Group container for organizing related cards' : ''),
    author: cardConfig.author || '',
    platform: cardConfig.platform || (cardConfig.type === 'embed' ? 'spotify' : cardConfig.type === 'social' ? 'instagram' : undefined),
    social_type: cardConfig.social_type || (cardConfig.type === 'embed' ? 'track' : cardConfig.type === 'social' ? 'reel' : undefined),
    shortcode: cardConfig.shortcode || (cardConfig.type === 'social' ? 'C8x9Y2mKq4Z' : undefined),
    video_id: cardConfig.video_id,
    bvid: cardConfig.bvid,
    aid: cardConfig.aid,
    zIndex: cardConfig.type === 'group' ? 0 : maxZ + 1,
    card_encryption: enc_meta,
    cardEncryption: enc_meta,
    is_encryption_unlocked: is_unlocked,
    updatedAt: Date.now(),
    data: {
      ...(cardConfig.data || (enc_meta ? { encrypted: true, hint: enc_meta?.passkey_hint || enc_meta?.hint || '' } : {})),
      ...(cardConfig.colors !== undefined ? { colors: cardConfig.colors } : {}),
      ...(cardConfig.color_format !== undefined ? { color_format: cardConfig.color_format } : {}),
      ...(cardConfig.palette_layout !== undefined ? { palette_layout: cardConfig.palette_layout } : {}),
    },
  };

  // If new card is a group with members, update member cards' group_id
  let nextCards = [...currentCards];
  if (newCard.type === 'group' && newCard.card_ids.length > 0) {
    nextCards = nextCards.map((c) => {
      if (newCard.card_ids.includes(c.id)) {
        return { ...c, group_id: newCard.id, zIndex: Math.max(c.zIndex || 1, 2) };
      }
      return c;
    });
  }

  const finalCards = [...nextCards, newCard];
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: finalCards,
    board_card: finalCards,
  };

  if (newCard.type === 'group') {
    autoLayoutGroupColumn(newCard.id, newCard.card_ids, false);
  } else if (newCard.group_id) {
    const parentGroup = nextCards.find((c) => c.id === newCard.group_id);
    if (parentGroup) {
      const existingIds = (Array.isArray(parentGroup.card_ids) ? parentGroup.card_ids : []).filter(
        (id) => id !== newCard.id
      );
      autoLayoutGroupColumn(newCard.group_id, [...existingIds, newCard.id], false);
    }
  }

  selectedCardsSignal.value = [newCard.id];
  saveCurrentBoardToStore();
  showToast(`Added ${newCard.type === 'board' ? 'nested sub-board' : newCard.type} card`);

  // Direct persistence to PostgreSQL database
  patchCardOnServer(newCard.id, newCard).catch(() => {});

  if (!isRemoteUpdateFlag.current) {
    broadcastCardAdd(newCard);
  }

  return newCard;
};

export const updateCard = (cardId, updates, recordHistory = false) => {
  if (!cardId || !updates || typeof updates !== 'object') return;
  if (!activeBoardSignal.value) return;

  let effective_updates = { ...updates };

  if (isRemoteUpdateFlag.current) {
    const existing_local = (activeBoardSignal.value.cards || []).find((c) => c.id === cardId);
    if (should_preserve_local_card_geometry(cardId, existing_local, updates)) {
      delete effective_updates.x;
      delete effective_updates.y;
      delete effective_updates.width;
      delete effective_updates.height;
      delete effective_updates.pos_x;
      delete effective_updates.pos_y;
      delete effective_updates.column_width;
      if (Object.keys(effective_updates).length === 0) {
        return;
      }
    }
  } else {
    if (
      effective_updates.x !== undefined ||
      effective_updates.y !== undefined ||
      effective_updates.width !== undefined ||
      effective_updates.height !== undefined
    ) {
      last_local_card_geom_edit_map.set(cardId, Date.now());
    }
  }

  if (recordHistory) {
    pushHistorySnapshot();
  }

  // Synchronize child board title if a nested board card title changed
  const targetCard = (activeBoardSignal.value.cards || []).find((c) => c.id === cardId);
  if (
    targetCard &&
    targetCard.type === 'board' &&
    targetCard.target_board_id &&
    effective_updates.title !== undefined
  ) {
    const childId = targetCard.target_board_id;
    const childKey = `lumen_board_${childId}_v4`;
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(childKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.title = effective_updates.title;
          localStorage.setItem(childKey, JSON.stringify(parsed));
        } catch (e) {}
      }
    }
    const dir = [...boardsDirectorySignal.value];
    const cIdx = dir.findIndex((b) => b.id === childId);
    if (cIdx !== -1) {
      dir[cIdx] = { ...dir[cIdx], title: effective_updates.title };
      boardsDirectorySignal.value = dir;
    }
  }

  const next_cards = (activeBoardSignal.value?.cards || []).map((card) => {
    if (card.id === cardId) {
      const next_data =
        typeof card.data === 'object' && card.data !== null && !Array.isArray(card.data)
          ? { ...card.data }
          : {};
      if (
        effective_updates.data &&
        typeof effective_updates.data === 'object' &&
        !Array.isArray(effective_updates.data)
      ) {
        Object.assign(next_data, effective_updates.data);
      }
      if (effective_updates.content !== undefined) next_data.content = effective_updates.content;
      if (effective_updates.content_html !== undefined) {
        next_data.content_html = effective_updates.content_html;
      } else if (
        effective_updates.content !== undefined &&
        String(effective_updates.content) !== String(card.content || '')
      ) {
        delete next_data.content_html;
        effective_updates.content_html = '';
      }
      if (effective_updates.sheets_data !== undefined) next_data.sheets_data = effective_updates.sheets_data;
      if (effective_updates.items !== undefined) next_data.items = effective_updates.items;
      if (effective_updates.description !== undefined)
        next_data.description = effective_updates.description;
      if (effective_updates.code_content !== undefined)
        next_data.code_content = effective_updates.code_content;
      if (effective_updates.code_data !== undefined) next_data.code_data = effective_updates.code_data;
      if (effective_updates.code_language !== undefined)
        next_data.code_language = effective_updates.code_language;
      if (effective_updates.url !== undefined) next_data.url = effective_updates.url;
      if (effective_updates.images !== undefined) next_data.images = effective_updates.images;
      if (effective_updates.imageUrl !== undefined) next_data.imageUrl = effective_updates.imageUrl;
      if (effective_updates.active_slide_index !== undefined)
        next_data.active_slide_index = effective_updates.active_slide_index;
      if (effective_updates.caption !== undefined) next_data.caption = effective_updates.caption;
      if (effective_updates.colors !== undefined) next_data.colors = effective_updates.colors;
      if (effective_updates.color_format !== undefined)
        next_data.color_format = effective_updates.color_format;
      if (effective_updates.palette_layout !== undefined)
        next_data.palette_layout = effective_updates.palette_layout;
      if (effective_updates.currency_data !== undefined)
        next_data.currency_data = effective_updates.currency_data;
      if (effective_updates.clock_data !== undefined)
        next_data.clock_data = effective_updates.clock_data;
      if (effective_updates.font_family !== undefined)
        next_data.font_family = effective_updates.font_family;

      const tts_sync_keys = [
        'tts_file_id',
        'tts_file_name',
        'tts_file_size',
        'tts_audio_url',
        'tts_download_url',
        'tts_audio_base64',
        'tts_audio_duration',
        'tts_voice_persona',
        'tts_language',
        'tts_spoken_language',
        'tts_translated_text',
      ];
      for (const tk of tts_sync_keys) {
        if (Object.prototype.hasOwnProperty.call(effective_updates, tk)) {
          if (effective_updates[tk] === null || effective_updates[tk] === undefined) {
            delete next_data[tk];
          } else {
            next_data[tk] = effective_updates[tk];
          }
        }
      }

      const resolved_content =
        effective_updates.content !== undefined
          ? String(effective_updates.content)
          : next_data.content !== undefined
          ? String(next_data.content)
          : card.content !== undefined
          ? String(card.content)
          : '';

      next_data.content = resolved_content;

      const merged_card = {
        ...card,
        ...effective_updates,
        content: resolved_content,
        data: next_data,
        updatedAt: Date.now(),
      };
      for (const tk of tts_sync_keys) {
        if (
          Object.prototype.hasOwnProperty.call(effective_updates, tk) &&
          effective_updates[tk] === undefined
        ) {
          merged_card[tk] = null;
        }
      }
      return merged_card;
    }
    return card;
  });

  const board_now_ms = Date.now();
  const board_now_iso = new Date(board_now_ms).toISOString();
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: next_cards,
    board_card: next_cards,
    updatedAt: board_now_ms,
    time_modify: board_now_iso,
    time_modified: board_now_iso,
  };

  const transient_geom_keys = new Set([
    'x',
    'y',
    'width',
    'height',
    'column_width',
    'user_resized_image_card',
    'base_height_without_note',
    'image_note_height',
  ]);
  const update_keys = Object.keys(effective_updates);
  const is_transient_movement =
    !recordHistory &&
    update_keys.length > 0 &&
    update_keys.every((k) => transient_geom_keys.has(k));

  if (!is_transient_movement) {
    if (isRemoteUpdateFlag.current) {
      saveCurrentBoardToStore({ localOnly: true });
    } else {
      last_local_card_content_edit_map.set(cardId, Date.now());
      saveCurrentBoardToStore({ localOnly: true });
      schedule_card_patch_on_server(cardId, effective_updates, Boolean(recordHistory));
    }
  }

  if (!is_transient_movement && !isRemoteUpdateFlag.current) {
    const isMajor =
      effective_updates.title !== undefined ||
      effective_updates.color !== undefined ||
      effective_updates.items !== undefined;
    const logDesc =
      effective_updates.title !== undefined
        ? `Renamed card to "${effective_updates.title}"`
        : effective_updates.color !== undefined
        ? `Changed card color to ${effective_updates.color}`
        : effective_updates.items !== undefined
        ? `Updated checklist on "${targetCard?.title || 'card'}"`
        : `Updated card properties`;
    broadcastCardUpdate(
      cardId,
      effective_updates,
      recordHistory && isMajor,
      'Updated Card',
      logDesc,
      targetCard?.title || ''
    );
  }

  // If group content updated, recalculate layout
  if (
    !is_transient_movement &&
    targetCard &&
    targetCard.type === 'group' &&
    effective_updates.content !== undefined
  ) {
    setTimeout(() => {
      autoLayoutGroupColumn(cardId);
    }, 0);
  }

  // If a child card inside a group finishes changing height or checklist items (not during transient drag/resize frames), recalculate parent group
  if (
    !is_transient_movement &&
    !active_interacting_card_ids_set.has(cardId) &&
    targetCard &&
    targetCard.group_id &&
    (effective_updates.height !== undefined || effective_updates.items !== undefined)
  ) {
    setTimeout(() => {
      if (effective_updates.width !== undefined) {
        const cur_cards = activeBoardSignal.value?.cards || [];
        const parent_grp = cur_cards.find((c) => c.id === targetCard.group_id);
        if (parent_grp) {
          const new_col_w = Math.max(280, Number(effective_updates.width) || 280);
          const new_grp_w = Math.max(320, new_col_w + 40);
          activeBoardSignal.value = {
            ...activeBoardSignal.value,
            cards: cur_cards.map((c) =>
              c.id === parent_grp.id
                ? { ...c, column_width: new_col_w, width: new_grp_w }
                : c
            ),
          };
        }
      }
      autoLayoutGroupColumn(targetCard.group_id);
    }, 0);
  }
};

export const clearCardMuseVoiceResult = (cardId, silent = false) => {
  if (!cardId) return;
  const current_cards = activeBoardSignal.value?.cards || [];
  const target_card = current_cards.find((c) => c.id === cardId);
  const old_tts_file_id = target_card?.tts_file_id || target_card?.data?.tts_file_id || null;
  const old_tts_file_name = target_card?.tts_file_name || target_card?.data?.tts_file_name || '';
  const cur_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';

  updateCard(
    cardId,
    {
      tts_file_id: null,
      tts_file_name: null,
      tts_file_size: null,
      tts_audio_url: null,
      tts_download_url: null,
      tts_audio_base64: null,
      tts_audio_duration: null,
      tts_spoken_language: null,
      tts_translated_text: null,
    },
    true
  );

  if (old_tts_file_id) {
    delete_storage_file_for_board_item(old_tts_file_id, old_tts_file_name, cur_board_id).catch(
      () => {}
    );
  }

  if (!silent) {
    showToast('Removed Muse Voice result');
  }
};

export const deleteCard = (cardId, silent = false) => {
  if (!cardId) return;
  deleted_card_ids_set.add(cardId);
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value?.cards || [];
  const targetCard = currentCards.find((c) => c.id === cardId);
  const isGroup = targetCard?.type === 'group';
  const parentGroupId = targetCard?.group_id;
  const cur_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';

  batch(() => {
    // If deleting a group card, release all member cards
    // If deleting a member card, remove from parent group's card_ids
    const updatedCards = currentCards
      .filter((c) => c.id !== cardId)
      .map((c) => {
        if (isGroup && c.group_id === cardId) {
          return { ...c, group_id: null };
        }
        if (c.type === 'group' && Array.isArray(c.card_ids) && c.card_ids.includes(cardId)) {
          return { ...c, card_ids: c.card_ids.filter((id) => id !== cardId) };
        }
        return c;
      });

    const updatedConns = (activeBoardSignal.value.connections || []).filter(
      (conn) => conn.fromId !== cardId && conn.toId !== cardId
    );

    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      cards: updatedCards,
      board_card: updatedCards,
      connections: updatedConns,
      board_connection: updatedConns,
      board_conenctions: updatedConns,
      updatedAt: Date.now(),
    };
    selectedCardsSignal.value = selectedCardsSignal.value.filter((id) => id !== cardId);
  });
  saveCurrentBoardToStore({ immediate: true });

  if (!isRemoteUpdateFlag.current) {
    if (typeof fetch !== 'undefined') {
      fetch(
        `/api/cards/${encodeURIComponent(cardId)}?board_id=${encodeURIComponent(cur_board_id)}`,
        {
          method: 'DELETE',
          headers: {
            ...get_lumen_auth_headers(),
          },
        }
      ).catch(() => {});
    }
    if (targetCard) {
      broadcastCardDelete(cardId, targetCard.title, targetCard.type);
      const card_fid = extract_file_id_from_board_item(targetCard);
      if (card_fid) {
        const remaining = activeBoardSignal.value?.cards || [];
        const still_used = remaining.some((c) => extract_file_id_from_board_item(c) === card_fid);
        if (!still_used) {
          delete_storage_file_for_board_item(
            card_fid,
            targetCard.file_name || targetCard.title || '',
            cur_board_id
          ).catch(() => {});
        }
      }
    }
  }

  if (parentGroupId) {
    autoLayoutGroupColumn(parentGroupId);
  }

  if (!silent) {
    showToast(isGroup ? 'Group removed (contained cards released)' : 'Card deleted');
  }
};

export const autoLayoutGroupColumn = (groupId, customCardIds = null, recordHistory = false, forceFit = false) => {
  if (recordHistory) {
    pushHistorySnapshot();
  }
  const currentCards = activeBoardSignal.value.cards || [];
  const group = currentCards.find((c) => c.id === groupId);
  if (!group || group.type !== 'group') return;

  const rawMemberIds = customCardIds || (Array.isArray(group.card_ids) ? group.card_ids : []);
  // All cards that belong to this group (either in card_ids or have group_id === groupId)
  const memberCards = currentCards.filter(
    (c) => (rawMemberIds.includes(c.id) || c.group_id === groupId) && c.id !== groupId
  );

  // Auto-order member cards:
  // First prioritize the sequence in rawMemberIds.
  // Any members not yet in rawMemberIds are appended sorted by their current y position.
  const orderedMembers = [...memberCards].sort((a, b) => {
    const idxA = rawMemberIds.indexOf(a.id);
    const idxB = rawMemberIds.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.y - b.y;
  });

  const minGroupWidth = 320; // Enforce minimum width 320
  const padX = 20;
  const gapY = 16;

  // 1. Calculate single column width and free-transformed group width (min 320)
  let finalGroupWidth;
  let columnWidth;

  if (forceFit) {
    const defaultColWidth = group.column_width || Math.max(
      280,
      ...orderedMembers.map((c) => c.width || 280)
    );
    columnWidth = defaultColWidth;
    finalGroupWidth = snapToGridSignal.value
      ? snapToGrid(Math.max(minGroupWidth, columnWidth + padX * 2))
      : Math.max(minGroupWidth, columnWidth + padX * 2);
  } else {
    // Preserve free-transform width with min 320 constraint
    finalGroupWidth = Math.max(minGroupWidth, group.width || minGroupWidth);
    columnWidth = Math.max(280, finalGroupWidth - padX * 2);
  }

  // 2. Accurate top chrome calculation (Header + Content box/prompt + Ribbon)
  // Header height: buttons wrap into multiple rows depending on width
  let multilineHeaderH = 78;
  if (finalGroupWidth <= 380) {
    multilineHeaderH = 114; // title row (32px) + 2 wrapped action button rows (60px) + padding (22px)
  } else if (finalGroupWidth <= 460) {
    multilineHeaderH = 96;
  }

  // Body content or prompt height
  let contentPad = 0;
  if (group.content && group.content.trim()) {
    const textLines = group.content.trim().split('\n').length;
    // Base padding 24px + line height ~22px per line (max 320px)
    const estContentH = Math.min(320, Math.max(54, textLines * 22 + 36));
    contentPad = estContentH + 16;
  } else {
    // Space for '+ Add body text / notes' prompt button
    contentPad = 42;
  }

  // Member cards ribbon height (accounts for chips wrapping into multiple rows)
  let ribbonH = 0;
  if (orderedMembers.length > 0) {
    const availableRibbonW = Math.max(200, finalGroupWidth - 48);
    // Label takes ~75px. Each chip is up to 180-220px wide.
    const chipsPerRow = Math.max(1, Math.floor(availableRibbonW / 190));
    const numRows = Math.ceil(orderedMembers.length / chipsPerRow);
    // Each row of chips is ~28px + 6px gap, plus ribbon padding (14px) and margin-bottom (10px)
    ribbonH = Math.max(46, numRows * 34 + 16 + 10);
  }

  // Top chrome height calculation: header + body top padding (10px) + content + ribbon
  const calculatedTopChrome = multilineHeaderH + 10 + contentPad + ribbonH;
  // Use measured DOM height from LUMEN_group_card ResizeObserver if available, otherwise accurate calculatedTopChrome
  const measuredTop = group.top_chrome_height;
  const actualTopChrome = Math.max(calculatedTopChrome, (measuredTop && measuredTop > 50 ? measuredTop : 0));
  // 16px clean breathing room below the ribbon before Card #1 starts
  const padTop = group.collapsed ? 52 : actualTopChrome + 16;

  if (orderedMembers.length === 0) {
    const emptyW = Math.max(minGroupWidth, group.width || minGroupWidth);
    const emptyH = group.collapsed
      ? 52
      : (forceFit
          ? Math.max(260, calculatedTopChrome + 180)
          : Math.max(group.height || 260, calculatedTopChrome + 180));
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      cards: currentCards.map((c) =>
        c.id === groupId
          ? {
              ...c,
              card_ids: [],
              width: snapToGridSignal.value ? snapToGrid(emptyW) : emptyW,
              height: snapToGridSignal.value ? snapToGrid(emptyH) : emptyH,
              column_width: Math.max(280, emptyW - padX * 2),
            }
          : c
      ),
    };
    saveCurrentBoardToStore();
    return;
  }

  let currentY = group.y + padTop;
  const updatedChildPositions = {};

  orderedMembers.forEach((c) => {
    const childH = c.height || 200;
    updatedChildPositions[c.id] = {
      x: group.x + padX,
      y: currentY,
      width: columnWidth,
    };
    currentY += childH + gapY;
  });

  // Dedicated bottom padding: 16px gap below last card + 42px drop zone + 16px container margin
  const padBottom = 74;
  const totalCalculatedHeight = (currentY - gapY + padBottom) - group.y;
  const autoGroupHeight = group.collapsed
    ? 52
    : snapToGridSignal.value
      ? snapToGrid(Math.max(260, totalCalculatedHeight))
      : Math.max(260, totalCalculatedHeight);

  // If forceFit, tightly fit autoGroupHeight. If free transformed, preserve group.height if larger
  const finalGroupHeight = group.collapsed
    ? 52
    : (forceFit ? autoGroupHeight : Math.max(group.height || 260, autoGroupHeight));

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: currentCards.map((c) => {
      if (c.id === groupId) {
        return {
          ...c,
          card_ids: orderedMembers.map((m) => m.id),
          width: finalGroupWidth,
          height: finalGroupHeight,
          column_width: columnWidth,
          layout: 'column',
        };
      }
      if (updatedChildPositions[c.id]) {
        return {
          ...c,
          group_id: groupId,
          x: updatedChildPositions[c.id].x,
          y: updatedChildPositions[c.id].y,
          width: updatedChildPositions[c.id].width,
          zIndex: Math.max(c.zIndex || 1, 2),
        };
      }
      return c;
    }),
  };

  saveCurrentBoardToStore();
};

export const autoOrderGroupCards = (groupId, criterion = 'current') => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const group = currentCards.find((c) => c.id === groupId);
  if (!group) return;

  const memberIds = Array.isArray(group.card_ids) ? group.card_ids : [];
  const memberCards = currentCards.filter(
    (c) => memberIds.includes(c.id) || c.group_id === groupId
  );

  if (memberCards.length === 0) {
    showToast('No cards in group to order');
    return;
  }

  let sortedIds;
  if (criterion === 'title') {
    sortedIds = [...memberCards]
      .sort((a, b) => (a.title || a.type).localeCompare(b.title || b.type))
      .map((c) => c.id);
  } else if (criterion === 'type') {
    const typeOrder = ['heading', 'note', 'tasklist', 'image', 'link', 'geo', 'palette', 'file', 'social', 'embed', 'quote', 'board'];
    sortedIds = [...memberCards]
      .sort((a, b) => {
        const orderA = typeOrder.indexOf(a.type);
        const orderB = typeOrder.indexOf(b.type);
        return (orderA !== -1 ? orderA : 99) - (orderB !== -1 ? orderB : 99);
      })
      .map((c) => c.id);
  } else {
    // Current Y position order
    sortedIds = [...memberCards].sort((a, b) => a.y - b.y).map((c) => c.id);
  }

  autoLayoutGroupColumn(groupId, sortedIds, false);
  showToast(`Auto-ordered 1-column stack (${memberCards.length} cards) and resized group`);
};

export const reorderGroupMember = (groupId, cardId, direction) => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const group = currentCards.find((c) => c.id === groupId);
  if (!group || !Array.isArray(group.card_ids)) return;

  const ids = [...group.card_ids];
  const idx = ids.indexOf(cardId);
  if (idx === -1) return;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= ids.length) return;

  // Swap
  const temp = ids[idx];
  ids[idx] = ids[targetIdx];
  ids[targetIdx] = temp;

  autoLayoutGroupColumn(groupId, ids, false);
  showToast(`Card moved ${direction} in group column`);
};

export const setGroupColumnWidth = (groupId, targetWidth) => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const group = currentCards.find((c) => c.id === groupId);
  if (!group) return;

  const validW = Math.max(260, Math.min(600, targetWidth));
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: currentCards.map((c) =>
      c.id === groupId ? { ...c, column_width: validW } : c
    ),
  };
  autoLayoutGroupColumn(groupId, null, false);
  showToast(`Group column width set to ${validW}px`);
};

export const createGroupCard = (config = {}) => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const memberIds = Array.isArray(config.card_ids) ? config.card_ids : [];
  const memberCards = currentCards.filter((c) => memberIds.includes(c.id));

  let x = config.x || 120;
  let y = config.y || 120;

  if (memberCards.length > 0) {
    const minX = Math.min(...memberCards.map((c) => c.x));
    const minY = Math.min(...memberCards.map((c) => c.y));
    x = Math.max(24, minX - 20);
    y = Math.max(24, minY - 54);
  } else if (snapToGridSignal.value) {
    x = snapToGrid(x);
    y = snapToGrid(y);
  }

  const newGroup = {
    id: createId('group'),
    type: 'group',
    x,
    y,
    width: 380,
    height: 220,
    title: config.title || (memberCards.length > 0 ? `Group (${memberCards.length} Cards)` : 'New Group'),
    description: config.description || '1-column container for organizing and auto-ordering cards',
    color: config.color || 'slate',
    card_ids: memberIds,
    collapsed: false,
    layout: 'column',
    column_width: 340,
    zIndex: 0,
  };

  const updatedCards = currentCards.map((c) => {
    if (memberIds.includes(c.id)) {
      return {
        ...c,
        group_id: newGroup.id,
        zIndex: Math.max(c.zIndex || 1, 2),
      };
    }
    return c;
  });

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: [...updatedCards, newGroup],
  };

  // Run autoLayoutGroupColumn to enforce 1-column layout and auto-resize dimensions
  autoLayoutGroupColumn(newGroup.id, memberIds, false);

  selectedCardsSignal.value = [newGroup.id];
  saveCurrentBoardToStore();
  showToast(`Created 1-column group "${newGroup.title}" with ${memberIds.length} card${memberIds.length !== 1 ? 's' : ''}`);
  return newGroup;
};

export const addCardToGroup = (groupId, cardId, insertIndex = -1) => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const groupCard = currentCards.find((c) => c.id === groupId);
  const targetCard = currentCards.find((c) => c.id === cardId);
  if (!groupCard || !targetCard || targetCard.id === groupId) return;

  const existingIds = (Array.isArray(groupCard.card_ids) ? groupCard.card_ids : []).filter(
    (id) => id !== cardId
  );

  let newIds;
  if (insertIndex >= 0 && insertIndex <= existingIds.length) {
    newIds = [...existingIds];
    newIds.splice(insertIndex, 0, cardId);
  } else {
    newIds = [...existingIds, cardId];
  }

  // Update targetCard group_id
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: currentCards.map((c) => {
      if (c.id === cardId) {
        return { ...c, group_id: groupId };
      }
      return c;
    }),
  };

  autoLayoutGroupColumn(groupId, newIds, false);
  showToast(`Added "${targetCard.title || 'Card'}" to group column "${groupCard.title}"`);
};

export const removeCardFromGroup = (groupId, cardId) => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const groupCard = currentCards.find((c) => c.id === groupId);
  const targetCard = currentCards.find((c) => c.id === cardId);

  const existingIds = (Array.isArray(groupCard?.card_ids) ? groupCard.card_ids : []).filter(
    (id) => id !== cardId
  );

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: currentCards.map((c) => {
      if (c.id === cardId) {
        return { ...c, group_id: null };
      }
      return c;
    }),
  };

  if (groupCard) {
    autoLayoutGroupColumn(groupId, existingIds, false);
  }

  saveCurrentBoardToStore();
  showToast(`Removed "${targetCard?.title || 'Card'}" from group "${groupCard?.title || 'Group'}"`);
};

export const ungroupCards = (groupId) => {
  pushHistorySnapshot();
  const currentCards = activeBoardSignal.value.cards || [];
  const groupCard = currentCards.find((c) => c.id === groupId);
  if (!groupCard) return;

  const memberIds = groupCard.card_ids || [];

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: currentCards
      .filter((c) => c.id !== groupId)
      .map((c) => {
        if (c.group_id === groupId || memberIds.includes(c.id)) {
          return {
            ...c,
            group_id: null,
          };
        }
        return c;
      }),
  };

  selectedCardsSignal.value = memberIds;
  saveCurrentBoardToStore();
  showToast(`Ungrouped "${groupCard.title}" (${memberIds.length} cards released)`);
};

export const autoArrangeGroupCards = (groupId, layout = 'column') => {
  autoLayoutGroupColumn(groupId, null, true);
  showToast('Auto-ordered 1-column stack and resized group');
};

export const fitGroupBounds = (groupId) => {
  autoLayoutGroupColumn(groupId, null, true);
  showToast('Auto-resized group dimension to fit cards');
};

export const duplicateCard = (cardId) => {
  const card = activeBoardSignal.value.cards.find((c) => c.id === cardId);
  if (!card) return;

  pushHistorySnapshot();
  const maxZ = activeBoardSignal.value.cards.reduce((acc, c) => Math.max(acc, c.zIndex || 1), 1);
  const offset = snapToGridSignal.value ? 48 : 30;

  const duplicated = {
    ...card,
    id: createId('card'),
    x: card.x + offset,
    y: card.y + offset,
    title: `${card.title} (Copy)`,
    zIndex: maxZ + 1,
  };

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: [...activeBoardSignal.value.cards, duplicated],
  };

  selectedCardsSignal.value = [duplicated.id];
  saveCurrentBoardToStore();
  showToast('Card duplicated');
};

/**
 * Batch delete all currently selected cards
 */
export const deleteSelectedCards = () => {
  const selected_ids = selectedCardsSignal.value || [];
  if (selected_ids.length === 0) return;

  selected_ids.forEach((id) => deleted_card_ids_set.add(id));
  pushHistorySnapshot();
  const current_cards = activeBoardSignal.value.cards || [];
  const current_conns = activeBoardSignal.value.connections || [];
  const count = selected_ids.length;
  const cur_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';

  const cards_to_delete = current_cards.filter((c) => selected_ids.includes(c.id));
  const remaining_cards = current_cards.filter((c) => !selected_ids.includes(c.id));
  const remaining_conns = current_conns.filter(
    (conn) => !selected_ids.includes(conn.fromId) && !selected_ids.includes(conn.toId)
  );

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: remaining_cards,
    board_card: remaining_cards,
    connections: remaining_conns,
    board_connection: remaining_conns,
    board_conenctions: remaining_conns,
    updatedAt: Date.now(),
  };

  selectedCardsSignal.value = [];
  saveCurrentBoardToStore({ immediate: true });

  if (!isRemoteUpdateFlag.current) {
    cards_to_delete.forEach((card) => {
      if (typeof fetch !== 'undefined') {
        fetch(
          `/api/cards/${encodeURIComponent(card.id)}?board_id=${encodeURIComponent(cur_board_id)}`,
          {
            method: 'DELETE',
            headers: {
              ...get_lumen_auth_headers(),
            },
          }
        ).catch(() => {});
      }
      broadcastCardDelete(card.id, card.title || card.type, card.type);
      const card_fid = extract_file_id_from_board_item(card);
      if (card_fid) {
        const still_used = remaining_cards.some((c) => extract_file_id_from_board_item(c) === card_fid);
        if (!still_used) {
          delete_storage_file_for_board_item(
            card_fid,
            card.file_name || card.title || '',
            cur_board_id
          ).catch(() => {});
        }
      }
    });
  }

  showToast(`Deleted ${count} card${count !== 1 ? 's' : ''}`);
};

/**
 * Batch duplicate all currently selected cards
 */
export const duplicateSelectedCards = () => {
  const selected_ids = selectedCardsSignal.value || [];
  if (selected_ids.length === 0) return;

  pushHistorySnapshot();
  const current_cards = activeBoardSignal.value.cards || [];
  const offset = snapToGridSignal.value ? 48 : 36;
  const max_z = current_cards.reduce((acc, c) => Math.max(acc, c.zIndex || 1), 1);

  const new_cards = [];
  const new_ids = [];

  current_cards
    .filter((c) => selected_ids.includes(c.id))
    .forEach((card, idx) => {
      const new_id = createId('card');
      const duplicated = {
        ...card,
        id: new_id,
        x: card.x + offset,
        y: card.y + offset,
        title: card.title ? `${card.title} (Copy)` : 'Card (Copy)',
        zIndex: max_z + idx + 1,
      };
      new_cards.push(duplicated);
      new_ids.push(new_id);
    });

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: [...current_cards, ...new_cards],
  };

  selectedCardsSignal.value = new_ids;
  saveCurrentBoardToStore();

  if (!isRemoteUpdateFlag.current) {
    new_cards.forEach((card) => {
      broadcastCardAdd(card);
    });
  }

  showToast(`Duplicated ${new_cards.length} cards`);
};

/**
 * Batch lock or unlock all currently selected cards
 */
export const lockSelectedCards = (forceLocked = null) => {
  const selected_ids = selectedCardsSignal.value || [];
  if (selected_ids.length === 0) return;

  pushHistorySnapshot();
  const current_cards = activeBoardSignal.value.cards || [];
  const any_unlocked = current_cards.some((c) => selected_ids.includes(c.id) && !c.locked);
  const target_state = forceLocked !== null ? Boolean(forceLocked) : any_unlocked;

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: current_cards.map((c) => {
      if (selected_ids.includes(c.id)) {
        return { ...c, locked: target_state };
      }
      return c;
    }),
  };

  saveCurrentBoardToStore();
  showToast(target_state ? `Locked ${selected_ids.length} cards` : `Unlocked ${selected_ids.length} cards`);
};

/**
 * Batch align all currently selected cards
 */
export const alignSelectedCards = (alignment) => {
  const selected_ids = selectedCardsSignal.value || [];
  if (selected_ids.length < 2) {
    showToast('Select 2 or more cards to align');
    return;
  }

  pushHistorySnapshot();
  const current_cards = activeBoardSignal.value.cards || [];
  const target_cards = current_cards.filter((c) => selected_ids.includes(c.id));

  let updated_positions = new Map();

  switch (alignment) {
    case 'left': {
      const min_x = Math.min(...target_cards.map((c) => c.x));
      target_cards.forEach((c) => updated_positions.set(c.id, { x: min_x, y: c.y }));
      break;
    }
    case 'right': {
      const max_right = Math.max(...target_cards.map((c) => c.x + (c.width || 320)));
      target_cards.forEach((c) => updated_positions.set(c.id, { x: max_right - (c.width || 320), y: c.y }));
      break;
    }
    case 'center': {
      const avg_center = target_cards.reduce((acc, c) => acc + (c.x + (c.width || 320) / 2), 0) / target_cards.length;
      target_cards.forEach((c) => updated_positions.set(c.id, { x: Math.round(avg_center - (c.width || 320) / 2), y: c.y }));
      break;
    }
    case 'top': {
      const min_y = Math.min(...target_cards.map((c) => c.y));
      target_cards.forEach((c) => updated_positions.set(c.id, { x: c.x, y: min_y }));
      break;
    }
    case 'bottom': {
      const max_bottom = Math.max(...target_cards.map((c) => c.y + (c.height || 200)));
      target_cards.forEach((c) => updated_positions.set(c.id, { x: c.x, y: max_bottom - (c.height || 200) }));
      break;
    }
    case 'distribute_h': {
      const sorted = [...target_cards].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const total_span = (last.x + (last.width || 320)) - first.x;
      const total_widths = sorted.reduce((sum, c) => sum + (c.width || 320), 0);
      const gap = Math.max(20, (total_span - total_widths) / (sorted.length - 1));
      let current_x = first.x;
      sorted.forEach((c) => {
        updated_positions.set(c.id, { x: Math.round(current_x), y: c.y });
        current_x += (c.width || 320) + gap;
      });
      break;
    }
    default:
      return;
  }

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: current_cards.map((c) => {
      if (updated_positions.has(c.id)) {
        const next_pos = updated_positions.get(c.id);
        return { ...c, ...next_pos };
      }
      return c;
    }),
  };

  saveCurrentBoardToStore();

  if (!isRemoteUpdateFlag.current) {
    updated_positions.forEach((pos, id) => {
      broadcastCardMove(id, pos.x, pos.y, true, 'Card', 'card');
    });
  }

  showToast(`Aligned ${target_cards.length} cards (${alignment})`);
};

/**
 * Select all cards on current board
 */
export const selectAllCards = () => {
  const current_cards = activeBoardSignal.value?.cards || [];
  const selectable_ids = current_cards.filter((c) => !c.hidden).map((c) => c.id);
  selectedCardsSignal.value = selectable_ids;
  if (typeof broadcastCardSelect === 'function') {
    broadcastCardSelect(selectable_ids);
  }
  showToast(`Selected all ${selectable_ids.length} cards`);
};

/**
 * Clear selection
 */
export const clearCardSelection = () => {
  selectedCardsSignal.value = [];
  if (typeof broadcastCardSelect === 'function') {
    broadcastCardSelect([]);
  }
};

/**
 * Deterministic descending sort by zIndex (top/front layer first)
 */
export const getSortedLayerCards = (cardsList) => {
  return [...(cardsList || [])].sort((a, b) => {
    const za = typeof a.zIndex === 'number' ? a.zIndex : 1;
    const zb = typeof b.zIndex === 'number' ? b.zIndex : 1;
    if (zb !== za) return zb - za;
    return (b.y || 0) - (a.y || 0);
  });
};

/**
 * Returns a unified array of visual layer items (Cards + PNG Drawing Images / Stickers)
 * sorted deterministically from TOP to BOTTOM (highest zIndex first, index 0 is top).
 */
export const getUnifiedBoardLayers = (board = activeBoardSignal.value) => {
  if (!board) return [];
  const cards = (Array.isArray(board.cards) && board.cards.length > 0)
    ? board.cards
    : (Array.isArray(board.board_card) ? board.board_card : (Array.isArray(board.cards) ? board.cards : []));
  const drawings = (Array.isArray(board.drawings) && board.drawings.length > 0)
    ? board.drawings
    : (Array.isArray(board.board_drawing) ? board.board_drawing : (Array.isArray(board.drawings) ? board.drawings : []));
  const image_drawings = drawings.filter((d) => d.type === 'image');

  const unified = [];

  cards.forEach((c) => {
    unified.push({
      id: c.id,
      kind: 'card',
      type: c.type || 'note',
      title: c.title || c.type || 'Card',
      zIndex: typeof c.zIndex === 'number' ? c.zIndex : 1,
      createdAt: c.createdAt || 0,
      isLocked: Boolean(c.isLocked),
      isHidden: Boolean(c.isHidden),
      src: c.content?.imageUrl || c.imageUrl || (c.type === 'image' ? (c.content?.src || c.src) : null),
      raw: c,
    });
  });

  image_drawings.forEach((img) => {
    unified.push({
      id: img.id,
      kind: 'drawing_image',
      type: 'sticker',
      title: img.name || 'PNG Sticker',
      zIndex: typeof img.zIndex === 'number' ? img.zIndex : 1,
      createdAt: img.createdAt || 0,
      isLocked: Boolean(img.locked),
      isHidden: img.visible === false,
      src: img.src,
      raw: img,
    });
  });

  // Sort TOP to BOTTOM (highest zIndex first, so top layer is index 0)
  unified.sort((a, b) => {
    const za = typeof a.zIndex === 'number' ? a.zIndex : 1;
    const zb = typeof b.zIndex === 'number' ? b.zIndex : 1;
    if (zb !== za) return zb - za;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return unified;
};

/**
 * Reorders all board layers (Cards + PNG Drawing Images / Stickers) across a single unified stacking context.
 * orderedIdsTopToBottom: Array of item IDs from top (index 0) to bottom (index total - 1).
 */
export const reorderUnifiedLayers = (orderedIdsTopToBottom) => {
  if (!Array.isArray(orderedIdsTopToBottom) || orderedIdsTopToBottom.length === 0) return;
  pushHistorySnapshot();

  const currentBoard = activeBoardSignal.value || {};
  const currentCards = [...(currentBoard.cards || [])];
  const currentDrawings = [...(currentBoard.drawings || [])];

  const strokes = currentDrawings.filter((d) => d.type !== 'image');
  const imageLayers = currentDrawings.filter((d) => d.type === 'image');

  // Guarantee all items on board are accounted for without dropping any
  const allOrderedIds = [...orderedIdsTopToBottom];
  currentCards.forEach((c) => {
    if (!allOrderedIds.includes(c.id)) {
      allOrderedIds.push(c.id);
    }
  });
  imageLayers.forEach((img) => {
    if (!allOrderedIds.includes(img.id)) {
      allOrderedIds.push(img.id);
    }
  });

  const total = allOrderedIds.length;

  // Stacking zIndex: Top item (index 0) gets `total`, bottom item gets 1
  const updatedCards = currentCards.map((c) => {
    const pos = allOrderedIds.indexOf(c.id);
    if (pos !== -1) {
      return {
        ...c,
        zIndex: total - pos,
      };
    }
    return c;
  });

  const updatedImages = imageLayers.map((img) => {
    const pos = allOrderedIds.indexOf(img.id);
    if (pos !== -1) {
      return {
        ...img,
        zIndex: total - pos,
      };
    }
    return img;
  });

  // Sort ascending by zIndex so DOM rendering order aligns with zIndex hierarchy
  updatedCards.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
  updatedImages.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

  const next_unified_drawings = [...strokes, ...updatedImages];
  activeBoardSignal.value = {
    ...currentBoard,
    cards: updatedCards,
    board_card: updatedCards,
    drawings: next_unified_drawings,
    board_drawing: next_unified_drawings,
    updatedAt: Date.now(),
  };

  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore();

  if (!isRemoteUpdateFlag.current) {
    updatedCards.forEach((c) => {
      const pos = allOrderedIds.indexOf(c.id);
      if (pos !== -1) {
        broadcastCardUpdate(c.id, { zIndex: c.zIndex }, false);
      }
    });
  }
};

/**
 * Moves a unified layer item (Card or PNG Drawing Image) up, down, to front, or to back.
 */
export const moveUnifiedLayer = (itemId, direction, silent = false) => {
  const unified = getUnifiedBoardLayers(activeBoardSignal.value);
  const idx = unified.findIndex((item) => item.id === itemId);
  if (idx === -1) return;

  const targetItem = unified[idx];
  const orderedIds = unified.map((item) => item.id);

  if (direction === 'front') {
    if (idx === 0) return;
    const [target] = orderedIds.splice(idx, 1);
    orderedIds.unshift(target);
  } else if (direction === 'back') {
    if (idx === orderedIds.length - 1) return;
    const [target] = orderedIds.splice(idx, 1);
    orderedIds.push(target);
  } else if (direction === 'up') {
    // In top-to-bottom array, "up" (higher layer / forward) is index - 1
    if (idx <= 0) return;
    const temp = orderedIds[idx];
    orderedIds[idx] = orderedIds[idx - 1];
    orderedIds[idx - 1] = temp;
  } else if (direction === 'down') {
    // "down" (lower layer / backward) is index + 1
    if (idx >= orderedIds.length - 1) return;
    const temp = orderedIds[idx];
    orderedIds[idx] = orderedIds[idx + 1];
    orderedIds[idx + 1] = temp;
  }

  reorderUnifiedLayers(orderedIds);
  if (!silent) {
    const title = targetItem.title || 'Layer';
    showToast(
      direction === 'front'
        ? `Brought "${title}" to front`
        : direction === 'back'
        ? `Sent "${title}" to back`
        : direction === 'up'
        ? `Moved "${title}" forward`
        : `Moved "${title}" backward`
    );
  }
};

export const bringToFront = (cardId) => {
  moveUnifiedLayer(cardId, 'front');
};

export const sendToBack = (cardId) => {
  moveUnifiedLayer(cardId, 'back');
};

export const bringCardForward = (cardId) => {
  moveUnifiedLayer(cardId, 'up');
};

export const sendCardBackward = (cardId) => {
  moveUnifiedLayer(cardId, 'down');
};

export const moveCardLayer = (cardId, direction, silent = false) => {
  moveUnifiedLayer(cardId, direction, silent);
};

export const reorderCardsLayers = (orderedIdsTopToBottom) => {
  reorderUnifiedLayers(orderedIdsTopToBottom);
};

/**
 * Normalizes all card zIndexes into unique integers from total down to 1
 */
export const normalizeCardZIndexes = () => {
  const currentCards = [...(activeBoardSignal.value?.cards || [])];
  if (currentCards.length === 0) return;

  const sorted = [...currentCards].sort((a, b) => {
    const za = typeof a.zIndex === 'number' ? a.zIndex : 1;
    const zb = typeof b.zIndex === 'number' ? b.zIndex : 1;
    if (zb !== za) return zb - za;
    return currentCards.indexOf(b) - currentCards.indexOf(a);
  });

  const total = sorted.length;
  let changed = false;
  const updatedCards = currentCards.map((c) => {
    const pos = sorted.findIndex((s) => s.id === c.id);
    const targetZ = total - pos;
    if (c.zIndex !== targetZ) {
      changed = true;
      return { ...c, zIndex: targetZ };
    }
    return c;
  });

  if (changed) {
    updatedCards.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    activeBoardSignal.value = {
      ...activeBoardSignal.value,
      cards: updatedCards,
    };
    saveCurrentBoardToStore();
    showToast('Layer stack z-indexes normalized');
  }
};

export const toggleCardLock = (cardId, silent = false) => {
  const card = (activeBoardSignal.value.cards || []).find((c) => c.id === cardId);
  if (!card) return;
  const nextVal = !card.locked;
  updateCard(cardId, { locked: nextVal }, false);
  if (!silent) {
    showToast(nextVal ? `Locked "${card.title || 'Card'}"` : `Unlocked "${card.title || 'Card'}"`);
  }
};

export const toggleCardVisibility = (cardId, silent = false) => {
  const card = (activeBoardSignal.value.cards || []).find((c) => c.id === cardId);
  if (!card) return;
  const nextVal = !card.hidden;
  updateCard(cardId, { hidden: nextVal }, false);
  if (!silent) {
    showToast(nextVal ? `Hidden "${card.title || 'Card'}" on canvas` : `Showing "${card.title || 'Card'}" on canvas`);
  }
};

export const focusOnCard = (cardId, shouldZoom = false) => {
  const card = (activeBoardSignal.value.cards || []).find((c) => c.id === cardId);
  if (!card) return;
  selectedCardsSignal.value = [cardId];
  openPropertyPanel();

  const vp = activeBoardSignal.value.viewport || { panX: 0, panY: 0, zoom: 1 };
  const zoom = shouldZoom ? 1 : (vp.zoom || 1);
  const leftOffset = 76 + ((isLayerPanelOpenSignal.value || isBoardSettingsPanelOpenSignal.value) ? 280 : 0);
  const availableW = Math.max(300, window.innerWidth - leftOffset - 320);
  const availableH = Math.max(300, window.innerHeight - 54);
  const targetX = leftOffset + availableW / 2 - (card.x + (card.width || 320) / 2) * zoom;
  const targetY = 54 + availableH / 2 - (card.y + (card.height || 200) / 2) * zoom;
  updateViewport(targetX, targetY, zoom);
};

export const showAllCards = () => {
  pushHistorySnapshot();
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: (activeBoardSignal.value.cards || []).map((c) => ({ ...c, hidden: false })),
  };
  saveCurrentBoardToStore();
  showToast('All cards set to visible');
};

export const hideAllCards = () => {
  pushHistorySnapshot();
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: (activeBoardSignal.value.cards || []).map((c) => ({ ...c, hidden: true })),
  };
  saveCurrentBoardToStore();
  showToast('All cards hidden on canvas');
};

export const unlockAllCards = () => {
  pushHistorySnapshot();
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: (activeBoardSignal.value.cards || []).map((c) => ({ ...c, locked: false })),
  };
  saveCurrentBoardToStore();
  showToast('All cards unlocked');
};

export const lockAllCards = () => {
  pushHistorySnapshot();
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    cards: (activeBoardSignal.value.cards || []).map((c) => ({ ...c, locked: true })),
  };
  saveCurrentBoardToStore();
  showToast('All cards locked');
};

export const addConnection = (fromId, toId, label = '') => {
  if (fromId === toId) return;
  const exists = activeBoardSignal.value.connections.some(
    (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
  );
  if (exists) {
    showToast('Already connected');
    return;
  }

  pushHistorySnapshot();
  const newConn = {
    id: createId('conn'),
    fromId,
    toId,
    label,
    style: 'solid',
    color: '#2563eb',
  };

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    connections: [...activeBoardSignal.value.connections, newConn],
  };

  saveCurrentBoardToStore();
  showToast('Connector added');

  if (!isRemoteUpdateFlag.current) {
    const fromCard = activeBoardSignal.value.cards.find((c) => c.id === fromId);
    const toCard = activeBoardSignal.value.cards.find((c) => c.id === toId);
    broadcastConnectionAdd(newConn, fromCard?.title || 'Card', toCard?.title || 'Card');
  }
};

export const deleteConnection = (connId) => {
  pushHistorySnapshot();
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    connections: activeBoardSignal.value.connections.filter((c) => c.id !== connId),
  };
  saveCurrentBoardToStore();
  showToast('Connector removed');

  if (!isRemoteUpdateFlag.current) {
    broadcastConnectionDelete(connId);
  }
};

export const createNewBoard = (name = 'New Creative Workspace', boardType = 'snap_grid') => {
  const newId = createBoardId();
  const isSnap = boardType === 'snap_grid';
  const currentGridDim = (gridDimensionSignal && gridDimensionSignal.value) || 24;
  const initial_board_setting = {
    board_type: boardType,
    grid_dimension: currentGridDim,
    color_theme: 'default',
    description: isSnap ? `${currentGridDim}px grid aligned workspace` : 'Fluid freeform spatial board',
    grid_style: 'dots',
    card_corner_style: 'rounded',
    default_card_color: isSnap ? 'yellow' : 'peach',
    show_card_shadows: true,
  };

  const auth_payload = get_lumen_auth_payload();
  const newBoardMeta = {
    id: newId,
    board_code: newId,
    title: name,
    board_name: name,
    description: isSnap ? `${currentGridDim}px grid aligned workspace` : 'Fluid freeform spatial board',
    board_description: isSnap ? `${currentGridDim}px grid aligned workspace` : 'Fluid freeform spatial board',
    updatedAt: Date.now(),
    cardCount: 0,
    accentColor: isSnap ? '#2563eb' : '#d97706',
    boardType,
    board_type: boardType,
    gridDimension: currentGridDim,
    grid_dimension: currentGridDim,
    board_setting: initial_board_setting,
    vendor_code: auth_payload?.vendor_code || null,
    master_code: auth_payload?.master_code || null,
    project_code: auth_payload?.project_code || null,
    user_account: auth_payload?.user_account || null,
  };

  const newBoardData = {
    id: newId,
    board_code: newId,
    title: name,
    board_name: name,
    description: isSnap ? `${currentGridDim}px grid aligned workspace` : 'Fluid freeform spatial board',
    board_description: isSnap ? `${currentGridDim}px grid aligned workspace` : 'Fluid freeform spatial board',
    updatedAt: Date.now(),
    boardType,
    board_type: boardType,
    gridDimension: currentGridDim,
    grid_dimension: currentGridDim,
    board_setting: initial_board_setting,
    vendor_code: auth_payload?.vendor_code || null,
    master_code: auth_payload?.master_code || null,
    project_code: auth_payload?.project_code || null,
    user_account: auth_payload?.user_account || null,
    viewport: { panX: 160, panY: 100, zoom: 1 },
    board_viewport: { panX: 160, panY: 100, zoom: 1 },
    cards: [],
    board_card: [],
    connections: [],
    board_connection: [],
    board_conenctions: [],
    drawings: [],
    board_drawing: [],
    time_create: new Date().toISOString(),
    time_modify: new Date().toISOString(),
  };

  server_hydrated_board_ids.add(newId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LAST_ACTIVE_BOARD_STORAGE_KEY, newId);
    } catch (_) {}
  }

  batch(() => {
    boardsDirectorySignal.value = [newBoardMeta, ...boardsDirectorySignal.value];
    activeBoardIdSignal.value = newId;
    activeBoardSignal.value = newBoardData;
    snapToGridSignal.value = isSnap;
  });

  // Immediately persist to PostgreSQL backend and refresh directory from server
  saveCurrentBoardToStore({ immediate: true });

  showToast(`Created ${isSnap ? 'Snap to Grid' : 'Free Position'} board "${name}"`);
  return newId;
};

export const createBoardFromExportConfig = (raw_export_config, options = {}) => {
  if (!raw_export_config || typeof raw_export_config !== 'object') {
    showToast('Invalid board configuration payload');
    return null;
  }

  const normalized_export = build_board_export_payload(raw_export_config, {
    title: options.title || raw_export_config.title || raw_export_config.board_name,
    description: options.description !== undefined ? options.description : (raw_export_config.description || raw_export_config.board_description),
  });

  if (!normalized_export) {
    showToast('Failed to parse board configuration');
    return null;
  }

  const activate_board = options.activate !== false;
  if (activate_board) {
    pushHistorySnapshot();
  }

  const currentId = options.boardId || createBoardId();
  const bType = normalized_export.boardType || normalized_export.board_type || 'snap_grid';
  const currentGridDim = Number(
    normalized_export.gridDimension ||
      normalized_export.grid_dimension ||
      (gridDimensionSignal && gridDimensionSignal.value) ||
      24
  );

  const initial_setting = {
    ...(normalized_export.board_setting || {}),
    board_type: bType,
    grid_dimension: currentGridDim,
  };

  const auth_payload = get_lumen_auth_payload();
  const resolved_vendor_code = auth_payload?.vendor_code || activeBoardSignal.value?.vendor_code || 'lumen';
  const resolved_master_code = auth_payload?.master_code || activeBoardSignal.value?.master_code || 'mysuperid';
  const resolved_project_code = auth_payload?.project_code || activeBoardSignal.value?.project_code || 'mysuperid';
  const resolved_user_account = auth_payload?.user_account || activeBoardSignal.value?.user_account || null;

  const effective_auth = {
    ...(auth_payload || {}),
    vendor_code: resolved_vendor_code,
    master_code: resolved_master_code,
    project_code: resolved_project_code,
    user_account: resolved_user_account,
  };

  // Remap exported card IDs to fresh UUIDv4s so multiple imported/duplicated/template boards never collide in lm_board_card
  const raw_cards = Array.isArray(normalized_export.cards)
    ? normalized_export.cards
    : Array.isArray(normalized_export.board_card)
    ? normalized_export.board_card
    : [];

  const card_id_map = new Map();
  raw_cards.forEach((c) => {
    const old_id = c && (c.id || c.card_code);
    if (old_id) {
      card_id_map.set(old_id, createCardId());
    }
  });

  const instantiated_cards = raw_cards.map((c) => {
    const old_id = c && (c.id || c.card_code);
    const mapped_id = (old_id && card_id_map.get(old_id)) || createCardId();
    const mapped_group_id =
      c.group_id && card_id_map.has(c.group_id)
        ? card_id_map.get(c.group_id)
        : c.group_id || null;
    const mapped_card_ids = Array.isArray(c.card_ids)
      ? c.card_ids.map((cid) => card_id_map.get(cid) || cid)
      : undefined;

    return {
      ...c,
      id: mapped_id,
      card_code: mapped_id,
      ...(mapped_group_id ? { group_id: mapped_group_id } : {}),
      ...(mapped_card_ids ? { card_ids: mapped_card_ids } : {}),
      vendor_code: resolved_vendor_code,
      master_code: resolved_master_code,
      project_code: resolved_project_code,
      user_account: resolved_user_account,
    };
  });

  const raw_connections = Array.isArray(normalized_export.connections)
    ? normalized_export.connections
    : Array.isArray(normalized_export.board_connection)
    ? normalized_export.board_connection
    : [];

  const instantiated_connections = raw_connections.map((conn, idx) => ({
    ...conn,
    id: `conn_${Date.now()}_${idx}`,
    fromId: card_id_map.get(conn.fromId) || conn.fromId,
    toId: card_id_map.get(conn.toId) || conn.toId,
  }));

  const instantiated_drawings = Array.isArray(normalized_export.drawings)
    ? JSON.parse(JSON.stringify(normalized_export.drawings))
    : [];

  const instantiated_viewport = normalized_export.viewport
    ? { ...normalized_export.viewport }
    : { panX: 120, panY: 80, zoom: 1 };

  const board_title = options.title || normalized_export.title || normalized_export.board_name || 'Untitled Board';
  const board_desc =
    options.description !== undefined
      ? options.description
      : normalized_export.description || normalized_export.board_description || '';

  const new_board_record = {
    id: currentId,
    board_code: currentId,
    title: board_title,
    board_name: board_title,
    description: board_desc,
    board_description: board_desc,
    boardType: bType,
    board_type: bType,
    gridDimension: currentGridDim,
    grid_dimension: currentGridDim,
    board_setting: initial_setting,
    vendor_code: resolved_vendor_code,
    master_code: resolved_master_code,
    project_code: resolved_project_code,
    user_account: resolved_user_account,
    lumen_auth: effective_auth,
    viewport: instantiated_viewport,
    board_viewport: instantiated_viewport,
    cards: instantiated_cards,
    board_card: instantiated_cards,
    connections: instantiated_connections,
    board_connection: instantiated_connections,
    board_conenctions: instantiated_connections,
    drawings: instantiated_drawings,
    board_drawing: instantiated_drawings,
    updatedAt: Date.now(),
    time_create: new Date().toISOString(),
    time_modify: new Date().toISOString(),
  };

  const directory_entry = {
    id: currentId,
    board_code: currentId,
    title: board_title,
    board_name: board_title,
    description: board_desc,
    board_description: board_desc,
    boardType: bType,
    board_type: bType,
    gridDimension: currentGridDim,
    grid_dimension: currentGridDim,
    board_setting: initial_setting,
    vendor_code: resolved_vendor_code,
    master_code: resolved_master_code,
    project_code: resolved_project_code,
    user_account: resolved_user_account,
    cardCount: instantiated_cards.length,
    updatedAt: Date.now(),
  };

  server_hydrated_board_ids.add(currentId);
  if (activate_board && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LAST_ACTIVE_BOARD_STORAGE_KEY, currentId);
    } catch (_) {}
  }

  batch(() => {
    if (activate_board) {
      activeBoardIdSignal.value = currentId;
      activeBoardSignal.value = new_board_record;
      snapToGridSignal.value = bType !== 'free_position';
    }

    const list = [...boardsDirectorySignal.value];
    const idx = list.findIndex((b) => (b.id || b.board_code) === currentId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...directory_entry };
    } else {
      list.unshift(directory_entry);
    }
    boardsDirectorySignal.value = list;
  });

  if (activate_board) {
    saveCurrentBoardToStore({ immediate: true });
  } else if (typeof fetch !== 'undefined') {
    fetch(`/api/boards/${encodeURIComponent(currentId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({ board: new_board_record, lumen_auth: effective_auth }),
    })
      .then(() => fetchBoardsFromServer())
      .catch(() => {});
  }

  if (!options.silentToast) {
    showToast(
      options.toastMessage ||
        `Created "${board_title}" (${bType === 'free_position' ? 'Free Position' : 'Snap to Grid'})`
    );
  }

  return currentId;
};

export const importBoardConfiguration = createBoardFromExportConfig;

export const downloadBoardConfigurationJson = (source_board = null) => {
  const target_board = source_board || activeBoardSignal.value;
  const payload = build_board_export_payload(target_board);
  if (!payload) {
    showToast('No active board configuration to export');
    return null;
  }

  const safe_slug = (payload.title || 'lumen-board')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'lumen-board';

  const json_string = JSON.stringify(payload, null, 2);
  if (typeof document !== 'undefined') {
    const blob = new Blob([json_string], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safe_slug}.lumen-board.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  showToast(`Exported "${payload.title}" board configuration (.json)`);
  return payload;
};

export const copyBoardConfigurationJson = async (source_board = null) => {
  const target_board = source_board || activeBoardSignal.value;
  const payload = build_board_export_payload(target_board);
  if (!payload) {
    showToast('No active board configuration to copy');
    return false;
  }
  const json_string = JSON.stringify(payload, null, 2);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json_string);
      showToast(`Copied "${payload.title}" configuration JSON to clipboard`);
      return true;
    } catch (e) {
      showToast('Failed to copy configuration to clipboard');
      return false;
    }
  }
  return false;
};

export const loadTemplate = (templateKey) => {
  const template = BOARD_TEMPLATES[templateKey];
  if (!template) return null;

  const new_board_id = createBoardFromExportConfig(template, {
    activate: true,
    toastMessage: `Created "${template.title || 'Template'}" board (${
      (template.boardType || template.board_type) === 'free_position' ? 'Free Position' : 'Snap to Grid'
    })`,
  });

  isTemplateModalOpenSignal.value = false;
  return new_board_id;
};

export const clearBoard = () => {
  if (!activeBoardSignal.value) return;
  pushHistorySnapshot();
  const current = activeBoardSignal.value || {};
  const boardId = current.id;
  activeBoardSignal.value = {
    ...current,
    cards: [],
    connections: [],
    board_connection: [],
    drawings: [],
    updatedAt: Date.now(),
  };
  selectedCardsSignal.value = [];
  connectingSourceSignal.value = null;
  isPropertyPanelOpenSignal.value = false;
  saveCurrentBoardToStore();
  if (typeof broadcastBoardClear === 'function') {
    broadcastBoardClear(boardId);
  }
  showToast('All cards cleared from board');
};

export const deleteBoard = async (targetBoardId) => {
  const targetId = targetBoardId || activeBoardSignal.value?.id || activeBoardSignal.value?.board_code;
  if (!targetId) return null;

  // Mark board as tombstoned and invalidate any in-flight save sequence
  deleted_board_ids_set.add(targetId);
  latest_board_save_seq.set(targetId, ++board_save_sequence_counter);
  pending_board_saves.delete(targetId);

  // Cancel any pending debounced saves so a deleted board is never re-created
  if (local_storage_debounce_id) {
    clearTimeout(local_storage_debounce_id);
    local_storage_debounce_id = null;
  }
  if (server_sync_timeout_id) {
    clearTimeout(server_sync_timeout_id);
    server_sync_timeout_id = null;
  }

  // Delete cached board snapshot from local IndexedDB
  delete_board_from_idb(targetId).catch(() => {});

  const currentList = boardsDirectorySignal.value || [];
  const targetBoard =
    currentList.find((b) => (b.id || b.board_code) === targetId) ||
    (activeBoardSignal.value?.id === targetId ? activeBoardSignal.value : null);
  const boardTitle = targetBoard?.title || targetBoard?.board_name || 'Board';

  // Remove immediately from directory list
  const remaining = currentList.filter((b) => (b.id || b.board_code) !== targetId);
  boardsDirectorySignal.value = remaining;

  // If the deleted board was active, reset active board to null to show board list
  if (activeBoardSignal.value?.id === targetId || activeBoardIdSignal.value === targetId) {
    activeBoardIdSignal.value = null;
    activeBoardSignal.value = null;
  }

  // Delete from backend API & PostgreSQL and fetch updated list from server
  if (typeof fetch !== 'undefined') {
    try {
      await fetch(`/api/boards/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: {
          ...get_lumen_auth_headers(),
        },
      });
      await fetchBoardsFromServer();
    } catch (e) {
      console.warn('[Lumen Boards] Delete board sync error:', e);
    }
  }

  showToast(`Board "${boardTitle}" deleted`);
  return boardsDirectorySignal.value?.[0]?.id || null;
};

export const duplicateBoard = async (targetBoardId, options = {}) => {
  const targetId = targetBoardId || activeBoardSignal.value?.id || activeBoardSignal.value?.board_code;
  if (!targetId) return null;

  const currentList = boardsDirectorySignal.value || [];
  const targetMeta = currentList.find((b) => (b.id || b.board_code) === targetId);

  let boardData = null;
  // Prefer live in-memory active board if duplicating the currently open board
  if (activeBoardSignal.value && (activeBoardSignal.value.id === targetId || activeBoardSignal.value.board_code === targetId)) {
    boardData = JSON.parse(JSON.stringify(activeBoardSignal.value));
  }

  if (!boardData && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(targetId)}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...get_lumen_auth_headers(),
        },
      });
      if (res.ok) {
        const json = await safe_parse_response_json(res, null);
        if (json && json.board) {
          boardData = json.board;
        }
      }
    } catch (e) {}
  }

  if (!boardData) {
    boardData = getInitialBoardData(targetId);
  }

  const baseTitle =
    targetMeta?.title ||
    targetMeta?.board_name ||
    boardData?.title ||
    boardData?.board_name ||
    'Board';
  const newTitle = options.title || `${baseTitle} (Copy)`;
  const should_activate = Boolean(options.activate);

  // Convert source board into portable export config, then instantiate a new board with remapped card/group/connection IDs
  const portable_export = build_board_export_payload(boardData, { title: newTitle });
  const newId = createBoardFromExportConfig(portable_export, {
    title: newTitle,
    activate: should_activate,
    toastMessage: `Board duplicated as "${newTitle}"`,
  });

  return newId;
};

export const undo = () => {
  if (undoHistory.length === 0) {
    showToast('Nothing to undo');
    return;
  }
  const prevSnapshot = undoHistory.pop();
  redoHistory.push(JSON.stringify(activeBoardSignal.value));
  try {
    activeBoardSignal.value = JSON.parse(prevSnapshot);
    saveCurrentBoardToStore();
    showToast('Undo action');
  } catch (e) {
    console.error('Undo parse error', e);
  }
};

export const redo = () => {
  if (redoHistory.length === 0) {
    showToast('Nothing to redo');
    return;
  }
  const nextSnapshot = redoHistory.pop();
  undoHistory.push(JSON.stringify(activeBoardSignal.value));
  try {
    activeBoardSignal.value = JSON.parse(nextSnapshot);
    saveCurrentBoardToStore();
    showToast('Redo action');
  } catch (e) {
    console.error('Redo parse error', e);
  }
};

// ==========================================
// Drawing Mode Signals & Actions
// ==========================================
export const isDrawingModeSignal = signal(false);
export const drawingToolSignal = signal('pen'); // 'pen' | 'select' | 'eraser'
export const drawingColorSignal = signal('#1e293b'); // default dark slate matching screenshot
export const drawingWidthSignal = signal(3); // 2, 4, 8, 16
export const drawingOpacitySignal = signal(1); // 1 for solid pen, 0.35 for highlighter
export const activeStrokeSignal = signal(null); // in-progress stroke
export const hasUnsavedDrawingsSignal = signal(false);
export const hoveredEraseStrokeIdSignal = signal(null); // id of stroke currently hovered by eraser

// ==========================================
// Touch / Stylus Mode & Palm Detection State
// ==========================================
// Default mode is 'off' ([All Touch]). When toggled to 'smart' (Stylus mode),
// palm rejection is active and isPalmRestingSignal tracks whether a resting palm is currently detected.
export const palmRejectionModeSignal = signal('off'); // 'off' (All Touch) | 'smart' (Stylus)
export const isStylusActiveSignal = signal(false); // true when an active stylus/pen is detected
export const isPalmRestingSignal = signal(false); // true when a resting palm is currently detected on canvas
export const palmRejectionNoticeSignal = signal(null); // { message, type, id }
let palm_rejection_notice_timer = null;

export const setPalmRejectionMode = (mode) => {
  palmRejectionModeSignal.value = mode;
  if (mode === 'off') {
    isPalmRestingSignal.value = false;
  }
};

export const showPalmRejectionNotice = (message, type = 'filter') => {
  if (palm_rejection_notice_timer) {
    clearTimeout(palm_rejection_notice_timer);
  }
  palmRejectionNoticeSignal.value = {
    message,
    type,
    id: Date.now(),
  };
  palm_rejection_notice_timer = setTimeout(() => {
    palmRejectionNoticeSignal.value = null;
    palm_rejection_notice_timer = null;
  }, 2400);
};

// Backup for drawing session
let drawingSessionInitialState = null;

export const startDrawingSession = () => {
  drawingSessionInitialState = JSON.stringify(activeBoardSignal.value.drawings || []);
  isDrawingModeSignal.value = true;
  drawingToolSignal.value = 'pen';
  hasUnsavedDrawingsSignal.value = false;
};

export const exitDrawingSession = () => {
  drawingSessionInitialState = null;
  hasUnsavedDrawingsSignal.value = false;
  isPalmRestingSignal.value = false;
  isDrawingLayerPanelOpenSignal.value = false;
  selectedDrawingImageIdSignal.value = null;
  saveCurrentBoardToStore();
  isDrawingModeSignal.value = false;
};

export const saveDrawingSession = () => {
  exitDrawingSession();
};

export const cancelDrawingSession = () => {
  exitDrawingSession();
};

export const addDrawingStroke = (stroke) => {
  pushHistorySnapshot();
  const currentDrawings = (Array.isArray(activeBoardSignal.value?.drawings) && activeBoardSignal.value.drawings.length > 0)
    ? activeBoardSignal.value.drawings
    : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
  const nextDrawings = [...currentDrawings, stroke];
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    drawings: nextDrawings,
    board_drawing: nextDrawings,
  };
  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore();

  if (!isRemoteUpdateFlag.current) {
    broadcastDrawingAdd(stroke);
  }
};

export const eraseDrawingStroke = (strokeId) => {
  pushHistorySnapshot();
  const currentDrawings = (Array.isArray(activeBoardSignal.value?.drawings) && activeBoardSignal.value.drawings.length > 0)
    ? activeBoardSignal.value.drawings
    : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
  const nextDrawings = currentDrawings.filter((s) => s.id !== strokeId);
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    drawings: nextDrawings,
    board_drawing: nextDrawings,
  };
  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore();

  if (!isRemoteUpdateFlag.current) {
    broadcastDrawingErase(strokeId);
  }
};

export const clearDrawingStrokes = () => {
  if (!activeBoardSignal.value) return;
  const current = activeBoardSignal.value;
  const current_drawings = (Array.isArray(current.drawings) && current.drawings.length > 0)
    ? current.drawings
    : (Array.isArray(current.board_drawing) ? current.board_drawing : []);
  const stroke_items = current_drawings.filter((d) => d && d.type !== 'image');

  if (stroke_items.length === 0) {
    showToast('No drawing strokes to clear');
    return;
  }

  pushHistorySnapshot();
  const remaining_drawings = current_drawings.filter((d) => d && d.type === 'image');

  activeBoardSignal.value = {
    ...current,
    drawings: remaining_drawings,
    board_drawing: remaining_drawings,
    updatedAt: Date.now(),
  };

  activeStrokeSignal.value = null;
  hoveredEraseStrokeIdSignal.value = null;
  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore({ immediate: true });

  if (!isRemoteUpdateFlag.current && typeof broadcastDrawingErase === 'function') {
    stroke_items.forEach((stroke) => {
      if (stroke && stroke.id) {
        broadcastDrawingErase(stroke.id);
      }
    });
  }

  showToast('All drawing strokes cleared from board (Undo: Ctrl+Z)');
};

// ==========================================
// Drawing Layer & Image Manipulation State
// ==========================================
export const isDrawingLayerPanelOpenSignal = signal(false);
export const selectedDrawingImageIdSignal = signal(null);

const deleted_drawing_image_ids = new Set();

function extract_file_id_from_board_item(item) {
  if (!item) return null;
  if (item.file_storage_code) return String(item.file_storage_code);
  if (item.fileId) return String(item.fileId);
  if (item.file_id) return String(item.file_id);
  const candidates = [
    item.src,
    item.viewUrl,
    item.view_url,
    item.fileUrl,
    item.file_url,
    item.imageUrl,
  ];
  for (const val of candidates) {
    if (typeof val === 'string') {
      const m_api = val.match(/\/api\/files\/(?:view|download)\/([0-9a-f-]{36}|file_[0-9]+_[a-z0-9]+)/i);
      if (m_api?.[1]) return m_api[1];
      const m = val.match(/file_[0-9]+_[a-z0-9]+/i);
      if (m?.[0]) return m[0];
    }
  }
  return null;
}

export async function delete_storage_file_for_board_item(file_id, file_name = '', board_id = '') {
  if (typeof fetch === 'undefined') return null;
  const target_id = file_id || (file_name ? 'by-board-name' : null);
  if (!target_id) return null;
  try {
    const params = new URLSearchParams();
    if (board_id) params.set('board_id', String(board_id));
    if (file_name) params.set('file_name', String(file_name));
    const qs = params.toString();
    const res = await fetch(
      `/api/files/${encodeURIComponent(target_id)}${qs ? `?${qs}` : ''}`,
      {
        method: 'DELETE',
        headers: {
          ...get_lumen_auth_headers(),
        },
      }
    );
    if (res.ok) {
      return await res.json().catch(() => ({ success: true }));
    }
  } catch (err) {
    console.warn('[Lumen Storage] Notice deleting storage file for removed board item:', err);
  }
  return null;
}

export const MAX_BOARD_FILE_SIZE_MB = 88;
export const MAX_BOARD_FILE_SIZE_BYTES = MAX_BOARD_FILE_SIZE_MB * 1024 * 1024;

export async function upload_lumen_file(file, options = {}) {
  if (!file) throw new Error('No file provided');
  const {
    boardId = null,
    cardId = null,
    drawingId = null,
    mimeType = null,
    onProgress = null,
  } = options;

  const current_board_id = boardId || activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || null;
  const resolved_mime = mimeType || file.type || 'application/octet-stream';
  const file_name = file.name || `upload_${Date.now()}`;
  const file_size = Number(file.size || 0);

  if (file_size > MAX_BOARD_FILE_SIZE_BYTES) {
    const size_mb_str = (file_size / (1024 * 1024)).toFixed(1);
    throw new Error(`File "${file_name}" (${size_mb_str} MB) exceeds the ${MAX_BOARD_FILE_SIZE_MB} MB maximum size limit.`);
  }

  const read_blob_as_data_url = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });

  const fetch_upload_json_with_retry = async (url, fetch_opts, step_label = 'Upload', max_attempts = 3) => {
    let last_err = null;
    for (let attempt = 1; attempt <= max_attempts; attempt += 1) {
      try {
        const res = await fetch(url, fetch_opts);
        const raw_text = await res.text();
        const trimmed = String(raw_text || '').trim();
        let parsed = null;
        if (trimmed && !trimmed.startsWith('<')) {
          try {
            parsed = JSON.parse(trimmed);
          } catch (_parse_err) {
            parsed = null;
          }
        }

        if (res.ok && parsed && typeof parsed === 'object') {
          return { ok: true, status: res.status, data: parsed };
        }

        if (res.status === 413 && parsed?.message) {
          throw new Error(parsed.message);
        }
        if (res.status === 413 && !parsed) {
          return { ok: false, status: 413, isHtmlProxyLimit: true, data: null };
        }

        const is_html_or_transient =
          trimmed.startsWith('<') ||
          !parsed ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504;

        if (is_html_or_transient && attempt < max_attempts) {
          await new Promise((r) => setTimeout(r, 550 * attempt));
          continue;
        }

        const err_msg =
          parsed?.message ||
          parsed?.error ||
          (trimmed.startsWith('<')
            ? `${step_label} temporarily unavailable (server warming up).`
            : `${step_label} failed (HTTP ${res.status})`);
        throw new Error(err_msg);
      } catch (err) {
        last_err = err;
        if (attempt < max_attempts) {
          await new Promise((r) => setTimeout(r, 550 * attempt));
          continue;
        }
      }
    }
    throw last_err || new Error(`${step_label} failed`);
  };

  // Use 1.5 MB binary chunk threshold (~2 MB base64 JSON) so reverse proxies never reject with HTML 413 pages
  const CHUNK_SIZE = Math.floor(1.5 * 1024 * 1024);
  if (file_size <= CHUNK_SIZE) {
    if (typeof onProgress === 'function') onProgress(15);
    const base64_data = await read_blob_as_data_url(file);
    if (typeof onProgress === 'function') onProgress(60);

    const single_res = await fetch_upload_json_with_retry(
      '/api/files/upload',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          fileName: file_name,
          fileType: resolved_mime,
          fileSize: file_size,
          fileData: base64_data,
          boardId: current_board_id,
          board_id: current_board_id,
          board_code: current_board_id,
          cardId,
          card_id: cardId,
          card_code: cardId,
          drawingId,
          drawing_id: drawingId,
        }),
      },
      'File upload'
    );

    if (single_res.ok && single_res.data) {
      if (typeof onProgress === 'function') onProgress(100);
      return single_res.data;
    }
    // If proxy returned 413 HTML limit on single upload, fall through to chunked upload below
  }

  // Chunked upload for files > 1.5 MB (or fallback on proxy 413)
  const effective_chunk_size = 1024 * 1024; // 1 MB binary chunks
  if (typeof onProgress === 'function') onProgress(5);
  const init_res = await fetch_upload_json_with_retry(
    '/api/files/upload/init',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        fileName: file_name,
        fileType: resolved_mime,
        fileSize: file_size,
        boardId: current_board_id,
        board_id: current_board_id,
        board_code: current_board_id,
        cardId,
        card_id: cardId,
        card_code: cardId,
        drawingId,
        drawing_id: drawingId,
      }),
    },
    'Upload initialization'
  );

  const init_data = init_res.data || {};
  const fileId = init_data.fileId || init_data.file_storage_code;
  const { diskFileName } = init_data;
  const total_chunks = Math.max(1, Math.ceil(file_size / effective_chunk_size));

  for (let chunk_index = 0; chunk_index < total_chunks; chunk_index++) {
    const start = chunk_index * effective_chunk_size;
    const end = Math.min(file_size, start + effective_chunk_size);
    const slice_blob = file.slice(start, end);
    const chunk_data_url = await read_blob_as_data_url(slice_blob);

    await fetch_upload_json_with_retry(
      '/api/files/upload/chunk',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          fileId,
          file_storage_code: fileId,
          diskFileName,
          chunkIndex: chunk_index,
          totalChunks: total_chunks,
          chunkData: chunk_data_url,
        }),
      },
      `Chunk ${chunk_index + 1}/${total_chunks}`
    );

    if (typeof onProgress === 'function') {
      const pct = Math.min(95, Math.max(5, Math.round(((chunk_index + 1) / total_chunks) * 92)));
      onProgress(pct);
    }
  }

  const complete_res = await fetch_upload_json_with_retry(
    '/api/files/upload/complete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        fileId,
        file_storage_code: fileId,
        diskFileName,
        fileName: file_name,
        fileType: resolved_mime,
        fileSize: file_size,
        boardId: current_board_id,
        board_id: current_board_id,
        board_code: current_board_id,
        cardId,
        card_id: cardId,
        card_code: cardId,
        drawingId,
        drawing_id: drawingId,
      }),
    },
    'Upload finalization'
  );

  if (typeof onProgress === 'function') onProgress(100);
  return complete_res.data;
}

export async function upload_drawing_image_file(image_id, fileName, data_url, explicit_board_id = null) {
  if (!data_url || typeof data_url !== 'string' || !data_url.startsWith('data:image/')) return null;
  try {
    const mime = data_url.split(';')[0].replace('data:', '') || 'image/png';
    const ext_map = {
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/svg+xml': '.svg',
      'image/png': '.png',
    };
    const target_ext = ext_map[mime.toLowerCase()] || '.png';
    const clean_name = (fileName || `drawing_${image_id}${target_ext}`)
      .replace(/\s*\((PNG|GIF)\)\s*$/i, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const has_valid_ext = /\.(png|gif|webp|jpe?g|svg)$/i.test(clean_name);
    const final_file_name = has_valid_ext ? clean_name : `${clean_name}${target_ext}`;
    const current_board_id = explicit_board_id || activeBoardSignal.value?.id || activeBoardSignal.value?.board_code;
    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        fileName: final_file_name,
        fileType: mime,
        fileData: data_url,
        boardId: current_board_id,
        board_id: current_board_id,
        board_code: current_board_id,
        drawingId: image_id,
        drawing_id: image_id,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const resolved_file_id = data?.file_storage_code || data?.fileId;
      const cur_drawings = Array.isArray(activeBoardSignal.value?.drawings)
        ? activeBoardSignal.value.drawings
        : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
      const still_exists = !deleted_drawing_image_ids.has(image_id) && cur_drawings.some((d) => d && d.id === image_id);

      if (!still_exists && resolved_file_id) {
        await delete_storage_file_for_board_item(resolved_file_id, clean_name, current_board_id);
        return null;
      }

      if (data && data.viewUrl) {
        updateDrawingImage(image_id, {
          fileId: resolved_file_id,
          file_id: resolved_file_id,
          file_storage_code: resolved_file_id,
          src: data.viewUrl,
          viewUrl: data.viewUrl,
        });
        saveCurrentBoardToStore({ immediate: true });
        return data.viewUrl;
      }
    } else if (res.status === 413) {
      const err_json = await res.json().catch(() => ({}));
      showToast(err_json.message || 'Storage quota limit exceeded for board owner');
    }
  } catch (err) {
    console.warn('[Lumen Upload] Background drawing upload notice:', err);
  }
  return null;
}

export async function purgeDeletedFileFromBoards(file_id, board_id = null, file_name = '', affected_board_ids = []) {
  const normalize_img_name = (raw) =>
    String(raw || '')
      .replace(/\s*\(png\)\s*$/i, '')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase()
      .trim();
  const target_norm_name = normalize_img_name(file_name);

  const should_remove_drawing = (d) => {
    if (!d || d.type !== 'image') return false;
    const src_str = String(d.src || '');
    const view_str = String(d.viewUrl || '');
    if (
      d.file_storage_code === file_id ||
      d.fileId === file_id ||
      d.file_id === file_id ||
      (file_id && (src_str.includes(file_id) || view_str.includes(file_id)))
    ) {
      return true;
    }
    if (target_norm_name && src_str.startsWith('data:image/')) {
      const d_norm = normalize_img_name(d.name || '');
      if (d_norm && d_norm === target_norm_name) {
        return true;
      }
    }
    return false;
  };

  const target_ids = new Set(
    [board_id, ...(Array.isArray(affected_board_ids) ? affected_board_ids : [])].filter(Boolean)
  );
  for (const b of boardsDirectorySignal.value || []) {
    const bid = b?.id || b?.board_code;
    if (bid) target_ids.add(bid);
  }

  for (const bid of target_ids) {
    await delete_board_from_idb(bid).catch(() => {});
  }

  const strip_deleted_file_from_doc_html = (html_str) => {
    if (!file_id || typeof html_str !== 'string' || !html_str.includes(file_id)) return html_str;
    const escaped_fid = String(file_id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fig_regex = new RegExp(
      `<figure[^>]*data-file-id=["']${escaped_fid}["'][^>]*>[\\s\\S]*?<\\/figure>`,
      'gi'
    );
    const img_regex = new RegExp(`<img[^>]*${escaped_fid}[^>]*>`, 'gi');
    return html_str.replace(fig_regex, '').replace(img_regex, '');
  };

  if (typeof window !== 'undefined' && file_id) {
    window.dispatchEvent(new CustomEvent('lumen-docs-purge-file', { detail: { file_id } }));
  }

  if (activeBoardSignal.value) {
    const cur = activeBoardSignal.value;
    const cur_drawings = Array.isArray(cur.drawings)
      ? cur.drawings
      : (Array.isArray(cur.board_drawing) ? cur.board_drawing : []);
    const next_drawings = cur_drawings.filter((d) => !should_remove_drawing(d));

    const cur_cards = Array.isArray(cur.cards)
      ? cur.cards
      : (Array.isArray(cur.board_card) ? cur.board_card : []);
    let cards_changed = false;
    const next_cards = cur_cards.map((c) => {
      if (c && c.type === 'docs' && file_id && typeof c.content === 'string' && c.content.includes(file_id)) {
        cards_changed = true;
        const cleaned_html = strip_deleted_file_from_doc_html(c.content);
        const next_doc_images = Array.isArray(c.doc_images)
          ? c.doc_images.filter((img) => img?.file_id !== file_id)
          : c.doc_images;
        return {
          ...c,
          content: cleaned_html,
          doc_images: next_doc_images,
          data: c.data ? { ...c.data, content: cleaned_html } : c.data,
        };
      }
      if (
        c &&
        file_id &&
        (c.tts_file_id === file_id ||
          c.data?.tts_file_id === file_id ||
          (typeof c.tts_audio_url === 'string' && c.tts_audio_url.includes(file_id)))
      ) {
        cards_changed = true;
        const next_c_data = c.data && typeof c.data === 'object' ? { ...c.data } : {};
        delete next_c_data.tts_file_id;
        delete next_c_data.tts_file_name;
        delete next_c_data.tts_file_size;
        delete next_c_data.tts_audio_url;
        delete next_c_data.tts_download_url;
        delete next_c_data.tts_audio_base64;
        delete next_c_data.tts_audio_duration;
        return {
          ...c,
          tts_file_id: null,
          tts_file_name: null,
          tts_file_size: null,
          tts_audio_url: null,
          tts_download_url: null,
          tts_audio_base64: null,
          tts_audio_duration: null,
          data: next_c_data,
        };
      }
      return c;
    });

    if (next_drawings.length !== cur_drawings.length || cards_changed) {
      activeBoardSignal.value = {
        ...cur,
        drawings: next_drawings,
        board_drawing: next_drawings,
        cards: cards_changed ? next_cards : cur.cards,
        board_card: cards_changed ? next_cards : cur.board_card,
      };
    }
  }

  if (Array.isArray(boardsDirectorySignal.value)) {
    boardsDirectorySignal.value = boardsDirectorySignal.value.map((b) => {
      if (!b) return b;
      const cur_d = Array.isArray(b.drawings)
        ? b.drawings
        : (Array.isArray(b.board_drawing) ? b.board_drawing : []);
      if (cur_d.length === 0) return b;
      const next_d = cur_d.filter((d) => !should_remove_drawing(d));
      if (next_d.length === cur_d.length) return b;
      return {
        ...b,
        drawings: next_d,
        board_drawing: next_d,
      };
    });
  }
}

export const addDrawingImage = (image_config) => {
  pushHistorySnapshot();
  const current_drawings = Array.isArray(activeBoardSignal.value?.drawings)
    ? activeBoardSignal.value.drawings
    : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
  const image_id = image_config.id || createId('dimg');
  const current_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || null;

  // Calculate default viewport center if x, y not supplied
  const vp = activeBoardSignal.value?.viewport || { panX: 0, panY: 0, zoom: 1 };
  const win_w = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const win_h = typeof window !== 'undefined' ? window.innerHeight : 800;

  const w = image_config.width || 320;
  const h = image_config.height || 240;
  const default_x = Math.round((win_w / 2 - vp.panX) / vp.zoom - w / 2);
  const default_y = Math.round((win_h / 2 - vp.panY) / vp.zoom - h / 2);

  const new_image = {
    id: image_id,
    type: 'image',
    name: image_config.name || 'Uploaded Image',
    src: image_config.src,
    x: image_config.x !== undefined ? image_config.x : default_x,
    y: image_config.y !== undefined ? image_config.y : default_y,
    width: w,
    height: h,
    naturalWidth: image_config.naturalWidth || w,
    naturalHeight: image_config.naturalHeight || h,
    rotation: image_config.rotation || 0,
    opacity: image_config.opacity !== undefined ? image_config.opacity : 1,
    visible: image_config.visible !== false,
    locked: Boolean(image_config.locked),
    flipHorizontal: Boolean(image_config.flipHorizontal),
    flipVertical: Boolean(image_config.flipVertical),
    aspectRatioLocked: image_config.aspectRatioLocked !== false,
    zIndex: get_max_board_layer_z() + 1,
    createdAt: Date.now(),
  };

  const next_drawings = [...current_drawings, new_image];
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    drawings: next_drawings,
    board_drawing: next_drawings,
  };

  selectedDrawingImageIdSignal.value = image_id;
  drawingToolSignal.value = 'select';
  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore();
  showToast(`Added layer "${new_image.name}"`);

  if (!isRemoteUpdateFlag.current && typeof broadcastDrawingAdd === 'function') {
    broadcastDrawingAdd(new_image);
  }

  // If this is a base64 data URL, upload in background to save local storage & PostgreSQL space
  if (typeof fetch !== 'undefined' && typeof new_image.src === 'string' && new_image.src.startsWith('data:image/')) {
    upload_drawing_image_file(new_image.id, new_image.name, new_image.src, current_board_id).catch(() => {});
  }

  return new_image;
};

export const updateDrawingImage = (image_id, updates, record_history = false) => {
  if (record_history) {
    pushHistorySnapshot();
  }
  const current_drawings = Array.isArray(activeBoardSignal.value?.drawings)
    ? activeBoardSignal.value.drawings
    : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
  const next_drawings = current_drawings.map((item) => {
    if (item.id === image_id) {
      return {
        ...item,
        ...updates,
        updatedAt: Date.now(),
      };
    }
    return item;
  });

  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    drawings: next_drawings,
    board_drawing: next_drawings,
  };

  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore();
};

export const deleteDrawingImage = (image_id) => {
  pushHistorySnapshot();
  deleted_drawing_image_ids.add(image_id);
  const current_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const current_drawings = Array.isArray(activeBoardSignal.value?.drawings)
    ? activeBoardSignal.value.drawings
    : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
  const target_item = current_drawings.find((item) => item && item.id === image_id);
  const next_drawings = current_drawings.filter((item) => item.id !== image_id);
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    drawings: next_drawings,
    board_drawing: next_drawings,
  };

  if (selectedDrawingImageIdSignal.value === image_id) {
    selectedDrawingImageIdSignal.value = null;
  }

  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore({ immediate: true });
  showToast('Removed layer');

  if (!isRemoteUpdateFlag.current) {
    if (typeof broadcastDrawingErase === 'function') {
      broadcastDrawingErase(image_id);
    }
    if (target_item) {
      const target_fid = extract_file_id_from_board_item(target_item);
      const still_referenced = next_drawings.some((d) => {
        if (!d || d.type !== 'image') return false;
        const d_fid = extract_file_id_from_board_item(d);
        if (target_fid && d_fid === target_fid) return true;
        return false;
      });
      if (!still_referenced) {
        delete_storage_file_for_board_item(
          target_fid,
          target_item.name || '',
          current_board_id
        ).catch(() => {});
      }
    }
  }
};

export const duplicateDrawingImage = (image_id) => {
  const current_drawings = (Array.isArray(activeBoardSignal.value?.drawings) && activeBoardSignal.value.drawings.length > 0)
    ? activeBoardSignal.value.drawings
    : (Array.isArray(activeBoardSignal.value?.board_drawing) ? activeBoardSignal.value.board_drawing : []);
  const target = current_drawings.find((item) => item.id === image_id);
  if (!target) return;

  pushHistorySnapshot();
  const new_id = createId('dimg');
  const duplicated = {
    ...target,
    id: new_id,
    name: `${target.name || 'Image'} (Copy)`,
    x: target.x + 24,
    y: target.y + 24,
    createdAt: Date.now(),
  };

  const next_drawings = [...current_drawings, duplicated];
  activeBoardSignal.value = {
    ...activeBoardSignal.value,
    drawings: next_drawings,
    board_drawing: next_drawings,
  };

  selectedDrawingImageIdSignal.value = new_id;
  hasUnsavedDrawingsSignal.value = true;
  saveCurrentBoardToStore();
  showToast('Layer duplicated');
};

export const reorderDrawingImage = (image_id, direction) => {
  moveUnifiedLayer(image_id, direction);
};

export const reorderDrawingLayersByList = (new_ordered_image_ids) => {
  if (!Array.isArray(new_ordered_image_ids) || new_ordered_image_ids.length === 0) return;
  const unified = getUnifiedBoardLayers(activeBoardSignal.value);
  const result_ids = [];
  let img_ptr = 0;
  unified.forEach((item) => {
    if (item.kind === 'drawing_image') {
      if (img_ptr < new_ordered_image_ids.length) {
        result_ids.push(new_ordered_image_ids[img_ptr]);
        img_ptr++;
      }
    } else {
      result_ids.push(item.id);
    }
  });
  reorderUnifiedLayers(result_ids);
};

export const toggleDrawingImageVisibility = (image_id) => {
  const current_drawings = activeBoardSignal.value?.drawings || [];
  const item = current_drawings.find((d) => d.id === image_id);
  if (!item) return;

  updateDrawingImage(image_id, { visible: item.visible === false ? true : false });
};

export const toggleDrawingImageLock = (image_id) => {
  const current_drawings = activeBoardSignal.value?.drawings || [];
  const item = current_drawings.find((d) => d.id === image_id);
  if (!item) return;

  updateDrawingImage(image_id, { locked: !item.locked });
};

// -------------------------------------------------------------
// Card Labels & Tags System
// -------------------------------------------------------------
export const TAG_PALETTES = [
  { key: 'blue', label: 'Ocean Blue', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  { key: 'purple', label: 'Deep Purple', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },
  { key: 'green', label: 'Sage Emerald', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { key: 'yellow', label: 'Warm Amber', bg: '#fef9c3', color: '#854d0e', border: '#fef08a' },
  { key: 'peach', label: 'Terracotta', bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
  { key: 'rose', label: 'Crimson Rose', bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' },
  { key: 'indigo', label: 'Royal Indigo', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  { key: 'slate', label: 'Mineral Slate', bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' },
];

export const get_tag_color = (tag_item) => {
  if (typeof tag_item === 'object' && tag_item?.color) {
    const found = TAG_PALETTES.find((p) => p.key === tag_item.color);
    if (found) return found;
  }
  const text = typeof tag_item === 'object' ? tag_item?.text : String(tag_item || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_PALETTES.length;
  return TAG_PALETTES[index];
};

export const addTagToCard = (cardId, tagText, tagColor) => {
  if (!tagText || !tagText.trim()) return;
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card) return;

  const cleanText = tagText.trim();
  const existingTags = Array.isArray(card.tags) ? [...card.tags] : [];

  const exists = existingTags.some((t) =>
    (typeof t === 'string' ? t : t.text).toLowerCase() === cleanText.toLowerCase()
  );
  if (exists) {
    showToast(`Tag "${cleanText}" already exists`);
    return;
  }

  const newTag = tagColor ? { text: cleanText, color: tagColor } : cleanText;
  const updatedTags = [...existingTags, newTag];

  updateCard(cardId, { tags: updatedTags }, true);
  saveCurrentBoardToStore();
  showToast(`Added tag "${cleanText}"`);
};

export const removeTagFromCard = (cardId, tagIdentifier) => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card || !Array.isArray(card.tags)) return;

  const updatedTags = card.tags.filter((t, idx) => {
    if (typeof tagIdentifier === 'number') return idx !== tagIdentifier;
    const text = typeof t === 'string' ? t : t.text;
    return text.toLowerCase() !== String(tagIdentifier).toLowerCase();
  });

  updateCard(cardId, { tags: updatedTags }, true);
  saveCurrentBoardToStore();
};

// -------------------------------------------------------------
// Card Emoji Reactions System
// -------------------------------------------------------------
export const COMMON_REACTION_EMOJIS = [
  '👍', '❤️', '🔥', '🚀', '🎉', '💡', '👀', '🎯', '👏', '⚡', '✨', '💎'
];

export const toggleCardReaction = (cardId, emoji) => {
  if (!cardId || !emoji) return;
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card) return;

  const existingReactions = Array.isArray(card.reactions) ? [...card.reactions] : [];
  const rxIdx = existingReactions.findIndex((r) => r.emoji === emoji);

  let updatedReactions;
  let didReact = false;

  if (rxIdx !== -1) {
    const current = existingReactions[rxIdx];
    if (current.user_reacted) {
      // Toggle off: decrement count
      if (current.count <= 1) {
        updatedReactions = existingReactions.filter((_, idx) => idx !== rxIdx);
      } else {
        updatedReactions = existingReactions.map((r, idx) =>
          idx === rxIdx ? { ...r, count: r.count - 1, user_reacted: false } : r
        );
      }
    } else {
      // Toggle on: increment count
      didReact = true;
      updatedReactions = existingReactions.map((r, idx) =>
        idx === rxIdx ? { ...r, count: r.count + 1, user_reacted: true } : r
      );
    }
  } else {
    // Add new reaction with user_reacted: true
    didReact = true;
    updatedReactions = [...existingReactions, { emoji, count: 1, user_reacted: true }];
  }

  updateCard(cardId, { reactions: updatedReactions }, false);
  saveCurrentBoardToStore();
  if (didReact) {
    showToast(`Reacted with ${emoji}`);
  }
};

// -------------------------------------------------------------
// Card Encryption System (AES-GCM-256 + PBKDF2)
// -------------------------------------------------------------

// In-Memory Session Signal for Unlocked Cards: { [cardId]: { payload, passkey, unlockedAt } }
export const unlockedCardsSignal = signal({});

/**
 * Unlocks an encrypted card using the provided passkey.
 */
export const unlockCard = async (cardId, passkey) => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  const enc = card?.card_encryption || card?.cardEncryption;
  if (!card || !enc) {
    throw new Error('Card is not encrypted');
  }

  // Enforce brute force protection rate limiting and lockouts
  verify_can_attempt_unlock(cardId);

  let decrypted_payload;
  try {
    decrypted_payload = await decrypt_card_data(enc, passkey);
    record_successful_unlock(cardId);
  } catch (err) {
    await record_failed_unlock_attempt(cardId);
    throw err;
  }

  unlockedCardsSignal.value = {
    ...unlockedCardsSignal.value,
    [cardId]: {
      payload: decrypted_payload,
      passkey,
      unlockedAt: Date.now(),
    },
  };

  const updated_cards = (currentBoard.cards || []).map((c) => {
    if (c.id === cardId) {
      return {
        ...c,
        ...decrypted_payload,
        is_encryption_unlocked: true,
      };
    }
    return c;
  });

  activeBoardSignal.value = {
    ...currentBoard,
    cards: updated_cards,
    board_card: updated_cards,
  };

  showToast('Card unlocked');
  return decrypted_payload;
};

/**
 * Locks an encrypted card, masking plain content in memory.
 */
export const lockCard = async (cardId) => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  const session = unlockedCardsSignal.value[cardId];
  let enc = card?.card_encryption || card?.cardEncryption;

  if (card && session?.passkey) {
    try {
      const sensitive_payload = extract_sensitive_card_payload(card);
      const hint = enc?.passkey_hint || enc?.hint || session.passkey_hint || '';
      enc = await encrypt_card_data(sensitive_payload, session.passkey, hint);
    } catch (e) {
      console.warn('Re-encryption on lock notice:', e);
    }
  }

  const next_unlocked = { ...unlockedCardsSignal.value };
  delete next_unlocked[cardId];
  unlockedCardsSignal.value = next_unlocked;

  const updated_cards = (currentBoard.cards || []).map((c) => {
    if (c.id === cardId) {
      const safe_data = typeof c.data === 'object' && c.data !== null ? { ...c.data } : {};
      safe_data.content = '';
      safe_data.items = [];
      safe_data.description = '';
      safe_data.notes = '';
      safe_data.url = '';
      return {
        ...c,
        card_encryption: enc,
        cardEncryption: enc,
        content: '',
        data: safe_data,
        items: [],
        description: '',
        url: '',
        images: [],
        imageUrl: '',
        destinations: [],
        notes: '',
        canvas_strokes: [],
        is_encryption_unlocked: false,
      };
    }
    return c;
  });

  activeBoardSignal.value = {
    ...currentBoard,
    cards: updated_cards,
    board_card: updated_cards,
  };

  saveCurrentBoardToStore({ immediate: true });
  showToast('Card locked');
};

/**
 * Encrypts an existing normal card into an encrypted card.
 */
export const encryptExistingCard = async (cardId, passkey, hint = '') => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  if (!card) throw new Error('Card not found');

  const sensitive_payload = extract_sensitive_card_payload(card);
  const encryption_meta = await encrypt_card_data(sensitive_payload, passkey, hint);

  // Keep unlocked in the current session
  unlockedCardsSignal.value = {
    ...unlockedCardsSignal.value,
    [cardId]: {
      payload: sensitive_payload,
      passkey,
      unlockedAt: Date.now(),
    },
  };

  updateCard(
    cardId,
    {
      card_encryption: encryption_meta,
      cardEncryption: encryption_meta,
      content: '',
      data: {
        encrypted: true,
        hint: hint || '',
      },
      is_encryption_unlocked: true,
    },
    true
  );

  saveCurrentBoardToStore({ immediate: true });
  showToast('Card protected with AES-256 encryption');
  return encryption_meta;
};

/**
 * Decrypts an encrypted card permanently back to a normal unencrypted card.
 */
export const decryptCardPermanently = async (cardId, passkey) => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  const enc = card?.card_encryption || card?.cardEncryption;
  if (!card || !enc) throw new Error('Card is not encrypted');

  // Enforce brute force protection rate limiting and lockouts
  verify_can_attempt_unlock(cardId);

  let plain_payload;
  try {
    plain_payload = await decrypt_card_data(enc, passkey);
    record_successful_unlock(cardId);
  } catch (err) {
    await record_failed_unlock_attempt(cardId);
    throw err;
  }

  const next_unlocked = { ...unlockedCardsSignal.value };
  delete next_unlocked[cardId];
  unlockedCardsSignal.value = next_unlocked;

  updateCard(
    cardId,
    {
      ...plain_payload,
      card_encryption: null,
      cardEncryption: null,
      is_encryption_unlocked: false,
    },
    true
  );

  saveCurrentBoardToStore({ immediate: true });
  showToast('Encryption removed: Card converted to normal card');
  return plain_payload;
};

/**
 * Changes passkey for an encrypted card.
 */
export const changeCardPasskey = async (cardId, old_passkey, new_passkey, new_hint = '') => {
  const currentBoard = activeBoardSignal.value;
  const card = (currentBoard.cards || []).find((c) => c.id === cardId);
  const enc = card?.card_encryption || card?.cardEncryption;
  if (!card || !enc) throw new Error('Card is not encrypted');

  let plain_payload = unlockedCardsSignal.value[cardId]?.payload;
  if (!plain_payload) {
    plain_payload = await decrypt_card_data(enc, old_passkey);
  }

  const new_encryption_meta = await encrypt_card_data(plain_payload, new_passkey, new_hint);

  unlockedCardsSignal.value = {
    ...unlockedCardsSignal.value,
    [cardId]: {
      payload: plain_payload,
      passkey: new_passkey,
      unlockedAt: Date.now(),
    },
  };

  updateCard(
    cardId,
    {
      card_encryption: new_encryption_meta,
      cardEncryption: new_encryption_meta,
    },
    true
  );

  saveCurrentBoardToStore({ immediate: true });
  showToast('Passkey updated successfully');
  return new_encryption_meta;
};

// -------------------------------------------------------------
// Bandwidth Monitor, Auto-Load Egress Tracker & Anti-Hotlink State
// -------------------------------------------------------------
export const bandwidth_usage_signal = signal(null);
export const is_bandwidth_loading_signal = signal(false);

const seen_performance_entries = new Set();
let pending_beacon_events = [];
let beacon_flush_timer = null;
let auto_load_observer_started = false;

export const fetch_bandwidth_usage = async (board_id_override = null, user_account_override = null) => {
  if (typeof fetch === 'undefined') return null;
  const target_board_id =
    board_id_override !== null
      ? board_id_override
      : activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const auth_payload = get_lumen_auth_payload();
  const target_user_account =
    user_account_override || auth_payload?.user_account || '';
  is_bandwidth_loading_signal.value = true;
  try {
    const params = new URLSearchParams();
    if (target_board_id) params.set('boardId', target_board_id);
    if (target_user_account) params.set('user_account', target_user_account);
    const qs = params.toString();
    const res = await fetch(
      `/api/bandwidth/usage${qs ? `?${qs}` : ''}`,
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...get_lumen_auth_headers(),
        },
      }
    );
    if (res.ok) {
      const data = await safe_parse_response_json(res, null);
      if (data) {
        bandwidth_usage_signal.value = data;
      }
      return data;
    }
  } catch (err) {
    console.warn('[Lumen Bandwidth] Notice fetching bandwidth usage:', err?.message || err);
  } finally {
    is_bandwidth_loading_signal.value = false;
  }
  return null;
};

export const update_bandwidth_settings = async ({
  limit_mb,
  daily_limit_mb,
  monthly_limit_mb,
  burst_protection_enabled,
  anti_hotlink_enabled,
  board_id = null,
  user_account = null,
} = {}) => {
  if (typeof fetch === 'undefined') return null;
  const target_board_id =
    board_id !== null
      ? board_id
      : activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const auth_payload = get_lumen_auth_payload();
  const target_user_account =
    user_account || auth_payload?.user_account || '';
  try {
    const res = await fetch('/api/bandwidth/limit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        board_id: target_board_id,
        user_account: target_user_account,
        limit_mb,
        daily_limit_mb,
        monthly_limit_mb,
        burst_protection_enabled,
        anti_hotlink_enabled,
      }),
    });
    if (res.ok) {
      await fetch_bandwidth_usage(target_board_id, target_user_account);
      return await safe_parse_response_json(res, null);
    }
  } catch (err) {
    console.warn('[Lumen Bandwidth] Error updating bandwidth settings:', err?.message || err);
  }
  return null;
};

export const reset_daily_bandwidth_usage = async (
  board_id = null,
  scope = 'daily',
  user_account = null
) => {
  if (typeof fetch === 'undefined') return null;
  const target_board_id =
    board_id !== null
      ? board_id
      : activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const auth_payload = get_lumen_auth_payload();
  const target_user_account =
    user_account || auth_payload?.user_account || '';
  try {
    const res = await fetch('/api/bandwidth/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        board_id: target_board_id,
        user_account: target_user_account,
        scope,
      }),
    });
    if (res.ok) {
      await fetch_bandwidth_usage(target_board_id, target_user_account);
      showToast(
        scope === 'monthly'
          ? 'Monthly & daily bandwidth counters reset'
          : 'Daily burst bandwidth counter reset'
      );
      return await safe_parse_response_json(res, null);
    }
  } catch (err) {
    console.warn('[Lumen Bandwidth] Error resetting bandwidth counters:', err?.message || err);
  }
  return null;
};

const flush_auto_load_beacon_queue = async () => {
  if (pending_beacon_events.length === 0 || typeof fetch === 'undefined') return;
  const batch_to_send = pending_beacon_events.splice(0, 40);
  const current_board_id =
    activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  try {
    const res = await fetch('/api/bandwidth/beacon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        board_id: current_board_id,
        events: batch_to_send,
      }),
    });
    if (res.ok && bandwidth_usage_signal.value) {
      fetch_bandwidth_usage(current_board_id).catch(() => {});
    }
  } catch (_) {}
};

export const queue_auto_load_bandwidth_beacon = (event_item) => {
  if (!event_item || !event_item.file_id) return;
  pending_beacon_events.push(event_item);
  if (beacon_flush_timer) {
    clearTimeout(beacon_flush_timer);
  }
  beacon_flush_timer = setTimeout(() => {
    beacon_flush_timer = null;
    flush_auto_load_beacon_queue();
  }, 1800);
};

// Automatically observes all browser resource loads for /api/files/view/:fileId
// (e.g. inline <img> cards, image carousels, drawing layers, PDF.js canvas fetches, Three.js 3D models, audio/video)
export const init_auto_load_bandwidth_observer = () => {
  if (auto_load_observer_started || typeof window === 'undefined') return;
  if (typeof PerformanceObserver === 'undefined') return;
  auto_load_observer_started = true;

  const process_resource_entry = (entry) => {
    if (!entry || !entry.name) return;
    const url_str = String(entry.name);
    if (!url_str.includes('/api/files/view/')) return;

    const match = url_str.match(/\/api\/files\/view\/(file_[a-zA-Z0-9_.-]+)/);
    if (!match || !match[1]) return;

    const file_id = match[1];
    const entry_key = `${file_id}:${Math.round(entry.startTime || 0)}`;
    if (seen_performance_entries.has(entry_key)) return;
    seen_performance_entries.add(entry_key);

    const transfer_size = Number(entry.transferSize || 0);
    const encoded_size = Number(entry.encodedBodySize || 0);
    const decoded_size = Number(entry.decodedBodySize || 0);
    const body_size = Math.max(encoded_size, decoded_size, transfer_size);
    const from_cache = transfer_size === 0;

    queue_auto_load_bandwidth_beacon({
      file_id,
      delivery_type: 'auto_load',
      initiator_type: entry.initiatorType || 'resource',
      transfer_size,
      body_size,
      from_cache,
      timestamp: Date.now(),
    });
  };

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        process_resource_entry(entry);
      }
    });
    observer.observe({ type: 'resource', buffered: true });
  } catch (_) {}
};

if (typeof window !== 'undefined') {
  init_auto_load_bandwidth_observer();
}

// -------------------------------------------------------------
// Per-User AI Usage Monitor (Monthly Token Quota + Daily Burst Cap)
// -------------------------------------------------------------
export const ai_usage_signal = signal(null);
export const is_ai_usage_loading_signal = signal(false);

export const fetch_ai_usage = async (board_id_override = null, user_account_override = null) => {
  if (typeof fetch === 'undefined') return null;
  const target_board_id =
    board_id_override !== null
      ? board_id_override
      : activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const auth_payload = get_lumen_auth_payload();
  const target_user_account =
    user_account_override || auth_payload?.user_account || '';
  is_ai_usage_loading_signal.value = true;
  try {
    const params = new URLSearchParams();
    if (target_board_id) params.set('boardId', target_board_id);
    if (target_user_account) params.set('user_account', target_user_account);
    const qs = params.toString();
    const res = await fetch(
      `/api/ai/usage${qs ? `?${qs}` : ''}`,
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...get_lumen_auth_headers(),
        },
      }
    );
    if (res.ok) {
      const data = await safe_parse_response_json(res, null);
      if (data) {
        ai_usage_signal.value = data;
      }
      return data;
    }
  } catch (err) {
    console.warn('[Lumen AI Usage] Notice fetching AI usage:', err?.message || err);
  } finally {
    is_ai_usage_loading_signal.value = false;
  }
  return null;
};

export const update_ai_usage_settings = async ({
  limit_tokens,
  daily_limit_tokens,
  monthly_limit_tokens,
  burst_protection_enabled,
  board_id = null,
  user_account = null,
} = {}) => {
  if (typeof fetch === 'undefined') return null;
  const target_board_id =
    board_id !== null
      ? board_id
      : activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const auth_payload = get_lumen_auth_payload();
  const target_user_account =
    user_account || auth_payload?.user_account || '';
  try {
    const res = await fetch('/api/ai/limit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        board_id: target_board_id,
        user_account: target_user_account,
        limit_tokens,
        daily_limit_tokens,
        monthly_limit_tokens,
        burst_protection_enabled,
      }),
    });
    if (res.ok) {
      await fetch_ai_usage(target_board_id, target_user_account);
      return await safe_parse_response_json(res, null);
    }
  } catch (err) {
    console.warn('[Lumen AI Usage] Error updating AI usage settings:', err?.message || err);
  }
  return null;
};

export const reset_ai_usage = async (
  board_id = null,
  scope = 'daily',
  user_account = null
) => {
  if (typeof fetch === 'undefined') return null;
  const target_board_id =
    board_id !== null
      ? board_id
      : activeBoardSignal.value?.id || activeBoardSignal.value?.board_code || '';
  const auth_payload = get_lumen_auth_payload();
  const target_user_account =
    user_account || auth_payload?.user_account || '';
  try {
    const res = await fetch('/api/ai/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        board_id: target_board_id,
        user_account: target_user_account,
        scope,
      }),
    });
    if (res.ok) {
      await fetch_ai_usage(target_board_id, target_user_account);
      showToast(
        scope === 'monthly'
          ? 'Monthly & daily AI token counters reset'
          : 'Daily burst AI token counter reset'
      );
      return await safe_parse_response_json(res, null);
    }
  } catch (err) {
    console.warn('[Lumen AI Usage] Error resetting AI usage counters:', err?.message || err);
  }
  return null;
};



