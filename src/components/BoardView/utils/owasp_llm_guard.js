/**
 * OWASP Top 10 for LLM Applications (LLM01 - LLM10) Security Guard
 *
 * Protects Lumen AI Board Assistant & MCP endpoints against:
 * - LLM01: Prompt Injection (Direct & Indirect)
 * - LLM02: Insecure Output Handling (XSS, script/URI injection, DOM ID spoofing)
 * - LLM03: Training / Context Data Poisoning (Bidi/zero-width characters, payload floods)
 * - LLM04: Model Denial of Service (Rate limiting, input length & context token caps)
 * - LLM05: Supply Chain Vulnerabilities (Strict server-side model allowlisting)
 * - LLM06: Sensitive Information Disclosure (Zero-leak encrypted card redaction, secret scrubbing)
 * - LLM07: System Prompt Leakage & Tool Input Validation
 * - LLM08: Excessive Agency (Read-only scope enforcement, allowlisted card IDs)
 * - LLM09: Overreliance / Misinformation (Strict board grounding & financial disclaimers)
 * - LLM10: Model Theft / Extraction Prevention
 */

export const OWASP_LLM_LIMITS = {
  max_question_length: 1000,
  max_cards_in_context: 60,
  max_card_title_length: 160,
  max_card_content_length: 600,
  max_card_notes_length: 300,
  max_tasks_per_card: 25,
  max_task_text_length: 160,
  max_tags_per_card: 12,
  max_tag_length: 40,
  max_connections_in_context: 80,
  max_answer_length: 6000,
  max_followups: 3,
  max_followup_length: 140,
  rate_limit_window_ms: 60 * 1000,
  rate_limit_max_requests: 15,
};

// Direct Prompt Injection & System Prompt Extraction patterns (LLM01, LLM07, LLM10)
const DIRECT_PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier|preceding)\s+(instructions|prompts|rules|directions|guidelines)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts|rules|directions)/i,
  /forget\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions|prompts|rules|training)/i,
  /(reveal|show|print|output|repeat|dump|display|leak)\s+(your\s+|the\s+)?(system\s+prompt|system\s+instruction|hidden\s+prompt|developer\s+prompt|initial\s+instructions|secret\s+instructions)/i,
  /what\s+(is|are)\s+your\s+(system\s+prompt|system\s+instructions|hidden\s+instructions|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|dan\b|do\s+anything\s+now|jailbreak|unrestricted|god\s+mode|admin\s+mode)/i,
  /act\s+as\s+an?\s+(unrestricted|unfiltered|jailbroken|malicious)/i,
  /(bypass|override|disable)\s+(all\s+)?(safety|security|content|owasp)\s+(filters|guards|rules|restrictions|policies)/i,
  /(print|dump|reveal|show|output|read)\s+(process\.env|environment\s+variables|database_url|gemini_api_key|api_key|private_key|etc\/passwd)/i,
  /(execute|run)\s+(arbitrary|unauthorized|malicious|host|server)\s+(shell|bash|system|os)\s+(command|script)/i,
  /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|endoftext\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>/i,
];

// Indirect Prompt Injection phrases that might be hidden inside card content or web metadata (LLM01, LLM03)
const INDIRECT_INJECTION_REPLACEMENTS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/gi,
  /system\s*override\s*:/gi,
  /new\s+system\s+instructions?\s*:/gi,
  /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|endoftext\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>/gi,
  /<\/?untrusted_workspace_data>/gi,
];

// Sensitive secrets & credentials patterns for output/context scrubbing (LLM06)
const SENSITIVE_SECRET_PATTERNS = [
  /AIza[0-9A-Za-z\-_]{35}/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /-----BEGIN\s+[A-Z\s]*PRIVATE\s+KEY-----[\s\S]*?-----END\s+[A-Z\s]*PRIVATE\s+KEY-----/g,
  /(?:GEMINI_API_KEY|DATABASE_URL|API_KEY|SECRET_KEY)\s*=\s*[^\s"'<>]+/gi,
];

/**
 * Strips invisible zero-width and bidirectional override characters (LLM03)
 */
export function strip_control_and_bidi_chars(input_str) {
  if (!input_str || typeof input_str !== 'string') return '';
  return input_str
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '');
}

/**
 * Scrubs accidental secrets, API keys, or DB connection strings (LLM06)
 */
export function scrub_sensitive_secrets(input_str) {
  if (!input_str || typeof input_str !== 'string') return '';
  let cleaned = input_str;
  for (const pattern of SENSITIVE_SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED_SECRET]');
  }
  return cleaned;
}

/**
 * Sanitizes untrusted text fields from cards to neutralize indirect prompt injection (LLM01, LLM03)
 */
export function sanitize_untrusted_card_field(val, max_len = 600) {
  if (val === undefined || val === null) return '';
  let text = strip_control_and_bidi_chars(String(val));
  text = scrub_sensitive_secrets(text);
  for (const pattern of INDIRECT_INJECTION_REPLACEMENTS) {
    text = text.replace(pattern, '[filtered-instruction]');
  }
  if (text.length > max_len) {
    text = text.slice(0, max_len) + '...';
  }
  return text.trim();
}

/**
 * Validates and sanitizes the user's AI prompt question (LLM01, LLM04, LLM07, LLM10)
 * Returns { allowed: boolean, sanitized_question: string, reason?: string, code?: string }
 */
export function validate_and_sanitize_ai_question(raw_question) {
  if (!raw_question || typeof raw_question !== 'string') {
    return {
      allowed: false,
      sanitized_question: '',
      code: 'LLM04_EMPTY_INPUT',
      reason: 'Please enter a valid question about your board.',
    };
  }

  const cleaned = strip_control_and_bidi_chars(raw_question).trim();
  if (!cleaned) {
    return {
      allowed: false,
      sanitized_question: '',
      code: 'LLM04_EMPTY_INPUT',
      reason: 'Please enter a valid question about your board.',
    };
  }

  // LLM04: Cap excessive input length to prevent Model DoS
  const bounded_question =
    cleaned.length > OWASP_LLM_LIMITS.max_question_length
      ? cleaned.slice(0, OWASP_LLM_LIMITS.max_question_length)
      : cleaned;

  // LLM01 / LLM07 / LLM10: Detect direct prompt injection, jailbreaks, or system prompt extraction
  for (const pattern of DIRECT_PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(bounded_question)) {
      return {
        allowed: false,
        sanitized_question: '',
        code: 'LLM01_PROMPT_INJECTION_BLOCKED',
        reason:
          'Security Guard (OWASP LLM01/LLM07): Request blocked because it contains instruction-override, system-prompt extraction, or restricted execution patterns. Please ask a question focused on your workspace cards.',
      };
    }
  }

  return {
    allowed: true,
    sanitized_question: scrub_sensitive_secrets(bounded_question),
  };
}

/**
 * Checks whether a card is encrypted / locked so its plaintext is never sent to AI (LLM06)
 */
export function is_card_encrypted_for_ai(card) {
  if (!card || typeof card !== 'object') return false;
  if (card.is_encrypted || card.isEncrypted) return true;
  const enc = card.card_encryption || card.cardEncryption || card.encryption;
  if (!enc) return false;
  if (typeof enc === 'object' && (enc.ciphertext || enc.is_encrypted || enc.enabled)) {
    return true;
  }
  if (typeof enc === 'string' && enc.includes('ciphertext')) {
    return true;
  }
  return false;
}

/**
 * Builds a sanitized, bounded, zero-leak board context for the LLM (LLM01, LLM03, LLM04, LLM06)
 */
export function build_safe_board_context(board, selected_card_ids = []) {
  const safe_board = board && typeof board === 'object' ? board : {};
  const raw_cards = Array.isArray(safe_board.cards) ? safe_board.cards : [];
  const bounded_cards = raw_cards.slice(0, OWASP_LLM_LIMITS.max_cards_in_context);

  const valid_card_id_set = new Set();
  const sanitized_cards = [];

  for (const c of bounded_cards) {
    if (!c || typeof c !== 'object' || !c.id) continue;
    const card_id = sanitize_untrusted_card_field(c.id, 128);
    if (!card_id) continue;

    // LLM06: Zero-leak protection for encrypted cards
    if (is_card_encrypted_for_ai(c)) {
      sanitized_cards.push({
        id: card_id,
        type: sanitize_untrusted_card_field(c.type || 'note', 32),
        title: sanitize_untrusted_card_field(c.title || 'Encrypted Card', OWASP_LLM_LIMITS.max_card_title_length),
        is_encrypted: true,
        content: '[ENCRYPTED CARD - CONTENT REDACTED BY OWASP LLM06 GUARD]',
      });
      continue;
    }

    valid_card_id_set.add(card_id);
    const c_type = sanitize_untrusted_card_field(c.type || 'note', 32);
    const raw_tasks = Array.isArray(c.items) ? c.items : Array.isArray(c.tasks) ? c.tasks : [];
    const safe_tasks = raw_tasks
      .slice(0, OWASP_LLM_LIMITS.max_tasks_per_card)
      .map((t) => ({
        text: sanitize_untrusted_card_field(
          t?.text || t?.title || '',
          OWASP_LLM_LIMITS.max_task_text_length
        ),
        checked: Boolean(t?.checked || t?.completed || t?.done),
      }))
      .filter((t) => t.text.length > 0);

    const raw_tags = Array.isArray(c.tags) ? c.tags : [];
    const safe_tags = raw_tags
      .slice(0, OWASP_LLM_LIMITS.max_tags_per_card)
      .map((tag) =>
        sanitize_untrusted_card_field(
          typeof tag === 'string' ? tag : tag?.text || '',
          OWASP_LLM_LIMITS.max_tag_length
        )
      )
      .filter(Boolean);

    sanitized_cards.push({
      id: card_id,
      type: c_type,
      title:
        c_type === 'stock'
          ? sanitize_untrusted_card_field(c.title || 'Stock Card', OWASP_LLM_LIMITS.max_card_title_length)
          : sanitize_untrusted_card_field(c.title || 'Untitled', OWASP_LLM_LIMITS.max_card_title_length),
      symbol:
        c_type === 'stock'
          ? sanitize_untrusted_card_field(c.symbol || c.stockCode || 'MAPI.JK', 32)
          : undefined,
      stockCode:
        c_type === 'stock'
          ? sanitize_untrusted_card_field(c.symbol || c.stockCode || 'MAPI.JK', 32)
          : undefined,
      exchange:
        c_type === 'stock'
          ? sanitize_untrusted_card_field(c.exchange || 'IDX - Jakarta', 64)
          : undefined,
      range:
        c_type === 'stock'
          ? sanitize_untrusted_card_field(c.range || '1d', 16)
          : undefined,
      content: sanitize_untrusted_card_field(c.content || '', OWASP_LLM_LIMITS.max_card_content_length),
      ai_notes: sanitize_untrusted_card_field(
        c.ai_notes || c.aiNotes || '',
        OWASP_LLM_LIMITS.max_card_notes_length
      ),
      tags: safe_tags,
      tasks: safe_tasks,
      author: sanitize_untrusted_card_field(c.author || '', 80),
      url: sanitize_untrusted_card_field(c.url || '', 300),
      caption: sanitize_untrusted_card_field(c.caption || '', 200),
      description: sanitize_untrusted_card_field(c.description || '', 300),
      fileName: sanitize_untrusted_card_field(c.file_name || '', 120),
      fileType: sanitize_untrusted_card_field(c.file_type || '', 64),
      locationName: sanitize_untrusted_card_field(c.location_name || '', 120),
      address: sanitize_untrusted_card_field(c.address || '', 200),
      coordinates:
        c.latitude && c.longitude
          ? `${Number(c.latitude) || 0}, ${Number(c.longitude) || 0}`
          : '',
      notes: sanitize_untrusted_card_field(c.notes || '', OWASP_LLM_LIMITS.max_card_notes_length),
      position: {
        x: Math.round(Number(c.x) || 0),
        y: Math.round(Number(c.y) || 0),
        width: Math.round(Number(c.width) || 280),
        height: Math.round(Number(c.height) || 200),
      },
    });
  }

  const raw_conns = Array.isArray(safe_board.connections) ? safe_board.connections : [];
  const sanitized_connections = raw_conns
    .slice(0, OWASP_LLM_LIMITS.max_connections_in_context)
    .map((conn) => ({
      fromId: sanitize_untrusted_card_field(conn?.fromId || '', 128),
      toId: sanitize_untrusted_card_field(conn?.toId || '', 128),
      relationship: sanitize_untrusted_card_field(conn?.label || 'connected', 80),
    }))
    .filter((conn) => conn.fromId && conn.toId);

  const board_summary = {
    title: sanitize_untrusted_card_field(safe_board.title || 'Current Board', 160),
    description: sanitize_untrusted_card_field(safe_board.description || '', 500),
    boardType: sanitize_untrusted_card_field(safe_board.boardType || 'free_position', 40),
    cards: sanitized_cards,
    connections: sanitized_connections,
    drawingsCount: Array.isArray(safe_board.drawings) ? safe_board.drawings.length : 0,
  };

  const safe_selected_ids = Array.isArray(selected_card_ids)
    ? selected_card_ids.filter((id) => valid_card_id_set.has(String(id)))
    : [];

  const selected_cards_data =
    safe_selected_ids.length > 0
      ? sanitized_cards.filter((c) => safe_selected_ids.includes(c.id))
      : [];

  return {
    board_summary,
    selected_cards_data,
    valid_card_id_set,
  };
}

/**
 * Sanitizes LLM output before returning to client or rendering in UI (LLM02, LLM06, LLM08, LLM09)
 */
export function sanitize_ai_output_payload(raw_output, valid_card_id_set = null) {
  const src = raw_output && typeof raw_output === 'object' ? raw_output : {};
  let answer = typeof src.answer === 'string' ? src.answer : '';

  // Strip control characters and accidental secrets
  answer = strip_control_and_bidi_chars(answer);
  answer = scrub_sensitive_secrets(answer);

  // LLM02: Strip dangerous HTML tags, event handlers, and executable URI schemes
  answer = answer
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|applet|meta|link|style|form|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|applet|meta|link|base)[^>]*\/?>/gi, '')
    .replace(/\bon[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/(javascript|vbscript|data:text\/html)\s*:/gi, 'blocked-uri:');

  if (answer.length > OWASP_LLM_LIMITS.max_answer_length) {
    answer = answer.slice(0, OWASP_LLM_LIMITS.max_answer_length) + '...';
  }

  // LLM08: Validate responsibleCardIds against existing non-encrypted board cards
  const raw_ids = Array.isArray(src.responsibleCardIds) ? src.responsibleCardIds : [];
  const seen_ids = new Set();
  const safe_card_ids = [];
  for (const id of raw_ids) {
    const str_id = String(id || '').trim();
    if (!str_id || seen_ids.has(str_id)) continue;
    if (valid_card_id_set instanceof Set && !valid_card_id_set.has(str_id)) {
      continue;
    }
    seen_ids.add(str_id);
    safe_card_ids.push(str_id);
    if (safe_card_ids.length >= 20) break;
  }

  // LLM02 & LLM08: Sanitize and bound suggestedFollowUps
  const raw_followups = Array.isArray(src.suggestedFollowUps) ? src.suggestedFollowUps : [];
  const safe_followups = [];
  for (const item of raw_followups) {
    if (typeof item !== 'string') continue;
    const cleaned_followup = strip_control_and_bidi_chars(item)
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, OWASP_LLM_LIMITS.max_followup_length);
    if (cleaned_followup) {
      safe_followups.push(cleaned_followup);
    }
    if (safe_followups.length >= OWASP_LLM_LIMITS.max_followups) break;
  }

  return {
    answer: answer.trim() || 'I could not find an answer for that on this board.',
    responsibleCardIds: safe_card_ids,
    suggestedFollowUps: safe_followups,
  };
}
