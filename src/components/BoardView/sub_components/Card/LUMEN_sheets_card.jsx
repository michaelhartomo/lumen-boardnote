import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Table,
  Plus,
  Minus,
  CheckSquare,
  Square,
  Calculator,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  FileSpreadsheet,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
  Download,
  Check,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
} from 'lucide-react';
import styles from './LUMEN_sheets_card.module.css';
import { updateCard, showToast } from '../../signals/boardState.js';

// Default columns: A to F (index 0 to 5)
const DEFAULT_COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DEFAULT_ROWS_COUNT = 8;
const DEFAULT_COL_WIDTHS = {
  A: 56,
  B: 165,
  C: 96,
  D: 64,
  E: 115,
  F: 120,
};
const FALLBACK_COL_WIDTH = 110;

/**
 * Initial Default Blank Sheet
 */
export const DEFAULT_INITIAL_SHEET = {
  cols: ['A', 'B', 'C', 'D', 'E', 'F'],
  rows_count: 8,
  col_widths: { ...DEFAULT_COL_WIDTHS },
  cells: {},
};

/**
 * Convert column index (0-based) to letter (0 -> A, 25 -> Z, 26 -> AA)
 */
function get_col_letter(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Convert column letter (A -> 0, Z -> 25, AA -> 26) to 0-based index
 */
function col_letter_to_index(col_str) {
  if (!col_str) return -1;
  const upper = String(col_str).toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parse cell coordinates e.g. 'A1' -> { col: 'A', row: 1 }
 */
function parse_cell_id(id) {
  if (!id) return null;
  const match = String(id).toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: match[1], row: parseInt(match[2], 10) };
}

/**
 * Expand a range string like 'A1:A5' or 'B2:D4' into array of cell IDs
 */
function expand_range(range_str) {
  const parts = range_str.toUpperCase().split(':');
  if (parts.length === 1) return [parts[0]];
  const start = parse_cell_id(parts[0]);
  const end = parse_cell_id(parts[1]);
  if (!start || !end) return [];

  const start_col_idx = col_letter_to_index(start.col);
  const end_col_idx = col_letter_to_index(end.col);
  const min_col = Math.min(start_col_idx, end_col_idx);
  const max_col = Math.max(start_col_idx, end_col_idx);

  const min_row = Math.min(start.row, end.row);
  const max_row = Math.max(start.row, end.row);

  const cells = [];
  for (let r = min_row; r <= max_row; r++) {
    for (let c = min_col; c <= max_col; c++) {
      cells.push(`${get_col_letter(c)}${r}`);
    }
  }
  return cells;
}

/**
 * Adapt cell and range references inside a formula string by (delta_col, delta_row)
 * when pasting a copied or cut cell/group to a new location.
 */
function adapt_pasted_formula(raw_val, delta_col, delta_row) {
  if (typeof raw_val !== 'string' || !raw_val.trim().startsWith('=')) {
    return raw_val;
  }
  if (delta_col === 0 && delta_row === 0) {
    return raw_val;
  }

  const shift_ref = (col_dollar, col_str, row_dollar, row_str) => {
    const orig_col = col_letter_to_index(col_str);
    const orig_row = parseInt(row_str, 10);
    if (orig_col < 0 || Number.isNaN(orig_row)) {
      return `${col_dollar}${col_str}${row_dollar}${row_str}`;
    }
    const next_col = col_dollar ? orig_col : Math.max(0, orig_col + delta_col);
    const next_row = row_dollar ? orig_row : Math.max(1, orig_row + delta_row);
    return `${col_dollar}${get_col_letter(next_col)}${row_dollar}${next_row}`;
  };

  return raw_val.replace(
    /(\$?)([A-Z]+)(\$?)(\d+)(?::(\$?)([A-Z]+)(\$?)(\d+))?(?![A-Za-z0-9_(])/gi,
    (
      full_match,
      c1_d,
      c1_s,
      r1_d,
      r1_s,
      c2_d,
      c2_s,
      r2_d,
      r2_s,
      offset,
      source_str
    ) => {
      if (offset > 0 && /[A-Za-z0-9_]/.test(source_str[offset - 1])) {
        return full_match;
      }
      const first_part = shift_ref(c1_d || '', c1_s, r1_d || '', r1_s);
      if (c2_s && r2_s) {
        const second_part = shift_ref(c2_d || '', c2_s, r2_d || '', r2_s);
        return `${first_part}:${second_part}`;
      }
      return first_part;
    }
  );
}

/**
 * When a range of cells is CUT and pasted at (delta_col, delta_row),
 * update formulas across the sheet that referenced cells inside the cut bounds.
 */
function adapt_sheet_formulas_on_cut_paste(cells_map, src_bounds, delta_col, delta_row, pasted_ids_set) {
  if (!src_bounds || (delta_col === 0 && delta_row === 0)) return;

  const is_in_bounds = (col_idx, row_num) =>
    col_idx >= src_bounds.min_col &&
    col_idx <= src_bounds.max_col &&
    row_num >= src_bounds.min_row &&
    row_num <= src_bounds.max_row;

  Object.keys(cells_map).forEach((cell_id) => {
    if (pasted_ids_set && pasted_ids_set.has(cell_id)) return;
    const cell_obj = cells_map[cell_id];
    if (!cell_obj || typeof cell_obj.raw !== 'string' || !cell_obj.raw.trim().startsWith('=')) {
      return;
    }

    const updated_raw = cell_obj.raw.replace(
      /(\$?)([A-Z]+)(\$?)(\d+)(?::(\$?)([A-Z]+)(\$?)(\d+))?(?![A-Za-z0-9_(])/gi,
      (
        full_match,
        c1_d,
        c1_s,
        r1_d,
        r1_s,
        c2_d,
        c2_s,
        r2_d,
        r2_s,
        offset,
        source_str
      ) => {
        if (offset > 0 && /[A-Za-z0-9_]/.test(source_str[offset - 1])) {
          return full_match;
        }
        const c1 = col_letter_to_index(c1_s);
        const r1 = parseInt(r1_s, 10);

        if (c2_s && r2_s) {
          const c2 = col_letter_to_index(c2_s);
          const r2 = parseInt(r2_s, 10);
          if (is_in_bounds(c1, r1) && is_in_bounds(c2, r2)) {
            const nc1 = Math.max(0, c1 + delta_col);
            const nr1 = Math.max(1, r1 + delta_row);
            const nc2 = Math.max(0, c2 + delta_col);
            const nr2 = Math.max(1, r2 + delta_row);
            return `${c1_d || ''}${get_col_letter(nc1)}${r1_d || ''}${nr1}:${c2_d || ''}${get_col_letter(nc2)}${r2_d || ''}${nr2}`;
          }
          return full_match;
        }

        if (is_in_bounds(c1, r1)) {
          const nc1 = Math.max(0, c1 + delta_col);
          const nr1 = Math.max(1, r1 + delta_row);
          return `${c1_d || ''}${get_col_letter(nc1)}${r1_d || ''}${nr1}`;
        }
        return full_match;
      }
    );

    if (updated_raw !== cell_obj.raw) {
      cells_map[cell_id] = {
        ...cell_obj,
        raw: updated_raw,
      };
    }
  });
}

export default function LUMEN_sheets_card({ card }) {
  // Load sheet data or fallback to initial template
  const sheet_data = useMemo(() => {
    return card.sheets_data || DEFAULT_INITIAL_SHEET;
  }, [card.sheets_data]);

  const [cols, set_cols] = useState(sheet_data.cols || DEFAULT_COLS);
  const [rows_count, set_rows_count] = useState(sheet_data.rows_count || DEFAULT_ROWS_COUNT);
  const [cells, set_cells] = useState(sheet_data.cells || DEFAULT_INITIAL_SHEET.cells);
  const [col_widths, set_col_widths] = useState(() => ({
    ...DEFAULT_COL_WIDTHS,
    ...(sheet_data.col_widths || {}),
  }));
  const [resizing_col, set_resizing_col] = useState(null);

  // Active selected cell & range selection state
  const [selected_cell, set_selected_cell] = useState('A1');
  const [selection_end, set_selection_end] = useState('A1');
  const [is_editing, set_is_editing] = useState(false);
  const [edit_val, set_edit_val] = useState('');
  const [formula_bar_val, set_formula_bar_val] = useState('');

  // Clipboard state for Cut / Copy / Paste
  const clipboard_ref = useRef(null);
  const [clipboard_bounds, set_clipboard_bounds] = useState(null);

  // Fullscreen Editing Modal state
  const [is_fullscreen, set_is_fullscreen] = useState(false);

  const is_dragging_ref = useRef(false);
  const cell_input_ref = useRef(null);
  const formula_input_ref = useRef(null);
  const grid_wrap_ref = useRef(null);
  const modal_grid_wrap_ref = useRef(null);

  // Focus & edit lifecycle refs
  const editing_cell_ref = useRef(null);
  const skip_blur_commit_ref = useRef(false);
  const should_focus_grid_ref = useRef(false);
  const select_all_on_edit_ref = useRef(false);

  const focus_active_grid = useCallback(() => {
    const active_wrap = is_fullscreen ? modal_grid_wrap_ref.current : grid_wrap_ref.current;
    active_wrap?.focus({ preventScroll: true });
  }, [is_fullscreen]);

  // Synchronously manage focus between cell <input> and grid wrapper on edit transitions
  useLayoutEffect(() => {
    if (is_editing && cell_input_ref.current) {
      const inp = cell_input_ref.current;
      inp.focus({ preventScroll: true });
      if (select_all_on_edit_ref.current) {
        inp.select();
      } else {
        const len = inp.value.length;
        try {
          inp.setSelectionRange(len, len);
        } catch (err) {
          // Ignore if unsupported
        }
      }
    } else if (!is_editing && should_focus_grid_ref.current) {
      should_focus_grid_ref.current = false;
      const active_wrap = is_fullscreen ? modal_grid_wrap_ref.current : grid_wrap_ref.current;
      active_wrap?.focus({ preventScroll: true });
    }
  }, [is_editing, selected_cell, is_fullscreen]);

  // Sync sheet data if card.sheets_data updates externally
  useEffect(() => {
    if (card.sheets_data) {
      if (card.sheets_data.cols) set_cols(card.sheets_data.cols);
      if (card.sheets_data.rows_count) set_rows_count(card.sheets_data.rows_count);
      if (card.sheets_data.cells) set_cells(card.sheets_data.cells);
      if (card.sheets_data.col_widths) {
        set_col_widths((prev) => ({
          ...DEFAULT_COL_WIDTHS,
          ...prev,
          ...card.sheets_data.col_widths,
        }));
      }
    }
  }, [card.sheets_data]);

  // Keep formula bar text synchronized with active cell
  useEffect(() => {
    const c = cells[selected_cell];
    const raw_val = c?.raw !== undefined ? String(c.raw) : '';
    set_formula_bar_val(raw_val);
  }, [selected_cell, cells]);

  // Support opening fullscreen modal via custom event from card quickbar
  useEffect(() => {
    const handle_open_fullscreen = () => set_is_fullscreen(true);
    window.addEventListener(`lumen-sheets-fullscreen-${card.id}`, handle_open_fullscreen);
    return () => {
      window.removeEventListener(`lumen-sheets-fullscreen-${card.id}`, handle_open_fullscreen);
    };
  }, [card.id]);

  // Handle window mouse up to end range dragging
  useEffect(() => {
    const handle_window_mouse_up = () => {
      is_dragging_ref.current = false;
    };
    window.addEventListener('mouseup', handle_window_mouse_up);
    return () => window.removeEventListener('mouseup', handle_window_mouse_up);
  }, []);

  // Prevent body scroll when fullscreen modal is active & handle Escape key
  useEffect(() => {
    if (is_fullscreen) {
      const original_overflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handle_key = (e) => {
        if (e.key === 'Escape' && !is_editing) {
          set_is_fullscreen(false);
        }
      };
      window.addEventListener('keydown', handle_key);

      return () => {
        document.body.style.overflow = original_overflow;
        window.removeEventListener('keydown', handle_key);
      };
    }
  }, [is_fullscreen, is_editing]);

  // Undo & Redo History stacks
  const history_ref = useRef({
    past: [],
    future: [],
  });
  const [can_undo, set_can_undo] = useState(false);
  const [can_redo, set_can_redo] = useState(false);

  // Save changes to boardState
  const save_sheet_state = useCallback((
    updated_cells,
    updated_cols = cols,
    updated_rows = rows_count,
    record_history = true,
    updated_col_widths = col_widths
  ) => {
    if (record_history) {
      const current_snapshot = {
        cols: [...cols],
        rows_count,
        col_widths: { ...col_widths },
        cells: JSON.parse(JSON.stringify(cells)),
      };
      history_ref.current.past.push(current_snapshot);
      if (history_ref.current.past.length > 50) {
        history_ref.current.past.shift();
      }
      history_ref.current.future = [];
      set_can_undo(true);
      set_can_redo(false);
    }

    set_cells(updated_cells);
    set_cols(updated_cols);
    set_rows_count(updated_rows);
    set_col_widths(updated_col_widths);
    updateCard(
      card.id,
      {
        sheets_data: {
          cols: updated_cols,
          rows_count: updated_rows,
          col_widths: updated_col_widths,
          cells: updated_cells,
        },
      },
      false
    );
  }, [card.id, cols, rows_count, col_widths, cells]);

  const handle_undo = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (history_ref.current.past.length === 0) return;

    const previous_state = history_ref.current.past.pop();
    const current_state = {
      cols: [...cols],
      rows_count,
      col_widths: { ...col_widths },
      cells: JSON.parse(JSON.stringify(cells)),
    };
    history_ref.current.future.push(current_state);

    const restored_widths = previous_state.col_widths || { ...DEFAULT_COL_WIDTHS };
    set_cols(previous_state.cols);
    set_rows_count(previous_state.rows_count);
    set_col_widths(restored_widths);
    set_cells(previous_state.cells);

    set_can_undo(history_ref.current.past.length > 0);
    set_can_redo(true);

    updateCard(
      card.id,
      {
        sheets_data: {
          cols: previous_state.cols,
          rows_count: previous_state.rows_count,
          col_widths: restored_widths,
          cells: previous_state.cells,
        },
      },
      false
    );
  }, [card.id, cols, rows_count, col_widths, cells]);

  const handle_redo = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (history_ref.current.future.length === 0) return;

    const next_state = history_ref.current.future.pop();
    const current_state = {
      cols: [...cols],
      rows_count,
      col_widths: { ...col_widths },
      cells: JSON.parse(JSON.stringify(cells)),
    };
    history_ref.current.past.push(current_state);

    const restored_widths = next_state.col_widths || { ...DEFAULT_COL_WIDTHS };
    set_cols(next_state.cols);
    set_rows_count(next_state.rows_count);
    set_col_widths(restored_widths);
    set_cells(next_state.cells);

    set_can_undo(true);
    set_can_redo(history_ref.current.future.length > 0);

    updateCard(
      card.id,
      {
        sheets_data: {
          cols: next_state.cols,
          rows_count: next_state.rows_count,
          col_widths: restored_widths,
          cells: next_state.cells,
        },
      },
      false
    );
  }, [card.id, cols, rows_count, col_widths, cells]);

  // --------------------------------------------------------------------------
  // Spreadsheet Formula Evaluation Engine
  // --------------------------------------------------------------------------
  const computed_values = useMemo(() => {
    const values = {};
    const visiting = new Set();

    // Helper to evaluate a single cell value
    const eval_cell = (cell_id) => {
      if (values[cell_id] !== undefined) return values[cell_id];
      if (visiting.has(cell_id)) return '#REF!'; // Circular reference protection
      visiting.add(cell_id);

      const cell = cells[cell_id];
      if (!cell || cell.raw === undefined || cell.raw === null || cell.raw === '') {
        visiting.delete(cell_id);
        values[cell_id] = '';
        return '';
      }

      // If it's a checkbox cell
      if (cell.type === 'checkbox') {
        visiting.delete(cell_id);
        const bool_val = Boolean(cell.raw === true || cell.raw === 'true' || cell.raw === 1 || cell.raw === '1');
        values[cell_id] = bool_val;
        return bool_val;
      }

      const raw = String(cell.raw).trim();
      if (!raw.startsWith('=')) {
        visiting.delete(cell_id);
        // Plain value (number or string)
        if (!isNaN(raw) && raw !== '') {
          const num = Number(raw);
          values[cell_id] = num;
          return num;
        }
        values[cell_id] = raw;
        return raw;
      }

      // Formula parsing: begins with '='
      try {
        let formula = raw.slice(1).trim().toUpperCase();

        // 1. Built-in Function: SUM(A1:A5, B2)
        const sum_match = formula.match(/^SUM\((.+)\)$/);
        if (sum_match) {
          const args = sum_match[1].split(',').map((s) => s.trim());
          let total = 0;
          for (const arg of args) {
            const targets = expand_range(arg);
            for (const t of targets) {
              const val = eval_cell(t);
              if (typeof val === 'number') total += val;
              else if (typeof val === 'boolean') total += val ? 1 : 0;
            }
          }
          visiting.delete(cell_id);
          values[cell_id] = total;
          return total;
        }

        // 2. Built-in Function: AVERAGE or AVG
        const avg_match = formula.match(/^(?:AVERAGE|AVG)\((.+)\)$/);
        if (avg_match) {
          const args = avg_match[1].split(',').map((s) => s.trim());
          let total = 0;
          let count = 0;
          for (const arg of args) {
            const targets = expand_range(arg);
            for (const t of targets) {
              const val = eval_cell(t);
              if (typeof val === 'number') {
                total += val;
                count++;
              }
            }
          }
          visiting.delete(cell_id);
          const res = count > 0 ? total / count : 0;
          values[cell_id] = res;
          return res;
        }

        // 3. Built-in Function: COUNT(A1:A5)
        const count_match = formula.match(/^COUNT\((.+)\)$/);
        if (count_match) {
          const targets = expand_range(count_match[1].trim());
          let count = 0;
          for (const t of targets) {
            const val = eval_cell(t);
            if (typeof val === 'number' || typeof val === 'boolean') count++;
          }
          visiting.delete(cell_id);
          values[cell_id] = count;
          return count;
        }

        // 4. Built-in Function: MIN & MAX
        const min_match = formula.match(/^MIN\((.+)\)$/);
        if (min_match) {
          const targets = expand_range(min_match[1].trim());
          let min_val = Infinity;
          for (const t of targets) {
            const val = eval_cell(t);
            if (typeof val === 'number') min_val = Math.min(min_val, val);
          }
          visiting.delete(cell_id);
          const res = min_val === Infinity ? 0 : min_val;
          values[cell_id] = res;
          return res;
        }

        const max_match = formula.match(/^MAX\((.+)\)$/);
        if (max_match) {
          const targets = expand_range(max_match[1].trim());
          let max_val = -Infinity;
          for (const t of targets) {
            const val = eval_cell(t);
            if (typeof val === 'number') max_val = Math.max(max_val, val);
          }
          visiting.delete(cell_id);
          const res = max_val === -Infinity ? 0 : max_val;
          values[cell_id] = res;
          return res;
        }

        // 5. Built-in Function: IF(condition, true_val, false_val)
        const if_match = formula.match(/^IF\(([^,]+),([^,]+),([^)]+)\)$/);
        if (if_match) {
          const cond_expr = if_match[1].trim();
          const true_expr = if_match[2].trim();
          const false_expr = if_match[3].trim();

          // Evaluate condition cell or boolean
          let cond_result = false;
          if (/^[A-Z]+\d+$/.test(cond_expr)) {
            const c_val = eval_cell(cond_expr);
            cond_result = Boolean(c_val);
          } else {
            const sanitized_cond = cond_expr.replace(/[A-Z]+\d+/g, (ref) => {
              const ref_val = eval_cell(ref);
              return typeof ref_val === 'number' ? String(ref_val) : (ref_val ? 'true' : 'false');
            });
            if (/^[0-9+\-*/().\s><=!]+$/.test(sanitized_cond)) {
              cond_result = Boolean(Function(`"use strict"; return Boolean(${sanitized_cond})`)());
            } else {
              cond_result = Boolean(sanitized_cond.trim().toUpperCase() === 'TRUE' || sanitized_cond.trim() === '1');
            }
          }

          const target_expr = cond_result ? true_expr : false_expr;
          let final_val = 0;
          if (/^[A-Z]+\d+$/.test(target_expr)) {
            final_val = eval_cell(target_expr);
          } else if (!isNaN(target_expr)) {
            final_val = Number(target_expr);
          } else {
            final_val = target_expr.replace(/^['"]|['"]$/g, '');
          }

          visiting.delete(cell_id);
          values[cell_id] = final_val;
          return final_val;
        }

        // 6. General Arithmetic Expression (e.g. D2*E2, A1+B1, (A1+A2)/2)
        const sanitized = formula.replace(/[A-Z]+\d+/g, (ref) => {
          const ref_val = eval_cell(ref);
          if (typeof ref_val === 'number') return String(ref_val);
          if (typeof ref_val === 'boolean') return ref_val ? '1' : '0';
          if (!isNaN(ref_val) && ref_val !== '') return String(Number(ref_val));
          return '0';
        });

        // Safe evaluation of arithmetic (+, -, *, /, parentheses)
        if (/^[0-9+\-*/().\s]+$/.test(sanitized)) {
          const computed = Function(`"use strict"; return (${sanitized})`)();
          visiting.delete(cell_id);
          const final_num = Number.isFinite(computed) ? Number(computed.toFixed(2)) : '#ERROR!';
          values[cell_id] = final_num;
          return final_num;
        }

        visiting.delete(cell_id);
        values[cell_id] = '#ERROR!';
        return '#ERROR!';
      } catch (err) {
        visiting.delete(cell_id);
        values[cell_id] = '#ERROR!';
        return '#ERROR!';
      }
    };

    // Evaluate all cells in sheet
    for (let r = 1; r <= rows_count; r++) {
      for (const col of cols) {
        const id = `${col}${r}`;
        visiting.clear();
        eval_cell(id);
      }
    }

    return values;
  }, [cells, cols, rows_count]);

  // Format Display Helper
  const format_cell_display = (cell_id, raw_val, format) => {
    const cell = cells[cell_id];
    if (cell?.type === 'checkbox') {
      return Boolean(raw_val === true || raw_val === 'true' || raw_val === 1 || raw_val === '1');
    }

    const val = computed_values[cell_id] !== undefined ? computed_values[cell_id] : raw_val;
    if (val === '#ERROR!' || val === '#REF!') return val;
    if (val === '' || val === null || val === undefined) return '';

    if (typeof val === 'number') {
      if (format === 'currency_idr') {
        return 'Rp ' + val.toLocaleString('id-ID');
      }
      if (format === 'currency_usd') {
        return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (format === 'percent') {
        return (val * 100).toFixed(1) + '%';
      }
      return val.toLocaleString('id-ID');
    }

    return String(val);
  };

  // Range Bounding Box Helper
  const range_bounds = useMemo(() => {
    const start = parse_cell_id(selected_cell);
    const end = parse_cell_id(selection_end);
    if (!start || !end) return null;

    const start_col_idx = cols.indexOf(start.col);
    const end_col_idx = cols.indexOf(end.col);
    if (start_col_idx === -1 || end_col_idx === -1) return null;

    return {
      min_col: Math.min(start_col_idx, end_col_idx),
      max_col: Math.max(start_col_idx, end_col_idx),
      min_row: Math.min(start.row, end.row),
      max_row: Math.max(start.row, end.row),
    };
  }, [selected_cell, selection_end, cols]);

  // Helper to get all cell IDs within current selection bounding box
  const selected_cells_list = useMemo(() => {
    if (!range_bounds) return [selected_cell];
    const list = [];
    for (let r = range_bounds.min_row; r <= range_bounds.max_row; r++) {
      for (let c = range_bounds.min_col; c <= range_bounds.max_col; c++) {
        list.push(`${cols[c]}${r}`);
      }
    }
    return list;
  }, [range_bounds, cols, selected_cell]);

  // Commit value change from inline editor or formula bar to a specific cell
  const commit_cell_edit = useCallback((target_cell_id, val) => {
    const cell_key = target_cell_id || editing_cell_ref.current || selected_cell;
    if (!cell_key) return;
    const curr = cells[cell_key] || {};
    const prev_raw = curr.raw !== undefined ? String(curr.raw) : '';
    const next_raw = val !== undefined && val !== null ? String(val) : '';

    if (prev_raw !== next_raw || !cells[cell_key]) {
      const updated = {
        ...cells,
        [cell_key]: {
          ...curr,
          raw: next_raw,
        },
      };
      save_sheet_state(updated);
    }
    editing_cell_ref.current = null;
    set_is_editing(false);
  }, [cells, selected_cell, save_sheet_state]);

  const handle_commit_edit = useCallback((val) => {
    commit_cell_edit(editing_cell_ref.current || selected_cell, val);
  }, [commit_cell_edit, selected_cell]);

  // Start inline editing of selected cell
  const start_editing_cell = useCallback((cell_id, initial_val = null) => {
    const curr = cells[cell_id] || {};
    if (curr.type === 'checkbox') return;

    editing_cell_ref.current = cell_id;
    skip_blur_commit_ref.current = false;
    select_all_on_edit_ref.current = initial_val === null;

    set_selected_cell(cell_id);
    set_selection_end(cell_id);
    const raw_val = curr.raw !== undefined ? String(curr.raw) : '';
    const next_val = initial_val !== null ? initial_val : raw_val;
    set_edit_val(next_val);
    set_formula_bar_val(next_val);
    set_is_editing(true);
  }, [cells]);

  // Column manual drag resize handler
  const handle_col_resize_start = useCallback((col_letter, e) => {
    e.preventDefault();
    e.stopPropagation();

    const start_x = e.clientX;
    const start_width = col_widths[col_letter] || DEFAULT_COL_WIDTHS[col_letter] || FALLBACK_COL_WIDTH;
    set_resizing_col(col_letter);

    let latest_width = start_width;

    const handle_mouse_move = (move_event) => {
      const delta = move_event.clientX - start_x;
      latest_width = Math.max(44, Math.min(480, Math.round(start_width + delta)));
      set_col_widths((prev) => ({
        ...prev,
        [col_letter]: latest_width,
      }));
    };

    const handle_mouse_up = () => {
      window.removeEventListener('mousemove', handle_mouse_move);
      window.removeEventListener('mouseup', handle_mouse_up);
      set_resizing_col(null);
      const updated_widths = {
        ...col_widths,
        [col_letter]: latest_width,
      };
      save_sheet_state(cells, cols, rows_count, false, updated_widths);
      focus_active_grid();
    };

    window.addEventListener('mousemove', handle_mouse_move);
    window.addEventListener('mouseup', handle_mouse_up);
  }, [col_widths, cells, cols, rows_count, save_sheet_state, focus_active_grid]);

  // Cut / Copy / Paste Cell Handlers
  const handle_copy_cells = useCallback((e, is_cut = false) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!range_bounds) return;

    const matrix = [];
    const tsv_rows = [];

    for (let r = range_bounds.min_row; r <= range_bounds.max_row; r++) {
      const row_cells = [];
      const row_tsv = [];
      for (let c = range_bounds.min_col; c <= range_bounds.max_col; c++) {
        const id = `${cols[c]}${r}`;
        const cell_obj = cells[id] ? JSON.parse(JSON.stringify(cells[id])) : { raw: '' };
        row_cells.push(cell_obj);
        const raw_str = cell_obj.raw !== undefined && cell_obj.raw !== null ? String(cell_obj.raw) : '';
        row_tsv.push(raw_str);
      }
      matrix.push(row_cells);
      tsv_rows.push(row_tsv.join('\t'));
    }

    const tsv_text = tsv_rows.join('\n');
    clipboard_ref.current = {
      matrix,
      tsv: tsv_text,
      mode: is_cut ? 'cut' : 'copy',
      bounds: { ...range_bounds },
    };
    set_clipboard_bounds({ ...range_bounds, mode: is_cut ? 'cut' : 'copy' });

    if (e?.clipboardData?.setData) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', tsv_text);
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(tsv_text).catch(() => {});
    }

    if (is_cut) {
      const updated = { ...cells };
      for (let r = range_bounds.min_row; r <= range_bounds.max_row; r++) {
        for (let c = range_bounds.min_col; c <= range_bounds.max_col; c++) {
          const id = `${cols[c]}${r}`;
          if (updated[id]) {
            updated[id] = {
              ...updated[id],
              raw: updated[id].type === 'checkbox' ? false : '',
            };
          }
        }
      }
      save_sheet_state(updated);
      showToast(`Cut ${selected_cells_list.length} cell${selected_cells_list.length > 1 ? 's' : ''}`);
    } else {
      showToast(`Copied ${selected_cells_list.length} cell${selected_cells_list.length > 1 ? 's' : ''}`);
    }

    focus_active_grid();
  }, [range_bounds, cols, cells, selected_cells_list.length, save_sheet_state, focus_active_grid]);

  const handle_cut_cells = useCallback((e) => {
    handle_copy_cells(e, true);
  }, [handle_copy_cells]);

  const apply_paste_data = useCallback((pasted_text) => {
    const coord = parse_cell_id(selected_cell);
    if (!coord) return;
    const start_col_idx = cols.indexOf(coord.col);
    const start_row = coord.row;
    if (start_col_idx === -1) return;

    const internal_clip = clipboard_ref.current;
    const normalized_text = typeof pasted_text === 'string'
      ? pasted_text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      : null;

    const use_internal =
      internal_clip &&
      internal_clip.matrix &&
      (normalized_text === null ||
        normalized_text === '' ||
        normalized_text === internal_clip.tsv ||
        internal_clip.mode === 'cut');

    let next_cols = [...cols];
    let next_rows_count = rows_count;
    const updated_cells = { ...cells };

    if (use_internal) {
      const matrix = internal_clip.matrix;
      const src_bounds = internal_clip.bounds || {
        min_col: start_col_idx,
        max_col: start_col_idx + (matrix[0]?.length || 1) - 1,
        min_row: start_row,
        max_row: start_row + matrix.length - 1,
      };
      const is_single_source = matrix.length === 1 && matrix[0].length === 1;
      const pasted_ids_set = new Set();

      if (is_single_source && selected_cells_list.length > 1 && range_bounds) {
        // Fill entire active multi-cell selection with the single copied/cut cell, adapting formulas per destination cell
        const src_cell = matrix[0][0];
        for (let r = range_bounds.min_row; r <= range_bounds.max_row; r++) {
          for (let c = range_bounds.min_col; c <= range_bounds.max_col; c++) {
            const target_id = `${next_cols[c]}${r}`;
            const cloned_cell = JSON.parse(JSON.stringify(src_cell));
            const cell_delta_col = c - src_bounds.min_col;
            const cell_delta_row = r - src_bounds.min_row;
            if (typeof cloned_cell.raw === 'string' && cloned_cell.raw.trim().startsWith('=')) {
              cloned_cell.raw = adapt_pasted_formula(cloned_cell.raw, cell_delta_col, cell_delta_row);
            }
            updated_cells[target_id] = {
              ...(updated_cells[target_id] || {}),
              ...cloned_cell,
            };
            pasted_ids_set.add(target_id);
          }
        }
      } else {
        const needed_rows = start_row + matrix.length - 1;
        if (needed_rows > next_rows_count) {
          next_rows_count = needed_rows;
        }
        const needed_cols = start_col_idx + matrix[0].length;
        while (next_cols.length < needed_cols && next_cols.length < 26) {
          next_cols.push(get_col_letter(next_cols.length));
        }

        let end_col_idx = start_col_idx;
        let end_row = start_row;
        const delta_col = start_col_idx - src_bounds.min_col;
        const delta_row = start_row - src_bounds.min_row;
        const adapted_matrix = [];
        const adapted_tsv_rows = [];

        for (let r_offset = 0; r_offset < matrix.length; r_offset++) {
          const target_r = start_row + r_offset;
          end_row = Math.max(end_row, target_r);
          const adapted_row_cells = [];
          const adapted_row_tsv = [];

          for (let c_offset = 0; c_offset < matrix[r_offset].length; c_offset++) {
            const target_c_idx = start_col_idx + c_offset;
            if (target_c_idx >= next_cols.length) continue;
            end_col_idx = Math.max(end_col_idx, target_c_idx);
            const target_id = `${next_cols[target_c_idx]}${target_r}`;
            const cloned_cell = JSON.parse(JSON.stringify(matrix[r_offset][c_offset]));

            if (typeof cloned_cell.raw === 'string' && cloned_cell.raw.trim().startsWith('=')) {
              cloned_cell.raw = adapt_pasted_formula(cloned_cell.raw, delta_col, delta_row);
            }

            updated_cells[target_id] = {
              ...(updated_cells[target_id] || {}),
              ...cloned_cell,
            };
            pasted_ids_set.add(target_id);
            adapted_row_cells.push(cloned_cell);
            adapted_row_tsv.push(
              cloned_cell.raw !== undefined && cloned_cell.raw !== null ? String(cloned_cell.raw) : ''
            );
          }

          adapted_matrix.push(adapted_row_cells);
          adapted_tsv_rows.push(adapted_row_tsv.join('\t'));
        }

        if (internal_clip.mode === 'cut') {
          adapt_sheet_formulas_on_cut_paste(
            updated_cells,
            src_bounds,
            delta_col,
            delta_row,
            pasted_ids_set
          );
          // Update internal clipboard to the new pasted coordinates so repeated Ctrl+V adapts relative to new location
          clipboard_ref.current = {
            matrix: adapted_matrix,
            tsv: adapted_tsv_rows.join('\n'),
            mode: 'copy',
            bounds: {
              min_col: start_col_idx,
              max_col: end_col_idx,
              min_row: start_row,
              max_row: end_row,
            },
          };
        }

        set_selection_end(`${next_cols[end_col_idx]}${end_row}`);
      }

      if (internal_clip.mode === 'cut') {
        set_clipboard_bounds(null);
      }
      save_sheet_state(updated_cells, next_cols, next_rows_count);
      focus_active_grid();
      return;
    }

    if (normalized_text !== null && normalized_text !== '') {
      let rows_arr = normalized_text.split('\n');
      if (rows_arr.length > 1 && rows_arr[rows_arr.length - 1] === '') {
        rows_arr = rows_arr.slice(0, -1);
      }
      const parsed_matrix = rows_arr.map((line) => line.split('\t'));

      const is_single_val = parsed_matrix.length === 1 && parsed_matrix[0].length === 1;
      if (is_single_val && selected_cells_list.length > 1 && range_bounds) {
        const val = parsed_matrix[0][0];
        for (let r = range_bounds.min_row; r <= range_bounds.max_row; r++) {
          for (let c = range_bounds.min_col; c <= range_bounds.max_col; c++) {
            const target_id = `${next_cols[c]}${r}`;
            const curr = updated_cells[target_id] || {};
            updated_cells[target_id] = {
              ...curr,
              raw: curr.type === 'checkbox' ? (val === 'true' || val === '1') : val,
            };
          }
        }
      } else {
        const needed_rows = start_row + parsed_matrix.length - 1;
        if (needed_rows > next_rows_count) {
          next_rows_count = needed_rows;
        }
        const max_cols_in_paste = Math.max(...parsed_matrix.map((r) => r.length));
        const needed_cols = start_col_idx + max_cols_in_paste;
        while (next_cols.length < needed_cols && next_cols.length < 26) {
          next_cols.push(get_col_letter(next_cols.length));
        }

        let end_col_idx = start_col_idx;
        let end_row = start_row;

        for (let r_offset = 0; r_offset < parsed_matrix.length; r_offset++) {
          const target_r = start_row + r_offset;
          end_row = Math.max(end_row, target_r);
          for (let c_offset = 0; c_offset < parsed_matrix[r_offset].length; c_offset++) {
            const target_c_idx = start_col_idx + c_offset;
            if (target_c_idx >= next_cols.length) continue;
            end_col_idx = Math.max(end_col_idx, target_c_idx);
            const target_id = `${next_cols[target_c_idx]}${target_r}`;
            const curr = updated_cells[target_id] || {};
            const val = parsed_matrix[r_offset][c_offset];
            updated_cells[target_id] = {
              ...curr,
              raw: curr.type === 'checkbox' ? (val === 'true' || val === '1') : val,
            };
          }
        }

        set_selection_end(`${next_cols[end_col_idx]}${end_row}`);
      }

      save_sheet_state(updated_cells, next_cols, next_rows_count);
      focus_active_grid();
    }
  }, [selected_cell, cols, rows_count, cells, selected_cells_list, range_bounds, save_sheet_state, focus_active_grid]);

  const handle_paste_cells = useCallback(async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();

    if (clipboard_ref.current && !e?.clipboardData?.getData) {
      if (e && e.preventDefault) e.preventDefault();
      apply_paste_data(null);
      return;
    }

    if (e?.clipboardData?.getData) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      apply_paste_data(text);
      return;
    }

    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        apply_paste_data(text);
        return;
      } catch (err) {
        // Fallback to internal clipboard ref if browser clipboard read permission is denied
      }
    }

    if (clipboard_ref.current) {
      apply_paste_data(null);
    }
  }, [apply_paste_data]);

  // Cell Mouse Interaction Handlers
  const handle_cell_mouse_down = (cell_id, e) => {
    e.stopPropagation();

    // If currently editing another cell, commit its value first
    if (is_editing && (editing_cell_ref.current || selected_cell) !== cell_id) {
      skip_blur_commit_ref.current = true;
      commit_cell_edit(editing_cell_ref.current || selected_cell, edit_val);
    }

    if (e.shiftKey) {
      // Shift + Click expands range to clicked cell
      set_selection_end(cell_id);
    } else {
      // Single click selects cell and initiates range drag
      set_selected_cell(cell_id);
      set_selection_end(cell_id);
      is_dragging_ref.current = true;
    }

    if (!is_editing || (editing_cell_ref.current || selected_cell) !== cell_id) {
      should_focus_grid_ref.current = true;
      setTimeout(() => {
        focus_active_grid();
      }, 0);
    }
  };

  const handle_cell_mouse_enter = (cell_id) => {
    if (is_dragging_ref.current) {
      set_selection_end(cell_id);
    }
  };

  const handle_cell_double_click = (cell_id, e) => {
    e.stopPropagation();
    start_editing_cell(cell_id);
  };

  // Toggle Checkbox Cell (Checklist feature)
  const toggle_cell_checkbox = (cell_id, e) => {
    if (e) e.stopPropagation();
    const curr = cells[cell_id] || {};
    const new_checked = !curr.raw;
    const updated = {
      ...cells,
      [cell_id]: {
        ...curr,
        type: 'checkbox',
        raw: new_checked,
      },
    };
    save_sheet_state(updated);
    focus_active_grid();
  };

  // Turn active cell into a Checkbox (Checklist insert feature)
  const handle_insert_checkbox = (e) => {
    if (e) e.stopPropagation();
    if (!selected_cell) return;
    const curr = cells[selected_cell] || {};
    const is_curr_checkbox = curr.type === 'checkbox';

    const updated = {
      ...cells,
      [selected_cell]: {
        ...curr,
        type: is_curr_checkbox ? 'text' : 'checkbox',
        raw: is_curr_checkbox ? '' : false,
        style: { ...(curr.style || {}), align: 'center' },
      },
    };
    save_sheet_state(updated);
    showToast(is_curr_checkbox ? 'Sel diubah ke teks standar' : 'Kotak centang (checklist) disisipkan ke sel');
    focus_active_grid();
  };

  // Quick AutoSum on Active Cell
  const handle_autosum = (e) => {
    if (e) e.stopPropagation();
    if (!selected_cell) return;
    const coord = parse_cell_id(selected_cell);
    if (!coord || coord.row <= 1) return;

    // Sum all cells above this row in the same column
    const range_start = `${coord.col}2`;
    const range_end = `${coord.col}${coord.row - 1}`;
    const formula_str = `=SUM(${range_start}:${range_end})`;

    const curr = cells[selected_cell] || {};
    const updated = {
      ...cells,
      [selected_cell]: {
        ...curr,
        raw: formula_str,
        format: curr.format || 'currency_idr',
        style: { ...(curr.style || {}), bold: true, align: 'right' },
      },
    };
    save_sheet_state(updated);
    showToast(`Formula AutoSum ${formula_str} disisipkan`);
    focus_active_grid();
  };

  // Toolbar Formatting Actions
  const handle_toggle_style = (property, value, e) => {
    if (e) e.stopPropagation();
    if (!selected_cells_list.length) return;

    const updated = { ...cells };
    selected_cells_list.forEach((id) => {
      const curr = updated[id] || {};
      const curr_style = curr.style || {};
      updated[id] = {
        ...curr,
        style: {
          ...curr_style,
          [property]: curr_style[property] === value ? undefined : value,
        },
      };
    });
    save_sheet_state(updated);
    focus_active_grid();
  };

  const handle_set_format = (format_name, e) => {
    if (e) e.stopPropagation();
    if (!selected_cells_list.length) return;

    const updated = { ...cells };
    selected_cells_list.forEach((id) => {
      const curr = updated[id] || {};
      updated[id] = {
        ...curr,
        format: curr.format === format_name ? undefined : format_name,
      };
    });
    save_sheet_state(updated);
    focus_active_grid();
  };

  // Add / Remove Row
  const handle_add_row = (e) => {
    if (e) e.stopPropagation();
    const new_count = rows_count + 1;
    save_sheet_state(cells, cols, new_count);
    showToast(`Baris ${new_count} ditambahkan`);
    focus_active_grid();
  };

  const handle_remove_row = (e) => {
    if (e) e.stopPropagation();
    if (rows_count <= 2) return;
    const new_count = rows_count - 1;
    save_sheet_state(cells, cols, new_count);
    focus_active_grid();
  };

  // Add / Remove Column
  const handle_add_col = (e) => {
    if (e) e.stopPropagation();
    if (cols.length >= 10) return;
    const next_letter = get_col_letter(cols.length);
    const new_cols = [...cols, next_letter];
    const next_widths = {
      ...col_widths,
      [next_letter]: col_widths[next_letter] || DEFAULT_COL_WIDTHS[next_letter] || FALLBACK_COL_WIDTH,
    };
    save_sheet_state(cells, new_cols, rows_count, true, next_widths);
    showToast(`Kolom ${next_letter} ditambahkan`);
    focus_active_grid();
  };

  const handle_remove_col = (e) => {
    if (e) e.stopPropagation();
    if (cols.length <= 2) return;
    const new_cols = cols.slice(0, cols.length - 1);
    save_sheet_state(cells, new_cols, rows_count);
    focus_active_grid();
  };

  // Reset to blank sheet
  const handle_reset_template = (e) => {
    if (e) e.stopPropagation();
    save_sheet_state(
      {},
      DEFAULT_INITIAL_SHEET.cols,
      DEFAULT_INITIAL_SHEET.rows_count,
      true,
      { ...DEFAULT_COL_WIDTHS }
    );
    set_selected_cell('A1');
    set_selection_end('A1');
    showToast('Spreadsheet cleared');
    focus_active_grid();
  };

  // Export to CSV
  const handle_export_csv = (e) => {
    if (e) e.stopPropagation();
    let csv = '';
    for (let r = 1; r <= rows_count; r++) {
      const row_vals = cols.map((col) => {
        const id = `${col}${r}`;
        const val = computed_values[id] !== undefined ? computed_values[id] : cells[id]?.raw || '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csv += row_vals.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(card.title || 'Spreadsheet').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Spreadsheet berhasil diekspor ke file CSV');
  };

  // Keyboard navigation for spreadsheet cells (Arrows, Enter, Tab, Cut/Copy/Paste, Delete, Space, Alphanumeric typing)
  const handle_grid_keydown = (e) => {
    if (is_editing) return;

    e.stopPropagation();

    const key_lower = e.key.toLowerCase();

    // Undo / Redo keyboard shortcuts
    if ((e.ctrlKey || e.metaKey) && key_lower === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handle_redo(e);
      } else {
        handle_undo(e);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key_lower === 'y') {
      e.preventDefault();
      handle_redo(e);
      return;
    }

    // Copy / Cut / Paste shortcuts when navigating cells
    if ((e.ctrlKey || e.metaKey) && key_lower === 'c') {
      e.preventDefault();
      handle_copy_cells(e, false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key_lower === 'x') {
      e.preventDefault();
      handle_copy_cells(e, true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key_lower === 'v') {
      e.preventDefault();
      handle_paste_cells(e);
      return;
    }

    const coord = parse_cell_id(selected_cell);
    if (!coord) return;

    const col_idx = cols.indexOf(coord.col);
    const row_idx = coord.row;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (row_idx > 1) {
        const next_id = `${coord.col}${row_idx - 1}`;
        if (e.shiftKey) {
          set_selection_end(next_id);
        } else {
          set_selected_cell(next_id);
          set_selection_end(next_id);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (row_idx < rows_count) {
        const next_id = `${coord.col}${row_idx + 1}`;
        if (e.shiftKey) {
          set_selection_end(next_id);
        } else {
          set_selected_cell(next_id);
          set_selection_end(next_id);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (col_idx > 0) {
        const next_id = `${cols[col_idx - 1]}${row_idx}`;
        if (e.shiftKey) {
          set_selection_end(next_id);
        } else {
          set_selected_cell(next_id);
          set_selection_end(next_id);
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (col_idx < cols.length - 1) {
        const next_id = `${cols[col_idx + 1]}${row_idx}`;
        if (e.shiftKey) {
          set_selection_end(next_id);
        } else {
          set_selected_cell(next_id);
          set_selection_end(next_id);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      let next_id = selected_cell;
      if (e.shiftKey) {
        // Move backward
        if (col_idx > 0) {
          next_id = `${cols[col_idx - 1]}${row_idx}`;
        } else if (row_idx > 1) {
          next_id = `${cols[cols.length - 1]}${row_idx - 1}`;
        }
      } else {
        // Move forward
        if (col_idx < cols.length - 1) {
          next_id = `${cols[col_idx + 1]}${row_idx}`;
        } else if (row_idx < rows_count) {
          next_id = `${cols[0]}${row_idx + 1}`;
        }
      }
      set_selected_cell(next_id);
      set_selection_end(next_id);
      focus_active_grid();
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      start_editing_cell(selected_cell);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      // Clear values of all cells in selection
      const updated = { ...cells };
      selected_cells_list.forEach((id) => {
        if (updated[id] && updated[id].type !== 'checkbox') {
          updated[id] = { ...updated[id], raw: '' };
        }
      });
      save_sheet_state(updated);
    } else if (e.key === ' ' && cells[selected_cell]?.type === 'checkbox') {
      e.preventDefault();
      toggle_cell_checkbox(selected_cell, e);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Direct alphanumeric keypress enters editing mode immediately without needing to click
      e.preventDefault();
      start_editing_cell(selected_cell, e.key);
    }
  };

  // Selected cell styling metadata for toolbar buttons
  const curr_cell_obj = cells[selected_cell] || {};
  const is_bold = curr_cell_obj.style?.bold;
  const is_italic = curr_cell_obj.style?.italic;
  const curr_align = curr_cell_obj.style?.align || 'left';
  const curr_format = curr_cell_obj.format;
  const is_checkbox_cell = curr_cell_obj.type === 'checkbox';

  // Total table width based on locked column widths
  const total_table_width = useMemo(() => {
    return 36 + cols.reduce((acc, col_letter) => {
      return acc + (col_widths[col_letter] || DEFAULT_COL_WIDTHS[col_letter] || FALLBACK_COL_WIDTH);
    }, 0);
  }, [cols, col_widths]);

  // Statistics calculation for footer (Checklist and Selection metrics)
  const stats = useMemo(() => {
    let checked_count = 0;
    let total_checkboxes = 0;
    let total_sum = 0;

    Object.entries(cells).forEach(([_, c]) => {
      if (c.type === 'checkbox') {
        total_checkboxes++;
        if (c.raw === true || c.raw === 'true' || c.raw === 1) checked_count++;
      }
    });

    const f7_val = computed_values['F7'];
    if (typeof f7_val === 'number') total_sum = f7_val;

    // Range selection metrics (Google Sheets style sum, count, avg)
    let sel_sum = 0;
    let sel_numeric_count = 0;
    selected_cells_list.forEach((id) => {
      const val = computed_values[id] !== undefined ? computed_values[id] : cells[id]?.raw;
      if (typeof val === 'number') {
        sel_sum += val;
        sel_numeric_count++;
      }
    });

    return {
      checked_count,
      total_checkboxes,
      total_sum,
      sel_count: selected_cells_list.length,
      sel_sum,
      sel_numeric_count,
      sel_avg: sel_numeric_count > 0 ? sel_sum / sel_numeric_count : 0,
    };
  }, [cells, computed_values, selected_cells_list]);

  // Reusable Sheets Table Grid JSX
  const render_sheets_grid = (is_in_modal = false) => {
    const is_active_surface = is_in_modal === is_fullscreen;

    return (
      <div
        ref={is_in_modal ? modal_grid_wrap_ref : grid_wrap_ref}
        className={styles['lumen-sheets-grid-wrap']}
        tabIndex={0}
        onKeyDown={handle_grid_keydown}
        onCopy={(e) => {
          if (!is_editing) handle_copy_cells(e, false);
        }}
        onCut={(e) => {
          if (!is_editing) handle_copy_cells(e, true);
        }}
        onPaste={(e) => {
          if (!is_editing) handle_paste_cells(e);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <table
          className={styles['lumen-sheets-table']}
          style={{ width: `${total_table_width}px`, minWidth: `${total_table_width}px` }}
        >
          <colgroup>
            <col style={{ width: '36px', minWidth: '36px', maxWidth: '36px' }} />
            {cols.map((col_letter) => {
              const col_w = col_widths[col_letter] || DEFAULT_COL_WIDTHS[col_letter] || FALLBACK_COL_WIDTH;
              return (
                <col
                  key={col_letter}
                  style={{ width: `${col_w}px`, minWidth: `${col_w}px`, maxWidth: `${col_w}px` }}
                />
              );
            })}
          </colgroup>
          <thead>
            <tr>
              <th className={styles['lumen-sheets-corner-th']} />
              {cols.map((col_letter, c_idx) => {
                const is_active_col =
                  range_bounds && c_idx >= range_bounds.min_col && c_idx <= range_bounds.max_col;
                const col_w = col_widths[col_letter] || DEFAULT_COL_WIDTHS[col_letter] || FALLBACK_COL_WIDTH;
                return (
                  <th
                    key={col_letter}
                    className={`${styles['lumen-sheets-col-th']} ${
                      is_active_col ? styles['lumen-sheets-col-th-active'] : ''
                    }`}
                    style={{ width: `${col_w}px`, minWidth: `${col_w}px`, maxWidth: `${col_w}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (is_editing) {
                        skip_blur_commit_ref.current = true;
                        commit_cell_edit(editing_cell_ref.current || selected_cell, edit_val);
                      }
                      set_selected_cell(`${col_letter}1`);
                      set_selection_end(`${col_letter}${rows_count}`);
                      focus_active_grid();
                    }}
                    title={`Pilih seluruh kolom ${col_letter} (Tarik tepi kanan untuk ubah lebar)`}
                  >
                    <span>{col_letter}</span>
                    <div
                      className={`${styles['lumen-sheets-col-resizer']} ${
                        resizing_col === col_letter ? styles['lumen-sheets-col-resizer-active'] : ''
                      }`}
                      onMouseDown={(e) => handle_col_resize_start(col_letter, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows_count }, (_, r_idx) => {
              const row_num = r_idx + 1;
              const is_active_row =
                range_bounds && row_num >= range_bounds.min_row && row_num <= range_bounds.max_row;

              return (
                <tr key={row_num}>
                  {/* Row Header 1, 2, 3 ... */}
                  <th
                    className={`${styles['lumen-sheets-row-th']} ${
                      is_active_row ? styles['lumen-sheets-row-th-active'] : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (is_editing) {
                        skip_blur_commit_ref.current = true;
                        commit_cell_edit(editing_cell_ref.current || selected_cell, edit_val);
                      }
                      set_selected_cell(`A${row_num}`);
                      set_selection_end(`${cols[cols.length - 1]}${row_num}`);
                      focus_active_grid();
                    }}
                    title={`Pilih seluruh baris ${row_num}`}
                  >
                    {row_num}
                  </th>

                  {/* Cells in row */}
                  {cols.map((col_letter, c_idx) => {
                    const cell_id = `${col_letter}${row_num}`;
                    const col_w = col_widths[col_letter] || DEFAULT_COL_WIDTHS[col_letter] || FALLBACK_COL_WIDTH;
                    const is_primary = selected_cell === cell_id;
                    const in_range =
                      range_bounds &&
                      c_idx >= range_bounds.min_col &&
                      c_idx <= range_bounds.max_col &&
                      row_num >= range_bounds.min_row &&
                      row_num <= range_bounds.max_row;

                    const in_clipboard =
                      clipboard_bounds &&
                      c_idx >= clipboard_bounds.min_col &&
                      c_idx <= clipboard_bounds.max_col &&
                      row_num >= clipboard_bounds.min_row &&
                      row_num <= clipboard_bounds.max_row;

                    const is_border_top = in_range && row_num === range_bounds.min_row;
                    const is_border_bottom = in_range && row_num === range_bounds.max_row;
                    const is_border_left = in_range && c_idx === range_bounds.min_col;
                    const is_border_right = in_range && c_idx === range_bounds.max_col;
                    const is_bottom_right = is_border_bottom && is_border_right;

                    const cell_obj = cells[cell_id] || {};
                    const is_checkbox = cell_obj.type === 'checkbox';
                    const is_checked = Boolean(cell_obj.raw);

                    // Cell styles with locked column width
                    const custom_styles = {
                      width: `${col_w}px`,
                      minWidth: `${col_w}px`,
                      maxWidth: `${col_w}px`,
                      fontWeight: cell_obj.style?.bold ? '700' : 'normal',
                      fontStyle: cell_obj.style?.italic ? 'italic' : 'normal',
                      textAlign:
                        cell_obj.style?.align ||
                        (typeof cell_obj.raw === 'number' || (!isNaN(cell_obj.raw) && cell_obj.raw !== '')
                          ? 'right'
                          : 'left'),
                      backgroundColor: in_range ? undefined : cell_obj.style?.bg || undefined,
                      color: cell_obj.style?.color || undefined,
                    };

                    const display_text = format_cell_display(cell_id, cell_obj.raw, cell_obj.format);
                    const is_error = display_text === '#ERROR!' || display_text === '#REF!';

                    return (
                      <td
                        key={cell_id}
                        className={`${styles['lumen-sheets-cell']} ${
                          is_primary ? styles['lumen-sheets-cell-selected'] : ''
                        } ${in_range && !is_primary ? styles['lumen-sheets-cell-in-range'] : ''} ${
                          in_clipboard ? styles['lumen-sheets-cell-clipboard'] : ''
                        } ${is_border_top ? styles['lumen-sheets-range-border-top'] : ''} ${
                          is_border_bottom ? styles['lumen-sheets-range-border-bottom'] : ''
                        } ${is_border_left ? styles['lumen-sheets-range-border-left'] : ''} ${
                          is_border_right ? styles['lumen-sheets-range-border-right'] : ''
                        } ${is_editing && is_primary ? styles['lumen-sheets-cell-editing'] : ''}`}
                        style={custom_styles}
                        onMouseDown={(e) => handle_cell_mouse_down(cell_id, e)}
                        onMouseEnter={() => handle_cell_mouse_enter(cell_id)}
                        onDoubleClick={(e) => handle_cell_double_click(cell_id, e)}
                      >
                        {/* Interactive Checkbox Cell (Checklist feature) */}
                        {is_checkbox ? (
                          <div
                            className={styles['lumen-sheets-cell-checkbox']}
                            onClick={(e) => toggle_cell_checkbox(cell_id, e)}
                          >
                            <input
                              type="checkbox"
                              className={styles['lumen-sheets-checkbox-input']}
                              checked={is_checked}
                              onChange={(e) => toggle_cell_checkbox(cell_id, e)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {cell_obj.label && (
                              <span
                                className={`${styles['lumen-sheets-checkbox-label']} ${
                                  is_checked ? styles['lumen-sheets-checkbox-checked'] : ''
                                }`}
                              >
                                {cell_obj.label}
                              </span>
                            )}
                          </div>
                        ) : is_editing && is_primary && is_active_surface ? (
                          <input
                            ref={cell_input_ref}
                            type="text"
                            className={styles['lumen-sheets-cell-editor']}
                            value={edit_val}
                            onChange={(e) => {
                              set_edit_val(e.target.value);
                              set_formula_bar_val(e.target.value);
                            }}
                            onBlur={() => {
                              if (skip_blur_commit_ref.current) {
                                skip_blur_commit_ref.current = false;
                                return;
                              }
                              commit_cell_edit(cell_id, edit_val);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                skip_blur_commit_ref.current = true;
                                should_focus_grid_ref.current = true;
                                commit_cell_edit(cell_id, edit_val);
                                const next_row = e.shiftKey
                                  ? Math.max(1, row_num - 1)
                                  : Math.min(rows_count, row_num + 1);
                                const next_cell = `${col_letter}${next_row}`;
                                set_selected_cell(next_cell);
                                set_selection_end(next_cell);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                skip_blur_commit_ref.current = true;
                                should_focus_grid_ref.current = true;
                                commit_cell_edit(cell_id, edit_val);
                                let next_cell = cell_id;
                                if (e.shiftKey) {
                                  if (c_idx > 0) {
                                    next_cell = `${cols[c_idx - 1]}${row_num}`;
                                  } else if (row_num > 1) {
                                    next_cell = `${cols[cols.length - 1]}${row_num - 1}`;
                                  }
                                } else {
                                  if (c_idx < cols.length - 1) {
                                    next_cell = `${cols[c_idx + 1]}${row_num}`;
                                  } else if (row_num < rows_count) {
                                    next_cell = `${cols[0]}${row_num + 1}`;
                                  }
                                }
                                set_selected_cell(next_cell);
                                set_selection_end(next_cell);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                skip_blur_commit_ref.current = true;
                                should_focus_grid_ref.current = true;
                                editing_cell_ref.current = null;
                                set_is_editing(false);
                                const orig_raw = cells[cell_id]?.raw !== undefined ? String(cells[cell_id].raw) : '';
                                set_formula_bar_val(orig_raw);
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={is_error ? styles['lumen-sheets-error-text'] : ''}>
                            {display_text}
                          </span>
                        )}

                        {/* Google Sheets Active Range Corner Handle */}
                        {is_bottom_right && !is_editing && (
                          <div className={styles['lumen-sheets-cell-handle']} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Reusable Sheets Toolbar JSX
  const render_sheets_toolbar = () => (
    <div
      className={styles['lumen-sheets-toolbar']}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Undo & Redo History Group */}
      <div className={styles['lumen-sheets-btn-group']}>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${!can_undo ? styles['lumen-sheets-tool-btn-disabled'] : ''}`}
          onClick={handle_undo}
          disabled={!can_undo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={12} />
        </button>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${!can_redo ? styles['lumen-sheets-tool-btn-disabled'] : ''}`}
          onClick={handle_redo}
          disabled={!can_redo}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={12} />
        </button>
      </div>

      <div className={styles['lumen-sheets-divider']} />

      {/* Cut / Copy / Paste Group */}
      <div className={styles['lumen-sheets-btn-group']}>
        <button
          type="button"
          className={styles['lumen-sheets-tool-btn']}
          onClick={handle_cut_cells}
          title="Cut Cell (Ctrl+X)"
          aria-label="Cut"
        >
          <Scissors size={12} />
        </button>
        <button
          type="button"
          className={styles['lumen-sheets-tool-btn']}
          onClick={(e) => handle_copy_cells(e, false)}
          title="Copy Cell (Ctrl+C)"
          aria-label="Copy"
        >
          <Copy size={12} />
        </button>
        <button
          type="button"
          className={styles['lumen-sheets-tool-btn']}
          onClick={handle_paste_cells}
          title="Paste Cell (Ctrl+V)"
          aria-label="Paste"
        >
          <ClipboardPaste size={12} />
        </button>
      </div>

      <div className={styles['lumen-sheets-divider']} />

      {/* Insert Checkbox Button */}
      <button
        type="button"
        className={`${styles['lumen-sheets-tool-btn']} ${styles['lumen-sheets-tool-btn-checkbox']} ${
          is_checkbox_cell ? styles['lumen-sheets-tool-btn-active'] : ''
        }`}
        onClick={handle_insert_checkbox}
        title="Ubah sel terpilih menjadi Kotak Centang (Checklist)"
      >
        <CheckSquare size={13} />
        <span>Checklist</span>
      </button>

      {/* AutoSum Button */}
      <button
        type="button"
        className={styles['lumen-sheets-tool-btn']}
        onClick={handle_autosum}
        title="Sisipkan formula penjumlahan otomatis =SUM(...)"
      >
        <Calculator size={12} />
        <span>AutoSum</span>
      </button>

      <div className={styles['lumen-sheets-divider']} />

      {/* Text Formatting: Bold & Italic */}
      <div className={styles['lumen-sheets-btn-group']}>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${is_bold ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_toggle_style('bold', true, e)}
          title="Tebal (Bold)"
        >
          <Bold size={12} />
        </button>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${is_italic ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_toggle_style('italic', true, e)}
          title="Miring (Italic)"
        >
          <Italic size={12} />
        </button>
      </div>

      <div className={styles['lumen-sheets-divider']} />

      {/* Alignment */}
      <div className={styles['lumen-sheets-btn-group']}>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${curr_align === 'left' ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_toggle_style('align', 'left', e)}
          title="Rata Kiri"
        >
          <AlignLeft size={12} />
        </button>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${curr_align === 'center' ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_toggle_style('align', 'center', e)}
          title="Rata Tengah"
        >
          <AlignCenter size={12} />
        </button>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${curr_align === 'right' ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_toggle_style('align', 'right', e)}
          title="Rata Kanan"
        >
          <AlignRight size={12} />
        </button>
      </div>

      <div className={styles['lumen-sheets-divider']} />

      {/* Number Formats */}
      <div className={styles['lumen-sheets-btn-group']}>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${curr_format === 'currency_idr' ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_set_format('currency_idr', e)}
          title="Format Mata Uang Rupiah (Rp)"
        >
          <span style={{ fontSize: '10px', fontWeight: 800 }}>Rp</span>
        </button>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${curr_format === 'currency_usd' ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_set_format('currency_usd', e)}
          title="Format Mata Uang Dolar ($)"
        >
          <DollarSign size={12} />
        </button>
        <button
          type="button"
          className={`${styles['lumen-sheets-tool-btn']} ${curr_format === 'percent' ? styles['lumen-sheets-tool-btn-active'] : ''}`}
          onClick={(e) => handle_set_format('percent', e)}
          title="Format Persen (%)"
        >
          <Percent size={12} />
        </button>
      </div>

      <div className={styles['lumen-sheets-divider']} />

      {/* Row & Column adjustments */}
      <div className={styles['lumen-sheets-btn-group']}>
        <button
          type="button"
          className={styles['lumen-sheets-tool-btn']}
          onClick={handle_add_row}
          title="Tambah Baris"
        >
          <Plus size={11} />
          <span>Baris</span>
        </button>
        <button
          type="button"
          className={styles['lumen-sheets-tool-btn']}
          onClick={handle_remove_row}
          title="Hapus Baris Terakhir"
        >
          <Minus size={11} />
        </button>
        <button
          type="button"
          className={styles['lumen-sheets-tool-btn']}
          onClick={handle_add_col}
          title="Tambah Kolom"
        >
          <Plus size={11} />
          <span>Kolom</span>
        </button>
      </div>
    </div>
  );

  // Reusable Formula Bar JSX
  const render_formula_bar = () => {
    const range_label =
      selected_cell === selection_end
        ? selected_cell
        : `${selected_cell}:${selection_end}`;

    return (
      <div
        className={styles['lumen-sheets-formula-bar']}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className={styles['lumen-sheets-cell-name']}>{range_label}</span>
        <span className={styles['lumen-sheets-fx-label']}>fx</span>
        <input
          ref={formula_input_ref}
          type="text"
          className={styles['lumen-sheets-formula-input']}
          value={formula_bar_val}
          onChange={(e) => {
            set_formula_bar_val(e.target.value);
            // Live commit to active cell
            const curr = cells[selected_cell] || {};
            const updated = {
              ...cells,
              [selected_cell]: {
                ...curr,
                raw: e.target.value,
              },
            };
            save_sheet_state(updated);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handle_commit_edit(formula_bar_val);
              (is_fullscreen ? modal_grid_wrap_ref.current : grid_wrap_ref.current)?.focus();
            }
          }}
          placeholder="Ketik nilai atau formula (contoh: =SUM(F2:F5), =D2*E2)..."
        />
      </div>
    );
  };

  return (
    <>
      {/* Main In-Card View on Canvas */}
      <div
        className={styles['lumen-sheets-container']}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 1. Header with Title & Fullscreen Button */}
        <div className={styles['lumen-sheets-header']}>
          <div className={styles['lumen-sheets-header-left']}>
            <div className={styles['lumen-sheets-icon-badge']} title="Google Sheets spreadsheet on canvas">
              <FileSpreadsheet size={13} />
            </div>
            <input
              type="text"
              className={styles['lumen-sheets-title-input']}
              value={card.title || 'Spreadsheet'}
              onChange={(e) => updateCard(card.id, { title: e.target.value }, false)}
              placeholder="Judul Spreadsheet..."
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className={styles['lumen-sheets-header-right']}>
            {stats.total_checkboxes > 0 && (
              <span className={styles['lumen-sheets-badge-pill']}>
                <CheckSquare size={10} />
                <span>{stats.checked_count}/{stats.total_checkboxes}</span>
              </span>
            )}

            {/* Fullscreen Popup Trigger Button */}
            <button
              type="button"
              className={styles['lumen-sheets-header-btn']}
              onClick={(e) => {
                e.stopPropagation();
                set_is_fullscreen(true);
              }}
              title="Buka Layar Penuh (Fullscreen Editing Popup)"
            >
              <Maximize2 size={11} />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {/* 2. Toolbar */}
        {render_sheets_toolbar()}

        {/* 3. Formula Bar */}
        {render_formula_bar()}

        {/* 4. Table Grid */}
        {render_sheets_grid(false)}

        {/* 5. Footer */}
        <div className={styles['lumen-sheets-footer']}>
          {stats.sel_count > 1 ? (
            <span>
              Dipilih: <strong>{selected_cell}:{selection_end}</strong> ({stats.sel_count} sel)
              {stats.sel_numeric_count > 0 && ` • Sum: Rp ${stats.sel_sum.toLocaleString('id-ID')}`}
            </span>
          ) : (
            <span>Pilih sel untuk edit • Klik ganda atau ketik langsung • Navigasi tombol Panah</span>
          )}

          <div className={styles['lumen-sheets-footer-calc']}>
            {stats.total_sum > 0 && (
              <span>
                Total: <span className={styles['lumen-sheets-calc-chip']}>Rp {stats.total_sum.toLocaleString('id-ID')}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Editing Modal Popup (Mounted Directly to document.body via Portal) */}
      {is_fullscreen &&
        createPortal(
          <div
            className={styles['lumen-sheets-modal-backdrop']}
            onClick={(e) => {
              e.stopPropagation();
              set_is_fullscreen(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={styles['lumen-sheets-modal-dialog']}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={styles['lumen-sheets-modal-header']}>
                <div className={styles['lumen-sheets-modal-title-row']}>
                  <div className={styles['lumen-sheets-icon-badge']}>
                    <FileSpreadsheet size={16} />
                  </div>
                  <input
                    type="text"
                    className={styles['lumen-sheets-modal-title-input']}
                    value={card.title || 'Spreadsheet'}
                    onChange={(e) => updateCard(card.id, { title: e.target.value }, false)}
                    placeholder="Judul Spreadsheet..."
                  />
                  <span className={styles['lumen-sheets-badge-pill']}>
                    <Check size={11} />
                    <span>Tersimpan Otomatis</span>
                  </span>
                  {stats.total_checkboxes > 0 && (
                    <span className={styles['lumen-sheets-badge-pill']}>
                      <CheckSquare size={11} />
                      <span>{stats.checked_count}/{stats.total_checkboxes} Selesai</span>
                    </span>
                  )}
                </div>

                <div className={styles['lumen-sheets-modal-actions']}>
                  <button
                    type="button"
                    className={styles['lumen-sheets-modal-btn']}
                    onClick={handle_export_csv}
                    title="Ekspor data ke file CSV"
                  >
                    <Download size={13} />
                    <span>Ekspor CSV</span>
                  </button>

                  <button
                    type="button"
                    className={styles['lumen-sheets-modal-btn']}
                    onClick={handle_reset_template}
                    title="Reset ke template bawaan"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    className={styles['lumen-sheets-modal-close-btn']}
                    onClick={() => set_is_fullscreen(false)}
                    title="Tutup Layar Penuh (Esc)"
                  >
                    <Minimize2 size={14} />
                  </button>
                </div>
              </div>

              {/* Modal Toolbar */}
              {render_sheets_toolbar()}

              {/* Modal Formula Bar */}
              {render_formula_bar()}

              {/* Modal Table Grid */}
              {render_sheets_grid(true)}

              {/* Modal Footer */}
              <div className={styles['lumen-sheets-footer']} style={{ padding: '6px 14px' }}>
                <span>
                  {stats.sel_count > 1 ? (
                    <>
                      Dipilih: <strong>{selected_cell}:{selection_end}</strong> ({stats.sel_count} sel)
                      {stats.sel_numeric_count > 0 && (
                        <> • Sum: <strong>Rp {stats.sel_sum.toLocaleString('id-ID')}</strong> • Rata-rata: <strong>Rp {Math.round(stats.sel_avg).toLocaleString('id-ID')}</strong></>
                      )}
                    </>
                  ) : (
                    <>Tekan <strong>Esc</strong> untuk keluar • Klik ganda atau ketik langsung untuk edit • Shift + Panah untuk pilih rentang</>
                  )}
                </span>
                <div className={styles['lumen-sheets-footer-calc']} style={{ gap: '16px' }}>
                  <span>Kolom: {cols.length} | Baris: {rows_count}</span>
                  {stats.total_sum > 0 && (
                    <span>
                      Total Budget: <span className={styles['lumen-sheets-calc-chip']}>Rp {stats.total_sum.toLocaleString('id-ID')}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
