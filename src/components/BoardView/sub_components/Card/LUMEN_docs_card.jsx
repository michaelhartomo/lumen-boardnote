import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  FileText,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Minus,
  RemoveFormatting,
  Undo2,
  Redo2,
  Code,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  ChevronDown,
  Infinity as InfinityIcon,
  Layers,
  Image as ImageIcon,
  Loader2,
  Search,
} from 'lucide-react';

import styles from './LUMEN_docs_card.module.css';
import {
  updateCard,
  showToast,
  saveCurrentBoardToStore,
  activeBoardSignal,
  get_lumen_auth_headers,
  openImageViewer,
  delete_storage_file_for_board_item,
  FREE_COMMERCIAL_GOOGLE_FONTS,
  googleFontsCatalogSignal,
  ensure_all_google_fonts_loaded,
  search_google_fonts,
  load_google_font,
  get_google_font_css_stack,
} from '../../signals/boardState.js';

const LANG_EXTENSIONS = {
  html: 'html',
  xml: 'xml',
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  css: 'css',
  json: 'json',
  sql: 'sql',
  bash: 'sh',
  go: 'go',
  rust: 'rs',
};

const DISPLAY_LANGUAGES = {
  html: 'html',
  xml: 'xml',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  css: 'css',
  json: 'json',
  sql: 'sql',
  bash: 'bash',
  go: 'go',
  rust: 'rust',
};

/**
 * Generates Google AI (Gemini / Google AI Studio) Style Code Snippet HTML
 * - Iconic Google AI Dark Container (#1e1f20) with subtle dark border (#3c4043)
 * - Header bar (#282a2c) with lowercase language tag and "Copy code" button with Copied state
 * - High-contrast syntax highlighted monospace block on dark background
 */
export function createGoogleAiCodeSnippetHtml(lang = 'html', rawCode = '') {
  const langKey = (lang || 'html').toLowerCase();
  const displayLang = DISPLAY_LANGUAGES[langKey] || langKey;
  const ext = LANG_EXTENSIONS[langKey] || langKey;

  // Escape HTML characters in rawCode first
  let escaped = (rawCode || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply Google AI / Gemini dark theme syntax highlighting
  let highlighted = escaped;
  if (langKey === 'html' || langKey === 'xml') {
    // Tags in Google vibrant light blue: <a, </a, <script, </script, etc.
    highlighted = highlighted.replace(
      /(&lt;\/?[a-zA-Z0-9_-]+)/g,
      '<span style="color: #70b8ff; font-weight: 600;">$1</span>'
    );
    // Attributes in soft purple: data-pin-do, href, src, async, defer, etc.
    highlighted = highlighted.replace(
      /\s([a-zA-Z0-9_-]+)(?==)/g,
      ' <span style="color: #c58af9;">$1</span>'
    );
    // Attribute strings in Google light green: ="..."
    highlighted = highlighted.replace(
      /(="[^"]*")/g,
      '<span style="color: #81c995;">$1</span>'
    );
    // Closing brackets in light blue
    highlighted = highlighted.replace(
      /(&gt;)/g,
      '<span style="color: #8ab4f8; font-weight: 600;">$1</span>'
    );
  } else if (langKey === 'javascript' || langKey === 'typescript' || langKey === 'js' || langKey === 'ts') {
    // Comments
    highlighted = highlighted.replace(
      /(\/\/[^\n]*)/g,
      '<span style="color: #9aa0a6; font-style: italic;">$1</span>'
    );
    // Keywords in lavender purple
    highlighted = highlighted.replace(
      /\b(import|export|from|const|let|var|function|return|if|else|async|await|class|new|type|interface|default)\b/g,
      '<span style="color: #c58af9; font-weight: 600;">$1</span>'
    );
    // Strings in Google light green
    highlighted = highlighted.replace(
      /(&quot;[^&]*&quot;|'[^']*'|`[^`]*`)/g,
      '<span style="color: #81c995;">$1</span>'
    );
    // Numbers in coral red
    highlighted = highlighted.replace(
      /\b(\d+)\b/g,
      '<span style="color: #f28b82;">$1</span>'
    );
  } else if (langKey === 'python' || langKey === 'py') {
    // Comments
    highlighted = highlighted.replace(
      /(#[^\n]*)/g,
      '<span style="color: #9aa0a6; font-style: italic;">$1</span>'
    );
    // Keywords in lavender purple
    highlighted = highlighted.replace(
      /\b(def|class|return|if|elif|else|for|in|import|from|as|try|except|with|pass|lambda|True|False|None)\b/g,
      '<span style="color: #c58af9; font-weight: 600;">$1</span>'
    );
    // Strings in light green
    highlighted = highlighted.replace(
      /(&quot;[^&]*&quot;|'[^']*')/g,
      '<span style="color: #81c995;">$1</span>'
    );
    // Numbers in coral
    highlighted = highlighted.replace(
      /\b(\d+)\b/g,
      '<span style="color: #f28b82;">$1</span>'
    );
  } else if (langKey === 'css') {
    // Properties in cyan
    highlighted = highlighted.replace(
      /([a-zA-Z-]+)(?=:)/g,
      '<span style="color: #70b8ff;">$1</span>'
    );
    // Values in light green
    highlighted = highlighted.replace(
      /(:[^;]+;)/g,
      '<span style="color: #81c995;">$1</span>'
    );
  } else if (langKey === 'json') {
    highlighted = highlighted.replace(
      /(&quot;[^&]*&quot;)(?=\s*:)/g,
      '<span style="color: #70b8ff;">$1</span>'
    );
    highlighted = highlighted.replace(
      /:\s*(&quot;[^&]*&quot;)/g,
      ': <span style="color: #81c995;">$1</span>'
    );
    highlighted = highlighted.replace(
      /\b(true|false|null)\b/g,
      '<span style="color: #f28b82;">$1</span>'
    );
  }

  return `<div class="lumen-docs-code-container" data-language="${langKey}" contenteditable="false" style="margin: 16px 0; border-radius: 8px; background-color: #1e1f20; border: 1px solid #3c4043; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); overflow: hidden; box-sizing: border-box;"><div class="lumen-docs-code-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; height: 36px; background-color: #282a2c; border-bottom: 1px solid #3c4043; box-sizing: border-box; user-select: none;"><div class="lumen-docs-code-header-left" style="display: flex; align-items: center; gap: 6px;"><span class="lumen-docs-code-lang" style="font-size: 12px; font-weight: 500; color: #c4c7c5; letter-spacing: 0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-transform: lowercase;">${displayLang}</span></div><div class="lumen-docs-code-actions" style="display: flex; align-items: center; gap: 6px;"><button type="button" class="lumen-docs-code-btn lumen-docs-copy-action-btn" data-action="copy" title="Copy code" style="display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; background-color: rgba(255, 255, 255, 0.06); color: #e3e3e3; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 4px; cursor: pointer; font-size: 11.5px; font-weight: 500; font-family: inherit; transition: all 0.15s ease;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg><span class="lumen-docs-btn-text">Copy code</span></button><button type="button" class="lumen-docs-code-btn lumen-docs-delete-action-btn" data-action="delete-snippet" title="Delete code snippet" style="display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; background-color: rgba(255, 255, 255, 0.06); color: #c4c7c5; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 4px; cursor: pointer; font-size: 11.5px; font-weight: 500; font-family: inherit; transition: all 0.15s ease;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg><span class="lumen-docs-btn-text">Delete</span></button></div></div><pre class="lumen-docs-code-pre" contenteditable="true" spellcheck="false" tabindex="0" style="margin: 0; padding: 14px 18px; font-family: 'Roboto Mono', 'Google Sans Code', 'JetBrains Mono', Consolas, Menlo, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #e3e3e3; background-color: #1e1f20; overflow-x: auto; white-space: pre; word-break: normal; tab-size: 2; outline: none; border: none; box-sizing: border-box;"><code>${highlighted}</code></pre></div><p><br></p>`;
}

/**
 * Generates Inline Uploaded Image Figure HTML for Rich Document Card
 */
export function create_doc_inline_image_html({
  file_id = '',
  file_name = 'Uploaded Image',
  view_url = '',
}) {
  const escaped_name = String(file_name || 'Uploaded Image')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const safe_url = String(view_url || '').replace(/"/g, '&quot;');
  const safe_fid = String(file_id || '').replace(/"/g, '&quot;');

  return `<figure class="lumen-docs-image-container" data-file-id="${safe_fid}" data-file-name="${escaped_name}" data-image-src="${safe_url}" contenteditable="false" style="margin: 14px 0; width: 100%; max-width: 100%; display: flex; flex-direction: column; align-items: flex-start;"><div class="lumen-docs-image-wrapper" style="position: relative; width: 100%; max-width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; background-color: #f8fafc;"><img class="lumen-docs-inline-img" src="${safe_url}" alt="${escaped_name}" data-file-id="${safe_fid}" loading="lazy" style="display: block; width: 100%; max-width: 100%; height: auto; max-height: 520px; object-fit: contain; margin: 0;" /><div class="lumen-docs-image-toolbar"><button type="button" class="lumen-docs-image-btn" data-action="resize-doc-image" data-width="35%" title="Small (35% width)">S</button><button type="button" class="lumen-docs-image-btn" data-action="resize-doc-image" data-width="65%" title="Medium (65% width)">M</button><button type="button" class="lumen-docs-image-btn" data-action="resize-doc-image" data-width="100%" title="Full width (100%)">L</button><button type="button" class="lumen-docs-image-btn" data-action="view-doc-image" title="View full screen"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg></button><button type="button" class="lumen-docs-image-btn lumen-docs-image-btn-danger" data-action="delete-doc-image" title="Remove image"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button></div></div><figcaption class="lumen-docs-image-caption" contenteditable="true" spellcheck="true">${escaped_name}</figcaption></figure><p><br></p>`;
}

export const DEFAULT_DOC_TEMPLATE = `<h1>Design System & API Architecture Spec</h1>
<p style="color: #64748b; font-size: 13px;">Pageless Continuous Document · Updated by Elena Rostova · Core Platform Team</p>
<hr/>
<h2>1. Overview & Objectives</h2>
<p>This document specifies the core token contracts, state orchestrators, and headless component patterns for the <strong>Lumen Design System</strong>. In Pageless infinite mode, content flows continuously without artificial page breaks.</p>

<h3>Key Architectural Principles</h3>
<ul>
  <li><strong>Continuous Flow:</strong> Pageless canvas adapts infinitely to content length and code snippets.</li>
  <li><strong>Reactive State:</strong> All mutations synchronize through atomic Signals without layout thrashing.</li>
  <li><strong>Interactive Code:</strong> Code snippets render in Google AI style with one-click copy, download, and toggle.</li>
</ul>

<h2>2. Pinterest Embed Code Snippet</h2>
<p>Below is the verified official Pinterest Pin widget embed snippet (Size L, full width, description removed):</p>

${createGoogleAiCodeSnippetHtml('html', `<a data-pin-do="embedPin" data-pin-width="large"
data-pin-terse="true" href="{url}"></a>
<script async defer src="https://assets.pinterest.com/js/pinit.js"></script>`)}

<h2>3. State Orchestration Handler</h2>
<p>Signal-based board synchronization handler for real-time document streaming:</p>

${createGoogleAiCodeSnippetHtml('javascript', `// Atomic Signal State Orchestrator
export function syncDocumentStream(cardId, payload) {
  const currentCard = getCard(cardId);
  if (!currentCard) return;
  updateCard(cardId, {
    ...payload,
    lastModified: Date.now(),
  }, false);
}`)}

<h2>4. Implementation Notes</h2>
<p>You can insert additional code snippets anywhere in this document inline with the text using the <strong>Code Snippet</strong> button above.</p>`;

const LEGACY_FONT_MAP = {
  inter: 'Inter',
  serif: 'Merriweather',
  mono: 'JetBrains Mono',
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif': 'Inter',
  'Merriweather, Georgia, "Times New Roman", serif': 'Merriweather',
  '"JetBrains Mono", Consolas, Menlo, Monaco, monospace': 'JetBrains Mono',
};

const normalize_doc_font_family_name = (raw_val, fallback_board_font = null) => {
  if (!raw_val || raw_val === 'board_default' || raw_val === 'default') {
    return fallback_board_font && fallback_board_font !== 'default' ? fallback_board_font : 'Inter';
  }
  if (LEGACY_FONT_MAP[raw_val]) {
    return LEGACY_FONT_MAP[raw_val];
  }
  const cleaned = String(raw_val).split(',')[0].replace(/['"]/g, '').trim();
  if (cleaned === '-apple-system' || cleaned === 'BlinkMacSystemFont') return 'Inter';
  return cleaned || 'Inter';
};

const FONT_SIZES = [
  { label: '11 pt', value: '13px' },
  { label: '12 pt', value: '14px' },
  { label: '14 pt', value: '16px' },
  { label: '18 pt', value: '18px' },
  { label: '24 pt', value: '24px' },
];

const TEXT_COLORS = [
  '#0f172a',
  '#1a73e8',
  '#d93025',
  '#188038',
  '#e37400',
  '#9333ea',
  '#64748b',
  '#000000',
];

const HIGHLIGHT_COLORS = [
  'transparent',
  '#fef08a',
  '#bbf7d0',
  '#bae6fd',
  '#fecdd3',
  '#e9d5ff',
];

const CODE_LANGUAGES = [
  'html',
  'javascript',
  'typescript',
  'python',
  'css',
  'json',
  'sql',
  'bash',
];

export default function LUMEN_docs_card({ card }) {
  useSignals();

  const deskRef = useRef(null);
  const modalDeskRef = useRef(null);
  const editorRef = useRef(null);
  const modalEditorRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const savedRangeRef = useRef(null);
  const image_input_ref = useRef(null);

  const [is_fullscreen, set_is_fullscreen] = useState(false);
  const [doc_title, set_doc_title] = useState(card.title || 'Untitled Document');
  const board_default_font = activeBoardSignal.value?.board_setting?.font_family || 'Inter';
  const initial_font_name = normalize_doc_font_family_name(
    card.font_family || card.doc_font,
    board_default_font
  );
  const [font_family, set_font_family] = useState(initial_font_name);
  const [active_cursor_font, set_active_cursor_font] = useState(null);
  const [has_text_selection, set_has_text_selection] = useState(false);
  const [doc_font_search, set_doc_font_search] = useState('');
  const [doc_font_category, set_doc_font_category] = useState('all');
  const [is_doc_font_search_open, set_is_doc_font_search_open] = useState(false);
  const [doc_font_menu_pos, set_doc_font_menu_pos] = useState(null);
  const font_search_wrap_ref = useRef(null);
  const [font_size, set_font_size] = useState(
    card.doc_font_size
      ? String(card.doc_font_size).endsWith('px')
        ? String(card.doc_font_size)
        : `${card.doc_font_size}px`
      : '14px'
  );
  // Default to infinite / pageless mode so text flows continuously without rigid 1-page limits
  const [doc_format, set_doc_format] = useState(card.doc_format || 'infinite');
  const [show_text_colors, set_show_text_colors] = useState(false);
  const [show_highlight_colors, set_show_highlight_colors] = useState(false);
  const [show_code_dropdown, set_show_code_dropdown] = useState(false);
  const [show_code_modal, set_show_code_modal] = useState(false);
  const [is_uploading_image, set_is_uploading_image] = useState(false);
  const [is_drag_over_editor, set_is_drag_over_editor] = useState(false);

  // Custom code modal state
  const [code_lang, set_code_lang] = useState('html');
  const [code_content, set_code_content] = useState('<a data-pin-do="embedPin" data-pin-width="large"\ndata-pin-terse="true" href="{url}"></a>\n<script async defer src="https://assets.pinterest.com/js/pinit.js"></script>');

  // Document Stats
  const [stats, set_stats] = useState(() => {
    const raw = card.content || DEFAULT_DOC_TEMPLATE;
    const clean = (typeof raw === 'string' ? raw.replace(/<[^>]+>/g, ' ') : '').trim();
    return {
      words: clean ? clean.split(/\s+/).length : 0,
      chars: clean.length,
      paragraphs: clean ? clean.split(/\n+/).filter(Boolean).length : 0,
    };
  });

  const calculate_stats = useCallback((text = '') => {
    const clean = text.trim();
    const words = clean ? clean.split(/\s+/).length : 0;
    const chars = clean.length;
    const paragraphs = clean ? clean.split(/\n+/).filter(Boolean).length : 0;
    set_stats((prev) => {
      if (prev.words === words && prev.chars === chars) return prev;
      return { words, chars, paragraphs };
    });
  }, []);

  // Load full 1,600+ Free Commercial Google Fonts catalog on mount
  useEffect(() => {
    ensure_all_google_fonts_loaded();
  }, []);

  // Sync title, format, and Google Font from card / board props
  useEffect(() => {
    if (card.title) set_doc_title(card.title);
    if (card.doc_format) set_doc_format(card.doc_format);
  }, [card.title, card.doc_format]);

  useEffect(() => {
    const resolved_name = normalize_doc_font_family_name(
      card.font_family || card.doc_font,
      activeBoardSignal.value?.board_setting?.font_family
    );
    if (resolved_name) {
      load_google_font(resolved_name);
      set_font_family(resolved_name);
    }
  }, [card.font_family, card.doc_font, activeBoardSignal.value?.board_setting?.font_family]);

  useEffect(() => {
    if (card.doc_font_size) {
      const normalized_size = String(card.doc_font_size).endsWith('px')
        ? String(card.doc_font_size)
        : `${card.doc_font_size}px`;
      set_font_size(normalized_size);
    }
  }, [card.doc_font_size]);

  const displayed_toolbar_font = active_cursor_font || font_family;

  const resolved_editor_font_stack =
    get_google_font_css_stack(font_family) ||
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const resolved_toolbar_font_stack =
    get_google_font_css_stack(displayed_toolbar_font) || resolved_editor_font_stack;

  // Preload any inline Google Fonts present in saved rich document HTML
  const preload_inline_fonts_in_editor = useCallback(
    (editor_el) => {
      if (!editor_el) return;
      const font_nodes = editor_el.querySelectorAll(
        '[data-lumen-font], font[face], [style*="font-family"]'
      );
      font_nodes.forEach((node) => {
        const raw_font =
          node.getAttribute('data-lumen-font') ||
          node.getAttribute('face') ||
          node.style?.fontFamily;
        if (raw_font && !raw_font.includes('__LUMEN_MULTI_FONT__')) {
          const clean = normalize_doc_font_family_name(raw_font, board_default_font);
          if (clean) load_google_font(clean);
        }
      });
    },
    [board_default_font]
  );

  // Detect the inline font family at the current cursor or selection inside the editor
  const detect_font_at_range = useCallback(
    (range, active_editor) => {
      if (!range || !active_editor) return null;
      let node = range.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      while (node && node !== active_editor && active_editor.contains(node)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const attr_font =
            node.getAttribute('data-lumen-font') ||
            node.getAttribute('face') ||
            node.style?.fontFamily;
          if (attr_font && !attr_font.includes('__LUMEN_MULTI_FONT__')) {
            return normalize_doc_font_family_name(attr_font, font_family);
          }
        }
        node = node.parentElement;
      }
      return null;
    },
    [font_family]
  );

  const handle_select_doc_google_font = (chosen_family, apply_mode = 'auto') => {
    const clean_family = normalize_doc_font_family_name(chosen_family, board_default_font);
    load_google_font(clean_family);
    const css_stack =
      get_google_font_css_stack(clean_family) || `"${clean_family}", sans-serif`;

    const active_editor = is_fullscreen ? modalEditorRef.current : editorRef.current;
    const saved_range = savedRangeRef.current;
    const has_valid_range_in_editor =
      active_editor &&
      saved_range &&
      active_editor.contains(saved_range.commonAncestorContainer);

    // 1. If user highlighted text (or explicitly chose selection/cursor mode) and not forcing whole-doc base font
    if (apply_mode !== 'document' && has_valid_range_in_editor && !saved_range.collapsed) {
      active_editor.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(saved_range);
      }

      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontName', false, '__LUMEN_MULTI_FONT__');

      const matched_nodes = active_editor.querySelectorAll(
        'font[face="__LUMEN_MULTI_FONT__"], [style*="__LUMEN_MULTI_FONT__"]'
      );
      matched_nodes.forEach((el) => {
        el.removeAttribute('face');
        el.setAttribute('data-lumen-font', clean_family);
        el.style.fontFamily = css_stack;

        // Also update any nested inline font overrides inside the highlighted selection
        const nested_font_children = el.querySelectorAll(
          '[data-lumen-font], font[face], [style*="font-family"]'
        );
        nested_font_children.forEach((child) => {
          child.removeAttribute('face');
          child.setAttribute('data-lumen-font', clean_family);
          child.style.fontFamily = css_stack;
        });
      });

      const updated_sel = window.getSelection();
      if (updated_sel && updated_sel.rangeCount > 0) {
        savedRangeRef.current = updated_sel.getRangeAt(0).cloneRange();
      }

      set_active_cursor_font(clean_family);
      handleEditorInput(is_fullscreen);
      set_doc_font_search('');
      set_is_doc_font_search_open(false);
      showToast(`Applied "${clean_family}" to selected text`);
      return;
    }

    // 2. If cursor is collapsed inside editor and user picks a font (and not forcing whole-document default)
    if (apply_mode !== 'document' && has_valid_range_in_editor && saved_range.collapsed) {
      active_editor.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(saved_range);

        // If cursor is inside an empty zero-width font span, just update that span's font
        const parent_el =
          saved_range.startContainer.nodeType === Node.TEXT_NODE
            ? saved_range.startContainer.parentElement
            : saved_range.startContainer;
        if (
          parent_el &&
          parent_el !== active_editor &&
          parent_el.getAttribute?.('data-lumen-font') &&
          parent_el.textContent === '\u200B'
        ) {
          parent_el.setAttribute('data-lumen-font', clean_family);
          parent_el.style.fontFamily = css_stack;
        } else {
          const span = document.createElement('span');
          span.setAttribute('data-lumen-font', clean_family);
          span.style.fontFamily = css_stack;
          span.textContent = '\u200B';
          saved_range.insertNode(span);

          const next_range = document.createRange();
          next_range.setStart(span.firstChild, 1);
          next_range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(next_range);
          savedRangeRef.current = next_range.cloneRange();
        }
      }

      set_active_cursor_font(clean_family);
      handleEditorInput(is_fullscreen);
      set_doc_font_search('');
      set_is_doc_font_search_open(false);
      showToast(`Switched typing font to "${clean_family}"`);
      return;
    }

    // 3. Otherwise (or when apply_mode === 'document'), update the document's base default font
    set_font_family(clean_family);
    set_active_cursor_font(clean_family);
    updateCard(card.id, { font_family: clean_family, doc_font: clean_family }, true);
    saveCurrentBoardToStore();
    set_doc_font_search('');
    set_is_doc_font_search_open(false);
    showToast(`Document base Google Font set to "${clean_family}"`);
  };

  // Initial & Remote Content Load - updates editor DOM when card.id or remote card.content changes (without wiping caret during active local typing)
  useEffect(() => {
    const rawContent = card.content !== undefined && card.content !== null ? card.content : DEFAULT_DOC_TEMPLATE;
    if (editorRef.current) {
      const is_editor_focused = typeof document !== 'undefined' && document.activeElement === editorRef.current;
      const is_empty = !editorRef.current.innerHTML || editorRef.current.innerHTML.trim() === '';
      if ((is_empty || !is_editor_focused) && editorRef.current.innerHTML !== rawContent) {
        editorRef.current.innerHTML = rawContent;
        calculate_stats(editorRef.current.innerText || '');
        preload_inline_fonts_in_editor(editorRef.current);
      }
    }
  }, [card.id, card.content, calculate_stats, preload_inline_fonts_in_editor]);

  // Sync to Modal Editor when Fullscreen opens or remote content updates
  useEffect(() => {
    if (is_fullscreen && modalEditorRef.current) {
      const is_modal_focused = typeof document !== 'undefined' && document.activeElement === modalEditorRef.current;
      const activeHTML = card.content !== undefined && card.content !== null
        ? card.content
        : (editorRef.current ? editorRef.current.innerHTML : DEFAULT_DOC_TEMPLATE);
      if (!is_modal_focused && modalEditorRef.current.innerHTML !== activeHTML) {
        modalEditorRef.current.innerHTML = activeHTML;
        calculate_stats(modalEditorRef.current.innerText || '');
        preload_inline_fonts_in_editor(modalEditorRef.current);
      }
    }
  }, [is_fullscreen, card.content, calculate_stats, preload_inline_fonts_in_editor]);

  // Listen for fullscreen event triggered from Card header quick button or Property panel
  useEffect(() => {
    const handleFullscreenEvent = () => set_is_fullscreen(true);
    const eventName = `lumen-docs-fullscreen-${card.id}`;
    window.addEventListener(eventName, handleFullscreenEvent);
    return () => window.removeEventListener(eventName, handleFullscreenEvent);
  }, [card.id]);

  // Listen for deleted file purge from User Storage List so inline images are removed cleanly
  useEffect(() => {
    const handle_purge_file = (e) => {
      const target_file_id = e.detail?.file_id;
      if (!target_file_id) return;
      let did_remove = false;
      [editorRef.current, modalEditorRef.current].forEach((ed) => {
        if (!ed) return;
        const figures = ed.querySelectorAll(`[data-file-id="${target_file_id}"]`);
        figures.forEach((el) => {
          const container = el.closest('.lumen-docs-image-container') || el;
          container.remove();
          did_remove = true;
        });
      });
      if (did_remove && editorRef.current) {
        const html = editorRef.current.innerHTML;
        const plainText = editorRef.current.innerText || '';
        calculate_stats(plainText);
        updateCard(card.id, { content: html, plainText }, false);
      }
    };
    window.addEventListener('lumen-docs-purge-file', handle_purge_file);
    return () => window.removeEventListener('lumen-docs-purge-file', handle_purge_file);
  }, [card.id, calculate_stats]);

  // Escape key listener for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (show_code_modal) {
          set_show_code_modal(false);
        } else if (show_code_dropdown) {
          set_show_code_dropdown(false);
        } else if (is_fullscreen) {
          set_is_fullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [is_fullscreen, show_code_modal, show_code_dropdown]);

  // Continuous selection tracking on document level so savedRangeRef and active cursor font are always accurate
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
      if (activeEditor && activeEditor.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        set_has_text_selection(!range.collapsed && range.toString().trim().length > 0);
        const detected = detect_font_at_range(range, activeEditor);
        set_active_cursor_font(detected);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [is_fullscreen, detect_font_at_range]);

  // Save selection range directly
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
      if (activeEditor && activeEditor.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        set_has_text_selection(!range.collapsed && range.toString().trim().length > 0);
        const detected = detect_font_at_range(range, activeEditor);
        set_active_cursor_font(detected);
      }
    }
  };

  // Handle Input Changes with Debounced Save
  const handleEditorInput = (isModal = false) => {
    const activeElem = isModal ? modalEditorRef.current : editorRef.current;
    if (!activeElem) return;

    const html = activeElem.innerHTML;
    const plainText = activeElem.innerText || '';
    calculate_stats(plainText);

    // Sync between editors if both mounted
    if (isModal && editorRef.current) {
      editorRef.current.innerHTML = html;
    } else if (!isModal && modalEditorRef.current) {
      modalEditorRef.current.innerHTML = html;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateCard(card.id, {
        content: html,
        plainText,
        wordCount: plainText ? plainText.trim().split(/\s+/).length : 0,
        doc_format,
      }, false);
    }, 400);
  };

  // Toggle format between infinite (default) and paginated pages
  const handleToggleFormat = (nextFormat) => {
    set_doc_format(nextFormat);
    updateCard(card.id, { doc_format: nextFormat }, false);
    saveCurrentBoardToStore();
    showToast(nextFormat === 'infinite' ? 'Switched to Pageless Infinite scroll' : 'Switched to Paginated Pages view');
  };

  // Delegate Actions for Code Blocks: Copy & Delete
  const handleEditorClick = (e) => {
    // 1. Copy Action (Google AI style with green Copied! state)
    const copyBtn = e.target.closest('[data-action="copy"]');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = copyBtn.closest('.lumen-docs-code-container');
      const codeElem = container?.querySelector('pre code') || container?.querySelector('pre');
      const text = codeElem?.innerText || '';
      navigator.clipboard.writeText(text);

      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#81c995" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><polyline points="20 6 9 17 4 12"></polyline></svg><span class="lumen-docs-btn-text" style="color: #81c995; font-weight: 500;">Copied!</span>`;
      setTimeout(() => {
        if (copyBtn) copyBtn.innerHTML = originalHtml;
      }, 2000);

      showToast('Code snippet copied to clipboard!');
      return;
    }

    // 2. Delete Code Snippet Action
    const deleteBtn = e.target.closest('[data-action="delete-snippet"]');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = deleteBtn.closest('.lumen-docs-code-container');
      if (container) {
        const prevSibling = container.previousElementSibling;
        const nextSibling = container.nextElementSibling;
        const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
        const parent = container.parentNode || activeEditor;
        container.remove();

        let targetElem = prevSibling;
        if (!targetElem) {
          const newP = document.createElement('p');
          newP.innerHTML = '<br>';
          if (nextSibling && parent?.contains(nextSibling)) {
            parent.insertBefore(newP, nextSibling);
          } else if (activeEditor) {
            activeEditor.insertBefore(newP, activeEditor.firstChild);
          }
          targetElem = newP;
        }

        if (targetElem) {
          const sel = window.getSelection();
          const nextRange = document.createRange();
          nextRange.selectNodeContents(targetElem);
          nextRange.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();
          targetElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        handleEditorInput(is_fullscreen);
        showToast('Code snippet removed');
      }
      return;
    }

    // 3. Resize Inline Document Image Action
    const resizeImgBtn = e.target.closest('[data-action="resize-doc-image"]');
    if (resizeImgBtn) {
      e.preventDefault();
      e.stopPropagation();
      const targetWidth = resizeImgBtn.getAttribute('data-width') || '100%';
      const container = resizeImgBtn.closest('.lumen-docs-image-container');
      const wrapper = resizeImgBtn.closest('.lumen-docs-image-wrapper');
      if (container && wrapper) {
        wrapper.style.width = targetWidth;
        handleEditorInput(is_fullscreen);
        saveCurrentBoardToStore();
        showToast(`Image resized to ${targetWidth}`);
      }
      return;
    }

    // 4. View Inline Document Image in Fullscreen Lightbox
    const viewImgBtn = e.target.closest('[data-action="view-doc-image"]');
    const clickedImg = e.target.closest('.lumen-docs-inline-img');
    if (viewImgBtn || clickedImg) {
      e.preventDefault();
      e.stopPropagation();
      const container = (viewImgBtn || clickedImg).closest('.lumen-docs-image-container');
      const imgElem = container?.querySelector('.lumen-docs-inline-img') || clickedImg;
      const captionElem = container?.querySelector('.lumen-docs-image-caption');
      const src = imgElem?.getAttribute('src') || container?.getAttribute('data-image-src') || '';
      const fileName =
        captionElem?.innerText?.trim() ||
        container?.getAttribute('data-file-name') ||
        imgElem?.getAttribute('alt') ||
        doc_title;
      const fileId = container?.getAttribute('data-file-id') || 'doc_img';
      if (src) {
        openImageViewer({
          cardId: card.id,
          title: fileName,
          slides: [{ id: fileId, url: src, caption: fileName }],
          activeIndex: 0,
        });
      }
      return;
    }

    // 5. Delete Inline Document Image Action
    const deleteImgBtn = e.target.closest('[data-action="delete-doc-image"]');
    if (deleteImgBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = deleteImgBtn.closest('.lumen-docs-image-container');
      if (container) {
        const file_id = container.getAttribute('data-file-id') || '';
        const file_name = container.getAttribute('data-file-name') || '';
        const prevSibling = container.previousElementSibling;
        const nextSibling = container.nextElementSibling;
        const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
        const parent = container.parentNode || activeEditor;
        container.remove();

        let targetElem = prevSibling;
        if (!targetElem) {
          const newP = document.createElement('p');
          newP.innerHTML = '<br>';
          if (nextSibling && parent?.contains(nextSibling)) {
            parent.insertBefore(newP, nextSibling);
          } else if (activeEditor) {
            activeEditor.insertBefore(newP, activeEditor.firstChild);
          }
          targetElem = newP;
        }

        if (targetElem) {
          const sel = window.getSelection();
          const nextRange = document.createRange();
          nextRange.selectNodeContents(targetElem);
          nextRange.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();
        }

        handleEditorInput(is_fullscreen);
        saveCurrentBoardToStore({ immediate: true });
        showToast('Image removed from document');

        if (file_id) {
          const current_board = activeBoardSignal.value;
          const current_board_id = current_board?.id || current_board?.board_code || '';
          const active_html = activeEditor ? activeEditor.innerHTML : '';
          const still_in_this_doc = active_html.includes(file_id);
          const still_in_other_cards = (current_board?.cards || []).some(
            (c) => c.id !== card.id && JSON.stringify(c).includes(file_id)
          );
          if (!still_in_this_doc && !still_in_other_cards) {
            delete_storage_file_for_board_item(file_id, file_name, current_board_id).catch(() => {});
          }
        }
      }
      return;
    }
  };

  // Keyboard navigation & Deterministic Enter downwards flow:
  // Intercepts Enter to split current block cleanly, append a paragraph below, and advance caret DOWN
  // Guaranteed NEVER to jump back to the top of the page!
  const handleEditorKeyDown = (e) => {
    // 1. Tab key inside code block
    if (e.key === 'Tab') {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const pre = node?.parentElement?.closest('.lumen-docs-code-pre') || (node?.classList?.contains('lumen-docs-code-pre') ? node : null);
      if (pre) {
        e.preventDefault();
        e.stopPropagation();
        document.execCommand('insertText', false, '  ');
        return;
      }
    }

    // 2. Prevent Canvas global shortcuts (Cmd+A, Cmd+D) from hijacking document editing
    if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      e.stopPropagation();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        const elem = node?.nodeType === 3 ? node.parentElement : node;
        const pre = elem?.closest('.lumen-docs-code-pre');
        if (pre) {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(pre);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
      }
    }

    if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
      e.stopPropagation();
    }

    // 3. Backspace & Delete handling:
    // ALWAYS stop propagation so Backspace or Delete inside the doc card NEVER reaches Canvas to delete the card!
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.stopPropagation();

      const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
      const sel = window.getSelection();

      if (sel && sel.rangeCount > 0 && activeEditor) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const elem = node?.nodeType === 3 ? node.parentElement : node;
        const pre = elem?.closest('.lumen-docs-code-pre') || (elem?.classList?.contains('lumen-docs-code-pre') ? elem : null);
        const codeContainer = elem?.closest('.lumen-docs-code-container') || pre?.closest('.lumen-docs-code-container');

        // Handling inside code snippet block
        if (pre && codeContainer) {
          const rawCode = (pre.textContent || '').replace(/\u200B/g, '');
          const isEntireSnippetEmpty = rawCode.trim().length === 0;

          // Check if selection spans the entire code text
          let isAllSelected = false;
          if (!range.collapsed) {
            const selectedText = range.toString().replace(/\u200B/g, '');
            if (selectedText.length > 0 && selectedText.length >= rawCode.length) {
              isAllSelected = true;
            }
          }

          // Check if caret is at the start (offset 0) of the code snippet
          let isAtStart = false;
          if (range.collapsed) {
            try {
              const testRange = document.createRange();
              testRange.selectNodeContents(pre);
              testRange.setEnd(range.startContainer, range.startOffset);
              isAtStart = testRange.toString().length === 0;
            } catch (err) {
              isAtStart = false;
            }
          }

          // Case A: Code snippet is empty, OR all code was selected and Backspace/Delete pressed
          if (isEntireSnippetEmpty || isAllSelected) {
            e.preventDefault();
            const prevSibling = codeContainer.previousElementSibling;
            const nextSibling = codeContainer.nextElementSibling;
            const parent = codeContainer.parentNode || activeEditor;
            codeContainer.remove();

            let targetElem = prevSibling;
            if (!targetElem) {
              const newP = document.createElement('p');
              newP.innerHTML = '<br>';
              if (nextSibling && parent?.contains(nextSibling)) {
                parent.insertBefore(newP, nextSibling);
              } else if (activeEditor) {
                activeEditor.insertBefore(newP, activeEditor.firstChild);
              }
              targetElem = newP;
            }

            if (targetElem) {
              const nextRange = document.createRange();
              nextRange.selectNodeContents(targetElem);
              nextRange.collapse(false);
              sel.removeAllRanges();
              sel.addRange(nextRange);
              savedRangeRef.current = nextRange.cloneRange();
              targetElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            handleEditorInput(is_fullscreen);
            showToast('Code snippet removed');
            return;
          }

          // Case B: Snippet has code, caret is at offset 0 (start), user presses Backspace
          // Move caret to previous sibling block smoothly instead of letting focus escape or selecting container!
          if (e.key === 'Backspace' && range.collapsed && isAtStart) {
            e.preventDefault();
            const prevSibling = codeContainer.previousElementSibling;
            const parent = codeContainer.parentNode || activeEditor;

            let targetElem = prevSibling;
            if (!targetElem) {
              const newP = document.createElement('p');
              newP.innerHTML = '<br>';
              if (parent) {
                parent.insertBefore(newP, codeContainer);
              }
              targetElem = newP;
            }

            if (targetElem) {
              const nextRange = document.createRange();
              nextRange.selectNodeContents(targetElem);
              nextRange.collapse(false);
              sel.removeAllRanges();
              sel.addRange(nextRange);
              savedRangeRef.current = nextRange.cloneRange();
              targetElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
          }

          // Case C: Normal deletion inside snippet. Browser performs standard backspace, event propagation is stopped!
          return;
        }

        // Case D: A code container itself is selected (e.g. by click or browser selection)
        const container = elem?.closest('.lumen-docs-code-container');
        if (container) {
          e.preventDefault();
          const prevSibling = container.previousElementSibling;
          const nextSibling = container.nextElementSibling;
          const parent = container.parentNode || activeEditor;
          container.remove();

          let targetElem = prevSibling;
          if (!targetElem) {
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            if (nextSibling && parent?.contains(nextSibling)) {
              parent.insertBefore(newP, nextSibling);
            } else if (activeEditor) {
              activeEditor.appendChild(newP);
            }
            targetElem = newP;
          }

          if (targetElem) {
            const nextRange = document.createRange();
            nextRange.selectNodeContents(targetElem);
            nextRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(nextRange);
            savedRangeRef.current = nextRange.cloneRange();
          }

          handleEditorInput(is_fullscreen);
          showToast('Code snippet removed');
          return;
        }
      }
    }

    // 4. Enter key handling:
    // When user presses Enter (especially without typing any content), deterministically create a paragraph below
    // and move cursor DOWN continuously, preventing the browser's 0,0 scroll bug that jumps to the top!
    if (e.key === 'Enter' && !e.shiftKey) {
      e.stopPropagation();
      const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
      if (!activeEditor) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // If user is inside code snippet pre block, insert newline \n inside pre
      const node = range.anchorNode;
      const pre = node?.parentElement?.closest('.lumen-docs-code-pre') || (node?.classList?.contains('lumen-docs-code-pre') ? node : null);
      if (pre) {
        e.preventDefault();
        e.stopPropagation();
        document.execCommand('insertText', false, '\n');
        return;
      }

      // Check if cursor is inside activeEditor
      if (activeEditor.contains(range.commonAncestorContainer)) {
        e.preventDefault();

        // Find nearest top-level block inside activeEditor
        let block = range.startContainer;
        while (block && block.parentNode !== activeEditor && block !== activeEditor) {
          block = block.parentNode;
        }

        if (!block || block === activeEditor) {
          // Cursor was directly on editor root
          const newP = document.createElement('p');
          newP.innerHTML = '<br>';
          activeEditor.appendChild(newP);

          const nextRange = document.createRange();
          nextRange.setStart(newP, 0);
          nextRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();

          setTimeout(() => {
            newP.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 10);

          handleEditorInput(is_fullscreen);
          return;
        }

        // If block is a code snippet or image container, insert paragraph right after it
        if (
          block.classList?.contains('lumen-docs-code-container') ||
          block.classList?.contains('lumen-docs-image-container')
        ) {
          const newP = document.createElement('p');
          newP.innerHTML = '<br>';
          block.parentNode.insertBefore(newP, block.nextSibling);

          const nextRange = document.createRange();
          nextRange.setStart(newP, 0);
          nextRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();

          setTimeout(() => {
            newP.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 10);

          handleEditorInput(is_fullscreen);
          return;
        }

        // Split current block at range
        const afterRange = document.createRange();
        afterRange.setStart(range.endContainer, range.endOffset);
        afterRange.setEndAfter(block.lastChild || block);
        const afterContent = afterRange.extractContents();

        const newP = document.createElement('p');
        if (afterContent && afterContent.textContent && afterContent.textContent.length > 0) {
          newP.appendChild(afterContent);
        } else {
          newP.innerHTML = '<br>';
        }

        // Ensure current block still has content so it doesn't collapse
        if (!block.innerHTML || block.innerHTML.trim() === '') {
          block.innerHTML = '<br>';
        }

        // Insert newP immediately after current block
        block.parentNode.insertBefore(newP, block.nextSibling);

        // Move caret cleanly to the start of newP
        const nextRange = document.createRange();
        nextRange.setStart(newP, 0);
        nextRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();

        // Continuously scroll downwards!
        setTimeout(() => {
          newP.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 10);

        handleEditorInput(is_fullscreen);
      }
    }
  };

  // Click on background desk or sheet focuses the end of the document
  const handleDeskClick = (e) => {
    const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
    if (!activeEditor) return;

    if (
      e.target === deskRef.current ||
      e.target === modalDeskRef.current ||
      e.target.classList?.contains(styles['lumen-docs-sheet']) ||
      e.target.classList?.contains(styles['lumen-docs-modal-sheet'])
    ) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(activeEditor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      activeEditor.focus();
    }
  };

  // Formatting Execution
  const formatDoc = (command, value = null) => {
    document.execCommand(command, false, value);
    const activeElem = is_fullscreen ? modalEditorRef.current : editorRef.current;
    if (activeElem) {
      handleEditorInput(is_fullscreen);
      activeElem.focus();
    }
  };

  /**
   * Inserts Google AI Code Snippet INLINE with text at current cursor position
   * Deterministically splits or appends at the active block, ensuring page flow goes DOWN continuously
   * and NEVER jumps back to the top/start of the page!
   */
  const insertSnippetAtCursor = (lang = 'html', codeText = '') => {
    const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
    const activeDesk = is_fullscreen ? modalDeskRef.current : deskRef.current;
    if (!activeEditor) return;

    // DO NOT call activeEditor.focus() before reading range!
    // In Chromium, focusing without a set range resets selection to index 0 (top/start)!
    const sel = window.getSelection();
    let range = null;

    // 1. Check live selection inside activeEditor
    if (sel && sel.rangeCount > 0) {
      const liveRange = sel.getRangeAt(0);
      if (activeEditor.contains(liveRange.commonAncestorContainer)) {
        range = liveRange;
      }
    }

    // 2. Check savedRangeRef inside activeEditor
    if (!range && savedRangeRef.current && activeEditor.contains(savedRangeRef.current.commonAncestorContainer)) {
      range = savedRangeRef.current;
    }

    // 3. Fallback: Position at the END of document content (NEVER the start!)
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(activeEditor);
      range.collapse(false); // Collapsed to END of document
    }

    // Now safely attach range to selection
    sel.removeAllRanges();
    sel.addRange(range);

    // Default starter codes if empty
    let finalCode = codeText;
    if (!finalCode) {
      if (lang === 'html') {
        finalCode = `<a data-pin-do="embedPin" data-pin-width="large"\ndata-pin-terse="true" href="{url}"></a>\n<script async defer src="https://assets.pinterest.com/js/pinit.js"></script>`;
      } else if (lang === 'javascript' || lang === 'typescript') {
        finalCode = `// State Orchestration Handler\nexport function updateBoardState(payload) {\n  const nextState = { ...payload, timestamp: Date.now() };\n  return nextState;\n}`;
      } else if (lang === 'python') {
        finalCode = `def process_canvas_nodes(nodes):\n    """Filters and aggregates reactive board nodes."""\n    return [node for node in nodes if node.get("visible", True)]`;
      } else if (lang === 'css') {
        finalCode = `.lumen-canvas-element {\n  display: flex;\n  border-radius: 12px;\n  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);\n}`;
      } else if (lang === 'json') {
        finalCode = `{\n  "version": "2.4.0",\n  "format": "pageless_infinite",\n  "status": "synchronized"\n}`;
      } else {
        finalCode = `// Write or paste code snippet here...`;
      }
    }

    const snippetHtml = createGoogleAiCodeSnippetHtml(lang, finalCode);

    // Create DOM element from HTML
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = snippetHtml;
    const codeBlock = tempContainer.querySelector('.lumen-docs-code-container');
    const trailingP = document.createElement('p');
    trailingP.innerHTML = '<br>';

    // Find nearest top-level block parent inside activeEditor
    let blockParent = range.startContainer;
    while (blockParent && blockParent.parentNode !== activeEditor && blockParent !== activeEditor) {
      blockParent = blockParent.parentNode;
    }

    if (blockParent && blockParent !== activeEditor && activeEditor.contains(blockParent)) {
      // Split the current block at cursor position
      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEndAfter(blockParent.lastChild || blockParent);
      const afterContent = afterRange.extractContents();

      // Insert code block right after current blockParent in the flow
      blockParent.parentNode.insertBefore(codeBlock, blockParent.nextSibling);

      // Create new trailing paragraph below the code block
      const newP = document.createElement('p');
      if (afterContent && afterContent.textContent.trim().length > 0) {
        newP.appendChild(afterContent);
      } else {
        newP.innerHTML = '<br>';
      }
      codeBlock.parentNode.insertBefore(newP, codeBlock.nextSibling);

      // Move cursor into the new paragraph below code snippet
      const nextRange = document.createRange();
      nextRange.setStart(newP, 0);
      nextRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();

      // Scroll smoothly down to the new position continuously!
      setTimeout(() => {
        newP.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    } else {
      // Direct insertion at range or end
      range.deleteContents();
      range.insertNode(trailingP);
      range.insertNode(codeBlock);

      const nextRange = document.createRange();
      nextRange.setStart(trailingP, 0);
      nextRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();

      setTimeout(() => {
        trailingP.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }

    handleEditorInput(is_fullscreen);
    saveCurrentBoardToStore();
    showToast(`Inserted ${lang} code snippet inline!`);
  };

  /**
   * Inserts an uploaded image block INLINE at the current cursor position
   */
  const insert_image_at_cursor = ({ file_id, file_name, view_url, file_size }) => {
    const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
    if (!activeEditor) return;

    const sel = window.getSelection();
    let range = null;

    if (sel && sel.rangeCount > 0) {
      const liveRange = sel.getRangeAt(0);
      if (activeEditor.contains(liveRange.commonAncestorContainer)) {
        range = liveRange;
      }
    }

    if (!range && savedRangeRef.current && activeEditor.contains(savedRangeRef.current.commonAncestorContainer)) {
      range = savedRangeRef.current;
    }

    if (!range) {
      range = document.createRange();
      range.selectNodeContents(activeEditor);
      range.collapse(false);
    }

    sel?.removeAllRanges();
    sel?.addRange(range);

    const img_html = create_doc_inline_image_html({
      file_id,
      file_name,
      view_url,
      file_size,
    });

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = img_html;
    const figureBlock = tempContainer.querySelector('.lumen-docs-image-container');
    const trailingP = document.createElement('p');
    trailingP.innerHTML = '<br>';

    let blockParent = range.startContainer;
    while (blockParent && blockParent.parentNode !== activeEditor && blockParent !== activeEditor) {
      blockParent = blockParent.parentNode;
    }

    if (blockParent && blockParent !== activeEditor && activeEditor.contains(blockParent)) {
      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEndAfter(blockParent.lastChild || blockParent);
      const afterContent = afterRange.extractContents();

      blockParent.parentNode.insertBefore(figureBlock, blockParent.nextSibling);

      const newP = document.createElement('p');
      if (afterContent && afterContent.textContent.trim().length > 0) {
        newP.appendChild(afterContent);
      } else {
        newP.innerHTML = '<br>';
      }
      figureBlock.parentNode.insertBefore(newP, figureBlock.nextSibling);

      const nextRange = document.createRange();
      nextRange.setStart(newP, 0);
      nextRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();

      setTimeout(() => {
        figureBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    } else {
      range.deleteContents();
      range.insertNode(trailingP);
      range.insertNode(figureBlock);

      const nextRange = document.createRange();
      nextRange.setStart(trailingP, 0);
      nextRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();

      setTimeout(() => {
        figureBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }

    const html = activeEditor.innerHTML;
    const plainText = activeEditor.innerText || '';
    calculate_stats(plainText);

    if (is_fullscreen && editorRef.current) {
      editorRef.current.innerHTML = html;
    } else if (!is_fullscreen && modalEditorRef.current) {
      modalEditorRef.current.innerHTML = html;
    }

    const existing_doc_images = Array.isArray(card.doc_images) ? card.doc_images : [];
    const next_doc_images = file_id
      ? [
          ...existing_doc_images.filter((item) => item && item.file_id !== file_id),
          {
            file_id,
            file_name,
            view_url,
            file_size: file_size || 0,
            uploaded_at: Date.now(),
          },
        ]
      : existing_doc_images;

    updateCard(
      card.id,
      {
        content: html,
        plainText,
        wordCount: plainText ? plainText.trim().split(/\s+/).length : 0,
        doc_format,
        doc_images: next_doc_images,
      },
      true
    );
    saveCurrentBoardToStore({ immediate: true });
  };

  /**
   * Uploads one or more image files to /api/files/upload (so they appear in User Storage List)
   * and inserts each image inline into the Rich Document at the cursor position.
   */
  const handle_upload_and_insert_images = async (file_list) => {
    const files = Array.from(file_list || []).filter(
      (f) => f && (f.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name || ''))
    );
    if (files.length === 0) {
      showToast('Please select a valid image file (PNG, JPG, GIF, WebP, SVG)');
      return;
    }

    set_is_uploading_image(true);
    const current_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code;

    for (const file of files) {
      try {
        const base64_data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });

        const clean_file_name = file.name || `doc_image_${Date.now()}.png`;
        const mime_type = file.type || 'image/png';

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...get_lumen_auth_headers(),
          },
          body: JSON.stringify({
            fileName: clean_file_name,
            fileType: mime_type,
            fileSize: file.size || 0,
            fileData: base64_data,
            boardId: current_board_id,
            board_id: current_board_id,
            cardId: card.id,
            card_id: card.id,
          }),
        });

        if (response.status === 413) {
          const err_data = await response.json().catch(() => ({}));
          showToast(err_data.message || 'Storage quota limit exceeded for board owner');
          continue;
        }

        if (!response.ok) {
          throw new Error('Image upload failed');
        }

        const res_data = await response.json();
        const resolved_file_code = res_data.file_storage_code || res_data.fileId || '';
        insert_image_at_cursor({
          file_id: resolved_file_code,
          file_storage_code: resolved_file_code,
          file_name: res_data.fileName || clean_file_name,
          view_url: res_data.viewUrl || res_data.fileUrl || base64_data,
          file_size: res_data.fileSize || file.size || 0,
        });
        showToast(`Uploaded & inserted "${clean_file_name}"`);
      } catch (err) {
        console.error('[Lumen Docs] Image upload error:', err);
        showToast(`Failed to upload "${file.name || 'image'}"`);
      }
    }

    set_is_uploading_image(false);
    if (image_input_ref.current) {
      image_input_ref.current.value = '';
    }
  };

  const trigger_image_upload_dialog = () => {
    saveSelection();
    if (image_input_ref.current) {
      image_input_ref.current.click();
    }
  };

  const handle_editor_paste = (e) => {
    const clipboard_files = Array.from(e.clipboardData?.files || []);
    const image_files = clipboard_files.filter(
      (f) => f.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name || '')
    );
    if (image_files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      saveSelection();
      handle_upload_and_insert_images(image_files);
    }
  };

  // Ensure drag-over blue highlight is always cleared on any window drop or dragend
  useEffect(() => {
    const clear_editor_drag = () => {
      set_is_drag_over_editor((prev) => (prev ? false : prev));
    };
    window.addEventListener('drop', clear_editor_drag, true);
    window.addEventListener('drop', clear_editor_drag, false);
    window.addEventListener('dragend', clear_editor_drag, true);
    return () => {
      window.removeEventListener('drop', clear_editor_drag, true);
      window.removeEventListener('drop', clear_editor_drag, false);
      window.removeEventListener('dragend', clear_editor_drag, true);
    };
  }, []);

  const handle_editor_drag_over = (e) => {
    if (Array.from(e.dataTransfer?.types || []).includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!is_drag_over_editor) {
        set_is_drag_over_editor(true);
      }
    }
  };

  const handle_editor_drag_leave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget instanceof Node && e.currentTarget?.contains(e.relatedTarget)) {
      return;
    }
    set_is_drag_over_editor(false);
  };

  const handle_editor_drop = (e) => {
    set_is_drag_over_editor(false);
    const dropped_files = Array.from(e.dataTransfer?.files || []);
    const image_files = dropped_files.filter(
      (f) => f.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name || '')
    );
    if (image_files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      if (document.caretRangeFromPoint) {
        const drop_range = document.caretRangeFromPoint(e.clientX, e.clientY);
        const activeEditor = is_fullscreen ? modalEditorRef.current : editorRef.current;
        if (drop_range && activeEditor && activeEditor.contains(drop_range.commonAncestorContainer)) {
          savedRangeRef.current = drop_range;
        }
      }
      handle_upload_and_insert_images(image_files);
    }
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const text = (is_fullscreen ? modalEditorRef.current : editorRef.current)?.innerText || '';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(card.title || 'document').replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Document exported as Markdown file');
  };

  const handleExportHTML = () => {
    const html = (is_fullscreen ? modalEditorRef.current : editorRef.current)?.innerHTML || '';
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${card.title || 'Document'}</title><style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;line-height:1.6;color:#1f2937}pre{background:#1e1f20;color:#e3e3e3;border:1px solid #3c4043;border-radius:8px;padding:16px;overflow-x:auto}</style></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(card.title || 'document').replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Document exported as HTML file');
  };

  const handleCopyPlainText = () => {
    const text = (is_fullscreen ? modalEditorRef.current : editorRef.current)?.innerText || '';
    navigator.clipboard.writeText(text);
    showToast('Plain text copied to clipboard');
  };

  // Render Google Docs Ribbon Toolbar
  const render_toolbar = (isModal = false) => (
    <div className={styles['lumen-docs-toolbar']}>
      {/* Undo / Redo */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('undo'); }}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('redo'); }}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={13} />
        </button>
      </div>

      {/* Style Dropdown (Normal, H1, H2, H3, Quote) */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <select
          className={styles['lumen-docs-select']}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'p') formatDoc('formatBlock', '<p>');
            else if (val === 'h1') formatDoc('formatBlock', '<h1>');
            else if (val === 'h2') formatDoc('formatBlock', '<h2>');
            else if (val === 'h3') formatDoc('formatBlock', '<h3>');
            else if (val === 'blockquote') formatDoc('formatBlock', '<blockquote>');
          }}
          defaultValue="p"
          title="Text Style"
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote block</option>
        </select>
      </div>

      {/* Font Family (All Free Commercial Google Fonts + Search Font) */}
      <div
        ref={!isModal ? font_search_wrap_ref : undefined}
        className={styles['lumen-docs-toolbar-group']}
        style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={11}
            style={{
              position: 'absolute',
              left: 6,
              color: '#64748b',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={doc_font_search}
            onFocus={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              set_doc_font_menu_pos({
                top: rect.bottom + 4,
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
              });
              set_is_doc_font_search_open(true);
            }}
            onChange={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              set_doc_font_menu_pos({
                top: rect.bottom + 4,
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
              });
              set_doc_font_search(e.target.value);
              set_is_doc_font_search_open(true);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && doc_font_search.trim()) {
                e.preventDefault();
                const matches = search_google_fonts(doc_font_search.trim(), doc_font_category);
                const chosen = matches.length > 0 ? matches[0].family : doc_font_search.trim();
                handle_select_doc_google_font(chosen);
              } else if (e.key === 'Escape') {
                set_is_doc_font_search_open(false);
              }
            }}
            placeholder="Search Google Fonts..."
            title="Search 1,600+ Free Commercial Google Fonts"
            style={{
              height: 24,
              width: 128,
              paddingLeft: 21,
              paddingRight: doc_font_search ? 18 : 6,
              fontSize: 11,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              outline: 'none',
            }}
          />
          {doc_font_search && (
            <button
              type="button"
              onClick={() => set_doc_font_search('')}
              style={{
                position: 'absolute',
                right: 3,
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                cursor: 'pointer',
                padding: 1,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear font search"
            >
              <X size={10} />
            </button>
          )}
        </div>

        <select
          className={styles['lumen-docs-select']}
          value={displayed_toolbar_font}
          onChange={(e) => handle_select_doc_google_font(e.target.value, 'auto')}
          title={
            has_text_selection
              ? `Apply Google Font to selected text (Current: ${displayed_toolbar_font})`
              : `Active Font: ${displayed_toolbar_font} (Select text to apply multi-font, or choose to switch font)`
          }
          style={{
            fontFamily: resolved_toolbar_font_stack,
            fontWeight: 500,
            maxWidth: 150,
            border: has_text_selection ? '1px solid #2563eb' : '1px solid #e2e8f0',
            backgroundColor: has_text_selection ? '#eff6ff' : '#ffffff',
          }}
        >
          {(['sans-serif', 'serif', 'display', 'handwriting', 'monospace']
            .filter((cat_key) => doc_font_category === 'all' || doc_font_category === cat_key)
          ).map((cat_key) => {
            const cat_label =
              cat_key === 'sans-serif'
                ? 'Sans-Serif (Free Commercial)'
                : cat_key === 'serif'
                ? 'Serif (Free Commercial)'
                : cat_key === 'display'
                ? 'Display & Headline (Free Commercial)'
                : cat_key === 'handwriting'
                ? 'Handwriting & Script (Free Commercial)'
                : 'Monospace (Free Commercial)';
            const source_list = doc_font_search.trim()
              ? search_google_fonts(doc_font_search.trim(), cat_key)
              : (googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).filter(
                  (f) => f.category === cat_key
                );
            if (source_list.length === 0) return null;
            return (
              <optgroup key={cat_key} label={`${cat_label} (${source_list.length})`}>
                {source_list.map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family}
                  </option>
                ))}
              </optgroup>
            );
          })}
          {displayed_toolbar_font &&
            !(googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).some(
              (f) => f.family.toLowerCase() === displayed_toolbar_font.toLowerCase()
            ) && (
              <optgroup label="Selected Google Font">
                <option value={displayed_toolbar_font}>{displayed_toolbar_font}</option>
              </optgroup>
            )}
        </select>

        {is_doc_font_search_open &&
          doc_font_menu_pos &&
          createPortal(
            <div
              style={{
                position: 'fixed',
                top: doc_font_menu_pos.top,
                left: doc_font_menu_pos.left,
                width: 295,
                maxHeight: 350,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                padding: 8,
                gap: 6,
              }}
              onMouseDown={(e) => {
                // Prevent losing editor text selection when clicking inside font picker
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                  Free Commercial Google Fonts ({(googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).length})
                </span>
                <button
                  type="button"
                  onClick={() => set_is_doc_font_search_open(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Multi-font mode indicator banner */}
              <div
                style={{
                  fontSize: 10,
                  padding: '4px 6px',
                  borderRadius: 4,
                  backgroundColor: has_text_selection ? '#eff6ff' : '#f8fafc',
                  color: has_text_selection ? '#1d4ed8' : '#475569',
                  border: has_text_selection ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  {has_text_selection
                    ? 'Applying font to highlighted text selection'
                    : `Cursor font: ${displayed_toolbar_font} (Doc base: ${font_family})`}
                </span>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'sans-serif', label: 'Sans' },
                  { id: 'serif', label: 'Serif' },
                  { id: 'display', label: 'Display' },
                  { id: 'handwriting', label: 'Script' },
                  { id: 'monospace', label: 'Mono' },
                ].map((cat) => {
                  const active = doc_font_category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => set_doc_font_category(cat.id)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: active ? 600 : 500,
                        borderRadius: 4,
                        border: active ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: active ? '#eff6ff' : '#f8fafc',
                        color: active ? '#2563eb' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Matching Fonts Live Specimen List */}
              <div
                style={{
                  overflowY: 'auto',
                  maxHeight: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {(() => {
                  const matches = search_google_fonts(doc_font_search, doc_font_category).slice(0, 40);
                  if (matches.length === 0) {
                    return (
                      <button
                        type="button"
                        onClick={() => handle_select_doc_google_font(doc_font_search.trim(), 'auto')}
                        style={{
                          padding: '6px 8px',
                          fontSize: 11.5,
                          color: '#2563eb',
                          background: '#eff6ff',
                          border: 'none',
                          borderRadius: 5,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Apply &quot;{doc_font_search.trim()}&quot; from Google Fonts
                      </button>
                    );
                  }
                  return matches.map((gf) => {
                    load_google_font(gf.family);
                    const is_sel = displayed_toolbar_font.toLowerCase() === gf.family.toLowerCase();
                    return (
                      <div
                        key={gf.family}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 6px',
                          borderRadius: 5,
                          border: is_sel ? '1px solid #2563eb' : '1px solid transparent',
                          backgroundColor: is_sel ? '#eff6ff' : 'transparent',
                          gap: 4,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handle_select_doc_google_font(gf.family, 'auto')}
                          title={
                            has_text_selection
                              ? `Apply ${gf.family} to selected text`
                              : `Use ${gf.family} at cursor`
                          }
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: '2px 0',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: '#0f172a',
                              fontFamily: get_google_font_css_stack(gf.family) || 'inherit',
                            }}
                          >
                            {gf.family}
                          </span>
                          <span style={{ fontSize: 9.5, color: '#64748b' }}>
                            {gf.category}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handle_select_doc_google_font(gf.family, 'document')}
                          title={`Set ${gf.family} as default base font for the entire document`}
                          style={{
                            fontSize: 9,
                            padding: '2px 5px',
                            borderRadius: 3,
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Doc Base
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Font Size */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <select
          className={styles['lumen-docs-select']}
          value={font_size}
          onChange={(e) => {
            const val = e.target.value;
            set_font_size(val);
            updateCard(card.id, { doc_font_size: val }, false);
          }}
          title="Font Size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Basic Inline Formats: B, I, U, S */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('bold'); }}
          title="Bold (Ctrl+B)"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('italic'); }}
          title="Italic (Ctrl+I)"
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('underline'); }}
          title="Underline (Ctrl+U)"
        >
          <Underline size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('strikeThrough'); }}
          title="Strikethrough"
        >
          <Strikethrough size={13} />
        </button>
      </div>

      {/* Colors (Text & Highlight) */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles['lumen-docs-color-btn']}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              set_show_text_colors(!show_text_colors);
              set_show_highlight_colors(false);
            }}
            title="Text Color"
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>A</span>
            <div className={styles['lumen-docs-color-bar']} style={{ backgroundColor: '#1a73e8' }} />
          </button>
          {show_text_colors && (
            <div className={styles['lumen-docs-popover']}>
              {TEXT_COLORS.map((col) => (
                <div
                  key={col}
                  className={styles['lumen-docs-color-swatch']}
                  style={{ backgroundColor: col }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    formatDoc('foreColor', col);
                    set_show_text_colors(false);
                  }}
                  title={col}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles['lumen-docs-color-btn']}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              set_show_highlight_colors(!show_highlight_colors);
              set_show_text_colors(false);
            }}
            title="Highlight Color"
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>HL</span>
            <div className={styles['lumen-docs-color-bar']} style={{ backgroundColor: '#fef08a' }} />
          </button>
          {show_highlight_colors && (
            <div className={styles['lumen-docs-popover']}>
              {HIGHLIGHT_COLORS.map((col) => (
                <div
                  key={col}
                  className={styles['lumen-docs-color-swatch']}
                  style={{
                    backgroundColor: col === 'transparent' ? '#ffffff' : col,
                    border: col === 'transparent' ? '1px dashed #cbd5e1' : undefined,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    formatDoc('hiliteColor', col);
                    set_show_highlight_colors(false);
                  }}
                  title={col === 'transparent' ? 'Clear Highlight' : col}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alignment */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('justifyLeft'); }}
          title="Align Left"
        >
          <AlignLeft size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('justifyCenter'); }}
          title="Align Center"
        >
          <AlignCenter size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('justifyRight'); }}
          title="Align Right"
        >
          <AlignRight size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('justifyFull'); }}
          title="Justify"
        >
          <AlignJustify size={13} />
        </button>
      </div>

      {/* Lists & Dividers */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('insertUnorderedList'); }}
          title="Bulleted List"
        >
          <List size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('insertOrderedList'); }}
          title="Numbered List"
        >
          <ListOrdered size={13} />
        </button>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('insertHorizontalRule'); }}
          title="Horizontal Rule"
        >
          <Minus size={13} />
        </button>
      </div>

      {/* Upload & Insert Inline Image Button */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={`${styles['lumen-docs-tool-btn']} ${styles['lumen-docs-tool-btn-active']}`}
          style={{ width: 'auto', padding: '0 8px', gap: 5 }}
          disabled={is_uploading_image}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={trigger_image_upload_dialog}
          title="Upload & Insert Image inline at cursor position (saved to User Storage)"
        >
          {is_uploading_image ? (
            <Loader2 size={13} color="#1a73e8" />
          ) : (
            <ImageIcon size={13} color="#1a73e8" />
          )}
          <span style={{ fontSize: 11, fontWeight: 600 }}>
            {is_uploading_image ? 'Uploading...' : 'Image'}
          </span>
        </button>
      </div>

      {/* Google AI Code Snippet Inline Insert Dropdown */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`${styles['lumen-docs-tool-btn']} ${styles['lumen-docs-tool-btn-active']}`}
            style={{ width: 'auto', padding: '0 8px', gap: 5 }}
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
            }}
            onClick={() => set_show_code_dropdown(!show_code_dropdown)}
            title="Insert Google AI style Code Snippet inline at current cursor position"
          >
            <Code size={13} color="#1a73e8" />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Code Snippet</span>
            <ChevronDown size={11} style={{ opacity: 0.7 }} />
          </button>

          {show_code_dropdown && (
            <div className={styles['lumen-docs-code-menu']}>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Insert Inline Code (Google AI style)
              </div>
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={styles['lumen-docs-code-menu-item']}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    set_show_code_dropdown(false);
                    insertSnippetAtCursor(lang);
                  }}
                >
                  <span style={{ color: '#8ab4f8', fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>&lt;&gt;</span>
                  <span>{lang}</span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '3px 0' }} />
              <button
                type="button"
                className={styles['lumen-docs-code-menu-item']}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  set_show_code_dropdown(false);
                  set_show_code_modal(true);
                }}
              >
                <Sparkles size={12} color="#1a73e8" />
                <span>Custom Code Input...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Format Toggle: Infinite (Default) vs Paginated */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={`${styles['lumen-docs-tool-btn']} ${doc_format === 'infinite' ? styles['lumen-docs-tool-btn-active'] : ''}`}
          style={{ width: 'auto', padding: '0 7px', gap: 4 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleToggleFormat(doc_format === 'infinite' ? 'pages' : 'infinite')}
          title={doc_format === 'infinite' ? 'Pageless Infinite Mode active (continuous scrolling, text seen easier)' : 'Paginated Pages view active'}
        >
          {doc_format === 'infinite' ? (
            <>
              <InfinityIcon size={12} color="#1a73e8" />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#1a73e8' }}>Pageless</span>
            </>
          ) : (
            <>
              <Layers size={12} color="#64748b" />
              <span style={{ fontSize: 10.5, fontWeight: 600 }}>Pages</span>
            </>
          )}
        </button>
      </div>

      {/* Clear Formatting */}
      <div className={styles['lumen-docs-toolbar-group']}>
        <button
          type="button"
          className={styles['lumen-docs-tool-btn']}
          onMouseDown={(e) => { e.preventDefault(); formatDoc('removeFormat'); }}
          title="Clear Formatting"
        >
          <RemoveFormatting size={13} />
        </button>
      </div>
    </div>
  );

  // Custom Code Snippet Modal (Inserts inline with text at saved cursor position!)
  const render_code_modal = () => {
    if (!show_code_modal) return null;
    return (
      <div
        className={styles['lumen-docs-code-modal-backdrop']}
        onClick={() => set_show_code_modal(false)}
      >
        <div
          className={styles['lumen-docs-code-modal']}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles['lumen-docs-code-modal-title']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Code size={16} color="#1a73e8" />
              <span>Insert Google AI Style Code Snippet</span>
            </div>
            <button
              type="button"
              className={styles['lumen-docs-tool-btn']}
              onClick={() => set_show_code_modal(false)}
            >
              <X size={14} />
            </button>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Programming Language
            </label>
            <select
              className={styles['lumen-docs-select']}
              style={{ width: '100%', height: 32 }}
              value={code_lang}
              onChange={(e) => set_code_lang(e.target.value)}
            >
              {CODE_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Code Content (Inline Insert)
            </label>
            <textarea
              className={styles['lumen-docs-code-textarea']}
              placeholder="Paste or write your code here..."
              value={code_content}
              onChange={(e) => set_code_content(e.target.value)}
              spellCheck="false"
            />
          </div>

          <div className={styles['lumen-docs-code-modal-actions']}>
            <button
              type="button"
              className={styles['lumen-docs-header-btn']}
              onClick={() => set_show_code_modal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles['lumen-docs-header-btn']} ${styles['lumen-docs-header-btn-primary']}`}
              onClick={() => {
                insertSnippetAtCursor(code_lang, code_content);
                set_show_code_modal(false);
              }}
            >
              <Check size={12} />
              <span>Insert Inline</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles['lumen-docs-container']}
      data-lumen-scrollable="true"
      onMouseDown={(e) => {
        // Prevent card selection or dragging on canvas when interacting with editor
        e.stopPropagation();
      }}
      onWheel={(e) => {
        // Prevent canvas handleWheel from panning board when scrolling inside doc
        e.stopPropagation();
      }}
    >
      {/* 1. Document Card Header */}
      <div className={styles['lumen-docs-header']}>
        <div className={styles['lumen-docs-header-left']}>
          <div className={styles['lumen-docs-icon-badge']}>
            <FileText size={15} />
          </div>
          <div className={styles['lumen-docs-title-wrap']}>
            <input
              type="text"
              className={styles['lumen-docs-title-input']}
              value={doc_title}
              onChange={(e) => {
                set_doc_title(e.target.value);
                updateCard(card.id, { title: e.target.value }, false);
              }}
              onBlur={() => saveCurrentBoardToStore()}
              placeholder="Document Title..."
              title="Click to edit document title"
            />
            <div className={styles['lumen-docs-status-row']}>
              <span className={styles['lumen-docs-status-saved']}>
                <Check size={10} /> Saved
              </span>
              <span>•</span>
              <button
                type="button"
                className={styles['lumen-docs-pageless-pill']}
                onClick={() => handleToggleFormat(doc_format === 'infinite' ? 'pages' : 'infinite')}
                title="Click to toggle between Pageless (Infinite) and Pages view"
              >
                <InfinityIcon size={10} /> {doc_format === 'infinite' ? 'Pageless (Infinite)' : 'Pages'}
              </button>
              <span>•</span>
              <span>{stats.words} words</span>
            </div>
          </div>
        </div>

        <div className={styles['lumen-docs-header-actions']}>
          {/* Hidden File Input for Image Upload */}
          <input
            ref={image_input_ref}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handle_upload_and_insert_images(e.target.files);
              }
            }}
          />

          {/* Quick Upload & Insert Image */}
          <button
            type="button"
            className={styles['lumen-docs-header-btn']}
            disabled={is_uploading_image}
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
            }}
            onClick={trigger_image_upload_dialog}
            title="Upload & Insert Image Inline at cursor position (listed in User Storage)"
          >
            {is_uploading_image ? (
              <Loader2 size={11} color="#1a73e8" />
            ) : (
              <ImageIcon size={11} color="#1a73e8" />
            )}
            <span>{is_uploading_image ? 'Uploading...' : '+ Image'}</span>
          </button>

          {/* Quick Insert Code Snippet */}
          <button
            type="button"
            className={styles['lumen-docs-header-btn']}
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
            }}
            onClick={() => insertSnippetAtCursor('html')}
            title="Quick Insert HTML Code Snippet Inline at cursor position"
          >
            <Code size={11} color="#1a73e8" />
            <span>+ Code</span>
          </button>

          {/* Fullscreen Trigger Button */}
          <button
            type="button"
            className={`${styles['lumen-docs-header-btn']} ${styles['lumen-docs-header-btn-primary']}`}
            onClick={() => set_is_fullscreen(true)}
            title="Open Document in Fullscreen Mode (Focus Mode)"
          >
            <Maximize2 size={11} />
            <span>Fullscreen</span>
          </button>
        </div>
      </div>

      {/* 2. Ribbon Toolbar */}
      {render_toolbar(false)}

      {/* 3. Document Workspace (Infinite Pageless Mode as default for easy reading & continuous downward flow) */}
      <div
        ref={deskRef}
        data-lumen-scrollable="true"
        className={`${styles['lumen-docs-desk']} ${
          doc_format === 'pages' ? styles['lumen-docs-desk-pages'] : styles['lumen-docs-desk-infinite']
        }`}
        onClick={handleDeskClick}
        onDragOver={handle_editor_drag_over}
        onDragLeave={handle_editor_drag_leave}
        onDrop={handle_editor_drop}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.stopPropagation();
          }
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className={`${styles['lumen-docs-sheet']} ${
            doc_format === 'pages' ? styles['lumen-docs-sheet-paginated'] : styles['lumen-docs-sheet-infinite']
          }`}
          onClick={handleDeskClick}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
              e.stopPropagation();
            }
          }}
        >
          <div
            ref={editorRef}
            className={`${styles['lumen-docs-editor']} ${
              is_drag_over_editor ? styles['lumen-docs-editor-dragover'] : ''
            }`}
            style={{ fontFamily: resolved_editor_font_stack, fontSize: font_size }}
            contentEditable="true"
            suppressContentEditableWarning={true}
            spellCheck="true"
            onInput={() => handleEditorInput(false)}
            onClick={handleEditorClick}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onSelect={saveSelection}
            onFocus={saveSelection}
            onPaste={handle_editor_paste}
            onDragOver={handle_editor_drag_over}
            onDragLeave={handle_editor_drag_leave}
            onDrop={handle_editor_drop}
          />
        </div>
      </div>

      {/* 4. Footer Status Bar */}
      <div className={styles['lumen-docs-footer']}>
        <div className={styles['lumen-docs-footer-stats']}>
          <span
            className={styles['lumen-docs-pageless-pill']}
            style={{ cursor: 'pointer' }}
            onClick={() => handleToggleFormat(doc_format === 'infinite' ? 'pages' : 'infinite')}
            title="Default format: Infinite Pageless continuous scroll"
          >
            <InfinityIcon size={11} /> {doc_format === 'infinite' ? 'Pageless Infinite Scroll' : 'Paginated Pages'}
          </span>
          <span>•</span>
          <span>
            <strong>{stats.words}</strong> words
          </span>
          <span>•</span>
          <span>
            <strong>{stats.chars}</strong> chars
          </span>
          <span>•</span>
          <span>~{Math.max(1, Math.ceil(stats.words / 200))} min read</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={styles['lumen-docs-tool-btn']}
            style={{ width: 'auto', padding: '0 6px', height: 20, fontSize: 10 }}
            onClick={handleCopyPlainText}
            title="Copy document plain text"
          >
            <Copy size={10} />
            <span style={{ marginLeft: 3 }}>Copy</span>
          </button>
          <button
            type="button"
            className={styles['lumen-docs-tool-btn']}
            style={{ width: 'auto', padding: '0 6px', height: 20, fontSize: 10 }}
            onClick={handleExportMarkdown}
            title="Download as Markdown"
          >
            <Download size={10} />
            <span style={{ marginLeft: 3 }}>.md</span>
          </button>
        </div>
      </div>

      {/* Custom Code Modal */}
      {render_code_modal()}

      {/* ====================================================================
          5. Fullscreen Editing Modal Portal (Pageless Infinite View)
          ==================================================================== */}
      {is_fullscreen &&
        createPortal(
          <div
            className={styles['lumen-docs-modal-backdrop']}
            onClick={() => set_is_fullscreen(false)}
          >
            <div
              className={styles['lumen-docs-modal-dialog']}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.stopPropagation();
                }
              }}
            >
              {/* Fullscreen Header */}
              <div className={styles['lumen-docs-header']}>
                <div className={styles['lumen-docs-header-left']}>
                  <div className={styles['lumen-docs-icon-badge']} style={{ width: 30, height: 30 }}>
                    <FileText size={18} />
                  </div>
                  <div className={styles['lumen-docs-title-wrap']}>
                    <input
                      type="text"
                      className={styles['lumen-docs-title-input']}
                      style={{ fontSize: 15, fontWeight: 700, maxWidth: 400 }}
                      value={doc_title}
                      onChange={(e) => {
                        set_doc_title(e.target.value);
                        updateCard(card.id, { title: e.target.value }, false);
                      }}
                      onBlur={() => saveCurrentBoardToStore()}
                      placeholder="Document Title..."
                    />
                    <div className={styles['lumen-docs-status-row']}>
                      <span className={styles['lumen-docs-status-saved']}>
                        <Check size={11} /> Saved
                      </span>
                      <span>•</span>
                      <button
                        type="button"
                        className={styles['lumen-docs-pageless-pill']}
                        onClick={() => handleToggleFormat(doc_format === 'infinite' ? 'pages' : 'infinite')}
                      >
                        <InfinityIcon size={11} /> {doc_format === 'infinite' ? 'Pageless Infinite Mode' : 'Pages Mode'}
                      </button>
                      <span>•</span>
                      <span>{stats.words} words</span>
                    </div>
                  </div>
                </div>

                <div className={styles['lumen-docs-header-actions']}>
                  <button
                    type="button"
                    className={styles['lumen-docs-header-btn']}
                    onClick={handleExportMarkdown}
                    title="Export Markdown (.md)"
                  >
                    <Download size={12} />
                    <span>Export Markdown</span>
                  </button>

                  <button
                    type="button"
                    className={styles['lumen-docs-header-btn']}
                    onClick={handleExportHTML}
                    title="Export HTML Document"
                  >
                    <Download size={12} />
                    <span>Export HTML</span>
                  </button>

                  <button
                    type="button"
                    className={styles['lumen-docs-header-btn']}
                    disabled={is_uploading_image}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      saveSelection();
                    }}
                    onClick={trigger_image_upload_dialog}
                    title="Upload & Insert Image Inline at cursor position (listed in User Storage)"
                  >
                    {is_uploading_image ? (
                      <Loader2 size={12} color="#1a73e8" />
                    ) : (
                      <ImageIcon size={12} color="#1a73e8" />
                    )}
                    <span>{is_uploading_image ? 'Uploading...' : '+ Upload Image'}</span>
                  </button>

                  <button
                    type="button"
                    className={styles['lumen-docs-header-btn']}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      saveSelection();
                    }}
                    onClick={() => insertSnippetAtCursor('html')}
                    title="Insert Code Snippet Inline at cursor position"
                  >
                    <Code size={12} color="#1a73e8" />
                    <span>+ Code Snippet</span>
                  </button>

                  <button
                    type="button"
                    className={styles['lumen-docs-header-btn']}
                    style={{ backgroundColor: '#f1f5f9' }}
                    onClick={() => set_is_fullscreen(false)}
                    title="Exit Fullscreen (Esc)"
                  >
                    <Minimize2 size={13} />
                    <span>Exit Fullscreen</span>
                  </button>
                </div>
              </div>

              {/* Fullscreen Ribbon Toolbar */}
              {render_toolbar(true)}

              {/* Fullscreen Workspace */}
              <div
                ref={modalDeskRef}
                data-lumen-scrollable="true"
                className={`${styles['lumen-docs-modal-desk']} ${
                  doc_format === 'pages' ? styles['lumen-docs-desk-pages'] : styles['lumen-docs-desk-infinite']
                }`}
                onClick={handleDeskClick}
                onDragOver={handle_editor_drag_over}
                onDragLeave={handle_editor_drag_leave}
                onDrop={handle_editor_drop}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.stopPropagation();
                  }
                }}
                onWheel={(e) => {
                  e.stopPropagation();
                }}
              >
                <div
                  className={`${styles['lumen-docs-modal-sheet']} ${
                    doc_format === 'pages' ? styles['lumen-docs-sheet-paginated'] : styles['lumen-docs-sheet-infinite']
                  }`}
                  onClick={handleDeskClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                      e.stopPropagation();
                    }
                  }}
                >
                  <div
                    ref={modalEditorRef}
                    className={`${styles['lumen-docs-editor']} ${
                      is_drag_over_editor ? styles['lumen-docs-editor-dragover'] : ''
                    }`}
                    style={{ fontFamily: resolved_editor_font_stack, fontSize: font_size }}
                    contentEditable="true"
                    suppressContentEditableWarning={true}
                    spellCheck="true"
                    onInput={() => handleEditorInput(true)}
                    onClick={handleEditorClick}
                    onKeyDown={handleEditorKeyDown}
                    onKeyUp={saveSelection}
                    onMouseUp={saveSelection}
                    onSelect={saveSelection}
                    onFocus={saveSelection}
                    onPaste={handle_editor_paste}
                    onDragOver={handle_editor_drag_over}
                    onDragLeave={handle_editor_drag_leave}
                    onDrop={handle_editor_drop}
                  />
                </div>
              </div>

              {/* Fullscreen Footer */}
              <div className={styles['lumen-docs-footer']}>
                <div className={styles['lumen-docs-footer-stats']}>
                  <span className={styles['lumen-docs-pageless-pill']}>
                    <InfinityIcon size={12} /> {doc_format === 'infinite' ? 'Pageless Continuous Scroll' : 'Paginated Pages'}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{stats.words}</strong> words
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{stats.chars}</strong> characters
                  </span>
                  <span>•</span>
                  <span>~{Math.max(1, Math.ceil(stats.words / 200))} min reading time</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>Press Esc to exit fullscreen</span>
                  <button
                    type="button"
                    className={styles['lumen-docs-header-btn']}
                    onClick={() => set_is_fullscreen(false)}
                  >
                    <Minimize2 size={11} />
                    <span>Done</span>
                  </button>
                </div>
              </div>

              {/* Custom Code Modal inside Fullscreen */}
              {render_code_modal()}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
