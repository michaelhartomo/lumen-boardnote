import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Sanitizes cards to ensure zero leak of encrypted cards.
 * If a card is encrypted, ciphertext is preserved but all plaintext fields are cleared.
 */
export function sanitize_card_for_mcp(card) {
  if (!card) return null;
  const enc = card.card_encryption || card.cardEncryption || card.encryption;
  const is_encrypted = Boolean(
    enc && (
      (typeof enc === 'object' && enc.ciphertext) ||
      (typeof enc === 'string' && enc.includes('ciphertext'))
    )
  );
  const c_id = card.card_code || card.id;
  const c_type = card.card_type || card.type || 'note';
  const c_title = card.card_name || card.title || '';

  if (is_encrypted) {
    return {
      id: c_id,
      card_code: c_id,
      type: c_type,
      card_type: c_type,
      title: c_title || 'Encrypted Card',
      card_name: c_title || 'Encrypted Card',
      is_encrypted: true,
      encryption_hint: enc.passkey_hint || enc.hint || 'Password protected',
      content: '[ENCRYPTED CONTENT - ZERO LEAK PROTECTION ACTIVE. Enter passkey in Lumen UI to unlock]',
      x: card.x ?? card.pos_x ?? 0,
      y: card.y ?? card.pos_y ?? 0,
      width: card.width || 280,
      height: card.height || 200,
      color: card.color || 'blue',
      updatedAt: card.updatedAt || card.time_modify || card.time_modified || Date.now(),
    };
  }

  return {
    id: c_id,
    card_code: c_id,
    type: c_type,
    card_type: c_type,
    title: c_title,
    card_name: c_title,
    content: card.content !== undefined ? String(card.content) : (card.data?.content || card.card_data?.content || ''),
    description: card.description || card.data?.description || card.card_data?.description || '',
    color: card.color || 'yellow',
    x: card.x ?? card.pos_x ?? 0,
    y: card.y ?? card.pos_y ?? 0,
    width: card.width || 280,
    height: card.height || 200,
    zIndex: card.zIndex || card.z_index || 1,
    items: Array.isArray(card.items) ? card.items : (Array.isArray(card.data?.items) ? card.data.items : []),
    url: card.url || card.data?.url || '',
    notes: card.notes || card.data?.notes || '',
    is_encrypted: false,
    updatedAt: card.updatedAt || card.time_modify || card.time_modified || Date.now(),
  };
}

/**
 * Unified Tool Executor for MCP
 * Can be called by McpServer, direct JSON-RPC HTTP endpoint, or stdio CLI.
 */
export async function execute_mcp_tool(adapter, toolName, args = {}) {
  switch (toolName) {
    case 'list_boards': {
      const raw_boards = await adapter.getBoards();
      const list = (raw_boards || []).map((b) => ({
        id: b.board_code || b.id,
        board_code: b.board_code || b.id,
        title: b.board_name || b.title || 'Untitled Board',
        board_name: b.board_name || b.title || 'Untitled Board',
        description: b.board_description || b.description || '',
        card_count: Array.isArray(b.cards) ? b.cards.length : (Array.isArray(b.board_card) ? b.board_card.length : (b.cardCount || 0)),
        board_type: b.board_type || b.boardType || 'snap_grid',
        is_public: Boolean(b.is_public ?? b.board_setting?.is_public),
        public_role: b.public_role || b.board_setting?.public_role || 'viewer',
        updated_at: b.time_modify || b.time_modified || b.updatedAt || Date.now(),
      }));
      return { boards: list, total: list.length };
    }

    case 'get_board': {
      const target_id = args.board_id || adapter.getActiveBoardId();
      if (!target_id) {
        const raw_boards = await adapter.getBoards();
        const list = (raw_boards || []).map((b) => ({
          id: b.board_code || b.id,
          board_code: b.board_code || b.id,
          title: b.board_name || b.title || 'Untitled Board',
          board_name: b.board_name || b.title || 'Untitled Board',
          description: b.board_description || b.description || '',
          card_count: Array.isArray(b.cards) ? b.cards.length : (Array.isArray(b.board_card) ? b.board_card.length : (b.cardCount || 0)),
          is_public: Boolean(b.is_public ?? b.board_setting?.is_public),
          public_role: b.public_role || b.board_setting?.public_role || 'viewer',
        }));
        return {
          status: 'no_board_selected',
          message: 'No board is selected or active. Available boards:',
          boards: list,
          total: list.length,
        };
      }
      const board = await adapter.getBoard(target_id);
      if (!board) {
        throw new Error(`Board with ID "${target_id}" not found or access denied.`);
      }

      const raw_cards = Array.isArray(board.cards) ? board.cards : (Array.isArray(board.board_card) ? board.board_card : []);
      const sanitized_cards = raw_cards.map(sanitize_card_for_mcp);

      return {
        id: board.board_code || board.id,
        board_code: board.board_code || board.id,
        title: board.board_name || board.title || 'Untitled Board',
        board_name: board.board_name || board.title || 'Untitled Board',
        description: board.board_description || board.description || '',
        board_type: board.board_type || board.boardType || 'snap_grid',
        grid_dimension: board.grid_dimension || board.gridDimension || 24,
        is_public: Boolean(board.is_public ?? board.board_setting?.is_public),
        public_role: board.public_role || board.board_setting?.public_role || 'viewer',
        viewport: board.board_viewport || board.viewport || { panX: 0, panY: 0, zoom: 1 },
        card_count: sanitized_cards.length,
        cards: sanitized_cards,
        connections: board.board_connection || board.board_conenctions || board.connections || [],
        updated_at: board.time_modify || board.time_modified || board.updatedAt || Date.now(),
      };
    }

    case 'get_board_summary': {
      const target_id = args.board_id || adapter.getActiveBoardId();
      if (!target_id) {
        const raw_boards = await adapter.getBoards();
        const list = (raw_boards || []).map((b) => ({
          id: b.board_code || b.id,
          title: b.board_name || b.title || 'Untitled Board',
          description: b.board_description || b.description || '',
          card_count: Array.isArray(b.cards) ? b.cards.length : (Array.isArray(b.board_card) ? b.board_card.length : (b.cardCount || 0)),
        }));
        return {
          status: 'no_board_selected',
          message: 'No board is selected or active. Available boards:',
          boards: list,
          total: list.length,
        };
      }
      const board = await adapter.getBoard(target_id);
      if (!board) {
        throw new Error(`Board with ID "${target_id}" not found or access denied.`);
      }

      const raw_cards = Array.isArray(board.cards) ? board.cards : (Array.isArray(board.board_card) ? board.board_card : []);
      const title = board.board_name || board.title || 'Workspace Board';
      const desc = board.board_description || board.description || 'No description provided';

      const notes = [];
      const tasks = { total: 0, done: 0, items: [] };
      const links = [];
      const files = [];
      const headings = [];
      let encrypted_count = 0;

      for (const c of raw_cards) {
        const sc = sanitize_card_for_mcp(c);
        if (!sc) continue;
        if (sc.is_encrypted) {
          encrypted_count++;
          continue;
        }

        const c_type = (sc.type || 'note').toLowerCase();
        if (c_type === 'heading') {
          headings.push(`### ${sc.title}`);
        } else if (c_type === 'tasklist' || (Array.isArray(sc.items) && sc.items.length > 0)) {
          const checklist = sc.items.map((it) => {
            tasks.total++;
            if (it.done) tasks.done++;
            return `  - [${it.done ? 'x' : ' '}] ${it.text || it.title || 'Task'}`;
          });
          tasks.items.push(`**${sc.title || 'Tasks'}**:\n${checklist.join('\n')}`);
        } else if (c_type === 'link') {
          links.push(`- [${sc.title || 'Link'}](${sc.url || '#'}) ${sc.content ? `— ${sc.content}` : ''}`);
        } else if (c_type === 'file') {
          files.push(`- **${sc.title || 'File'}**: ${sc.description || sc.content || 'Document'}`);
        } else {
          notes.push(`- **${sc.title || 'Note'}** (${sc.color || 'yellow'}): ${sc.content || '(empty note)'}`);
        }
      }

      const markdown = [
        `# Board Summary: ${title}`,
        `*ID: ${target_id} | Total Cards: ${raw_cards.length}*`,
        '',
        `> ${desc}`,
        '',
        headings.length > 0 ? `## Sections\n${headings.join('\n')}\n` : '',
        notes.length > 0 ? `## Sticky Notes & Ideas (${notes.length})\n${notes.join('\n')}\n` : '',
        tasks.items.length > 0 ? `## Action Items & Checklists (${tasks.done}/${tasks.total} completed)\n${tasks.items.join('\n\n')}\n` : '',
        links.length > 0 ? `## References & Links\n${links.join('\n')}\n` : '',
        files.length > 0 ? `## Attached Files & Specs\n${files.join('\n')}\n` : '',
        encrypted_count > 0 ? `## Encrypted Cards (${encrypted_count})\n*${encrypted_count} cards are AES-GCM encrypted and locked.*\n` : '',
      ].filter(Boolean).join('\n');

      return { markdown, summary: { total_cards: raw_cards.length, notes_count: notes.length, tasks_total: tasks.total, tasks_done: tasks.done } };
    }

    case 'search_cards': {
      const target_id = args.board_id || adapter.getActiveBoardId();
      const board = await adapter.getBoard(target_id);
      if (!board) {
        throw new Error(`Board with ID "${target_id}" not found or access denied.`);
      }

      const q = (args.query || '').toLowerCase().trim();
      const raw_cards = Array.isArray(board.cards) ? board.cards : (Array.isArray(board.board_card) ? board.board_card : []);

      const matches = raw_cards
        .map(sanitize_card_for_mcp)
        .filter((c) => {
          if (!c) return false;
          if (args.card_type && (c.type || 'note').toLowerCase() !== args.card_type.toLowerCase()) {
            return false;
          }
          if (!q) return true;
          const matchTitle = (c.title || '').toLowerCase().includes(q);
          const matchContent = (c.content || '').toLowerCase().includes(q);
          const matchDesc = (c.description || '').toLowerCase().includes(q);
          const matchItems = Array.isArray(c.items) && c.items.some((it) => (it.text || '').toLowerCase().includes(q));
          return matchTitle || matchContent || matchDesc || matchItems;
        });

      return { board_id: target_id, query: args.query, match_count: matches.length, results: matches };
    }

    case 'get_card': {
      if (!args.card_id) throw new Error('card_id parameter is required');
      const card = await adapter.getCard(args.card_id, args.board_id);
      if (!card) throw new Error(`Card with ID "${args.card_id}" not found or access denied.`);
      return sanitize_card_for_mcp(card);
    }

    case 'create_card': {
      if (typeof adapter.isReadOnly === 'function' && adapter.isReadOnly()) {
        throw new Error('MCP server is in read-only mode. Card creation is disabled.');
      }
      const target_id = args.board_id || adapter.getActiveBoardId();
      const board = await adapter.getBoard(target_id);
      if (!board) throw new Error(`Board with ID "${target_id}" not found or access denied.`);

      const raw_cards = Array.isArray(board.cards) ? [...board.cards] : (Array.isArray(board.board_card) ? [...board.board_card] : []);
      const type = args.type || 'note';
      const title = args.title || 'New Note';
      const content = args.content || '';
      const color = args.color || 'yellow';
      const items = Array.isArray(args.items) ? args.items : [];

      const final_x = args.x !== undefined ? Number(args.x) : 120 + ((raw_cards.length % 6) * 340);
      const final_y = args.y !== undefined ? Number(args.y) : 120 + (Math.floor(raw_cards.length / 6) * 260);

      const new_card_id = randomUUID();
      const normalized_items = items.map((it, idx) => ({ id: `t_${idx + 1}`, text: it.text || it, done: Boolean(it.done) }));
      const next_z = raw_cards.reduce((acc, c) => Math.max(acc, c.zIndex || c.z_index || 1), 1) + 1;
      const new_card = {
        id: new_card_id,
        card_code: new_card_id,
        board_code: target_id,
        type,
        card_type: type,
        title,
        card_name: title,
        content,
        color,
        items: normalized_items,
        x: final_x,
        y: final_y,
        pos_x: final_x,
        pos_y: final_y,
        width: args.width || (type === 'heading' ? 480 : 320),
        height: args.height || (type === 'heading' ? 84 : 220),
        zIndex: next_z,
        z_index: next_z,
        data: {
          content,
          items: normalized_items,
        },
        card_data: {
          content,
          items: normalized_items,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        time_create: Date.now(),
        time_modify: Date.now(),
      };

      raw_cards.push(new_card);
      board.cards = raw_cards;
      board.board_card = raw_cards;
      board.updatedAt = Date.now();
      board.time_modify = Date.now();

      await adapter.saveBoard(target_id, board);

      return {
        success: true,
        message: `Created ${type} card "${title}" on board "${target_id}".`,
        card: new_card,
      };
    }

    case 'update_card': {
      if (typeof adapter.isReadOnly === 'function' && adapter.isReadOnly()) {
        throw new Error('MCP server is in read-only mode. Card modification is disabled.');
      }
      if (!args.card_id) throw new Error('card_id parameter is required');
      const target_id = args.board_id || adapter.getActiveBoardId();
      const board = await adapter.getBoard(target_id);
      if (!board) throw new Error(`Board with ID "${target_id}" not found or access denied.`);

      const raw_cards = Array.isArray(board.cards) ? [...board.cards] : (Array.isArray(board.board_card) ? [...board.board_card] : []);
      const idx = raw_cards.findIndex((c) => (c.card_code || c.id) === args.card_id);
      if (idx === -1) throw new Error(`Card "${args.card_id}" not found on board "${target_id}".`);

      const current_card = raw_cards[idx];
      const enc = current_card.card_encryption || current_card.cardEncryption;
      if (enc && enc.ciphertext) {
        throw new Error(`Card "${args.card_id}" is AES-GCM encrypted and locked. Unlocking must be performed via user passkey in the Lumen UI.`);
      }

      const next_title = args.title !== undefined ? args.title : (current_card.card_name ?? current_card.title);
      const next_content = args.content !== undefined ? args.content : current_card.content;
      const next_items = args.items !== undefined ? args.items : current_card.items;
      const next_x = args.x !== undefined ? Number(args.x) : (current_card.pos_x ?? current_card.x);
      const next_y = args.y !== undefined ? Number(args.y) : (current_card.pos_y ?? current_card.y);

      const updated_card = {
        ...current_card,
        title: next_title,
        card_name: next_title,
        content: next_content,
        color: args.color !== undefined ? args.color : current_card.color,
        items: next_items,
        x: next_x,
        y: next_y,
        pos_x: next_x,
        pos_y: next_y,
        data: {
          ...(current_card.data || current_card.card_data || {}),
          content: next_content,
          items: next_items,
        },
        card_data: {
          ...(current_card.card_data || current_card.data || {}),
          content: next_content,
          items: next_items,
        },
        updatedAt: Date.now(),
        time_modify: Date.now(),
      };

      raw_cards[idx] = updated_card;
      board.cards = raw_cards;
      board.board_card = raw_cards;
      board.updatedAt = Date.now();
      board.time_modify = Date.now();

      await adapter.saveBoard(target_id, board);

      return {
        success: true,
        message: `Updated card "${args.card_id}".`,
        card: sanitize_card_for_mcp(updated_card),
      };
    }

    case 'delete_card': {
      if (typeof adapter.isReadOnly === 'function' && adapter.isReadOnly()) {
        throw new Error('MCP server is in read-only mode. Card deletion is disabled.');
      }
      if (!args.card_id) throw new Error('card_id parameter is required');
      const target_id = args.board_id || adapter.getActiveBoardId();
      const board = await adapter.getBoard(target_id);
      if (!board) throw new Error(`Board with ID "${target_id}" not found or access denied.`);

      const raw_cards = Array.isArray(board.cards) ? [...board.cards] : (Array.isArray(board.board_card) ? [...board.board_card] : []);
      const initial_len = raw_cards.length;
      const filtered = raw_cards.filter((c) => (c.card_code || c.id) !== args.card_id);

      if (filtered.length === initial_len) {
        throw new Error(`Card "${args.card_id}" not found on board "${target_id}".`);
      }

      board.cards = filtered;
      board.board_card = filtered;
      board.updatedAt = Date.now();
      board.time_modify = Date.now();

      await adapter.saveBoard(target_id, board);

      return {
        success: true,
        message: `Card "${args.card_id}" deleted from board "${target_id}".`,
      };
    }

    case 'add_card_comment': {
      if (typeof adapter.isReadOnly === 'function' && adapter.isReadOnly()) {
        throw new Error('MCP server is in read-only mode. Adding comments is disabled.');
      }
      if (!args.card_id || !args.text) throw new Error('card_id and text parameters are required');
      const author = args.author_name || 'AI Collaborator (MCP)';
      const comment = await adapter.addComment(args.card_id, args.text, author, args.board_id);
      return {
        success: true,
        message: `Comment posted to card "${args.card_id}".`,
        comment,
      };
    }

    case 'list_card_comments': {
      if (!args.card_id) throw new Error('card_id parameter is required');
      const comments = await adapter.getComments(args.card_id, args.board_id);
      return { card_id: args.card_id, total: (comments || []).length, comments: comments || [] };
    }

    default:
      throw new Error(`Unknown tool "${toolName}"`);
  }
}

/**
 * Standard MCP Tools Specification List
 */
export const LUMEN_MCP_TOOLS_SPEC = [
  {
    name: 'list_boards',
    description: 'List all workspace boards with summary metadata (ID, title, description, card count, updated timestamp).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_board',
    description: 'Get complete board data by ID including all visible cards, viewport, connections, and structure. Zero-leak protection is applied for encrypted cards.',
    inputSchema: {
      type: 'object',
      properties: {
        board_id: { type: 'string', description: 'Board identifier. If omitted, retrieves the active board.' },
      },
    },
  },
  {
    name: 'get_board_summary',
    description: 'Returns a clean, AI-optimized Markdown digest summarizing all sticky notes, tasklists (pending & completed), documents, and links on the board.',
    inputSchema: {
      type: 'object',
      properties: {
        board_id: { type: 'string', description: 'Board ID to summarize. Defaults to active board.' },
      },
    },
  },
  {
    name: 'search_cards',
    description: 'Search for cards by keyword across title, content, description, or filter by card type.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword or phrase' },
        board_id: { type: 'string', description: 'Optional board ID' },
        card_type: { type: 'string', description: 'Optional card type filter: "note", "tasklist", "heading", "link", "file", "canvas", "geo", "stock"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_card',
    description: 'Retrieve full details of a specific card by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Unique ID or UUID of the card' },
        board_id: { type: 'string', description: 'Optional board ID' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'create_card',
    description: 'Create a new card on the board (sticky note, tasklist/checklist, heading, link, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the new card' },
        content: { type: 'string', description: 'Body content, note text, or markdown' },
        type: { type: 'string', enum: ['note', 'tasklist', 'heading', 'link', 'doc', 'canvas', 'stock', 'file'], default: 'note' },
        color: { type: 'string', default: 'yellow' },
        board_id: { type: 'string', description: 'Target board ID' },
        items: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, done: { type: 'boolean' } } } },
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        width: { type: 'number', description: 'Width in pixels' },
        height: { type: 'number', description: 'Height in pixels' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_card',
    description: 'Update an existing card (modify title, body content, color, checklist items, or position).',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'ID of card to modify' },
        board_id: { type: 'string', description: 'Board ID where card exists' },
        title: { type: 'string', description: 'New title' },
        content: { type: 'string', description: 'New body content / markdown' },
        color: { type: 'string', description: 'New color' },
        items: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, done: { type: 'boolean' } } } },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'delete_card',
    description: 'Delete a card from a board by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'ID of card to delete' },
        board_id: { type: 'string', description: 'Board ID' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'add_card_comment',
    description: 'Post an AI reflection, comment, or note directly to a card discussion thread.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Target card ID' },
        board_id: { type: 'string', description: 'Optional board ID' },
        text: { type: 'string', description: 'Comment text' },
        author_name: { type: 'string', default: 'AI Collaborator (MCP)' },
      },
      required: ['card_id', 'text'],
    },
  },
  {
    name: 'list_card_comments',
    description: 'Read all comments and conversation history for a given card.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Target card ID' },
        board_id: { type: 'string', description: 'Optional board ID' },
      },
      required: ['card_id'],
    },
  },
];

/**
 * Factory that creates a fully-configured Lumen McpServer instance
 */
export function createLumenMcpServer(adapter) {
  const mcp = new McpServer(
    {
      name: 'lumen-board-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      instructions:
        'You are connected to Lumen Workspace — an infinite spatial canvas and collaborative moodboard. ' +
        'You can read boards, synthesize sticky notes and tasklists, search ideas, create new notes, update cards, and add collaborator comments.',
    }
  );

  // Register each tool with McpServer
  mcp.tool('list_boards', 'List all workspace boards with summary metadata.', {}, async () => {
    const res = await execute_mcp_tool(adapter, 'list_boards', {});
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcp.tool(
    'get_board',
    'Get complete board data by ID including all visible cards, viewport, connections, and structure.',
    { board_id: z.string().optional() },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'get_board', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'get_board_summary',
    'Returns a clean, AI-optimized Markdown digest summarizing all sticky notes, tasklists, documents, and links on the board.',
    { board_id: z.string().optional() },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'get_board_summary', args);
      return { content: [{ type: 'text', text: res.markdown }] };
    }
  );

  mcp.tool(
    'search_cards',
    'Search for cards by keyword across title, content, description, or filter by card type.',
    {
      query: z.string(),
      board_id: z.string().optional(),
      card_type: z.string().optional(),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'search_cards', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'get_card',
    'Retrieve full details of a specific card by ID.',
    {
      card_id: z.string(),
      board_id: z.string().optional(),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'get_card', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'create_card',
    'Create a new card on the board (sticky note, tasklist/checklist, heading, link, etc.).',
    {
      title: z.string(),
      content: z.string().optional(),
      type: z.enum(['note', 'tasklist', 'heading', 'link', 'doc', 'canvas', 'stock', 'file']).optional().default('note'),
      color: z.string().optional().default('yellow'),
      board_id: z.string().optional(),
      items: z.array(z.object({ text: z.string(), done: z.boolean().default(false) })).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'create_card', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'update_card',
    'Update an existing card (modify title, body content, color, checklist items, or position).',
    {
      card_id: z.string(),
      board_id: z.string().optional(),
      title: z.string().optional(),
      content: z.string().optional(),
      color: z.string().optional(),
      items: z.array(z.object({ id: z.string().optional(), text: z.string(), done: z.boolean() })).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'update_card', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'delete_card',
    'Delete a card from a board by ID.',
    {
      card_id: z.string(),
      board_id: z.string().optional(),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'delete_card', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'add_card_comment',
    'Post an AI reflection, comment, or note directly to a card discussion thread.',
    {
      card_id: z.string(),
      board_id: z.string().optional(),
      text: z.string(),
      author_name: z.string().optional().default('AI Collaborator (MCP)'),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'add_card_comment', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  mcp.tool(
    'list_card_comments',
    'Read all comments and conversation history for a given card.',
    {
      card_id: z.string(),
      board_id: z.string().optional(),
    },
    async (args) => {
      const res = await execute_mcp_tool(adapter, 'list_card_comments', args);
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }
  );

  // Resources
  mcp.resource('active-board', 'board://active', async () => {
    const active_id = adapter.getActiveBoardId();
    const board = await adapter.getBoard(active_id);
    const raw_cards = Array.isArray(board?.cards) ? board.cards : (Array.isArray(board?.board_card) ? board.board_card : []);
    const sanitized = {
      id: board?.board_code || board?.id || active_id,
      title: board?.board_name || board?.title || 'Untitled Board',
      description: board?.board_description || board?.description || '',
      cards: raw_cards.map(sanitize_card_for_mcp),
    };

    return {
      contents: [
        {
          uri: 'board://active',
          mimeType: 'application/json',
          text: JSON.stringify(sanitized, null, 2),
        },
      ],
    };
  });

  mcp.resource('boards-list', 'boards://list', async () => {
    const res = await execute_mcp_tool(adapter, 'list_boards', {});
    return {
      contents: [
        {
          uri: 'boards://list',
          mimeType: 'application/json',
          text: JSON.stringify(res, null, 2),
        },
      ],
    };
  });

  // Prompts
  mcp.prompt('summarize_board', 'Synthesize the board into an executive summary and highlighted next steps', { board_id: z.string().optional() }, async ({ board_id }) => {
    const target_id = board_id || adapter.getActiveBoardId();
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review the Lumen board "${target_id}". Use the "get_board_summary" tool to analyze all sticky notes, tasks, files, and links. Provide a structured overview with key themes, pending deliverables, and recommended additions.`,
          },
        },
      ],
    };
  });

  mcp.prompt('brainstorm_cards', 'Brainstorm creative ideas and add them as color-coded sticky notes on the active board', { topic: z.string() }, async ({ topic }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `We are brainstorming on the topic: "${topic}". First use "get_board" to see existing cards. Then generate 3 to 5 high-impact, complementary ideas and use "create_card" to add them as colorful sticky notes to the workspace board.`,
          },
        },
      ],
    };
  });

  mcp.prompt('organize_tasks', 'Analyze existing notes and extract an actionable tasklist card with checkboxes', {}, async () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Inspect all notes on the board with "get_board". Identify action items and convert them into a structured tasklist card using "create_card" with type="tasklist".',
          },
        },
      ],
    };
  });

  return mcp;
}
