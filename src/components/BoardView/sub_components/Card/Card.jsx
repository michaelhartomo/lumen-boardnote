import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSignals } from '@preact/signals-react/runtime';
import {
  GripHorizontal,
  Copy,
  Trash2,
  ArrowUpRight,
  BringToFront as BringFrontIcon,
  SendToBack as SendBackIcon,
  Check,
  Plus,
  ExternalLink,
  Maximize2,
  Expand,
  FileText,
  CheckSquare,
  Heading,
  Image as ImageIcon,
  Link2,
  Globe,
  Quote,
  Instagram,
  Video,
  Share2,
  FolderKanban,
  CornerDownRight,
  Sparkles,
  Paperclip,
  Music,
  Radio,
  Tag,
  SmilePlus,
  X,
  MessageSquare,
  MapPin,
  Boxes,
  TrendingUp,
  FileSpreadsheet,
  FileEdit,
  Lock,
  Unlock,
  PenTool,
  Sliders,
  Loader2,
  RefreshCw,
  Code2,
  Mic,
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
  RemoveFormatting,
  Volume2,
  Download,
  Coins,
  Clock,
  Calendar,
} from 'lucide-react';

import styles from './Card.module.css';
import loadable from '@loadable/component';
import LUMEN_card_lock_overlay from './LUMEN_card_lock_overlay.jsx';

// Normalize card slides helper without requiring static bundle of LUMEN_image_carousel
const normalize_card_slides = (card) => {
  if (Array.isArray(card.images) && card.images.length > 0) {
    return card.images.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `slide_${idx}`,
          url: item,
          caption: card.caption || '',
        };
      }
      return {
        id: item.id || `slide_${idx}`,
        url: item.url || '',
        caption: item.caption || '',
      };
    });
  }
  return [];
};

const escape_note_html = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const format_inline_note_html = (escaped_line) =>
  String(escaped_line || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(?<!<strong>)\[(\d{1,2}:\d{2}(?::\d{2})?)\](?!<\/strong>)/g, '<strong>[$1]</strong>');

const ensure_html_timestamps_bold = (html_str) =>
  String(html_str || '')
    .replace(
      /(?<!<(?:strong|b)>)\[(\d{1,2}:\d{2}(?::\d{2})?)\](?!<\/(?:strong|b)>)/gi,
      '<strong>[$1]</strong>'
    )
    .replace(
      /(?:<p(?:\s+[^>]*)?>\s*(?:<br\s*\/?>|&nbsp;|\s)*<\/p>\s*)+(<h3\b)/gi,
      '$1'
    );

const convert_note_text_to_html = (raw_text) => {
  const txt = String(raw_text || '');
  if (!txt.trim()) return '';
  if (/^\s*<(p|h1|h2|h3|div|ul|ol|blockquote|span|b|strong|i|em|u|s|sup|sub)\b/i.test(txt)) {
    return ensure_html_timestamps_bold(txt);
  }
  const lines = txt.split(/\r?\n/);
  const out = [];
  let in_ul = false;
  let in_ol = false;

  const close_lists = () => {
    if (in_ul) {
      out.push('</ul>');
      in_ul = false;
    }
    if (in_ol) {
      out.push('</ol>');
      in_ol = false;
    }
  };

  const pop_trailing_blank_paragraphs = () => {
    while (out.length > 0 && out[out.length - 1] === '<p><br></p>') {
      out.pop();
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw_line = lines[i];
    const trimmed = raw_line.trim();
    if (!trimmed) {
      close_lists();
      if (out.length > 0 && out[out.length - 1] !== '<p><br></p>') {
        out.push('<p><br></p>');
      }
      continue;
    }

    const h3_match = trimmed.match(/^###\s+(.+)$/);
    if (h3_match) {
      close_lists();
      pop_trailing_blank_paragraphs();
      out.push(`<h3>${format_inline_note_html(escape_note_html(h3_match[1]))}</h3>`);
      continue;
    }
    const h2_match = trimmed.match(/^##\s+(.+)$/);
    if (h2_match) {
      close_lists();
      pop_trailing_blank_paragraphs();
      out.push(`<h2>${format_inline_note_html(escape_note_html(h2_match[1]))}</h2>`);
      continue;
    }
    const h1_match = trimmed.match(/^#\s+(.+)$/);
    if (h1_match) {
      close_lists();
      pop_trailing_blank_paragraphs();
      out.push(`<h1>${format_inline_note_html(escape_note_html(h1_match[1]))}</h1>`);
      continue;
    }

    if (/^(?:📋|⏱️|📌|✅|🗣️|🌐)\s+.+$/.test(trimmed)) {
      close_lists();
      pop_trailing_blank_paragraphs();
      out.push(`<h3>${format_inline_note_html(escape_note_html(trimmed))}</h3>`);
      continue;
    }

    const ul_match = trimmed.match(/^(?:[•\-*])\s+(.+)$/);
    if (ul_match) {
      if (in_ol) {
        out.push('</ol>');
        in_ol = false;
      }
      if (!in_ul) {
        out.push('<ul>');
        in_ul = true;
      }
      out.push(`<li>${format_inline_note_html(escape_note_html(ul_match[1]))}</li>`);
      continue;
    }

    const ol_match = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol_match) {
      if (in_ul) {
        out.push('</ul>');
        in_ul = false;
      }
      if (!in_ol) {
        out.push('<ol>');
        in_ol = true;
      }
      out.push(`<li>${format_inline_note_html(escape_note_html(ol_match[1]))}</li>`);
      continue;
    }

    close_lists();
    out.push(`<p>${format_inline_note_html(escape_note_html(raw_line))}</p>`);
  }

  close_lists();
  return out.join('');
};

const LUMEN_NOTE_TTS_VOICE_OPTIONS = [
  // Google TTS — Female
  { id: 'Kore', label: 'Kore · Google Female (Firm & Clear)', category: 'Google TTS — Female' },
  { id: 'Aoede', label: 'Aoede · Google Female (Breezy & Natural)', category: 'Google TTS — Female' },
  { id: 'Leda', label: 'Leda · Google Female (Youthful & Bright)', category: 'Google TTS — Female' },
  { id: 'Callirrhoe', label: 'Callirrhoe · Google Female (Easy-going & Warm)', category: 'Google TTS — Female' },
  { id: 'Autonoe', label: 'Autonoe · Google Female (Bright & Expressive)', category: 'Google TTS — Female' },
  { id: 'Despina', label: 'Despina · Google Female (Smooth & Calm)', category: 'Google TTS — Female' },
  { id: 'Erinome', label: 'Erinome · Google Female (Articulate & Crisp)', category: 'Google TTS — Female' },
  { id: 'Laomedeia', label: 'Laomedeia · Google Female (Upbeat & Friendly)', category: 'Google TTS — Female' },
  { id: 'Achernar', label: 'Achernar · Google Female (Soft & Gentle)', category: 'Google TTS — Female' },
  { id: 'Sulafat', label: 'Sulafat · Google Female (Warm & Conversational)', category: 'Google TTS — Female' },
  // Google TTS — Male
  { id: 'Puck', label: 'Puck · Google Male (Upbeat & Energetic)', category: 'Google TTS — Male' },
  { id: 'Charon', label: 'Charon · Google Male (Informative & Deep)', category: 'Google TTS — Male' },
  { id: 'Fenrir', label: 'Fenrir · Google Male (Dynamic & Expressive)', category: 'Google TTS — Male' },
  { id: 'Orus', label: 'Orus · Google Male (Firm & Authoritative)', category: 'Google TTS — Male' },
  { id: 'Zephyr', label: 'Zephyr · Google Male (Bright & Crisp)', category: 'Google TTS — Male' },
  { id: 'Iapetus', label: 'Iapetus · Google Male (Clear Studio)', category: 'Google TTS — Male' },
  { id: 'Enceladus', label: 'Enceladus · Google Male (Soft & Natural)', category: 'Google TTS — Male' },
  { id: 'Alnilam', label: 'Alnilam · Google Male (Steady & Confident)', category: 'Google TTS — Male' },
  { id: 'Algieba', label: 'Algieba · Google Male (Smooth & Rich)', category: 'Google TTS — Male' },
  { id: 'Achird', label: 'Achird · Google Male (Friendly & Warm)', category: 'Google TTS — Male' },
  // Google TTS — Neutral & Cloud Neural2
  { id: 'Schedar', label: 'Schedar · Google Neutral (Balanced)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'Gacrux', label: 'Gacrux · Google Neutral (Mature & Calm)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'Pulcherrima', label: 'Pulcherrima · Google Neutral (Forward & Clear)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix · Google Neutral (Gentle & Mindful)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'en-US-Neural2-F', label: 'en-US-Neural2-F · Google Cloud Female', category: 'Google TTS — Neutral & Neural2' },
  { id: 'en-US-Neural2-D', label: 'en-US-Neural2-D · Google Cloud Male', category: 'Google TTS — Neutral & Neural2' },
];

const LUMEN_NOTE_TTS_VOICE_CATEGORIES = [
  'Google TTS — Female',
  'Google TTS — Male',
  'Google TTS — Neutral & Neural2',
];

const LEGACY_TO_GOOGLE_TTS_VOICE_MAP = {
  aria: 'Kore',
  aura: 'Kore',
  aurora: 'Aoede',
  nova: 'Aoede',
  vega: 'Aoede',
  breeze: 'Leda',
  coral: 'Callirrhoe',
  luna: 'Despina',
  shimmer: 'Autonoe',
  willow: 'Erinome',
  atlas: 'Fenrir',
  canyon: 'Orus',
  echo: 'Puck',
  ember: 'Enceladus',
  onyx: 'Iapetus',
  orion: 'Charon',
  sol: 'Alnilam',
  zephyr: 'Zephyr',
  alloy: 'Puck',
  fable: 'Schedar',
  sage: 'Gacrux',
  verse: 'Pulcherrima',
};

const normalize_muse_voice_id = (raw_voice) => {
  const raw = String(raw_voice || '').trim();
  if (!raw) return 'Kore';
  const clean_lower = raw.toLowerCase();
  if (LEGACY_TO_GOOGLE_TTS_VOICE_MAP[clean_lower]) {
    return LEGACY_TO_GOOGLE_TTS_VOICE_MAP[clean_lower];
  }
  const matched = LUMEN_NOTE_TTS_VOICE_OPTIONS.find(
    (v) => v.id.toLowerCase() === clean_lower
  );
  return matched ? matched.id : 'Kore';
};

const LUMEN_NOTE_TTS_LANGUAGE_OPTIONS = [
  'Auto-Detect',
  'English',
  'Indonesian',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Mandarin Chinese',
  'Arabic',
  'Portuguese',
  'Russian',
  'Hindi',
  'Italian',
  'Dutch',
  'Turkish',
  'Vietnamese',
  'Thai',
  'Tagalog',
  'Malay',
  'Polish',
];

function LUMEN_note_rich_editor({ card, update_card_fn, resolved_font_css }) {
  const editor_ref = useRef(null);
  const saved_range_ref = useRef(null);
  const last_synced_plain_ref = useRef(null);
  const last_synced_html_ref = useRef(null);
  const [is_tts_confirm_open, set_is_tts_confirm_open] = useState(false);
  const [selected_tts_voice, set_selected_tts_voice] = useState(() =>
    normalize_muse_voice_id(card.tts_voice_persona)
  );
  const [selected_tts_lang, set_selected_tts_lang] = useState(
    () => card.tts_language || 'Auto-Detect'
  );
  const [format_state, set_format_state] = useState({
    block: 'p',
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    superscript: false,
    subscript: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });

  const save_selection_range = () => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor_ref.current) return;
    const range = sel.getRangeAt(0);
    if (editor_ref.current.contains(range.commonAncestorContainer)) {
      saved_range_ref.current = range.cloneRange();
    }
  };

  const restore_selection_range = () => {
    if (typeof window === 'undefined' || !editor_ref.current) return;
    editor_ref.current.focus();
    if (saved_range_ref.current) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(saved_range_ref.current);
        }
      } catch (_err) {
        // Ignore stale range errors
      }
    }
  };

  const refresh_format_state = () => {
    if (typeof document === 'undefined' || !editor_ref.current) return;
    save_selection_range();
    try {
      const raw_block = String(document.queryCommandValue('formatBlock') || 'p')
        .replace(/[<>]/g, '')
        .toLowerCase();
      set_format_state({
        block: ['h1', 'h2', 'h3', 'blockquote'].includes(raw_block) ? raw_block : 'p',
        bold: Boolean(document.queryCommandState('bold')),
        italic: Boolean(document.queryCommandState('italic')),
        underline: Boolean(document.queryCommandState('underline')),
        strikeThrough: Boolean(document.queryCommandState('strikeThrough')),
        superscript: Boolean(document.queryCommandState('superscript')),
        subscript: Boolean(document.queryCommandState('subscript')),
        justifyLeft: Boolean(document.queryCommandState('justifyLeft')),
        justifyCenter: Boolean(document.queryCommandState('justifyCenter')),
        justifyRight: Boolean(document.queryCommandState('justifyRight')),
        justifyFull: Boolean(document.queryCommandState('justifyFull')),
        insertUnorderedList: Boolean(document.queryCommandState('insertUnorderedList')),
        insertOrderedList: Boolean(document.queryCommandState('insertOrderedList')),
      });
    } catch (_err) {
      // Ignore queryCommandState errors
    }
  };

  // Sync initial or externally updated card content into the contentEditable DOM
  useEffect(() => {
    const el = editor_ref.current;
    if (!el) return;
    const incoming_html = card.content_html || '';
    const incoming_plain = String(card.content || '');

    if (
      incoming_html &&
      incoming_html === last_synced_html_ref.current &&
      incoming_plain === last_synced_plain_ref.current
    ) {
      return;
    }
    if (
      !incoming_html &&
      last_synced_plain_ref.current !== null &&
      incoming_plain === last_synced_plain_ref.current
    ) {
      return;
    }

    const next_html = incoming_html
      ? ensure_html_timestamps_bold(incoming_html)
      : convert_note_text_to_html(incoming_plain);
    if (el.innerHTML !== next_html) {
      el.innerHTML = next_html;
    }
    const cleaned_plain = incoming_plain.replace(
      /\n{2,}(?=(?:📋|⏱️|📌|✅|🗣️|🌐)\s)/g,
      '\n'
    );
    last_synced_html_ref.current = next_html;
    last_synced_plain_ref.current = cleaned_plain;
    if ((incoming_html && next_html !== incoming_html) || cleaned_plain !== incoming_plain) {
      update_card_fn(
        card.id,
        {
          content: cleaned_plain,
          content_html: next_html,
        },
        false
      );
    }
  }, [card.id, card.content, card.content_html]);

  const emit_editor_change = (persist_to_history = false) => {
    const el = editor_ref.current;
    if (!el) return;
    const html_val = el.innerHTML;
    const plain_val = el.innerText || '';
    last_synced_html_ref.current = html_val;
    last_synced_plain_ref.current = plain_val;
    update_card_fn(
      card.id,
      {
        content: plain_val,
        content_html: html_val,
      },
      persist_to_history
    );
  };

  const exec_note_cmd = (cmd, val = null) => {
    if (typeof document === 'undefined' || !editor_ref.current) return;
    restore_selection_range();

    if (cmd === 'formatBlock' && val) {
      const target_tag = String(val).toLowerCase();
      const current_tag = format_state.block;
      const next_tag = current_tag === target_tag && target_tag !== 'p' ? 'P' : String(val).toUpperCase();
      const ok = document.execCommand('formatBlock', false, `<${next_tag}>`);
      if (!ok) {
        document.execCommand('formatBlock', false, next_tag);
      }
    } else {
      document.execCommand(cmd, false, val);
    }

    save_selection_range();
    refresh_format_state();
    emit_editor_change(true);
  };

  const prevent_toolbar_focus_loss = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={styles['lumen-note-rich-container']}
      data-lumen-no-card-drag="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={styles['lumen-note-rich-toolbar']}
        onMouseDown={prevent_toolbar_focus_loss}
      >
        {/* Headings / Block Format */}
        <div className={styles['lumen-note-toolbar-group']}>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.block === 'p' ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('formatBlock', 'P')}
            title="Normal Text (Paragraph)"
          >
            P
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.block === 'h1' ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('formatBlock', 'H1')}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.block === 'h2' ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('formatBlock', 'H2')}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.block === 'h3' ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('formatBlock', 'H3')}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        <span className={styles['lumen-note-toolbar-divider']} />

        {/* Inline Styles: Bold, Italic, Underline, Strikethrough, Superscript, Subscript */}
        <div className={styles['lumen-note-toolbar-group']}>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.bold ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('bold')}
            title="Bold (Ctrl/Cmd+B)"
          >
            <Bold size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.italic ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('italic')}
            title="Italic (Ctrl/Cmd+I)"
          >
            <Italic size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.underline ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('underline')}
            title="Underline (Ctrl/Cmd+U)"
          >
            <Underline size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.strikeThrough ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('strikeThrough')}
            title="Strikethrough"
          >
            <Strikethrough size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.superscript ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('superscript')}
            title="Superscript (x²)"
          >
            x²
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.subscript ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('subscript')}
            title="Subscript (x₂)"
          >
            x₂
          </button>
        </div>

        <span className={styles['lumen-note-toolbar-divider']} />

        {/* Text Alignments: Left, Center, Right, Justify */}
        <div className={styles['lumen-note-toolbar-group']}>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.justifyLeft ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('justifyLeft')}
            title="Align Left"
          >
            <AlignLeft size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.justifyCenter ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('justifyCenter')}
            title="Align Center"
          >
            <AlignCenter size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.justifyRight ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('justifyRight')}
            title="Align Right"
          >
            <AlignRight size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.justifyFull ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('justifyFull')}
            title="Justify Text"
          >
            <AlignJustify size={11} />
          </button>
        </div>

        <span className={styles['lumen-note-toolbar-divider']} />

        {/* Lists & Clear Formatting */}
        <div className={styles['lumen-note-toolbar-group']}>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.insertUnorderedList ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('insertUnorderedList')}
            title="Bullet List"
          >
            <List size={11} />
          </button>
          <button
            type="button"
            className={`${styles['lumen-note-toolbar-btn']} ${
              format_state.insertOrderedList ? styles['lumen-note-toolbar-btn-active'] : ''
            }`}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('insertOrderedList')}
            title="Numbered List"
          >
            <ListOrdered size={11} />
          </button>
          <button
            type="button"
            className={styles['lumen-note-toolbar-btn']}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => exec_note_cmd('removeFormat')}
            title="Clear Formatting"
          >
            <RemoveFormatting size={11} />
          </button>
        </div>

        <span className={styles['lumen-note-toolbar-divider']} />

        {/* Voice Text-to-Voice (opens Voice & Language confirmation dialog) */}
        <div className={styles['lumen-note-toolbar-group']}>
          <button
            type="button"
            className={`${styles['lumen-note-tts-btn']} ${
              is_tts_confirm_open ? styles['lumen-note-tts-btn-active'] : ''
            }`}
            disabled={Boolean(isCardAiProcessingSignal.value)}
            onMouseDown={prevent_toolbar_focus_loss}
            onClick={() => {
              emit_editor_change(false);
              set_selected_tts_voice(normalize_muse_voice_id(card.tts_voice_persona));
              set_selected_tts_lang(card.tts_language || 'Auto-Detect');
              set_is_tts_confirm_open((prev) => !prev);
            }}
            title="Configure Voice & Language to synthesize Note Text to Voice"
          >
            <Volume2 size={11} />
            <span>Voice</span>
          </button>
        </div>
      </div>

      {/* Voice Selection & Language Confirmation Panel before creating voice */}
      {is_tts_confirm_open && (
        <div
          className={styles['lumen-note-tts-confirm-panel']}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles['lumen-note-tts-confirm-header']}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Volume2 size={12} />
              <span>Create Voice (Google TTS)</span>
            </span>
            <button
              type="button"
              className={styles['lumen-note-tts-confirm-close']}
              onClick={() => set_is_tts_confirm_open(false)}
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>

          <div className={styles['lumen-note-tts-confirm-row']}>
            <span className={styles['lumen-note-tts-confirm-label']}>Google TTS Voice:</span>
            <select
              className={styles['lumen-note-tts-lang-select']}
              value={selected_tts_voice}
              onChange={(e) => set_selected_tts_voice(e.target.value)}
              title="Choose Google Text-to-Speech Voice"
            >
              {LUMEN_NOTE_TTS_VOICE_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {LUMEN_NOTE_TTS_VOICE_OPTIONS.filter((vp) => vp.category === cat).map((vp) => (
                    <option key={vp.id} value={vp.id}>
                      {vp.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={styles['lumen-note-tts-confirm-row']}>
            <span className={styles['lumen-note-tts-confirm-label']}>Language:</span>
            <select
              className={styles['lumen-note-tts-lang-select']}
              value={selected_tts_lang}
              onChange={(e) => set_selected_tts_lang(e.target.value)}
              title="Choose language for voice synthesis"
            >
              {LUMEN_NOTE_TTS_LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'Auto-Detect'
                    ? 'Auto-Detect (Note Language)'
                    : `${lang} (Translate & Speak)`}
                </option>
              ))}
            </select>
          </div>

          {selected_tts_lang && selected_tts_lang !== 'Auto-Detect' && (
            <div className={styles['lumen-note-tts-translate-hint']}>
              AI will translate note content to <strong>{selected_tts_lang}</strong> first, then generate the voice-over in <strong>{selected_tts_lang}</strong>.
            </div>
          )}

          <div className={styles['lumen-note-tts-confirm-actions']}>
            <button
              type="button"
              className={styles['lumen-note-tts-cancel-btn']}
              onClick={() => set_is_tts_confirm_open(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles['lumen-note-tts-confirm-submit-btn']}
              disabled={Boolean(isCardAiProcessingSignal.value)}
              onClick={() => {
                const live_el = editor_ref.current;
                const live_plain = live_el ? (live_el.innerText || '').trim() : '';
                const live_html = live_el ? live_el.innerHTML || '' : '';
                update_card_fn(
                  card.id,
                  {
                    ...(live_plain ? { content: live_plain } : {}),
                    ...(live_html ? { content_html: live_html } : {}),
                    tts_voice_persona: selected_tts_voice,
                    tts_language: selected_tts_lang,
                  },
                  true
                );
                set_is_tts_confirm_open(false);
                runAiCardAction(
                  card.id,
                  'note_text_to_voice',
                  `[voice:${selected_tts_voice}][lang:${selected_tts_lang}]`
                );
              }}
            >
              <Volume2 size={11} />
              <span>
                {selected_tts_lang && selected_tts_lang !== 'Auto-Detect'
                  ? `Translate to ${selected_tts_lang} & Create Voice (${selected_tts_voice})`
                  : `Confirm & Create Voice (${selected_tts_voice} · Auto-Detect)`}
              </span>
            </button>
          </div>
        </div>
      )}

      {isCardAiProcessingSignal.value?.cardId === card.id &&
        isCardAiProcessingSignal.value?.actionId === 'note_text_to_voice' && (
          <div
            className={styles['lumen-note-tts-player-bar']}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles['lumen-note-tts-player-header']}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={11} className={styles['lumen-ai-spin-icon']} />
                <span>
                  {(card.tts_language || selected_tts_lang) &&
                  (card.tts_language || selected_tts_lang) !== 'Auto-Detect'
                    ? `Translating to ${card.tts_language || selected_tts_lang} & synthesizing Voice (${normalize_muse_voice_id(card.tts_voice_persona || selected_tts_voice)})...`
                    : `Synthesizing Voice (${normalize_muse_voice_id(card.tts_voice_persona || selected_tts_voice)} · Auto-Detect)...`}
                </span>
              </span>
              <span className={styles['lumen-card-ai-working-timer']} title="AI elapsed running time">
                {formatAiElapsedTime(aiWorkingElapsedSecondsSignal.value)}
              </span>
            </div>
          </div>
        )}

      {/* Inline Voice Audio Player Bar when synthesized audio is present on the Note card */}
      {(card.tts_audio_url || card.tts_audio_base64) && (
        <div
          className={styles['lumen-note-tts-player-bar']}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles['lumen-note-tts-player-header']}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Volume2 size={11} />
              <span>
                Voice ({normalize_muse_voice_id(card.tts_voice_persona)}
                {card.tts_spoken_language || card.tts_language
                  ? ` · ${card.tts_spoken_language || card.tts_language}`
                  : ''}
                {card.tts_translated_text ? ' · Translated' : ''})
              </span>
            </span>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className={styles['lumen-note-tts-reconfig-btn']}
                onClick={() => {
                  set_selected_tts_voice(normalize_muse_voice_id(card.tts_voice_persona));
                  set_selected_tts_lang(card.tts_language || 'Auto-Detect');
                  set_is_tts_confirm_open(true);
                }}
                title="Change Voice or Language and re-generate audio"
              >
                Voice &amp; Lang ▾
              </button>
              {(card.tts_download_url || card.tts_audio_url) && (
                <a
                  href={card.tts_download_url || card.tts_audio_url}
                  download={card.tts_file_name || 'google_tts_note.wav'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: '#5b21b6',
                    textDecoration: 'none',
                  }}
                  title="Download Voice 24kHz WAV"
                >
                  <Download size={11} />
                </a>
              )}
              <button
                type="button"
                onClick={() => clearCardMuseVoiceResult(card.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title="Remove synthesized voice player"
              >
                <X size={11} />
              </button>
            </span>
          </div>

          <audio
            key={card.tts_file_id || card.tts_audio_url || 'note-tts-audio'}
            controls
            preload="metadata"
            src={card.tts_audio_url || card.tts_audio_base64}
            className={styles['lumen-note-tts-audio']}
          />
        </div>
      )}

      <div
        ref={editor_ref}
        contentEditable
        suppressContentEditableWarning
        className={styles['lumen-note-rich-editor']}
        style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
        data-placeholder="Type notes, ideas, or insights..."
        onInput={() => {
          save_selection_range();
          refresh_format_state();
          emit_editor_change(false);
        }}
        onBlur={() => {
          emit_editor_change(true);
        }}
        onKeyUp={refresh_format_state}
        onMouseUp={refresh_format_state}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      />
    </div>
  );
}

// Lazy-loaded specialized card modules via @loadable/component
const LUMEN_embed_card = loadable(() => import('./LUMEN_embed_card.jsx'));
const LUMEN_image_carousel = loadable(() => import('./LUMEN_image_carousel.jsx'));
const LUMEN_board_card = loadable(() => import('./LUMEN_board_card.jsx'));
const LUMEN_file_card = loadable(() => import('./LUMEN_file_card.jsx'));
const LUMEN_geo_card = loadable(() => import('./LUMEN_geo_card.jsx'));
const LUMEN_palette_card = loadable(() => import('./LUMEN_palette_card.jsx'));
const LUMEN_group_card = loadable(() => import('./LUMEN_group_card.jsx'));
const LUMEN_stock_card = loadable(() => import('./LUMEN_stock_card.jsx'));
const LUMEN_sheets_card = loadable(() => import('./LUMEN_sheets_card.jsx'));
const LUMEN_docs_card = loadable(() => import('./LUMEN_docs_card.jsx'));
const LUMEN_code_card = loadable(() => import('./LUMEN_code_card.jsx'));
const LUMEN_canvas_card = loadable(() => import('./LUMEN_canvas_card.jsx'));
const LUMEN_item_card = loadable(() => import('./LUMEN_item_card.jsx'));
const LUMEN_sound_recorder_card = loadable(() => import('./LUMEN_sound_recorder_card.jsx'));
const LUMEN_currency_card = loadable(() => import('./LUMEN_currency_card.jsx'));
const LUMEN_clock_card = loadable(() => import('./LUMEN_clock_card.jsx'));

import { openCanvasFullscreen } from '../../signals/canvasCardState.js';
import {
  aiCitedCardIdsSignal,
  aiActiveHoverCardIdSignal,
  getCardAiActions,
  runAiCardAction,
  improveImagePromptWithMuse,
  isCardAiProcessingSignal,
  aiWorkingElapsedSecondsSignal,
  formatAiElapsedTime,
  getSelectedAiModelForTask,
  resolveAiTaskCategoryForAction,
} from '../../signals/aiState.js';
import {
  updateCard,
  deleteCard,
  duplicateCard,
  bringToFront,
  sendToBack,
  addConnection,
  selectedCardsSignal,
  activeBoardSignal,
  snapToGrid,
  snapToGridSignal,
  connectingSourceSignal,
  tempConnectionLineSignal,
  activeToolSignal,
  showToast,
  pushHistorySnapshot,
  saveCurrentBoardToStore,
  openImageViewer,
  setActiveBoard,
  openPropertyPanel,
  isPropertyPanelOpenSignal,
  toggleCardPropertyPanel,
  get_tag_color,
  COMMON_REACTION_EMOJIS,
  activeTagFilterSignal,
  setTagFilter,
  addCardToGroup,
  removeCardFromGroup,
  autoLayoutGroupColumn,
  activeDropTargetGroupIdSignal,
  unlockedCardsSignal,
  lockCard,
  unlockCard,
  resolve_card_style,
  resolve_card_font_family,
  clearCardMuseVoiceResult,
  activeTimeRangeFilterSignal,
  mark_card_interaction_start,
  mark_card_interaction_end,
  patchCardOnServer,
} from '../../signals/boardState.js';
import {
  get_card_time_range_status,
  does_card_match_time_filter,
} from '../../utils/googleCalendarSync.js';
import {
  cardCommentsSignal,
  openCardCommentsDrawer,
  multiUserToggleReaction,
  multiUserAddTag,
  multiUserRemoveTag,
  currentUserSignal,
  COLLABORATOR_PROFILES,
  broadcastCardMove,
  broadcastCardUpdate,
  broadcastCardSelect,
  remoteCardSelectionsSignal,
  CLIENT_SESSION_ID,
} from '../../signals/realtimeState.js';

import imgArch from '../../assets/images/lumen_mood_arch_1791015833203.jpg';

const COLOR_OPTIONS = [
  { key: 'white', hex: '#ffffff', label: 'Default' },
  { key: 'yellow', hex: '#fef08a', label: 'Yellow' },
  { key: 'peach', hex: '#fed7aa', label: 'Peach' },
  { key: 'green', hex: '#bbf7d0', label: 'Green' },
  { key: 'blue', hex: '#bae6fd', label: 'Blue' },
  { key: 'purple', hex: '#e9d5ff', label: 'Purple' },
  { key: 'rose', hex: '#fecdd3', label: 'Rose' },
  { key: 'dark', hex: '#1e293b', label: 'Slate' },
];

const renderCardTypeIcon = (type, platform) => {
  switch (type) {
    case 'note':
      return <FileText size={13} />;
    case 'tasklist':
      return <CheckSquare size={13} />;
    case 'heading':
      return <Heading size={13} />;
    case 'image':
      return <ImageIcon size={13} />;
    case 'link':
      return <Link2 size={13} />;
    case 'board':
      return <FolderKanban size={13} />;
    case 'file':
      return <Paperclip size={13} />;
    case 'geo':
      return <MapPin size={13} />;
    case 'quote':
      return <Quote size={13} />;
    case 'group':
      return <Boxes size={13} />;
    case 'stock':
      return <TrendingUp size={13} />;
    case 'sheets':
      return <FileSpreadsheet size={13} />;
    case 'docs':
      return <FileEdit size={13} />;
    case 'code':
      return <Code2 size={13} />;
    case 'canvas':
      return <PenTool size={13} />;
    case 'sound_recorder':
      return <Mic size={13} />;
    case 'currency':
      return <Coins size={13} />;
    case 'clock':
      return <Clock size={13} />;
    case 'embed':
    case 'social':
      if (['spotify', 'soundcloud'].includes(platform)) return <Music size={13} />;
      if (['vimeo', 'bilibili', 'youtube'].includes(platform)) return <Video size={13} />;
      if (platform === 'instagram') return <Instagram size={13} />;
      return <Radio size={13} />;
    default:
      return <FileText size={13} />;
  }
};

const getCardTypeLabel = (type, platform) => {
  switch (type) {
    case 'note':
      return 'Note card';
    case 'file':
      return 'Attached File & Download';
    case 'geo':
      return 'Geo Map Location card';
    case 'tasklist':
      return 'Checklist card';
    case 'heading':
      return 'Heading card';
    case 'image':
      return 'Image card';
    case 'link':
      return 'Link bookmark card';
    case 'quote':
      return 'Quote card';
    case 'stock':
      return 'Real-Time Global Stock card';
    case 'sheets':
      return 'Google Sheets Spreadsheet card';
    case 'docs':
      return 'Google Docs rich document card';
    case 'code':
      return 'Code snippet & developer sharing card';
    case 'canvas':
      return 'Canvas drawing & sketch card';
    case 'sound_recorder':
      return 'Sound Recorder & AI Transcribe/Translate card';
    case 'currency':
      return 'Multi-Currency Calculator card';
    case 'clock':
      return 'Realtime Clock, Stopwatch, Countdown & Alarm card';
    case 'group':
      return 'Group container card';
    case 'board':
      return 'Nested Sub-Board card';
    case 'embed':
    case 'social':
      if (platform === 'spotify') return 'Web Embed (Spotify)';
      if (platform === 'soundcloud') return 'Web Embed (SoundCloud)';
      if (platform === 'vimeo') return 'Web Embed (Vimeo)';
      if (platform === 'bilibili') return 'Web Embed (Bilibili)';
      if (platform === 'youtube') return 'Web Embed (YouTube)';
      if (platform === 'instagram') return 'Web Embed (Instagram)';
      if (platform === 'tiktok') return 'Web Embed (TikTok)';
      if (platform === 'x') return 'Web Embed (X / Twitter)';
      if (platform === 'threads') return 'Web Embed (Threads)';
      if (platform === 'pinterest') return 'Web Embed (Pinterest)';
      return 'Web Embed card';
    default:
      return 'Card';
  }
};

const safeGetDomain = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return 'website.com';
  const trimmed = rawUrl.trim();
  if (!trimmed) return 'website.com';
  try {
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./, '') || 'website.com';
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split('/')[0] || 'website.com';
  }
};

const safeGetHref = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '#';
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
};

/**
 * Switch case helper to determine initial card dimensions based on card type.
 * note: 360 x 216
 * checklist: 360 x 288
 * heading: 360 x 168
 * image carousel: 360 x 360
 * sketch: 520 x 360
 * group: 388 x 528
 * rich document: 528 x 528
 * spreadsheet: 672 x 528
 * stock: 550 x 600
 * location: 360 x 528
 * color: 360 x 336
 * file: 360 x 360
 * media: 388 x 388
 * social media link: 360 x 720
 * nested board: 360 x 360
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
    case 'media':
    case 'embed':
      return { width: 388, height: 388 };
    case 'social media link':
    case 'social':
      return { width: 360, height: 765 };
    case 'nested board':
    case 'board':
      return { width: 360, height: 360 };
    case 'link':
      return { width: 360, height: 216 };
    case 'item':
    case 'product':
      return { width: 340, height: 380 };
    case 'sound_recorder':
      return { width: 384, height: 320 };
    case 'currency':
      return { width: 420, height: 460 };
    case 'clock':
      return { width: 396, height: 440 };
    default:
      return { width: 360, height: 216 };
  }
}

export default function Card({ card }) {
  useSignals();
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDim, setResizeDim] = useState({ w: card.width, h: card.height });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [is_tag_popover_open, set_is_tag_popover_open] = useState(false);
  const [is_reaction_popover_open, set_is_reaction_popover_open] = useState(false);
  const [is_ai_popover_open, set_is_ai_popover_open] = useState(false);
  const [active_ai_action_popup, set_active_ai_action_popup] = useState(null);
  const [custom_ai_instruction, set_custom_ai_instruction] = useState('');
  const [use_reference_image, set_use_reference_image] = useState(false);
  const [reference_strength, set_reference_strength] = useState(0.45);
  const [ai_image_size, set_ai_image_size] = useState(() => card.image_size || 'auto');
  const [ai_output_format, set_ai_output_format] = useState(() => card.output_format || 'jpg');
  const [ai_reasoning_strength, set_ai_reasoning_strength] = useState(
    () => card.reasoning_strength || 'high'
  );
  const [ai_image_search, set_ai_image_search] = useState(true);
  const [ai_web_search, set_ai_web_search] = useState(true);
  const [ai_shell, set_ai_shell] = useState(true);
  const [ai_auto_improve_prompt, set_ai_auto_improve_prompt] = useState(true);
  const [is_improving_ai_prompt, set_is_improving_ai_prompt] = useState(false);
  const [custom_tag_input, set_custom_tag_input] = useState('');
  const [custom_emoji_input, set_custom_emoji_input] = useState('');
  const [is_fetching_link_meta, set_is_fetching_link_meta] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const hasToggledMultiInMouseDownRef = useRef(false);

  const card_encryption_meta = card.card_encryption || card.cardEncryption;
  const is_card_encrypted = Boolean(card_encryption_meta && card_encryption_meta.ciphertext);
  const is_card_unlocked = Boolean(unlockedCardsSignal.value[card.id] || card.is_encryption_unlocked);
  const is_card_locked = is_card_encrypted && !is_card_unlocked;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = (e) => {
    // If moving to another element inside this card hierarchy, do not exit hover
    if (e?.relatedTarget instanceof Node && cardRef.current?.contains(e.relatedTarget)) {
      return;
    }
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setShowColorPicker(false);
    }, 350);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Set initial dimensions via switch-case and auto-clean card attributes
  useEffect(() => {
    // Ensure card initial dimensions are set via switch-case if missing
    if (card.width === undefined || card.width === null || card.height === undefined || card.height === null) {
      let initial_w;
      let initial_h;
      switch (card.type) {
        case 'note':
          initial_w = 360;
          initial_h = 216;
          break;
        case 'checklist':
        case 'tasklist':
          initial_w = 360;
          initial_h = 288;
          break;
        case 'heading':
          initial_w = 360;
          initial_h = 168;
          break;
        case 'image carousel':
        case 'image':
          initial_w = 360;
          initial_h = 360;
          break;
        case 'sketch':
        case 'canvas':
          initial_w = 520;
          initial_h = 360;
          break;
        case 'group':
          initial_w = 388;
          initial_h = 528;
          break;
        case 'rich document':
        case 'docs':
        case 'document':
          initial_w = 528;
          initial_h = 528;
          break;
        case 'spreadsheet':
        case 'sheets':
          initial_w = 672;
          initial_h = 528;
          break;
        case 'stock':
          initial_w = 550;
          initial_h = 600;
          break;
        case 'location':
        case 'geo':
          initial_w = 360;
          initial_h = 528;
          break;
        case 'color':
          case 'palette':
          initial_w = 360;
          initial_h = 336;
          break;
        case 'file':
          initial_w = 360;
          initial_h = 360;
          break;
        case 'media':
        case 'embed':
          initial_w = 388;
          initial_h = 388;
          break;
        case 'social media link':
        case 'social':
          initial_w = 360;
          initial_h = 720;
          break;
        case 'nested board':
        case 'board':
          initial_w = 360;
          initial_h = 360;
          break;
        case 'sound_recorder':
          initial_w = 384;
          initial_h = 320;
          break;
        default:
          initial_w = 360;
          initial_h = 216;
          break;
      }
      updateCard(
        card.id,
        {
          width: card.width !== undefined && card.width !== null ? card.width : initial_w,
          height: card.height !== undefined && card.height !== null ? card.height : initial_h,
        },
        true
      );
    }

    if (
      (card.type === 'social' || card.type === 'embed') &&
      typeof card.title === 'string' &&
      (card.title.includes('kere') || card.title.startsWith('Reel · @') || card.title.startsWith('Post · @'))
    ) {
      updateCard(
        card.id,
        {
          title: card.social_type === 'post' ? 'Instagram Post' : 'Instagram Reel',
          height: 720,
        },
        true
      );
    }
    // Auto-heal broken TikTok cards with official embed ID
    if (
      (card.type === 'social' || card.type === 'embed') &&
      card.platform === 'tiktok' &&
      (!card.video_id || card.video_id === '738291049281' || card.url?.includes('738291049281'))
    ) {
      updateCard(
        card.id,
        {
          url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
          video_id: '6718335390845095173',
          title: 'TikTok Video',
          height: 720,
        },
        true
      );
    }
    // Auto-heal legacy default dimensions for stock card to 550 x 600
    if (card.type === 'stock' && ((card.width === 384 && card.height === 380) || (card.width === 500 && card.height === 550))) {
      updateCard(card.id, { width: 550, height: 600 }, false);
    }
    // Auto-clean legacy default file on file card if no user file data exists
    if (
      card.type === 'file' &&
      (card.file_id === 'file_seed_guidelines_pdf' || card.title === 'Brand_Guidelines_Spec_v2.pdf' || card.file_name === 'Brand_Guidelines_Spec_v2.pdf') &&
      !card.file_data
    ) {
      updateCard(
        card.id,
        {
          title: 'File Attachment',
          file_name: undefined,
          file_id: undefined,
          file_size: undefined,
          file_type: undefined,
          file_url: undefined,
          view_url: undefined,
          file_extension: undefined,
          download_count: 0,
        },
        true
      );
    }
  }, [card.id, card.title, card.type, card.social_type, card.platform, card.video_id, card.url, card.width, card.height, card.file_id, card.file_name, card.file_data]);

  // Fetch OpenGraph metadata (image, title, web status, favicon) for link bookmark cards
  const refresh_link_metadata = async (target_url_override = null, force = true) => {
    const raw_url = target_url_override !== null ? target_url_override : card.url;
    if (!raw_url || typeof raw_url !== 'string') return;
    const clean_url = raw_url.trim();
    if (!clean_url || clean_url === '#' || clean_url === 'https://') return;

    try {
      set_is_fetching_link_meta(true);
      const res = await fetch(`/api/weblink/metadata?url=${encodeURIComponent(clean_url)}`);
      if (!res.ok) throw new Error('Metadata fetch failed');
      const data = await res.json();
      if (data) {
        const updates = {
          meta_resolved_url: clean_url,
          web_status: data.status || 200,
          web_status_text: data.status_text || '200 OK',
          web_is_live: data.is_live !== false,
          domain: data.domain || safeGetDomain(clean_url),
        };
        // Refresh image
        if (data.image) {
          updates.og_image = data.image;
        } else if (force && !data.image) {
          // If explicitly refreshed and site has no OG image, keep current or fallback
        }
        if (data.favicon) {
          updates.favicon = data.favicon;
        }
        // Always refresh title if force is true or if title matches default/previous or empty
        if (data.title) {
          if (force || !card.title || card.title === 'Design Systems Repository' || card.title === 'Bookmark' || card.title === 'Web Bookmark / Link' || card.title === card.domain) {
            updates.title = data.title;
          }
        }
        if (data.description && (!card.description || force)) {
          updates.description = data.description;
          updates.content = data.description;
        }
        // Auto-adjust height to 320 for rich visual preview if card is at minimum default height
        if ((updates.og_image || card.og_image) && (!card.height || card.height <= 220)) {
          updates.height = 320;
        }
        updateCard(card.id, updates, true);
        if (force) {
          showToast('Updated link metadata & preview image');
        }
      }
    } catch (err) {
      updateCard(
        card.id,
        {
          meta_resolved_url: clean_url,
          web_status: 200,
          web_status_text: 'Live',
          web_is_live: true,
        },
        false
      );
      if (force) {
        showToast('Checked link status');
      }
    } finally {
      set_is_fetching_link_meta(false);
    }
  };

  useEffect(() => {
    if (card.type !== 'link') return;
    if (!card.url || typeof card.url !== 'string') return;
    const clean_url = card.url.trim();
    if (!clean_url || clean_url === '#' || clean_url === 'https://') return;

    // Check if URL changed since last resolution
    if (card.meta_resolved_url === clean_url && card.web_status) {
      return;
    }

    const debounce_timer = setTimeout(() => {
      refresh_link_metadata(clean_url, false);
    }, 400);

    return () => {
      clearTimeout(debounce_timer);
    };
  }, [card.id, card.type, card.url, card.meta_resolved_url, card.web_status]);

  const isSelected = selectedCardsSignal.value.includes(card.id);
  const is_multiple_selection = (selectedCardsSignal.value || []).length > 1;
  const is_property_panel_active =
    Boolean(isPropertyPanelOpenSignal.value) &&
    isSelected &&
    (selectedCardsSignal.value || []).length === 1;

  useEffect(() => {
    if (is_multiple_selection) {
      if (is_tag_popover_open) set_is_tag_popover_open(false);
      if (is_reaction_popover_open) set_is_reaction_popover_open(false);
      if (showColorPicker) setShowColorPicker(false);
    }
  }, [is_multiple_selection]);
  const isConnectingTarget =
    connectingSourceSignal.value && connectingSourceSignal.value !== card.id;

  const zoom = activeBoardSignal.value.viewport?.zoom || 1;
  const snap = snapToGridSignal.value;

  // Handle Dragging
  const handleDragMouseDown = (e) => {
    // Only left click
    if (e.button !== 0) return;
    if (activeToolSignal.value === 'connect' || activeToolSignal.value === 'hand') return;
    if (
      e.target &&
      typeof e.target.closest === 'function' &&
      !e.target.closest('[data-lumen-seamless-rail="true"]') &&
      e.target.closest('[data-lumen-no-card-drag="true"]')
    ) {
      return;
    }

    if (card.locked) {
      showToast(`Card "${card.title || 'Card'}" is locked (unlock in Layers panel)`);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        const cur = selectedCardsSignal.value || [];
        const next = cur.includes(card.id) ? cur.filter((id) => id !== card.id) : [...cur, card.id];
        selectedCardsSignal.value = next;
        if (typeof broadcastCardSelect === 'function') broadcastCardSelect(next);
      } else {
        selectedCardsSignal.value = [card.id];
        if (typeof broadcastCardSelect === 'function') broadcastCardSelect([card.id]);
      }
      openPropertyPanel();
      return;
    }

    e.stopPropagation();

    const isMultiKey = e.shiftKey || e.metaKey || e.ctrlKey;
    const currentSelected = selectedCardsSignal.value || [];
    const isAlreadySelected = currentSelected.includes(card.id);

    let activeSelectedIds = currentSelected;

    if (isMultiKey) {
      hasToggledMultiInMouseDownRef.current = true;
      if (isAlreadySelected) {
        activeSelectedIds = currentSelected.filter((id) => id !== card.id);
        selectedCardsSignal.value = activeSelectedIds;
        if (typeof broadcastCardSelect === 'function') broadcastCardSelect(activeSelectedIds);
        return; // Deselected card; stop drag
      } else {
        activeSelectedIds = [...currentSelected, card.id];
        selectedCardsSignal.value = activeSelectedIds;
        if (typeof broadcastCardSelect === 'function') broadcastCardSelect(activeSelectedIds);
      }
    } else {
      if (!isAlreadySelected) {
        activeSelectedIds = [card.id];
        selectedCardsSignal.value = activeSelectedIds;
        if (typeof broadcastCardSelect === 'function') broadcastCardSelect(activeSelectedIds);
      } else {
        // Keep all currently selected cards intact so multi-selection moves together!
        activeSelectedIds = currentSelected;
      }
    }

    openPropertyPanel();

    pushHistorySnapshot();
    setIsDragging(true);
    document.body.style.userSelect = 'none';

    const isMultiCardMove = activeSelectedIds.length > 1 && activeSelectedIds.includes(card.id);
    const allBoardCards = activeBoardSignal.value.cards || [];

    // Capture starting positions of all selected cards for simultaneous movement
    const startMultiPositions = isMultiCardMove
      ? allBoardCards
          .filter((c) => activeSelectedIds.includes(c.id))
          .map((c) => ({
            id: c.id,
            startX: c.x,
            startY: c.y,
            title: c.title,
            type: c.type,
          }))
      : [];

    const isGroup = !isMultiCardMove && card.type === 'group';
    const childCards = isGroup
      ? allBoardCards.filter(
          (c) => (Array.isArray(card.card_ids) && card.card_ids.includes(c.id)) || c.group_id === card.id
        )
      : [];
    const startChildrenPositions = childCards.map((c) => ({
      id: c.id,
      startX: c.x,
      startY: c.y,
    }));

    const interacting_ids = isMultiCardMove
      ? startMultiPositions.map((p) => p.id)
      : isGroup
      ? [card.id, ...startChildrenPositions.map((p) => p.id)]
      : [card.id];
    mark_card_interaction_start(interacting_ids);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startCardX = card.x;
    const startCardY = card.y;
    let hasMoved = false;
    let finalX = startCardX;
    let finalY = startCardY;
    let lastDragEmit = 0;

    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startMouseX) / zoom;
      const deltaY = (moveEvent.clientY - startMouseY) / zoom;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasMoved = true;
      }

      let effDeltaX = deltaX;
      let effDeltaY = deltaY;

      if (snap) {
        effDeltaX = snapToGrid(startCardX + deltaX) - startCardX;
        effDeltaY = snapToGrid(startCardY + deltaY) - startCardY;
      } else {
        effDeltaX = Math.round(effDeltaX);
        effDeltaY = Math.round(effDeltaY);
      }

      finalX = startCardX + effDeltaX;
      finalY = startCardY + effDeltaY;

      if (isMultiCardMove) {
        // Move all selected cards simultaneously!
        startMultiPositions.forEach((pos) => {
          updateCard(pos.id, { x: pos.startX + effDeltaX, y: pos.startY + effDeltaY }, false);
        });

        const now = Date.now();
        if (now - lastDragEmit > 20) {
          lastDragEmit = now;
          startMultiPositions.forEach((pos) => {
            broadcastCardMove(pos.id, pos.startX + effDeltaX, pos.startY + effDeltaY, false);
          });
        }
      } else {
        updateCard(card.id, { x: finalX, y: finalY }, false);

        const now = Date.now();
        const shouldEmitDrag = now - lastDragEmit > 20;
        if (shouldEmitDrag) {
          lastDragEmit = now;
          broadcastCardMove(card.id, finalX, finalY, false);
        }

        if (isGroup && childCards.length > 0) {
          startChildrenPositions.forEach((pos) => {
            let cX = pos.startX + effDeltaX;
            let cY = pos.startY + effDeltaY;
            updateCard(pos.id, { x: cX, y: cY }, false);
            if (shouldEmitDrag) {
              broadcastCardMove(pos.id, cX, cY, false);
            }
          });
        } else if (!isGroup) {
          // Track whether dragged card is hovering over any group drop zone
          const card_initial = get_card_initial_dimension(card.type);
          const curCenterX = finalX + (card.width || card_initial.width) / 2;
          const curCenterY = finalY + (card.height || card_initial.height) / 2;
          const allCards = activeBoardSignal.value.cards || [];
          const hoveredGroup = allCards.find(
            (g) =>
              g.type === 'group' &&
              g.id !== card.id &&
              curCenterX >= g.x - 30 &&
              curCenterX <= g.x + g.width + 30 &&
              curCenterY >= g.y &&
              curCenterY <= g.y + g.height + 40
          );
          activeDropTargetGroupIdSignal.value = hoveredGroup ? hoveredGroup.id : null;
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      mark_card_interaction_end(interacting_ids);
      activeDropTargetGroupIdSignal.value = null;
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // If user simply clicked an already selected card without dragging and without Shift,
      // narrow selection down to just this single card
      if (!hasMoved && !isMultiKey && isAlreadySelected && activeSelectedIds.length > 1) {
        selectedCardsSignal.value = [card.id];
        if (typeof broadcastCardSelect === 'function') broadcastCardSelect([card.id]);
        return;
      }

      if (!hasMoved) {
        return;
      }

      if (isMultiCardMove) {
        const effDeltaX = finalX - startCardX;
        const effDeltaY = finalY - startCardY;
        startMultiPositions.forEach((pos) => {
          const finalCardX = pos.startX + effDeltaX;
          const finalCardY = pos.startY + effDeltaY;
          updateCard(pos.id, { x: finalCardX, y: finalCardY }, false);
          broadcastCardMove(pos.id, finalCardX, finalCardY, true, pos.title || 'Card', pos.type);
          patchCardOnServer(pos.id, { x: finalCardX, y: finalCardY });
        });
        saveCurrentBoardToStore({ immediate: true });
        return;
      }

      // Finalize single move with latest finalX and finalY and persist to store
      updateCard(card.id, { x: finalX, y: finalY }, false);
      broadcastCardMove(card.id, finalX, finalY, true, card.title || 'Card', card.type);
      patchCardOnServer(card.id, { x: finalX, y: finalY });

      if (isGroup && childCards.length > 0) {
        const finalDeltaX = finalX - startCardX;
        const finalDeltaY = finalY - startCardY;
        startChildrenPositions.forEach((pos) => {
          let cX = pos.startX + finalDeltaX;
          let cY = pos.startY + finalDeltaY;
          if (snap) {
            cX = snapToGrid(cX);
            cY = snapToGrid(cY);
          }
          updateCard(pos.id, { x: cX, y: cY }, false);
          broadcastCardMove(pos.id, cX, cY, true);
          patchCardOnServer(pos.id, { x: cX, y: cY });
        });
      } else if (!isGroup) {
        // If regular card was dragged, check if dropped inside or outside a group
        const card_initial = get_card_initial_dimension(card.type);
        const cardCenterX = finalX + (card.width || card_initial.width) / 2;
        const cardCenterY = finalY + (card.height || card_initial.height) / 2;
        const currentBoardCards = activeBoardSignal.value.cards || [];
        const targetGroup = currentBoardCards.find(
          (g) =>
            g.type === 'group' &&
            g.id !== card.id &&
            cardCenterX >= g.x - 30 &&
            cardCenterX <= g.x + g.width + 30 &&
            cardCenterY >= g.y &&
            cardCenterY <= g.y + g.height + 40
        );

        if (targetGroup) {
          // Card dropped into targetGroup (or dragged within same group)
          const otherMembers = (Array.isArray(targetGroup.card_ids) ? targetGroup.card_ids : []).filter(
            (id) => id !== card.id
          );
          const otherMemberCards = currentBoardCards.filter((c) => otherMembers.includes(c.id));
          // Calculate insertion index in 1-column stack based on drop Y
          let insertIdx = otherMemberCards.length;
          for (let i = 0; i < otherMemberCards.length; i++) {
            const m = otherMemberCards[i];
            const mCenterY = m.y + (m.height || 200) / 2;
            if (cardCenterY < mCenterY) {
              insertIdx = i;
              break;
            }
          }

          if (card.group_id !== targetGroup.id) {
            if (card.group_id) {
              removeCardFromGroup(card.group_id, card.id);
            }
            addCardToGroup(targetGroup.id, card.id, insertIdx);
          } else {
            // Already in this group - reorder in the 1-column stack and auto-layout & auto-resize
            const newIds = [...otherMembers];
            newIds.splice(insertIdx, 0, card.id);
            autoLayoutGroupColumn(targetGroup.id, newIds, false);
          }
        } else if (card.group_id && !targetGroup) {
          // Card was previously in a group, but dragged completely outside
          removeCardFromGroup(card.group_id, card.id);
        }
      }

      saveCurrentBoardToStore({ immediate: true });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Mobile Touch Dragging for Cards
  const handleDragTouchStart = (e) => {
    if (activeToolSignal.value === 'connect' || activeToolSignal.value === 'hand') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')) return;
    if (
      e.target &&
      typeof e.target.closest === 'function' &&
      !e.target.closest('[data-lumen-seamless-rail="true"]') &&
      e.target.closest('[data-lumen-no-card-drag="true"]')
    ) {
      return;
    }
    if (card.locked) {
      selectedCardsSignal.value = [card.id];
      showToast(`Card "${card.title || 'Card'}" is locked`);
      return;
    }
    if (e.touches.length !== 1) return;

    e.stopPropagation();
    selectedCardsSignal.value = [card.id];
    if (typeof broadcastCardSelect === 'function') broadcastCardSelect([card.id]);
    openPropertyPanel();
    pushHistorySnapshot();
    setIsDragging(true);
    mark_card_interaction_start([card.id]);

    const touch = e.touches[0];
    const startTouchX = touch.clientX;
    const startTouchY = touch.clientY;
    const startCardX = card.x;
    const startCardY = card.y;
    let finalX = startCardX;
    let finalY = startCardY;
    let hasTouchMoved = false;
    let lastTouchEmit = 0;

    const handleTouchMove = (moveEvt) => {
      if (moveEvt.touches.length !== 1) return;
      if (moveEvt.cancelable) moveEvt.preventDefault();
      const curTouch = moveEvt.touches[0];
      const deltaX = (curTouch.clientX - startTouchX) / zoom;
      const deltaY = (curTouch.clientY - startTouchY) / zoom;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasTouchMoved = true;
      }

      let effDeltaX = deltaX;
      let effDeltaY = deltaY;
      if (snap) {
        effDeltaX = snapToGrid(startCardX + deltaX) - startCardX;
        effDeltaY = snapToGrid(startCardY + deltaY) - startCardY;
      } else {
        effDeltaX = Math.round(effDeltaX);
        effDeltaY = Math.round(effDeltaY);
      }
      finalX = startCardX + effDeltaX;
      finalY = startCardY + effDeltaY;
      updateCard(card.id, { x: finalX, y: finalY }, false);

      const now = Date.now();
      if (now - lastTouchEmit > 20) {
        lastTouchEmit = now;
        broadcastCardMove(card.id, finalX, finalY, false);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      mark_card_interaction_end([card.id]);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (!hasTouchMoved) {
        return;
      }
      updateCard(card.id, { x: finalX, y: finalY }, false);
      broadcastCardMove(card.id, finalX, finalY, true, card.title || 'Card', card.type);
      patchCardOnServer(card.id, { x: finalX, y: finalY });
      if (card.group_id && card.type !== 'group') {
        const card_initial = get_card_initial_dimension(card.type);
        const cardCenterX = finalX + (card.width || card_initial.width) / 2;
        const cardCenterY = finalY + (card.height || card_initial.height) / 2;
        const currentBoardCards = activeBoardSignal.value?.cards || [];
        const parentGrp = currentBoardCards.find(
          (g) => g.type === 'group' && g.id === card.group_id
        );
        if (
          !parentGrp ||
          cardCenterX < parentGrp.x - 30 ||
          cardCenterX > parentGrp.x + parentGrp.width + 30 ||
          cardCenterY < parentGrp.y ||
          cardCenterY > parentGrp.y + parentGrp.height + 40
        ) {
          removeCardFromGroup(card.group_id, card.id);
        }
      }
      saveCurrentBoardToStore({ immediate: true });
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Handle Resizing
  const handleResizeMouseDown = (e, handleType = 'corner') => {
    if (e.button !== 0 || card.locked) return;
    e.stopPropagation();

    pushHistorySnapshot();
    setIsResizing(true);
    mark_card_interaction_start([card.id]);
    document.body.style.userSelect = 'none';

    const is_image_with_note =
      card.type === 'image' &&
      resolve_card_style(card, activeBoardSignal.value) !== 'seamless' &&
      Boolean(card.ai_notes || card.content);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWidth =
      card.width != null && !isNaN(card.width)
        ? Number(card.width)
        : get_card_initial_dimension(card.type).width;
    const startHeight =
      card.type === 'image' && is_image_with_note && !card.user_resized_image_card
        ? Math.max(Number(card.height) || 360, 464)
        : card.height != null && !isNaN(card.height)
        ? Number(card.height)
        : get_card_initial_dimension(card.type).height;
    const startX = card.x;
    const startY = card.y;
    let finalWidth = startWidth;
    let finalHeight = startHeight;
    let finalX = startX;
    let finalY = startY;
    let lastResizeEmit = 0;

    const isWestHandle = handleType === 'sw' || handleType === 'left' || handleType === 'w' || handleType === 'nw';
    const isEastHandle = handleType === 'corner' || handleType === 'se' || handleType === 'right' || handleType === 'e' || handleType === 'ne';
    const isNorthHandle = handleType === 'top' || handleType === 'n' || handleType === 'ne' || handleType === 'nw';
    const isSouthHandle = handleType === 'corner' || handleType === 'se' || handleType === 'bottom' || handleType === 's' || handleType === 'sw';

    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startMouseX) / zoom;
      const deltaY = (moveEvent.clientY - startMouseY) / zoom;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX;
      let newY = startY;

      // Group, Sheets, and Docs cards have strict minimum dimensions
      const minW = card.type === 'sheets' || card.type === 'docs' || card.type === 'canvas' ? 360 : (card.type === 'group' ? 320 : (card.type === 'stock' ? 280 : 220));
      const minH = card.type === 'heading'
        ? (headingMinHeight || 96)
        : card.type === 'image'
        ? (is_image_with_note ? 300 : 220)
        : (card.type === 'sheets' || card.type === 'docs' || card.type === 'canvas' ? 240 : (card.type === 'group' ? 120 : (card.type === 'stock' ? 220 : 64)));

      // Handle X / width adjustments based on handle direction
      if (isEastHandle) {
        const rawW = startWidth + deltaX;
        newWidth = Math.max(minW, snap ? snapToGrid(rawW) : Math.round(rawW));
      } else if (isWestHandle) {
        const rawW = startWidth - deltaX;
        newWidth = Math.max(minW, snap ? snapToGrid(rawW) : Math.round(rawW));
        newX = Math.round(startX + (startWidth - newWidth));
      }

      // Handle Y / height adjustments based on handle direction
      if (isSouthHandle) {
        const rawH = startHeight + deltaY;
        newHeight = Math.max(minH, snap ? snapToGrid(rawH) : Math.round(rawH));
      } else if (isNorthHandle) {
        const rawH = startHeight - deltaY;
        newHeight = Math.max(minH, snap ? snapToGrid(rawH) : Math.round(rawH));
        newY = Math.round(startY + (startHeight - newHeight));
      }

      finalWidth = newWidth;
      finalHeight = newHeight;
      finalX = newX;
      finalY = newY;
      setResizeDim({ w: newWidth, h: newHeight });

      const updates = {
        width: newWidth,
        height: newHeight,
        ...(card.type === 'image'
          ? {
              user_resized_image_card: true,
              base_height_without_note: null,
            }
          : {}),
        x: newX,
        y: newY,
      };

      if (card.type === 'group') {
        updates.column_width = Math.max(280, newWidth - 40);
      }

      updateCard(card.id, updates, false);

      const now = Date.now();
      if (now - lastResizeEmit > 20) {
        lastResizeEmit = now;
        broadcastCardMove(card.id, newX, newY, false, card.title || 'Card', card.type, newWidth, newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      mark_card_interaction_end([card.id]);
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      // Finalize resize with latest final coordinates/dimensions and persist to store
      const finalUpdates = {
        width: finalWidth,
        height: finalHeight,
        ...(card.type === 'image'
          ? {
              user_resized_image_card: true,
              base_height_without_note: null,
            }
          : {}),
        x: finalX,
        y: finalY,
      };
      if (card.type === 'group') {
        finalUpdates.column_width = Math.max(280, finalWidth - 40);
      }

      updateCard(card.id, finalUpdates, false);
      broadcastCardMove(
        card.id,
        finalX,
        finalY,
        true,
        card.title || 'Card',
        card.type,
        finalWidth,
        finalHeight
      );
      broadcastCardUpdate(card.id, finalUpdates, false);
      patchCardOnServer(card.id, finalUpdates);

      if (card.group_id) {
        const current_cards = activeBoardSignal.value?.cards || [];
        const parent_grp = current_cards.find((c) => c.id === card.group_id && c.type === 'group');
        if (parent_grp) {
          if (finalWidth !== startWidth) {
            const new_col_w = Math.max(280, finalWidth);
            const new_grp_w = Math.max(320, new_col_w + 40);
            activeBoardSignal.value = {
              ...activeBoardSignal.value,
              cards: current_cards.map((c) =>
                c.id === parent_grp.id
                  ? { ...c, column_width: new_col_w, width: new_grp_w, updatedAt: Date.now() }
                  : c
              ),
            };
          }
          autoLayoutGroupColumn(card.group_id);
        } else {
          // Clear orphaned group_id if parent group no longer exists
          updateCard(card.id, { group_id: null }, false);
        }
      } else if (card.type === 'group') {
        autoLayoutGroupColumn(card.id);
      }
      saveCurrentBoardToStore({ immediate: true });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Auto-resize card dimensions based on original content
  const handleAutoResizeContent = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    pushHistorySnapshot();

    let newWidth = card.width;
    let newHeight = card.height;

    if (card.type === 'social' || card.type === 'embed') {
      const platform = card.platform || (card.type === 'social' ? 'instagram' : 'spotify');
      const socialType = card.social_type || (platform === 'instagram' ? 'reel' : 'track');
      const curW = card.width || 384;

      if (platform === 'spotify') {
        newWidth = Math.max(360, curW);
        newHeight = socialType === 'playlist' || socialType === 'album' || socialType === 'show' ? 440 : 232;
      } else if (platform === 'soundcloud') {
        newWidth = Math.max(360, curW);
        newHeight = socialType === 'playlist' || socialType === 'set' ? 420 : 240;
      } else if (platform === 'vimeo') {
        newWidth = Math.max(360, curW);
        newHeight = Math.max(300, Math.round((newWidth - 24) * (9 / 16)) + 126);
      } else if (platform === 'bilibili') {
        newWidth = Math.max(360, curW);
        newHeight = Math.max(310, Math.round((newWidth - 24) * (9 / 16)) + 136);
      } else if (platform === 'youtube') {
        if (socialType === 'shorts') {
          newWidth = Math.max(312, Math.min(curW, 360));
          newHeight = Math.round((newWidth - 24) * (16 / 9)) + 126;
        } else {
          newWidth = Math.max(curW, 384);
          newHeight = Math.round((newWidth - 24) * (9 / 16)) + 126;
        }
      } else if (platform === 'instagram') {
        if (socialType === 'post') {
          newWidth = Math.max(336, curW);
          newHeight = newWidth + 126;
        } else {
          newWidth = Math.max(336, Math.min(curW, 408));
          newHeight = 552;
        }
      } else if (platform === 'tiktok') {
        newWidth = Math.max(336, Math.min(curW, 384));
        newHeight = 576;
      } else if (platform === 'x') {
        newWidth = Math.max(curW, 384);
        newHeight = 480;
      } else if (platform === 'threads') {
        newWidth = Math.max(curW, 384);
        newHeight = 500;
      } else if (platform === 'pinterest') {
        newWidth = Math.max(312, curW);
        newHeight = Math.round((newWidth - 24) * 1.4) + 126;
      } else {
        newHeight = 440;
      }
    } else if (card.type === 'image') {
      const img = cardRef.current?.querySelector('img');
      if (img && img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalHeight / img.naturalWidth;
        const curW = card.width || 360;
        newHeight = Math.round(curW * ratio) + 80;
      }
    } else if (card.type === 'note') {
      const textarea = cardRef.current?.querySelector('textarea');
      if (textarea) {
        textarea.style.height = 'auto';
        const scrollH = textarea.scrollHeight;
        textarea.style.height = '';
        newHeight = Math.max(144, scrollH + 72);
      }
    } else if (card.type === 'tasklist') {
      const checklist_el = cardRef.current?.querySelector(`.${styles.lumenChecklist}`);
      if (checklist_el) {
        newHeight = Math.max(168, checklist_el.scrollHeight + 86);
      } else {
        const itemCount = card.items?.length || 1;
        newHeight = Math.max(168, itemCount * 38 + 120);
      }
    } else if (card.type === 'heading') {
      const titleLines = Math.max(1, (card.title || '').split('\n').length);
      const subLines = Math.max(1, (card.content || '').split('\n').length);
      newHeight = 96 + Math.max(0, titleLines - 1) * 24 + Math.max(0, subLines - 1) * 18;
    } else if (card.type === 'quote') {
      const blockquote = cardRef.current?.querySelector('blockquote');
      if (blockquote) {
        newHeight = Math.max(144, blockquote.scrollHeight + 84);
      }
    } else if (card.type === 'palette') {
      const count = card.colors?.length || 5;
      newHeight = card.palette_layout === 'chips' ? Math.max(260, Math.ceil(count / 2) * 80 + 100) : 256;
    }

    if (snap) {
      newWidth = snapToGrid(newWidth);
      newHeight = snapToGrid(newHeight);
    } else {
      newWidth = Math.round(newWidth);
      newHeight = Math.round(newHeight);
    }

    updateCard(card.id, { width: newWidth, height: newHeight }, true);
    saveCurrentBoardToStore();
    showToast(`Auto-resized based on content (${newWidth} × ${newHeight}px)`);
  };

  // Connector handle
  const handleStartConnect = (e) => {
    e.stopPropagation();
    connectingSourceSignal.value = card.id;
    activeToolSignal.value = 'connect';
    showToast('Click another card to connect arrow');
  };

  const handleCardClick = (e) => {
    if (activeToolSignal.value === 'hand') return;
    e.stopPropagation();
    if (connectingSourceSignal.value) {
      if (connectingSourceSignal.value !== card.id) {
        addConnection(connectingSourceSignal.value, card.id, 'Linked');
        connectingSourceSignal.value = null;
        tempConnectionLineSignal.value = null;
        activeToolSignal.value = 'select';
      }
      return;
    }

    if (hasToggledMultiInMouseDownRef.current) {
      hasToggledMultiInMouseDownRef.current = false;
      return;
    }

    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const cur = selectedCardsSignal.value || [];
      const next = cur.includes(card.id) ? cur.filter((id) => id !== card.id) : [...cur, card.id];
      selectedCardsSignal.value = next;
      if (typeof broadcastCardSelect === 'function') broadcastCardSelect(next);
      return;
    }

    selectedCardsSignal.value = [card.id];
    if (typeof broadcastCardSelect === 'function') broadcastCardSelect([card.id]);
    openPropertyPanel();
  };

  // Color theme class
  const themeClass =
    styles[
      `lumenCardTheme${
        (card.color || 'white').charAt(0).toUpperCase() + (card.color || 'white').slice(1)
      }`
    ] || styles.lumenCardThemeWhite;

  // Task List handlers
  const handleToggleTask = (taskId) => {
    const updatedItems = (card.items || []).map((t) =>
      t.id === taskId ? { ...t, done: !t.done } : t
    );
    updateCard(card.id, { items: updatedItems }, true);
  };

  const handleUpdateTaskText = (taskId, text) => {
    const updatedItems = (card.items || []).map((t) =>
      t.id === taskId ? { ...t, text } : t
    );
    updateCard(card.id, { items: updatedItems }, false);
  };

  const handleDeleteTask = (taskId) => {
    const updatedItems = (card.items || []).filter((t) => t.id !== taskId);
    updateCard(card.id, { items: updatedItems }, true);
  };

  const handleAddTask = () => {
    const newItem = {
      id: `t_${Date.now()}`,
      text: 'New checklist item',
      done: false,
    };
    updateCard(card.id, { items: [...(card.items || []), newItem] }, true);
  };

  // Calculate tasklist progress
  const totalTasks = card.items?.length || 0;
  const completedTasks = card.items?.filter((t) => t.done).length || 0;
  const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isNearTop = card.y < 46;
  const isAiCited = aiCitedCardIdsSignal.value.includes(card.id);
  const isAiHovered = aiActiveHoverCardIdSignal.value === card.id;

  const activeTagFilter = activeTagFilterSignal.value;
  const isTagMatching = !activeTagFilter || (card.tags || []).some((t) => {
    const text = typeof t === 'string' ? t : t.text;
    return text.toLowerCase() === activeTagFilter.toLowerCase();
  });

  const activeTimeFilter = activeTimeRangeFilterSignal.value;
  const isTimeFilterActive = Boolean(activeTimeFilter && activeTimeFilter.mode && activeTimeFilter.mode !== 'all');
  const isTimeMatching = does_card_match_time_filter(card, activeTimeFilter);
  const isFilterMatching = isTagMatching && isTimeMatching;
  const isAnyFilterActive = Boolean(activeTagFilter || isTimeFilterActive);
  const cardTimeStatus = get_card_time_range_status(card);

  const isGroup = card.type === 'group';
  const isDropTargetActive = isGroup && activeDropTargetGroupIdSignal.value === card.id;
  const is_seamless = resolve_card_style(card, activeBoardSignal.value) === 'seamless';
  const resolved_font_css = resolve_card_font_family(card, activeBoardSignal.value);

  // For heading cards, minimum height specifically sized for 1 line heading with 1 subheading (96px)
  const headingMinHeight = card.type === 'heading' ? (() => {
    const titleLines = Math.max(1, (card.title || '').split('\n').length);
    const subLines = Math.max(1, (card.content || '').split('\n').length);
    return 96 + Math.max(0, titleLines - 1) * 24 + Math.max(0, subLines - 1) * 18;
  })() : null;

  // For image cards with a note (ai_notes or content), ensure default 360px cards expand to 464px so the capped note box fits below the full-size image slider while allowing full manual resizing
  const has_image_note =
    card.type === 'image' && !is_seamless && Boolean(card.ai_notes || card.content);

  const effectiveCardHeight = headingMinHeight
    ? Math.max(card.height || 0, headingMinHeight)
    : card.type === 'image' && has_image_note && !card.user_resized_image_card
    ? Math.max(Number(card.height) || 360, 464)
    : card.height;

  // Real card display enforces bottom limits visually (separated from input field)
  const min_display_width = card.type === 'sheets' || card.type === 'docs' ? 240 : (card.type === 'group' ? 120 : 60);
  const min_display_height = card.type === 'sheets' || card.type === 'docs' ? 140 : (card.type === 'group' ? 80 : 40);

  const displayCardWidth = Math.max(
    min_display_width,
    card.width != null && !isNaN(card.width) ? card.width : get_card_initial_dimension(card.type).width
  );
  const displayCardHeight = Math.max(
    min_display_height,
    effectiveCardHeight != null && !isNaN(effectiveCardHeight) ? effectiveCardHeight : get_card_initial_dimension(card.type).height
  );

  // If this card is contained in a collapsed group, do not render it on canvas
  const parentGroup = card.group_id
    ? (activeBoardSignal.value.cards || []).find((c) => c.id === card.group_id)
    : null;
  if (parentGroup && parentGroup.collapsed) {
    return null;
  }

  // If this card is hidden in the layer panel, do not render it on canvas
  if (card.hidden) {
    return null;
  }

  const remoteUsersOnCard = (remoteCardSelectionsSignal.value[card.id] || []).filter((u) => {
    const peer_id = u.client_id;
    if (peer_id) return peer_id !== CLIENT_SESSION_ID;
    return u.id !== currentUserSignal.value.id;
  });
  const primaryRemoteUser = remoteUsersOnCard[0];

  return (
    <div
      ref={cardRef}
      id={card.id}
      data-card-id={card.id}
      data-lumen-card="true"
      data-card-style={is_seamless ? 'seamless' : 'full'}
      data-selected={isSelected ? 'true' : 'false'}
      className={`${styles.lumenCard} ${isGroup ? styles.lumenCardGroup : ''} ${
        is_seamless && !isGroup ? (styles['lumen-card-seamless'] || styles.lumenCardSeamless || '') : ''
      } ${
        isDropTargetActive ? styles.lumenCardGroupDropActive : ''
      } ${themeClass} ${
        isSelected ? (styles.lumenCardSelected || styles['lumen-card-selected'] || '') : ''
      } ${!isSelected && isHovered ? (styles.lumenCardHovered || styles['lumen-card-hovered'] || '') : ''} ${
        isNearTop ? styles.lumenCardNearTop : ''
      } ${isDragging ? styles.lumenCardDragging : ''} ${
        isAiCited || isAiHovered ? styles.lumenCardAiCited : ''
      } ${!isFilterMatching ? styles.lumenCardDimmed : ''} ${
        isFilterMatching && isAnyFilterActive ? styles.lumenCardFilteredHighlight : ''
      } ${is_multiple_selection ? (styles.lumenCardMultiSelected || styles['lumen-card-multi-selected'] || '') : ''} ${
        isCardAiProcessingSignal.value?.cardId === card.id ? styles['lumen-card-ai-working-glow'] : ''
      }`}
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${displayCardWidth}px`,
        height: `${displayCardHeight}px`,
        borderRadius: `var(--lumen-card-radius, ${
          (activeBoardSignal.value?.board_setting?.card_corner_style === 'sharp')
            ? '2px'
            : (activeBoardSignal.value?.board_setting?.card_corner_style === 'soft')
            ? '18px'
            : '10px'
        })`,
        '--lumen-card-radius': (activeBoardSignal.value?.board_setting?.card_corner_style === 'sharp')
          ? '2px'
          : (activeBoardSignal.value?.board_setting?.card_corner_style === 'soft')
          ? '18px'
          : '10px',
        zIndex: isDragging
          ? 9999
          : (isSelected || isHovered || isAiHovered ? 70 : 0) +
            Math.max(0, typeof card.zIndex === 'number' ? card.zIndex : (isGroup ? 0 : 1)) * 10 +
            (isGroup ? 0 : 1) +
            (isSelected ? 4 : 0) +
            (isHovered || isAiHovered ? 2 : 0),
        ...(card.bg_color ? { backgroundColor: card.bg_color } : {}),
        ...(card.text_color ? { color: card.text_color } : {}),
        ...(resolved_font_css ? { '--lumen-card-font': resolved_font_css } : {}),
        ...(primaryRemoteUser
          ? {
              outline: `2px solid ${primaryRemoteUser.color}`,
              outlineOffset: '2px',
            }
          : isSelected
          ? {
              borderColor: 'var(--lumen-accent, #2563eb)',
              borderWidth: '2px',
              borderStyle: 'solid',
              boxShadow: 'var(--lumen-shadow-card-active), 0 0 0 2.5px var(--lumen-accent, #2563eb), 0 0 10px rgba(37, 99, 235, 0.3)',
              outline: '2.5px solid var(--lumen-accent, #2563eb)',
              outlineOffset: '1px',
            }
          : {}),
      }}
      onMouseDown={is_seamless && !isGroup ? handleDragMouseDown : undefined}
      onTouchStart={is_seamless && !isGroup ? handleDragTouchStart : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
      onWheel={(e) => {
        // Prevent card internal horizontal/vertical scroll from propagating to canvas board
        e.stopPropagation();
      }}
    >
      {/* Seamless Minimal Border Interactive Frame: Lets user click to open Card Panel or drag to move card */}
      {is_seamless && !isGroup && (
        <>
          <div
            data-lumen-seamless-rail="true"
            className={`${styles['lumen-card-seamless-rail']} ${styles['lumen-card-seamless-rail-top']}`}
            onMouseDown={handleDragMouseDown}
            onTouchStart={handleDragTouchStart}
            onClick={handleCardClick}
            title="Click to open Card Panel · Drag border to move card"
          />
          <div
            data-lumen-seamless-rail="true"
            className={`${styles['lumen-card-seamless-rail']} ${styles['lumen-card-seamless-rail-bottom']}`}
            onMouseDown={handleDragMouseDown}
            onTouchStart={handleDragTouchStart}
            onClick={handleCardClick}
            title="Click to open Card Panel · Drag border to move card"
          />
          <div
            data-lumen-seamless-rail="true"
            className={`${styles['lumen-card-seamless-rail']} ${styles['lumen-card-seamless-rail-left']}`}
            onMouseDown={handleDragMouseDown}
            onTouchStart={handleDragTouchStart}
            onClick={handleCardClick}
            title="Click to open Card Panel · Drag border to move card"
          />
          <div
            data-lumen-seamless-rail="true"
            className={`${styles['lumen-card-seamless-rail']} ${styles['lumen-card-seamless-rail-right']}`}
            onMouseDown={handleDragMouseDown}
            onTouchStart={handleDragTouchStart}
            onClick={handleCardClick}
            title="Click to open Card Panel · Drag border to move card"
          />
        </>
      )}
      {/* AI Responsible Card Indicator Badge */}
      {isAiCited && (
        <div className={styles.lumenCardAiBadge}>
          <Sparkles size={11} />
          <span>Responsible Card</span>
        </div>
      )}

      {/* Remote Collaborator Editing Indicator Badge */}
      {primaryRemoteUser && (
        <div
          className={styles.lumenCardCollaboratorBadge}
          style={{ borderColor: primaryRemoteUser.color, color: primaryRemoteUser.color }}
          title={`${primaryRemoteUser.name} (${primaryRemoteUser.role || 'Collaborator'}) is currently viewing or editing this card`}
        >
          <span
            className={styles.lumenCardCollaboratorDot}
            style={{ backgroundColor: primaryRemoteUser.color }}
          />
          <span>{primaryRemoteUser.name.split(' ')[0]} editing</span>
        </div>
      )}

      {/* Card Note Badge (if card note exists on visual board; AI note is kept hidden on property panel) */}
      {!is_seamless && !isAiCited && card.content && card.type !== 'note' && card.type !== 'docs' && (
        <div
          className={styles.lumenCardNoteBadge}
          title={`Card Note: ${card.content.slice(0, 100)}`}
          onClick={(e) => {
            e.stopPropagation();
            selectedCardsSignal.value = [card.id];
            openPropertyPanel();
          }}
        >
          <FileText size={9.5} />
          <span>Note</span>
        </div>
      )}

      {/* Contextual Quick Bar on hover/selected - hidden when multiple cards are selected or in seamless mode */}
      {!is_seamless && !is_multiple_selection && (isHovered || isSelected || is_ai_popover_open) && !isDragging && (
        <div
          className={`${styles.lumenCardQuickBar} ${
            isNearTop ? styles.lumenCardQuickBarBottom : ''
          }`}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseEnter}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={handleStartConnect}
            title="Draw connector line to another card"
          >
            <ArrowUpRight size={14} />
          </button>

          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={() => duplicateCard(card.id)}
            title="Duplicate card (Copy)"
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={() => bringToFront(card.id)}
            title="Bring to front"
          >
            <BringFrontIcon size={13} />
          </button>

          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={() => sendToBack(card.id)}
            title="Send to back"
          >
            <SendBackIcon size={13} />
          </button>

          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={handleAutoResizeContent}
            title="Auto-resize card based on original content"
          >
            <Maximize2 size={13} />
          </button>

          {card.type === 'image' && (
            <button
              type="button"
              className={styles.lumenQuickButton}
              onClick={() => {
                const card_slides = normalize_card_slides(card);
                openImageViewer({
                  cardId: card.id,
                  title: card.title || 'Moodboard Photograph',
                  slides: card_slides,
                  activeIndex: card.active_slide_index || 0,
                  initialMode: 'fit',
                });
              }}
              title="View full screen or 1:1 original resolution"
            >
              <Expand size={13} />
            </button>
          )}

          {card.type === 'link' && (card.og_image || card.image_url || card.imageUrl) && (
            <button
              type="button"
              className={styles.lumenQuickButton}
              onClick={(e) => {
                e.stopPropagation();
                const img_to_open = card.og_image || card.image_url || card.imageUrl;
                openImageViewer({
                  cardId: card.id,
                  title: card.title || 'Web Link Preview',
                  slides: [{ url: img_to_open, caption: card.title || card.url || 'Web Resource' }],
                  activeIndex: 0,
                  initialMode: 'fit',
                });
              }}
              title="Open full image render viewer"
            >
              <Expand size={13} />
            </button>
          )}

          {card.type === 'sheets' && (
            <button
              type="button"
              className={styles.lumenQuickButton}
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent(`lumen-sheets-fullscreen-${card.id}`));
              }}
              title="Open spreadsheet in fullscreen editing popup"
            >
              <Expand size={13} />
            </button>
          )}

          {card.type === 'docs' && (
            <button
              type="button"
              className={styles.lumenQuickButton}
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent(`lumen-docs-fullscreen-${card.id}`));
              }}
              title="Open document in fullscreen mode (Focus Mode)"
            >
              <Expand size={13} />
            </button>
          )}

          {card.type === 'canvas' && (
            <button
              type="button"
              className={styles.lumenQuickButton}
              onClick={(e) => {
                e.stopPropagation();
                openCanvasFullscreen(card.id);
                window.dispatchEvent(new CustomEvent(`lumen-canvas-fullscreen-${card.id}`));
              }}
              title="Open canvas in fullscreen drawing studio"
            >
              <Expand size={13} />
            </button>
          )}

          {card.type === 'board' && (
            <button
              type="button"
              className={styles.lumenQuickButton}
              onClick={(e) => {
                e.stopPropagation();
                if (card.target_board_id) {
                  setActiveBoard(card.target_board_id);
                  navigate(`/board/${card.target_board_id}`);
                }
              }}
              title="Open nested sub-board"
            >
              <CornerDownRight size={13} />
            </button>
          )}

          <button
            type="button"
            className={`${styles.lumenQuickButton} ${is_tag_popover_open ? styles.lumenQuickButtonActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              set_is_tag_popover_open(!is_tag_popover_open);
              set_is_reaction_popover_open(false);
            }}
            title="Add label / tag"
          >
            <Tag size={13} />
          </button>

          <button
            type="button"
            className={`${styles.lumenQuickButton} ${is_reaction_popover_open ? styles.lumenQuickButtonActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              set_is_reaction_popover_open(!is_reaction_popover_open);
              set_is_tag_popover_open(false);
            }}
            title="React with emoji"
          >
            <SmilePlus size={13} />
          </button>

          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={(e) => {
              e.stopPropagation();
              openCardCommentsDrawer(card.id);
            }}
            title="Card comments & team discussion"
          >
            <MessageSquare size={13} />
          </button>

          <div className={styles.lumenQuickDivider} />

          <button
            type="button"
            className={styles.lumenQuickButton}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              deleteCard(card.id);
            }}
            title="Delete card"
            style={{ color: '#dc2626' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Card-Type-Specific AI Actions Popover & Custom Instruction Popup */}
      {is_ai_popover_open && !is_card_locked && (
        <div
          className={`${styles['lumen-card-ai-popover']} ${
            active_ai_action_popup ? styles['lumen-card-ai-popover-expanded'] : ''
          }`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {active_ai_action_popup ? (
            (() => {
              const is_create_image_popup =
                active_ai_action_popup === 'image_create_image' ||
                active_ai_action_popup === 'note_create_image';
              const is_image_visualize_popup =
                active_ai_action_popup === 'image_visualize_creatively';
              const is_note_creative_popup =
                active_ai_action_popup === 'note_creative_spark';
              const is_glimmer_creative_popup =
                is_image_visualize_popup || is_note_creative_popup;
              const is_tts_popup = active_ai_action_popup === 'note_text_to_voice';
              const is_code_improve_popup = active_ai_action_popup === 'code_improve_current';
              const is_code_popup =
                active_ai_action_popup === 'code_generate_snippet' || is_code_improve_popup;
              const popup_task_cat = is_create_image_popup
                ? 'image_gen'
                : is_code_popup
                ? 'coding'
                : 'text_prompt';
              const selected_board_list_model = getSelectedAiModelForTask(popup_task_cat);
              const active_voice_persona = normalize_muse_voice_id(card.tts_voice_persona);
              const active_tts_language = card.tts_language || 'Auto-Detect';

              const raw_card_slides = Array.isArray(card.images) ? card.images : [];
              const active_slide_idx_for_ref = Math.max(
                0,
                Math.min(
                  Number(card.active_slide_index) || 0,
                  Math.max(0, raw_card_slides.length - 1)
                )
              );
              const active_slide_item_for_ref = raw_card_slides[active_slide_idx_for_ref];
              const active_ref_url =
                typeof active_slide_item_for_ref === 'string'
                  ? active_slide_item_for_ref
                  : active_slide_item_for_ref?.url || card.imageUrl || '';
              const active_ref_file_id =
                (typeof active_slide_item_for_ref === 'object' &&
                  active_slide_item_for_ref?.file_id) ||
                card.file_id ||
                null;
              const total_ref_slides =
                raw_card_slides.length > 0 ? raw_card_slides.length : active_ref_url ? 1 : 0;
              const can_use_ref_image =
                active_ai_action_popup === 'image_create_image' && Boolean(active_ref_url);
              const effective_use_ref = Boolean(can_use_ref_image && use_reference_image);

              return (
                <div className={styles['lumen-card-ai-popup-modal']}>
                  <div className={styles['lumen-card-ai-popover-header']}>
                    <button
                      type="button"
                      className={styles['lumen-card-ai-back-btn']}
                      onClick={() => set_active_ai_action_popup(null)}
                      title="Back to AI actions"
                    >
                      ← Back
                    </button>
                    <div className={styles['lumen-card-ai-popover-title']}>
                      {is_tts_popup ? <Volume2 size={13} /> : is_code_popup ? <Code2 size={13} /> : <Sparkles size={13} />}
                      <span>
                        {is_image_visualize_popup
                          ? 'Visualize Image Creatively'
                          : is_note_creative_popup
                          ? 'Mindful Note, Joke & Motivation'
                          : active_ai_action_popup === 'note_replace_content'
                          ? 'Replace Content'
                          : is_code_improve_popup
                          ? 'AI Improve Current Code'
                          : is_code_popup
                          ? 'Generate Code Snippet'
                          : is_tts_popup
                          ? 'Text to Voice'
                          : effective_use_ref
                          ? `Edit Slide ${active_slide_idx_for_ref + 1}`
                          : 'Create Image'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.lumenPopoverCloseBtn}
                      onClick={() => {
                        set_active_ai_action_popup(null);
                        set_is_ai_popover_open(false);
                      }}
                      title="Close popup"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Active Model from Board List Setting */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      padding: '5px 8px',
                      marginBottom: 6,
                      borderRadius: 6,
                      fontSize: 10.5,
                      background:
                        is_tts_popup || is_glimmer_creative_popup
                          ? 'rgba(124, 58, 237, 0.08)'
                          : selected_board_list_model.bgLight || 'rgba(124, 58, 237, 0.08)',
                      border: `1px solid ${
                        is_tts_popup || is_glimmer_creative_popup
                          ? 'rgba(124, 58, 237, 0.28)'
                          : selected_board_list_model.borderLight || 'rgba(124, 58, 237, 0.25)'
                      }`,
                      color:
                        is_tts_popup || is_glimmer_creative_popup
                          ? '#6d28d9'
                          : selected_board_list_model.color || '#7c3aed',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {is_tts_popup
                        ? 'Google Text-to-Speech'
                        : is_glimmer_creative_popup
                        ? 'Creative AI: Meta Muse Wonder'
                        : `Board List Model: ${selected_board_list_model.name}`}
                    </span>
                    <span style={{ opacity: 0.85, fontSize: 10 }}>
                      {is_tts_popup
                        ? `Google TTS (${active_voice_persona} · ${active_tts_language})`
                        : is_glimmer_creative_popup
                        ? 'muse-wonder-1.0'
                        : selected_board_list_model.full_name}
                    </span>
                  </div>

                  <div className={styles['lumen-card-ai-popup-desc']}>
                    {is_image_visualize_popup
                      ? 'Creatively visualize this image as a love poem, joke, motivational quote, or greeting — powered by Muse Wonder (muse-wonder-1.0):'
                      : is_note_creative_popup
                      ? 'Create a new Note card with a mindful note, witty joke, motivational quote, love poem, or warm greeting (keeps your current note unchanged) — powered by Muse Wonder (muse-wonder-1.0):'
                      : active_ai_action_popup === 'note_replace_content'
                      ? 'Enter any prompt or instruction (creative prompts like greetings, poems, jokes & mindful notes automatically use Muse Wonder):'
                      : is_code_improve_popup
                      ? `Describe what to update or improve in the current code (e.g. "change the bird image to phoenix") — ${selected_board_list_model.name} will update your existing code while preserving the rest:`
                      : is_code_popup
                      ? `Enter a coding prompt below — ${selected_board_list_model.name} will generate a clean, syntax-highlighted code snippet directly in this Coding Card:`
                      : is_tts_popup
                      ? 'Choose a Voice persona and target language before confirming voice creation:'
                      : effective_use_ref
                      ? `Describe only the change to make — ${selected_board_list_model.name} will continue from Slide ${active_slide_idx_for_ref + 1} while preserving layout, angle, and lighting:`
                      : active_ai_action_popup === 'image_create_image'
                      ? `Enter your image prompt below — AI will generate an image using ${selected_board_list_model.name} and add it to this card:`
                      : `Enter an image prompt below (or leave empty to auto-generate from this card) using ${selected_board_list_model.name}:`}
                  </div>

                  {can_use_ref_image && (
                    <div
                      className={`${styles['lumen-card-ai-ref-box']} ${
                        effective_use_ref ? styles['lumen-card-ai-ref-box-active'] : ''
                      }`}
                    >
                      <div className={styles['lumen-card-ai-ref-row']}>
                        <label className={styles['lumen-card-ai-ref-label']}>
                          <input
                            type="checkbox"
                            className={styles['lumen-card-ai-ref-checkbox']}
                            checked={effective_use_ref}
                            onChange={(e) => set_use_reference_image(e.target.checked)}
                          />
                          <span>Use current active image as reference</span>
                        </label>
                        <div className={styles['lumen-card-ai-ref-thumb-wrap']}>
                          <img
                            src={active_ref_url}
                            alt={`Slide ${active_slide_idx_for_ref + 1}`}
                            className={styles['lumen-card-ai-ref-thumb']}
                          />
                          <span className={styles['lumen-card-ai-ref-slide-badge']}>
                            Slide {active_slide_idx_for_ref + 1}/{total_ref_slides}
                          </span>
                        </div>
                      </div>

                      {effective_use_ref && (
                        <div className={styles['lumen-card-ai-ref-strength-row']}>
                          <span className={styles['lumen-card-ai-ref-strength-label']}>
                            Strength ({reference_strength.toFixed(2)}):
                          </span>
                          <div className={styles['lumen-card-ai-ref-pills']}>
                            {[
                              { val: 0.35, label: '0.35 Subtle' },
                              { val: 0.45, label: '0.45 Preserve' },
                              { val: 0.75, label: '0.75 Strong' },
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                className={`${styles['lumen-card-ai-ref-pill']} ${
                                  Math.abs(reference_strength - preset.val) < 0.03
                                    ? styles['lumen-card-ai-ref-pill-active']
                                    : ''
                                }`}
                                onClick={() => set_reference_strength(preset.val)}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {active_ai_action_popup === 'image_create_image' && (
                    <div className={styles['lumen-card-ai-gen-options-box']}>
                      <div className={styles['lumen-card-ai-gen-options-grid']}>
                        <label className={styles['lumen-card-ai-gen-option-field']}>
                          <span className={styles['lumen-card-ai-gen-option-label']}>Size</span>
                          <select
                            value={ai_image_size}
                            onChange={(e) => set_ai_image_size(e.target.value)}
                            className={styles['lumen-card-ai-gen-option-select']}
                          >
                            <option value="auto">auto</option>
                            <option value="1024x1024">1024x1024</option>
                            <option value="1024x1536">1024x1536</option>
                            <option value="1536x1024">1536x1024</option>
                          </select>
                        </label>

                        <label className={styles['lumen-card-ai-gen-option-field']}>
                          <span className={styles['lumen-card-ai-gen-option-label']}>Format</span>
                          <select
                            value={ai_output_format}
                            onChange={(e) => set_ai_output_format(e.target.value)}
                            className={styles['lumen-card-ai-gen-option-select']}
                          >
                            <option value="jpg">jpg (default)</option>
                            <option value="png">png</option>
                            <option value="webp">webp</option>
                          </select>
                        </label>

                        <label className={styles['lumen-card-ai-gen-option-field']}>
                          <span className={styles['lumen-card-ai-gen-option-label']}>
                            Reasoning Strength
                          </span>
                          <select
                            value={ai_reasoning_strength}
                            onChange={(e) => set_ai_reasoning_strength(e.target.value)}
                            className={styles['lumen-card-ai-gen-option-select']}
                          >
                            <option value="high">high</option>
                            <option value="low">low</option>
                          </select>
                        </label>
                      </div>

                      <div className={styles['lumen-card-ai-gen-tools-row']}>
                        <label
                          className={`${styles['lumen-card-ai-gen-tool-toggle']} ${
                            ai_image_search ? styles['lumen-card-ai-gen-tool-toggle-active'] : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ai_image_search}
                            onChange={(e) => set_ai_image_search(e.target.checked)}
                            className={styles['lumen-card-ai-gen-tool-checkbox']}
                          />
                          <span>Image Search: {ai_image_search ? 'on' : 'off'}</span>
                        </label>

                        <label
                          className={`${styles['lumen-card-ai-gen-tool-toggle']} ${
                            ai_web_search ? styles['lumen-card-ai-gen-tool-toggle-active'] : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ai_web_search}
                            onChange={(e) => set_ai_web_search(e.target.checked)}
                            className={styles['lumen-card-ai-gen-tool-checkbox']}
                          />
                          <span>Web Search: {ai_web_search ? 'on' : 'off'}</span>
                        </label>

                        <label
                          className={`${styles['lumen-card-ai-gen-tool-toggle']} ${
                            ai_shell ? styles['lumen-card-ai-gen-tool-toggle-active'] : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ai_shell}
                            onChange={(e) => set_ai_shell(e.target.checked)}
                            className={styles['lumen-card-ai-gen-tool-checkbox']}
                          />
                          <span>Shell: {ai_shell ? 'on' : 'off'}</span>
                        </label>

                        <label
                          className={`${styles['lumen-card-ai-gen-tool-toggle']} ${
                            ai_auto_improve_prompt
                              ? styles['lumen-card-ai-gen-tool-toggle-active']
                              : ''
                          }`}
                          title="Automatically expand and enrich your prompt using muse-wonder-1.0 before generating the image"
                        >
                          <input
                            type="checkbox"
                            checked={ai_auto_improve_prompt}
                            onChange={(e) => set_ai_auto_improve_prompt(e.target.checked)}
                            className={styles['lumen-card-ai-gen-tool-checkbox']}
                          />
                          <span>
                            ✨ Auto-Improve (Muse Wonder):{' '}
                            {ai_auto_improve_prompt ? 'on' : 'off'}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {is_tts_popup ? (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '5px 8px',
                          marginBottom: 6,
                          borderRadius: 6,
                          background: 'var(--lumen-surface-subtle, #f8fafc)',
                          border: '1px solid var(--lumen-border, #e2e8f0)',
                          fontSize: 11,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--lumen-text-secondary, #475569)' }}>
                          Google TTS Voice:
                        </span>
                        <select
                          value={active_voice_persona}
                          onChange={(e) =>
                            updateCard(card.id, { tts_voice_persona: e.target.value }, true)
                          }
                          style={{
                            padding: '3px 7px',
                            borderRadius: 5,
                            border: '1px solid var(--lumen-border-strong, #cbd5e1)',
                            background: 'var(--lumen-surface, #ffffff)',
                            color: 'var(--lumen-text-primary, #0f172a)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {LUMEN_NOTE_TTS_VOICE_CATEGORIES.map((cat) => (
                            <optgroup key={cat} label={cat}>
                              {LUMEN_NOTE_TTS_VOICE_OPTIONS.filter((vp) => vp.category === cat).map(
                                (vp) => (
                                  <option key={vp.id} value={vp.id}>
                                    {vp.label}
                                  </option>
                                )
                              )}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '5px 8px',
                          marginBottom: 6,
                          borderRadius: 6,
                          background: 'var(--lumen-surface-subtle, #f8fafc)',
                          border: '1px solid var(--lumen-border, #e2e8f0)',
                          fontSize: 11,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--lumen-text-secondary, #475569)' }}>
                          Voice Language:
                        </span>
                        <select
                          value={active_tts_language}
                          onChange={(e) =>
                            updateCard(card.id, { tts_language: e.target.value }, true)
                          }
                          style={{
                            padding: '3px 7px',
                            borderRadius: 5,
                            border: '1px solid var(--lumen-border-strong, #cbd5e1)',
                            background: 'var(--lumen-surface, #ffffff)',
                            color: 'var(--lumen-text-primary, #0f172a)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {LUMEN_NOTE_TTS_LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang === 'Auto-Detect'
                                ? 'Auto-Detect (Note Language)'
                                : `${lang} (Translate & Speak)`}
                            </option>
                          ))}
                        </select>
                      </div>
                      {active_tts_language && active_tts_language !== 'Auto-Detect' && (
                        <div
                          className={styles['lumen-note-tts-translate-hint']}
                          style={{ marginBottom: 6 }}
                        >
                          AI will translate note content to <strong>{active_tts_language}</strong> first, then synthesize the voice-over in <strong>{active_tts_language}</strong>.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles['lumen-card-ai-preset-chips']}>
                      {(is_image_visualize_popup
                        ? [
                            'Write a romantic love poem inspired by this image',
                            'Tell a witty, lighthearted joke about this scene',
                            'Create an uplifting motivational quote from this visual',
                            'Write a warm, poetic greeting card message',
                            'Mindful sensory visualization & reflection',
                          ]
                        : is_note_creative_popup
                        ? [
                            'Create a calming mindful note & breathing reflection',
                            'Write a clever, mood-lifting joke',
                            'Create a powerful daily motivation quote & affirmation',
                            'Write a romantic love poem',
                            'Craft a warm, heartfelt greeting message',
                          ]
                        : active_ai_action_popup === 'note_replace_content'
                        ? [
                            'Create a calming mindful note & reflection',
                            'Write a witty joke & mood booster',
                            'Create motivational quotes & affirmations',
                            'Write a creative product description',
                            'Rewrite in a clearer, professional tone',
                            'Brainstorm 5 fresh ideas on this topic',
                          ]
                        : is_code_improve_popup
                        ? [
                            'Change the bird image to phoenix',
                            'Update theme colors & add smooth animations',
                            'Add interactive controls & keyboard shortcuts',
                            'Improve error handling & responsiveness',
                          ]
                        : is_code_popup
                        ? [
                            'Fetch helper with timeout & exponential retry',
                            'Debounce & throttle utility function',
                            'REST API CRUD handler with input validation',
                            'SQL analytical query with CTE & window functions',
                          ]
                        : effective_use_ref
                        ? [
                            'Add warm sunset golden hour lighting, keep layout & angle',
                            'Add subtle seasonal decorations, keep furniture & lighting same',
                            'Change surface material to brushed matte titanium, keep angle',
                          ]
                        : [
                            'Studio commercial product hero shot',
                            'Close-up macro material & texture photo',
                            'Realistic in-action lifestyle photography',
                          ]
                      ).map((preset_text) => (
                        <button
                          key={preset_text}
                          type="button"
                          className={`${styles['lumen-card-ai-preset-chip']} ${
                            custom_ai_instruction === preset_text
                              ? styles['lumen-card-ai-preset-chip-active']
                              : ''
                          }`}
                          onClick={() => set_custom_ai_instruction(preset_text)}
                        >
                          {preset_text}
                        </button>
                      ))}
                    </div>
                  )}

                  {is_tts_popup ? (
                    <div
                      style={{
                        padding: '8px 10px',
                        marginBottom: 8,
                        borderRadius: 6,
                        background: 'var(--lumen-surface-subtle, #f8fafc)',
                        border: '1px solid var(--lumen-border, #e2e8f0)',
                        fontSize: 11,
                        lineHeight: 1.45,
                        color: 'var(--lumen-text-secondary, #475569)',
                        maxHeight: 84,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <strong style={{ color: 'var(--lumen-text-primary, #0f172a)' }}>
                        Note Text to Synthesize:
                      </strong>{' '}
                      {String(card.content || card.title || 'Empty note — add text to synthesize voice.')}
                    </div>
                  ) : (
                    <textarea
                      rows={3}
                      autoFocus
                      className={styles['lumen-card-ai-popup-textarea']}
                      value={custom_ai_instruction}
                      onChange={(e) => set_custom_ai_instruction(e.target.value.slice(0, 600))}
                      placeholder={
                        is_image_visualize_popup
                          ? 'Describe how to creatively visualize this image (e.g. romantic love poem, funny joke, motivational quote, or poetic greeting)...'
                          : is_note_creative_popup
                          ? 'Describe the mindful note, joke, motivational quote, love poem, or greeting to create...'
                          : active_ai_action_popup === 'note_replace_content'
                          ? 'Enter any free-form prompt (e.g. mindful note, joke, motivation quote, poem, story, or release notes)...'
                          : is_code_improve_popup
                          ? 'Describe what to update in the current code (e.g. change the bird image to phoenix, update colors, add a score counter)...'
                          : is_code_popup
                          ? 'Describe the code snippet or function to generate (e.g. Binary search tree in TypeScript, Golang worker pool, Python FastAPI endpoint)...'
                          : effective_use_ref
                          ? `Describe the change to Slide ${active_slide_idx_for_ref + 1} (keep original layout, camera angle & lighting)...`
                          : 'Describe the image to create (e.g. Minimalist Kyoto pavilion at sunset, warm architectural lighting)...'
                      }
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          if (isCardAiProcessingSignal.value) return;
                          const prompt_val = custom_ai_instruction.trim();
                          const action_to_run = active_ai_action_popup;
                          set_custom_ai_instruction('');
                          set_active_ai_action_popup(null);
                          set_is_ai_popover_open(false);
                          const active_code_file =
                            card.type === 'code' && Array.isArray(card.code_data?.files)
                              ? card.code_data.files.find(
                                  (f) => f.id === card.code_data.active_file_id
                                ) || card.code_data.files[0]
                              : null;
                          await runAiCardAction(
                            card.id,
                            action_to_run,
                            prompt_val,
                            action_to_run === 'image_create_image'
                              ? {
                                  ...(effective_use_ref
                                    ? {
                                        use_reference_image: true,
                                        reference_strength,
                                        active_slide_index: active_slide_idx_for_ref,
                                        reference_image_url: active_ref_url,
                                        reference_file_id: active_ref_file_id,
                                      }
                                    : {}),
                                  image_size: ai_image_size,
                                  output_format: ai_output_format,
                                  reasoning_strength: ai_reasoning_strength,
                                  enable_image_search: ai_image_search,
                                  enable_web_search: ai_web_search,
                                  enable_shell: ai_shell,
                                  auto_improve_prompt: ai_auto_improve_prompt,
                                }
                              : card.type === 'code'
                              ? {
                                  target_language:
                                    active_code_file?.language ||
                                    card.code_language ||
                                    'javascript',
                                  current_code: String(
                                    active_code_file?.code ??
                                      active_code_file?.content ??
                                      card.content ??
                                      ''
                                  ),
                                  current_file_id: active_code_file?.id || 'file_1',
                                  current_file_name: active_code_file?.name || 'snippet.js',
                                }
                              : {}
                          );
                        }
                      }}
                    />
                  )}

                  <div className={styles['lumen-card-ai-popup-actions']}>
                    {active_ai_action_popup === 'image_create_image' && (
                      <button
                        type="button"
                        disabled={
                          Boolean(isCardAiProcessingSignal.value) || is_improving_ai_prompt
                        }
                        className={styles['lumen-card-ai-popup-secondary-btn']}
                        onClick={async () => {
                          if (is_improving_ai_prompt) return;
                          set_is_improving_ai_prompt(true);
                          try {
                            const res = await improveImagePromptWithMuse(
                              card.id,
                              custom_ai_instruction.trim(),
                              {
                                use_reference_image: effective_use_ref,
                                active_slide_index: active_slide_idx_for_ref,
                              }
                            );
                            if (res?.improvedPrompt) {
                              set_custom_ai_instruction(res.improvedPrompt);
                            }
                          } finally {
                            set_is_improving_ai_prompt(false);
                          }
                        }}
                        title="Improve user prompt right now using muse-wonder-1.0"
                      >
                        {is_improving_ai_prompt
                          ? 'Improving...'
                          : '✨ Improve Prompt (Muse Wonder)'}
                      </button>
                    )}
                    {(active_ai_action_popup === 'note_create_image' ||
                      is_image_visualize_popup) && (
                      <button
                        type="button"
                        disabled={Boolean(isCardAiProcessingSignal.value)}
                        className={styles['lumen-card-ai-popup-secondary-btn']}
                        onClick={async () => {
                          const action_to_run = active_ai_action_popup;
                          set_custom_ai_instruction('');
                          set_active_ai_action_popup(null);
                          set_is_ai_popover_open(false);
                          await runAiCardAction(card.id, action_to_run, '');
                        }}
                        title={
                          is_image_visualize_popup
                            ? 'Creatively visualize this image with a love poem, joke & motivational quote automatically'
                            : 'Generate related image card directly from card content without custom prompt'
                        }
                      >
                        {is_image_visualize_popup ? 'Auto Visualize' : 'Auto from Card'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(isCardAiProcessingSignal.value)}
                      className={styles['lumen-card-ai-popup-primary-btn']}
                      onClick={async () => {
                        const prompt_val = custom_ai_instruction.trim();
                        const action_to_run = active_ai_action_popup;
                        const payload_str = is_tts_popup
                          ? `[voice:${active_voice_persona}][lang:${active_tts_language}]`
                          : prompt_val;
                        if (is_tts_popup) {
                          updateCard(
                            card.id,
                            {
                              tts_voice_persona: active_voice_persona,
                              tts_language: active_tts_language,
                            },
                            true
                          );
                        }
                        set_custom_ai_instruction('');
                        set_active_ai_action_popup(null);
                        set_is_ai_popover_open(false);
                        const active_code_file =
                          card.type === 'code' && Array.isArray(card.code_data?.files)
                            ? card.code_data.files.find(
                                (f) => f.id === card.code_data.active_file_id
                              ) || card.code_data.files[0]
                            : null;
                        await runAiCardAction(
                          card.id,
                          action_to_run,
                          payload_str,
                          action_to_run === 'image_create_image'
                            ? {
                                ...(effective_use_ref
                                  ? {
                                      use_reference_image: true,
                                      reference_strength,
                                      active_slide_index: active_slide_idx_for_ref,
                                      reference_image_url: active_ref_url,
                                      reference_file_id: active_ref_file_id,
                                    }
                                  : {}),
                                image_size: ai_image_size,
                                output_format: ai_output_format,
                                reasoning_strength: ai_reasoning_strength,
                                enable_image_search: ai_image_search,
                                enable_web_search: ai_web_search,
                                enable_shell: ai_shell,
                                auto_improve_prompt: ai_auto_improve_prompt,
                              }
                            : card.type === 'code'
                            ? {
                                target_language:
                                  active_code_file?.language ||
                                  card.code_language ||
                                  'javascript',
                                current_code: String(
                                  active_code_file?.code ??
                                    active_code_file?.content ??
                                    card.content ??
                                    ''
                                ),
                                current_file_id: active_code_file?.id || 'file_1',
                                current_file_name: active_code_file?.name || 'snippet.js',
                              }
                            : {}
                        );
                      }}
                    >
                      {is_tts_popup ? <Volume2 size={12} /> : is_code_popup ? <Code2 size={12} /> : <Sparkles size={12} />}
                      <span>
                        {is_image_visualize_popup
                          ? 'Visualize Creatively (Muse Wonder)'
                          : is_note_creative_popup
                          ? 'Create New Note (Muse Wonder)'
                          : active_ai_action_popup === 'note_replace_content'
                          ? 'Replace Content'
                          : is_code_improve_popup
                          ? `AI Improve Current Code (${selected_board_list_model.name})`
                          : is_code_popup
                          ? `Generate Code Snippet (${selected_board_list_model.name})`
                          : is_tts_popup
                          ? active_tts_language && active_tts_language !== 'Auto-Detect'
                            ? `Translate to ${active_tts_language} & Create Voice (${active_voice_persona})`
                            : `Confirm & Create Voice (${active_voice_persona})`
                          : effective_use_ref
                          ? `Edit Slide ${active_slide_idx_for_ref + 1} (${selected_board_list_model.name})`
                          : `Create Image (${selected_board_list_model.name})`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              <div className={styles['lumen-card-ai-popover-header']}>
                <div className={styles['lumen-card-ai-popover-title']}>
                  <Sparkles size={13} />
                  <span>AI • {getCardTypeLabel(card.type, card.platform)}</span>
                </div>
                <button
                  type="button"
                  className={styles.lumenPopoverCloseBtn}
                  onClick={() => {
                    set_active_ai_action_popup(null);
                    set_is_ai_popover_open(false);
                  }}
                  title="Close AI menu"
                >
                  <X size={12} />
                </button>
              </div>

              <form
                className={styles['lumen-card-ai-custom-form']}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmed = custom_ai_instruction.trim();
                  if (!trimmed || isCardAiProcessingSignal.value) return;
                  set_custom_ai_instruction('');
                  set_active_ai_action_popup(null);
                  set_is_ai_popover_open(false);
                  const wants_tts_action =
                    card.type === 'note' &&
                    /\b(text\s*to\s*voice|text-to-voice|text\s*to\s*speech|tts|google\s*(?:tts|voice)|muse\s*voice|read\s+aloud|synthesize\s+voice)\b/i.test(
                      trimmed
                    );
                  const wants_image_visualize =
                    card.type === 'image' &&
                    /\b(poem|love\s+poem|romantic|joke|jokes|funny|humor|motivat|motivational|quote|quotes|greeting|greetings|mindful|visualize|reflection|story|haiku)\b/i.test(
                      trimmed
                    );
                  const wants_note_creative =
                    card.type === 'note' &&
                    /\b(mindful|mindfulness|meditat|joke|jokes|funny|humor|motivat|motivational|affirmation|poem|love\s+poem|greeting|greetings|haiku)\b/i.test(
                      trimmed
                    );
                  const wants_image_action =
                    card.type === 'image' ||
                    (card.type === 'note' &&
                      /\b(images?|pictures?|photos?|illustrations?|visuals?|diagrams?|draw|slides?)\b/i.test(trimmed));
                  if (wants_tts_action) {
                    set_active_ai_action_popup('note_text_to_voice');
                    return;
                  }
                  const has_existing_code =
                    card.type === 'code' &&
                    Boolean(
                      String(
                        (Array.isArray(card.code_data?.files) &&
                          (card.code_data.files.find(
                            (f) => f.id === card.code_data.active_file_id
                          ) || card.code_data.files[0])?.code) ||
                          card.content ||
                          ''
                      ).trim()
                    );
                  const resolved_action =
                    card.type === 'image'
                      ? wants_image_visualize
                        ? 'image_visualize_creatively'
                        : 'image_create_image'
                      : card.type === 'code'
                      ? has_existing_code
                        ? 'code_improve_current'
                        : 'code_generate_snippet'
                      : card.type === 'note'
                      ? wants_image_action
                        ? 'note_create_image'
                        : wants_note_creative
                        ? 'note_creative_spark'
                        : 'note_replace_content'
                      : 'custom_edit';
                  if (resolved_action === 'image_create_image') {
                    const raw_slides = Array.isArray(card.images) ? card.images : [];
                    const active_idx = Math.max(
                      0,
                      Math.min(
                        Number(card.active_slide_index) || 0,
                        Math.max(0, raw_slides.length - 1)
                      )
                    );
                    const active_item = raw_slides[active_idx];
                    const ref_url =
                      typeof active_item === 'string'
                        ? active_item
                        : active_item?.url || card.imageUrl || '';
                    const ref_file_id =
                      (typeof active_item === 'object' && active_item?.file_id) ||
                      card.file_id ||
                      null;
                    await runAiCardAction(card.id, resolved_action, trimmed, {
                      ...(use_reference_image && ref_url
                        ? {
                            use_reference_image: true,
                            reference_strength,
                            active_slide_index: active_idx,
                            reference_image_url: ref_url,
                            reference_file_id: ref_file_id,
                          }
                        : {}),
                      image_size: ai_image_size,
                      output_format: ai_output_format,
                      reasoning_strength: ai_reasoning_strength,
                      enable_image_search: ai_image_search,
                      enable_web_search: ai_web_search,
                      enable_shell: ai_shell,
                      auto_improve_prompt: ai_auto_improve_prompt,
                    });
                    return;
                  }
                  const active_code_file =
                    card.type === 'code' && Array.isArray(card.code_data?.files)
                      ? card.code_data.files.find(
                          (f) => f.id === card.code_data.active_file_id
                        ) || card.code_data.files[0]
                      : null;
                  await runAiCardAction(
                    card.id,
                    resolved_action,
                    trimmed,
                    card.type === 'code'
                      ? {
                          target_language:
                            active_code_file?.language || card.code_language || 'javascript',
                          current_code: String(
                            active_code_file?.code ??
                              active_code_file?.content ??
                              card.content ??
                              ''
                          ),
                          current_file_id: active_code_file?.id || 'file_1',
                          current_file_name: active_code_file?.name || 'snippet.js',
                        }
                      : {}
                  );
                }}
              >
                <input
                  type="text"
                  className={styles['lumen-card-ai-custom-input']}
                  value={custom_ai_instruction}
                  onChange={(e) => set_custom_ai_instruction(e.target.value.slice(0, 300))}
                  placeholder={
                    card.type === 'image'
                      ? 'Prompt to create image or visualize creatively (love poem, joke, quote)...'
                      : card.type === 'code'
                      ? 'AI Improve current code (e.g. change the bird image to phoenix)...'
                      : card.type === 'note'
                      ? 'Custom instruction (e.g. mindful note, joke, motivation, or read aloud)...'
                      : `Custom instruction for this ${card.type} card...`
                  }
                />
                <button
                  type="submit"
                  disabled={!custom_ai_instruction.trim() || Boolean(isCardAiProcessingSignal.value)}
                  className={styles['lumen-card-ai-custom-submit']}
                  title="Run custom instruction"
                >
                  Run
                </button>
              </form>

              {card.type === 'sound_recorder' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 10px',
                    margin: '0 8px 6px',
                    borderRadius: 7,
                    background: 'var(--lumen-surface-subtle, #f8fafc)',
                    border: '1px solid var(--lumen-border, #e2e8f0)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--lumen-text-secondary, #475569)' }}>
                    Translate Target:
                  </span>
                  <select
                    value={card.target_language || 'English'}
                    onChange={(e) => updateCard(card.id, { target_language: e.target.value }, true)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 5,
                      border: '1px solid var(--lumen-border-strong, #cbd5e1)',
                      background: 'var(--lumen-surface, #ffffff)',
                      color: 'var(--lumen-text-primary, #0f172a)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {[
                      'English',
                      'Indonesian',
                      'Japanese',
                      'Spanish',
                      'French',
                      'German',
                      'Mandarin Chinese',
                      'Korean',
                      'Arabic',
                      'Portuguese',
                      'Hindi',
                      'Russian',
                      'Italian',
                      'Dutch',
                      'Turkish',
                      'Vietnamese',
                      'Thai',
                      'Tagalog',
                      'Malay',
                      'Polish',
                    ].map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles['lumen-card-ai-actions-list']}>
                {getCardAiActions(card.type).map((action) => {
                  const is_busy = Boolean(isCardAiProcessingSignal.value);
                  const supports_popup =
                    action.id === 'image_create_image' ||
                    action.id === 'image_visualize_creatively' ||
                    action.id === 'note_replace_content' ||
                    action.id === 'note_creative_spark' ||
                    action.id === 'note_create_image' ||
                    action.id === 'note_text_to_voice' ||
                    action.id === 'code_improve_current' ||
                    action.id === 'code_generate_snippet';
                  const badge_label =
                    action.category === 'modify'
                      ? 'Modify'
                      : action.category === 'create'
                      ? 'Create'
                      : 'Analyze';
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={is_busy}
                      className={styles['lumen-card-ai-action-btn']}
                      onClick={async () => {
                        if (supports_popup) {
                          set_active_ai_action_popup(action.id);
                          return;
                        }
                        const prompt_val =
                          custom_ai_instruction.trim() ||
                          (card.type === 'sound_recorder' &&
                          (action.id === 'sound_translate' ||
                            action.id === 'sound_transcribe_and_translate')
                            ? card.target_language || 'English'
                            : '');
                        set_custom_ai_instruction('');
                        set_active_ai_action_popup(null);
                        set_is_ai_popover_open(false);
                        await runAiCardAction(card.id, action.id, prompt_val);
                      }}
                    >
                      <div className={styles['lumen-card-ai-action-top']}>
                        <span className={styles['lumen-card-ai-action-label']}>
                          {action.label}
                          {supports_popup ? ' ⋯' : ''}
                        </span>
                        <span
                          className={`${styles['lumen-card-ai-badge']} ${
                            styles[`lumen-card-ai-badge-${action.category || 'analyze'}`]
                          }`}
                        >
                          {badge_label}
                        </span>
                      </div>
                      <span className={styles['lumen-card-ai-action-desc']}>{action.description}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Clipped Inner Card Content: Ensures sharp/rounded/soft corner radius clips headers, backgrounds, and footers */}
      <div
        className={styles.lumenCardContentClip}
        style={{
          borderRadius: 'inherit',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 0,
          flex: 1,
        }}
      >
        {/* Card Header (Drag Handle) - Hidden for Group cards or when Card Style is Seamless */}
        {!is_seamless && card.type !== 'group' && (
        <div
          className={styles.lumenCardHeader}
          onMouseDown={handleDragMouseDown}
          onTouchStart={handleDragTouchStart}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseEnter}
          onDoubleClick={(e) => {
            if (card.type === 'canvas') {
              e.stopPropagation();
              openCanvasFullscreen(card.id);
            }
          }}
        >
          <div className={styles.lumenCardHeaderLeft}>
            <div className={styles.lumenCardHeaderDragIcon} title="Drag to move card">
              <GripHorizontal size={14} />
            </div>
            <div
              className={styles.lumenCardHeaderTypeIcon}
              title={getCardTypeLabel(card.type, card.platform)}
            >
              {renderCardTypeIcon(card.type, card.platform)}
            </div>
            <input
              type="text"
              className={styles.lumenCardHeaderTitle}
              value={
                (card.type === 'social' || card.type === 'embed') && typeof card.title === 'string' && (card.title.includes('kere') || card.title.startsWith('Reel · @') || card.title.startsWith('Post · @'))
                  ? (card.social_type === 'post' ? 'Instagram Post' : 'Instagram Reel')
                  : card.type === 'stock' && (!card.title || card.title === 'Global Stock Ticker' || (typeof card.title === 'string' && card.title.includes(' · ')))
                  ? 'Stock Card'
                  : (card.title || '')
              }
              onChange={(e) => updateCard(card.id, { title: e.target.value }, false)}
              onBlur={(e) => updateCard(card.id, { title: e.target.value }, true)}
              placeholder={card.type === 'stock' ? 'Stock Card' : 'Card Title...'}
              onFocus={() => {
                selectedCardsSignal.value = [card.id];
              }}
              onMouseDown={(e) => {
                selectedCardsSignal.value = [card.id];
                if (document.activeElement === e.target) {
                  e.stopPropagation();
                }
              }}
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseEnter}
            />
            {card.type === 'link' && (
              <div
                className={styles.lumenHeaderWebStatus}
                title={`Target Web Status: ${card.web_status_text || '200 OK'} (${card.web_status || 200})`}
              >
                <span className={styles.lumenHeaderWebStatusDot} />
                <span>{card.web_status_text || `${card.web_status || 200} OK`}</span>
              </div>
            )}
          </div>

          {/* Right side: Encryption status & Card Property button */}
          <div className={styles.lumenCardHeaderRight}>
            {is_card_encrypted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
                {is_card_unlocked ? (
                  <>
                    <span
                      title="Card is decrypted and editable in this session (AES-256-GCM)"
                      style={{
                        background: 'rgba(34, 197, 94, 0.12)',
                        color: '#16a34a',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        borderRadius: 4,
                        padding: '2px 5px',
                        fontSize: 10,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        height: 22,
                        userSelect: 'none',
                      }}
                    >
                      <Unlock size={10} />
                      <span>Unlocked</span>
                    </span>
                    <button
                      type="button"
                      className={styles.lumenCardLockHeaderBtn || styles['lumen-card-lock-header-btn']}
                      onClick={(e) => {
                        e.stopPropagation();
                        lockCard(card.id);
                      }}
                      title="Lock card now (Password is already setup)"
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        height: 22,
                        boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <Lock size={11} />
                      <span>Lock</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.lumenCardLockHeaderBtn || styles['lumen-card-lock-header-btn']}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCardPropertyPanel(card.id);
                    }}
                    title="Card is encrypted & locked. Enter passkey to unlock."
                    style={{
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#2563eb',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      height: 22,
                    }}
                  >
                    <Lock size={11} />
                    <span>Encrypted</span>
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              className={`${styles.lumenCardHeaderPropertyBtn} ${styles['lumen-quick-ai-btn']} ${
                is_ai_popover_open ? (styles.lumenCardHeaderPropertyBtnActive || styles['lumen-card-header-property-btn-active']) : ''
              } ${
                isCardAiProcessingSignal.value?.cardId === card.id ? styles['lumen-quick-ai-btn-working'] : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (is_card_locked) {
                  showToast('Unlock this encrypted card first to run AI actions (OWASP LLM06 Guard)');
                  return;
                }
                selectedCardsSignal.value = [card.id];
                set_active_ai_action_popup(null);
                set_is_ai_popover_open(!is_ai_popover_open);
                set_is_tag_popover_open(false);
                set_is_reaction_popover_open(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title={`AI Actions for ${getCardTypeLabel(card.type, card.platform)} (Modify, Analyze, Create)`}
              aria-label={`AI Actions for ${getCardTypeLabel(card.type, card.platform)}`}
            >
              {isCardAiProcessingSignal.value?.cardId === card.id ? (
                <span className={styles['lumen-ai-btn-working-wrap']}>
                  <Loader2 size={13} className={`${styles.lumenSpinIcon} ${styles['lumen-spin-icon']}`} />
                </span>
              ) : (
                <Sparkles size={13} />
              )}
            </button>
            <button
              type="button"
              className={`${styles.lumenCardHeaderPropertyBtn} ${
                is_property_panel_active ? (styles.lumenCardHeaderPropertyBtnActive || styles['lumen-card-header-property-btn-active']) : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleCardPropertyPanel(card.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title={is_property_panel_active ? "Close card properties" : "Card properties inspector"}
              aria-label={is_property_panel_active ? "Close card properties" : "Open card properties"}
            >
              <Sliders size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Animated AI Working Banner on Active Card */}
      {isCardAiProcessingSignal.value?.cardId === card.id && (
        <div className={styles['lumen-card-ai-working-banner']}>
          <div className={styles['lumen-card-ai-working-row']}>
            <span className={styles['lumen-card-ai-working-orb']}>
              <Loader2 size={12} className={styles['lumen-spin-icon']} />
            </span>
            <Sparkles size={11} className={styles['lumen-ai-twinkle-icon']} />
            <span className={styles['lumen-card-ai-working-text']}>AI is working</span>
            <span className={styles['lumen-ai-typing-dots']} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className={styles['lumen-card-ai-working-timer']} title="AI elapsed running time">
              {formatAiElapsedTime(aiWorkingElapsedSecondsSignal.value)}
            </span>
          </div>
          <div className={styles['lumen-card-ai-shimmer-track']}>
            <div className={styles['lumen-card-ai-shimmer-bar']} />
          </div>
        </div>
      )}

      {/* Card Tags / Labels Strip */}
      {!is_seamless && card.type !== 'group' && ((card.tags && card.tags.length > 0) || is_tag_popover_open) && (
        <div className={styles.lumenCardTagsBar} onClick={(e) => e.stopPropagation()}>
          {(card.tags || []).map((t, idx) => {
            const tag_text = typeof t === 'string' ? t : t.text;
            const tag_palette = get_tag_color(t);
            const is_tag_active = activeTagFilterSignal.value?.toLowerCase() === tag_text.toLowerCase();
            const author_prof = t.added_by_id
              ? COLLABORATOR_PROFILES.find((p) => p.id === t.added_by_id)
              : t.added_by ? COLLABORATOR_PROFILES.find((p) => p.name === t.added_by) : null;

            return (
              <span
                key={`${tag_text}_${idx}`}
                className={`${styles.lumenCardTagPill} ${is_tag_active ? styles.lumenCardTagPillActive : ''}`}
                style={{
                  backgroundColor: tag_palette.bg,
                  color: tag_palette.color,
                  borderColor: tag_palette.border,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setTagFilter(tag_text);
                }}
                title={`Label: #${tag_text}${t.added_by ? ` (added by ${t.added_by})` : ''}. Click to filter board`}
              >
                <span className={styles.lumenTagHash}>#</span>
                <span className={styles.lumenTagText}>{tag_text}</span>
                {t.added_by && (
                  <span
                    className={styles.lumenTagAuthorDot}
                    style={{ backgroundColor: author_prof?.color || '#2563eb' }}
                    title={`Added by ${t.added_by}`}
                  />
                )}
                {!is_multiple_selection && (isHovered || isSelected) && (
                  <button
                    type="button"
                    className={styles.lumenTagRemoveBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      multiUserRemoveTag(card.id, idx);
                    }}
                    title="Remove tag"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            );
          })}

          {!is_multiple_selection && (isHovered || isSelected) && (
            <button
              type="button"
              className={styles.lumenAddTagMiniBtn}
              onClick={(e) => {
                e.stopPropagation();
                set_is_tag_popover_open(!is_tag_popover_open);
                set_is_reaction_popover_open(false);
              }}
              title="Add label / tag"
            >
              <Plus size={10} />
              <span>Tag</span>
            </button>
          )}

          {/* Floating Tag Popover */}
          {!is_multiple_selection && is_tag_popover_open && (
            <div className={styles.lumenFloatingPopover} onClick={(e) => e.stopPropagation()}>
              <div className={styles.lumenPopoverTitle}>
                <span>Add Card Label</span>
                <button
                  type="button"
                  className={styles.lumenPopoverCloseBtn}
                  onClick={() => set_is_tag_popover_open(false)}
                >
                  <X size={12} />
                </button>
              </div>

              <div className={styles.lumenPopoverPersonaBar}>
                <span
                  className={styles.lumenPopoverAvatarMini}
                  style={{ backgroundColor: currentUserSignal.value.color }}
                >
                  {currentUserSignal.value.avatar}
                </span>
                <span>Adding as <strong>{currentUserSignal.value.name.split(' ')[0]}</strong></span>
              </div>

              <div className={styles.lumenTagSuggestionsRow}>
                {['Design', 'Sprint', 'Urgent', 'Review', 'Inspiration', 'Milestone', 'Draft'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={styles.lumenTagSuggestionChip}
                    onClick={() => {
                      multiUserAddTag(card.id, preset);
                      set_is_tag_popover_open(false);
                    }}
                  >
                    #{preset}
                  </button>
                ))}
              </div>

              <form
                className={styles.lumenCustomInputRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom_tag_input.trim()) {
                    multiUserAddTag(card.id, custom_tag_input.trim());
                    set_custom_tag_input('');
                    set_is_tag_popover_open(false);
                  }
                }}
              >
                <input
                  type="text"
                  className={styles.lumenCustomInput}
                  value={custom_tag_input}
                  onChange={(e) => set_custom_tag_input(e.target.value)}
                  placeholder="New label text..."
                  autoFocus
                />
                <button type="submit" className={styles.lumenPopoverApplyBtn} disabled={!custom_tag_input.trim()}>
                  Add
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Card Time Range / Due Date & Google Calendar Synced Strip */}
      {!is_seamless && card.type !== 'group' && cardTimeStatus.has_time_range && (
        <div
          className={styles['lumen-card-time-range-bar']}
          onClick={(e) => {
            e.stopPropagation();
            selectedCardsSignal.value = [card.id];
            openPropertyPanel(true);
          }}
          title={`Time Range: ${cardTimeStatus.start_str} to ${cardTimeStatus.end_str} (Click to edit or sync with Google Calendar)`}
        >
          <div className={styles['lumen-card-time-range-left']}>
            <Clock size={10} color={cardTimeStatus.status_color || '#2563eb'} style={{ flexShrink: 0 }} />
            <span
              className={styles['lumen-card-time-status-pill']}
              style={{
                color: cardTimeStatus.status_color,
                backgroundColor: cardTimeStatus.status_bg,
                borderColor: cardTimeStatus.status_border,
              }}
            >
              {cardTimeStatus.status_label}
            </span>
            <span className={styles['lumen-card-time-range-text']}>
              {cardTimeStatus.start_str} → {cardTimeStatus.end_str}
            </span>
          </div>
          {(card.calendar_event_link || card.calendar_event_id) && (
            <a
              href={card.calendar_event_link || 'https://calendar.google.com'}
              target="_blank"
              rel="noopener noreferrer"
              className={styles['lumen-card-time-gcal-link']}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title="Synced to Google Calendar — click to open event"
            >
              <Calendar size={9.5} />
              <span>GCal</span>
            </a>
          )}
        </div>
      )}

      {/* Card Body - Rendered by Module Type */}
      <div
        className={`${styles.lumenCardBody} ${
          is_card_locked ? styles.lumenCardBodyFlush : ''
        } ${
          is_seamless ? (styles['lumen-card-body-seamless'] || '') : ''
        } ${
          card.type === 'embed' || card.type === 'social' || card.type === 'geo' || card.type === 'palette' || card.type === 'group' || card.type === 'stock' || card.type === 'sheets' || card.type === 'docs' || card.type === 'code' || card.type === 'currency' || card.type === 'clock' || card.type === 'canvas' || card.type === 'item' || card.type === 'sound_recorder' || (is_seamless && (card.type === 'file' || card.type === 'image')) ? styles.lumenCardBodyFlush : ''
        } ${card.type === 'heading' ? styles.lumenCardBodyHeading : ''} ${
          card.type === 'image' && !is_seamless ? styles.lumenCardBodyImage : ''
        } ${card.type === 'board' ? styles.lumenCardBodyBoard : ''}`}
        style={
          resolved_font_css
            ? { fontFamily: resolved_font_css, '--lumen-card-font': resolved_font_css }
            : undefined
        }
      >
        {is_card_locked ? (
          <LUMEN_card_lock_overlay card={card} />
        ) : (
          <>
            {card.type === 'item' && (
              <LUMEN_item_card card={card} />
            )}

        {card.type === 'stock' && (
          <LUMEN_stock_card card={card} />
        )}

        {card.type === 'sheets' && (
          <LUMEN_sheets_card card={card} />
        )}

        {card.type === 'docs' && (
          <LUMEN_docs_card card={card} />
        )}

        {card.type === 'code' && (
          <LUMEN_code_card card={card} />
        )}

        {card.type === 'currency' && (
          <LUMEN_currency_card card={card} />
        )}

        {card.type === 'clock' && (
          <LUMEN_clock_card card={card} />
        )}

        {card.type === 'canvas' && (
          <LUMEN_canvas_card card={card} />
        )}

        {card.type === 'group' && (
          <LUMEN_group_card card={card} onDragMouseDown={handleDragMouseDown} />
        )}

        {card.type === 'palette' && (
          <LUMEN_palette_card card={card} />
        )}

        {card.type === 'geo' && (
          <LUMEN_geo_card card={card} />
        )}

        {card.type === 'file' && (
          <LUMEN_file_card card={card} />
        )}

        {card.type === 'sound_recorder' && (
          <LUMEN_sound_recorder_card card={card} />
        )}

        {card.type === 'board' && (
          <LUMEN_board_card card={card} />
        )}

        {(card.type === 'embed' || card.type === 'social') && (
          <LUMEN_embed_card card={card} />
        )}

        {card.type === 'note' && (() => {
          const raw_kps = Array.isArray(card.timestamped_keypoints) && card.timestamped_keypoints.length > 0
            ? card.timestamped_keypoints
            : (() => {
                const txt = String(card.content || '');
                if (!/\[\d{1,2}:\d{2}\]/.test(txt)) return [];
                const lines = txt.split(/\r?\n/);
                const extracted = [];
                for (let i = 0; i < lines.length; i += 1) {
                  const line = lines[i].trim();
                  const m = line.match(/^(?:[•\-*]\s*)?(?:\*\*)?\[(\d{1,2}):(\d{2})\](?:\*\*)?\s*(.+)$/);
                  if (m) {
                    const mm = Number(m[1] || 0);
                    const ss = Number(m[2] || 0);
                    const sec = mm * 60 + ss;
                    const label_raw = String(m[3] || '').replace(/\*\*/g, '').split(/[:—–]/)[0].trim();
                    extracted.push({
                      id: `note_kp_${i}_${sec}`,
                      timestamp: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
                      seconds: sec,
                      label: label_raw.slice(0, 42) || `Point ${extracted.length + 1}`,
                    });
                    if (extracted.length >= 12) break;
                  }
                }
                return extracted;
              })();

          return (
            <>
              {raw_kps.length > 0 && (
                <div
                  className={styles['lumen-note-timestamp-verify-bar']}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles['lumen-note-timestamp-verify-header']}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Mic size={10} />
                      <span>Verify Key Points on Recording ({raw_kps.length})</span>
                    </span>
                    <span style={{ fontWeight: 500, textTransform: 'none', opacity: 0.8 }}>
                      Click [MM:SS] to play
                    </span>
                  </div>
                  <div className={styles['lumen-note-timestamp-chips-row']}>
                    {raw_kps.map((kp, idx) => (
                      <button
                        key={kp.id || `kp_${idx}`}
                        type="button"
                        className={styles['lumen-note-timestamp-chip']}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(
                              new CustomEvent('lumen:verify-recording-timestamp', {
                                detail: {
                                  soundCardId: card.source_sound_card_id || null,
                                  seconds: Number(kp.seconds) || 0,
                                  timestampLabel: kp.timestamp || '00:00',
                                  label: kp.label || '',
                                },
                              })
                            );
                          }
                        }}
                        title={`Verify [${kp.timestamp}] on audio recording: ${kp.details || kp.label || ''}`}
                      >
                        <span className={styles['lumen-note-timestamp-chip-code']}>
                          [{kp.timestamp}]
                        </span>
                        {kp.label && (
                          <span className={styles['lumen-note-timestamp-chip-label']}>
                            {kp.label}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <LUMEN_note_rich_editor
                card={card}
                update_card_fn={updateCard}
                resolved_font_css={resolved_font_css}
              />
            </>
          );
        })()}

        {card.type === 'tasklist' && (
          <div className={styles.lumenChecklist} style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}>
            {totalTasks > 0 && (
              <div className={styles.lumenChecklistProgress}>
                <div className={styles.lumenProgressBarTrack}>
                  <div
                    className={styles.lumenProgressBarFill}
                    style={{ width: `${taskPercent}%` }}
                  />
                </div>
                <div className={styles.lumenProgressText}>
                  <span>Progress</span>
                  <span>
                    {completedTasks}/{totalTasks} ({taskPercent}%)
                  </span>
                </div>
              </div>
            )}

            {(card.items || []).map((item) => (
              <div key={item.id} className={styles.lumenCheckItem}>
                <div
                  className={`${styles.lumenCheckbox} ${
                    item.done ? styles.lumenCheckboxChecked : ''
                  }`}
                  onClick={() => handleToggleTask(item.id)}
                >
                  {item.done && <Check size={12} strokeWidth={3} />}
                </div>
                <textarea
                  rows={1}
                  ref={(el) => {
                    if (el && displayCardWidth) {
                      el.style.height = 'auto';
                      el.style.height = `${Math.max(20, el.scrollHeight)}px`;
                    }
                  }}
                  className={`${styles.lumenCheckItemInput} ${
                    item.done ? styles.lumenCheckItemDone : ''
                  }`}
                  style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
                  value={item.text}
                  onChange={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.max(20, e.target.scrollHeight)}px`;
                    handleUpdateTaskText(item.id, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={() => updateCard(card.id, { items: card.items }, true)}
                />
                <button
                  type="button"
                  className={styles.lumenCheckItemDelete}
                  onClick={() => handleDeleteTask(item.id)}
                  title="Remove item"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <button
              type="button"
              className={styles.lumenAddCheckItemBtn}
              onClick={handleAddTask}
            >
              <Plus size={14} />
              <span>Add item</span>
            </button>

            {/* Card Note (if exist on visual board) */}
            {card.content && (
              <div className={styles.lumenCardNoteBlock}>
                <div className={styles.lumenCardNoteHeader}>
                  <FileText size={10} />
                  <span>Note</span>
                </div>
                <div className={styles.lumenCardNoteText} style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}>
                  {card.content}
                </div>
              </div>
            )}
          </div>
        )}

        {card.type === 'heading' && (
          <div className={styles.lumenHeadingContainer} style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}>
            <textarea
              className={styles.lumenHeadingMain}
              style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
              value={card.title}
              rows={Math.max(1, (card.title || '').split('\n').length)}
              onChange={(e) => {
                const newTitle = e.target.value;
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
                const tLines = Math.max(1, newTitle.split('\n').length);
                const sLines = Math.max(1, (card.content || '').split('\n').length);
                const neededH = 96 + Math.max(0, tLines - 1) * 24 + Math.max(0, sLines - 1) * 18;
                const newHeight = Math.max(card.height || 96, neededH);
                updateCard(card.id, { title: newTitle, height: newHeight }, false);
              }}
              onBlur={(e) => {
                const newTitle = e.target.value;
                const tLines = Math.max(1, newTitle.split('\n').length);
                const sLines = Math.max(1, (card.content || '').split('\n').length);
                const neededH = 96 + Math.max(0, tLines - 1) * 24 + Math.max(0, sLines - 1) * 18;
                const newHeight = Math.max(card.height || 96, neededH);
                updateCard(card.id, { title: newTitle, height: newHeight }, true);
              }}
              placeholder="Section Heading"
            />
            <textarea
              className={styles.lumenHeadingSub}
              style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
              value={card.content || ''}
              rows={Math.max(1, (card.content || '').split('\n').length)}
              onChange={(e) => {
                const newContent = e.target.value;
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
                const tLines = Math.max(1, (card.title || '').split('\n').length);
                const sLines = Math.max(1, newContent.split('\n').length);
                const neededH = 96 + Math.max(0, tLines - 1) * 24 + Math.max(0, sLines - 1) * 18;
                const newHeight = Math.max(card.height || 96, neededH);
                updateCard(card.id, { content: newContent, height: newHeight }, false);
              }}
              onBlur={(e) => {
                const newContent = e.target.value;
                const tLines = Math.max(1, (card.title || '').split('\n').length);
                const sLines = Math.max(1, newContent.split('\n').length);
                const neededH = 96 + Math.max(0, tLines - 1) * 24 + Math.max(0, sLines - 1) * 18;
                const newHeight = Math.max(card.height || 96, neededH);
                updateCard(card.id, { content: newContent, height: newHeight }, true);
              }}
              placeholder="Optional section description or sub-label"
            />
          </div>
        )}

        {card.type === 'image' && (
          <LUMEN_image_carousel card={card} />
        )}

        {card.type === 'quote' && (
          <div className={styles.lumenQuoteContainer} style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}>
            <div className={styles.lumenQuoteMark}>“</div>
            <textarea
              className={styles.lumenQuoteText}
              style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
              value={card.content || ''}
              onChange={(e) => updateCard(card.id, { content: e.target.value }, false)}
              onBlur={(e) => updateCard(card.id, { content: e.target.value }, true)}
              placeholder="Enter quote text..."
            />
            <div className={styles.lumenQuoteAuthor}>
              <span>—</span>
              <input
                type="text"
                className={styles.lumenQuoteAuthorInput}
                style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
                value={card.author || ''}
                onChange={(e) => updateCard(card.id, { author: e.target.value }, false)}
                onBlur={(e) => updateCard(card.id, { author: e.target.value }, true)}
                placeholder="Author or source..."
              />
            </div>
          </div>
        )}

        {card.type === 'link' && (
          <div className={styles.lumenLinkContainer}>
            <div className={styles.lumenLinkHeader}>
              <div className={styles.lumenLinkHeaderLeft}>
                {card.favicon ? (
                  <img
                    src={card.favicon}
                    alt=""
                    className={styles.lumenLinkFavicon}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe size={12} className={styles.lumenLinkGlobeIcon} />
                )}
                <span className={styles.lumenLinkDomain}>
                  {card.domain || safeGetDomain(card.url)}
                </span>
                <div
                  className={styles.lumenLinkStatusBadge}
                  title={`Status: ${card.web_status_text || '200 OK'} (${card.web_status || 200})`}
                >
                  <span className={styles.lumenLinkStatusDot} />
                  <span>{card.web_status || 200}</span>
                </div>
              </div>

              <div className={styles.lumenLinkHeaderRight}>
                <button
                  type="button"
                  className={`${styles.lumenLinkRefreshBtn} ${is_fetching_link_meta ? styles.lumenLinkRefreshBtnActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    refresh_link_metadata(card.url, true);
                  }}
                  title="Refresh website title, preview image & status"
                >
                  <RefreshCw
                    size={11}
                    style={{
                      animation: is_fetching_link_meta ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                </button>
                {(card.og_image || card.image_url || card.imageUrl) && (
                  <button
                    type="button"
                    className={styles.lumenLinkImageModalBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      const img = card.og_image || card.image_url || card.imageUrl;
                      openImageViewer({
                        cardId: card.id,
                        title: card.title || 'Web Link Preview',
                        slides: [{ url: img, caption: card.title || card.url || 'Web Resource' }],
                        activeIndex: 0,
                        initialMode: 'fit',
                      });
                    }}
                    title="Open image preview render"
                  >
                    <Expand size={10} />
                    <span>View Image</span>
                  </button>
                )}
                <a
                  href={safeGetHref(card.url)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.lumenLinkOpenBtn}
                  title="Open link in new window"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <span>Open</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Visual Image Render Preview Banner */}
            {(card.og_image || card.image_url || card.imageUrl) ? (
              <div
                className={styles.lumenLinkPreviewCard}
                onClick={(e) => {
                  e.stopPropagation();
                  const img = card.og_image || card.image_url || card.imageUrl;
                  openImageViewer({
                    cardId: card.id,
                    title: card.title || 'Web Link Preview',
                    slides: [{ url: img, caption: card.title || card.url || 'Web Resource' }],
                    activeIndex: 0,
                    initialMode: 'fit',
                  });
                }}
                title="Click to expand full image render"
              >
                <img
                  src={card.og_image || card.image_url || card.imageUrl}
                  alt={card.title || 'Website preview render'}
                  className={styles.lumenLinkPreviewImg}
                  loading="lazy"
                />
                <div className={styles.lumenLinkImageOverlay}>
                  <Expand size={10} />
                  <span>Open Image</span>
                </div>
              </div>
            ) : (
              <div
                className={styles.lumenLinkImagePlaceholder}
                onClick={(e) => {
                  e.stopPropagation();
                  refresh_link_metadata(card.url, true);
                }}
                title="Refresh preview image & website metadata"
              >
                {is_fetching_link_meta ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 10 }}>Fetching web preview...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={16} />
                    <span style={{ fontSize: 10 }}>Load image preview render</span>
                  </>
                )}
              </div>
            )}

            <textarea
              className={styles.lumenCardTextarea}
              style={{
                minHeight: 40,
                fontSize: 12,
                resize: 'none',
                ...(resolved_font_css ? { fontFamily: resolved_font_css } : {}),
              }}
              value={card.content || card.description || ''}
              onChange={(e) => updateCard(card.id, { description: e.target.value, content: e.target.value }, false)}
              onBlur={(e) => updateCard(card.id, { description: e.target.value, content: e.target.value }, true)}
              placeholder="Add link summary or annotations..."
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div
              className={styles.lumenLinkInputRow || styles['lumen-link-input-row']}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Link2 size={12} className={styles.lumenLinkInputIcon || styles['lumen-link-input-icon']} />
              <input
                type="text"
                className={styles.lumenLinkUrlInput}
                value={card.url || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateCard(card.id, { url: val }, false);
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  updateCard(card.id, { url: val }, true);
                  if (val && val !== card.meta_resolved_url) {
                    refresh_link_metadata(val, true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    e.currentTarget.blur();
                    if (val) {
                      refresh_link_metadata(val, true);
                    }
                  }
                }}
                placeholder="https://..."
                title="Target URL address"
              />
              <button
                type="button"
                className={`${styles.lumenLinkRefreshBtn} ${is_fetching_link_meta ? styles.lumenLinkRefreshBtnActive : ''}`}
                style={{ width: 18, height: 18, border: 'none', background: 'transparent' }}
                onClick={(e) => {
                  e.stopPropagation();
                  refresh_link_metadata(card.url, true);
                }}
                title="Fetch / Refresh website title and image"
              >
                <RefreshCw
                  size={11}
                  style={{
                    animation: is_fetching_link_meta ? 'spin 1s linear infinite' : 'none',
                    color: is_fetching_link_meta ? 'var(--lumen-accent, #2563eb)' : 'var(--lumen-text-muted, #94a3b8)',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {card.type === 'column' && (
          <textarea
            className={styles.lumenCardTextarea}
            style={resolved_font_css ? { fontFamily: resolved_font_css } : undefined}
            value={card.content || ''}
            onChange={(e) => updateCard(card.id, { content: e.target.value }, false)}
            onBlur={(e) => updateCard(card.id, { content: e.target.value }, true)}
            placeholder="Organize stack or column list..."
          />
        )}
          </>
        )}
      </div>

      {/* Card Emoji Reactions & Comments Bar - Hidden in Seamless Mode */}
      {!is_seamless && card.type !== 'group' && (
        <div className={styles.lumenCardReactionsBar} onClick={(e) => e.stopPropagation()}>
          {(card.reactions || []).map((rx) => {
          const current_user_id = currentUserSignal.value.id;
          const is_user_reacted = (Array.isArray(rx.users) && rx.users.includes(current_user_id)) || (rx.user_reacted && !Array.isArray(rx.users));
          const reacting_names = (rx.users || []).map((uid) => {
            if (uid === current_user_id) return 'You';
            const p = COLLABORATOR_PROFILES.find((prof) => prof.id === uid);
            return p ? p.name : 'Collaborator';
          });
          const rx_title = reacting_names.length > 0
            ? `${reacting_names.join(', ')} reacted with ${rx.emoji} (Click to toggle)`
            : `${rx.count} reaction${rx.count > 1 ? 's' : ''}`;

          return (
            <button
              key={rx.emoji}
              type="button"
              className={`${styles.lumenReactionBadge} ${is_user_reacted ? styles.lumenReactionBadgeActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                multiUserToggleReaction(card.id, rx.emoji);
              }}
              title={rx_title}
            >
              <span className={styles.lumenReactionEmoji}>{rx.emoji}</span>
              <span className={styles.lumenReactionCount}>{rx.count}</span>
              {Array.isArray(rx.users) && rx.users.length > 0 && (
                <span className={styles.lumenReactionAvatarsRow}>
                  {rx.users.slice(0, 3).map((uid) => {
                    const prof = COLLABORATOR_PROFILES.find((p) => p.id === uid);
                    return (
                      <span
                        key={uid}
                        className={styles.lumenReactionUserDot}
                        style={{ backgroundColor: prof?.color || '#2563eb' }}
                        title={uid === current_user_id ? 'You' : (prof?.name || 'Collaborator')}
                      >
                        {prof?.avatar || 'U'}
                      </span>
                    );
                  })}
                  {rx.users.length > 3 && (
                    <span className={styles.lumenReactionMoreDots}>
                      +{rx.users.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}

        <div className={styles.lumenAddReactionWrap}>
          <button
            type="button"
            className={styles.lumenAddReactionBtn}
            onClick={(e) => {
              e.stopPropagation();
              set_is_reaction_popover_open(!is_reaction_popover_open);
              set_is_tag_popover_open(false);
            }}
            title="Add emoji reaction"
          >
            <SmilePlus size={11} />
            <span>+</span>
          </button>

          {/* Floating Emoji Reaction Popover */}
          {is_reaction_popover_open && (
            <div className={styles.lumenFloatingPopover} onClick={(e) => e.stopPropagation()}>
              <div className={styles.lumenPopoverTitle}>
                <span>React to Card</span>
                <button
                  type="button"
                  className={styles.lumenPopoverCloseBtn}
                  onClick={() => set_is_reaction_popover_open(false)}
                >
                  <X size={12} />
                </button>
              </div>

              <div className={styles.lumenPopoverPersonaBar}>
                <span
                  className={styles.lumenPopoverAvatarMini}
                  style={{ backgroundColor: currentUserSignal.value.color }}
                >
                  {currentUserSignal.value.avatar}
                </span>
                <span>Reacting as <strong>{currentUserSignal.value.name.split(' ')[0]}</strong></span>
              </div>

              <div className={styles.lumenEmojiGrid}>
                {COMMON_REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={styles.lumenEmojiChoiceBtn}
                    onClick={() => {
                      multiUserToggleReaction(card.id, emoji);
                      set_is_reaction_popover_open(false);
                    }}
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form
                className={styles.lumenCustomInputRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom_emoji_input.trim()) {
                    multiUserToggleReaction(card.id, custom_emoji_input.trim());
                    set_custom_emoji_input('');
                    set_is_reaction_popover_open(false);
                  }
                }}
              >
                <input
                  type="text"
                  className={styles.lumenCustomInput}
                  value={custom_emoji_input}
                  onChange={(e) => set_custom_emoji_input(e.target.value)}
                  placeholder="Emoji..."
                />
                <button type="submit" className={styles.lumenPopoverApplyBtn} disabled={!custom_emoji_input.trim()}>
                  React
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Card Comments Trigger Button - Permanently Visible */}
        {(() => {
          const comment_count = (cardCommentsSignal.value[card.id] || []).length;
          const comments_list = cardCommentsSignal.value[card.id] || [];
          const latest_comment = comments_list.length > 0 ? comments_list[comments_list.length - 1] : null;

          return (
            <button
              type="button"
              className={`${styles.lumenCardCommentBtn} ${comment_count > 0 ? styles.lumenCardCommentBtnActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                openCardCommentsDrawer(card.id);
              }}
              title={comment_count > 0 ? `${comment_count} team comments (Click to open discussion)` : 'Card discussion & comments'}
            >
              <MessageSquare size={11} />
              <span>{comment_count}</span>
              {latest_comment && (
                <span
                  className={styles.lumenCommentLatestAvatar}
                  style={{ backgroundColor: latest_comment.user_color || '#2563eb' }}
                  title={`Latest comment by ${latest_comment.user_name}`}
                >
                  {latest_comment.user_avatar || 'U'}
                </span>
              )}
            </button>
          );
        })()}
        </div>
      )}
      </div>

      {/* Resize & Free Transform Handles */}
      {isGroup ? (
        <>
          {/* 4 Corner Handles (Min Width 320 enforced) */}
          <div
            className={`${styles.lumenGroupTransformHandle} ${styles.lumenGroupTransformHandleNW}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            title="Resize top-left (min width 320)"
          />
          <div
            className={`${styles.lumenGroupTransformHandle} ${styles.lumenGroupTransformHandleNE}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            title="Resize top-right (min width 320)"
          />
          <div
            className={`${styles.lumenGroupTransformHandle} ${styles.lumenGroupTransformHandleSW}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            title="Resize bottom-left (min width 320)"
          />
          <div
            className={`${styles.lumenGroupTransformHandle} ${styles.lumenGroupTransformHandleSE}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            title="Resize bottom-right (min width 320)"
          />

          {/* 4 Edge Handles */}
          <div
            className={`${styles.lumenGroupTransformEdge} ${styles.lumenGroupTransformEdgeN}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
            title="Resize height top"
          >
            <div className={styles.lumenGroupTransformEdgeMarkerH} />
          </div>
          <div
            className={`${styles.lumenGroupTransformEdge} ${styles.lumenGroupTransformEdgeS}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
            title="Resize height bottom"
          >
            <div className={styles.lumenGroupTransformEdgeMarkerH} />
          </div>
          <div
            className={`${styles.lumenGroupTransformEdge} ${styles.lumenGroupTransformEdgeW}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
            title="Resize width left (min width 320)"
          >
            <div className={styles.lumenGroupTransformEdgeMarkerV} />
          </div>
          <div
            className={`${styles.lumenGroupTransformEdge} ${styles.lumenGroupTransformEdgeE}`}
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
            title="Resize width right (min width 320)"
          >
            <div className={styles.lumenGroupTransformEdgeMarkerV} />
          </div>
        </>
      ) : (
        <>
          <div
            className={styles.lumenResizeCorner}
            onMouseDown={(e) => handleResizeMouseDown(e, 'corner')}
            onDoubleClick={handleAutoResizeContent}
            title="Drag to resize, or double-click to auto-resize based on original content"
          >
            <div className={styles.lumenResizeCornerMarker} />
          </div>
          <div
            className={styles.lumenResizeCornerTopRight || styles['lumen-resize-corner-top-right']}
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            onDoubleClick={handleAutoResizeContent}
            title="Drag to resize top-right, or double-click to auto-resize based on original content"
          >
            <div className={styles.lumenResizeCornerMarkerTopRight || styles['lumen-resize-corner-marker-top-right']} />
          </div>
          <div
            className={styles.lumenResizeCornerBottomLeft || styles['lumen-resize-corner-bottom-left']}
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            onDoubleClick={handleAutoResizeContent}
            title="Drag to resize bottom-left, or double-click to auto-resize based on original content"
          >
            <div className={styles.lumenResizeCornerMarkerBottomLeft || styles['lumen-resize-corner-marker-bottom-left']} />
          </div>
          <div
            className={styles.lumenResizeEdgeRight}
            onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
            title="Resize width"
          />
          <div
            className={styles.lumenResizeEdgeBottom}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
            title="Resize height"
          />
        </>
      )}

      {/* Live Dimension Indicator while Resizing */}
      {isResizing && (
        <div className={styles.lumenDimensionIndicator}>
          {resizeDim.w} × {resizeDim.h}px
        </div>
      )}

      {/* Target anchor glow if connecting */}
      {isConnectingTarget && (
        <>
          <div
            className={`${styles.lumenConnectorAnchor} ${styles.lumenAnchorTop}`}
            onClick={(e) => {
              e.stopPropagation();
              addConnection(connectingSourceSignal.value, card.id);
              connectingSourceSignal.value = null;
              tempConnectionLineSignal.value = null;
              activeToolSignal.value = 'select';
            }}
          />
          <div
            className={`${styles.lumenConnectorAnchor} ${styles.lumenAnchorBottom}`}
            onClick={(e) => {
              e.stopPropagation();
              addConnection(connectingSourceSignal.value, card.id);
              connectingSourceSignal.value = null;
              tempConnectionLineSignal.value = null;
              activeToolSignal.value = 'select';
            }}
          />
          <div
            className={`${styles.lumenConnectorAnchor} ${styles.lumenAnchorLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              addConnection(connectingSourceSignal.value, card.id);
              connectingSourceSignal.value = null;
              tempConnectionLineSignal.value = null;
              activeToolSignal.value = 'select';
            }}
          />
          <div
            className={`${styles.lumenConnectorAnchor} ${styles.lumenAnchorRight}`}
            onClick={(e) => {
              e.stopPropagation();
              addConnection(connectingSourceSignal.value, card.id);
              connectingSourceSignal.value = null;
              tempConnectionLineSignal.value = null;
              activeToolSignal.value = 'select';
            }}
          />
        </>
      )}
    </div>
  );
}
