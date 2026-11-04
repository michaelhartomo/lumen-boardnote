#!/usr/bin/env node
/**
 * Lumen Board - Model Context Protocol (MCP) Stdio Server
 * 
 * Enables connecting AI agents (Claude Desktop, Cursor IDE, Windsurf, ChatGPT,
 * Gemini, Muse, and custom LLM agents) to your Lumen Workspace board.
 * 
 * Standard I/O (stdio) transport: runs directly inside Claude Desktop, Cursor, etc.
 * 
 * Configuration Example for Claude Desktop (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "lumen-board": {
 *       "command": "node",
 *       "args": ["/ABSOLUTE/PATH/TO/scripts/lumen-mcp-server.js"],
 *       "env": {
 *         "LUMEN_API_URL": "http://localhost:3000"
 *       }
 *     }
 *   }
 * }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLumenMcpServer } from '../server/mcp/lumen_mcp_core.js';

const resolved_port =
  process.env.LUMEN_PORT || process.env.SERVER_PORT || process.env.PORT || '3000';
const LUMEN_API_URL = (
  process.env.LUMEN_API_URL || `http://localhost:${resolved_port}`
).replace(/\/+$/, '');
const LUMEN_USER_ACCOUNT = (process.env.LUMEN_USER_ACCOUNT || '').trim();
const LUMEN_VENDOR_CODE = (process.env.LUMEN_VENDOR_CODE || '').trim();
const LUMEN_MASTER_CODE = (process.env.LUMEN_MASTER_CODE || '').trim();
const LUMEN_PROJECT_CODE = (process.env.LUMEN_PROJECT_CODE || '').trim();
const LUMEN_AUTH_TOKEN = (process.env.LUMEN_AUTH_TOKEN || '').trim();
const LUMEN_READ_ONLY = process.env.LUMEN_READ_ONLY === 'true' || process.env.LUMEN_READ_ONLY === '1';

let current_active_board_id = (process.env.LUMEN_BOARD_ID || '').trim() || null;

function build_lumen_auth_headers() {
  const headers = {};
  if (LUMEN_USER_ACCOUNT) headers['X-Lumen-User-Account'] = LUMEN_USER_ACCOUNT;
  if (LUMEN_VENDOR_CODE) headers['X-Lumen-Vendor-Code'] = LUMEN_VENDOR_CODE;
  if (LUMEN_MASTER_CODE) headers['X-Lumen-Master-Code'] = LUMEN_MASTER_CODE;
  if (LUMEN_PROJECT_CODE) headers['X-Lumen-Project-Code'] = LUMEN_PROJECT_CODE;
  if (LUMEN_AUTH_TOKEN) headers['Authorization'] = `Bearer ${LUMEN_AUTH_TOKEN}`;
  if (LUMEN_USER_ACCOUNT || LUMEN_VENDOR_CODE || LUMEN_MASTER_CODE || LUMEN_PROJECT_CODE) {
    headers['X-Lumen-Auth'] = JSON.stringify({
      user_account: LUMEN_USER_ACCOUNT || null,
      vendor_code: LUMEN_VENDOR_CODE || null,
      master_code: LUMEN_MASTER_CODE || null,
      project_code: LUMEN_PROJECT_CODE || null,
    });
  }
  return headers;
}

// Fetch helper with user-scoped authentication headers (public boards work for everyone; private boards require owner auth)
async function api_request(path, options = {}) {
  const url = `${LUMEN_API_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...build_lumen_auth_headers(),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err_json = await res.json();
        if (err_json?.error) detail = err_json.error;
      } catch {}
      throw new Error(`HTTP ${res.status}: ${detail}`);
    }
    return await res.json();
  } catch (err) {
    throw new Error(`Failed to communicate with Lumen server at ${url}: ${err.message}`);
  }
}

// Adapter bridging MCP tools to Lumen Board backend (public boards accessible to everyone, private boards owner-only)
const adapter = {
  isReadOnly: () => LUMEN_READ_ONLY,
  getActiveBoardId: () => current_active_board_id,
  setActiveBoardId: (id) => { current_active_board_id = id; },

  getBoards: async () => {
    try {
      const q = LUMEN_USER_ACCOUNT
        ? `?user_account=${encodeURIComponent(LUMEN_USER_ACCOUNT)}&include_public=true`
        : '?include_public=true';
      const data = await api_request(`/api/boards${q}`);
      return data.boards || [];
    } catch (e) {
      return [];
    }
  },

  getBoard: async (boardId) => {
    const id = boardId || current_active_board_id;
    if (!id) return null;
    const q = LUMEN_USER_ACCOUNT ? `?user_account=${encodeURIComponent(LUMEN_USER_ACCOUNT)}` : '';
    const data = await api_request(`/api/boards/${encodeURIComponent(id)}${q}`);
    return data.board || null;
  },

  saveBoard: async (boardId, boardData) => {
    if (LUMEN_READ_ONLY) throw new Error('MCP server is in read-only mode.');
    const id = boardId || current_active_board_id;
    if (!id) return false;
    await api_request(`/api/boards/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ board: boardData, ...(LUMEN_USER_ACCOUNT ? { user_account: LUMEN_USER_ACCOUNT } : {}) }),
    });
    return true;
  },

  getCard: async (cardId, boardId) => {
    const id = boardId || current_active_board_id;
    if (!id) return null;
    const board = await adapter.getBoard(id);
    const cards = Array.isArray(board?.cards) ? board.cards : (Array.isArray(board?.board_card) ? board.board_card : []);
    return cards.find((c) => c.id === cardId) || null;
  },

  saveCard: async (cardId, patch, boardId) => {
    if (LUMEN_READ_ONLY) throw new Error('MCP server is in read-only mode.');
    const id = boardId || current_active_board_id;
    if (!id) return false;
    await api_request(`/api/cards/${encodeURIComponent(cardId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ board_id: id, user_account: LUMEN_USER_ACCOUNT, ...patch }),
    });
    return true;
  },

  deleteCard: async (cardId, boardId) => {
    if (LUMEN_READ_ONLY) throw new Error('MCP server is in read-only mode.');
    const id = boardId || current_active_board_id;
    if (!id) return false;
    const board = await adapter.getBoard(id);
    if (!board) return false;
    const cards = (board.cards || []).filter((c) => c.id !== cardId);
    board.cards = cards;
    board.board_card = cards;
    await adapter.saveBoard(id, board);
    return true;
  },

  getComments: async (cardId, boardId) => {
    try {
      const id = boardId || current_active_board_id;
      if (id) {
        const card = await adapter.getCard(cardId, id);
        if (!card) throw new Error('Card not found on accessible board');
      }
      const data = await api_request(`/api/comments/${encodeURIComponent(cardId)}`);
      return data.comments || [];
    } catch {
      return [];
    }
  },

  addComment: async (cardId, text, userName = 'AI Collaborator (MCP)', boardId) => {
    if (LUMEN_READ_ONLY) throw new Error('MCP server is in read-only mode.');
    const id = boardId || current_active_board_id;
    const data = await api_request(`/api/comments/${encodeURIComponent(cardId)}`, {
      method: 'POST',
      body: JSON.stringify({
        board_id: id,
        user_account: LUMEN_USER_ACCOUNT,
        text,
        user: {
          id: 'user_ai_mcp',
          name: userName,
          avatar: '🤖',
          color: '#8b5cf6',
          role: 'AI Assistant',
        },
      }),
    });
    return data.comment || data;
  },
};

async function main() {
  const mcp_server = createLumenMcpServer(adapter);
  const transport = new StdioServerTransport();

  // Log transport connection to stderr so it doesn't corrupt stdout JSON-RPC stream
  process.stderr.write(`[Lumen MCP] Connecting Stdio transport (target: ${LUMEN_API_URL}, user: ${LUMEN_USER_ACCOUNT || 'unauthenticated'})...\n`);

  await mcp_server.connect(transport);

  process.stderr.write('[Lumen MCP] Server running on stdio. Ready to receive commands from Claude/Cursor/etc.\n');
}

main().catch((err) => {
  process.stderr.write(`[Lumen MCP Fatal Error] ${err.stack || err.message}\n`);
  process.exit(1);
});
