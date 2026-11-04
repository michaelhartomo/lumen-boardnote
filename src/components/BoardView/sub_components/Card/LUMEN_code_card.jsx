import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Code2,
  Copy,
  Check,
  Plus,
  X,
  Download,
  WrapText,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  FileCode2,
  Share2,
  Sparkles,
  Loader2,
  Globe,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  RotateCw,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  Replace,
  Wand2,
} from 'lucide-react';
import styles from './LUMEN_code_card.module.css';
import { updateCard, showToast } from '../../signals/boardState.js';
import {
  runAiCardAction,
  isCardAiProcessingSignal,
  getSelectedAiModelForTask,
} from '../../signals/aiState.js';

export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', ext: 'js', comment: '//' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts', comment: '//' },
  { id: 'python', label: 'Python', ext: 'py', comment: '#' },
  { id: 'go', label: 'Go (Golang)', ext: 'go', comment: '//' },
  { id: 'rust', label: 'Rust', ext: 'rs', comment: '//' },
  { id: 'sql', label: 'SQL (PostgreSQL)', ext: 'sql', comment: '--' },
  { id: 'html', label: 'HTML / Webpage', ext: 'html', comment: '<!--' },
  { id: 'css', label: 'CSS', ext: 'css', comment: '//' },
  { id: 'json', label: 'JSON', ext: 'json', comment: '//' },
  { id: 'bash', label: 'Bash / Shell', ext: 'sh', comment: '#' },
  { id: 'java', label: 'Java', ext: 'java', comment: '//' },
  { id: 'cpp', label: 'C / C++', ext: 'cpp', comment: '//' },
  { id: 'php', label: 'PHP', ext: 'php', comment: '//' },
  { id: 'ruby', label: 'Ruby', ext: 'rb', comment: '#' },
  { id: 'yaml', label: 'YAML', ext: 'yml', comment: '#' },
];

export const WEB_PREVIEW_DEVICES = [
  {
    id: 'desktop',
    label: 'Desktop (Resizable / Fullscreen)',
    short_label: 'Desktop',
    width: null,
    height: null,
    rotatable: false,
  },
  {
    id: 'laptop',
    label: 'Laptop (1280×800)',
    short_label: 'Laptop',
    width: 1280,
    height: 800,
    rotatable: true,
  },
  {
    id: 'tablet',
    label: 'Tablet / iPad (768×1024)',
    short_label: 'Tablet',
    width: 768,
    height: 1024,
    rotatable: true,
  },
  {
    id: 'mobile',
    label: 'Mobile / iPhone (390×844)',
    short_label: 'Mobile',
    width: 390,
    height: 844,
    rotatable: true,
  },
];

export const DESKTOP_RESIZE_PRESETS = [
  { id: 'full', label: 'Full 100%', width: null, height: null },
  { id: '1920x1080', label: '1920×1080', width: 1920, height: 1080 },
  { id: '1440x900', label: '1440×900', width: 1440, height: 900 },
  { id: '1366x768', label: '1366×768', width: 1366, height: 768 },
  { id: '1024x768', label: '1024×768', width: 1024, height: 768 },
];

export function is_code_file_html(file_obj, all_files = []) {
  if (!file_obj) return false;
  const lang = String(file_obj.language || '').toLowerCase();
  const fname = String(file_obj.name || '').toLowerCase();
  const code = String(file_obj.code || '').trim();
  if (lang === 'html') return true;
  if (/\.(html?|svg)$/i.test(fname)) return true;
  if (
    /^\s*(?:<!doctype\s+html|<html|<head|<body|<div|<section|<main|<header|<nav|<article|<style|<svg|<canvas|<form|<table|<h[1-6])\b/i.test(
      code
    )
  ) {
    return true;
  }
  if (
    Array.isArray(all_files) &&
    all_files.some(
      (f) =>
        String(f?.language || '').toLowerCase() === 'html' ||
        /\.(html?)$/i.test(String(f?.name || ''))
    )
  ) {
    return true;
  }
  return false;
}

const EXT_TO_LANG = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  json: 'json',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  java: 'java',
  c: 'cpp',
  cpp: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  php: 'php',
  rb: 'ruby',
  yml: 'yaml',
  yaml: 'yaml',
};

export const DEFAULT_INITIAL_CODE_DATA = {
  active_file_id: 'file_1',
  theme: 'dark',
  word_wrap: false,
  font_size: 13,
  files: [
    {
      id: 'file_1',
      name: 'snippet.js',
      language: 'javascript',
      code: '',
      pinned_lines: [],
    },
  ],
};

const KEYWORDS_SET = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
  'false', 'finally', 'for', 'from', 'func', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'let', 'match', 'mod', 'mut',
  'new', 'nil', 'none', 'null', 'package', 'private', 'protected', 'pub',
  'public', 'range', 'return', 'select', 'self', 'static', 'struct', 'super',
  'switch', 'this', 'throw', 'trait', 'true', 'try', 'type', 'typeof',
  'undefined', 'use', 'var', 'void', 'where', 'while', 'with', 'yield',
  'def', 'elif', 'except', 'lambda', 'pass', 'raise', 'True', 'False', 'None',
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'ON', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'AND', 'OR', 'NOT', 'NULL', 'PRIMARY', 'KEY', 'DEFAULT', 'RETURNING',
  'defer', 'go', 'chan', 'map', 'fallthrough', 'impl', 'fn', 'let',
]);

const TYPES_SET = new Set([
  'Array', 'Boolean', 'Date', 'Error', 'Map', 'Math', 'Number', 'Object',
  'Promise', 'RegExp', 'Set', 'String', 'Symbol', 'WeakMap', 'WeakSet',
  'console', 'window', 'document', 'process', 'JSON', 'int', 'int32', 'int64',
  'uint', 'uint32', 'uint64', 'float32', 'float64', 'bool', 'string', 'byte',
  'rune', 'error', 'any', 'void', 'usize', 'isize', 'i32', 'i64', 'u32', 'u64',
  'f32', 'f64', 'Vec', 'Option', 'Result', 'Some', 'Ok', 'Err', 'TEXT',
  'VARCHAR', 'INTEGER', 'BIGINT', 'BOOLEAN', 'TIMESTAMP', 'JSONB', 'UUID',
]);

function detect_language_from_filename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const parts = filename.trim().split('.');
  if (parts.length < 2) return null;
  const ext = parts[parts.length - 1].toLowerCase();
  return EXT_TO_LANG[ext] || null;
}

/**
 * Lightweight, zero-dependency syntax tokenizer for a single line of code.
 */
function tokenize_code_line(line_text, language) {
  if (!line_text) return [{ type: 'plain', text: '' }];

  const tokens = [];
  let i = 0;
  const len = line_text.length;

  while (i < len) {
    const ch = line_text[i];
    const next_ch = line_text[i + 1];

    // Line comments: //, #, --
    if (
      (ch === '/' && next_ch === '/') ||
      (ch === '#' && ['python', 'bash', 'ruby', 'yaml'].includes(language)) ||
      (ch === '-' && next_ch === '-' && language === 'sql')
    ) {
      tokens.push({ type: 'comment', text: line_text.slice(i) });
      break;
    }

    // Inline block comment /* ... */
    if (ch === '/' && next_ch === '*') {
      const end_idx = line_text.indexOf('*/', i + 2);
      if (end_idx !== -1) {
        tokens.push({ type: 'comment', text: line_text.slice(i, end_idx + 2) });
        i = end_idx + 2;
      } else {
        tokens.push({ type: 'comment', text: line_text.slice(i) });
        break;
      }
      continue;
    }

    // Strings: '...', "...", `...`
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < len) {
        if (line_text[j] === '\\') {
          j += 2;
          continue;
        }
        if (line_text[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: 'string', text: line_text.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z_$]/.test(line_text[i - 1]))) {
      let j = i;
      while (j < len && /[0-9a-fA-FxX._n]/.test(line_text[j])) {
        j++;
      }
      tokens.push({ type: 'number', text: line_text.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers, Keywords, Types, Functions
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(line_text[j])) {
        j++;
      }
      const word = line_text.slice(i, j);
      let lookahead = j;
      while (lookahead < len && line_text[lookahead] === ' ') lookahead++;
      const is_func_call = line_text[lookahead] === '(';

      if (KEYWORDS_SET.has(word) || (language === 'sql' && KEYWORDS_SET.has(word.toUpperCase()))) {
        tokens.push({ type: 'keyword', text: word });
      } else if (TYPES_SET.has(word) || (language === 'sql' && TYPES_SET.has(word.toUpperCase()))) {
        tokens.push({ type: 'type', text: word });
      } else if (is_func_call) {
        tokens.push({ type: 'function', text: word });
      } else {
        tokens.push({ type: 'plain', text: word });
      }
      i = j;
      continue;
    }

    // Operators
    if ('=+-*/<>!&|?:%^~'.includes(ch)) {
      let j = i + 1;
      while (j < len && '=+-*/<>!&|?:%^~'.includes(line_text[j])) {
        j++;
      }
      tokens.push({ type: 'operator', text: line_text.slice(i, j) });
      i = j;
      continue;
    }

    // Whitespace & Punctuation
    let j = i + 1;
    while (
      j < len &&
      !/[A-Za-z0-9_$"'`/#=-]/.test(line_text[j]) &&
      !'=+-*/<>!&|?:%^~'.includes(line_text[j])
    ) {
      j++;
    }
    tokens.push({ type: 'plain', text: line_text.slice(i, j) });
    i = j;
  }

  return tokens;
}

function normalize_code_file_entry(file_obj, idx = 0, card_code_lang = '', card_content = '') {
  if (!file_obj || typeof file_obj !== 'object') {
    return DEFAULT_INITIAL_CODE_DATA.files[0];
  }
  const resolved_code =
    idx === 0 && !file_obj.code && typeof card_content === 'string' && card_content.trim()
      ? card_content
      : String(file_obj.code || '');
  const raw_name = String(file_obj.name || 'snippet.js').trim();
  const raw_lang = String(file_obj.language || card_code_lang || 'javascript')
    .toLowerCase()
    .trim();

  const is_html_doc =
    /^\s*(?:<!doctype\s+html|<html|<head|<body)\b/i.test(resolved_code) ||
    (/<(?:html|head|body|style|main|section)[\s>]/i.test(resolved_code) &&
      /<\/(?:html|body|style|main|section)>/i.test(resolved_code)) ||
    String(card_code_lang || '').toLowerCase() === 'html' ||
    /^html(?:_|\b)/i.test(raw_name);

  if (is_html_doc) {
    const clean_stem =
      raw_name
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/_+$/g, '')
        .replace(/_+(?:and|with|in|for|to|of|the|a|an)$/i, '')
        .replace(/_+$/g, '') || 'index';
    return {
      ...file_obj,
      code: resolved_code,
      language: 'html',
      name: `${clean_stem}.html`,
    };
  }

  // Also strip accidental trailing underscore right before file extension (e.g. foo_.js -> foo.js)
  const fixed_name = raw_name.replace(/_+\.([a-z0-9]+)$/i, '.$1');
  return {
    ...file_obj,
    code: resolved_code,
    language: raw_lang || 'javascript',
    name: fixed_name,
  };
}

export default function LUMEN_code_card({ card }) {
  useSignals();

  const initial_code_data = useMemo(() => {
    const raw = card.code_data || DEFAULT_INITIAL_CODE_DATA;
    const raw_files = Array.isArray(raw.files) && raw.files.length > 0
      ? raw.files
      : DEFAULT_INITIAL_CODE_DATA.files;
    const files = raw_files.map((f, idx) =>
      normalize_code_file_entry(f, idx, card.code_language, card.content)
    );
    return {
      active_file_id: raw.active_file_id || files[0].id,
      theme: raw.theme || 'dark',
      word_wrap: Boolean(raw.word_wrap),
      font_size: Number(raw.font_size) || 13,
      files,
    };
  }, [card.code_data, card.code_language, card.content]);

  const [files, set_files] = useState(initial_code_data.files);
  const [active_file_id, set_active_file_id] = useState(initial_code_data.active_file_id);
  const [theme, set_theme] = useState(initial_code_data.theme);
  const [word_wrap, set_word_wrap] = useState(initial_code_data.word_wrap);
  const [font_size] = useState(initial_code_data.font_size);

  const [renaming_file_id, set_renaming_file_id] = useState(null);
  const [rename_val, set_rename_val] = useState('');
  const [copied_mode, set_copied_mode] = useState(null); // 'raw' | 'markdown' | null
  const [is_fullscreen, set_is_fullscreen] = useState(false);
  const [is_ai_prompt_open, set_is_ai_prompt_open] = useState(false);
  const [ai_prompt_mode, set_ai_prompt_mode] = useState('improve'); // 'improve' | 'generate'
  const [ai_prompt_input, set_ai_prompt_input] = useState('');
  const [ai_improve_input, set_ai_improve_input] = useState('');
  const [ai_create_new_tab, set_ai_create_new_tab] = useState(false);

  // Code Search & Replace state
  const [is_search_open, set_is_search_open] = useState(false);
  const [search_query, set_search_query] = useState('');
  const [replace_query, set_replace_query] = useState('');
  const [is_replace_open, set_is_replace_open] = useState(false);
  const [search_case_sensitive, set_search_case_sensitive] = useState(false);
  const [active_match_index, set_active_match_index] = useState(0);

  // Fullscreen HTML Webpage Preview & Device Selector state
  const [is_web_preview_open, set_is_web_preview_open] = useState(false);
  const [preview_device_id, set_preview_device_id] = useState('desktop');
  const [preview_is_landscape, set_preview_is_landscape] = useState(false);
  const [preview_reload_key, set_preview_reload_key] = useState(0);

  // Desktop Resizable Viewport state
  const [desktop_is_full, set_desktop_is_full] = useState(true);
  const [desktop_custom_size, set_desktop_custom_size] = useState({
    width: 1366,
    height: 820,
  });
  const [active_resize_dir, set_active_resize_dir] = useState(null); // null | 'right' | 'left' | 'bottom' | 'corner'

  const last_clicked_line_ref = useRef(null);
  const textarea_ref = useRef(null);
  const modal_textarea_ref = useRef(null);
  const editor_viewport_ref = useRef(null);
  const modal_editor_viewport_ref = useRef(null);
  const search_input_ref = useRef(null);
  const modal_search_input_ref = useRef(null);
  const preview_stage_ref = useRef(null);
  const preview_frame_ref = useRef(null);

  useEffect(() => {
    const handle_open_preview_evt = () => {
      set_is_web_preview_open(true);
    };
    window.addEventListener(`lumen-code-web-preview-${card.id}`, handle_open_preview_evt);
    return () => {
      window.removeEventListener(`lumen-code-web-preview-${card.id}`, handle_open_preview_evt);
    };
  }, [card.id]);

  useEffect(() => {
    if (!is_web_preview_open) return undefined;
    const on_key_down = (e) => {
      if (e.key === 'Escape') {
        set_is_web_preview_open(false);
      }
    };
    window.addEventListener('keydown', on_key_down);
    return () => window.removeEventListener('keydown', on_key_down);
  }, [is_web_preview_open]);

  useEffect(() => {
    if (card.code_data) {
      if (Array.isArray(card.code_data.files) && card.code_data.files.length > 0) {
        set_files(
          card.code_data.files.map((f, idx) =>
            normalize_code_file_entry(f, idx, card.code_language, card.content)
          )
        );
      }
      if (card.code_data.active_file_id) {
        set_active_file_id(card.code_data.active_file_id);
      }
      if (card.code_data.theme) {
        set_theme(card.code_data.theme);
      }
      if (card.code_data.word_wrap !== undefined) {
        set_word_wrap(Boolean(card.code_data.word_wrap));
      }
    } else if (typeof card.content === 'string' && card.content.trim()) {
      set_files((prev) =>
        prev.map((f, idx) =>
          idx === 0
            ? normalize_code_file_entry({ ...f, code: card.content }, 0, card.code_language, card.content)
            : f
        )
      );
    }
  }, [card.code_data, card.code_language, card.content]);

  const active_file = useMemo(() => {
    return files.find((f) => f.id === active_file_id) || files[0] || DEFAULT_INITIAL_CODE_DATA.files[0];
  }, [files, active_file_id]);

  const save_code_state = useCallback(
    (next_files, next_active_id = active_file_id, next_theme = theme, next_wrap = word_wrap, record_history = false) => {
      set_files(next_files);
      set_active_file_id(next_active_id);
      set_theme(next_theme);
      set_word_wrap(next_wrap);

      const primary_file = next_files.find((f) => f.id === next_active_id) || next_files[0];
      updateCard(
        card.id,
        {
          code_language: primary_file?.language || 'javascript',
          code_data: {
            active_file_id: next_active_id,
            theme: next_theme,
            word_wrap: next_wrap,
            font_size,
            files: next_files,
          },
          content: primary_file?.code || '',
        },
        record_history
      );
    },
    [card.id, active_file_id, theme, word_wrap, font_size]
  );

  const handle_code_change = (new_code, record_history = false) => {
    const next_files = files.map((f) =>
      f.id === active_file.id ? { ...f, code: new_code } : f
    );
    save_code_state(next_files, active_file.id, theme, word_wrap, record_history);
  };

  const handle_language_change = (e) => {
    e.stopPropagation();
    const new_lang = e.target.value;
    const lang_meta = SUPPORTED_LANGUAGES.find((l) => l.id === new_lang);
    const next_files = files.map((f) => {
      if (f.id !== active_file.id) return f;
      let updated_name = String(f.name || 'snippet.js').trim();
      if (lang_meta) {
        const clean_stem =
          updated_name.replace(/\.[a-z0-9]+$/i, '').replace(/_+$/g, '') || 'snippet';
        updated_name = `${clean_stem}.${lang_meta.ext}`;
      }
      return { ...f, language: new_lang, name: updated_name };
    });
    save_code_state(next_files, active_file.id, theme, word_wrap, true);
  };

  const handle_add_file_tab = (e) => {
    e.stopPropagation();
    const new_idx = files.length + 1;
    const lang_meta = SUPPORTED_LANGUAGES.find((l) => l.id === active_file.language) || SUPPORTED_LANGUAGES[0];
    const new_file = {
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `snippet_${new_idx}.${lang_meta.ext}`,
      language: active_file.language || 'javascript',
      code: '',
      pinned_lines: [],
    };
    const next_files = [...files, new_file];
    save_code_state(next_files, new_file.id, theme, word_wrap, true);
  };

  const handle_remove_file_tab = (file_id, e) => {
    e.stopPropagation();
    if (files.length <= 1) return;
    const next_files = files.filter((f) => f.id !== file_id);
    const next_active = active_file.id === file_id ? next_files[0].id : active_file.id;
    save_code_state(next_files, next_active, theme, word_wrap, true);
  };

  const start_rename_tab = (file_obj, e) => {
    e.stopPropagation();
    set_renaming_file_id(file_obj.id);
    set_rename_val(file_obj.name);
  };

  const commit_rename_tab = () => {
    if (!renaming_file_id) return;
    const trimmed = rename_val.trim() || 'snippet.js';
    const detected_lang = detect_language_from_filename(trimmed);
    const next_files = files.map((f) => {
      if (f.id !== renaming_file_id) return f;
      return {
        ...f,
        name: trimmed,
        language: detected_lang || f.language,
      };
    });
    set_renaming_file_id(null);
    save_code_state(next_files, active_file.id, theme, word_wrap, true);
  };

  const handle_toggle_line_pin = (line_num, e) => {
    e.stopPropagation();
    const current_pins = Array.isArray(active_file.pinned_lines) ? active_file.pinned_lines : [];
    const pin_set = new Set(current_pins);

    if (e.shiftKey && last_clicked_line_ref.current !== null) {
      const start = Math.min(last_clicked_line_ref.current, line_num);
      const end = Math.max(last_clicked_line_ref.current, line_num);
      for (let l = start; l <= end; l++) {
        pin_set.add(l);
      }
    } else if (pin_set.has(line_num)) {
      pin_set.delete(line_num);
    } else {
      pin_set.add(line_num);
    }

    last_clicked_line_ref.current = line_num;
    const next_pins = Array.from(pin_set).sort((a, b) => a - b);
    const next_files = files.map((f) =>
      f.id === active_file.id ? { ...f, pinned_lines: next_pins } : f
    );
    save_code_state(next_files, active_file.id, theme, word_wrap, false);
  };

  const handle_clear_pins = (e) => {
    e.stopPropagation();
    const next_files = files.map((f) =>
      f.id === active_file.id ? { ...f, pinned_lines: [] } : f
    );
    save_code_state(next_files, active_file.id, theme, word_wrap, false);
  };

  const copy_to_clipboard = async (text_to_copy, mode_key, toast_msg) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text_to_copy);
      } else {
        const temp = document.createElement('textarea');
        temp.value = text_to_copy;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      set_copied_mode(mode_key);
      showToast(toast_msg);
      setTimeout(() => {
        set_copied_mode((prev) => (prev === mode_key ? null : prev));
      }, 1800);
    } catch (err) {
      showToast('Failed to copy code');
    }
  };

  const handle_copy_raw = (e) => {
    e.stopPropagation();
    const code_str = active_file.code || '';
    const pins = Array.isArray(active_file.pinned_lines) ? active_file.pinned_lines : [];
    if (pins.length > 0) {
      const lines = code_str.split('\n');
      const selected_text = pins
        .filter((ln) => ln >= 1 && ln <= lines.length)
        .map((ln) => lines[ln - 1])
        .join('\n');
      copy_to_clipboard(
        selected_text || code_str,
        'raw',
        `Copied ${pins.length} highlighted line${pins.length > 1 ? 's' : ''}`
      );
      return;
    }
    copy_to_clipboard(code_str, 'raw', `Copied ${active_file.name}`);
  };

  const handle_copy_markdown = (e) => {
    e.stopPropagation();
    const code_str = active_file.code || '';
    const lang = active_file.language || 'javascript';
    const md_snippet = `// ${active_file.name}\n\`\`\`${lang}\n${code_str}\n\`\`\``;
    copy_to_clipboard(md_snippet, 'markdown', 'Copied as Markdown code block');
  };

  const handle_download_file = (e) => {
    e.stopPropagation();
    const blob = new Blob([active_file.code || ''], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = active_file.name || 'snippet.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${active_file.name}`);
  };

  const handle_toggle_theme = (e) => {
    e.stopPropagation();
    const next_theme = theme === 'dark' ? 'light' : 'dark';
    save_code_state(files, active_file.id, next_theme, word_wrap, false);
  };

  const handle_toggle_wrap = (e) => {
    e.stopPropagation();
    save_code_state(files, active_file.id, theme, !word_wrap, false);
  };

  // Smart programmer keyboard shortcuts inside textarea (Tab, Shift+Tab, Enter auto-indent, Cmd/Ctrl + /)
  const handle_editor_keydown = (e) => {
    e.stopPropagation();
    const el = e.currentTarget;
    const val = el.value;
    const sel_start = el.selectionStart;
    const sel_end = el.selectionEnd;

    // Tab / Shift+Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      if (sel_start !== sel_end && val.slice(sel_start, sel_end).includes('\n')) {
        const line_start = val.lastIndexOf('\n', sel_start - 1) + 1;
        const selected_block = val.slice(line_start, sel_end);
        const block_lines = selected_block.split('\n');
        const transformed = block_lines.map((line) => {
          if (e.shiftKey) {
            return line.startsWith('  ') ? line.slice(2) : line.startsWith('\t') ? line.slice(1) : line;
          }
          return '  ' + line;
        });
        const joined = transformed.join('\n');
        const next_val = val.slice(0, line_start) + joined + val.slice(sel_end);
        handle_code_change(next_val, false);
        requestAnimationFrame(() => {
          el.selectionStart = line_start;
          el.selectionEnd = line_start + joined.length;
        });
      } else if (e.shiftKey) {
        const line_start = val.lastIndexOf('\n', sel_start - 1) + 1;
        if (val.slice(line_start, line_start + 2) === '  ') {
          const next_val = val.slice(0, line_start) + val.slice(line_start + 2);
          handle_code_change(next_val, false);
          requestAnimationFrame(() => {
            const pos = Math.max(line_start, sel_start - 2);
            el.selectionStart = pos;
            el.selectionEnd = pos;
          });
        }
      } else {
        const next_val = val.slice(0, sel_start) + '  ' + val.slice(sel_end);
        handle_code_change(next_val, false);
        requestAnimationFrame(() => {
          el.selectionStart = sel_start + 2;
          el.selectionEnd = sel_start + 2;
        });
      }
      return;
    }

    // Enter key auto-indentation
    if (e.key === 'Enter') {
      e.preventDefault();
      const line_start = val.lastIndexOf('\n', sel_start - 1) + 1;
      const current_line = val.slice(line_start, sel_start);
      const indent_match = current_line.match(/^[ \t]*/);
      let indent = indent_match ? indent_match[0] : '';
      const trimmed_before = current_line.trimEnd();
      if (
        trimmed_before.endsWith('{') ||
        trimmed_before.endsWith('(') ||
        trimmed_before.endsWith('[') ||
        trimmed_before.endsWith(':')
      ) {
        indent += '  ';
      }
      const insert_str = '\n' + indent;
      const next_val = val.slice(0, sel_start) + insert_str + val.slice(sel_end);
      handle_code_change(next_val, false);
      requestAnimationFrame(() => {
        const pos = sel_start + insert_str.length;
        el.selectionStart = pos;
        el.selectionEnd = pos;
      });
      return;
    }

    // Cmd+/ or Ctrl+/ toggle line comment
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      const lang_meta = SUPPORTED_LANGUAGES.find((l) => l.id === active_file.language);
      const prefix = lang_meta?.comment || '//';
      const line_start = val.lastIndexOf('\n', sel_start - 1) + 1;
      const line_end_idx = val.indexOf('\n', sel_end);
      const actual_end = line_end_idx === -1 ? val.length : line_end_idx;
      const block = val.slice(line_start, actual_end);
      const block_lines = block.split('\n');
      const all_commented = block_lines.every((l) => l.trimStart().startsWith(prefix));

      const toggled_lines = block_lines.map((l) => {
        if (all_commented) {
          const idx = l.indexOf(prefix);
          if (idx === -1) return l;
          const remove_len = l[idx + prefix.length] === ' ' ? prefix.length + 1 : prefix.length;
          return l.slice(0, idx) + l.slice(idx + remove_len);
        }
        return `${prefix} ${l}`;
      });

      const joined = toggled_lines.join('\n');
      const next_val = val.slice(0, line_start) + joined + val.slice(actual_end);
      handle_code_change(next_val, true);
      requestAnimationFrame(() => {
        el.selectionStart = line_start;
        el.selectionEnd = line_start + joined.length;
      });
      return;
    }

    // Cmd+F / Ctrl+F open Search bar (and Cmd+H / Ctrl+H open Search & Replace)
    if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'h')) {
      e.preventDefault();
      const selected_str =
        sel_start !== sel_end && !val.slice(sel_start, sel_end).includes('\n')
          ? val.slice(sel_start, sel_end)
          : '';
      if (selected_str) {
        set_search_query(selected_str);
        set_active_match_index(0);
      }
      set_is_search_open(true);
      if (e.key.toLowerCase() === 'h') {
        set_is_replace_open(true);
      }
      requestAnimationFrame(() => {
        const target_input = is_fullscreen
          ? modal_search_input_ref.current
          : search_input_ref.current;
        if (target_input) {
          target_input.focus();
          target_input.select();
        }
      });
    }
  };

  const code_lines = useMemo(() => {
    const raw_code = active_file.code || '';
    return raw_code.split('\n');
  }, [active_file.code]);

  const highlighted_lines = useMemo(() => {
    return code_lines.map((line) => tokenize_code_line(line, active_file.language));
  }, [code_lines, active_file.language]);

  // Compute all search matches across the active file
  const search_matches = useMemo(() => {
    if (!is_search_open || !search_query) return [];
    const needle = search_case_sensitive ? search_query : search_query.toLowerCase();
    const needle_len = needle.length;
    if (needle_len === 0) return [];

    const matches = [];
    let running_char_offset = 0;

    for (let line_idx = 0; line_idx < code_lines.length; line_idx++) {
      const raw_line = code_lines[line_idx];
      const haystack = search_case_sensitive ? raw_line : raw_line.toLowerCase();
      let search_pos = 0;

      while (search_pos <= haystack.length - needle_len) {
        const found_col = haystack.indexOf(needle, search_pos);
        if (found_col === -1) break;
        matches.push({
          match_idx: matches.length,
          line_idx,
          line_num: line_idx + 1,
          start_col: found_col,
          end_col: found_col + needle_len,
          char_start: running_char_offset + found_col,
          char_end: running_char_offset + found_col + needle_len,
          text: raw_line.slice(found_col, found_col + needle_len),
        });
        search_pos = found_col + Math.max(1, needle_len);
      }
      running_char_offset += raw_line.length + 1; // +1 for '\n'
    }
    return matches;
  }, [is_search_open, search_query, search_case_sensitive, code_lines]);

  const safe_active_match_idx =
    search_matches.length > 0
      ? ((active_match_index % search_matches.length) + search_matches.length) %
        search_matches.length
      : 0;

  const active_match_obj =
    search_matches.length > 0 ? search_matches[safe_active_match_idx] : null;

  const matches_by_line = useMemo(() => {
    const map = new Map();
    for (const m of search_matches) {
      if (!map.has(m.line_idx)) {
        map.set(m.line_idx, []);
      }
      map.get(m.line_idx).push(m);
    }
    return map;
  }, [search_matches]);

  const scroll_editor_to_match = useCallback(
    (match_item) => {
      if (!match_item) return;
      const vp = is_fullscreen
        ? modal_editor_viewport_ref.current
        : editor_viewport_ref.current;
      if (!vp) return;
      const line_h = font_size * 1.55;
      const target_top = Math.max(
        0,
        match_item.line_idx * line_h - vp.clientHeight * 0.35
      );
      vp.scrollTo({ top: target_top, behavior: 'smooth' });
    },
    [font_size, is_fullscreen]
  );

  const handle_step_search_match = useCallback(
    (delta) => {
      if (search_matches.length === 0) return;
      const next_idx =
        ((safe_active_match_idx + delta) % search_matches.length +
          search_matches.length) %
        search_matches.length;
      set_active_match_index(next_idx);
      scroll_editor_to_match(search_matches[next_idx]);
    },
    [safe_active_match_idx, search_matches, scroll_editor_to_match]
  );

  const handle_replace_single_match = useCallback(() => {
    if (!active_match_obj) return;
    const raw_code = active_file.code || '';
    const next_code =
      raw_code.slice(0, active_match_obj.char_start) +
      replace_query +
      raw_code.slice(active_match_obj.char_end);
    handle_code_change(next_code, true);
  }, [active_match_obj, active_file.code, replace_query]);

  const handle_replace_all_matches = useCallback(() => {
    if (search_matches.length === 0) return;
    const raw_code = active_file.code || '';
    let rebuilt = '';
    let cursor = 0;
    for (const m of search_matches) {
      rebuilt += raw_code.slice(cursor, m.char_start) + replace_query;
      cursor = m.char_end;
    }
    rebuilt += raw_code.slice(cursor);
    const count = search_matches.length;
    handle_code_change(rebuilt, true);
    set_active_match_index(0);
    showToast(`Replaced ${count} occurrence${count > 1 ? 's' : ''}`);
  }, [search_matches, active_file.code, replace_query]);

  const pinned_set = useMemo(() => {
    return new Set(Array.isArray(active_file.pinned_lines) ? active_file.pinned_lines : []);
  }, [active_file.pinned_lines]);

  const char_count = (active_file.code || '').length;

  const is_html_snippet = useMemo(() => {
    return is_code_file_html(active_file, files);
  }, [active_file, files]);

  const built_preview_html = useMemo(() => {
    const html_file =
      is_code_file_html(active_file, [])
        ? active_file
        : files.find((f) => is_code_file_html(f, [])) || active_file;
    const raw_html = String(html_file?.code || '').trim();
    const companion_css = files
      .filter(
        (f) =>
          f.id !== html_file?.id &&
          (String(f.language || '').toLowerCase() === 'css' || /\.css$/i.test(f.name || ''))
      )
      .map((f) => f.code || '')
      .filter(Boolean)
      .join('\n\n');
    const companion_js = files
      .filter(
        (f) =>
          f.id !== html_file?.id &&
          (String(f.language || '').toLowerCase() === 'javascript' || /\.js$/i.test(f.name || ''))
      )
      .map((f) => f.code || '')
      .filter(Boolean)
      .join('\n\n');

    if (!raw_html) {
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#94a3b8;}</style></head><body><div>Empty HTML snippet — write HTML or click <b>Generate Snippet</b> (muse-wonder-1.0)</div></body></html>`;
    }

    const has_html_tag = /<html[\s>]|<!doctype\s+html/i.test(raw_html);
    if (has_html_tag) {
      let doc = raw_html;
      if (companion_css) {
        doc = doc.includes('</head>')
          ? doc.replace('</head>', `<style>\n${companion_css}\n</style>\n</head>`)
          : `<style>\n${companion_css}\n</style>\n${doc}`;
      }
      if (companion_js) {
        doc = doc.includes('</body>')
          ? doc.replace('</body>', `<script>\n${companion_js}\n</script>\n</body>`)
          : `${doc}\n<script>\n${companion_js}\n</script>`;
      }
      return doc;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${card.title || html_file?.name || 'Webpage Preview'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ${companion_css}
  </style>
</head>
<body>
${raw_html}
${companion_js ? `<script>\n${companion_js}\n</script>` : ''}
</body>
</html>`;
  }, [active_file, files, card.title]);

  const render_tokens_with_search = (tokens, line_matches) => {
    if (!line_matches || line_matches.length === 0) {
      return tokens.map((tok, tok_idx) => {
        const tok_class = tok.type !== 'plain' ? styles[`lumen-token-${tok.type}`] : '';
        return (
          <span key={tok_idx} className={tok_class}>
            {tok.text}
          </span>
        );
      });
    }

    let char_offset = 0;
    return tokens.map((tok, tok_idx) => {
      const tok_text = tok.text || '';
      const tok_start = char_offset;
      const tok_end = tok_start + tok_text.length;
      char_offset = tok_end;

      const tok_class = tok.type !== 'plain' ? styles[`lumen-token-${tok.type}`] : '';

      // Find matches overlapping [tok_start, tok_end)
      const overlapping = line_matches.filter(
        (m) => m.end_col > tok_start && m.start_col < tok_end
      );
      if (overlapping.length === 0) {
        return (
          <span key={tok_idx} className={tok_class}>
            {tok_text}
          </span>
        );
      }

      const pieces = [];
      let local_cursor = tok_start;
      for (const m of overlapping) {
        const seg_start = Math.max(tok_start, m.start_col);
        const seg_end = Math.min(tok_end, m.end_col);
        if (seg_start > local_cursor) {
          pieces.push(tok_text.slice(local_cursor - tok_start, seg_start - tok_start));
        }
        const is_current_active = m.match_idx === safe_active_match_idx;
        pieces.push(
          <mark
            key={`m_${m.match_idx}_${seg_start}`}
            className={`${styles['lumen-code-search-mark']} ${
              is_current_active ? styles['lumen-code-search-mark-active'] : ''
            }`}
          >
            {tok_text.slice(seg_start - tok_start, seg_end - tok_start)}
          </mark>
        );
        local_cursor = seg_end;
      }
      if (local_cursor < tok_end) {
        pieces.push(tok_text.slice(local_cursor - tok_start));
      }

      return (
        <span key={tok_idx} className={tok_class}>
          {pieces}
        </span>
      );
    });
  };

  const render_code_workspace = (in_modal = false) => {
    const active_ref = in_modal ? modal_textarea_ref : textarea_ref;
    const active_vp_ref = in_modal ? modal_editor_viewport_ref : editor_viewport_ref;
    const active_search_ref = in_modal ? modal_search_input_ref : search_input_ref;
    const theme_class =
      theme === 'light'
        ? styles['lumen-code-theme-light']
        : theme === 'midnight'
        ? styles['lumen-code-theme-midnight']
        : '';

    return (
      <div
        className={`${styles['lumen-code-card-root']} ${theme_class}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Multi-file Tabs Bar */}
        <div className={styles['lumen-code-tabs-bar']}>
          <div className={styles['lumen-code-tabs-scroll']}>
            {files.map((file_item) => {
              const is_active = file_item.id === active_file.id;
              const is_renaming = renaming_file_id === file_item.id;
              return (
                <div
                  key={file_item.id}
                  className={`${styles['lumen-code-tab-item']} ${
                    is_active ? styles['lumen-code-tab-active'] : ''
                  }`}
                  onClick={() =>
                    save_code_state(files, file_item.id, theme, word_wrap, false)
                  }
                  onDoubleClick={(e) => start_rename_tab(file_item, e)}
                  title="Click to switch file · Double-click to rename"
                >
                  <FileCode2 size={12} />
                  {is_renaming ? (
                    <input
                      type="text"
                      className={styles['lumen-code-tab-rename-input']}
                      value={rename_val}
                      autoFocus
                      onChange={(e) => set_rename_val(e.target.value)}
                      onBlur={commit_rename_tab}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commit_rename_tab();
                        if (e.key === 'Escape') set_renaming_file_id(null);
                      }}
                    />
                  ) : (
                    <span>{file_item.name}</span>
                  )}
                  {files.length > 1 && !is_renaming && (
                    <button
                      type="button"
                      className={styles['lumen-code-tab-close']}
                      onClick={(e) => handle_remove_file_tab(file_item.id, e)}
                      title="Close file tab"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className={styles['lumen-code-tab-add-btn']}
              onClick={handle_add_file_tab}
              title="Add another file snippet tab"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Programmer Action Toolbar */}
        <div className={styles['lumen-code-toolbar']}>
          <div className={styles['lumen-code-toolbar-left']}>
            <select
              className={styles['lumen-code-lang-select']}
              value={active_file.language || 'javascript'}
              onChange={handle_language_change}
              title="Select syntax language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`${styles['lumen-code-tool-btn']} ${
                is_search_open ? styles['lumen-code-tool-btn-active'] : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                const next_open = !is_search_open;
                set_is_search_open(next_open);
                if (next_open) {
                  requestAnimationFrame(() => {
                    if (active_search_ref.current) {
                      active_search_ref.current.focus();
                      active_search_ref.current.select();
                    }
                  });
                }
              }}
              title="Search & Replace in code snippet (Ctrl+F / Cmd+F)"
            >
              <Search size={12} />
              <span>Search</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-code-tool-btn']} ${
                word_wrap ? styles['lumen-code-tool-btn-active'] : ''
              }`}
              onClick={handle_toggle_wrap}
              title="Toggle word wrap"
            >
              <WrapText size={12} />
              <span>Wrap</span>
            </button>

            <button
              type="button"
              className={styles['lumen-code-tool-btn']}
              onClick={handle_toggle_theme}
              title={theme === 'light' ? 'Switch to Dark IDE theme' : 'Switch to Light theme'}
            >
              {theme === 'light' ? <Moon size={12} /> : <Sun size={12} />}
            </button>

            <button
              type="button"
              className={`${styles['lumen-code-tool-btn']} ${styles['lumen-code-ai-improve-btn']} ${
                is_ai_prompt_open && ai_prompt_mode === 'improve'
                  ? styles['lumen-code-ai-improve-btn-active']
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (is_ai_prompt_open && ai_prompt_mode === 'improve') {
                  set_is_ai_prompt_open(false);
                } else {
                  set_ai_prompt_mode('improve');
                  set_is_ai_prompt_open(true);
                }
              }}
              title="AI Improve Current Code — Update or modify parts of the current code with your instruction (e.g. change the bird image to phoenix) via Meta Muse (muse-wonder-1.0)"
            >
              {isCardAiProcessingSignal.value?.cardId === card.id ? (
                <Loader2 size={12} className={styles['lumen-code-spin']} />
              ) : (
                <Wand2 size={12} />
              )}
              <span>AI Improve Code</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-code-tool-btn']} ${styles['lumen-code-ai-btn']} ${
                is_ai_prompt_open && ai_prompt_mode === 'generate'
                  ? styles['lumen-code-ai-btn-active']
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (is_ai_prompt_open && ai_prompt_mode === 'generate') {
                  set_is_ai_prompt_open(false);
                } else {
                  set_ai_prompt_mode('generate');
                  set_is_ai_prompt_open(true);
                }
              }}
              title="AI Function from Prompt — Generate code snippet with Meta Muse (muse-wonder-1.0)"
            >
              {isCardAiProcessingSignal.value?.cardId === card.id ? (
                <Loader2 size={12} className={styles['lumen-code-spin']} />
              ) : (
                <Sparkles size={12} />
              )}
              <span>Generate Snippet</span>
            </button>

            {is_html_snippet && (
              <button
                type="button"
                className={`${styles['lumen-code-tool-btn']} ${styles['lumen-code-preview-btn']}`}
                onClick={(e) => {
                  e.stopPropagation();
                  set_is_web_preview_open(true);
                }}
                title="Preview HTML Webpage in Fullscreen with Device Selector (Desktop, Laptop, Tablet, Mobile)"
              >
                <Globe size={12} />
                <span>Preview Webpage</span>
              </button>
            )}
          </div>

          <div className={styles['lumen-code-toolbar-right']}>
            <button
              type="button"
              className={`${styles['lumen-code-tool-btn']} ${
                copied_mode === 'markdown' ? styles['lumen-code-tool-btn-copied'] : ''
              }`}
              onClick={handle_copy_markdown}
              title="Copy formatted Markdown snippet for GitHub / Slack / Discord"
            >
              {copied_mode === 'markdown' ? <Check size={12} /> : <Share2 size={12} />}
              <span>Markdown</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-code-tool-btn']} ${
                copied_mode === 'raw' ? styles['lumen-code-tool-btn-copied'] : ''
              }`}
              onClick={handle_copy_raw}
              title={
                pinned_set.size > 0
                  ? `Copy ${pinned_set.size} highlighted line(s)`
                  : 'Copy code to clipboard'
              }
            >
              {copied_mode === 'raw' ? <Check size={12} /> : <Copy size={12} />}
              <span>
                {copied_mode === 'raw'
                  ? 'Copied'
                  : pinned_set.size > 0
                  ? `Copy (${pinned_set.size})`
                  : 'Copy'}
              </span>
            </button>

            <button
              type="button"
              className={styles['lumen-code-tool-btn']}
              onClick={handle_download_file}
              title={`Download ${active_file.name}`}
            >
              <Download size={12} />
            </button>

            <button
              type="button"
              className={styles['lumen-code-tool-btn']}
              onClick={(e) => {
                e.stopPropagation();
                set_is_fullscreen(!in_modal);
              }}
              title={in_modal ? 'Exit fullscreen' : 'Expand code editor'}
            >
              {in_modal ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>

        {/* Code Search & Replace Bar */}
        {is_search_open && (
          <div
            className={styles['lumen-code-search-bar']}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles['lumen-code-search-row']}>
              <div className={styles['lumen-code-search-input-wrap']}>
                <Search size={12} className={styles['lumen-code-search-icon']} />
                <input
                  ref={active_search_ref}
                  type="text"
                  className={styles['lumen-code-search-input']}
                  value={search_query}
                  onChange={(e) => {
                    set_search_query(e.target.value);
                    set_active_match_index(0);
                  }}
                  placeholder={`Find in ${active_file.name}... (Enter = Next, Shift+Enter = Prev)`}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handle_step_search_match(e.shiftKey ? -1 : 1);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      set_is_search_open(false);
                    }
                  }}
                />
                {search_query && (
                  <button
                    type="button"
                    className={styles['lumen-code-search-clear-btn']}
                    onClick={() => {
                      set_search_query('');
                      set_active_match_index(0);
                      if (active_search_ref.current) active_search_ref.current.focus();
                    }}
                    title="Clear search query"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              <span
                className={`${styles['lumen-code-search-count']} ${
                  search_query && search_matches.length === 0
                    ? styles['lumen-code-search-count-empty']
                    : ''
                }`}
              >
                {!search_query
                  ? 'Type to search'
                  : search_matches.length === 0
                  ? '0 results'
                  : `${safe_active_match_idx + 1} / ${search_matches.length}${
                      active_match_obj ? ` (Ln ${active_match_obj.line_num})` : ''
                    }`}
              </span>

              <button
                type="button"
                className={`${styles['lumen-code-search-opt-btn']} ${
                  search_case_sensitive ? styles['lumen-code-search-opt-btn-active'] : ''
                }`}
                onClick={() => {
                  set_search_case_sensitive((prev) => !prev);
                  set_active_match_index(0);
                }}
                title="Match Case (Aa)"
              >
                Aa
              </button>

              <button
                type="button"
                className={styles['lumen-code-search-nav-btn']}
                disabled={search_matches.length === 0}
                onClick={() => handle_step_search_match(-1)}
                title="Previous Match (Shift+Enter)"
              >
                <ChevronUp size={13} />
              </button>

              <button
                type="button"
                className={styles['lumen-code-search-nav-btn']}
                disabled={search_matches.length === 0}
                onClick={() => handle_step_search_match(1)}
                title="Next Match (Enter)"
              >
                <ChevronDown size={13} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-code-search-opt-btn']} ${
                  is_replace_open ? styles['lumen-code-search-opt-btn-active'] : ''
                }`}
                onClick={() => set_is_replace_open((prev) => !prev)}
                title="Toggle Replace mode (Ctrl+H)"
              >
                <Replace size={11} />
                <span>Replace</span>
              </button>

              <button
                type="button"
                className={styles['lumen-code-search-close-btn']}
                onClick={() => set_is_search_open(false)}
                title="Close Search (Esc)"
              >
                <X size={13} />
              </button>
            </div>

            {is_replace_open && (
              <div className={styles['lumen-code-replace-row']}>
                <div className={styles['lumen-code-search-input-wrap']}>
                  <Replace size={12} className={styles['lumen-code-search-icon']} />
                  <input
                    type="text"
                    className={styles['lumen-code-search-input']}
                    value={replace_query}
                    onChange={(e) => set_replace_query(e.target.value)}
                    placeholder="Replace with..."
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handle_replace_single_match();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        set_is_search_open(false);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={styles['lumen-code-replace-action-btn']}
                  disabled={search_matches.length === 0}
                  onClick={handle_replace_single_match}
                  title="Replace active match"
                >
                  Replace
                </button>
                <button
                  type="button"
                  className={styles['lumen-code-replace-action-btn']}
                  disabled={search_matches.length === 0}
                  onClick={handle_replace_all_matches}
                  title="Replace all matches in current file"
                >
                  Replace All ({search_matches.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline AI Improve Current Code & Generate Snippet Drawer */}
        {is_ai_prompt_open && (() => {
          const coding_model = getSelectedAiModelForTask('coding');
          const is_busy = Boolean(isCardAiProcessingSignal.value);
          const has_current_code = (active_file.code || '').trim().length > 0;
          const is_improve_mode = ai_prompt_mode === 'improve';
          const active_lang_label =
            SUPPORTED_LANGUAGES.find((l) => l.id === active_file.language)?.label || 'JavaScript';
          const code_presets =
            active_file.language === 'html'
              ? [
                  'Responsive SaaS landing page with pricing cards in HTML',
                  'Interactive analytics dashboard webpage in HTML',
                  'Portfolio hero & project showcase webpage in HTML',
                  'Interactive calculator / Pomodoro timer app in HTML',
                ]
              : [
                  `Fetch helper with retry & timeout in ${active_lang_label}`,
                  `Debounce & throttle function in ${active_lang_label}`,
                  `REST API handler with validation in ${active_lang_label}`,
                  `Responsive HTML5 landing page with interactive UI`,
                ];

          const improve_presets =
            active_file.language === 'html'
              ? [
                  'Change the bird image to phoenix',
                  'Update color palette & add smooth animations',
                  'Add interactive controls & score/status counter',
                  'Make layout fully responsive with modern glassmorphism',
                ]
              : [
                  'Change the bird image to phoenix',
                  `Add error handling, validation & edge-case checks in ${active_lang_label}`,
                  `Update parameters & return format while keeping existing logic`,
                  `Optimize performance & add clear inline comments`,
                ];

          const handle_submit_ai_code = async (e) => {
            if (e) e.preventDefault();
            const trimmed = ai_prompt_input.trim();
            if (!trimmed || is_busy) return;
            const inferred_html =
              /\b(html|html5|webpage|web\s*page|landing\s*page|website|single\s*page|hero\s*section|invitation)\b/i.test(
                trimmed
              ) || /\.html?\b/i.test(trimmed);
            const target_lang = inferred_html ? 'html' : active_file.language || 'javascript';
            save_code_state(files, active_file.id, theme, word_wrap, false);
            set_ai_prompt_input('');
            set_is_ai_prompt_open(false);
            await runAiCardAction(card.id, 'code_generate_snippet', trimmed, {
              target_language: target_lang,
              create_new_tab: ai_create_new_tab,
              current_code: active_file.code || '',
              current_file_id: active_file.id,
              current_file_name: active_file.name || '',
            });
          };

          const handle_submit_ai_improve = async (e) => {
            if (e) e.preventDefault();
            const trimmed = ai_improve_input.trim();
            if (!trimmed || is_busy) return;
            const target_lang = active_file.language || 'javascript';
            save_code_state(files, active_file.id, theme, word_wrap, false);
            set_ai_improve_input('');
            set_is_ai_prompt_open(false);
            await runAiCardAction(card.id, 'code_improve_current', trimmed, {
              target_language: target_lang,
              create_new_tab: ai_create_new_tab,
              current_code: active_file.code || '',
              current_file_id: active_file.id,
              current_file_name: active_file.name || '',
            });
          };

          return (
            <div
              className={styles['lumen-code-ai-drawer']}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles['lumen-code-ai-drawer-top']}>
                <div className={styles['lumen-code-ai-drawer-title']}>
                  {is_improve_mode ? <Wand2 size={12} /> : <Sparkles size={12} />}
                  <span>
                    {is_improve_mode
                      ? `AI Improve Current Code · ${active_file.name || active_lang_label}`
                      : `AI Function from Prompt · Generate ${active_lang_label} Snippet`}
                  </span>
                  <span className={styles['lumen-code-ai-model-badge']}>
                    {coding_model?.badge || 'muse-wonder-1.0'}
                  </span>
                </div>
                <div className={styles['lumen-code-ai-drawer-controls']}>
                  <div className={styles['lumen-code-ai-mode-tabs']}>
                    <button
                      type="button"
                      className={`${styles['lumen-code-ai-mode-tab']} ${
                        is_improve_mode ? styles['lumen-code-ai-mode-tab-active'] : ''
                      }`}
                      onClick={() => set_ai_prompt_mode('improve')}
                    >
                      <Wand2 size={10} />
                      <span>Improve Current Code</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles['lumen-code-ai-mode-tab']} ${
                        !is_improve_mode ? styles['lumen-code-ai-mode-tab-active'] : ''
                      }`}
                      onClick={() => set_ai_prompt_mode('generate')}
                    >
                      <Sparkles size={10} />
                      <span>Generate New</span>
                    </button>
                  </div>
                  <label className={styles['lumen-code-ai-tab-toggle']}>
                    <input
                      type="checkbox"
                      checked={ai_create_new_tab}
                      onChange={(e) => set_ai_create_new_tab(e.target.checked)}
                    />
                    <span>New tab</span>
                  </label>
                  <button
                    type="button"
                    className={styles['lumen-code-ai-close-btn']}
                    onClick={() => set_is_ai_prompt_open(false)}
                    title="Close AI code prompt"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {is_improve_mode ? (
                <>
                  <div className={styles['lumen-code-ai-presets']}>
                    {improve_presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={styles['lumen-code-ai-preset-chip']}
                        onClick={() => set_ai_improve_input(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <form className={styles['lumen-code-ai-form']} onSubmit={handle_submit_ai_improve}>
                    <input
                      type="text"
                      className={styles['lumen-code-ai-input']}
                      value={ai_improve_input}
                      onChange={(e) => set_ai_improve_input(e.target.value.slice(0, 500))}
                      placeholder={`Describe what to update in ${active_file.name || 'current code'} (e.g. change the bird image to phoenix)...`}
                      autoFocus
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                          set_is_ai_prompt_open(false);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!ai_improve_input.trim() || is_busy}
                      className={`${styles['lumen-code-ai-submit-btn']} ${styles['lumen-code-ai-improve-submit-btn']}`}
                    >
                      <Wand2 size={11} />
                      <span>{is_busy ? 'Improving...' : 'Improve Current Code'}</span>
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className={styles['lumen-code-ai-presets']}>
                    {code_presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={styles['lumen-code-ai-preset-chip']}
                        onClick={() => set_ai_prompt_input(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <form className={styles['lumen-code-ai-form']} onSubmit={handle_submit_ai_code}>
                    <input
                      type="text"
                      className={styles['lumen-code-ai-input']}
                      value={ai_prompt_input}
                      onChange={(e) => set_ai_prompt_input(e.target.value.slice(0, 500))}
                      placeholder={`Describe the ${active_lang_label} snippet or HTML webpage to generate with muse-wonder-1.0...`}
                      autoFocus
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                          set_is_ai_prompt_open(false);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!ai_prompt_input.trim() || is_busy}
                      className={styles['lumen-code-ai-submit-btn']}
                    >
                      <Sparkles size={11} />
                      <span>{is_busy ? 'Generating...' : 'Generate Code'}</span>
                    </button>
                  </form>
                </>
              )}

              {has_current_code && (
                <div className={styles['lumen-code-ai-quick-row']}>
                  <span className={styles['lumen-code-ai-quick-label']}>Quick AI on current code:</span>
                  <button
                    type="button"
                    disabled={is_busy}
                    className={styles['lumen-code-ai-quick-btn']}
                    onClick={async () => {
                      save_code_state(files, active_file.id, theme, word_wrap, false);
                      set_is_ai_prompt_open(false);
                      await runAiCardAction(card.id, 'code_explain_and_comment', '', {
                        target_language: active_file.language || 'javascript',
                        current_code: active_file.code || '',
                        current_file_id: active_file.id,
                        current_file_name: active_file.name || '',
                      });
                    }}
                  >
                    + Add Inline Comments
                  </button>
                  <button
                    type="button"
                    disabled={is_busy}
                    className={styles['lumen-code-ai-quick-btn']}
                    onClick={async () => {
                      save_code_state(files, active_file.id, theme, word_wrap, false);
                      set_is_ai_prompt_open(false);
                      await runAiCardAction(card.id, 'code_optimize_refactor', '', {
                        target_language: active_file.language || 'javascript',
                        current_code: active_file.code || '',
                        current_file_id: active_file.id,
                        current_file_name: active_file.name || '',
                      });
                    }}
                  >
                    Optimize & Refactor
                  </button>
                  {!is_improve_mode && (
                    <form
                      className={styles['lumen-code-ai-inline-improve-form']}
                      onSubmit={handle_submit_ai_improve}
                    >
                      <input
                        type="text"
                        className={styles['lumen-code-ai-inline-improve-input']}
                        value={ai_improve_input}
                        onChange={(e) => set_ai_improve_input(e.target.value.slice(0, 500))}
                        placeholder="AI Improve current code (e.g. change the bird image to phoenix)..."
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                      <button
                        type="submit"
                        disabled={!ai_improve_input.trim() || is_busy}
                        className={styles['lumen-code-ai-inline-improve-btn']}
                      >
                        <Wand2 size={10} />
                        <span>{is_busy ? 'Improving...' : 'Improve'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Synchronized Gutter + Syntax Highlighted Editor */}
        <div
          ref={active_vp_ref}
          className={`${styles['lumen-code-editor-viewport']} ${
            word_wrap ? styles['lumen-code-wrap'] : styles['lumen-code-nowrap']
          }`}
          style={{ fontSize: `${font_size}px`, lineHeight: '1.55' }}
        >
          <div className={styles['lumen-code-gutter']}>
            {code_lines.map((_, idx) => {
              const line_num = idx + 1;
              const is_pinned = pinned_set.has(line_num);
              const line_has_match = matches_by_line.has(idx);
              const line_is_active_match = active_match_obj?.line_idx === idx;
              return (
                <div
                  key={line_num}
                  className={`${styles['lumen-code-gutter-line']} ${
                    is_pinned ? styles['lumen-code-gutter-line-pinned'] : ''
                  } ${line_has_match ? styles['lumen-code-gutter-line-match'] : ''} ${
                    line_is_active_match ? styles['lumen-code-gutter-line-match-active'] : ''
                  }`}
                  onClick={(e) => handle_toggle_line_pin(line_num, e)}
                  title="Click to highlight line · Shift+Click for range"
                >
                  {line_num}
                </div>
              );
            })}
          </div>

          <div className={styles['lumen-code-stage']}>
            <pre className={styles['lumen-code-highlight-layer']} aria-hidden="true">
              {highlighted_lines.map((tokens, line_idx) => {
                const line_num = line_idx + 1;
                const is_pinned = pinned_set.has(line_num);
                const line_matches = matches_by_line.get(line_idx);
                const line_is_active_match = active_match_obj?.line_idx === line_idx;
                return (
                  <div
                    key={line_num}
                    className={`${styles['lumen-code-highlight-line']} ${
                      is_pinned ? styles['lumen-code-highlight-line-pinned'] : ''
                    } ${line_matches ? styles['lumen-code-highlight-line-match'] : ''} ${
                      line_is_active_match ? styles['lumen-code-highlight-line-match-active'] : ''
                    }`}
                  >
                    {tokens.length === 0 || (tokens.length === 1 && tokens[0].text === '') ? (
                      '\u200B'
                    ) : (
                      render_tokens_with_search(tokens, line_matches)
                    )}
                  </div>
                );
              })}
            </pre>

            <textarea
              ref={active_ref}
              className={styles['lumen-code-textarea']}
              value={active_file.code || ''}
              onChange={(e) => handle_code_change(e.target.value, false)}
              onBlur={(e) => handle_code_change(e.target.value, true)}
              onKeyDown={handle_editor_keydown}
              placeholder="// Paste or write code here... (Tab to indent, Ctrl+F to search, Ctrl+/ to comment)"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
        </div>

        {/* Clean Metadata Footer */}
        <div className={styles['lumen-code-footer']}>
          <div className={styles['lumen-code-footer-meta']}>
            <span>{code_lines.length} {code_lines.length === 1 ? 'line' : 'lines'}</span>
            <span className={styles['lumen-code-footer-sep']}>·</span>
            <span>{char_count} chars</span>
            <span className={styles['lumen-code-footer-sep']}>·</span>
            <span>muse-wonder-1.0</span>
          </div>

          <div className={styles['lumen-code-footer-meta']}>
            {pinned_set.size > 0 ? (
              <button
                type="button"
                className={styles['lumen-code-clear-pins-btn']}
                onClick={handle_clear_pins}
              >
                {pinned_set.size} highlighted · Clear
              </button>
            ) : is_html_snippet ? (
              <button
                type="button"
                className={styles['lumen-code-footer-preview-link']}
                onClick={(e) => {
                  e.stopPropagation();
                  set_is_web_preview_open(true);
                }}
              >
                HTML Webpage Ready · Click to Preview Fullscreen
              </button>
            ) : (
              <span>Double-click tab to rename</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const selected_device_meta =
    WEB_PREVIEW_DEVICES.find((d) => d.id === preview_device_id) || WEB_PREVIEW_DEVICES[0];

  const is_desktop_mode = preview_device_id === 'desktop';
  const is_desktop_windowed = is_desktop_mode && !desktop_is_full;

  const resolved_frame_w = is_desktop_mode
    ? desktop_is_full
      ? '100%'
      : `${desktop_custom_size.width}px`
    : preview_is_landscape
    ? `${selected_device_meta.height}px`
    : `${selected_device_meta.width}px`;

  const resolved_frame_h = is_desktop_mode
    ? desktop_is_full
      ? '100%'
      : `${desktop_custom_size.height}px`
    : preview_is_landscape
    ? `${selected_device_meta.width}px`
    : `${selected_device_meta.height}px`;

  const resolved_dims_badge = is_desktop_mode
    ? desktop_is_full
      ? 'Full 100% (Drag edges to resize)'
      : `${desktop_custom_size.width} × ${desktop_custom_size.height} px · Resizable`
    : preview_is_landscape
    ? `${selected_device_meta.height} × ${selected_device_meta.width} px · Landscape`
    : `${selected_device_meta.width} × ${selected_device_meta.height} px · Portrait`;

  const start_desktop_resize = useCallback(
    (direction, e) => {
      e.preventDefault();
      e.stopPropagation();

      const frame_el = preview_frame_ref.current;
      const stage_el = preview_stage_ref.current;
      const frame_rect = frame_el
        ? frame_el.getBoundingClientRect()
        : { width: desktop_custom_size.width, height: desktop_custom_size.height };
      const stage_rect = stage_el
        ? stage_el.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight - 60 };

      const start_x = e.clientX;
      const start_y = e.clientY;
      const start_w = Math.round(frame_rect.width);
      const start_h = Math.round(frame_rect.height);
      const max_w = Math.max(480, Math.round(stage_rect.width - 32));
      const max_h = Math.max(320, Math.round(stage_rect.height - 32));

      if (preview_device_id !== 'desktop') {
        set_preview_device_id('desktop');
      }
      set_desktop_is_full(false);
      set_desktop_custom_size({
        width: Math.min(start_w, max_w),
        height: Math.min(start_h, max_h),
      });
      set_active_resize_dir(direction);

      const handle_mouse_move = (move_evt) => {
        const dx = move_evt.clientX - start_x;
        const dy = move_evt.clientY - start_y;

        set_desktop_custom_size((prev) => {
          let next_w = prev.width;
          let next_h = prev.height;

          // Because the preview frame is centered horizontally and vertically in the stage,
          // multiplying delta by 2 keeps the dragged handle directly underneath the cursor.
          if (direction === 'right' || direction === 'corner') {
            next_w = Math.round(Math.max(320, Math.min(max_w, start_w + dx * 2)));
          } else if (direction === 'left') {
            next_w = Math.round(Math.max(320, Math.min(max_w, start_w - dx * 2)));
          }

          if (direction === 'bottom' || direction === 'corner') {
            next_h = Math.round(Math.max(240, Math.min(max_h, start_h + dy * 2)));
          }

          return { width: next_w, height: next_h };
        });
      };

      const handle_mouse_up = () => {
        set_active_resize_dir(null);
        window.removeEventListener('mousemove', handle_mouse_move);
        window.removeEventListener('mouseup', handle_mouse_up);
      };

      window.addEventListener('mousemove', handle_mouse_move);
      window.addEventListener('mouseup', handle_mouse_up);
    },
    [desktop_custom_size.height, desktop_custom_size.width, preview_device_id]
  );

  return (
    <>
      {render_code_workspace(false)}
      {is_fullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles['lumen-code-modal-backdrop']}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) set_is_fullscreen(false);
            }}
          >
            <div
              className={`${styles['lumen-code-modal-window']} ${
                theme === 'light' ? styles['lumen-code-theme-light'] : ''
              }`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className={styles['lumen-code-modal-header']}>
                <div className={styles['lumen-code-modal-title']}>
                  <Code2 size={16} />
                  <span>{card.title || 'Code Snippet'}</span>
                  <span className={styles['lumen-code-ai-model-badge']}>muse-wonder-1.0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {is_html_snippet && (
                    <button
                      type="button"
                      className={`${styles['lumen-code-tool-btn']} ${styles['lumen-code-preview-btn']}`}
                      onClick={() => {
                        set_is_fullscreen(false);
                        set_is_web_preview_open(true);
                      }}
                    >
                      <Globe size={13} />
                      <span>Preview Webpage</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles['lumen-code-tool-btn']}
                    onClick={() => set_is_fullscreen(false)}
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </div>
              </div>
              {render_code_workspace(true)}
            </div>
          </div>,
          document.body
        )}

      {is_web_preview_open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles['lumen-code-web-preview-backdrop']}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) set_is_web_preview_open(false);
            }}
          >
            <div
              className={styles['lumen-code-web-preview-shell']}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Top Bar with Device Selector */}
              <div className={styles['lumen-code-web-preview-topbar']}>
                <div className={styles['lumen-code-web-preview-brand']}>
                  <Globe size={16} className={styles['lumen-code-web-preview-globe']} />
                  <span className={styles['lumen-code-web-preview-title']}>
                    {card.title || active_file.name || 'Webpage Preview'}
                  </span>
                  <span className={styles['lumen-code-web-preview-file-pill']}>
                    {active_file.name}
                  </span>
                  <span className={styles['lumen-code-ai-model-badge']}>muse-wonder-1.0</span>
                </div>

                {/* Device Selector Bar */}
                <div className={styles['lumen-code-web-device-selector']}>
                  {WEB_PREVIEW_DEVICES.map((dev) => {
                    const is_selected = preview_device_id === dev.id;
                    const DevIcon =
                      dev.id === 'desktop'
                        ? Monitor
                        : dev.id === 'laptop'
                        ? Laptop
                        : dev.id === 'tablet'
                        ? Tablet
                        : Smartphone;
                    return (
                      <button
                        key={dev.id}
                        type="button"
                        className={`${styles['lumen-code-web-device-btn']} ${
                          is_selected ? styles['lumen-code-web-device-btn-active'] : ''
                        }`}
                        onClick={() => {
                          set_preview_device_id(dev.id);
                          if (!dev.rotatable) set_preview_is_landscape(false);
                        }}
                        title={dev.label}
                      >
                        <DevIcon size={13} />
                        <span>{dev.short_label}</span>
                      </button>
                    );
                  })}

                  {selected_device_meta.rotatable && (
                    <button
                      type="button"
                      className={`${styles['lumen-code-web-device-btn']} ${
                        preview_is_landscape ? styles['lumen-code-web-device-btn-active'] : ''
                      }`}
                      onClick={() => set_preview_is_landscape((prev) => !prev)}
                      title="Toggle Portrait / Landscape Orientation"
                    >
                      <RotateCw size={13} />
                      <span>{preview_is_landscape ? 'Landscape' : 'Portrait'}</span>
                    </button>
                  )}

                  <span className={styles['lumen-code-web-dims-badge']}>
                    {resolved_dims_badge}
                  </span>
                </div>

                {/* Desktop Resizable Controls (Presets + Width Slider + W×H Inputs) */}
                {is_desktop_mode && (
                  <div className={styles['lumen-code-web-desktop-sizer']}>
                    <span className={styles['lumen-code-web-sizer-label']}>Resize Desktop:</span>
                    {DESKTOP_RESIZE_PRESETS.map((preset) => {
                      const is_preset_active =
                        preset.id === 'full'
                          ? desktop_is_full
                          : !desktop_is_full &&
                            desktop_custom_size.width === preset.width &&
                            desktop_custom_size.height === preset.height;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`${styles['lumen-code-web-preset-btn']} ${
                            is_preset_active ? styles['lumen-code-web-preset-btn-active'] : ''
                          }`}
                          onClick={() => {
                            if (preset.id === 'full') {
                              set_desktop_is_full(true);
                            } else {
                              set_desktop_is_full(false);
                              set_desktop_custom_size({
                                width: preset.width,
                                height: preset.height,
                              });
                            }
                          }}
                          title={
                            preset.id === 'full'
                              ? 'Expand Desktop to 100% Fullscreen'
                              : `Resize Desktop to ${preset.label}`
                          }
                        >
                          {preset.label}
                        </button>
                      );
                    })}

                    <div className={styles['lumen-code-web-slider-wrap']}>
                      <input
                        type="range"
                        min={360}
                        max={1920}
                        step={10}
                        value={desktop_is_full ? 1920 : desktop_custom_size.width}
                        onChange={(e) => {
                          const next_w = Number(e.target.value) || 1280;
                          set_desktop_is_full(false);
                          set_desktop_custom_size((prev) => ({
                            width: next_w,
                            height: prev.height || 820,
                          }));
                        }}
                        className={styles['lumen-code-web-width-slider']}
                        title="Slide to resize Desktop width (px)"
                      />
                    </div>

                    <div className={styles['lumen-code-web-dim-inputs']}>
                      <input
                        type="number"
                        min={320}
                        max={3840}
                        value={desktop_is_full ? 1920 : desktop_custom_size.width}
                        onChange={(e) => {
                          const val = Math.max(320, Math.min(3840, Number(e.target.value) || 320));
                          set_desktop_is_full(false);
                          set_desktop_custom_size((prev) => ({ ...prev, width: val }));
                        }}
                        className={styles['lumen-code-web-dim-input']}
                        title="Desktop Width (px)"
                      />
                      <span className={styles['lumen-code-web-dim-mul']}>×</span>
                      <input
                        type="number"
                        min={240}
                        max={2160}
                        value={desktop_is_full ? 1080 : desktop_custom_size.height}
                        onChange={(e) => {
                          const val = Math.max(240, Math.min(2160, Number(e.target.value) || 240));
                          set_desktop_is_full(false);
                          set_desktop_custom_size((prev) => ({ ...prev, height: val }));
                        }}
                        className={styles['lumen-code-web-dim-input']}
                        title="Desktop Height (px)"
                      />
                      <span className={styles['lumen-code-web-dim-unit']}>px</span>
                    </div>
                  </div>
                )}

                {/* Right Actions */}
                <div className={styles['lumen-code-web-preview-actions']}>
                  <button
                    type="button"
                    className={styles['lumen-code-web-action-btn']}
                    onClick={() => set_preview_reload_key((k) => k + 1)}
                    title="Reload Webpage Preview"
                  >
                    <RefreshCw size={13} />
                    <span>Reload</span>
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-code-web-action-btn']}
                    onClick={() => {
                      set_is_web_preview_open(false);
                      set_is_fullscreen(true);
                    }}
                    title="Switch to Fullscreen Code Editor"
                  >
                    <Code2 size={13} />
                    <span>Edit Code</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles['lumen-code-web-action-btn']} ${styles['lumen-code-web-close-btn']}`}
                    onClick={() => set_is_web_preview_open(false)}
                    title="Close Webpage Preview (Esc)"
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {/* Viewport Stage */}
              <div
                ref={preview_stage_ref}
                className={`${styles['lumen-code-web-preview-stage']} ${
                  is_desktop_mode && desktop_is_full
                    ? styles['lumen-code-web-preview-stage-full']
                    : ''
                }`}
              >
                <div
                  ref={preview_frame_ref}
                  className={`${styles['lumen-code-web-device-frame']} ${
                    !is_desktop_mode
                      ? styles[`lumen-code-web-device-frame-${preview_device_id}`]
                      : desktop_is_full
                      ? styles['lumen-code-web-device-frame-desktop']
                      : styles['lumen-code-web-device-frame-desktop-windowed']
                  } ${active_resize_dir ? styles['lumen-code-web-device-frame-resizing'] : ''}`}
                  style={{
                    width: resolved_frame_w,
                    height: resolved_frame_h,
                  }}
                >
                  {(!is_desktop_mode || is_desktop_windowed) && (
                    <div className={styles['lumen-code-web-device-bezel-bar']}>
                      <span className={styles['lumen-code-web-device-dots']}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className={styles['lumen-code-web-device-url']}>
                        preview://lumen.local/{active_file.name || 'index.html'}
                      </span>
                      <div className={styles['lumen-code-web-bezel-right']}>
                        <span className={styles['lumen-code-web-device-bezel-dims']}>
                          {is_desktop_windowed
                            ? `Desktop · ${desktop_custom_size.width}×${desktop_custom_size.height}`
                            : selected_device_meta.short_label}
                        </span>
                        {is_desktop_windowed && (
                          <button
                            type="button"
                            className={styles['lumen-code-web-bezel-expand-btn']}
                            onClick={() => set_desktop_is_full(true)}
                            title="Expand Desktop to Full 100%"
                          >
                            <Maximize2 size={11} />
                            <span>Full 100%</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={styles['lumen-code-web-iframe-container']}>
                    <iframe
                      key={`${preview_reload_key}_${active_file.id}`}
                      title={`Webpage Preview — ${card.title || active_file.name}`}
                      srcDoc={built_preview_html}
                      sandbox="allow-scripts allow-forms allow-modals allow-popups"
                      className={styles['lumen-code-web-iframe']}
                    />

                    {/* Transparent Drag Shield so iframe does not swallow mousemove while resizing */}
                    {active_resize_dir && (
                      <div className={styles['lumen-code-web-resize-shield']}>
                        <div className={styles['lumen-code-web-resize-hud']}>
                          {desktop_custom_size.width} × {desktop_custom_size.height} px
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive Drag Resize Handles for Desktop mode */}
                  {is_desktop_mode && (
                    <>
                      <div
                        className={styles['lumen-code-web-resize-handle-left']}
                        onMouseDown={(e) => start_desktop_resize('left', e)}
                        title="Drag left edge to resize Desktop width"
                      >
                        <span className={styles['lumen-code-web-resize-grip-v']} />
                      </div>
                      <div
                        className={styles['lumen-code-web-resize-handle-right']}
                        onMouseDown={(e) => start_desktop_resize('right', e)}
                        title="Drag right edge to resize Desktop width"
                      >
                        <span className={styles['lumen-code-web-resize-grip-v']} />
                      </div>
                      <div
                        className={styles['lumen-code-web-resize-handle-bottom']}
                        onMouseDown={(e) => start_desktop_resize('bottom', e)}
                        title="Drag bottom edge to resize Desktop height"
                      >
                        <span className={styles['lumen-code-web-resize-grip-h']} />
                      </div>
                      <div
                        className={styles['lumen-code-web-resize-handle-corner']}
                        onMouseDown={(e) => start_desktop_resize('corner', e)}
                        title="Drag corner to resize Desktop width & height"
                      >
                        <span className={styles['lumen-code-web-resize-corner-icon']} />
                      </div>
                    </>
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
