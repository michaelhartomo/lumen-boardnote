import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  X,
  Search,
  Copy,
  Check,
  Sun,
  Moon,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import styles from './LUMEN_currency_card.module.css';
import { updateCard, showToast } from '../../signals/boardState.js';

export const GLOBAL_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', decimals: 2, default_rate: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', decimals: 2, default_rate: 0.92 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩', decimals: 0, default_rate: 16250 },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', decimals: 2, default_rate: 0.79 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', decimals: 0, default_rate: 154.8 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', decimals: 2, default_rate: 1.34 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', decimals: 2, default_rate: 1.53 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', decimals: 2, default_rate: 1.39 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭', decimals: 2, default_rate: 0.88 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', decimals: 2, default_rate: 7.24 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰', decimals: 2, default_rate: 7.78 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷', decimals: 0, default_rate: 1395 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾', decimals: 2, default_rate: 4.45 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭', decimals: 2, default_rate: 34.6 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', decimals: 2, default_rate: 84.4 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭', decimals: 2, default_rate: 58.6 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳', decimals: 0, default_rate: 25380 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼', decimals: 2, default_rate: 32.5 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿', decimals: 2, default_rate: 1.69 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪', decimals: 2, default_rate: 3.6725 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦', decimals: 2, default_rate: 3.75 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷', decimals: 2, default_rate: 5.78 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', flag: '🇲🇽', decimals: 2, default_rate: 20.3 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦', decimals: 2, default_rate: 18.1 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷', decimals: 2, default_rate: 34.4 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪', decimals: 2, default_rate: 10.85 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴', decimals: 2, default_rate: 11.05 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰', decimals: 2, default_rate: 6.88 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱', decimals: 2, default_rate: 4.02 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿', decimals: 2, default_rate: 23.6 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺', decimals: 0, default_rate: 378 },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', flag: '🇮🇱', decimals: 2, default_rate: 3.74 },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$', flag: '🇨🇱', decimals: 0, default_rate: 975 },
  { code: 'COP', name: 'Colombian Peso', symbol: 'COL$', flag: '🇨🇴', decimals: 0, default_rate: 4410 },
];

const DEFAULT_SELECTED_CODES = ['USD', 'EUR', 'IDR', 'JPY', 'GBP', 'SGD'];

const BASELINE_USD_RATES = GLOBAL_CURRENCIES.reduce((acc, item) => {
  acc[item.code] = item.default_rate;
  return acc;
}, {});

function get_currency_meta(code) {
  return (
    GLOBAL_CURRENCIES.find((c) => c.code === code) || {
      code,
      name: code,
      symbol: code,
      flag: '💱',
      decimals: 2,
      default_rate: 1,
    }
  );
}

// Safely evaluate simple numeric input or arithmetic expressions like "150 + 25" or "1200 * 1.1"
function parse_numeric_or_expression(raw_str) {
  if (raw_str === null || raw_str === undefined) return 0;
  const cleaned = String(raw_str).replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const direct_num = Number(cleaned);
  if (Number.isFinite(direct_num)) return direct_num;

  // Allow safe basic arithmetic characters only: digits, ., +, -, *, /, (, ), spaces
  if (/^[0-9.+\-*/()\s]+$/.test(cleaned)) {
    try {
      // eslint-disable-next-line no-new-func
      const evaluated = Function(`"use strict"; return (${cleaned});`)();
      if (typeof evaluated === 'number' && Number.isFinite(evaluated)) {
        return Math.max(0, evaluated);
      }
    } catch {
      // fall through
    }
  }
  const fallback_num = parseFloat(cleaned);
  return Number.isFinite(fallback_num) ? fallback_num : 0;
}

function format_currency_amount(amount, code) {
  if (!Number.isFinite(amount)) return '0';
  if (amount === 0) return '0';
  const meta = get_currency_meta(code);
  const abs_val = Math.abs(amount);

  let max_frac = meta.decimals;
  let min_frac = meta.decimals;

  if (abs_val > 0 && abs_val < 1) {
    max_frac = 4;
    min_frac = 2;
  } else if (meta.decimals === 0 && abs_val < 100) {
    max_frac = 2;
    min_frac = 0;
  }

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: min_frac,
    maximumFractionDigits: max_frac,
  });
}

export default function LUMEN_currency_card({ card }) {
  const initial_data = useMemo(() => {
    const raw = card.currency_data || card.data?.currency_data || {};
    return {
      selected_codes:
        Array.isArray(raw.selected_codes) && raw.selected_codes.length > 0
          ? raw.selected_codes
          : DEFAULT_SELECTED_CODES,
      base_code: raw.base_code || 'USD',
      base_amount: typeof raw.base_amount === 'number' && Number.isFinite(raw.base_amount) ? raw.base_amount : 100,
      theme: raw.theme || 'dark',
      rates_usd:
        raw.rates_usd && typeof raw.rates_usd === 'object'
          ? { ...BASELINE_USD_RATES, ...raw.rates_usd }
          : { ...BASELINE_USD_RATES },
      last_updated: raw.last_updated || null,
    };
  }, [card.currency_data, card.data]);

  const [selected_codes, set_selected_codes] = useState(initial_data.selected_codes);
  const [base_code, set_base_code] = useState(initial_data.base_code);
  const [base_amount, set_base_amount] = useState(initial_data.base_amount);
  const [theme, set_theme] = useState(initial_data.theme);
  const [rates_usd, set_rates_usd] = useState(initial_data.rates_usd);
  const [last_updated, set_last_updated] = useState(initial_data.last_updated);

  // Track which currency input is actively being typed by the user so cursor & decimals don't jump
  const [editing_code, set_editing_code] = useState(null);
  const [editing_raw_text, set_editing_raw_text] = useState('');

  // Drag & Drop Reorder state
  const [dragged_code, set_dragged_code] = useState(null);
  const [drag_over_code, set_drag_over_code] = useState(null);

  // Currency Picker Drawer state
  const [is_picker_open, set_is_picker_open] = useState(false);
  const [picker_search, set_picker_search] = useState('');
  const [is_fetching_rates, set_is_fetching_rates] = useState(false);
  const [is_copied, set_is_copied] = useState(false);

  // Sync from external card updates
  useEffect(() => {
    const raw = card.currency_data || card.data?.currency_data;
    if (!raw) return;
    if (Array.isArray(raw.selected_codes) && raw.selected_codes.length > 0) {
      set_selected_codes(raw.selected_codes);
    }
    if (raw.base_code) {
      set_base_code(raw.base_code);
    }
    if (typeof raw.base_amount === 'number' && Number.isFinite(raw.base_amount)) {
      set_base_amount(raw.base_amount);
    }
    if (raw.theme) {
      set_theme(raw.theme);
    }
  }, [card.currency_data, card.data]);

  const persist_currency_state = useCallback(
    (
      next_codes = selected_codes,
      next_base_code = base_code,
      next_base_amount = base_amount,
      next_theme = theme,
      next_rates = rates_usd,
      next_updated = last_updated,
      record_history = false
    ) => {
      const payload = {
        selected_codes: next_codes,
        base_code: next_base_code,
        base_amount: next_base_amount,
        theme: next_theme,
        rates_usd: next_rates,
        last_updated: next_updated,
      };
      updateCard(
        card.id,
        {
          currency_data: payload,
          data: {
            ...(card.data || {}),
            currency_data: payload,
          },
        },
        record_history
      );
    },
    [
      selected_codes,
      base_code,
      base_amount,
      theme,
      rates_usd,
      last_updated,
      card.id,
      card.data,
    ]
  );

  // Fetch live exchange rates from public FX endpoint
  const fetch_live_exchange_rates = useCallback(
    async (silent = false) => {
      set_is_fetching_rates(true);
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!res.ok) throw new Error('FX endpoint status ' + res.status);
        const json = await res.json();
        if (json && json.rates && typeof json.rates === 'object') {
          const merged_rates = { ...BASELINE_USD_RATES, ...json.rates };
          const now_ts = Date.now();
          set_rates_usd(merged_rates);
          set_last_updated(now_ts);
          persist_currency_state(
            selected_codes,
            base_code,
            base_amount,
            theme,
            merged_rates,
            now_ts,
            false
          );
          if (!silent) {
            showToast('Updated live global exchange rates');
          }
        }
      } catch {
        if (!silent) {
          showToast('Using built-in exchange rates');
        }
      } finally {
        set_is_fetching_rates(false);
      }
    },
    [selected_codes, base_code, base_amount, theme, persist_currency_state]
  );

  // Auto-fetch live exchange rates on mount if older than 30 minutes
  useEffect(() => {
    const thirty_mins = 30 * 60 * 1000;
    if (!last_updated || Date.now() - last_updated > thirty_mins) {
      fetch_live_exchange_rates(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert from base_code & base_amount to any target currency code
  const convert_amount = useCallback(
    (target_code, source_code = base_code, source_amount = base_amount) => {
      if (target_code === source_code) return source_amount;
      const source_rate = Number(rates_usd[source_code]) || 1;
      const target_rate = Number(rates_usd[target_code]) || 1;
      const amount_in_usd = source_amount / source_rate;
      return amount_in_usd * target_rate;
    },
    [base_code, base_amount, rates_usd]
  );

  // Get 1 unit exchange rate from current base_code to target_code
  const get_unit_rate = useCallback(
    (target_code) => {
      const source_rate = Number(rates_usd[base_code]) || 1;
      const target_rate = Number(rates_usd[target_code]) || 1;
      return target_rate / source_rate;
    },
    [base_code, rates_usd]
  );

  // When any currency row input changes, update base_code and base_amount so ALL other currencies update immediately
  const handle_currency_input_change = (code, raw_val) => {
    set_editing_code(code);
    set_editing_raw_text(raw_val);
    const parsed = parse_numeric_or_expression(raw_val);
    set_base_code(code);
    set_base_amount(parsed);
    persist_currency_state(selected_codes, code, parsed, theme, rates_usd, last_updated, false);
  };

  const handle_currency_input_focus = (code) => {
    const current_val = convert_amount(code, base_code, base_amount);
    set_editing_code(code);
    const meta = get_currency_meta(code);
    const formatted_plain =
      current_val === 0
        ? ''
        : meta.decimals === 0 && current_val >= 100
        ? String(Math.round(current_val))
        : String(Number(current_val.toFixed(meta.decimals)));
    set_editing_raw_text(formatted_plain);
    if (base_code !== code) {
      set_base_code(code);
      set_base_amount(current_val);
    }
  };

  const handle_currency_input_blur = (code) => {
    const final_num = parse_numeric_or_expression(editing_raw_text);
    set_editing_code(null);
    set_editing_raw_text('');
    set_base_code(code);
    set_base_amount(final_num);
    persist_currency_state(selected_codes, code, final_num, theme, rates_usd, last_updated, true);
  };

  const handle_toggle_currency_in_list = (code) => {
    const exists = selected_codes.includes(code);
    if (exists) {
      if (selected_codes.length <= 2) {
        showToast('Keep at least 2 currencies in the calculator');
        return;
      }
      const next_codes = selected_codes.filter((c) => c !== code);
      const next_base = base_code === code ? next_codes[0] : base_code;
      const next_amt =
        base_code === code ? convert_amount(next_base, base_code, base_amount) : base_amount;
      set_selected_codes(next_codes);
      set_base_code(next_base);
      set_base_amount(next_amt);
      persist_currency_state(
        next_codes,
        next_base,
        next_amt,
        theme,
        rates_usd,
        last_updated,
        true
      );
    } else {
      const next_codes = [...selected_codes, code];
      set_selected_codes(next_codes);
      persist_currency_state(
        next_codes,
        base_code,
        base_amount,
        theme,
        rates_usd,
        last_updated,
        true
      );
    }
  };

  // Reorder currency row via Up / Down buttons
  const handle_move_currency_row = (from_idx, to_idx, e) => {
    if (e) e.stopPropagation();
    if (
      from_idx < 0 ||
      to_idx < 0 ||
      from_idx >= selected_codes.length ||
      to_idx >= selected_codes.length ||
      from_idx === to_idx
    ) {
      return;
    }
    const next_codes = [...selected_codes];
    const [moved] = next_codes.splice(from_idx, 1);
    next_codes.splice(to_idx, 0, moved);
    set_selected_codes(next_codes);
    persist_currency_state(
      next_codes,
      base_code,
      base_amount,
      theme,
      rates_usd,
      last_updated,
      true
    );
  };

  // Drag & Drop handlers for reordering currency rows
  const handle_drag_start_row = (e, code) => {
    e.stopPropagation();
    // Prevent row drag if user is actively selecting text inside the amount input
    if (e.target && e.target.tagName === 'INPUT') {
      e.preventDefault();
      return;
    }
    set_dragged_code(code);
    set_drag_over_code(code);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('application/lumen-currency-code', code);
        e.dataTransfer.setData('text/plain', code);
      } catch {
        // ignore dataTransfer restrictions
      }

      const row_el = e.currentTarget;
      if (row_el && typeof document !== 'undefined') {
        const rect = row_el.getBoundingClientRect();
        const ghost_el = row_el.cloneNode(true);
        ghost_el.style.position = 'fixed';
        ghost_el.style.top = '-9999px';
        ghost_el.style.left = '-9999px';
        ghost_el.style.width = `${Math.round(rect.width)}px`;
        ghost_el.style.height = `${Math.round(rect.height)}px`;
        ghost_el.style.minHeight = `${Math.round(rect.height)}px`;
        ghost_el.style.maxHeight = `${Math.round(rect.height)}px`;
        ghost_el.style.boxSizing = 'border-box';
        ghost_el.style.borderRadius = '9px';
        ghost_el.style.border = '1.5px solid #38bdf8';
        ghost_el.style.background = theme === 'light' ? '#ffffff' : '#161f33';
        ghost_el.style.boxShadow = '0 10px 24px -4px rgba(37, 99, 235, 0.35)';
        ghost_el.style.pointerEvents = 'none';
        ghost_el.style.zIndex = '99999';
        document.body.appendChild(ghost_el);

        const offset_x = Math.min(Math.max(24, e.clientX - rect.left), rect.width - 24);
        const offset_y = Math.min(Math.max(16, e.clientY - rect.top), rect.height - 16);
        try {
          e.dataTransfer.setDragImage(ghost_el, offset_x, offset_y);
        } catch {
          // ignore setDragImage fallback
        }
        requestAnimationFrame(() => {
          if (ghost_el.parentNode) {
            ghost_el.parentNode.removeChild(ghost_el);
          }
        });
      }
    }
  };

  const handle_drag_over_row = (e, target_code) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (!dragged_code || dragged_code === target_code) return;
    set_drag_over_code(target_code);

    const from_idx = selected_codes.indexOf(dragged_code);
    const to_idx = selected_codes.indexOf(target_code);
    if (from_idx === -1 || to_idx === -1 || from_idx === to_idx) return;

    const next_codes = [...selected_codes];
    const [moved] = next_codes.splice(from_idx, 1);
    next_codes.splice(to_idx, 0, moved);
    set_selected_codes(next_codes);
  };

  const handle_drag_over_card_container = (e) => {
    if (!dragged_code) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handle_drop_row = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragged_code) {
      persist_currency_state(
        selected_codes,
        base_code,
        base_amount,
        theme,
        rates_usd,
        last_updated,
        true
      );
    }
    set_dragged_code(null);
    set_drag_over_code(null);
  };

  const handle_drag_end_row = (e) => {
    if (e) e.stopPropagation();
    if (dragged_code) {
      persist_currency_state(
        selected_codes,
        base_code,
        base_amount,
        theme,
        rates_usd,
        last_updated,
        true
      );
    }
    set_dragged_code(null);
    set_drag_over_code(null);
  };

  const handle_quick_preset_amount = (preset_val) => {
    set_editing_code(null);
    set_base_amount(preset_val);
    persist_currency_state(
      selected_codes,
      base_code,
      preset_val,
      theme,
      rates_usd,
      last_updated,
      true
    );
  };

  const handle_quick_math_factor = (factor) => {
    const next_amt = Number((base_amount * factor).toFixed(4));
    set_editing_code(null);
    set_base_amount(next_amt);
    persist_currency_state(
      selected_codes,
      base_code,
      next_amt,
      theme,
      rates_usd,
      last_updated,
      true
    );
  };

  const handle_copy_all_conversions = (e) => {
    e.stopPropagation();
    const lines = selected_codes.map((code) => {
      const meta = get_currency_meta(code);
      const val = convert_amount(code, base_code, base_amount);
      return `${meta.flag} ${code} (${meta.name}): ${meta.symbol} ${format_currency_amount(val, code)}`;
    });
    const summary_text = `Currency Conversion (${base_code} Base):\n${lines.join('\n')}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary_text).catch(() => {});
    }
    set_is_copied(true);
    showToast('Copied all currency conversions to clipboard');
    setTimeout(() => set_is_copied(false), 1800);
  };

  const handle_toggle_theme = (e) => {
    e.stopPropagation();
    const next_theme = theme === 'dark' ? 'light' : 'dark';
    set_theme(next_theme);
    persist_currency_state(
      selected_codes,
      base_code,
      base_amount,
      next_theme,
      rates_usd,
      last_updated,
      false
    );
  };

  const filtered_picker_currencies = useMemo(() => {
    const q = picker_search.trim().toLowerCase();
    if (!q) return GLOBAL_CURRENCIES;
    return GLOBAL_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [picker_search]);

  return (
    <div
      className={`${styles['lumen-currency-card-root']} ${
        theme === 'light' ? styles['lumen-currency-theme-light'] : ''
      }`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDragOver={handle_drag_over_card_container}
      onDrop={handle_drop_row}
    >
      {/* Top Toolbar */}
      <div className={styles['lumen-currency-toolbar']}>
        <div className={styles['lumen-currency-toolbar-left']}>
          <div className={styles['lumen-currency-status-pill']} title="Multi-currency live sync active">
            <span className={styles['lumen-currency-status-dot']} />
            <span>{selected_codes.length} Currencies</span>
          </div>

          <button
            type="button"
            className={`${styles['lumen-currency-tool-btn']} ${styles['lumen-currency-add-btn']} ${
              is_picker_open ? styles['lumen-currency-tool-btn-active'] : ''
            }`}
            onClick={() => set_is_picker_open((prev) => !prev)}
            title="Select or add currencies to calculator"
          >
            <Plus size={12} />
            <span>Add / Select Currency</span>
          </button>
        </div>

        <div className={styles['lumen-currency-toolbar-right']}>
          <button
            type="button"
            className={styles['lumen-currency-tool-btn']}
            onClick={() => fetch_live_exchange_rates(false)}
            disabled={is_fetching_rates}
            title="Refresh live exchange rates"
          >
            <RefreshCw
              size={12}
              className={is_fetching_rates ? styles['lumen-currency-spin'] : ''}
            />
            <span>Rates</span>
          </button>

          <button
            type="button"
            className={styles['lumen-currency-tool-btn']}
            onClick={handle_copy_all_conversions}
            title="Copy all currency conversions"
          >
            {is_copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{is_copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            className={styles['lumen-currency-tool-btn']}
            onClick={handle_toggle_theme}
            title={theme === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
          >
            {theme === 'light' ? <Moon size={12} /> : <Sun size={12} />}
          </button>
        </div>
      </div>

      {/* Quick Preset Amounts & Calculator Modifiers */}
      <div className={styles['lumen-currency-quick-bar']}>
        <div className={styles['lumen-currency-presets-group']}>
          <span className={styles['lumen-currency-quick-label']}>{base_code}:</span>
          {[
            { label: '1', val: 1 },
            { label: '10', val: 10 },
            { label: '100', val: 100 },
            { label: '1K', val: 1000 },
            { label: '10K', val: 10000 },
            { label: '100K', val: 100000 },
            { label: '1M', val: 1000000 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className={styles['lumen-currency-chip-btn']}
              onClick={() => handle_quick_preset_amount(item.val)}
              title={`Set ${base_code} to ${item.val.toLocaleString()}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles['lumen-currency-ops-group']}>
          <button
            type="button"
            className={`${styles['lumen-currency-chip-btn']} ${styles['lumen-currency-op-btn']}`}
            onClick={() => handle_quick_math_factor(1.1)}
            title="Add 10% (+10%)"
          >
            +10%
          </button>
          <button
            type="button"
            className={`${styles['lumen-currency-chip-btn']} ${styles['lumen-currency-op-btn']}`}
            onClick={() => handle_quick_math_factor(0.9)}
            title="Subtract 10% (-10%)"
          >
            -10%
          </button>
          <button
            type="button"
            className={`${styles['lumen-currency-chip-btn']} ${styles['lumen-currency-op-btn']}`}
            onClick={() => handle_quick_math_factor(2)}
            title="Multiply by 2 (×2)"
          >
            ×2
          </button>
          <button
            type="button"
            className={`${styles['lumen-currency-chip-btn']} ${styles['lumen-currency-op-btn']}`}
            onClick={() => handle_quick_math_factor(0.5)}
            title="Divide by 2 (÷2)"
          >
            ÷2
          </button>
        </div>
      </div>

      {/* Add / Select Currency Drawer */}
      {is_picker_open && (
        <div className={styles['lumen-currency-picker-drawer']}>
          <div className={styles['lumen-currency-picker-top']}>
            <div className={styles['lumen-currency-search-wrap']}>
              <Search size={12} className={styles['lumen-currency-search-icon']} />
              <input
                type="text"
                className={styles['lumen-currency-search-input']}
                value={picker_search}
                onChange={(e) => set_picker_search(e.target.value)}
                placeholder="Search currency code or country (e.g. USD, IDR, EUR, JPY, GBP, SGD)..."
                autoFocus
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') set_is_picker_open(false);
                }}
              />
            </div>
            <button
              type="button"
              className={styles['lumen-currency-tool-btn']}
              onClick={() => set_is_picker_open(false)}
              title="Close currency picker"
            >
              <X size={12} />
              <span>Done</span>
            </button>
          </div>

          <div className={styles['lumen-currency-picker-grid']}>
            {filtered_picker_currencies.map((cur) => {
              const is_selected = selected_codes.includes(cur.code);
              return (
                <button
                  key={cur.code}
                  type="button"
                  className={`${styles['lumen-currency-picker-item']} ${
                    is_selected ? styles['lumen-currency-picker-item-selected'] : ''
                  }`}
                  onClick={() => handle_toggle_currency_in_list(cur.code)}
                  title={`${cur.name} (${cur.code}) — Click to ${
                    is_selected ? 'remove' : 'add'
                  }`}
                >
                  <div className={styles['lumen-currency-picker-item-left']}>
                    <span className={styles['lumen-currency-flag']}>{cur.flag}</span>
                    <div>
                      <div className={styles['lumen-currency-picker-code']}>{cur.code}</div>
                      <div className={styles['lumen-currency-picker-name']}>{cur.name}</div>
                    </div>
                  </div>
                  {is_selected ? <Check size={12} /> : <Plus size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Currency Interactive List */}
      <div
        className={styles['lumen-currency-list']}
        onWheel={(e) => e.stopPropagation()}
        onDragOver={handle_drag_over_card_container}
        onDrop={handle_drop_row}
      >
        {selected_codes.map((code, row_idx) => {
          const meta = get_currency_meta(code);
          const is_active_base = base_code === code;
          const is_editing_this = editing_code === code;
          const is_dragging_this = dragged_code === code;
          const is_drag_over_this = drag_over_code === code && dragged_code !== code;
          const converted_val = convert_amount(code, base_code, base_amount);
          const unit_rate = get_unit_rate(code);

          const display_value = is_editing_this
            ? editing_raw_text
            : format_currency_amount(converted_val, code);

          return (
            <div
              key={code}
              draggable={editing_code !== code}
              onDragStart={(e) => handle_drag_start_row(e, code)}
              onDragOver={(e) => handle_drag_over_row(e, code)}
              onDrop={handle_drop_row}
              onDragEnd={handle_drag_end_row}
              className={`${styles['lumen-currency-row']} ${
                is_active_base ? styles['lumen-currency-row-active'] : ''
              } ${is_dragging_this ? styles['lumen-currency-row-dragging'] : ''} ${
                is_drag_over_this ? styles['lumen-currency-row-drag-over'] : ''
              }`}
              onClick={() => {
                if (base_code !== code) {
                  set_base_code(code);
                  set_base_amount(converted_val);
                }
              }}
            >
              {/* Line 1: Main Currency Header & Amount Input */}
              <div className={styles['lumen-currency-row-top']}>
                <div className={styles['lumen-currency-row-left']}>
                  <div
                    className={styles['lumen-currency-drag-handle']}
                    title={`Drag handle: reorder ${code}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={14} />
                  </div>

                  <span className={styles['lumen-currency-row-flag']}>{meta.flag}</span>

                  <div className={styles['lumen-currency-row-meta']}>
                    <div className={styles['lumen-currency-row-code-line']}>
                      <span className={styles['lumen-currency-row-code']}>{meta.code}</span>
                      {is_active_base && (
                        <span className={styles['lumen-currency-base-badge']}>Active</span>
                      )}
                    </div>
                    <span className={styles['lumen-currency-row-name']} title={meta.name}>
                      {meta.name}
                    </span>
                  </div>
                </div>

                <div className={styles['lumen-currency-row-right']}>
                  <div className={styles['lumen-currency-input-box']}>
                    <span className={styles['lumen-currency-symbol']}>{meta.symbol}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles['lumen-currency-amount-input']}
                      value={display_value}
                      placeholder="0"
                      onFocus={(e) => {
                        handle_currency_input_focus(code);
                        requestAnimationFrame(() => e.target.select());
                      }}
                      onChange={(e) => handle_currency_input_change(code, e.target.value)}
                      onBlur={() => handle_currency_input_blur(code)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      title={`Type any amount or math expression (e.g. 250+50) in ${code} — all other currencies update automatically`}
                    />
                  </div>
                </div>
              </div>

              {/* Line 2: Layer-Panel-Style Action Toolbar (Up / Down + Rate & Remove) */}
              <div
                className={styles['lumen-currency-row-actions']}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles['lumen-currency-actions-group']}>
                  <button
                    type="button"
                    className={styles['lumen-currency-action-btn']}
                    disabled={row_idx === 0}
                    onClick={(e) => handle_move_currency_row(row_idx, row_idx - 1, e)}
                    title={`Move ${code} up`}
                  >
                    <ChevronUp size={13} />
                    <span>Up</span>
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-currency-action-btn']}
                    disabled={row_idx === selected_codes.length - 1}
                    onClick={(e) => handle_move_currency_row(row_idx, row_idx + 1, e)}
                    title={`Move ${code} down`}
                  >
                    <ChevronDown size={13} />
                    <span>Down</span>
                  </button>
                </div>

                <div className={styles['lumen-currency-actions-group']}>
                  <span className={styles['lumen-currency-row-rate-sub']}>
                    1 {base_code} = {format_currency_amount(unit_rate, code)} {code}
                  </span>

                  <button
                    type="button"
                    className={`${styles['lumen-currency-action-btn']} ${styles['lumen-currency-action-delete']}`}
                    disabled={selected_codes.length <= 2}
                    onClick={(e) => {
                      e.stopPropagation();
                      handle_toggle_currency_in_list(code);
                    }}
                    title={
                      selected_codes.length <= 2
                        ? 'Keep at least 2 currencies'
                        : `Remove ${code} from list`
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={styles['lumen-currency-footer']}>
        <div className={styles['lumen-currency-footer-meta']}>
          <span>Drag or use ↑↓ to reorder</span>
          <span>·</span>
          <span>Supports math (e.g. 150+50)</span>
        </div>
        <div className={styles['lumen-currency-footer-meta']}>
          <span>
            {last_updated
              ? `FX updated ${new Date(last_updated).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Live FX Ready'}
          </span>
        </div>
      </div>
    </div>
  );
}
