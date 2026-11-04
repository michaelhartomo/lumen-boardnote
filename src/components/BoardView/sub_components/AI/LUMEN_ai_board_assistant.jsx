import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Sparkles,
  X,
  Send,
  FileText,
  CheckSquare,
  Heading,
  Image as ImageIcon,
  Link2,
  Columns3,
  Quote,
  Share2,
  FolderKanban,
  ArrowRight,
  Compass,
  Boxes,
  Trash2,
  Cpu,
  Copy,
  Check,
  Activity,
  Terminal,
  ShieldCheck,
  Sliders,
  Play,
  Globe,
  Plus,
  Loader2,
} from 'lucide-react';

import styles from './LUMEN_ai_board_assistant.module.css';
import {
  isAiPanelOpenSignal,
  aiChatMessagesSignal,
  isAiLoadingSignal,
  isCardAiProcessingSignal,
  aiWorkingElapsedSecondsSignal,
  formatAiElapsedTime,
  aiPrefillPromptSignal,
  closeAiPanel,
  clearAiChat,
  askAiAboutBoard,
  focusCardFromAi,
  getCardAiActions,
  runAiCardAction,
  createCardWithAi,
  MCP_AI_PROVIDERS,
  mcpConfigSignal,
  isMcpConfigOpenSignal,
  isMcpTestingSignal,
  mcpLiveToolResultSignal,
  getActiveMcpProvider,
  toggleMcpConfigPanel,
  closeMcpConfigPanel,
  selectMcpProvider,
  updateMcpConfig,
  setProviderMcpEndpoint,
  buildMcpClientConfigSnippet,
  testMcpConnection,
  runMcpToolLiveTest,
} from '../../signals/aiState.js';
import {
  activeBoardSignal,
  selectedCardsSignal,
  clearCardSelection,
  showToast,
  ai_usage_signal,
  fetch_ai_usage,
} from '../../signals/boardState.js';
import { build_safe_board_context } from '../../utils/owasp_llm_guard.js';

const DEFAULT_QUICK_PROMPTS = [
  'Summarize this board and its key themes',
  'What are all pending or completed deliverables?',
  'Explain the visual and design direction',
  'Find any missing deliverables or open questions',
];

function get_card_icon(type) {
  switch (type) {
    case 'note':
      return FileText;
    case 'tasklist':
      return CheckSquare;
    case 'title':
      return Heading;
    case 'image':
      return ImageIcon;
    case 'link':
      return Link2;
    case 'column':
      return Columns3;
    case 'quote':
      return Quote;
    case 'social':
      return Share2;
    case 'board':
      return FolderKanban;
    default:
      return FileText;
  }
}

export default function LUMEN_ai_board_assistant({ on_ask_ai } = {}) {
  useSignals();

  const [input_text, set_input_text] = useState('');
  const [copied_key, set_copied_key] = useState('');
  const [is_create_card_open, set_is_create_card_open] = useState(false);
  const [is_ai_quota_open, set_is_ai_quota_open] = useState(false);
  const [new_card_type, set_new_card_type] = useState('note');
  const [new_card_prompt, set_new_card_prompt] = useState('');
  const chat_scroll_ref = useRef(null);
  const textarea_ref = useRef(null);

  const is_open = isAiPanelOpenSignal.value;
  const ai_usage = ai_usage_signal.value;
  const messages = aiChatMessagesSignal.value;
  const is_loading = isAiLoadingSignal.value;
  const is_card_ai_processing = Boolean(isCardAiProcessingSignal.value);
  const current_board = activeBoardSignal.value;
  const cards = current_board.cards || [];
  const selected_ids = selectedCardsSignal.value || [];
  const selected_cards = cards.filter((c) => selected_ids.includes(c.id));

  const mcp_cfg = mcpConfigSignal.value;
  const is_mcp_config_open = isMcpConfigOpenSignal.value;
  const is_mcp_testing = isMcpTestingSignal.value;
  const live_tool_result = mcpLiveToolResultSignal.value;
  const active_provider = getActiveMcpProvider();

  const board_id = current_board?.id || 'board_moodboard';
  const current_user_account = current_board?.user_account || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const sse_endpoint = `${origin}/api/mcp/sse?board_id=${encodeURIComponent(board_id)}${current_user_account ? `&user_account=${encodeURIComponent(current_user_account)}` : ''}`;
  const rpc_endpoint = `${origin}/api/mcp`;
  const config_json_snippet = buildMcpClientConfigSnippet(active_provider.id, board_id);
  const current_ext_url = mcp_cfg?.provider_endpoints?.[active_provider.id] || '';

  // Dynamic quick prompts based on whether cards are currently multi-selected
  const is_single_stock = selected_ids.length === 1 && selected_cards[0]?.type === 'stock';
  const stock_symbol = is_single_stock ? (selected_cards[0]?.symbol || 'MAPI.JK') : '';

  const quick_prompts = selected_ids.length > 1
    ? [
        `Synthesize and summarize the ${selected_ids.length} selected cards`,
        'Find connections and thematic patterns between selected cards',
        'Extract action items and deliverables from these selected cards',
        'Compare perspectives and identify gaps across selected cards',
      ]
    : is_single_stock
    ? [
        `Analyze ticker symbol "${stock_symbol}": market performance & outlook`,
        `Evaluate valuation metrics and historical range for ${stock_symbol}`,
        `What are key drivers and risk factors for ticker ${stock_symbol}?`,
        'Summarize this board and its key themes',
      ]
    : selected_ids.length === 1
    ? [
        `Explain and analyze details for "${selected_cards[0]?.title || 'selected card'}"`,
        `Suggest complementary ideas or follow-ups for this card`,
        ...DEFAULT_QUICK_PROMPTS.slice(0, 2),
      ]
    : DEFAULT_QUICK_PROMPTS;

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    if (chat_scroll_ref.current && !is_mcp_config_open) {
      chat_scroll_ref.current.scrollTop = chat_scroll_ref.current.scrollHeight;
    }
  }, [messages, is_loading, is_mcp_config_open]);

  // Sync prefill prompt and fetch latest AI usage when panel opens
  useEffect(() => {
    if (is_open) {
      fetch_ai_usage(board_id);
      if (aiPrefillPromptSignal.value) {
        set_input_text(aiPrefillPromptSignal.value);
        aiPrefillPromptSignal.value = '';
      }
      if (textarea_ref.current && !is_mcp_config_open) {
        setTimeout(() => textarea_ref.current?.focus(), 150);
      }
    }
  }, [is_open, is_mcp_config_open, board_id]);

  if (!is_open) return null;

  const handle_copy_text = async (key_id, text_val, label = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text_val);
      set_copied_key(key_id);
      showToast(label);
      setTimeout(() => {
        set_copied_key((prev) => (prev === key_id ? '' : prev));
      }, 2000);
    } catch (_) {
      showToast('Copy failed');
    }
  };

  const handle_copy_mcp_context_bundle = () => {
    const { board_summary, selected_cards_data } = build_safe_board_context(current_board, selected_ids);
    const bundle = [
      `# Lumen Workspace MCP Context (${active_provider.label})`,
      `Board: ${board_summary.title || 'Workspace'} (ID: ${board_summary.id})`,
      `MCP Server SSE: ${sse_endpoint}`,
      `MCP Server JSON-RPC: ${rpc_endpoint}`,
      selected_cards_data.length > 0
        ? `\n## Focused Cards (${selected_cards_data.length})\n\`\`\`json\n${JSON.stringify(selected_cards_data, null, 2)}\n\`\`\``
        : '',
      `\n## Board Cards Digest (${(board_summary.cards || []).length} cards, OWASP Zero-Leak Sanitized)\n\`\`\`json\n${JSON.stringify(board_summary.cards || [], null, 2)}\n\`\`\``,
    ]
      .filter(Boolean)
      .join('\n');

    handle_copy_text(
      'mcp_bundle',
      bundle,
      `Copied ${active_provider.name} MCP context bundle`
    );
  };

  const handle_submit = async (e) => {
    if (e) e.preventDefault();
    if (!input_text.trim() || is_loading) return;
    if (is_mcp_config_open) {
      closeMcpConfigPanel();
    }
    const text_to_send = input_text;
    set_input_text('');
    askAiAboutBoard(text_to_send, selected_ids.length > 0 ? selected_ids : null, on_ask_ai);
  };

  const handle_key_down = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handle_submit();
    }
  };

  const handle_click_quick_prompt = (prompt_text) => {
    if (is_mcp_config_open) {
      closeMcpConfigPanel();
    }
    askAiAboutBoard(prompt_text, selected_ids.length > 0 ? selected_ids : null, on_ask_ai);
  };

  const handle_clear_chat_click = () => {
    clearAiChat();
    set_input_text('');
  };

  return (
    <aside className={styles['lumen-ai-drawer']} aria-label="Lumen Board AI Co-Pilot">
      {/* Drawer Header */}
      <div className={styles['lumen-ai-header']}>
        <div className={styles['lumen-ai-header-top']}>
          <div className={styles['lumen-ai-header-left']}>
            <div
              className={`${styles['lumen-ai-sparkle-icon']} ${
                is_loading || is_card_ai_processing ? styles['lumen-ai-sparkle-icon-working'] : ''
              }`}
              style={{
                background: `linear-gradient(135deg, ${active_provider.color} 0%, #2563eb 100%)`,
              }}
            >
              {is_loading || is_card_ai_processing ? (
                <Loader2 size={16} className={styles['lumen-ai-spin']} />
              ) : (
                <Sparkles size={16} />
              )}
            </div>
            <div className={styles['lumen-ai-title-wrap']}>
              <div className={styles['lumen-ai-title']}>Board Intelligence</div>
              <div className={styles['lumen-ai-subtitle']}>
                <span className={styles['lumen-ai-board-name']}>
                  {current_board.title || 'Workspace'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles['lumen-ai-header-actions']}>
            {messages.length > 0 && !is_mcp_config_open && (
              <button
                type="button"
                className={styles['lumen-ai-btn-clear']}
                onClick={handle_clear_chat_click}
                title="Clear all messages in chat history"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              type="button"
              className={styles['lumen-ai-btn-icon']}
              onClick={closeAiPanel}
              title="Close Assistant"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className={styles['lumen-ai-header-mcp-row']}>
          <button
            type="button"
            className={`${styles['lumen-ai-btn-mcp']} ${
              is_mcp_config_open ? styles['lumen-ai-btn-mcp-active'] : ''
            }`}
            onClick={() => {
              set_is_ai_quota_open(false);
              toggleMcpConfigPanel();
            }}
            title="Bring Your Own AI through Model Context Protocol (Gemini, ChatGPT, Claude, Grok, Muse)"
          >
            <Sliders size={12} />
            <span>BYO AI (MCP)</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-ai-btn-create-card']} ${
              is_create_card_open ? styles['lumen-ai-btn-create-card-active'] : ''
            }`}
            onClick={() => {
              if (is_mcp_config_open) closeMcpConfigPanel();
              set_is_ai_quota_open(false);
              set_is_create_card_open(!is_create_card_open);
            }}
            title="Generate a new card on the board with AI"
          >
            <Plus size={12} />
            <span>AI Create Card</span>
          </button>
        </div>

        {is_create_card_open && !is_mcp_config_open && (
          <form
            className={styles['lumen-ai-create-card-box']}
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = new_card_prompt.trim();
              if (!trimmed || is_card_ai_processing) return;
              set_new_card_prompt('');
              set_is_create_card_open(false);
              await createCardWithAi(new_card_type, trimmed);
            }}
          >
            <div className={styles['lumen-ai-create-type-row']}>
              {[
                { id: 'note', label: 'Note' },
                { id: 'tasklist', label: 'Checklist' },
                { id: 'heading', label: 'Heading' },
                { id: 'quote', label: 'Quote' },
                { id: 'palette', label: 'Palette' },
                { id: 'stock', label: 'Stock' },
              ].map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  className={`${styles['lumen-ai-create-type-pill']} ${
                    new_card_type === ct.id ? styles['lumen-ai-create-type-pill-active'] : ''
                  }`}
                  onClick={() => set_new_card_type(ct.id)}
                >
                  {ct.label}
                </button>
              ))}
            </div>
            <div className={styles['lumen-ai-create-input-row']}>
              <input
                type="text"
                className={styles['lumen-ai-create-input']}
                value={new_card_prompt}
                onChange={(e) => set_new_card_prompt(e.target.value.slice(0, 300))}
                placeholder={`Topic or prompt for new ${new_card_type} card...`}
              />
              <button
                type="submit"
                disabled={!new_card_prompt.trim() || is_card_ai_processing}
                className={styles['lumen-ai-create-submit']}
              >
                {is_card_ai_processing ? (
                  <Loader2 size={13} className={styles['lumen-ai-spin']} />
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bring Your Own AI (MCP) Configuration & Live Inspector View */}
      {is_mcp_config_open ? (
        <div className={styles['lumen-mcp-config-body']}>
          <div className={styles['lumen-mcp-hero-card']}>
            <div className={styles['lumen-mcp-hero-top']}>
              <div className={styles['lumen-mcp-hero-title-group']}>
                <div className={styles['lumen-mcp-hero-title']}>
                  Bring Your Own AI via MCP
                </div>
                <div className={styles['lumen-mcp-hero-subtitle']}>
                  Model Context Protocol (v2024-11-05) • OWASP Top 10 Guarded
                </div>
              </div>
              <button
                type="button"
                className={styles['lumen-mcp-close-sub']}
                onClick={closeMcpConfigPanel}
              >
                Back to Chat
              </button>
            </div>

            <div className={styles['lumen-mcp-provider-grid']}>
              {MCP_AI_PROVIDERS.map((prov) => {
                const is_selected = prov.id === active_provider.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    className={`${styles['lumen-mcp-provider-pill']} ${
                      is_selected ? styles['lumen-mcp-provider-pill-active'] : ''
                    }`}
                    style={
                      is_selected
                        ? {
                            backgroundColor: prov.bgLight,
                            borderColor: prov.color,
                            color: prov.color,
                          }
                        : undefined
                    }
                    onClick={() => selectMcpProvider(prov.id)}
                    title={`Use ${prov.label} — ${prov.tagline}`}
                  >
                    <span
                      className={styles['lumen-mcp-provider-dot']}
                      style={{ backgroundColor: prov.color }}
                    />
                    <span>{prov.name}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles['lumen-mcp-active-banner']} style={{ borderColor: active_provider.borderLight, backgroundColor: active_provider.bgLight }}>
              <div className={styles['lumen-mcp-active-provider-name']} style={{ color: active_provider.color }}>
                <Cpu size={14} />
                <span>{active_provider.label}</span>
                <span className={styles['lumen-mcp-transport-pill']}>{active_provider.transport_label}</span>
              </div>
              <div className={styles['lumen-mcp-active-provider-desc']}>
                {active_provider.tagline}
              </div>
            </div>
          </div>

          {/* Connection Mode Selector */}
          <div className={styles['lumen-mcp-section']}>
            <div className={styles['lumen-mcp-section-label']}>MCP Connection Mode</div>
            <div className={styles['lumen-mcp-mode-tabs']}>
              <button
                type="button"
                className={`${styles['lumen-mcp-mode-tab']} ${
                  mcp_cfg.connection_mode !== 'external_bridge' ? styles['lumen-mcp-mode-tab-active'] : ''
                }`}
                onClick={() => updateMcpConfig({ connection_mode: 'host_server' })}
              >
                <Terminal size={13} />
                <span>Connect {active_provider.name} to Lumen</span>
              </button>
              <button
                type="button"
                className={`${styles['lumen-mcp-mode-tab']} ${
                  mcp_cfg.connection_mode === 'external_bridge' ? styles['lumen-mcp-mode-tab-active'] : ''
                }`}
                onClick={() => updateMcpConfig({ connection_mode: 'external_bridge' })}
              >
                <Globe size={13} />
                <span>External MCP Bridge URL</span>
              </button>
            </div>
          </div>

          {mcp_cfg.connection_mode !== 'external_bridge' ? (
            <>
              {/* Mode A: Connect External AI App (Gemini, ChatGPT, Claude, Grok, Muse) to Lumen MCP Server */}
              <div className={styles['lumen-mcp-section']}>
                <div className={styles['lumen-mcp-section-header']}>
                  <span className={styles['lumen-mcp-section-label']}>
                    Lumen MCP Endpoints for {active_provider.name}
                  </span>
                  <span className={styles['lumen-mcp-status-online']}>● 10 Tools Ready</span>
                </div>

                <div className={styles['lumen-mcp-endpoint-box']}>
                  <div className={styles['lumen-mcp-endpoint-row']}>
                    <div className={styles['lumen-mcp-endpoint-meta']}>
                      <span className={styles['lumen-mcp-endpoint-tag']}>SSE</span>
                      <code className={styles['lumen-mcp-endpoint-code']}>{sse_endpoint}</code>
                    </div>
                    <button
                      type="button"
                      className={styles['lumen-mcp-copy-btn']}
                      onClick={() => handle_copy_text('sse_url', sse_endpoint, 'Copied MCP SSE URL')}
                      title="Copy SSE URL"
                    >
                      {copied_key === 'sse_url' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>

                  <div className={styles['lumen-mcp-endpoint-row']}>
                    <div className={styles['lumen-mcp-endpoint-meta']}>
                      <span className={styles['lumen-mcp-endpoint-tag']}>RPC</span>
                      <code className={styles['lumen-mcp-endpoint-code']}>{rpc_endpoint}</code>
                    </div>
                    <button
                      type="button"
                      className={styles['lumen-mcp-copy-btn']}
                      onClick={() => handle_copy_text('rpc_url', rpc_endpoint, 'Copied MCP JSON-RPC URL')}
                      title="Copy JSON-RPC 2.0 URL"
                    >
                      {copied_key === 'rpc_url' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Ready-to-Paste MCP Config JSON for Selected Provider */}
              <div className={styles['lumen-mcp-section']}>
                <div className={styles['lumen-mcp-section-header']}>
                  <span className={styles['lumen-mcp-section-label']}>
                    {active_provider.name} Config ({active_provider.config_file})
                  </span>
                  <button
                    type="button"
                    className={styles['lumen-mcp-copy-inline']}
                    onClick={() =>
                      handle_copy_text(
                        'config_json',
                        config_json_snippet,
                        `Copied ${active_provider.name} MCP config JSON`
                      )
                    }
                  >
                    {copied_key === 'config_json' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied_key === 'config_json' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className={styles['lumen-mcp-code-pre']}>{config_json_snippet}</pre>
                <button
                  type="button"
                  className={styles['lumen-mcp-bundle-btn']}
                  onClick={handle_copy_mcp_context_bundle}
                >
                  <Copy size={13} />
                  <span>Copy Sanitized Board Context Prompt for {active_provider.name}</span>
                </button>
              </div>
            </>
          ) : (
            /* Mode B: External MCP Bridge URL */
            <div className={styles['lumen-mcp-section']}>
              <div className={styles['lumen-mcp-section-header']}>
                <span className={styles['lumen-mcp-section-label']}>
                  {active_provider.name} MCP Bridge Endpoint URL
                </span>
              </div>
              <div className={styles['lumen-mcp-field-help']}>
                Point Lumen to your self-hosted or local {active_provider.name} MCP JSON-RPC 2.0 server. Board queries will be dispatched via <code>sampling/createMessage</code> with OWASP sanitization.
              </div>
              <input
                type="url"
                value={current_ext_url}
                onChange={(e) => setProviderMcpEndpoint(active_provider.id, e.target.value)}
                placeholder={`https://your-${active_provider.id}-mcp-bridge.local/mcp`}
                className={styles['lumen-mcp-url-input']}
              />
              <label className={styles['lumen-mcp-checkbox-row']}>
                <input
                  type="checkbox"
                  checked={Boolean(mcp_cfg.read_only_guard)}
                  onChange={(e) => updateMcpConfig({ read_only_guard: e.target.checked })}
                />
                <ShieldCheck size={14} color="#10b981" />
                <span>OWASP LLM08 Guard: Enforce Read-Only Board Context</span>
              </label>
            </div>
          )}

          {/* Live MCP Handshake & Tool Sandbox */}
          <div className={styles['lumen-mcp-section']}>
            <div className={styles['lumen-mcp-section-header']}>
              <span className={styles['lumen-mcp-section-label']}>
                Live MCP Server Handshake & Tool Sandbox
              </span>
              <button
                type="button"
                className={styles['lumen-mcp-ping-btn']}
                onClick={testMcpConnection}
                disabled={is_mcp_testing}
              >
                <Activity size={12} />
                <span>{is_mcp_testing ? 'Testing...' : 'Test Handshake'}</span>
              </button>
            </div>

            {mcp_cfg.last_ping_status && (
              <div
                className={`${styles['lumen-mcp-ping-status']} ${
                  mcp_cfg.last_ping_status.ok
                    ? styles['lumen-mcp-ping-ok']
                    : styles['lumen-mcp-ping-warn']
                }`}
              >
                <span>{mcp_cfg.last_ping_status.message}</span>
              </div>
            )}

            <div className={styles['lumen-mcp-tools-grid']}>
              <button
                type="button"
                className={styles['lumen-mcp-tool-btn']}
                onClick={() => runMcpToolLiveTest('get_board_summary')}
                disabled={is_mcp_testing}
              >
                <Play size={11} />
                <span>get_board_summary</span>
              </button>
              <button
                type="button"
                className={styles['lumen-mcp-tool-btn']}
                onClick={() => runMcpToolLiveTest('list_boards')}
                disabled={is_mcp_testing}
              >
                <Play size={11} />
                <span>list_boards</span>
              </button>
              <button
                type="button"
                className={styles['lumen-mcp-tool-btn']}
                onClick={() => runMcpToolLiveTest('search_cards')}
                disabled={is_mcp_testing}
              >
                <Play size={11} />
                <span>search_cards</span>
              </button>
            </div>

            {live_tool_result && (
              <div className={styles['lumen-mcp-tool-output-wrap']}>
                <div className={styles['lumen-mcp-tool-output-header']}>
                  <span>JSON-RPC 2.0 Output: {live_tool_result.tool}</span>
                  <button
                    type="button"
                    className={styles['lumen-mcp-copy-inline']}
                    onClick={() => {
                      mcpLiveToolResultSignal.value = null;
                    }}
                  >
                    Clear
                  </button>
                </div>
                <pre className={styles['lumen-mcp-code-pre']}>{live_tool_result.output}</pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Chat Messages Body */
        <div ref={chat_scroll_ref} className={styles['lumen-ai-body']}>
          {/* Selected Cards Context Banner */}
          {selected_cards.length > 0 && (
            <div className={styles['lumen-ai-focus-banner']}>
              <div className={styles['lumen-ai-focus-title']}>
                <div className={styles['lumen-ai-focus-title-left']}>
                  <Boxes size={13} />
                  <span>
                    Focusing on {selected_cards.length} selected card
                    {selected_cards.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles['lumen-ai-btn-icon']}
                  onClick={clearCardSelection}
                  title="Clear card focus selection"
                >
                  <X size={12} />
                </button>
              </div>
              <div className={styles['lumen-ai-focus-chips']}>
                {selected_cards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles['lumen-ai-focus-chip']}
                    onClick={() => focusCardFromAi(c.id)}
                    title={`Focus canvas on ${c.title || c.type}`}
                  >
                    {c.title || `${c.type} card`}
                  </button>
                ))}
              </div>

              {selected_cards.length === 1 && (
                <div className={styles['lumen-ai-card-actions-wrap']}>
                  <div className={styles['lumen-ai-card-actions-label']}>
                    <Sparkles size={11} />
                    <span>
                      AI Actions for {selected_cards[0].type} card (Modify, Analyze, Create):
                    </span>
                  </div>
                  <div className={styles['lumen-ai-card-actions-grid']}>
                    {getCardAiActions(selected_cards[0].type).map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        disabled={is_card_ai_processing || is_loading}
                        className={`${styles['lumen-ai-card-action-pill']} ${
                          styles[`lumen-ai-card-action-${act.category || 'analyze'}`]
                        }`}
                        onClick={() => runAiCardAction(selected_cards[0].id, act.id)}
                        title={act.description}
                      >
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.length === 0 ? (
            <div className={styles['lumen-ai-empty-state']}>
              <div
                className={styles['lumen-ai-empty-badge']}
                style={{
                  backgroundColor: active_provider.bgLight,
                  color: active_provider.color,
                }}
              >
                <Compass size={22} />
              </div>
              <div className={styles['lumen-ai-empty-title']}>
                {selected_cards.length > 1
                  ? `Analyze ${selected_cards.length} Cards with ${active_provider.name}`
                  : `Ask ${active_provider.name} (MCP) about this board`}
              </div>
              <div className={styles['lumen-ai-empty-desc']}>
                {selected_cards.length > 1
                  ? `${active_provider.label} evaluates and correlates your selected cards via Model Context Protocol, extracting relationships, tasks, and summaries.`
                  : `${active_provider.label} inspects notes, checklists, imagery, and links via Model Context Protocol (MCP) with OWASP Top 10 protection.`}
              </div>

              <div className={styles['lumen-ai-quick-starters']}>
                {quick_prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className={styles['lumen-ai-quick-btn']}
                    onClick={() => handle_click_quick_prompt(prompt)}
                  >
                    <span>{prompt}</span>
                    <ArrowRight size={13} opacity={0.6} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={msg.id}
                    className={`${styles['lumen-ai-message']} ${styles['lumen-ai-message-user']}`}
                  >
                    <div className={styles['lumen-ai-user-bubble']}>{msg.text}</div>
                  </div>
                );
              }

              // Assistant message
              const cited_cards = (msg.responsibleCardIds || [])
                .map((id) => cards.find((c) => c.id === id))
                .filter(Boolean);
              const msg_provider =
                MCP_AI_PROVIDERS.find((p) => p.id === msg.mcpProvider) || active_provider;
              const tool_calls = Array.isArray(msg.mcpToolCalls) ? msg.mcpToolCalls : [];

              return (
                <div
                  key={msg.id}
                  className={`${styles['lumen-ai-message']} ${styles['lumen-ai-message-assistant']}`}
                >
                  {/* MCP Provider & Tool Call Trace Header */}
                  <div className={styles['lumen-ai-msg-meta-row']}>
                    <span
                      className={styles['lumen-ai-msg-provider-badge']}
                      style={{
                        backgroundColor: msg_provider.bgLight,
                        color: msg_provider.color,
                        borderColor: msg_provider.borderLight,
                      }}
                    >
                      <Cpu size={10} />
                      <span>{msg.mcpProviderBadge || msg_provider.badge}</span>
                    </span>
                    {tool_calls.map((tc, idx) => (
                      <span
                        key={`${tc.tool}_${idx}`}
                        className={styles['lumen-ai-msg-tool-chip']}
                        title={`MCP tool executed: ${tc.tool}`}
                      >
                        ⚡ {tc.tool}
                      </span>
                    ))}
                  </div>

                  <div
                    className={`${styles['lumen-ai-assistant-bubble']} ${
                      msg.isError ? styles['lumen-ai-assistant-error'] : ''
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Responsible Cards Cited by AI */}
                  {cited_cards.length > 0 && (
                    <div className={styles['lumen-ai-cards-section']}>
                      <div className={styles['lumen-ai-cards-header']}>
                        <span>Responsible Cards ({cited_cards.length})</span>
                      </div>
                      <div className={styles['lumen-ai-chips-list']}>
                        {cited_cards.map((c) => {
                          const IconComponent = get_card_icon(c.type);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={styles['lumen-ai-card-chip']}
                              onClick={() => focusCardFromAi(c.id)}
                              title={`Fly to & focus "${c.title || c.type}" card`}
                            >
                              <IconComponent size={13} color="#2563eb" />
                              <span>{c.title || c.type}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggested Follow-up Questions */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className={styles['lumen-ai-followups-list']}>
                      {msg.suggestedFollowUps.map((followup, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={styles['lumen-ai-followup-item']}
                          onClick={() => handle_click_quick_prompt(followup)}
                        >
                          <ArrowRight size={11} />
                          <span>{followup}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading / Working Indicator */}
          {(is_loading || is_card_ai_processing) && (
            <div className={styles['lumen-ai-loading-wrap']}>
              <div className={styles['lumen-ai-loading-top']}>
                <span
                  className={styles['lumen-ai-loading-orb']}
                  style={{ backgroundColor: active_provider.bgLight, color: active_provider.color }}
                >
                  <Loader2 size={15} className={styles['lumen-ai-spin']} />
                </span>
                <Sparkles
                  size={13}
                  color={active_provider.color}
                  className={styles['lumen-ai-twinkle']}
                />
                <span className={styles['lumen-ai-loading-text']}>
                  {is_card_ai_processing
                    ? `${active_provider.badge}: executing Card AI action`
                    : `${active_provider.badge}: running MCP tools & synthesizing`}
                </span>
                <span className={styles['lumen-ai-typing-dots']} aria-hidden="true">
                  <span style={{ backgroundColor: active_provider.color }} />
                  <span style={{ backgroundColor: active_provider.color }} />
                  <span style={{ backgroundColor: active_provider.color }} />
                </span>
                <span
                  className={styles['lumen-ai-loading-timer']}
                  style={{
                    backgroundColor: active_provider.bgLight,
                    color: active_provider.color,
                    borderColor: active_provider.borderLight,
                  }}
                  title="AI elapsed running time"
                >
                  {formatAiElapsedTime(aiWorkingElapsedSecondsSignal.value)}
                </span>
              </div>
              <div className={styles['lumen-ai-shimmer-track']}>
                <div
                  className={styles['lumen-ai-shimmer-bar']}
                  style={{
                    background: `linear-gradient(90deg, ${active_provider.color} 0%, #2563eb 50%, ${active_provider.color} 100%)`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Input */}
      <div className={styles['lumen-ai-footer']}>
        <form onSubmit={handle_submit} className={styles['lumen-ai-input-form']}>
          <textarea
            ref={textarea_ref}
            value={input_text}
            onChange={(e) => set_input_text(e.target.value.slice(0, 1000))}
            onKeyDown={handle_key_down}
            maxLength={1000}
            placeholder={
              selected_cards.length === 1
                ? `Ask ${active_provider.name} about "${selected_cards[0]?.title || 'selected card'}"...`
                : selected_cards.length > 1
                ? `Ask ${active_provider.name} about these ${selected_cards.length} selected cards...`
                : `Ask ${active_provider.name} (MCP) about this board's cards, goals, or notes...`
            }
            rows={1}
            className={styles['lumen-ai-textarea']}
          />
          <button
            type="submit"
            disabled={!input_text.trim() || is_loading}
            className={styles['lumen-ai-send-btn']}
            style={{ backgroundColor: active_provider.color }}
            title={`Ask ${active_provider.label}`}
          >
            {is_loading ? (
              <Loader2 size={15} className={styles['lumen-ai-spin']} />
            ) : (
              <Send size={15} />
            )}
          </button>
        </form>
        <div className={styles['lumen-ai-hint']}>
          {active_provider.badge} • OWASP LLM Guard Active • Grounded in board cards
        </div>
      </div>
    </aside>
  );
}
