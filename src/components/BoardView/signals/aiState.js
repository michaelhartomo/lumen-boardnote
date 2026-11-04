import { signal, effect } from '@preact/signals-react';
import {
  activeBoardSignal,
  updateViewport,
  selectedCardsSignal,
  showToast,
  createId,
  addCard,
  updateCard,
  clearCardMuseVoiceResult,
  addConnection,
  pushHistorySnapshot,
  get_lumen_auth_headers,
  get_lumen_auth_payload,
  fetch_ai_usage,
} from './boardState.js';
import {
  validate_and_sanitize_ai_question,
  build_safe_board_context,
  sanitize_ai_output_payload,
} from '../utils/owasp_llm_guard.js';

export const isAiPanelOpenSignal = signal(false);
export const aiChatMessagesSignal = signal([]);
export const isAiLoadingSignal = signal(false);
export const aiCitedCardIdsSignal = signal([]);
export const aiActiveHoverCardIdSignal = signal(null);
export const aiPrefillPromptSignal = signal('');
export const isCardAiProcessingSignal = signal(null); // { cardId, actionId } | null
export const aiWorkingElapsedSecondsSignal = signal(0);
export const aiErrorModalSignal = signal(null);

export const closeAiErrorModal = () => {
  aiErrorModalSignal.value = null;
};

export const showAiErrorModal = (error_input, context = {}) => {
  const err_obj =
    error_input && typeof error_input === 'object' ? error_input : {};
  const payload =
    err_obj.responsePayload && typeof err_obj.responsePayload === 'object'
      ? err_obj.responsePayload
      : err_obj;

  const raw_msg = String(
    payload.error ||
      payload.message ||
      err_obj.message ||
      (typeof error_input === 'string' ? error_input : '') ||
      'An unexpected error occurred while processing the AI query.'
  ).trim();

  const status_code =
    Number(context.status_code || err_obj.status || payload.status) || null;
  const reason_code = String(
    context.reason_code ||
      payload.quotaReason ||
      payload.securityCode ||
      err_obj.code ||
      ''
  ).trim();
  const lower_msg = `${raw_msg} ${reason_code}`.toLowerCase();

  let category = context.category || 'service_error';
  let title = context.title || 'AI Query Error';
  let suggestion =
    context.suggestion ||
    'Please try your request again in a moment, or check your AI model configuration in Board Settings.';

  if (
    payload.quotaExceeded ||
    reason_code.includes('QUOTA') ||
    reason_code.includes('LIMIT') ||
    /monthly.*limit|daily.*limit|quota.*exceeded|usage.*limit|burst.*limit|token.*limit/i.test(
      lower_msg
    )
  ) {
    category = 'quota_limit';
    if (/burst/i.test(lower_msg)) {
      title = 'Daily AI Burst Protection Limit Reached';
      suggestion =
        'Your account has reached the maximum number of daily AI burst requests configured in lm_user_setting. Please wait for the daily window to reset or ask an administrator to adjust your daily limit.';
    } else if (/daily/i.test(lower_msg)) {
      title = 'Daily AI Token Limit Reached';
      suggestion =
        'Your account has reached its daily AI token allowance in lm_user_setting. Please wait until tomorrow or contact an administrator to increase your daily_ai_token_limit.';
    } else {
      title = 'Monthly AI Usage Limit Reached';
      suggestion =
        'Your account has reached its monthly AI token allowance in lm_user_setting. Contact your workspace administrator to increase your monthly_ai_token_limit.';
    }
  } else if (
    status_code === 429 ||
    /rate\s*limit|too\s+many\s+requests/i.test(lower_msg)
  ) {
    category = 'rate_limit';
    title = 'AI Rate Limit Exceeded';
    suggestion =
      'Too many AI requests were sent in a short window. Please wait a few seconds before submitting your next query.';
  } else if (
    status_code === 504 ||
    status_code === 408 ||
    err_obj.name === 'AbortError' ||
    err_obj.name === 'TimeoutError' ||
    /timed?\s*out|timeout|aborted|deadline|took\s+too\s+long/i.test(lower_msg)
  ) {
    category = 'timeout';
    title = 'AI Request Timed Out';
    suggestion =
      'The AI model took too long to respond. Try shortening your prompt, selecting fewer cards, or retrying the action.';
  } else if (
    payload.securityBlocked ||
    /owasp|llm0|prompt\s+injection|security\s+guard|blocked\s+by/i.test(lower_msg)
  ) {
    category = 'security_block';
    title = 'Blocked by AI Security Guard';
    suggestion =
      'Please rephrase your prompt so it focuses on workspace board content without system-override instructions or restricted patterns.';
  } else if (
    status_code === 403 ||
    /access\s+denied|permission|encrypted\s+cards?\s+cannot/i.test(lower_msg)
  ) {
    category = 'access_denied';
    title = 'AI Access Restricted';
    suggestion =
      'Ensure you have permission to view this board and unlock any encrypted cards before running AI actions on them.';
  } else if (status_code === 502 || status_code === 503 || status_code === 500) {
    category = 'service_error';
    title = 'AI Model Service Unavailable';
    suggestion =
      'The upstream AI model encountered a temporary failure or returned an incomplete response. Please retry your query in a few seconds.';
  }

  aiErrorModalSignal.value = {
    is_open: true,
    category,
    title,
    message: raw_msg,
    details:
      context.details ||
      (payload.answer && payload.answer !== raw_msg
        ? String(payload.answer).replace(/[#*`>]/g, '').trim()
        : ''),
    status_code,
    reason_code: reason_code || null,
    usage_summary: payload.aiUsage || context.usage_summary || null,
    action_label: context.action_label || 'AI Workspace Query',
    model_label: context.model_label || '',
    suggestion,
    timestamp: Date.now(),
  };
};

export const formatAiElapsedTime = (sec) => {
  const total_sec = Math.max(0, Math.floor(Number(sec) || 0));
  const mins = String(Math.floor(total_sec / 60)).padStart(2, '0');
  const rem = String(total_sec % 60).padStart(2, '0');
  return `${mins}:${rem}`;
};

let ai_working_timer_id = null;
let ai_working_started_ms = 0;

if (typeof window !== 'undefined') {
  effect(() => {
    const is_active = Boolean(isAiLoadingSignal.value || isCardAiProcessingSignal.value);
    if (is_active) {
      if (!ai_working_timer_id) {
        ai_working_started_ms = Date.now();
        aiWorkingElapsedSecondsSignal.value = 0;
        ai_working_timer_id = window.setInterval(() => {
          aiWorkingElapsedSecondsSignal.value = Math.max(
            0,
            Math.floor((Date.now() - ai_working_started_ms) / 1000)
          );
        }, 250);
      }
    } else if (ai_working_timer_id) {
      window.clearInterval(ai_working_timer_id);
      ai_working_timer_id = null;
      aiWorkingElapsedSecondsSignal.value = 0;
    }
  });
}

// =========================================================================
// Bring Your Own AI via Model Context Protocol (MCP) State & Registry
// =========================================================================
export const MCP_AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    label: 'Google Gemini (MCP)',
    badge: 'Gemini MCP',
    color: '#2563eb',
    bgLight: 'rgba(37, 99, 235, 0.08)',
    borderLight: 'rgba(37, 99, 235, 0.25)',
    tagline: 'Google Gemini CLI, Code Assist & Gemini 3.8 Flash via Model Context Protocol',
    config_file: '~/.gemini/settings.json',
    transport_label: 'SSE + JSON-RPC 2.0',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    label: 'OpenAI ChatGPT (MCP)',
    badge: 'ChatGPT MCP',
    color: '#10a37f',
    bgLight: 'rgba(16, 163, 127, 0.08)',
    borderLight: 'rgba(16, 163, 127, 0.28)',
    tagline: 'OpenAI ChatGPT Desktop Connectors & MCP Actions Bridge',
    config_file: 'chatgpt_mcp_connectors.json',
    transport_label: 'SSE Connector',
  },
  {
    id: 'claude',
    name: 'Claude',
    label: 'Anthropic Claude (MCP)',
    badge: 'Claude MCP',
    color: '#d97757',
    bgLight: 'rgba(217, 119, 87, 0.10)',
    borderLight: 'rgba(217, 119, 87, 0.30)',
    tagline: 'Claude Desktop, Claude Code & Native Model Context Protocol',
    config_file: 'claude_desktop_config.json',
    transport_label: 'Stdio / SSE',
  },
  {
    id: 'grok',
    name: 'Grok',
    label: 'xAI Grok (MCP)',
    badge: 'Grok MCP',
    color: '#0f172a',
    bgLight: 'rgba(15, 23, 42, 0.08)',
    borderLight: 'rgba(15, 23, 42, 0.25)',
    tagline: 'xAI Grok Console & First-Principles Spatial Reasoning Agent',
    config_file: 'grok_mcp_config.json',
    transport_label: 'JSON-RPC 2.0 HTTP',
  },
  {
    id: 'muse',
    name: 'Muse',
    label: 'Muse Spatial AI (MCP)',
    badge: 'Muse MCP',
    color: '#7c3aed',
    bgLight: 'rgba(124, 58, 237, 0.08)',
    borderLight: 'rgba(124, 58, 237, 0.28)',
    tagline: 'Muse Creative Synthesis & Infinite Canvas Thought Partner via MCP',
    config_file: 'muse_mcp_config.json',
    transport_label: 'SSE Stream',
  },
  {
    id: 'custom',
    name: 'Custom MCP',
    label: 'Custom BYO MCP Server',
    badge: 'Custom MCP',
    color: '#0284c7',
    bgLight: 'rgba(2, 132, 199, 0.08)',
    borderLight: 'rgba(2, 132, 199, 0.28)',
    tagline: 'Connect any self-hosted or local Model Context Protocol JSON-RPC / SSE server',
    config_file: 'mcp_config.json',
    transport_label: 'Custom JSON-RPC / SSE',
  },
];

const MCP_STORAGE_KEY = 'lumen_mcp_byo_ai_config_v1';

function load_initial_mcp_config() {
  const defaults = {
    active_provider_id: 'muse',
    byo_mcp_enabled: true,
    connection_mode: 'host_server', // 'host_server' | 'external_bridge'
    read_only_guard: true,
    provider_endpoints: {
      gemini: '',
      chatgpt: '',
      claude: '',
      grok: '',
      muse: '',
      custom: '',
    },
    last_ping_status: null,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(MCP_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      provider_endpoints: {
        ...defaults.provider_endpoints,
        ...(parsed?.provider_endpoints || {}),
      },
    };
  } catch (_) {
    return defaults;
  }
}

function persist_mcp_config(cfg) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(cfg));
  } catch (_) {}
}

export const mcpConfigSignal = signal(load_initial_mcp_config());
export const isMcpConfigOpenSignal = signal(false);
export const isMcpTestingSignal = signal(false);
export const mcpLiveToolResultSignal = signal(null);

export const getActiveMcpProvider = () => {
  const id = mcpConfigSignal.value?.active_provider_id || 'muse';
  return MCP_AI_PROVIDERS.find((p) => p.id === id) || MCP_AI_PROVIDERS[0];
};

export const toggleMcpConfigPanel = () => {
  isMcpConfigOpenSignal.value = !isMcpConfigOpenSignal.value;
};

export const openMcpConfigPanel = (provider_id = null) => {
  if (provider_id && MCP_AI_PROVIDERS.some((p) => p.id === provider_id)) {
    updateMcpConfig({ active_provider_id: provider_id });
  }
  isMcpConfigOpenSignal.value = true;
};

export const closeMcpConfigPanel = () => {
  isMcpConfigOpenSignal.value = false;
};

export const updateMcpConfig = (patch) => {
  const next = {
    ...mcpConfigSignal.value,
    ...patch,
  };
  mcpConfigSignal.value = next;
  persist_mcp_config(next);
};

export const selectMcpProvider = (provider_id) => {
  const found = MCP_AI_PROVIDERS.find((p) => p.id === provider_id);
  if (!found) return;
  updateMcpConfig({
    active_provider_id: found.id,
    byo_mcp_enabled: true,
  });
  showToast(`Switched AI to ${found.label}`);
};

// =========================================================================
// Per-Task AI Model Selector Registry & Persisted Routing State
// Covers all available AI models and all workspace AI capabilities
// =========================================================================
export const AI_AVAILABLE_MODELS = [
  {
    id: 'muse',
    name: 'Muse',
    full_name: 'Meta Muse (muse-wonder-1.0 / muse-image-1.0)',
    provider_id: 'muse',
    provider_name: 'Meta Muse',
    badge: 'muse-wonder-1.0',
    color: '#7c3aed',
    bgLight: 'rgba(124, 58, 237, 0.08)',
    borderLight: 'rgba(124, 58, 237, 0.28)',
    description: 'Meta Muse (muse-wonder-1.0 & muse-image-1.0) high-reasoning text, coding, image generation & audio transcription (falls back to Gemini 3.8 Flash)',
    capabilities: ['image_gen', 'text_prompt', 'sound_transcribe', 'task_planning', 'coding', 'web_research', 'market_data'],
  },
  {
    id: 'gemini',
    name: 'Gemini 3.8 Flash',
    full_name: 'Google Gemini 3.8 Flash',
    provider_id: 'gemini',
    provider_name: 'Google',
    badge: 'Gemini 3.8 Flash',
    color: '#2563eb',
    bgLight: 'rgba(37, 99, 235, 0.08)',
    borderLight: 'rgba(37, 99, 235, 0.25)',
    description: 'Latest multimodal text prompt, workspace Q&A, note synthesis, coding & audio understanding',
    capabilities: ['text_prompt', 'sound_transcribe', 'image_gen', 'coding', 'market_data', 'task_planning', 'web_research'],
  },
  {
    id: 'claude',
    name: 'Claude',
    full_name: 'Anthropic Claude 3.7 Sonnet',
    provider_id: 'claude',
    provider_name: 'Anthropic',
    badge: 'Claude 3.7 Sonnet',
    color: '#d97757',
    bgLight: 'rgba(217, 119, 87, 0.10)',
    borderLight: 'rgba(217, 119, 87, 0.30)',
    description: 'Coding, technical architecture, canvas specs & editorial prose',
    capabilities: ['coding', 'text_prompt', 'task_planning', 'web_research'],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    full_name: 'OpenAI ChatGPT (GPT-4o / o3)',
    provider_id: 'chatgpt',
    provider_name: 'OpenAI',
    badge: 'ChatGPT 4o',
    color: '#10a37f',
    bgLight: 'rgba(16, 163, 127, 0.08)',
    borderLight: 'rgba(16, 163, 127, 0.28)',
    description: 'General reasoning, checklist planning, subtasks & brainstorming',
    capabilities: ['text_prompt', 'task_planning', 'coding', 'web_research', 'sound_transcribe'],
  },
  {
    id: 'grok',
    name: 'Grok',
    full_name: 'xAI Grok 3',
    provider_id: 'grok',
    provider_name: 'xAI',
    badge: 'Grok 3',
    color: '#0f172a',
    bgLight: 'rgba(15, 23, 42, 0.08)',
    borderLight: 'rgba(15, 23, 42, 0.25)',
    description: 'Real-time stock ticker analysis, market thesis & first-principles',
    capabilities: ['market_data', 'text_prompt', 'coding', 'web_research'],
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Gemini Flash Image',
    full_name: 'Google Gemini 3.1 Flash-Lite Image',
    provider_id: 'gemini',
    provider_name: 'Google',
    badge: 'Gemini 3.1 Image',
    color: '#4f46e5',
    bgLight: 'rgba(79, 70, 229, 0.08)',
    borderLight: 'rgba(79, 70, 229, 0.25)',
    description: 'Watermark-free photorealistic studio product & scene image generation',
    capabilities: ['image_gen'],
  },
  {
    id: 'gemini-nano-banana-2.1',
    name: 'Gemini Nano Banana 2.1',
    full_name: 'Google Gemini Nano Banana 2.1 Image',
    provider_id: 'gemini',
    provider_name: 'Google',
    badge: 'Nano Banana 2.1',
    color: '#db2777',
    bgLight: 'rgba(219, 39, 119, 0.08)',
    borderLight: 'rgba(219, 39, 119, 0.25)',
    description: 'High-quality watermark-free photorealistic image & visual slide synthesis',
    capabilities: ['image_gen'],
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    full_name: 'Google Gemini 3 Pro Image',
    provider_id: 'gemini',
    provider_name: 'Google',
    badge: 'Gemini 3 Pro Image',
    color: '#7c3aed',
    bgLight: 'rgba(124, 58, 237, 0.08)',
    borderLight: 'rgba(124, 58, 237, 0.25)',
    description: 'Pro-grade studio photography, architectural & editorial image generation',
    capabilities: ['image_gen'],
  },
  {
    id: 'gemini-3.5-transcribe',
    name: 'Gemini Audio',
    full_name: 'Google Gemini 3.5 Transcribe',
    provider_id: 'gemini',
    provider_name: 'Google',
    badge: 'Gemini 3.5 Audio',
    color: '#0284c7',
    bgLight: 'rgba(2, 132, 199, 0.08)',
    borderLight: 'rgba(2, 132, 199, 0.25)',
    description: 'Dedicated verbatim voice transcription & 11-language translation',
    capabilities: ['sound_transcribe'],
  },
  {
    id: 'custom',
    name: 'Custom MCP',
    full_name: 'Custom BYO MCP Server',
    provider_id: 'custom',
    provider_name: 'BYO MCP',
    badge: 'Custom MCP',
    color: '#0d9488',
    bgLight: 'rgba(13, 148, 136, 0.08)',
    borderLight: 'rgba(13, 148, 136, 0.28)',
    description: 'Self-hosted or local Model Context Protocol JSON-RPC / SSE server',
    capabilities: ['text_prompt', 'image_gen', 'sound_transcribe', 'coding', 'market_data', 'task_planning', 'web_research'],
  },
];

export const AI_TASK_CATEGORIES = [
  {
    id: 'text_prompt',
    label: 'Text Prompt',
    short_label: 'Text Prompt',
    description: 'Board Q&A, Note writing, TL;DR summaries, grammar & prose polish (muse-wonder-1.0 prioritized, Gemini 3.8 Flash fallback)',
    default_model_id: 'muse',
  },
  {
    id: 'image_gen',
    label: 'Image Gen',
    short_label: 'Image Gen',
    description: 'Step-by-step visual cards, image captions & color palette extraction (Muse prioritized, Gemini Image fallback)',
    default_model_id: 'muse',
  },
  {
    id: 'sound_transcribe',
    label: 'Sound Transcribe',
    short_label: 'Sound Transcribe',
    description: 'Voice recorder verbatim transcription, live meeting diarization, translation & rich notes via Meta Muse AI & Gemini 3.8 Flash',
    default_model_id: 'muse',
  },
  {
    id: 'coding',
    label: 'Coding',
    short_label: 'Coding',
    description: 'Code snippet generation, HTML webpage builder, technical architecture & review via Meta Muse (muse-wonder-1.0)',
    default_model_id: 'muse',
  },
  {
    id: 'market_data',
    label: 'Market & Data',
    short_label: 'Market & Data',
    description: 'Stock ticker valuation, investment memos & spreadsheet data analysis',
    default_model_id: 'muse',
  },
  {
    id: 'task_planning',
    label: 'Task & Checklist',
    short_label: 'Task & Checklist',
    description: 'Checklist subtask generation, [P1]/[P2] prioritization & sprints',
    default_model_id: 'muse',
  },
  {
    id: 'web_research',
    label: 'Web & Geo Curation',
    short_label: 'Web & Geo',
    description: 'Web link TL;DR summaries, location field notes & social embeds',
    default_model_id: 'muse',
  },
];

export const DEFAULT_AI_TASK_ROUTING = {
  text_prompt: 'muse',
  image_gen: 'muse',
  sound_transcribe: 'muse',
  coding: 'muse',
  market_data: 'muse',
  task_planning: 'muse',
  web_research: 'muse',
};

const AI_TASK_ROUTING_STORAGE_KEY = 'lumen_ai_task_routing_v3';

function load_initial_ai_task_routing() {
  if (typeof window === 'undefined') return { ...DEFAULT_AI_TASK_ROUTING };
  try {
    const raw = window.localStorage.getItem(AI_TASK_ROUTING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_TASK_ROUTING };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_AI_TASK_ROUTING };
    const merged = { ...DEFAULT_AI_TASK_ROUTING };
    for (const cat of AI_TASK_CATEGORIES) {
      let val = parsed[cat.id];
      if (
        val === 'pollinations-turbo' ||
        val === 'muse-image-1.0' ||
        val === 'muse-wonder-1.0'
      ) {
        val = 'muse';
      }
      if (val === 'gemini-pro' || val === 'gemini-flash-lite') {
        val = 'gemini';
      }
      if (cat.id === 'sound_transcribe' || cat.id === 'coding') {
        val = 'muse';
      }
      if (val && AI_AVAILABLE_MODELS.some((m) => m.id === val)) {
        merged[cat.id] = val;
      }
    }
    return merged;
  } catch (_) {
    return { ...DEFAULT_AI_TASK_ROUTING };
  }
}

function persist_ai_task_routing(routing) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AI_TASK_ROUTING_STORAGE_KEY, JSON.stringify(routing));
  } catch (_) {}
}

export const aiTaskRoutingSignal = signal(load_initial_ai_task_routing());

export const getAiModelById = (model_id) => {
  if (
    model_id === 'muse-image-1.0' ||
    model_id === 'muse-image-1' ||
    model_id === 'muse-wonder-1.0'
  ) {
    model_id = 'muse';
  }
  if (model_id === 'gemini-pro' || model_id === 'gemini-flash-lite') {
    model_id = 'gemini';
  }
  return (
    AI_AVAILABLE_MODELS.find((m) => m.id === model_id) ||
    AI_AVAILABLE_MODELS[0]
  );
};

export const getSelectedAiModelForTask = (task_id = 'text_prompt') => {
  if (task_id === 'sound_transcribe') {
    return getAiModelById('muse');
  }
  if (task_id === 'coding') {
    const base_muse = getAiModelById('muse');
    return {
      ...base_muse,
      id: 'muse-wonder-1.0',
      name: 'Meta Muse (muse-wonder-1.0)',
      full_name: 'Meta Muse (muse-wonder-1.0)',
      badge: 'muse-wonder-1.0',
    };
  }
  const routing = aiTaskRoutingSignal.value || DEFAULT_AI_TASK_ROUTING;
  let model_id = routing[task_id] || DEFAULT_AI_TASK_ROUTING[task_id] || 'muse';
  if (
    task_id === 'image_gen' &&
    mcpConfigSignal.value?.active_provider_id === 'muse'
  ) {
    model_id = 'muse';
  }
  return getAiModelById(model_id);
};

export const setSelectedAiModelForTask = (task_id, model_id, silent = false) => {
  const found_model = AI_AVAILABLE_MODELS.find((m) => m.id === model_id);
  const found_task = AI_TASK_CATEGORIES.find((t) => t.id === task_id);
  if (!found_model || !found_task) return;

  const next = {
    ...(aiTaskRoutingSignal.value || DEFAULT_AI_TASK_ROUTING),
    [task_id]: found_model.id,
  };
  aiTaskRoutingSignal.value = next;
  persist_ai_task_routing(next);

  // If changing text_prompt, also sync active MCP provider so Board Intelligence reflects it
  if (task_id === 'text_prompt' && found_model.provider_id) {
    updateMcpConfig({
      active_provider_id: found_model.provider_id,
      byo_mcp_enabled: true,
    });
  }

  if (!silent) {
    showToast(`${found_task.label} AI set to ${found_model.name}`);
  }
};

export const setAllAiTasksToModel = (model_id) => {
  const found_model = AI_AVAILABLE_MODELS.find((m) => m.id === model_id);
  if (!found_model) return;
  const next = {};
  for (const cat of AI_TASK_CATEGORIES) {
    next[cat.id] = found_model.id;
  }
  aiTaskRoutingSignal.value = next;
  persist_ai_task_routing(next);
  if (found_model.provider_id) {
    updateMcpConfig({
      active_provider_id: found_model.provider_id,
      byo_mcp_enabled: true,
    });
  }
  showToast(`All AI tasks set to ${found_model.name}`);
};

export const resetAiTaskRouting = () => {
  const next = { ...DEFAULT_AI_TASK_ROUTING };
  aiTaskRoutingSignal.value = next;
  persist_ai_task_routing(next);
  updateMcpConfig({
    active_provider_id: 'muse',
    byo_mcp_enabled: true,
  });
  showToast('Reset AI selector to recommended defaults (Muse Wonder prioritized)');
};

export const resolveAiTaskCategoryForAction = (action_id = '', card_type = '') => {
  const act = String(action_id || '').toLowerCase();
  const ctype = String(card_type || '').toLowerCase();

  if (
    act === 'image_create_image' ||
    act === 'note_create_image' ||
    act === 'image_generate_caption' ||
    act === 'image_extract_palette' ||
    act === 'palette_harmonize' ||
    act === 'create_image' ||
    act === 'create_palette' ||
    ctype === 'image' ||
    ctype === 'palette'
  ) {
    return 'image_gen';
  }

  if (act === 'note_text_to_voice' || act === 'sound_text_to_voice') {
    return 'text_prompt';
  }

  if (
    act.startsWith('sound_') ||
    act === 'create_sound_recorder' ||
    ctype === 'sound_recorder'
  ) {
    return 'sound_transcribe';
  }

  if (
    act.includes('code') ||
    act.includes('canvas') ||
    ctype === 'code' ||
    ctype === 'canvas'
  ) {
    return 'coding';
  }

  if (
    act.startsWith('stock_') ||
    act === 'create_stock' ||
    act === 'create_sheets' ||
    ctype === 'stock' ||
    ctype === 'sheets'
  ) {
    return 'market_data';
  }

  if (
    act.startsWith('tasklist_') ||
    act === 'note_extract_tasks' ||
    act === 'create_tasklist' ||
    act === 'create_checklist' ||
    ctype === 'tasklist'
  ) {
    return 'task_planning';
  }

  if (
    act === 'link_summarize_url' ||
    act === 'geo_add_field_notes' ||
    act === 'create_link' ||
    act === 'create_geo' ||
    act === 'create_embed' ||
    ctype === 'link' ||
    ctype === 'geo' ||
    ctype === 'embed' ||
    ctype === 'social'
  ) {
    return 'web_research';
  }

  return 'text_prompt';
};

export const setProviderMcpEndpoint = (provider_id, url_str) => {
  const current_endpoints = mcpConfigSignal.value?.provider_endpoints || {};
  updateMcpConfig({
    provider_endpoints: {
      ...current_endpoints,
      [provider_id]: String(url_str || ''),
    },
  });
};

export const buildMcpClientConfigSnippet = (provider_id, board_id = 'board_moodboard') => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const auth_payload = get_lumen_auth_payload();
  const user_account = auth_payload?.user_account || '';
  const vendor_code = auth_payload?.vendor_code || '';
  const master_code = auth_payload?.master_code || '';
  const project_code = auth_payload?.project_code || '';
  const read_only_flag = Boolean(mcpConfigSignal.value?.read_only_guard);

  const query_parts = [`board_id=${encodeURIComponent(board_id)}`];
  if (user_account) query_parts.push(`user_account=${encodeURIComponent(user_account)}`);
  if (vendor_code) query_parts.push(`vendor_code=${encodeURIComponent(vendor_code)}`);
  if (master_code) query_parts.push(`master_code=${encodeURIComponent(master_code)}`);
  if (project_code) query_parts.push(`project_code=${encodeURIComponent(project_code)}`);
  if (read_only_flag) query_parts.push('read_only=1');

  const sse_url = `${origin}/api/mcp/sse?${query_parts.join('&')}`;
  const rpc_url = `${origin}/api/mcp`;
  const auth_headers = get_lumen_auth_headers();

  switch (provider_id) {
    case 'gemini':
      return JSON.stringify(
        {
          mcpServers: {
            'lumen-board-gemini': {
              httpUrl: rpc_url,
              sseUrl: sse_url,
              headers: auth_headers,
              env: {
                LUMEN_BOARD_ID: board_id,
                LUMEN_USER_ACCOUNT: user_account,
                ...(vendor_code ? { LUMEN_VENDOR_CODE: vendor_code } : {}),
                ...(master_code ? { LUMEN_MASTER_CODE: master_code } : {}),
                ...(project_code ? { LUMEN_PROJECT_CODE: project_code } : {}),
                ...(read_only_flag ? { LUMEN_READ_ONLY: 'true' } : {}),
              },
            },
          },
        },
        null,
        2
      );
    case 'chatgpt':
      return JSON.stringify(
        {
          mcpServers: {
            'lumen-board-chatgpt': {
              transport: 'sse',
              url: sse_url,
              jsonrpcUrl: rpc_url,
              boardId: board_id,
              userAccount: user_account,
              headers: auth_headers,
            },
          },
        },
        null,
        2
      );
    case 'claude':
      return JSON.stringify(
        {
          mcpServers: {
            'lumen-board-claude': {
              command: 'npx',
              args: ['-y', 'mcp-remote', sse_url],
              env: {
                LUMEN_API_URL: origin,
                LUMEN_BOARD_ID: board_id,
                LUMEN_USER_ACCOUNT: user_account,
                ...(vendor_code ? { LUMEN_VENDOR_CODE: vendor_code } : {}),
                ...(master_code ? { LUMEN_MASTER_CODE: master_code } : {}),
                ...(project_code ? { LUMEN_PROJECT_CODE: project_code } : {}),
                ...(read_only_flag ? { LUMEN_READ_ONLY: 'true' } : {}),
              },
            },
          },
        },
        null,
        2
      );
    case 'grok':
      return JSON.stringify(
        {
          mcpServers: {
            'lumen-board-grok': {
              transport: 'jsonrpc-http',
              endpoint: rpc_url,
              sseEndpoint: sse_url,
              boardId: board_id,
              userAccount: user_account,
              headers: auth_headers,
            },
          },
        },
        null,
        2
      );
    case 'muse':
      return JSON.stringify(
        {
          mcpServers: {
            'lumen-board-muse': {
              provider: 'muse-spatial-mcp',
              url: sse_url,
              jsonrpc: rpc_url,
              workspaceBoardId: board_id,
              userAccount: user_account,
              headers: auth_headers,
            },
          },
        },
        null,
        2
      );
    default:
      return JSON.stringify(
        {
          mcpServers: {
            'lumen-board-custom': {
              protocolVersion: '2024-11-05',
              sse: sse_url,
              jsonrpc: rpc_url,
              boardId: board_id,
              userAccount: user_account,
              headers: auth_headers,
            },
          },
        },
        null,
        2
      );
  }
};

export const testMcpConnection = async () => {
  if (isMcpTestingSignal.value) return;
  isMcpTestingSignal.value = true;
  try {
    const cfg = mcpConfigSignal.value;
    const provider_id = cfg.active_provider_id || 'gemini';
    const custom_url =
      cfg.connection_mode === 'external_bridge'
        ? (cfg.provider_endpoints?.[provider_id] || '').trim()
        : '';

    const resp = await fetch('/api/mcp/ping-external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        provider: provider_id,
        endpoint_url: custom_url || undefined,
      }),
    });
    const data = await resp.json();
    const status_obj = {
      ok: Boolean(data.ok),
      message: data.message || 'MCP Handshake complete',
      latencyMs: data.latencyMs || 12,
      toolsCount: data.toolsCount || 10,
      protocolVersion: data.protocolVersion || '2024-11-05',
      timestamp: Date.now(),
    };
    updateMcpConfig({ last_ping_status: status_obj });
    showToast(status_obj.message);
    return status_obj;
  } catch (err) {
    const fallback_status = {
      ok: false,
      message: `MCP test failed: ${err?.message || 'Unable to reach MCP endpoint'}`,
      latencyMs: 0,
      toolsCount: 10,
      timestamp: Date.now(),
    };
    updateMcpConfig({ last_ping_status: fallback_status });
    return fallback_status;
  } finally {
    isMcpTestingSignal.value = false;
  }
};

export const runMcpToolLiveTest = async (tool_name = 'get_board_summary') => {
  if (isMcpTestingSignal.value) return;
  isMcpTestingSignal.value = true;
  try {
    const current_board = activeBoardSignal.value;
    const board_id = current_board?.id || 'board_moodboard';
    const read_only_flag = Boolean(mcpConfigSignal.value?.read_only_guard);
    const args =
      tool_name === 'search_cards'
        ? { board_id, query: '' }
        : { board_id };

    const resp = await fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
        ...(read_only_flag ? { 'X-Lumen-Read-Only': 'true' } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: tool_name,
          arguments: args,
        },
      }),
    });
    const data = await resp.json();
    const preview_text =
      data?.result?.content?.[0]?.text ||
      JSON.stringify(data?.result || data, null, 2);
    mcpLiveToolResultSignal.value = {
      tool: tool_name,
      timestamp: Date.now(),
      output: String(preview_text).slice(0, 1600),
    };
    showToast(`Executed MCP tool "${tool_name}"`);
  } catch (err) {
    mcpLiveToolResultSignal.value = {
      tool: tool_name,
      timestamp: Date.now(),
      output: `Error calling MCP tool: ${err?.message || 'Unknown error'}`,
    };
  } finally {
    isMcpTestingSignal.value = false;
  }
};

export const toggleAiPanel = () => {
  isAiPanelOpenSignal.value = !isAiPanelOpenSignal.value;
};

export const openAiPanel = (prefillPrompt = '') => {
  isAiPanelOpenSignal.value = true;
  if (prefillPrompt !== undefined && prefillPrompt !== null) {
    aiPrefillPromptSignal.value = prefillPrompt;
  }
};

export const closeAiPanel = () => {
  isAiPanelOpenSignal.value = false;
  aiCitedCardIdsSignal.value = [];
  aiActiveHoverCardIdSignal.value = null;
  aiPrefillPromptSignal.value = '';
};

export const clearAiChat = () => {
  aiChatMessagesSignal.value = [];
  aiCitedCardIdsSignal.value = [];
  aiActiveHoverCardIdSignal.value = null;
  aiPrefillPromptSignal.value = '';
  showToast('AI conversation cleared');
};

export const focusCardFromAi = (cardId) => {
  const current_board = activeBoardSignal.value;
  const cards = current_board.cards || [];
  const target_card = cards.find((c) => c.id === cardId);
  if (!target_card) {
    showToast('Card not found on current board');
    return;
  }

  // Highlight and select card
  selectedCardsSignal.value = [cardId];
  aiActiveHoverCardIdSignal.value = cardId;

  // Center canvas on target card
  const window_w = window.innerWidth;
  const window_h = window.innerHeight;
  const card_center_x = target_card.x + target_card.width / 2;
  const card_center_y = target_card.y + target_card.height / 2;

  const current_zoom = current_board.viewport?.zoom || 1;
  const target_pan_x = window_w / 2 - card_center_x * current_zoom;
  const target_pan_y = window_h / 2 - card_center_y * current_zoom;

  updateViewport(target_pan_x, target_pan_y, current_zoom);
  showToast(`Focused on: ${target_card.title || target_card.type}`);
};

export const askAiAboutBoard = async (question_text, targetCardIds = null, customHandler = null) => {
  if (!question_text || !question_text.trim() || isAiLoadingSignal.value) return;

  const trimmed = question_text.trim();
  const lower_q = trimmed.toLowerCase();
  const effective_selected =
    Array.isArray(targetCardIds) && targetCardIds.length > 0
      ? targetCardIds
      : (selectedCardsSignal.value || []);

  // Natural-language Card Creation routing (e.g., "create a note card about...", "create a code card for...")
  const create_match = lower_q.match(
    /^(?:please\s+)?(?:create|add|make|generate)\s+(?:a\s+|an\s+|new\s+)?(note|checklist|tasklist|heading|quote|palette|stock|code|coding)\s*(?:card)?(?:\s+(?:about|for|on|with|titled|in))?\s*(.*)$/i
  );
  if (create_match) {
    const raw_req_type = create_match[1].toLowerCase();
    const requested_type =
      raw_req_type === 'checklist'
        ? 'tasklist'
        : raw_req_type === 'coding'
        ? 'code'
        : raw_req_type;
    const topic_str = (create_match[2] || trimmed).trim() || 'Workspace Ideas & Next Steps';
    await createCardWithAi(requested_type, topic_str);
    return;
  }

  // Natural-language Single-Card Modification routing when 1 card is selected
  if (effective_selected.length === 1) {
    const single_card_id = effective_selected[0];
    const current_board_cards = activeBoardSignal.value?.cards || [];
    const sel_card = current_board_cards.find((c) => c.id === single_card_id);
    if (sel_card?.type === 'code') {
      const existing_cd = sel_card.code_data;
      const active_f =
        Array.isArray(existing_cd?.files) && existing_cd.files.length > 0
          ? existing_cd.files.find((f) => f.id === existing_cd.active_file_id) || existing_cd.files[0]
          : null;
      const has_existing_code = Boolean(
        String(active_f?.code || sel_card.content || '').trim()
      );
      if (
        has_existing_code &&
        /\b(improve|update|change|modify|replace|swap|edit|refactor|optimize|convert|translate|fix|add|remove|make|set|turn|adjust|tweak|upgrade|style|color)\b/i.test(
          lower_q
        )
      ) {
        await runAiCardAction(single_card_id, 'code_improve_current', trimmed);
        return;
      }
      if (
        /\b(generate|write|create|snippet|implement|function|class|refactor|optimize|convert|translate|fix|add\s+comments?|improve|change|update|modify)\b/i.test(
          lower_q
        )
      ) {
        await runAiCardAction(
          single_card_id,
          has_existing_code ? 'code_improve_current' : 'code_generate_snippet',
          trimmed
        );
        return;
      }
    }
    const has_image_intent =
      /\b(images?|pictures?|photos?|illustrations?|visuals?|diagrams?|slides?)\b/i.test(lower_q) &&
      /\b(create|generate|make|show|draw|build|illustrate|step\s*by\s*step|step-by-step|based\s+on)\b/i.test(lower_q);
    if (has_image_intent) {
      await runAiCardAction(single_card_id, 'note_create_image', trimmed);
      return;
    }
    if (/\b(replace\s+content|step\s+by\s+step|how\s+to\s+)/i.test(lower_q)) {
      await runAiCardAction(single_card_id, 'note_replace_content', trimmed);
      return;
    }
    if (/\b(add\s+tl;?dr|prepend\s+tl;?dr|tl;?dr\s+on\s+top)\b/i.test(lower_q)) {
      await runAiCardAction(single_card_id, 'note_add_tldr');
      return;
    }
    if (/\b(fix\s+typos?|fix\s+grammar|proofread|correct\s+spelling)\b/i.test(lower_q)) {
      await runAiCardAction(single_card_id, 'note_fix_typos');
      return;
    }
    if (/\b(bullet\s+points?|bullet\s+list|format\s+as\s+bullets?)\b/i.test(lower_q)) {
      await runAiCardAction(single_card_id, 'note_bullet_points');
      return;
    }
    if (/\b(extract\s+tasks?|extract\s+checklist|turn\s+into\s+checklist)\b/i.test(lower_q)) {
      await runAiCardAction(single_card_id, 'note_extract_tasks');
      return;
    }
    if (/\b(text\s*to\s*voice|text-to-voice|text\s*to\s*speech|tts|muse\s*voice|read\s+aloud|synthesize\s+voice)\b/i.test(lower_q)) {
      if (sel_card?.type === 'note') {
        await runAiCardAction(single_card_id, 'note_text_to_voice', trimmed);
        return;
      }
    }
  }

  const routed_model = getSelectedAiModelForTask('text_prompt');
  const active_provider =
    MCP_AI_PROVIDERS.find((p) => p.id === routed_model.provider_id) ||
    getActiveMcpProvider();
  const mcp_cfg = mcpConfigSignal.value;
  const external_url =
    mcp_cfg.connection_mode === 'external_bridge'
      ? (mcp_cfg.provider_endpoints?.[active_provider.id] || '').trim()
      : '';

  const user_msg = {
    id: createId('msg_user'),
    role: 'user',
    text: trimmed.slice(0, 1000),
    mcpProvider: routed_model.id,
    mcpProviderBadge: routed_model.badge || active_provider.badge,
    timestamp: Date.now(),
  };

  aiChatMessagesSignal.value = [...aiChatMessagesSignal.value, user_msg];

  // OWASP LLM01, LLM04, LLM07, LLM10: Client-side prompt injection & extraction guard
  const question_check = validate_and_sanitize_ai_question(trimmed);
  if (!question_check.allowed) {
    const blocked_reason = question_check.reason || 'Request blocked by OWASP LLM Security Guard.';
    const blocked_msg = {
      id: createId('msg_ai_blocked'),
      role: 'assistant',
      text: blocked_reason,
      isError: true,
      mcpProvider: active_provider.id,
      mcpProviderBadge: active_provider.badge,
      mcpToolCalls: [],
      responsibleCardIds: [],
      suggestedFollowUps: [
        'Summarize this board and its key themes',
        'What are all pending or completed deliverables?',
        'Explain the visual and design direction',
      ],
      timestamp: Date.now(),
    };
    aiChatMessagesSignal.value = [...aiChatMessagesSignal.value, blocked_msg];
    aiCitedCardIdsSignal.value = [];
    showAiErrorModal(
      {
        error: blocked_reason,
        securityBlocked: true,
        securityCode: question_check.code || 'LLM01_BLOCKED',
      },
      {
        status_code: 400,
        action_label: 'Board Intelligence Query',
        model_label: routed_model.full_name || routed_model.name,
      }
    );
    return;
  }

  const safe_question = question_check.sanitized_question;
  isAiLoadingSignal.value = true;

  try {
    const current_board = activeBoardSignal.value;
    const selected_ids = Array.isArray(targetCardIds) && targetCardIds.length > 0
      ? targetCardIds
      : (selectedCardsSignal.value || []);

    // OWASP LLM01 (Indirect), LLM03, LLM04, LLM06: Sanitize & redact encrypted cards before sending
    const {
      board_summary,
      valid_card_id_set,
    } = build_safe_board_context(current_board, selected_ids);

    let data = null;

    if (typeof customHandler === 'function') {
      try {
        data = await customHandler(board_summary, safe_question, selected_ids);
      } catch (handlerErr) {
        console.warn('[AI State] Custom handler failed, falling back to server API:', handlerErr);
      }
    }

    if (!data || !data.answer) {
      console.log(
        `[AI Model Usage] Function: askAiAboutBoard (Request) | Model: ${routed_model.id} (${routed_model.full_name || routed_model.name}) | Provider: ${active_provider.id} | Quality: { reasoningEffort: "high", maxOutputTokens: 8192 }`
      );
      const response = await fetch('/api/ai/ask-board', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          question: safe_question,
          board: board_summary,
          selected_card_ids: selected_ids.length > 0 ? selected_ids : undefined,
          mcp_provider: active_provider.id,
          byo_mcp_enabled: Boolean(mcp_cfg.byo_mcp_enabled),
          external_mcp_url: external_url || undefined,
        }),
      });

      if (!response.ok) {
        const err_data = await response.json().catch(() => ({}));
        console.log(
          `[AI Debug] /api/ai/ask-board HTTP ${response.status} non-OK response:`,
          err_data
        );
        if (response.status === 429 && err_data?.quotaExceeded) {
          showAiErrorModal(err_data, {
            status_code: response.status,
            action_label: 'Board Intelligence Query',
            model_label: routed_model.full_name || routed_model.name,
          });
          data = err_data;
        } else {
          const http_err = new Error(err_data.error || `Server returned HTTP ${response.status}`);
          http_err.status = response.status;
          http_err.responsePayload = err_data;
          throw http_err;
        }
      } else {
        data = await response.json();
        if (data?.securityBlocked || data?.quotaExceeded) {
          showAiErrorModal(data, {
            status_code: data?.quotaExceeded ? 429 : 400,
            action_label: 'Board Intelligence Query',
            model_label: routed_model.full_name || routed_model.name,
          });
        }
      }
      console.log(
        `[AI Model Usage] Function: askAiAboutBoard (Completed) | ModelUsed: ${data?.mcpProvider || routed_model.id} (${data?.mcpProviderBadge || routed_model.badge || active_provider.badge}) | Quality: { reasoningEffort: "high", maxOutputTokens: 8192 }`
      );
    }

    // OWASP LLM02, LLM06, LLM08: Sanitize AI output & validate cited card IDs
    const safe_output = sanitize_ai_output_payload(data, valid_card_id_set);

    const assistant_msg = {
      id: createId('msg_ai'),
      role: 'assistant',
      text: safe_output.answer,
      isError: Boolean(data?.securityBlocked || data?.quotaExceeded),
      mcpProvider: data?.mcpProvider || active_provider.id,
      mcpProviderBadge: data?.mcpProviderBadge || active_provider.badge,
      mcpToolCalls: Array.isArray(data?.mcpToolCalls)
        ? data.mcpToolCalls
        : [{ tool: 'get_board_summary', status: 'ok', cardsInspected: (board_summary.cards || []).length }],
      responsibleCardIds: safe_output.responsibleCardIds,
      suggestedFollowUps: safe_output.suggestedFollowUps,
      timestamp: Date.now(),
    };

    aiChatMessagesSignal.value = [...aiChatMessagesSignal.value, assistant_msg];
    aiCitedCardIdsSignal.value = assistant_msg.responsibleCardIds;
  } catch (err) {
    console.log('[AI Debug] askAiAboutBoard failed:', err?.message || err, err);
    console.error('AI Board error:', err);

    showAiErrorModal(err, {
      status_code: err?.status,
      action_label: 'Board Intelligence Query',
      model_label: routed_model.full_name || routed_model.name,
    });

    const err_msg_text = err?.message || 'Unable to complete AI query.';
    const error_chat_msg = {
      id: createId('msg_ai_error'),
      role: 'assistant',
      text: `⚠️ **AI Query Failed:** ${err_msg_text}`,
      isError: true,
      mcpProvider: active_provider.id,
      mcpProviderBadge: active_provider.badge,
      mcpToolCalls: [],
      responsibleCardIds: [],
      suggestedFollowUps: [
        'Summarize this board and its key themes',
        'What are all pending or completed deliverables?',
      ],
      timestamp: Date.now(),
    };
    aiChatMessagesSignal.value = [...aiChatMessagesSignal.value, error_chat_msg];
    aiCitedCardIdsSignal.value = [];
  } finally {
    isAiLoadingSignal.value = false;
    fetch_ai_usage().catch(() => {});
  }
};

/**
 * Trigger AI Ask specifically for currently multi-selected cards
 * If customPrompt is passed, sends it directly.
 * Otherwise, opens the AI panel with context focused on selected cards so the user can input their own question.
 */
export const askAiAboutSelectedCards = (customPrompt = null) => {
  const selected_ids = selectedCardsSignal.value || [];
  if (selected_ids.length === 0) {
    openAiPanel();
    return;
  }

  // If a prompt is explicitly provided, send it
  if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
    openAiPanel();
    askAiAboutBoard(customPrompt, selected_ids);
    return;
  }

  // If single selected card is a stock card, analyze its stock code / ticker symbol by default
  if (selected_ids.length === 1) {
    const current_board = activeBoardSignal.value;
    const cards = current_board?.cards || [];
    const target_card = cards.find((c) => c.id === selected_ids[0]);
    if (target_card && target_card.type === 'stock') {
      const symbol = target_card.symbol || 'MAPI.JK';
      openAiPanel();
      askAiAboutBoard(`Analyze ticker symbol "${symbol}": evaluate performance trends, financial valuation, and market outlook.`, selected_ids);
      return;
    }
  }

  // Otherwise, open AI panel focusing on selected cards and allow the user to input their query
  openAiPanel();
};

/**
 * Trigger AI Ask specifically for a card
 * If customPrompt is passed, sends it directly.
 * Otherwise, selects the card, opens the AI panel, and lets the user input their own prompt.
 */
export const askAiAboutCard = (cardId, customPrompt = null) => {
  if (cardId) {
    selectedCardsSignal.value = [cardId];
  }

  // If a prompt is explicitly provided, send it
  if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
    openAiPanel();
    askAiAboutBoard(customPrompt, cardId ? [cardId] : null);
    return;
  }

  // Check if target card is a stock card: AI will by default analyze the stock code or ticker symbol instead of Card Title
  const current_board = activeBoardSignal.value;
  const cards = current_board?.cards || [];
  const target_card = cards.find((c) => c.id === cardId);
  if (target_card && target_card.type === 'stock') {
    const symbol = target_card.symbol || 'MAPI.JK';
    openAiPanel();
    askAiAboutBoard(`Analyze ticker symbol "${symbol}": evaluate performance trends, financial valuation, and market outlook.`, cardId ? [cardId] : null);
    return;
  }

  // Otherwise, open AI panel focusing on the card and let user input their prompt
  openAiPanel();
};

// =========================================================================
// Card-Type-Specific AI Actions Registry (Modify, Analyze, Create Cards)
// =========================================================================
export const CARD_TYPE_AI_ACTIONS = {
  note: [
    {
      id: 'note_replace_content',
      label: 'Replace content',
      category: 'modify',
      description: 'Free-form prompt: write, rewrite, brainstorm, or create mindful notes, jokes, poems & motivations',
    },
    {
      id: 'note_creative_spark',
      label: 'Create mindful note, joke, poem or motivation',
      category: 'create',
      description: 'Create a new Note card with a mindful note, witty joke, love poem, greeting, or motivation quote (Muse Wonder)',
    },
    {
      id: 'note_create_image',
      label: 'Create Image',
      category: 'create',
      description: 'Input a prompt to generate an Image Card using your selected Board List AI model',
    },
    {
      id: 'note_add_tldr',
      label: 'Add TL;DR on top',
      category: 'modify',
      description: 'Generate a concise TL;DR summary and prepend it to the top of this note',
    },
    {
      id: 'note_fix_typos',
      label: 'Fix typos & grammar',
      category: 'modify',
      description: 'Proofread and fix spelling, punctuation, and grammar in-place',
    },
    {
      id: 'note_summarize',
      label: 'Summarize note content',
      category: 'analyze',
      description: 'Synthesize key points and themes from this note in Board Intelligence',
    },
    {
      id: 'note_bullet_points',
      label: 'Format as bullet list',
      category: 'modify',
      description: 'Convert note paragraphs into scannable bullet points',
    },
    {
      id: 'note_expand',
      label: 'Expand & elaborate',
      category: 'modify',
      description: 'Add deeper context, implications, and open questions to this note',
    },
    {
      id: 'note_extract_tasks',
      label: 'Extract checklist card',
      category: 'create',
      description: 'Create a new Checklist card next to this note with extracted tasks',
    },
    {
      id: 'note_text_to_voice',
      label: 'Text to Voice (Google TTS)',
      category: 'modify',
      description: 'Synthesize this note or custom text into natural 24kHz studio speech audio using Google Text-to-Speech',
    },
  ],
  tasklist: [
    {
      id: 'tasklist_generate_subtasks',
      label: 'Generate subtasks',
      category: 'modify',
      description: 'Add 3 actionable subtasks tailored to this checklist',
    },
    {
      id: 'tasklist_prioritize',
      label: 'Prioritize & sort tasks',
      category: 'modify',
      description: 'Tag tasks with [P1]/[P2] priority and sort incomplete items first',
    },
    {
      id: 'tasklist_summarize_progress',
      label: 'Analyze sprint progress',
      category: 'analyze',
      description: 'Audit completion percentage, remaining blockers, and next steps',
    },
  ],
  docs: [
    {
      id: 'docs_add_exec_summary',
      label: 'Add Executive Summary (TL;DR)',
      category: 'modify',
      description: 'Insert an Executive Summary section at the top of this document',
    },
    {
      id: 'docs_polish_prose',
      label: 'Fix typos & polish prose',
      category: 'modify',
      description: 'Proofread and refine editorial tone across the document',
    },
    {
      id: 'note_extract_tasks',
      label: 'Extract action checklist card',
      category: 'create',
      description: 'Create a companion Checklist card from document deliverables',
    },
    {
      id: 'note_summarize',
      label: 'Analyze document structure',
      category: 'analyze',
      description: 'Review key sections and takeaways in Board Intelligence',
    },
  ],
  code: [
    {
      id: 'code_improve_current',
      label: 'AI Improve current code',
      category: 'modify',
      description: 'Update or modify specific parts of the current code with your instruction (e.g. change the bird image to phoenix) using Meta Muse (muse-wonder-1.0)',
    },
    {
      id: 'code_generate_snippet',
      label: 'Generate code snippet',
      category: 'modify',
      description: 'Generate code snippets or full HTML webpages from a prompt using Meta Muse (muse-wonder-1.0)',
    },
    {
      id: 'code_explain_and_comment',
      label: 'Add inline comments & docs',
      category: 'modify',
      description: 'Add clear inline documentation, JSDoc/docstrings, and complexity notes using Meta Muse (muse-wonder-1.0)',
    },
    {
      id: 'code_optimize_refactor',
      label: 'Optimize & refactor snippet',
      category: 'modify',
      description: 'Refactor active code for clean architecture, edge-case safety, and performance using Meta Muse (muse-wonder-1.0)',
    },
    {
      id: 'code_review_bugs',
      label: 'Review code & security audit',
      category: 'analyze',
      description: 'Audit complexity, potential bugs, and security best practices using Meta Muse (muse-wonder-1.0)',
    },
    {
      id: 'note_extract_tasks',
      label: 'Extract implementation checklist',
      category: 'create',
      description: 'Create a companion Checklist card with implementation and testing steps',
    },
  ],
  sheets: [
    {
      id: 'note_add_tldr',
      label: 'Add data TL;DR note',
      category: 'modify',
      description: 'Summarize key metrics and attach a TL;DR note to this spreadsheet',
    },
    {
      id: 'note_summarize',
      label: 'Analyze table metrics & trends',
      category: 'analyze',
      description: 'Inspect rows, totals, and anomalies in Board Intelligence',
    },
    {
      id: 'note_extract_tasks',
      label: 'Create follow-up checklist',
      category: 'create',
      description: 'Create a checklist card to track spreadsheet review items',
    },
  ],
  stock: [
    {
      id: 'stock_add_thesis_note',
      label: 'Add AI market thesis to card',
      category: 'modify',
      description: 'Write a concise ticker valuation & catalyst note onto this Stock Card',
    },
    {
      id: 'stock_create_memo_card',
      label: 'Create investment memo card',
      category: 'create',
      description: 'Spawn a companion Note card with Bull vs. Bear cases for this ticker',
    },
    {
      id: 'stock_analyze_ticker',
      label: 'Analyze ticker & valuation',
      category: 'analyze',
      description: 'Deep financial & technical analysis of the stock code in Board Intelligence',
    },
  ],
  image: [
    {
      id: 'image_create_image',
      label: 'Create Image',
      category: 'modify',
      description: 'Input a prompt to generate an AI image using your selected Board List Image Gen model',
    },
    {
      id: 'image_visualize_creatively',
      label: 'Visualize image creatively',
      category: 'modify',
      description: 'Creatively visualize this image as a love poem, joke, motivational quote, or greeting (Muse Wonder)',
    },
    {
      id: 'image_generate_caption',
      label: 'Generate visual caption',
      category: 'modify',
      description: 'Write an editorial design caption for this image card',
    },
    {
      id: 'image_extract_palette',
      label: 'Extract color palette card',
      category: 'create',
      description: 'Create a new 5-swatch Color Palette card inspired by this image',
    },
    {
      id: 'note_summarize',
      label: 'Analyze visual mood & lighting',
      category: 'analyze',
      description: 'Evaluate composition, materiality, and design direction',
    },
  ],
  palette: [
    {
      id: 'palette_harmonize',
      label: 'Add contrast & usage guide',
      category: 'modify',
      description: 'Write surface/accent pairing and WCAG contrast notes onto this palette',
    },
    {
      id: 'note_summarize',
      label: 'Analyze color psychology',
      category: 'analyze',
      description: 'Evaluate tonal balance and brand mood in Board Intelligence',
    },
  ],
  link: [
    {
      id: 'link_summarize_url',
      label: 'Add TL;DR link summary',
      category: 'modify',
      description: 'Generate a concise TL;DR summary in the link annotation field',
    },
    {
      id: 'note_extract_tasks',
      label: 'Extract reading checklist',
      category: 'create',
      description: 'Create a checklist card of key takeaways from this web resource',
    },
    {
      id: 'note_summarize',
      label: 'Analyze web source relevance',
      category: 'analyze',
      description: 'Evaluate how this link supports the active workspace board',
    },
  ],
  geo: [
    {
      id: 'geo_add_field_notes',
      label: 'Add site visit & field notes',
      category: 'modify',
      description: 'Populate location notes with architectural and logistical context',
    },
    {
      id: 'note_extract_tasks',
      label: 'Create site visit checklist',
      category: 'create',
      description: 'Create a companion Checklist card for on-site inspection',
    },
    {
      id: 'note_summarize',
      label: 'Analyze spatial & regional context',
      category: 'analyze',
      description: 'Explore location context in Board Intelligence',
    },
  ],
  quote: [
    {
      id: 'quote_polish',
      label: 'Polish quote & attribution',
      category: 'modify',
      description: 'Fix typos, clean quotation marks, and refine author attribution',
    },
    {
      id: 'note_summarize',
      label: 'Analyze thematic meaning',
      category: 'analyze',
      description: 'Connect this quote to the overall board philosophy',
    },
  ],
  heading: [
    {
      id: 'heading_generate_subtitle',
      label: 'Generate section subtitle',
      category: 'modify',
      description: 'Write a crisp editorial subtitle under this section heading',
    },
    {
      id: 'note_fix_typos',
      label: 'Fix typos & sharpen headline',
      category: 'modify',
      description: 'Proofread and sharpen the section heading text',
    },
    {
      id: 'note_extract_tasks',
      label: 'Create section checklist card',
      category: 'create',
      description: 'Create a checklist card for this workspace section',
    },
  ],
  file: [
    {
      id: 'note_add_tldr',
      label: 'Add file abstract (TL;DR)',
      category: 'modify',
      description: 'Add a concise executive abstract to the file description',
    },
    {
      id: 'note_extract_tasks',
      label: 'Create file review checklist',
      category: 'create',
      description: 'Create a checklist card for reviewing and approving this file',
    },
    {
      id: 'note_summarize',
      label: 'Analyze file context',
      category: 'analyze',
      description: 'Summarize how this attachment fits into the project',
    },
  ],
  sound_recorder: [
    {
      id: 'sound_transcribe',
      label: 'Transcribe recorded audio',
      category: 'modify',
      description: 'Transcribe the cloud-stored sound recording into editable [MM:SS] timestamped text using Meta Muse AI',
    },
    {
      id: 'sound_translate',
      label: 'Translate transcript / audio',
      category: 'modify',
      description: 'Translate the audio or transcript into your selected target language using Meta Muse AI',
    },
    {
      id: 'sound_transcribe_and_translate',
      label: 'Transcribe & Translate',
      category: 'modify',
      description: 'Transcribe the recorded sound and translate it in one step using Meta Muse AI',
    },
    {
      id: 'sound_create_note',
      label: 'Create Note card from recording',
      category: 'create',
      description: 'Synthesize a rich meeting & recording Note card with [MM:SS] key points, and automatically create a Checklist card if there are tasks to do',
    },
  ],
  embed: [
    {
      id: 'note_add_tldr',
      label: 'Add web embed TL;DR & curation notes',
      category: 'modify',
      description: 'Add TL;DR curation notes and creative takeaways to this web embed card',
    },
    {
      id: 'note_summarize',
      label: 'Analyze web embed reference',
      category: 'analyze',
      description: 'Analyze how this media or social embed aligns with the moodboard',
    },
  ],
  social: [
    {
      id: 'note_add_tldr',
      label: 'Add web embed TL;DR & curation notes',
      category: 'modify',
      description: 'Add TL;DR curation notes and creative takeaways to this web embed card',
    },
    {
      id: 'note_summarize',
      label: 'Analyze web embed reference',
      category: 'analyze',
      description: 'Analyze how this media or social embed aligns with the moodboard',
    },
  ],
  canvas: [
    {
      id: 'note_add_tldr',
      label: 'Add sketch specification note',
      category: 'modify',
      description: 'Generate a design specification note for this drawing canvas',
    },
    {
      id: 'note_extract_tasks',
      label: 'Create implementation checklist',
      category: 'create',
      description: 'Create a checklist card to turn this sketch into deliverables',
    },
  ],
  group: [
    {
      id: 'group_synthesize_summary',
      label: 'Synthesize group summary',
      category: 'modify',
      description: 'Summarize all member cards inside this group into the group header note',
    },
    {
      id: 'note_extract_tasks',
      label: 'Extract group checklist card',
      category: 'create',
      description: 'Create a consolidated checklist card from this group',
    },
    {
      id: 'note_summarize',
      label: 'Analyze group cohesion',
      category: 'analyze',
      description: 'Analyze relationships between all cards inside this group',
    },
  ],
  board: [
    {
      id: 'note_add_tldr',
      label: 'Generate sub-board charter',
      category: 'modify',
      description: 'Write a clear scope summary onto this nested sub-board card',
    },
    {
      id: 'note_summarize',
      label: 'Analyze sub-board scope',
      category: 'analyze',
      description: 'Evaluate how this nested board fits the parent workspace',
    },
  ],
  item: [
    {
      id: 'note_add_tldr',
      label: 'Enrich item description (TL;DR)',
      category: 'modify',
      description: 'Add a structured product/item summary and key specs',
    },
    {
      id: 'note_fix_typos',
      label: 'Fix typos & polish specs',
      category: 'modify',
      description: 'Proofread item title and specification text',
    },
    {
      id: 'note_summarize',
      label: 'Analyze item & alternatives',
      category: 'analyze',
      description: 'Evaluate item fit and specifications in Board Intelligence',
    },
  ],
};

export const getCardAiActions = (cardType) => {
  const key = String(cardType || 'note').toLowerCase().trim();
  const base_actions = CARD_TYPE_AI_ACTIONS[key] || CARD_TYPE_AI_ACTIONS.note;
  if (
    key !== 'image' &&
    key !== 'sound_recorder' &&
    !base_actions.some((a) => a.id === 'note_create_image' || a.id === 'image_create_image')
  ) {
    return [
      ...base_actions,
      {
        id: 'note_create_image',
        label: 'Create Image',
        category: 'create',
        description: 'Input a prompt to generate an Image Card using your selected Board List AI model',
      },
    ];
  }
  return base_actions;
};

/**
 * Executes a card-type-specific AI action:
 * - Modifies card content in-place (with Undo history)
 * - Creates companion/new cards on the board
 * - Or analyzes the card in the Board Intelligence panel
 */
const PALETTE_SWATCH_ROLES = ['Primary', 'Secondary', 'Accent', 'Neutral', 'Light'];

function rgb_to_hex_string(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function hex_to_rgb_tuple(hex_str) {
  const clean = String(hex_str || '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return { r: 51, g: 65, b: 85 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function suggest_swatch_name_from_hex(hex_str) {
  const { r, g, b } = hex_to_rgb_tuple(hex_str);
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

  const deg = Math.round(h * 360);
  const sat = Math.round(s * 100);
  const lum = Math.round(l * 100);

  if (lum <= 12) return 'Obsidian Black';
  if (lum >= 93) return 'Pure White';
  if (sat <= 12) {
    if (lum < 40) return 'Charcoal Slate';
    if (lum < 70) return 'Stone Grey';
    return 'Mist Grey';
  }
  if (deg >= 345 || deg < 15) return sat > 60 ? 'Crimson Red' : 'Dusty Rose';
  if (deg >= 15 && deg < 45) return sat > 60 ? 'Terracotta Orange' : 'Warm Clay';
  if (deg >= 45 && deg < 70) return sat > 60 ? 'Amber Ochre' : 'Sand Khaki';
  if (deg >= 70 && deg < 155) return sat > 50 ? 'Forest Emerald' : 'Sage Moss';
  if (deg >= 155 && deg < 190) return sat > 50 ? 'Electric Teal' : 'Earthy Jade';
  if (deg >= 190 && deg < 250) return sat > 50 ? 'Cobalt Blue' : 'Slate Indigo';
  if (deg >= 250 && deg < 290) return sat > 50 ? 'Royal Violet' : 'Muted Lavender';
  return sat > 50 ? 'Vivid Magenta' : 'Antique Plum';
}

export function normalize_palette_swatches_list(raw_colors) {
  if (!Array.isArray(raw_colors) || raw_colors.length === 0) return [];
  return raw_colors.map((item, idx) => {
    const raw_hex =
      typeof item === 'string'
        ? item.trim()
        : String(item?.hex || item?.color || item?.value || '').trim();
    const with_hash = raw_hex
      ? raw_hex.startsWith('#')
        ? raw_hex.toUpperCase()
        : `#${raw_hex.toUpperCase()}`
      : '#2A2421';
    const valid_hex = /^#[0-9A-F]{6}$/i.test(with_hash) ? with_hash : '#2A2421';
    return {
      id: (typeof item === 'object' && item?.id) || `col_${Date.now()}_${idx}`,
      hex: valid_hex,
      name:
        (typeof item === 'object' && item?.name && item.name !== 'Charcoal Slate')
          ? item.name
          : suggest_swatch_name_from_hex(valid_hex),
      role: (typeof item === 'object' && item?.role) || PALETTE_SWATCH_ROLES[idx] || 'Swatch',
    };
  });
}

async function inspect_image_card_visuals(card) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !card) {
    return null;
  }
  const slides = Array.isArray(card.images) && card.images.length > 0 ? card.images : [];
  const active_idx = Math.max(
    0,
    Math.min(Number(card.active_slide_index) || 0, Math.max(0, slides.length - 1))
  );
  const active_slide = slides[active_idx];
  const img_url =
    (typeof active_slide === 'string' ? active_slide : active_slide?.url) ||
    card.imageUrl ||
    '';
  if (!img_url || typeof img_url !== 'string') return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const timer = setTimeout(() => finish(null), 3500);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timer);
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map();
        let lum_sum = 0;
        let lum_min = 255;
        let lum_max = 0;
        let warm_cool_sum = 0;
        let sat_sum = 0;
        let valid_px = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          valid_px += 1;
          const px_lum = 0.299 * r + 0.587 * g + 0.114 * b;
          lum_sum += px_lum;
          if (px_lum < lum_min) lum_min = px_lum;
          if (px_lum > lum_max) lum_max = px_lum;
          warm_cool_sum += r - b;

          // Quantize into 24-step RGB bins
          const qr = Math.floor(r / 24);
          const qg = Math.floor(g / 24);
          const qb = Math.floor(b / 24);
          const key = `${qr}_${qg}_${qb}`;

          // Boost weight slightly for saturated / non-extreme pixels so vibrant accents aren't lost
          const max_c = Math.max(r, g, b);
          const min_c = Math.min(r, g, b);
          const chroma = max_c - min_c;
          sat_sum += max_c > 0 ? (chroma / max_c) * 100 : 0;
          const weight = chroma > 35 ? 1.45 : 1.0;

          const existing = buckets.get(key);
          if (existing) {
            existing.count += weight;
            existing.rawCount += 1;
            existing.rSum += r;
            existing.gSum += g;
            existing.bSum += b;
          } else {
            buckets.set(key, {
              count: weight,
              rawCount: 1,
              rSum: r,
              gSum: g,
              bSum: b,
            });
          }
        }

        const sorted_bins = Array.from(buckets.values())
          .map((b) => ({
            count: b.count,
            r: Math.round(b.rSum / b.rawCount),
            g: Math.round(b.gSum / b.rawCount),
            b: Math.round(b.bSum / b.rawCount),
          }))
          .sort((a, b) => b.count - a.count);

        if (sorted_bins.length === 0) return finish(null);

        const picked = [];
        const color_dist = (c1, c2) =>
          Math.sqrt(
            (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2
          );

        for (const min_dist of [58, 38, 22, 10]) {
          for (const candidate of sorted_bins) {
            if (picked.length >= 5) break;
            if (picked.every((p) => color_dist(p, candidate) >= min_dist)) {
              picked.push(candidate);
            }
          }
          if (picked.length >= 5) break;
        }

        // Sort from dark to light for a cohesive moodboard progression
        picked.sort(
          (a, b) =>
            0.299 * a.r + 0.587 * a.g + 0.114 * a.b -
            (0.299 * b.r + 0.587 * b.g + 0.114 * b.b)
        );

        const swatches = picked.slice(0, 5).map((col, idx) => {
          const hex = rgb_to_hex_string(col.r, col.g, col.b);
          return {
            id: `col_${Date.now()}_${idx}`,
            hex,
            name: suggest_swatch_name_from_hex(hex),
            role: PALETTE_SWATCH_ROLES[idx] || 'Swatch',
          };
        });

        const avg_lum_pct = valid_px > 0 ? Math.round((lum_sum / valid_px / 255) * 100) : 52;
        const dynamic_spread = Math.round(((Math.max(0, lum_max - lum_min)) / 255) * 100);
        const avg_warmth = valid_px > 0 ? Math.round(warm_cool_sum / valid_px) : 0;
        const avg_sat_pct = valid_px > 0 ? Math.round(sat_sum / valid_px) : 38;

        const lighting_key =
          avg_lum_pct >= 68
            ? 'High-Key Luminous & Airy'
            : avg_lum_pct <= 34
            ? dynamic_spread >= 65
              ? 'Dramatic Chiaroscuro & Deep Shadow'
              : 'Low-Key Moody & Atmospheric'
            : dynamic_spread >= 72
            ? 'Crisp Directional Key Light'
            : 'Balanced Natural Studio Diffusion';

        const contrast_profile =
          dynamic_spread >= 75
            ? 'High Dynamic Contrast (Crisp Highlights & Deep Blacks)'
            : dynamic_spread >= 45
            ? 'Medium-Full Tonal Gradation'
            : 'Soft Matte / Diffused Low Contrast';

        const color_temperature =
          avg_warmth >= 16
            ? 'Warm Golden / Amber Cast (~3400K–4300K)'
            : avg_warmth <= -14
            ? 'Cool Daylight / Slate Cast (~6000K–7200K)'
            : 'Neutral Balanced Daylight (~5000K–5500K)';

        const nat_w = img.naturalWidth || 1;
        const nat_h = img.naturalHeight || 1;
        const aspect_orientation =
          nat_w / nat_h > 1.15 ? 'Landscape' : nat_h / nat_w > 1.15 ? 'Portrait' : 'Square (1:1)';

        // Create a compact 256px JPEG snapshot so backend multimodal Gemini can inspect the actual image
        let snapshot_data_url = null;
        try {
          const snap_max = 256;
          const scale = Math.min(1, snap_max / Math.max(nat_w, nat_h));
          const snap_w = Math.max(64, Math.round(nat_w * scale));
          const snap_h = Math.max(64, Math.round(nat_h * scale));
          const snap_canvas = document.createElement('canvas');
          snap_canvas.width = snap_w;
          snap_canvas.height = snap_h;
          const snap_ctx = snap_canvas.getContext('2d');
          if (snap_ctx) {
            snap_ctx.drawImage(img, 0, 0, snap_w, snap_h);
            snapshot_data_url = snap_canvas.toDataURL('image/jpeg', 0.72);
          }
        } catch (_snap_err) {
          snapshot_data_url = null;
        }

        finish({
          swatches: swatches.length > 0 ? swatches : null,
          visual_metrics: {
            avg_luminance: avg_lum_pct,
            dynamic_range: dynamic_spread,
            lighting_key,
            contrast_profile,
            color_temperature,
            avg_saturation: avg_sat_pct,
            aspect_orientation,
          },
          snapshot_data_url,
        });
      } catch (_err) {
        finish(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = img_url;
  });
}

function capture_reference_image_png_data_url(img_url) {
  if (!img_url || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (typeof img_url === 'string' && img_url.startsWith('data:image/')) {
    return Promise.resolve(img_url);
  }
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };
    const timer = setTimeout(() => finish(null), 3500);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timer);
      try {
        const nat_w = img.naturalWidth || 1536;
        const nat_h = img.naturalHeight || 1536;
        const max_dim = 1536;
        const scale = Math.min(1, max_dim / Math.max(nat_w, nat_h));
        const out_w = Math.max(64, Math.round(nat_w * scale));
        const out_h = Math.max(64, Math.round(nat_h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = out_w;
        canvas.height = out_h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, out_w, out_h);
          finish(canvas.toDataURL('image/png'));
          return;
        }
      } catch (_err) {
        // Proceed with server-side URL/file_id fetch if canvas is tainted
      }
      finish(null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = img_url;
  });
}

async function parse_ai_response_json_safely(resp) {
  const raw_text = await resp.text().catch(() => '');
  const trimmed = String(raw_text || '').trim();
  let parsed = null;
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed);
    } catch (_err) {
      // Attempt to extract embedded JSON object if proxy prepended/appended headers or noise
      const first_brace = trimmed.indexOf('{');
      const last_brace = trimmed.lastIndexOf('}');
      if (first_brace !== -1 && last_brace > first_brace) {
        try {
          parsed = JSON.parse(trimmed.slice(first_brace, last_brace + 1));
        } catch (_inner_err) {
          parsed = null;
        }
      }
    }
  }
  return {
    ok: resp.ok,
    status: resp.status,
    data: parsed,
    rawText: trimmed,
  };
}

export const runAiCardAction = async (
  cardId,
  actionId,
  customInstruction = '',
  actionOptions = {}
) => {
  const current_board = activeBoardSignal.value;
  const cards = current_board?.cards || [];
  const target_card = cards.find((c) => c.id === cardId);

  if (!target_card) {
    showToast('Card not found on active board');
    return null;
  }

  // If this is a pure stock analysis action, route through askAiAboutCard
  if (actionId === 'stock_analyze_ticker') {
    const sym = target_card.symbol || target_card.stockCode || 'MAPI.JK';
    openAiPanel();
    await askAiAboutBoard(
      `Analyze ticker symbol "${sym}": evaluate performance trends, financial valuation, and market outlook.`,
      [cardId]
    );
    return null;
  }

  isCardAiProcessingSignal.value = { cardId, actionId };
  const task_category = resolveAiTaskCategoryForAction(actionId, target_card.type);
  const routed_model = getSelectedAiModelForTask(task_category);
  const active_provider =
    MCP_AI_PROVIDERS.find((p) => p.id === routed_model.provider_id) ||
    getActiveMcpProvider();

  try {
    let client_extracted_colors = null;
    let client_visual_metrics = null;
    let client_image_snapshot = null;
    if (
      target_card.type === 'image' &&
      (actionId === 'image_extract_palette' ||
        actionId === 'image_generate_caption' ||
        actionId === 'image_visualize_creatively' ||
        actionId === 'image_analyze_mood' ||
        actionId === 'note_summarize')
    ) {
      const inspected = await inspect_image_card_visuals(target_card);
      if (inspected) {
        client_extracted_colors = inspected.swatches || null;
        client_visual_metrics = inspected.visual_metrics || null;
        client_image_snapshot = inspected.snapshot_data_url || null;
      }
    }

    // Prepare a lightweight card copy for the request body (avoid sending huge raw base64 arrays in card.images if snapshot is already extracted)
    const active_slide_idx = Math.max(
      0,
      Math.min(
        Number(
          actionOptions?.active_slide_index !== undefined
            ? actionOptions.active_slide_index
            : target_card.active_slide_index
        ) || 0,
        Math.max(0, (Array.isArray(target_card.images) ? target_card.images.length : 1) - 1)
      )
    );
    const active_slide_obj = Array.isArray(target_card.images)
      ? target_card.images[active_slide_idx]
      : null;
    const active_slide_caption =
      (typeof active_slide_obj === 'object' && active_slide_obj?.caption) ||
      target_card.caption ||
      '';
    const active_slide_url =
      actionOptions?.reference_image_url ||
      (typeof active_slide_obj === 'string'
        ? active_slide_obj
        : active_slide_obj?.url) ||
      target_card.imageUrl ||
      '';
    const active_slide_file_id =
      actionOptions?.reference_file_id ||
      (typeof active_slide_obj === 'object' ? active_slide_obj?.file_id : null) ||
      target_card.file_id ||
      null;

    const use_reference_image = Boolean(
      actionOptions &&
        typeof actionOptions === 'object' &&
        actionOptions.use_reference_image &&
        active_slide_url
    );
    const reference_strength =
      actionOptions &&
      typeof actionOptions === 'object' &&
      Number.isFinite(Number(actionOptions.reference_strength))
        ? Math.max(0.1, Math.min(0.95, Number(actionOptions.reference_strength)))
        : 0.45;
    const reference_seed =
      actionOptions &&
      typeof actionOptions === 'object' &&
      Number.isFinite(Number(actionOptions.reference_seed))
        ? Math.round(Number(actionOptions.reference_seed))
        : 42;

    const image_size =
      actionOptions &&
      typeof actionOptions === 'object' &&
      ['auto', '1024x1024', '1024x1536', '1536x1024'].includes(
        String(actionOptions.image_size || '').toLowerCase()
      )
        ? String(actionOptions.image_size).toLowerCase()
        : 'auto';
    const output_format =
      actionOptions &&
      typeof actionOptions === 'object' &&
      ['jpg', 'png', 'webp'].includes(String(actionOptions.output_format || '').toLowerCase())
        ? String(actionOptions.output_format).toLowerCase()
        : 'jpg';
    const reasoning_strength =
      actionOptions &&
      typeof actionOptions === 'object' &&
      ['low', 'high'].includes(String(actionOptions.reasoning_strength || '').toLowerCase())
        ? String(actionOptions.reasoning_strength).toLowerCase()
        : 'high';
    const enable_image_search =
      actionOptions &&
      typeof actionOptions === 'object' &&
      actionOptions.enable_image_search !== undefined
        ? Boolean(actionOptions.enable_image_search)
        : true;
    const enable_web_search =
      actionOptions &&
      typeof actionOptions === 'object' &&
      actionOptions.enable_web_search !== undefined
        ? Boolean(actionOptions.enable_web_search)
        : true;
    const enable_shell =
      actionOptions &&
      typeof actionOptions === 'object' &&
      actionOptions.enable_shell !== undefined
        ? Boolean(actionOptions.enable_shell)
        : true;
    const auto_improve_prompt =
      actionOptions &&
      typeof actionOptions === 'object' &&
      actionOptions.auto_improve_prompt !== undefined
        ? Boolean(actionOptions.auto_improve_prompt)
        : false;

    let reference_image_data_url = null;
    if (use_reference_image && active_slide_url) {
      reference_image_data_url = await capture_reference_image_png_data_url(active_slide_url);
    }

    let client_audio_base64 = target_card.audio_base64 || '';
    let client_audio_mime = target_card.file_type || 'audio/webm';
    if (
      target_card.type === 'sound_recorder' &&
      !client_audio_base64 &&
      (target_card.view_url || target_card.file_url || target_card.file_id)
    ) {
      const audio_fetch_url =
        target_card.view_url ||
        (target_card.file_id ? `/api/files/view/${target_card.file_id}` : '') ||
        target_card.file_url ||
        '';
      if (audio_fetch_url && typeof window !== 'undefined') {
        try {
          const audio_resp = await fetch(audio_fetch_url, {
            headers: get_lumen_auth_headers(),
          });
          if (audio_resp.ok) {
            const audio_blob = await audio_resp.blob();
            if (audio_blob && audio_blob.size > 0 && audio_blob.size <= 8 * 1024 * 1024) {
              if (audio_blob.type) {
                client_audio_mime = audio_blob.type.split(';')[0].trim() || client_audio_mime;
              }
              client_audio_base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                reader.onerror = () => resolve('');
                reader.readAsDataURL(audio_blob);
              });
            }
          }
        } catch (_audio_err) {
          // Proceed with server-side file_id resolution
        }
      }
    }

    let resolved_note_content = target_card.content || '';
    if (target_card.type === 'note' && target_card.content_html) {
      const stripped_from_html = String(target_card.content_html)
        .replace(/<\s*(?:br|\/p|\/div|\/li|\/h[1-6]|\/blockquote|\/tr)\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();
      if (stripped_from_html.length > String(resolved_note_content).trim().length) {
        resolved_note_content = stripped_from_html;
      }
    }

    // If generating a new Muse Voice result, immediately clear the previous voice result so it never blocks or masks the new voice
    if (
      actionId === 'note_text_to_voice' &&
      (target_card.tts_audio_url || target_card.tts_audio_base64 || target_card.tts_file_id)
    ) {
      clearCardMuseVoiceResult(cardId, true);
    }

    const sanitized_card_data =
      target_card.data && typeof target_card.data === 'object' && !Array.isArray(target_card.data)
        ? { ...target_card.data }
        : undefined;
    if (sanitized_card_data) {
      delete sanitized_card_data.tts_audio_base64;
      delete sanitized_card_data.canvas_strokes;
      delete sanitized_card_data.canvas_images;
      if (target_card.type !== 'sound_recorder') {
        delete sanitized_card_data.audio_base64;
      }
    }

    const lightweight_board_cards = cards.slice(0, 40).map((bc) => {
      if (!bc || typeof bc !== 'object') return bc;
      return {
        id: bc.id,
        type: bc.type,
        title: bc.title,
        content: typeof bc.content === 'string' ? bc.content.slice(0, 600) : '',
        description: bc.description || '',
        group_id: bc.group_id || null,
        card_ids: bc.card_ids || [],
      };
    });

    console.log(
      `[AI Model Usage] Function: runAiCardAction (${actionId}) (Request) | CardType: ${target_card.type} | TaskCategory: ${task_category} | Model: ${routed_model.id} (${routed_model.full_name || routed_model.name}) | Quality: { reasoningStrength: "${reasoning_strength}", imageSize: "${image_size}", outputFormat: "${output_format}" }`
    );

    const resp = await fetch('/api/ai/card-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        action_type: actionId,
        custom_instruction: customInstruction || '',
        card: {
          ...target_card,
          active_slide_index: active_slide_idx,
          tts_audio_base64: undefined,
          canvas_strokes: undefined,
          canvas_images: undefined,
          ...(sanitized_card_data ? { data: sanitized_card_data } : {}),
          ...(target_card.type === 'note' ? { content: resolved_note_content } : {}),
          active_slide_caption,
          ...(client_audio_base64 ? { audio_base64: client_audio_base64, file_type: client_audio_mime } : {}),
        },
        ...(client_extracted_colors ? { extracted_colors: client_extracted_colors } : {}),
        ...(client_visual_metrics ? { visual_metrics: client_visual_metrics } : {}),
        ...(client_image_snapshot ? { image_snapshot_data_url: client_image_snapshot } : {}),
        ...(use_reference_image
          ? {
              use_reference_image: true,
              reference_strength,
              reference_seed,
              reference_image_url: active_slide_url,
              ...(active_slide_file_id ? { reference_file_id: active_slide_file_id } : {}),
              ...(reference_image_data_url
                ? { reference_image_data_url }
                : {}),
            }
          : {}),
        image_size,
        output_format,
        reasoning_strength,
        enable_image_search,
        enable_web_search,
        enable_shell,
        auto_improve_prompt,
        ...(actionOptions?.target_language
          ? { target_language: String(actionOptions.target_language) }
          : {}),
        ...(actionOptions?.create_new_tab !== undefined
          ? { create_new_tab: Boolean(actionOptions.create_new_tab) }
          : {}),
        ...(actionOptions?.current_code !== undefined
          ? { current_code: String(actionOptions.current_code) }
          : {}),
        ...(actionOptions?.current_file_id
          ? { current_file_id: String(actionOptions.current_file_id) }
          : {}),
        ...(actionOptions?.current_file_name
          ? { current_file_name: String(actionOptions.current_file_name) }
          : {}),
        board: {
          id: current_board.id,
          title: current_board.title,
          description: current_board.description,
          cards: lightweight_board_cards,
        },
        mcp_provider: routed_model.id || active_provider.id,
        ai_model: routed_model.id,
        ai_model_name: routed_model.full_name || routed_model.name,
        ai_task_category: task_category,
      }),
    });

    const parsed_resp = await parse_ai_response_json_safely(resp);
    if (!parsed_resp.ok) {
      console.log(
        `[AI Debug] /api/ai/card-action (${actionId}) HTTP ${parsed_resp.status} non-OK:`,
        parsed_resp.data || parsed_resp.rawText
      );
      const http_err = new Error(
        parsed_resp.data?.error ||
          parsed_resp.data?.message ||
          `Request failed (${parsed_resp.status})`
      );
      http_err.status = parsed_resp.status;
      http_err.responsePayload = parsed_resp.data || {};
      throw http_err;
    }
    if (!parsed_resp.data || typeof parsed_resp.data !== 'object') {
      console.log(
        `[AI Debug] /api/ai/card-action (${actionId}) returned invalid/empty JSON:`,
        parsed_resp.rawText
      );
      const parse_err = new Error('AI server returned an incomplete response. Please try again.');
      parse_err.status = parsed_resp.status || 502;
      throw parse_err;
    }

    const result = parsed_resp.data;
    const resolved_used_model =
      result?.updatedFields?.ai_model_used ||
      result?.updatedFields?.tts_model_used ||
      result?.createdCards?.[0]?.ai_model_used ||
      result?.modelUsed ||
      routed_model.id;
    console.log(
      `[AI Model Usage] Function: runAiCardAction (${actionId}) (Completed) | ModelUsed: ${resolved_used_model} | Operation: ${result?.operation || 'modify_card'}`
    );
    const created_card_ids = [];

    // 1. Apply in-place card modifications if returned
    if (result.updatedFields && typeof result.updatedFields === 'object') {
      const next_fields = { ...result.updatedFields };
      if (target_card.type === 'sound_recorder' && next_fields.translated_text) {
        const cur_h = Number(target_card.height) || 380;
        next_fields.height = Math.max(cur_h, 468);
      }
      if (target_card.type === 'image') {
        // When updating an image card's caption, also sync the active slide inside target_card.images so LUMEN_image_carousel displays it immediately
        if (typeof next_fields.caption === 'string' && next_fields.caption.trim()) {
          const existing_slides = Array.isArray(next_fields.images)
            ? next_fields.images
            : Array.isArray(target_card.images)
            ? target_card.images
            : [];
          if (existing_slides.length > 0) {
            const target_idx = Math.max(
              0,
              Math.min(
                Number(next_fields.active_slide_index ?? target_card.active_slide_index) || 0,
                existing_slides.length - 1
              )
            );
            next_fields.images = existing_slides.map((item, idx) => {
              const normalized_item =
                typeof item === 'string'
                  ? { id: `slide_${idx}`, url: item, caption: target_card.caption || '' }
                  : { ...item, id: item?.id || `slide_${idx}`, url: item?.url || '' };
              if (idx === target_idx) {
                return { ...normalized_item, caption: next_fields.caption };
              }
              return normalized_item;
            });
          }
        }
        // When visual mood & lighting analysis or creative visualization is attached to an image card, ensure the card height accommodates the capped note box without shrinking the image slider
        if (
          next_fields.ai_notes ||
          ((actionId === 'image_analyze_mood' || actionId === 'image_visualize_creatively') &&
            next_fields.content)
        ) {
          const cur_h = Number(target_card.height) || 360;
          next_fields.height = Math.max(cur_h, 464);
          next_fields.base_height_without_note = null;
          next_fields.image_note_height = 0;
        }
      }
      if (target_card.type === 'note' && typeof next_fields.content === 'string') {
        next_fields.content_html = null;
      }
      if (
        target_card.type === 'note' &&
        typeof next_fields.content === 'string' &&
        next_fields.content.length > 160
      ) {
        const cur_w = Number(target_card.width) || 360;
        const cur_h = Number(target_card.height) || 216;
        const next_w = next_fields.width || Math.max(cur_w, next_fields.content.length > 500 ? 456 : 408);
        const chars_per_line = Math.max(38, Math.floor((next_w - 36) / 7.2));
        const visual_lines = next_fields.content
          .split('\n')
          .reduce((acc, line) => acc + Math.max(1, Math.ceil((line.length || 1) / chars_per_line)), 0);
        const estimated_h = Math.round((visual_lines * 21 + 110) / 24) * 24;
        next_fields.width = next_w;
        next_fields.height = next_fields.height || Math.max(cur_h, Math.min(624, Math.max(336, estimated_h)));
      }
      if (target_card.type === 'code') {
        const lang_ext_map = {
          javascript: 'js',
          typescript: 'ts',
          python: 'py',
          go: 'go',
          rust: 'rs',
          sql: 'sql',
          html: 'html',
          css: 'css',
          json: 'json',
          bash: 'sh',
          java: 'java',
          cpp: 'cpp',
          php: 'php',
          ruby: 'rb',
          yaml: 'yml',
        };
        const is_html_content =
          typeof next_fields.content === 'string' &&
          (/^\s*(?:<!doctype\s+html|<html|<head|<body)\b/i.test(next_fields.content) ||
            (/<(?:html|head|body|style|main|section)[\s>]/i.test(next_fields.content) &&
              /<\/(?:html|body|style|main|section)>/i.test(next_fields.content)));
        if (is_html_content) {
          next_fields.code_language = 'html';
        }
        if (next_fields.code_data && Array.isArray(next_fields.code_data.files)) {
          const active_fid =
            next_fields.code_data.active_file_id || next_fields.code_data.files[0]?.id;
          next_fields.code_data = {
            ...next_fields.code_data,
            files: next_fields.code_data.files.map((f) => {
              if (!f || typeof f !== 'object') return f;
              const f_code = String(f.code || (f.id === active_fid ? next_fields.content || '' : ''));
              const f_is_html =
                f.id === active_fid && (is_html_content || next_fields.code_language === 'html')
                  ? true
                  : /^\s*(?:<!doctype\s+html|<html|<head|<body)\b/i.test(f_code);
              const f_lang = f_is_html ? 'html' : f.language || next_fields.code_language || 'javascript';
              const f_ext = lang_ext_map[f_lang] || 'js';
              const raw_stem =
                String(f.name || 'snippet')
                  .replace(/\.[a-z0-9]+$/i, '')
                  .replace(/_+$/g, '')
                  .replace(/_+(?:and|with|in|for|to|of|the|a|an)$/i, '')
                  .replace(/_+$/g, '') || (f_is_html ? 'index' : 'snippet');
              return {
                ...f,
                code: f_code,
                language: f_lang,
                name: `${raw_stem}.${f_ext}`,
              };
            }),
          };
        } else if (!next_fields.code_data && typeof next_fields.content === 'string') {
          const existing_cd =
            target_card.code_data && typeof target_card.code_data === 'object'
              ? target_card.code_data
              : {
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
          const existing_files =
            Array.isArray(existing_cd.files) && existing_cd.files.length > 0
              ? existing_cd.files
              : [
                  {
                    id: 'file_1',
                    name: 'snippet.js',
                    language: 'javascript',
                    code: '',
                    pinned_lines: [],
                  },
                ];
          const active_fid = existing_cd.active_file_id || existing_files[0].id;
          const resolved_lang = is_html_content
            ? 'html'
            : next_fields.code_language ||
              actionOptions?.target_language ||
              existing_files.find((f) => f.id === active_fid)?.language ||
              'javascript';
          const ext = lang_ext_map[resolved_lang] || 'js';

          if (actionOptions?.create_new_tab) {
            const new_fid = `file_${Date.now()}`;
            const new_file_obj = {
              id: new_fid,
              name: next_fields.file_name || `snippet_${existing_files.length + 1}.${ext}`,
              language: resolved_lang,
              code: next_fields.content,
              pinned_lines: [],
            };
            next_fields.code_data = {
              ...existing_cd,
              active_file_id: new_fid,
              files: [...existing_files, new_file_obj],
            };
          } else {
            const updated_files = existing_files.map((f) => {
              if (f.id !== active_fid) return f;
              const keep_existing_name =
                actionId === 'code_improve_current' ||
                actionId === 'code_explain_and_comment' ||
                actionId === 'code_optimize_refactor';
              const preferred_name = keep_existing_name
                ? f.name || next_fields.file_name || 'snippet'
                : next_fields.file_name || f.name || 'snippet';
              const raw_stem =
                String(preferred_name)
                  .replace(/\.[a-z0-9]+$/i, '')
                  .replace(/_+$/g, '') || 'snippet';
              return {
                ...f,
                name: `${raw_stem}.${ext}`,
                language: resolved_lang,
                code: next_fields.content,
              };
            });
            next_fields.code_data = {
              ...existing_cd,
              active_file_id: active_fid,
              files: updated_files,
            };
          }
        }
        const cur_w = Number(target_card.width) || 480;
        const cur_h = Number(target_card.height) || 360;
        if (typeof next_fields.content === 'string' && next_fields.content.split('\n').length > 12) {
          next_fields.width = Math.max(cur_w, 504);
          next_fields.height = Math.max(cur_h, 408);
        }
      }
      pushHistorySnapshot();
      updateCard(cardId, next_fields, true);
    }

    // 2. Create any companion / extracted cards on the board
    if (Array.isArray(result.createdCards) && result.createdCards.length > 0) {
      const drafts_to_create = [...result.createdCards];

      // On Sound Card -> Create Note: after creating the Note, check its content and if there's something we need to do (checklist), ensure a checklist card is created too
      if (actionId === 'sound_create_note') {
        const created_note_draft = drafts_to_create.find((d) => d && d.type === 'note');
        const has_tasklist_draft = drafts_to_create.some((d) => d && d.type === 'tasklist');
        if (created_note_draft && !has_tasklist_draft) {
          const note_text_str = String(created_note_draft.content || '');
          const extracted_tasks = [];
          const seen_tasks = new Set();

          // 1) Check if there is an explicit DECISIONS & ACTION ITEMS section in the created Note
          const action_section_match = note_text_str.match(
            /DECISIONS\s*&\s*ACTION\s*ITEMS\s*\r?\n([\s\S]*?)(?:\r?\n\s*(?:🗣️|🌐|⏱️|📋|📌)|$)/i
          );
          if (action_section_match && action_section_match[1]) {
            const action_lines = action_section_match[1]
              .split(/\r?\n/)
              .map((l) => l.trim().replace(/^[•\-*✓☐☑]\s*/, ''))
              .filter(Boolean);
            for (const line of action_lines) {
              const clean_line = line.replace(/\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*/g, '[$1]').trim();
              if (
                clean_line.length > 3 &&
                !/^(?:none|n\/a|no\s+action\s+items?|no\s+tasks?|nothing\s+to\s+do|-)$/i.test(clean_line)
              ) {
                const key = clean_line.toLowerCase();
                if (!seen_tasks.has(key)) {
                  seen_tasks.add(key);
                  extracted_tasks.push(clean_line);
                }
              }
            }
          }

          // 2) Also check the rest of the Note content for actionable tasks / things we need to do
          if (extracted_tasks.length === 0) {
            const todo_intent_re =
              /\b(need\s+to|needs\s+to|have\s+to|has\s+to|must|should|ought\s+to|don'?t\s+forget\s+to|remember\s+to|make\s+sure\s+to|be\s+sure\s+to|todo|to-do|checklist|action\s+item|follow\s+up|will\s+(?:need\s+to|send|prepare|create|schedule|call|buy|fix|update|review|submit|check|finish|complete|build|write|email|contact|book|order)|please\s+(?:send|prepare|create|schedule|call|buy|fix|update|review|submit|check|finish|complete|make|write)|let'?s\s+(?:make|create|prepare|schedule|send|review|fix|update|check|finish|build)|harus|perlu|jangan\s+lupa|ingat\s+untuk|tolong\s+(?:buat|siapkan|kirim|cek|hubungi|jadwalkan|beli|perbaiki|selesaikan)|daftar\s+tugas|rencana\s+kerja)\b/i;
            const note_lines = note_text_str
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(
                (l) =>
                  Boolean(l) &&
                  !/^(?:📋|⏱️|📌|✅|🗣️|🌐|Recording:|Summary of recording)/i.test(l)
              );
            for (const raw_line of note_lines) {
              const clean_line = raw_line
                .replace(/^[•\-*]\s*/, '')
                .replace(/\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*/g, '[$1]')
                .replace(/Key\s+Point\s+\d+\s*:\s*/i, '')
                .trim();
              if (clean_line.length >= 5 && todo_intent_re.test(clean_line)) {
                const key = clean_line.toLowerCase();
                if (!seen_tasks.has(key)) {
                  seen_tasks.add(key);
                  extracted_tasks.push(clean_line);
                }
              }
            }
          }

          if (extracted_tasks.length > 0) {
            const checklist_items = extracted_tasks.slice(0, 12).map((txt, idx) => ({
              id: `t_sound_${Date.now()}_${idx}`,
              text: txt.slice(0, 160),
              done: false,
            }));
            drafts_to_create.push({
              type: 'tasklist',
              title: `${(target_card.title || 'Recording').slice(0, 42)} — To-Do Checklist`,
              color: 'green',
              width: 384,
              height: Math.min(480, Math.max(264, 140 + checklist_items.length * 42)),
              items: checklist_items,
              content: `Action items & tasks extracted from "${created_note_draft.title || 'Recording Note'}".`,
              source_sound_card_id: cardId,
            });
          }
        }
      }

      let next_card_x = (target_card.x || 160) + (target_card.width || 360) + 28;
      const base_card_y = target_card.y || 160;
      let created_note_card_id = null;

      drafts_to_create.forEach((draft, idx) => {
        const normalized_draft = { ...draft };
        if (normalized_draft.type === 'palette') {
          const source_colors =
            Array.isArray(normalized_draft.colors) && normalized_draft.colors.length > 0
              ? normalized_draft.colors
              : client_extracted_colors || [];
          normalized_draft.colors = normalize_palette_swatches_list(source_colors);
        }
        if (actionId === 'sound_create_note' && !normalized_draft.source_sound_card_id) {
          normalized_draft.source_sound_card_id = cardId;
        }
        const draft_w =
          Number(normalized_draft.width) ||
          (normalized_draft.type === 'note' ? 468 : normalized_draft.type === 'tasklist' ? 384 : 360);
        const created = addCard({
          ...normalized_draft,
          x: actionId === 'sound_create_note' ? next_card_x : (target_card.x || 160) + (target_card.width || 360) + 28 + idx * 36,
          y: actionId === 'sound_create_note' ? base_card_y : base_card_y + idx * 36,
        });
        next_card_x += draft_w + 28;

        if (created && created.id) {
          created_card_ids.push(created.id);
          if (actionId === 'sound_create_note') {
            if (normalized_draft.type === 'note') {
              created_note_card_id = created.id;
            }
            try {
              if (normalized_draft.type === 'tasklist' && created_note_card_id) {
                addConnection(created_note_card_id, created.id, 'To-Do Checklist');
              } else {
                addConnection(
                  cardId,
                  created.id,
                  normalized_draft.type === 'tasklist' ? 'To-Do Checklist' : 'Recording Summary'
                );
              }
            } catch (_conn_err) {
              // ignore connection error
            }
          }
        }
      });
    }

    // 3. Log action & analysis in Board Intelligence chat history
    const action_meta = getCardAiActions(target_card.type).find((a) => a.id === actionId);
    const user_label = customInstruction
      ? `AI Card Edit on "${target_card.title || target_card.type}": ${customInstruction}`
      : `${action_meta ? action_meta.label : actionId} — "${target_card.title || target_card.type}"`;

    const user_msg = {
      id: createId('msg_user'),
      role: 'user',
      text: user_label,
      mcpProvider: active_provider.id,
      mcpProviderBadge: active_provider.badge,
      timestamp: Date.now(),
    };

    const cited = [cardId, ...created_card_ids];
    const assistant_msg = {
      id: createId('msg_ai'),
      role: 'assistant',
      text:
        result.analysisMarkdown ||
        `Completed **${action_meta?.label || actionId}** on **"${target_card.title || target_card.type}"**.`,
      mcpProvider: active_provider.id,
      mcpProviderBadge: active_provider.badge,
      mcpToolCalls: [
        {
          tool:
            result.operation === 'create_card'
              ? 'create_card'
              : result.operation === 'modify_card'
              ? 'update_card'
              : 'analyze_card',
          status: 'ok',
          cardsInspected: 1,
        },
      ],
      responsibleCardIds: cited,
      suggestedFollowUps: [
        'Summarize this board and its key themes',
        'What are all pending or completed deliverables?',
      ],
      timestamp: Date.now(),
    };

    aiChatMessagesSignal.value = [...aiChatMessagesSignal.value, user_msg, assistant_msg];
    aiCitedCardIdsSignal.value = cited;

    if (
      result.operation === 'analyze_card' ||
      actionId === 'image_analyze_mood' ||
      actionId === 'note_summarize'
    ) {
      openAiPanel();
    }

    showToast(result.summaryToast || `AI updated "${target_card.title || target_card.type}"`);
    return result;
  } catch (err) {
    console.log(`[AI Debug] runAiCardAction (${actionId}) failed:`, err?.message || err, err);
    console.error('[runAiCardAction] Error:', err);
    const action_meta_err = getCardAiActions(target_card.type).find((a) => a.id === actionId);
    showAiErrorModal(err, {
      status_code: err?.status,
      action_label: `${action_meta_err?.label || actionId} (${target_card.title || target_card.type})`,
      model_label: routed_model.full_name || routed_model.name,
    });
    return null;
  } finally {
    isCardAiProcessingSignal.value = null;
    fetch_ai_usage().catch(() => {});
  }
};

/**
 * Creates a brand-new card of any type on the active board using AI
 */
export const createCardWithAi = async (cardType = 'note', promptText = '') => {
  const clean_prompt = String(promptText || '').trim();
  if (!clean_prompt || isAiLoadingSignal.value) return null;

  const task_category = resolveAiTaskCategoryForAction(`create_${cardType}`, cardType);
  const routed_model = getSelectedAiModelForTask(task_category);
  const active_provider =
    MCP_AI_PROVIDERS.find((p) => p.id === routed_model.provider_id) ||
    getActiveMcpProvider();

  const check = validate_and_sanitize_ai_question(clean_prompt);
  if (!check.allowed) {
    showAiErrorModal(
      {
        error: check.reason || 'Blocked by OWASP LLM Guard',
        securityBlocked: true,
        securityCode: check.code || 'LLM01_BLOCKED',
      },
      {
        status_code: 400,
        action_label: `Create ${cardType.toUpperCase()} Card with AI`,
        model_label: routed_model.full_name || routed_model.name,
      }
    );
    return null;
  }

  isAiLoadingSignal.value = true;
  const current_board = activeBoardSignal.value;
  const cards = current_board?.cards || [];

  try {
    console.log(
      `[AI Model Usage] Function: createCardWithAi (create_${cardType}) (Request) | TaskCategory: ${task_category} | Model: ${routed_model.id} (${routed_model.full_name || routed_model.name}) | Quality: { reasoningStrength: "high", maxOutputTokens: 8192 }`
    );
    const resp = await fetch('/api/ai/card-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        action_type: `create_${cardType}`,
        custom_instruction: check.sanitized_question,
        reasoning_strength: 'high',
        card: {
          type: cardType,
          title: check.sanitized_question.slice(0, 56),
          content: '',
        },
        board: {
          id: current_board?.id,
          title: current_board?.title,
          description: current_board?.description,
          cards: cards.slice(0, 30).map((bc) => ({
            id: bc?.id,
            type: bc?.type,
            title: bc?.title,
            content: typeof bc?.content === 'string' ? bc.content.slice(0, 400) : '',
          })),
        },
        mcp_provider: routed_model.id || active_provider.id,
        ai_model: routed_model.id,
        ai_task_category: task_category,
      }),
    });

    const parsed_resp = await parse_ai_response_json_safely(resp);
    if (!parsed_resp.ok) {
      const err_json = parsed_resp.data || {};
      console.log(
        `[AI Debug] createCardWithAi (create_${cardType}) HTTP ${parsed_resp.status} non-OK:`,
        err_json
      );
      const http_err = new Error(err_json?.error || `Request failed (${parsed_resp.status})`);
      http_err.status = parsed_resp.status;
      http_err.responsePayload = err_json;
      throw http_err;
    }

    const data = parsed_resp.data || {};
    console.log(
      `[AI Model Usage] Function: createCardWithAi (create_${cardType}) (Completed) | ModelUsed: ${data?.createdCards?.[0]?.ai_model_used || data?.modelUsed || routed_model.id}`
    );
    const drafts = Array.isArray(data?.createdCards) && data.createdCards.length > 0
      ? data.createdCards
      : [
          {
            type: cardType,
            title: check.sanitized_question.slice(0, 48),
            content: `TL;DR: ${check.sanitized_question}\n\n• Created by ${active_provider.name}`,
            color: 'blue',
          },
        ];

    // Place near viewport center or offset from existing cards
    const vp = current_board?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const zoom = vp.zoom || 1;
    const win_w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const win_h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const base_x = Math.max(96, Math.round((win_w / 2 - vp.panX) / zoom - 180));
    const base_y = Math.max(96, Math.round((win_h / 2 - vp.panY) / zoom - 120));

    const created_ids = [];
    drafts.forEach((draft, idx) => {
      const normalized_draft = { ...draft };
      if ((normalized_draft.type || cardType) === 'palette' && Array.isArray(normalized_draft.colors)) {
        normalized_draft.colors = normalize_palette_swatches_list(normalized_draft.colors);
      }
      const new_card = addCard({
        ...normalized_draft,
        type: normalized_draft.type || cardType,
        x: base_x + idx * 36 + (cards.length % 4) * 24,
        y: base_y + idx * 36 + (cards.length % 4) * 24,
      });
      if (new_card?.id) {
        created_ids.push(new_card.id);
      }
    });

    const user_msg = {
      id: createId('msg_user'),
      role: 'user',
      text: `Create ${cardType} card: "${check.sanitized_question}"`,
      mcpProvider: active_provider.id,
      mcpProviderBadge: active_provider.badge,
      timestamp: Date.now(),
    };

    const assistant_msg = {
      id: createId('msg_ai'),
      role: 'assistant',
      text:
        data?.analysisMarkdown ||
        `### Created ${cardType.toUpperCase()} Card\n\nPlaced **"${drafts[0]?.title || check.sanitized_question}"** on your canvas.`,
      mcpProvider: active_provider.id,
      mcpProviderBadge: active_provider.badge,
      mcpToolCalls: [{ tool: 'create_card', status: 'ok', cardsInspected: created_ids.length }],
      responsibleCardIds: created_ids,
      suggestedFollowUps: [
        'Add TL;DR on top of this card',
        'Extract a checklist card from this note',
      ],
      timestamp: Date.now(),
    };

    aiChatMessagesSignal.value = [...aiChatMessagesSignal.value, user_msg, assistant_msg];
    aiCitedCardIdsSignal.value = created_ids;
    if (created_ids.length > 0) {
      focusCardFromAi(created_ids[0]);
    }
    return created_ids;
  } catch (err) {
    console.log(`[AI Debug] createCardWithAi (${cardType}) failed:`, err?.message || err, err);
    console.error('[createCardWithAi] Error:', err);
    showAiErrorModal(err, {
      status_code: err?.status,
      action_label: `Create ${cardType.toUpperCase()} Card with AI`,
      model_label: routed_model.full_name || routed_model.name,
    });
    return null;
  } finally {
    isAiLoadingSignal.value = false;
    fetch_ai_usage().catch(() => {});
  }
};

/**
 * Improves an Image Card prompt in-place using Muse Wonder (muse-wonder-1.0) with Gemini 3.8 Flash fallback
 */
export const improveImagePromptWithMuse = async (
  cardId,
  rawPrompt = '',
  options = {}
) => {
  const current_board = activeBoardSignal.value;
  if (!current_board) return null;
  const cards = current_board.cards || [];
  const target_card = cards.find((c) => c.id === cardId) || {
    id: cardId,
    type: 'image',
    title: 'Image Card',
  };

  const clean_prompt = String(rawPrompt || '').trim();
  if (clean_prompt) {
    const check = validate_and_sanitize_ai_question(clean_prompt);
    if (!check.allowed) {
      showAiErrorModal(
        {
          error: check.reason || 'Blocked by OWASP LLM Guard',
          securityBlocked: true,
          securityCode: check.code || 'LLM01_BLOCKED',
        },
        {
          status_code: 400,
          action_label: 'Improve Image Prompt',
          model_label: 'Meta Muse (muse-wonder-1.0)',
        }
      );
      return null;
    }
  }

  const raw_slides = Array.isArray(target_card.images) ? target_card.images : [];
  const active_slide_idx =
    options?.active_slide_index !== undefined
      ? Number(options.active_slide_index)
      : Math.max(
          0,
          Math.min(
            Number(target_card.active_slide_index) || 0,
            Math.max(0, raw_slides.length - 1)
          )
        );
  const active_slide_item = raw_slides[active_slide_idx];
  const active_slide_caption =
    typeof active_slide_item === 'object' && active_slide_item?.caption
      ? active_slide_item.caption
      : target_card.caption || '';

  try {
    console.log(
      `[AI Model Usage] Function: improveImagePromptWithMuse (Request) | Model: muse-wonder-1.0 (fallback: gemini-3-flash-preview / gemini-2.5-flash) | Quality: { reasoningEffort: "high", maxOutputTokens: 1024 } | UseReferenceImage: ${Boolean(options?.use_reference_image)}`
    );
    const resp = await fetch('/api/ai/card-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...get_lumen_auth_headers(),
      },
      body: JSON.stringify({
        action_type: 'image_improve_prompt',
        custom_instruction: clean_prompt,
        reasoning_strength: 'high',
        use_reference_image: Boolean(options?.use_reference_image),
        card: {
          id: target_card.id,
          type: 'image',
          title: target_card.title || '',
          caption: target_card.caption || '',
          active_slide_index: active_slide_idx,
          active_slide_caption,
          ai_prompt: target_card.ai_prompt || '',
          images: raw_slides.slice(0, 12),
        },
        board: {
          id: current_board.id,
          title: current_board.title,
        },
      }),
    });

    const parsed_resp = await parse_ai_response_json_safely(resp);
    if (!parsed_resp.ok || !parsed_resp.data) {
      console.log(
        `[AI Debug] improveImagePromptWithMuse HTTP ${parsed_resp.status} non-OK:`,
        parsed_resp.data || parsed_resp.rawText
      );
      const http_err = new Error(parsed_resp.data?.error || `Failed to improve prompt (${parsed_resp.status})`);
      http_err.status = parsed_resp.status;
      http_err.responsePayload = parsed_resp.data || {};
      throw http_err;
    }

    const data = parsed_resp.data;
    if (data.improvedPrompt) {
      console.log(
        `[AI Model Usage] Function: improveImagePromptWithMuse (Completed) | ModelUsed: muse-wonder-1.0 / gemini-3-flash-preview | Quality: { reasoningEffort: "high" }`
      );
      showToast('✨ Improved prompt with Muse Wonder');
      return {
        improvedPrompt: data.improvedPrompt,
        wonderDraft: data.wonderDraft || '',
        originalPrompt: data.originalPrompt || clean_prompt,
      };
    }
    return null;
  } catch (err) {
    console.log('[AI Debug] improveImagePromptWithMuse failed:', err?.message || err, err);
    console.error('[improveImagePromptWithMuse] Error:', err);
    showAiErrorModal(err, {
      status_code: err?.status,
      action_label: 'Improve Image Prompt',
      model_label: 'Meta Muse (muse-wonder-1.0)',
    });
    return null;
  }
};
