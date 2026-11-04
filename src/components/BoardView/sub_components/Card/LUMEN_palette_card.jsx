import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  LayoutGrid,
  Maximize2,
  Palette as PaletteIcon,
  Sliders,
  ChevronDown,
} from 'lucide-react';

import styles from './LUMEN_palette_card.module.css';
import {
  updateCard,
  saveCurrentBoardToStore,
  showToast,
} from '../../signals/boardState.js';

/**
 * Curated high-aesthetic color palettes for moodboard creation
 */
export const CURATED_PALETTES = [
  {
    name: 'Architectural Earth & Travertine',
    description: 'Natural stone, warm taupe, terracotta & raw linen',
    colors: [
      { id: 'c1', hex: '#2A2421', name: 'Charcoal Umber', role: 'Base' },
      { id: 'c2', hex: '#7D6B5D', name: 'Warm Taupe', role: 'Mid' },
      { id: 'c3', hex: '#C28460', name: 'Terracotta', role: 'Accent' },
      { id: 'c4', hex: '#D7C4B7', name: 'Travertine', role: 'Neutral' },
      { id: 'c5', hex: '#F4ECE4', name: 'Raw Linen', role: 'Light' },
    ],
  },
  {
    name: 'Nordic Pine & Sage',
    description: 'Deep conifers, foggy moss, and Scandinavian birch',
    colors: [
      { id: 'c1', hex: '#162A24', name: 'Deep Spruce', role: 'Base' },
      { id: 'c2', hex: '#2C5E43', name: 'Forest Green', role: 'Primary' },
      { id: 'c3', hex: '#688F74', name: 'Earthy Sage', role: 'Mid' },
      { id: 'c4', hex: '#B5C99A', name: 'Pale Moss', role: 'Accent' },
      { id: 'c5', hex: '#F0F3E8', name: 'Birch Bark', role: 'Light' },
    ],
  },
  {
    name: 'Kyoto Indigo & Ochre',
    description: 'Natural indigo dye, aged cedar, and golden ochre',
    colors: [
      { id: 'c1', hex: '#14213D', name: 'Midnight Indigo', role: 'Primary' },
      { id: 'c2', hex: '#3A506B', name: 'Slate Wave', role: 'Secondary' },
      { id: 'c3', hex: '#E5A93C', name: 'Raw Ochre', role: 'Accent' },
      { id: 'c4', hex: '#E0DDCF', name: 'Washi Paper', role: 'Neutral' },
      { id: 'c5', hex: '#FAF8F5', name: 'Pure Chalk', role: 'Base' },
    ],
  },
  {
    name: 'Bauhaus Modernist',
    description: 'Primary cobalt, cadmium red, chrome yellow, cast iron',
    colors: [
      { id: 'c1', hex: '#D62226', name: 'Bauhaus Red', role: 'Accent' },
      { id: 'c2', hex: '#1F567A', name: 'Cobalt Blue', role: 'Secondary' },
      { id: 'c3', hex: '#EBB42C', name: 'Warm Chrome', role: 'Highlight' },
      { id: 'c4', hex: '#1F2421', name: 'Cast Iron', role: 'Dark' },
      { id: 'c5', hex: '#F4F4F2', name: 'Concrete Grey', role: 'Neutral' },
    ],
  },
  {
    name: 'Muted Rose & Cassis',
    description: 'Dried botanicals, vintage plum, and blush sand',
    colors: [
      { id: 'c1', hex: '#2E1F27', name: 'Cassis Shadow', role: 'Deep' },
      { id: 'c2', hex: '#7E3F52', name: 'Dried Plum', role: 'Primary' },
      { id: 'c3', hex: '#C46D77', name: 'Vintage Rose', role: 'Mid' },
      { id: 'c4', hex: '#F0A896', name: 'Warm Blush', role: 'Accent' },
      { id: 'c5', hex: '#F9ECE5', name: 'Silk Sand', role: 'Base' },
    ],
  },
  {
    name: 'Neo Tokyo Cyber',
    description: 'Obsidian depths with glowing teal & twilight blue',
    colors: [
      { id: 'c1', hex: '#0B0F19', name: 'Obsidian Void', role: 'Dark' },
      { id: 'c2', hex: '#1D2D50', name: 'Deep Cyber', role: 'Primary' },
      { id: 'c3', hex: '#133B5C', name: 'Neon Twilight', role: 'Mid' },
      { id: 'c4', hex: '#00E8C6', name: 'Electric Teal', role: 'Accent' },
      { id: 'c5', hex: '#F1F6F9', name: 'Glitch White', role: 'Light' },
    ],
  },
];

/**
 * Color math utilities
 */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHsl(r, g, b) {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf:
        h = (gf - bf) / d + (gf < bf ? 6 : 0);
        break;
      case gf:
        h = (bf - rf) / d + 2;
        break;
      case bf:
        h = (rf - gf) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function formatColor(hex, format = 'hex') {
  if (!hex) return '';
  const cleanHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
  if (format === 'hex') return cleanHex;

  const rgb = hexToRgb(cleanHex);
  if (format === 'rgb') {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }
  if (format === 'hsl') {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  }
  return cleanHex;
}

export function getContrastTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  // Perceived relative luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#0F172A' : '#FFFFFF';
}

export function suggestColorName(hex) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  if (l <= 12) return 'Obsidian Black';
  if (l >= 93) return 'Pure White';
  if (s <= 12) {
    if (l < 40) return 'Charcoal Slate';
    if (l < 70) return 'Stone Grey';
    return 'Mist Grey';
  }

  if (h >= 345 || h < 15) return s > 60 ? 'Crimson Red' : 'Dusty Rose';
  if (h >= 15 && h < 45) return s > 60 ? 'Terracotta Orange' : 'Warm Clay';
  if (h >= 45 && h < 70) return s > 60 ? 'Amber Ochre' : 'Sand Khaki';
  if (h >= 70 && h < 155) return s > 50 ? 'Forest Emerald' : 'Sage Moss';
  if (h >= 155 && h < 190) return s > 50 ? 'Electric Teal' : 'Earthy Jade';
  if (h >= 190 && h < 250) return s > 50 ? 'Cobalt Blue' : 'Slate Indigo';
  if (h >= 250 && h < 290) return s > 50 ? 'Royal Violet' : 'Muted Lavender';
  return s > 50 ? 'Vivid Magenta' : 'Antique Plum';
}

/**
 * Normalizes card color list with stable identifiers
 */
function derive_palette_from_seed_text(seed_text = '') {
  const str = String(seed_text || 'Studio Palette');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const preset = CURATED_PALETTES[hash % CURATED_PALETTES.length] || CURATED_PALETTES[0];
  return preset.colors;
}

export function normalize_card_colors(card) {
  const raw_list = Array.isArray(card?.colors)
    ? card.colors
    : Array.isArray(card?.data?.colors)
    ? card.data.colors
    : null;

  if (Array.isArray(raw_list)) {
    if (raw_list.length === 0) return [];

    const roles_order = ['Primary', 'Secondary', 'Accent', 'Neutral', 'Light'];
    let mapped = raw_list.map((c, idx) => {
      const raw_hex =
        typeof c === 'string'
          ? c.trim()
          : String(c?.hex || c?.color || c?.value || '').trim();
      const with_hash = raw_hex
        ? raw_hex.startsWith('#')
          ? raw_hex.toUpperCase()
          : `#${raw_hex.toUpperCase()}`
        : '#334155';
      const valid_hex = /^#[0-9A-F]{3,8}$/i.test(with_hash) ? with_hash : '#334155';
      const role_fallback = roles_order[idx] || 'Swatch';

      return {
        id: (typeof c === 'object' && c?.id) || `col_${idx}_${valid_hex.replace('#', '')}`,
        hex: valid_hex,
        name:
          (typeof c === 'object' && c?.name && c.name !== 'Charcoal Slate')
            ? c.name
            : suggestColorName(valid_hex),
        role: (typeof c === 'object' && c?.role) || role_fallback,
      };
    });

    // Auto-heal palettes that were previously saved with every swatch stuck on #334155
    if (mapped.length >= 3 && mapped.every((item) => item.hex === '#334155')) {
      const text_blob = `${card?.content || ''} ${card?.description || ''} ${card?.ai_notes || ''}`;
      const matched_hexes = text_blob.match(/#[0-9A-Fa-f]{6}\b/g);
      if (matched_hexes && matched_hexes.length >= 3) {
        return matched_hexes.slice(0, 6).map((hx, idx) => {
          const upper = hx.toUpperCase();
          return {
            id: `col_healed_${idx}_${upper.replace('#', '')}`,
            hex: upper,
            name: suggestColorName(upper),
            role: roles_order[idx] || 'Swatch',
          };
        });
      }
      return derive_palette_from_seed_text(card?.title || card?.content || '');
    }

    return mapped;
  }
  // Default to Architectural Earth & Travertine only when card.colors is undefined/null
  return CURATED_PALETTES[0].colors;
}

export default function LUMEN_palette_card({ card }) {
  useSignals();

  const colors = normalize_card_colors(card);
  const color_format = card.color_format || 'hex';
  const palette_layout = card.palette_layout || 'bars'; // 'bars' | 'chips' | 'gradient'

  const [copied_id, set_copied_id] = useState(null);
  const [is_presets_open, set_is_presets_open] = useState(false);
  const [quick_hex_input, set_quick_hex_input] = useState('');
  const hidden_picker_ref = useRef(null);
  const presets_ref = useRef(null);

  // Close presets dropdown on outside click
  useEffect(() => {
    function handle_outside_click(e) {
      if (presets_ref.current && !presets_ref.current.contains(e.target)) {
        set_is_presets_open(false);
      }
    }
    if (is_presets_open) {
      document.addEventListener('mousedown', handle_outside_click);
    }
    return () => {
      document.removeEventListener('mousedown', handle_outside_click);
    };
  }, [is_presets_open]);

  // Copy single color
  const handle_copy_color = (c, e) => {
    if (e) e.stopPropagation();
    const formatted = formatColor(c.hex, color_format);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formatted);
    }
    set_copied_id(c.id);
    showToast(`Copied ${formatted} (${c.name}) to clipboard!`);
    setTimeout(() => {
      set_copied_id(null);
    }, 1500);
  };

  // Toggle display format (HEX -> RGB -> HSL)
  const handle_set_format = (fmt, e) => {
    if (e) e.stopPropagation();
    updateCard(card.id, { color_format: fmt }, true);
    saveCurrentBoardToStore();
    showToast(`Display format: ${fmt.toUpperCase()}`);
  };

  // Toggle layout mode
  const handle_set_layout = (layout, e) => {
    if (e) e.stopPropagation();
    updateCard(card.id, { palette_layout: layout }, true);
    saveCurrentBoardToStore();
  };

  // Add new swatch via color picker
  const handle_picker_change = (e) => {
    const new_hex = (e.target.value || '#3B82F6').toUpperCase();
    const new_color = {
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      hex: new_hex,
      name: suggestColorName(new_hex),
      role: 'Accent',
    };
    const updated = [...colors, new_color];
    updateCard(card.id, { colors: updated }, true);
    saveCurrentBoardToStore();
    showToast(`Added ${new_hex} to palette`);
  };

  // Add swatch(es) via text input (supports single or comma-separated hex codes)
  const handle_submit_quick_hex = (e) => {
    if (e) e.preventDefault();
    const text = quick_hex_input.trim();
    if (!text) return;

    // Split by comma or spaces in case multiple hex codes were entered
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    const new_items = [];

    for (const token of tokens) {
      let clean = token.trim();
      if (!clean) continue;
      if (!clean.startsWith('#')) clean = `#${clean}`;
      if (/^#[0-9A-Fa-f]{3,8}$/.test(clean)) {
        const hex = clean.toUpperCase();
        new_items.push({
          id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          hex,
          name: suggestColorName(hex),
          role: 'Accent',
        });
      }
    }

    if (new_items.length === 0) {
      showToast('Please enter a valid hex color code (e.g. #3B82F6)');
      return;
    }

    const updated = [...colors, ...new_items];
    updateCard(card.id, { colors: updated }, true);
    saveCurrentBoardToStore();
    set_quick_hex_input('');
    showToast(`Added ${new_items.length} color${new_items.length !== 1 ? 's' : ''} to palette`);
  };

  // Delete single swatch (allows deleting down to 0)
  const handle_delete_color = (id, e) => {
    if (e) e.stopPropagation();
    const updated = colors.filter((c) => c.id !== id);
    updateCard(card.id, { colors: updated }, true);
    saveCurrentBoardToStore();
    showToast('Removed color from palette');
  };

  // Clear all colors inside palette
  const handle_clear_all_colors = (e) => {
    if (e) e.stopPropagation();
    updateCard(card.id, { colors: [] }, true);
    saveCurrentBoardToStore();
    showToast('Deleted all colors from palette');
  };

  // Apply curated preset
  const handle_apply_preset = (preset, e) => {
    if (e) e.stopPropagation();
    updateCard(
      card.id,
      {
        title: preset.name,
        description: preset.description,
        colors: preset.colors,
      },
      true
    );
    saveCurrentBoardToStore();
    set_is_presets_open(false);
    showToast(`Applied palette: "${preset.name}"`);
  };

  // Copy entire palette as CSS variables
  const handle_copy_all_css = (e) => {
    if (e) e.stopPropagation();
    const css_vars = colors
      .map((c, i) => `  --color-${c.role ? c.role.toLowerCase() : i + 1}: ${c.hex}; /* ${c.name} */`)
      .join('\n');
    const full_css = `:root {\n${css_vars}\n}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(full_css);
    }
    showToast('Copied CSS Variables to clipboard!');
  };

  // Build linear-gradient CSS string for gradient mode
  const gradient_stops = colors.map((c) => c.hex).join(', ');
  const linear_gradient_style = `linear-gradient(90deg, ${gradient_stops})`;

  return (
    <div className={styles['lumen-palette-container']}>
      {/* Hidden native color picker */}
      <input
        ref={hidden_picker_ref}
        type="color"
        className={styles['lumen-palette-hidden-picker']}
        onChange={handle_picker_change}
        defaultValue="#2563EB"
      />

      {/* Sub-header Toolbar */}
      <div className={styles['lumen-palette-toolbar']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['lumen-palette-info']}>
          <span className={styles['lumen-palette-count-badge']}>
            {colors.length} Swatches
          </span>
          {card.description && (
            <span className={styles['lumen-palette-desc']} title={card.description}>
              {card.description}
            </span>
          )}
        </div>

        <div className={styles['lumen-palette-actions']}>
          {/* Format Selector */}
          <div className={styles['lumen-palette-pill-group']}>
            {['hex', 'rgb', 'hsl'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                className={`${styles['lumen-palette-pill-btn']} ${
                  color_format === fmt ? styles['lumen-palette-pill-btn-active'] : ''
                }`}
                onClick={(e) => handle_set_format(fmt, e)}
                title={`Format color values as ${fmt.toUpperCase()}`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Layout Mode Selector */}
          <div className={styles['lumen-palette-pill-group']}>
            <button
              type="button"
              className={`${styles['lumen-palette-pill-btn']} ${
                palette_layout === 'bars' ? styles['lumen-palette-pill-btn-active'] : ''
              }`}
              onClick={(e) => handle_set_layout('bars', e)}
              title="Continuous swatch bars"
            >
              Bars
            </button>
            <button
              type="button"
              className={`${styles['lumen-palette-pill-btn']} ${
                palette_layout === 'chips' ? styles['lumen-palette-pill-btn-active'] : ''
              }`}
              onClick={(e) => handle_set_layout('chips', e)}
              title="Individual color chips grid"
            >
              Chips
            </button>
            <button
              type="button"
              className={`${styles['lumen-palette-pill-btn']} ${
                palette_layout === 'gradient' ? styles['lumen-palette-pill-btn-active'] : ''
              }`}
              onClick={(e) => handle_set_layout('gradient', e)}
              title="Smooth gradient preview"
            >
              Grad
            </button>
          </div>
        </div>
      </div>

      {/* Main Swatch Visualization or Empty State Guidance */}
      {colors.length === 0 ? (
        <div className={styles['lumen-palette-empty-state']}>
          <div className={styles['lumen-palette-empty-icon-wrap']}>
            <PaletteIcon size={20} />
          </div>
          <div className={styles['lumen-palette-empty-title']}>Palette is Empty</div>
          <div className={styles['lumen-palette-empty-text']}>
            All colors were cleared. Input hex codes, use the color picker, or load a curated preset to start building your palette.
          </div>

          {/* Quick Hex / Comma List Input Form */}
          <form onSubmit={handle_submit_quick_hex} className={styles['lumen-palette-empty-form']}>
            <input
              type="text"
              className={styles['lumen-palette-empty-input']}
              value={quick_hex_input}
              onChange={(e) => set_quick_hex_input(e.target.value)}
              placeholder="#HEX (e.g. #2A2421 or #3B82F6, #10B981)..."
            />
            <button
              type="submit"
              className={`${styles['lumen-palette-action-btn']} ${styles['lumen-palette-action-btn-primary']}`}
              disabled={!quick_hex_input.trim()}
              title="Add entered hex color(s)"
            >
              <Plus size={11} />
              <span>Add</span>
            </button>
            <button
              type="button"
              className={styles['lumen-palette-action-btn']}
              onClick={() => hidden_picker_ref.current?.click()}
              title="Open native color picker"
            >
              <Sliders size={11} />
              <span>Pick</span>
            </button>
          </form>

          {/* Quick Presets Starters */}
          <div className={styles['lumen-palette-empty-presets-hint']}>Or load a curated preset:</div>
          <div className={styles['lumen-palette-empty-presets-row']}>
            {CURATED_PALETTES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={styles['lumen-palette-empty-preset-chip']}
                onClick={(e) => handle_apply_preset(preset, e)}
                title={preset.description}
              >
                <div className={styles['lumen-palette-preset-mini-dots']}>
                  {preset.colors.slice(0, 3).map((col, idx) => (
                    <span
                      key={idx}
                      className={styles['lumen-palette-preset-dot']}
                      style={{ backgroundColor: col.hex }}
                    />
                  ))}
                </div>
                <span>{preset.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 1. BARS MODE */}
          {palette_layout === 'bars' && (
            <div className={styles['lumen-palette-bars-view']}>
              {colors.map((c) => {
                const text_color = getContrastTextColor(c.hex);
                const is_copied = copied_id === c.id;
                const display_val = formatColor(c.hex, color_format);

                return (
                  <div
                    key={c.id}
                    className={styles['lumen-palette-bar-item']}
                    style={{ backgroundColor: c.hex, color: text_color }}
                    onClick={(e) => handle_copy_color(c, e)}
                    title={`Click to copy ${display_val}`}
                  >
                    <div className={styles['lumen-palette-bar-top']}>
                      <span
                        className={styles['lumen-palette-bar-role']}
                        style={{
                          color: text_color,
                          backgroundColor: text_color === '#FFFFFF' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {c.role || 'Swatch'}
                      </span>

                      <button
                        type="button"
                        className={styles['lumen-palette-bar-del']}
                        onClick={(e) => handle_delete_color(c.id, e)}
                        title={`Delete ${c.name}`}
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>

                    <div className={styles['lumen-palette-bar-center']}>
                      <div className={styles['lumen-palette-copy-indicator']}>
                        {is_copied ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
                        <span>{is_copied ? 'Copied!' : 'Copy'}</span>
                      </div>
                    </div>

                    <div className={styles['lumen-palette-bar-bottom']}>
                      <span className={styles['lumen-palette-bar-name']}>{c.name}</span>
                      <span className={styles['lumen-palette-bar-hex']}>{display_val}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. CHIPS MODE */}
          {palette_layout === 'chips' && (
            <div className={styles['lumen-palette-chips-view']}>
              {colors.map((c) => {
                const is_copied = copied_id === c.id;
                const display_val = formatColor(c.hex, color_format);
                const text_color = getContrastTextColor(c.hex);

                return (
                  <div
                    key={c.id}
                    className={styles['lumen-palette-chip-card']}
                    onClick={(e) => handle_copy_color(c, e)}
                    title={`Click to copy ${display_val}`}
                  >
                    <div className={styles['lumen-palette-chip-swatch']} style={{ backgroundColor: c.hex }}>
                      {is_copied && (
                        <div
                          className={styles['lumen-palette-copy-indicator']}
                          style={{
                            backgroundColor: text_color === '#FFFFFF' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
                            color: text_color === '#FFFFFF' ? '#ffffff' : '#0f172a',
                          }}
                        >
                          <Check size={10} color="#22c55e" />
                          <span>Copied</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className={styles['lumen-palette-bar-del']}
                        style={{ position: 'absolute', top: 4, right: 4 }}
                        onClick={(e) => handle_delete_color(c.id, e)}
                        title={`Delete ${c.name}`}
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>
                    <div className={styles['lumen-palette-chip-details']}>
                      <span className={styles['lumen-palette-chip-name']}>{c.name}</span>
                      <div className={styles['lumen-palette-chip-sub']}>
                        <span className={styles['lumen-palette-chip-code']}>{display_val}</span>
                        <span className={styles['lumen-palette-chip-role']}>{c.role || 'Token'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. GRADIENT MODE */}
          {palette_layout === 'gradient' && (
            <div className={styles['lumen-palette-gradient-view']}>
              <div
                className={styles['lumen-palette-gradient-bar']}
                style={{ background: linear_gradient_style }}
                onClick={(e) => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(linear_gradient_style);
                  }
                  showToast('Copied CSS linear-gradient to clipboard!');
                }}
                title="Click to copy CSS linear-gradient string"
              />

              <div className={styles['lumen-palette-gradient-stops']}>
                {colors.map((c) => {
                  const display_val = formatColor(c.hex, color_format);
                  return (
                    <div
                      key={c.id}
                      className={styles['lumen-palette-gradient-stop']}
                      onClick={(e) => handle_copy_color(c, e)}
                      title={`Click to copy ${display_val} (${c.name})`}
                    >
                      <div
                        className={styles['lumen-palette-gradient-dot']}
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className={styles['lumen-palette-gradient-label']}>{display_val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer Actions */}
      <div className={styles['lumen-palette-footer']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['lumen-palette-footer-left']}>
          <button
            type="button"
            className={`${styles['lumen-palette-action-btn']} ${styles['lumen-palette-action-btn-primary']}`}
            onClick={() => hidden_picker_ref.current?.click()}
            title="Pick and add a new color to this palette"
          >
            <Plus size={12} />
            <span>Add Color</span>
          </button>

          {colors.length > 0 && (
            <button
              type="button"
              className={styles['lumen-palette-action-btn']}
              onClick={handle_copy_all_css}
              title="Copy entire palette formatted as CSS Variables"
            >
              <Copy size={11} />
              <span>Copy CSS</span>
            </button>
          )}

          {colors.length > 0 && (
            <button
              type="button"
              className={`${styles['lumen-palette-action-btn']} ${styles['lumen-palette-btn-danger']}`}
              onClick={handle_clear_all_colors}
              title="Delete all colors from this palette"
            >
              <Trash2 size={11} />
              <span>Clear All</span>
            </button>
          )}
        </div>

        <div style={{ position: 'relative' }} ref={presets_ref}>
          <button
            type="button"
            className={styles['lumen-palette-action-btn']}
            onClick={() => set_is_presets_open(!is_presets_open)}
            title="Choose from curated design palettes"
          >
            <Sparkles size={11} color="#eab308" />
            <span>Presets</span>
            <ChevronDown size={10} />
          </button>

          {is_presets_open && (
            <div className={styles['lumen-palette-presets-dropdown']}>
              <div className={styles['lumen-palette-presets-title']}>Curated Palettes</div>
              {CURATED_PALETTES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={styles['lumen-palette-preset-item']}
                  onClick={(e) => handle_apply_preset(preset, e)}
                  title={preset.description}
                >
                  <span className={styles['lumen-palette-preset-name']}>{preset.name}</span>
                  <div className={styles['lumen-palette-preset-swatches']}>
                    {preset.colors.map((col, idx) => (
                      <div
                        key={idx}
                        className={styles['lumen-palette-preset-swatch-slice']}
                        style={{ backgroundColor: col.hex }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
