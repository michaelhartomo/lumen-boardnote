import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Boxes,
  Plus,
  ListOrdered,
  ArrowUpDown,
  ArrowDownAZ,
  ChevronDown,
  ChevronUp,
  Ungroup,
  FileText,
  CheckSquare,
  Image as ImageIcon,
  Link2,
  MapPin,
  Palette,
  Paperclip,
  Radio,
  Quote,
  X,
  Layers,
  SlidersVertical,
  Maximize2,
  Pencil,
  Check,
  Type,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';

import styles from './LUMEN_group_card.module.css';
import {
  activeBoardSignal,
  selectedCardsSignal,
  openPropertyPanel,
  isPropertyPanelOpenSignal,
  toggleCardPropertyPanel,
  updateCard,
  addCard,
  addCardToGroup,
  removeCardFromGroup,
  ungroupCards,
  autoLayoutGroupColumn,
  autoOrderGroupCards,
  reorderGroupMember,
  setGroupColumnWidth,
  fitGroupBounds,
  activeDropTargetGroupIdSignal,
  showToast,
} from '../../signals/boardState.js';

// Background preset palettes
const BG_COLOR_PRESETS = [
  { key: 'slate', color: 'rgba(248, 250, 252, 0.75)', label: 'Default Slate' },
  { key: 'white', color: '#ffffff', label: 'Pure White' },
  { key: 'ivory', color: '#fefce8', label: 'Warm Ivory' },
  { key: 'peach', color: '#fff7ed', label: 'Soft Peach' },
  { key: 'green', color: '#f0fdf4', label: 'Sage Green' },
  { key: 'blue', color: '#f0f9ff', label: 'Sky Blue' },
  { key: 'purple', color: '#faf5ff', label: 'Lavender' },
  { key: 'rose', color: '#fff1f2', label: 'Rose Blush' },
  { key: 'dark', color: '#1e293b', label: 'Obsidian Dark' },
];

// Text color preset options
const TEXT_COLOR_PRESETS = [
  { key: 'charcoal', color: '#0f172a', label: 'Deep Charcoal' },
  { key: 'slate', color: '#475569', label: 'Slate Gray' },
  { key: 'blue', color: '#1d4ed8', label: 'Royal Blue' },
  { key: 'green', color: '#15803d', label: 'Emerald Green' },
  { key: 'amber', color: '#c2410c', label: 'Amber Orange' },
  { key: 'rose', color: '#be123c', label: 'Rose Red' },
  { key: 'purple', color: '#7e22ce', label: 'Royal Purple' },
  { key: 'white', color: '#ffffff', label: 'Crisp White' },
];

// Helper to get card icon by card type
function get_card_type_icon(type) {
  switch (type) {
    case 'note':
      return FileText;
    case 'tasklist':
      return CheckSquare;
    case 'image':
      return ImageIcon;
    case 'link':
      return Link2;
    case 'geo':
      return MapPin;
    case 'palette':
      return Palette;
    case 'stock':
      return TrendingUp;
    case 'sheets':
      return FileSpreadsheet;
    case 'file':
      return Paperclip;
    case 'embed':
    case 'social':
      return Radio;
    case 'quote':
      return Quote;
    default:
      return Layers;
  }
}

export default function LUMEN_group_card({ card, onDragMouseDown }) {
  useSignals();

  const [is_add_popover_open, set_is_add_popover_open] = useState(false);
  const [is_sort_popover_open, set_is_sort_popover_open] = useState(false);
  const [is_color_popover_open, set_is_color_popover_open] = useState(false);
  const [is_editing_content, set_is_editing_content] = useState(false);

  const is_group_selected = (selectedCardsSignal.value || []).includes(card.id);
  const is_property_panel_active =
    Boolean(isPropertyPanelOpenSignal.value) &&
    is_group_selected &&
    (selectedCardsSignal.value || []).length === 1;
  const [is_local_drag_over, set_is_local_drag_over] = useState(false);

  const popover_ref = useRef(null);
  const sort_popover_ref = useRef(null);
  const color_popover_ref = useRef(null);
  const textarea_ref = useRef(null);
  const top_chrome_ref = useRef(null);

  const active_board = activeBoardSignal.value;
  const all_cards = active_board.cards || [];

  // Contained cards resolution (strictly preserving stack order)
  const member_card_ids = Array.isArray(card.card_ids) ? card.card_ids : [];
  const member_cards = member_card_ids
    .map((id) => all_cards.find((c) => c.id === id))
    .filter(Boolean);
  all_cards.forEach((c) => {
    if (c.group_id === card.id && !member_cards.some((m) => m.id === c.id)) {
      member_cards.push(c);
    }
  });

  // Total physical vertical span of member cards inside column stack
  const member_cards_total_height = member_cards.reduce((sum, m, idx) => {
    const cardH = m.height || 200;
    const gap = idx === member_cards.length - 1 ? 0 : 16;
    return sum + cardH + gap;
  }, 0);

  // Available cards to add (not self, and not already in any group)
  const available_cards = all_cards.filter(
    (c) =>
      c.id !== card.id &&
      c.type !== 'group' &&
      !member_card_ids.includes(c.id) &&
      c.group_id !== card.id
  );

  const is_collapsed = Boolean(card.collapsed);
  const current_column_width = card.column_width || 340;
  const is_drop_active = activeDropTargetGroupIdSignal.value === card.id || is_local_drag_over;

  // Custom styling colors
  const text_color = card.text_color || undefined;
  const bg_color = card.bg_color || undefined;

  // Live measurement of top chrome (Header + Content box + Members ribbon)
  // Ensures cards never overlap with header buttons, content box, or member chips
  useEffect(() => {
    if (!top_chrome_ref.current || is_collapsed) return;
    const measureTopChrome = () => {
      const el = top_chrome_ref.current;
      if (!el) return;
      const measuredH = Math.ceil(el.offsetHeight);
      if (measuredH > 40 && Math.abs((card.top_chrome_height || 0) - measuredH) > 2) {
        updateCard(card.id, { top_chrome_height: measuredH }, false);
        autoLayoutGroupColumn(card.id);
      }
    };

    measureTopChrome();

    const observer = new ResizeObserver(() => {
      measureTopChrome();
    });
    observer.observe(top_chrome_ref.current);
    return () => observer.disconnect();
  }, [card.id, card.content, card.width, member_cards.length, is_collapsed]);

  // Close popovers on click outside
  useEffect(() => {
    function handle_click_outside(e) {
      if (popover_ref.current && !popover_ref.current.contains(e.target)) {
        set_is_add_popover_open(false);
      }
      if (sort_popover_ref.current && !sort_popover_ref.current.contains(e.target)) {
        set_is_sort_popover_open(false);
      }
      if (color_popover_ref.current && !color_popover_ref.current.contains(e.target)) {
        set_is_color_popover_open(false);
      }
    }
    if (is_add_popover_open || is_sort_popover_open || is_color_popover_open) {
      document.addEventListener('mousedown', handle_click_outside);
    }
    return () => {
      document.removeEventListener('mousedown', handle_click_outside);
    };
  }, [is_add_popover_open, is_sort_popover_open, is_color_popover_open]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (is_editing_content && textarea_ref.current) {
      textarea_ref.current.focus();
    }
  }, [is_editing_content]);

  const handle_title_change = (e) => {
    updateCard(card.id, { title: e.target.value }, false);
  };

  const handle_title_blur = (e) => {
    updateCard(card.id, { title: e.target.value }, true);
  };

  const handle_content_change = (e) => {
    updateCard(card.id, { content: e.target.value }, false);
  };

  const handle_content_blur = (e) => {
    updateCard(card.id, { content: e.target.value }, true);
    autoLayoutGroupColumn(card.id);
  };

  const handle_toggle_collapse = (e) => {
    e.stopPropagation();
    const will_collapse = !is_collapsed;
    const previous_height = card.previous_height || card.height || 420;

    if (will_collapse) {
      updateCard(card.id, {
        collapsed: true,
        previous_height: card.height,
        height: 52,
      });
      showToast(`1-Column Group "${card.title}" collapsed`);
    } else {
      updateCard(card.id, {
        collapsed: false,
        height: previous_height > 100 ? previous_height : 420,
      });
      autoLayoutGroupColumn(card.id);
      showToast(`1-Column Group "${card.title}" expanded`);
    }
  };

  const handle_auto_order_and_resize = (e) => {
    e.stopPropagation();
    autoOrderGroupCards(card.id, 'current');
  };

  const handle_sort = (criterion, e) => {
    e.stopPropagation();
    autoOrderGroupCards(card.id, criterion);
    set_is_sort_popover_open(false);
  };

  const handle_fit_bounds = (e) => {
    e.stopPropagation();
    fitGroupBounds(card.id);
  };

  const handle_ungroup = (e) => {
    e.stopPropagation();
    ungroupCards(card.id);
  };

  const handle_add_existing_card = (target_card_id, e) => {
    e.stopPropagation();
    addCardToGroup(card.id, target_card_id);
    set_is_add_popover_open(false);
  };

  const handle_quick_create_card = (type, e) => {
    e.stopPropagation();
    let default_config = {
      type,
      x: card.x + 20,
      y: card.y + 60,
      group_id: card.id,
      width: current_column_width,
    };

    if (type === 'note') {
      default_config = {
        ...default_config,
        title: 'Group Note',
        content: 'Notes inside group column...',
        height: 180,
        color: card.color || 'yellow',
      };
    } else if (type === 'tasklist') {
      default_config = {
        ...default_config,
        title: 'Group Tasks',
        items: [
          { id: 't1', text: 'Initial group deliverable', done: false },
          { id: 't2', text: 'Follow-up action item', done: false },
        ],
        height: 220,
        color: 'green',
      };
    } else if (type === 'image') {
      default_config = {
        ...default_config,
        title: 'Group Visual Asset',
        caption: 'Visual reference asset in column',
        height: 280,
        color: 'white',
      };
    } else if (type === 'link') {
      default_config = {
        ...default_config,
        title: 'Group Reference Bookmark',
        url: 'https://designsystemsrepo.com',
        description: 'Saved reference link in group column',
        height: 144,
        color: 'blue',
      };
    } else if (type === 'stock') {
      default_config = {
        ...default_config,
        title: 'Stock Card',
        symbol: 'MAPI.JK',
        exchange: 'IDX - Jakarta',
        range: '1d',
        height: 380,
        color: 'slate',
      };
    } else if (type === 'sheets') {
      default_config = {
        ...default_config,
        title: 'Group Spreadsheet',
        height: 360,
        color: 'green',
      };
    }

    const created = addCard(default_config);
    if (created && created.id) {
      addCardToGroup(card.id, created.id);
    }
    set_is_add_popover_open(false);
  };

  const handle_select_member_card = (member_id, e) => {
    e.stopPropagation();
    selectedCardsSignal.value = [member_id];
    openPropertyPanel();
  };

  const handle_move_member_up = (member_id, e) => {
    e.stopPropagation();
    reorderGroupMember(card.id, member_id, 'up');
  };

  const handle_move_member_down = (member_id, e) => {
    e.stopPropagation();
    reorderGroupMember(card.id, member_id, 'down');
  };

  const handle_remove_member = (member_id, e) => {
    e.stopPropagation();
    removeCardFromGroup(card.id, member_id);
  };

  const handle_change_column_width = (target_width, e) => {
    e.stopPropagation();
    setGroupColumnWidth(card.id, target_width);
  };

  const handle_set_bg_color = (color_val) => {
    updateCard(card.id, { bg_color: color_val }, true);
    showToast(`Background color updated`);
  };

  const handle_set_text_color = (color_val) => {
    updateCard(card.id, { text_color: color_val }, true);
    showToast(`Text color updated`);
  };

  const handle_reset_colors = () => {
    updateCard(card.id, { bg_color: null, text_color: null }, true);
    showToast(`Colors reset to default theme`);
  };

  // Direct HTML5 drop handler on group card
  const handle_drag_over = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!is_local_drag_over) set_is_local_drag_over(true);
  };

  const handle_drag_leave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_local_drag_over(false);
  };

  const handle_drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_local_drag_over(false);

    // 1. Check for lumen modules from the dock
    const rawData = e.dataTransfer.getData('application/lumen-module');
    if (rawData) {
      try {
        const config = JSON.parse(rawData);
        const created = addCard({
          ...config,
          group_id: card.id,
          width: current_column_width,
        });
        if (created && created.id) {
          addCardToGroup(card.id, created.id);
        }
        showToast(`Dropped ${config.title || config.type} into group "${card.title}"`);
        return;
      } catch (err) {
        console.error('Error dropping module into group:', err);
      }
    }

    // 2. Check for files dropped from desktop (e.g. image files)
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        imageFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            const created = addCard({
              type: 'image',
              title: file.name.replace(/\.[^/.]+$/, ''),
              url: loadEvt.target.result,
              group_id: card.id,
              width: current_column_width,
              height: 280,
            });
            if (created && created.id) {
              addCardToGroup(card.id, created.id);
            }
          };
          reader.readAsDataURL(file);
        });
        showToast(`Dropped ${imageFiles.length} image(s) into group "${card.title}"`);
        return;
      }
    }

    // 3. Check for dropped URLs or text snippets
    const uri = e.dataTransfer.getData('text/uri-list');
    const plainText = e.dataTransfer.getData('text/plain');
    if (uri || (plainText && (plainText.startsWith('http://') || plainText.startsWith('https://')))) {
      const linkUrl = uri || plainText.trim();
      const created = addCard({
        type: 'link',
        title: 'Bookmark',
        url: linkUrl,
        group_id: card.id,
        width: current_column_width,
        height: 144,
      });
      if (created && created.id) {
        addCardToGroup(card.id, created.id);
      }
      showToast(`Added dropped link to group "${card.title}"`);
      return;
    } else if (plainText && plainText.trim()) {
      const created = addCard({
        type: 'note',
        title: 'Dropped Note',
        content: plainText.trim(),
        group_id: card.id,
        width: current_column_width,
        height: 180,
      });
      if (created && created.id) {
        addCardToGroup(card.id, created.id);
      }
      showToast(`Added dropped note to group "${card.title}"`);
      return;
    }
  };

  return (
    <div
      className={`${styles['lumen-group-container']} ${is_drop_active ? styles['lumen-group-container-drop-active'] : ''}`}
      style={{
        backgroundColor: bg_color || undefined,
        color: text_color || undefined,
      }}
      onDragOver={handle_drag_over}
      onDragLeave={handle_drag_leave}
      onDrop={handle_drop}
    >
      {/* Top Chrome Area (Header + Body Content + Member Stack Ribbon) */}
      <div ref={top_chrome_ref} className={styles['lumen-group-top-chrome']}>
        {/* Group Header Bar (Drag handle for the whole group) */}
        <div
          className={styles['lumen-group-header']}
          style={{
            backgroundColor: bg_color ? 'rgba(255, 255, 255, 0.22)' : undefined,
            borderColor: bg_color ? 'rgba(0, 0, 0, 0.08)' : undefined,
          }}
          onMouseDown={onDragMouseDown}
        >
          {/* Line 1: Header Identity & Quick Window Toggles */}
          <div className={styles['lumen-group-header-top-row']}>
            <div className={styles['lumen-group-header-identity']}>
              <div
                className={styles['lumen-group-badge']}
                style={{
                  color: text_color || undefined,
                  backgroundColor: text_color ? 'rgba(0, 0, 0, 0.08)' : undefined,
                }}
                title="Single vertical column container"
              >
                <SlidersVertical size={11} strokeWidth={2.5} />
                <span>1-Col Group</span>
              </div>

              <input
                type="text"
                className={styles['lumen-group-title-input']}
                style={{ color: text_color || undefined }}
                value={card.title || ''}
                placeholder="Group Title..."
                onChange={handle_title_change}
                onBlur={handle_title_blur}
                onClick={(e) => e.stopPropagation()}
              />

              <span
                className={styles['lumen-group-count-tag']}
                style={{
                  color: text_color || undefined,
                  backgroundColor: text_color ? 'rgba(0, 0, 0, 0.06)' : undefined,
                }}
              >
                {member_cards.length} {member_cards.length === 1 ? 'card' : 'cards'}
              </span>
            </div>

            <div className={styles['lumen-group-header-quick-toggles']}>
              {/* Collapse / Expand Toggle */}
              <button
                type="button"
                className={styles['lumen-group-icon-btn']}
                onClick={handle_toggle_collapse}
                title={is_collapsed ? 'Expand group frame' : 'Collapse group to compact bar'}
              >
                {is_collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              </button>

              {/* Card Properties Button */}
              <button
                type="button"
                className={`${styles['lumen-group-icon-btn']} ${
                  is_property_panel_active ? styles['lumen-group-action-btn-active'] : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCardPropertyPanel(card.id);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title={is_property_panel_active ? "Close Group Properties" : "Group Card Properties"}
                aria-label={is_property_panel_active ? "Close Group Properties" : "Group Card Properties"}
              >
                <SlidersVertical size={12} />
              </button>

              {/* Ungroup Button */}
              <button
                type="button"
                className={styles['lumen-group-icon-btn']}
                onClick={handle_ungroup}
                title="Ungroup all cards (keeps cards, removes container frame)"
              >
                <Ungroup size={12} />
              </button>
            </div>
          </div>

          {/* Line 2: Wrapped Action Buttons Toolbar */}
          {!is_collapsed && (
            <div className={styles['lumen-group-header-actions']}>
              {/* Add Card to Group */}
              <div className={styles['lumen-group-popover-anchor']}>
                <button
                  type="button"
                  className={`${styles['lumen-group-action-btn']} ${is_add_popover_open ? styles['lumen-group-action-btn-active'] : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    set_is_add_popover_open(!is_add_popover_open);
                    set_is_sort_popover_open(false);
                    set_is_color_popover_open(false);
                  }}
                  title="Add existing card or create new card inside this 1-column group"
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>

                {/* Floating Add Card Popover */}
                {is_add_popover_open && (
                  <div
                    ref={popover_ref}
                    className={styles['lumen-group-popover']}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles['lumen-group-popover-header']}>
                      <span>Add Cards to "{card.title}"</span>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-close']}
                        onClick={() => set_is_add_popover_open(false)}
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <div className={styles['lumen-group-popover-content']}>
                      {/* Quick Create in Group */}
                      <div className={styles['lumen-group-popover-section-title']}>
                        Create New in 1-Column Stack
                      </div>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-item']}
                        onClick={(e) => handle_quick_create_card('note', e)}
                      >
                        <div className={styles['lumen-group-popover-item-left']}>
                          <FileText size={12} color="#ca8a04" />
                          <span className={styles['lumen-group-popover-item-title']}>Sticky Note</span>
                        </div>
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-item']}
                        onClick={(e) => handle_quick_create_card('tasklist', e)}
                      >
                        <div className={styles['lumen-group-popover-item-left']}>
                          <CheckSquare size={12} color="#16a34a" />
                          <span className={styles['lumen-group-popover-item-title']}>Checklist</span>
                        </div>
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-item']}
                        onClick={(e) => handle_quick_create_card('image', e)}
                      >
                        <div className={styles['lumen-group-popover-item-left']}>
                          <ImageIcon size={12} color="#2563eb" />
                          <span className={styles['lumen-group-popover-item-title']}>Image Card</span>
                        </div>
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-item']}
                        onClick={(e) => handle_quick_create_card('link', e)}
                      >
                        <div className={styles['lumen-group-popover-item-left']}>
                          <Link2 size={12} color="#9333ea" />
                          <span className={styles['lumen-group-popover-item-title']}>Link Bookmark</span>
                        </div>
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-item']}
                        onClick={(e) => handle_quick_create_card('stock', e)}
                      >
                        <div className={styles['lumen-group-popover-item-left']}>
                          <TrendingUp size={12} color="#059669" />
                          <span className={styles['lumen-group-popover-item-title']}>Stock Market</span>
                        </div>
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-group-popover-item']}
                        onClick={(e) => handle_quick_create_card('sheets', e)}
                      >
                        <div className={styles['lumen-group-popover-item-left']}>
                          <FileSpreadsheet size={12} color="#0f9d58" />
                          <span className={styles['lumen-group-popover-item-title']}>Spreadsheet</span>
                        </div>
                        <Plus size={11} />
                      </button>

                      {/* Existing Ungrouped Cards on Board */}
                      {available_cards.length > 0 && (
                        <>
                          <div className={styles['lumen-group-popover-section-title']}>
                            Existing Canvas Cards ({available_cards.length})
                          </div>
                          {available_cards.map((c) => {
                            const Icon = get_card_type_icon(c.type);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={styles['lumen-group-popover-item']}
                                onClick={(e) => handle_add_existing_card(c.id, e)}
                              >
                                <div className={styles['lumen-group-popover-item-left']}>
                                  <Icon size={12} color="var(--lumen-text-secondary)" />
                                  <span className={styles['lumen-group-popover-item-title']}>
                                    {c.title || c.type}
                                  </span>
                                </div>
                                <span className={styles['lumen-group-popover-item-badge']}>
                                  {c.type}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Color styling managed in Card Properties inspector */}

              {/* Auto Order & Resize Button */}
              {member_cards.length > 0 && (
                <button
                  type="button"
                  className={styles['lumen-group-icon-btn']}
                  onClick={handle_auto_order_and_resize}
                  title="Auto-order 1-column stack and auto-resize group frame"
                >
                  <ListOrdered size={12} />
                  <span>Auto-Order</span>
                </button>
              )}

              {/* Sort Menu Button */}
              {member_cards.length > 1 && (
                <div className={styles['lumen-group-popover-anchor']}>
                  <button
                    type="button"
                    className={`${styles['lumen-group-icon-btn']} ${is_sort_popover_open ? styles['lumen-group-action-btn-active'] : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      set_is_sort_popover_open(!is_sort_popover_open);
                      set_is_add_popover_open(false);
                      set_is_color_popover_open(false);
                    }}
                    title="Sort options for 1-column stack"
                  >
                    <ArrowUpDown size={12} />
                    <span>Sort</span>
                  </button>

                  {/* Sort Options Dropdown */}
                  {is_sort_popover_open && (
                    <div
                      ref={sort_popover_ref}
                      className={`${styles['lumen-group-popover']} ${styles['lumen-group-popover-right']}`}
                      style={{ width: 170 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles['lumen-group-popover-header']}>
                        <span>Sort 1-Column</span>
                        <button
                          type="button"
                          className={styles['lumen-group-popover-close']}
                          onClick={() => set_is_sort_popover_open(false)}
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <div className={styles['lumen-group-popover-content']} style={{ padding: 4 }}>
                        <button
                          type="button"
                          className={styles['lumen-group-popover-item']}
                          onClick={(e) => handle_sort('current', e)}
                        >
                          <ListOrdered size={12} />
                          <span>Auto Order Stack</span>
                        </button>
                        <button
                          type="button"
                          className={styles['lumen-group-popover-item']}
                          onClick={(e) => handle_sort('title', e)}
                        >
                          <ArrowDownAZ size={12} />
                          <span>Sort Alphabetical</span>
                        </button>
                        <button
                          type="button"
                          className={styles['lumen-group-popover-item']}
                          onClick={(e) => handle_sort('type', e)}
                        >
                          <Layers size={12} />
                          <span>Sort by Card Type</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fit Bounds */}
              {member_cards.length > 0 && (
                <button
                  type="button"
                  className={styles['lumen-group-icon-btn']}
                  onClick={handle_fit_bounds}
                  title="Auto-resize group frame to fit all cards inside"
                >
                  <Maximize2 size={12} />
                  <span>Fit</span>
                </button>
              )}

              {/* Column Width Quick Switcher in Header Toolbar */}
              {member_cards.length > 0 && (
                <div className={styles['lumen-group-width-group']} title="Single column width">
                  <span className={styles['lumen-group-width-label']}>Col:</span>
                  <button
                    type="button"
                    className={`${styles['lumen-group-pill-btn']} ${current_column_width === 320 ? styles['lumen-group-pill-btn-active'] : ''}`}
                    onClick={(e) => handle_change_column_width(320, e)}
                    title="320px compact column"
                  >
                    320
                  </button>
                  <button
                    type="button"
                    className={`${styles['lumen-group-pill-btn']} ${current_column_width === 360 ? styles['lumen-group-pill-btn-active'] : ''}`}
                    onClick={(e) => handle_change_column_width(360, e)}
                    title="360px standard column"
                  >
                    360
                  </button>
                  <button
                    type="button"
                    className={`${styles['lumen-group-pill-btn']} ${current_column_width === 420 ? styles['lumen-group-pill-btn-active'] : ''}`}
                    onClick={(e) => handle_change_column_width(420, e)}
                    title="420px wide column"
                  >
                    420
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top Controls: Body Content + Member Cards Ribbon (Measured in Top Chrome) */}
        {!is_collapsed && (
          <div className={styles['lumen-group-top-body-section']}>
            {/* Group Body Content (Text Description / Notes) */}
            {(card.content || is_editing_content) ? (
              <div
                className={styles['lumen-group-content-box']}
                style={{
                  backgroundColor: bg_color ? 'rgba(255, 255, 255, 0.72)' : undefined,
                  borderColor: bg_color ? 'rgba(0, 0, 0, 0.1)' : undefined,
                }}
              >
                <div className={styles['lumen-group-content-header']}>
                  <span
                    className={styles['lumen-group-content-label']}
                    style={{ color: text_color || undefined }}
                  >
                    <FileText size={10} />
                    <span>Group Notes / Description</span>
                  </span>
                  <div className={styles['lumen-group-content-actions']}>
                    <button
                      type="button"
                      className={styles['lumen-group-content-mini-btn']}
                      onClick={(e) => {
                        e.stopPropagation();
                        set_is_editing_content(!is_editing_content);
                      }}
                      title={is_editing_content ? 'Close edit mode' : 'Edit body content text'}
                    >
                      {is_editing_content ? <Check size={11} /> : <Pencil size={10} />}
                    </button>
                    <button
                      type="button"
                      className={styles['lumen-group-content-mini-btn']}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCard(card.id, { content: '' }, true);
                        set_is_editing_content(false);
                        autoLayoutGroupColumn(card.id);
                      }}
                      title="Clear body content"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>

                {is_editing_content ? (
                  <textarea
                    ref={textarea_ref}
                    className={styles['lumen-group-content-textarea']}
                    style={{ color: text_color || undefined }}
                    value={card.content || ''}
                    placeholder="Type group notes, objective, checklist summary, or guidelines..."
                    onChange={handle_content_change}
                    onBlur={handle_content_blur}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className={styles['lumen-group-content-display']}
                    style={{ color: text_color || undefined }}
                    onClick={(e) => {
                      e.stopPropagation();
                      set_is_editing_content(true);
                    }}
                    title="Click to edit group body text"
                  >
                    {card.content}
                  </div>
                )}
              </div>
            ) : (
              <div
                className={styles['lumen-group-content-add-prompt']}
                onClick={(e) => {
                  e.stopPropagation();
                  set_is_editing_content(true);
                }}
                title="Add text note or description to this group"
              >
                <Type size={11} />
                <span>+ Add body text / notes</span>
              </div>
            )}

            {/* Member Cards Ribbon (shows order #1, #2, ... and reorder arrows) */}
            {member_cards.length > 0 && (
              <div className={styles['lumen-group-members-ribbon']}>
                <span className={styles['lumen-group-ribbon-label']}>
                  <Layers size={10} />
                  <span>Stack ({member_cards.length}):</span>
                </span>
                {member_cards.map((m, idx) => {
                  const Icon = get_card_type_icon(m.type);
                  const is_first = idx === 0;
                  const is_last = idx === member_cards.length - 1;
                  return (
                    <div
                      key={m.id}
                      className={styles['lumen-group-member-chip']}
                      onClick={(e) => handle_select_member_card(m.id, e)}
                      title={`#${idx + 1}: ${m.title || m.type} (Click to focus)`}
                    >
                      <span className={styles['lumen-group-chip-index']}>
                        #{idx + 1}
                      </span>
                      <Icon size={11} opacity={0.7} />
                      <span className={styles['lumen-group-chip-text']}>
                        {m.title || m.type}
                      </span>

                      {/* Reorder Up Button */}
                      <button
                        type="button"
                        disabled={is_first}
                        className={styles['lumen-group-chip-reorder-btn']}
                        onClick={(e) => handle_move_member_up(m.id, e)}
                        title="Move card up in 1-column stack"
                      >
                        <ChevronUp size={10} />
                      </button>

                      {/* Reorder Down Button */}
                      <button
                        type="button"
                        disabled={is_last}
                        className={styles['lumen-group-chip-reorder-btn']}
                        onClick={(e) => handle_move_member_down(m.id, e)}
                        title="Move card down in 1-column stack"
                      >
                        <ChevronDown size={10} />
                      </button>

                      {/* Remove Button */}
                      <button
                        type="button"
                        className={styles['lumen-group-chip-remove-btn']}
                        onClick={(e) => handle_remove_member(m.id, e)}
                        title="Remove from group"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Group Body (Houses Cards Physical Space & Bottom Drop Zone) */}
      {!is_collapsed && (
        <div className={styles['lumen-group-body']}>
          {/* Member Cards Spacer: reserves physical DOM height so drop zone stays strictly at bottom below all cards */}
          {member_cards.length > 0 && (
            <div
              className={styles['lumen-group-cards-spacer']}
              style={{ minHeight: Math.max(0, 16 + member_cards_total_height + 16) }}
            />
          )}

          {/* Empty Drop Zone when group has no cards */}
          {member_cards.length === 0 && (
            <div
              className={`${styles['lumen-group-empty-zone']} ${is_drop_active ? styles['lumen-group-empty-zone-active'] : ''}`}
              style={{
                color: text_color || undefined,
                borderColor: is_drop_active ? undefined : (text_color ? 'rgba(0,0,0,0.2)' : undefined),
              }}
            >
              <div className={styles['lumen-group-empty-icon']} style={{ color: text_color || undefined }}>
                <Boxes size={20} />
              </div>
              <div className={styles['lumen-group-empty-title']} style={{ color: text_color || undefined }}>
                {is_drop_active ? 'Release to Drop into Group' : 'Empty 1-Column Group'}
              </div>
              <div className={styles['lumen-group-empty-text']} style={{ color: text_color || undefined, opacity: 0.85 }}>
                {is_drop_active
                  ? 'Card will be automatically appended to the 1-column stack and the group frame will resize.'
                  : 'Drag cards into this container or use quick buttons below. Cards auto-stack in 1 column and the frame auto-resizes.'}
              </div>
              <div className={styles['lumen-group-quick-add-row']}>
                <button
                  type="button"
                  className={styles['lumen-group-quick-btn']}
                  onClick={(e) => handle_quick_create_card('note', e)}
                >
                  <FileText size={11} color="#ca8a04" />
                  <span>+ Note</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-group-quick-btn']}
                  onClick={(e) => handle_quick_create_card('tasklist', e)}
                >
                  <CheckSquare size={11} color="#16a34a" />
                  <span>+ Checklist</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-group-quick-btn']}
                  onClick={(e) => handle_quick_create_card('image', e)}
                >
                  <ImageIcon size={11} color="#2563eb" />
                  <span>+ Image</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-group-quick-btn']}
                  onClick={(e) => handle_quick_create_card('link', e)}
                >
                  <Link2 size={11} color="#9333ea" />
                  <span>+ Link</span>
                </button>
                <button
                  type="button"
                  className={styles['lumen-group-quick-btn']}
                  onClick={(e) => handle_quick_create_card('stock', e)}
                >
                  <TrendingUp size={11} color="#059669" />
                  <span>+ Stock</span>
                </button>
              </div>
            </div>
          )}

          {/* Optimized Interactive Drop Target strictly at Bottom */}
          {member_cards.length > 0 && (
            <div
              className={`${styles['lumen-group-drop-zone']} ${is_drop_active ? styles['lumen-group-drop-zone-active'] : ''}`}
              style={{
                color: text_color || undefined,
                borderColor: is_drop_active ? undefined : (text_color ? 'rgba(0,0,0,0.2)' : undefined),
              }}
              onClick={(e) => {
                e.stopPropagation();
                set_is_add_popover_open(true);
              }}
              title="Drag cards here or click to add"
            >
              <Plus size={12} />
              <span>
                {is_drop_active
                  ? 'Release to insert card into 1-column stack'
                  : 'Drop card here or click to add to 1-column stack'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Collapsed State Bar */}
      {is_collapsed && (
        <div className={styles['lumen-group-collapsed-hint']}>
          <span>{member_cards.length} cards contained in 1-column stack</span>
          <button
            type="button"
            className={styles['lumen-group-action-btn']}
            onClick={handle_toggle_collapse}
          >
            <span>Expand</span>
            <ChevronDown size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
