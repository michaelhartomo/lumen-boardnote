import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSignals } from '@preact/signals-react/runtime';
import {
  FolderKanban,
  CornerDownRight,
  ArrowRight,
  Layers,
} from 'lucide-react';

import styles from './LUMEN_board_card.module.css';
import {
  updateCard,
  setActiveBoard,
  getBoardDataById,
  boardsDirectorySignal,
  showToast,
} from '../../signals/boardState.js';

export default function LUMEN_board_card({ card }) {
  useSignals();
  const navigate = useNavigate();

  const target_board_id = card.target_board_id || card.boardId || '';
  const [child_board_info, set_child_board_info] = useState({
    card_count: 0,
    breakdown_text: 'Empty board',
    mini_cards: [],
  });

  // Load preview data of the nested child board
  useEffect(() => {
    if (!target_board_id) return;

    const child_data = getBoardDataById(target_board_id);
    if (child_data && Array.isArray(child_data.cards)) {
      const cards = child_data.cards;
      const count = cards.length;

      // Group types for summary
      const type_counts = {};
      cards.forEach((c) => {
        const t = c.type || 'note';
        type_counts[t] = (type_counts[t] || 0) + 1;
      });

      const parts = [];
      if (type_counts.note) parts.push(`${type_counts.note} note${type_counts.note > 1 ? 's' : ''}`);
      if (type_counts.image) parts.push(`${type_counts.image} img${type_counts.image > 1 ? 's' : ''}`);
      if (type_counts.tasklist) parts.push(`${type_counts.tasklist} checklist${type_counts.tasklist > 1 ? 's' : ''}`);
      if (type_counts.board) parts.push(`${type_counts.board} nested`);
      if (type_counts.quote) parts.push(`${type_counts.quote} quote`);
      if (type_counts.link) parts.push(`${type_counts.link} link`);
      if (type_counts.social) parts.push(`${type_counts.social} social`);

      set_child_board_info({
        card_count: count,
        breakdown_text: parts.length > 0 ? parts.slice(0, 3).join(', ') : 'Empty canvas',
        mini_cards: cards.slice(0, 7),
      });
    } else {
      set_child_board_info({
        card_count: 0,
        breakdown_text: 'Empty canvas',
        mini_cards: [],
      });
    }
  }, [target_board_id, card.title]);

  const handle_open_board = (e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!target_board_id) {
      showToast('No nested board ID found');
      return;
    }
    setActiveBoard(target_board_id);
    navigate(`/board/${target_board_id}`);
    showToast(`Entering nested board "${card.title || 'Sub-Board'}"`);
  };

  const handle_title_change = (e) => {
    const new_title = e.target.value;
    updateCard(card.id, { title: new_title }, false);
  };

  const handle_title_blur = (e) => {
    const new_title = e.target.value;
    updateCard(card.id, { title: new_title }, true);
  };

  const handle_desc_change = (e) => {
    const new_desc = e.target.value;
    updateCard(card.id, { description: new_desc, content: new_desc }, false);
  };

  const handle_desc_blur = (e) => {
    const new_desc = e.target.value;
    updateCard(card.id, { description: new_desc, content: new_desc }, true);
  };

  return (
    <div
      className={styles['lumen-board-card-container']}
      onDoubleClick={handle_open_board}
      title="Double-click to open this sub-board"
    >
      {/* Top Meta: Sub-Board Badge & Quick Open */}
      <div className={styles['lumen-board-card-top']}>
        <div className={styles['lumen-board-card-badge']}>
          <FolderKanban size={13} />
          <span>Sub-Board</span>
        </div>

        <button
          type="button"
          className={styles['lumen-board-card-quick-open']}
          onClick={handle_open_board}
          title="Open this nested board"
        >
          <span>Open</span>
          <ArrowRight size={11} />
        </button>
      </div>

      {/* Middle: Editable Sub-board Title & Description */}
      <div className={styles['lumen-board-card-content']}>
        <input
          type="text"
          className={styles['lumen-board-card-title-input']}
          value={card.title || ''}
          onChange={handle_title_change}
          onBlur={handle_title_blur}
          placeholder="Sub-Board Title..."
          onClick={(e) => e.stopPropagation()}
        />

        <textarea
          className={styles['lumen-board-card-desc-input']}
          value={card.content || card.description || ''}
          onChange={handle_desc_change}
          onBlur={handle_desc_blur}
          placeholder="Add sub-board purpose, notes, or sprint scope..."
          rows={2}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Live Preview of Child Board Contents */}
      <div className={styles['lumen-board-card-preview-strip']}>
        <div className={styles['lumen-board-card-preview-header']}>
          <span className={styles['lumen-board-card-count']}>
            {child_board_info.card_count === 1
              ? '1 item inside'
              : `${child_board_info.card_count} items inside`}
          </span>
          <span className={styles['lumen-board-card-breakdown']}>
            {child_board_info.breakdown_text}
          </span>
        </div>

        {/* Mini item color blocks */}
        {child_board_info.mini_cards.length > 0 && (
          <div className={styles['lumen-board-card-mini-grid']}>
            {child_board_info.mini_cards.map((mc, idx) => {
              const mini_type_class =
                mc.type === 'tasklist'
                  ? styles['lumen-board-card-mini-task']
                  : mc.type === 'image'
                  ? styles['lumen-board-card-mini-image']
                  : mc.type === 'board'
                  ? styles['lumen-board-card-mini-board']
                  : styles['lumen-board-card-mini-note'];

              return (
                <div
                  key={mc.id || idx}
                  className={`${styles['lumen-board-card-mini-item']} ${mini_type_class}`}
                  title={`${mc.type}: ${mc.title || 'Untitled'}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Enter Board Action Button */}
      <button
        type="button"
        className={styles['lumen-board-card-enter-btn']}
        onClick={handle_open_board}
      >
        <span>Open Nested Canvas</span>
        <CornerDownRight size={13} />
      </button>

      <div className={styles['lumen-board-card-hint']}>
        Double-click card to explore
      </div>
    </div>
  );
}
