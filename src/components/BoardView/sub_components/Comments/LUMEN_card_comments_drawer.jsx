import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Users,
  ChevronDown,
  Sparkles,
  FileText,
  CornerDownRight,
  SmilePlus,
} from 'lucide-react';

import styles from './LUMEN_card_comments_drawer.module.css';
import LUMEN_user_avatar from '../Common/LUMEN_user_avatar.jsx';
import {
  activeCommentsCardIdSignal,
  closeCardCommentsDrawer,
  cardCommentsSignal,
  currentUserSignal,
  activeUsersSignal,
  isWsConnectedSignal,
  postCardComment,
  deleteCardComment,
  toggleCommentReaction,
  switchUserProfile,
  COLLABORATOR_PROFILES,
} from '../../signals/realtimeState.js';
import { activeBoardSignal, COMMON_REACTION_EMOJIS } from '../../signals/boardState.js';

// Format human friendly time ago string
function format_time_ago(timestamp) {
  if (!timestamp) return 'Just now';
  const diff_ms = Date.now() - timestamp;
  const diff_mins = Math.floor(diff_ms / 60000);
  if (diff_mins < 1) return 'Just now';
  if (diff_mins < 60) return `${diff_mins}m ago`;
  const diff_hours = Math.floor(diff_mins / 60);
  if (diff_hours < 24) return `${diff_hours}h ago`;
  const diff_days = Math.floor(diff_hours / 24);
  return `${diff_days}d ago`;
}

// Build threaded comments hierarchy: root comments with nested replies array
function build_comment_threads(comments_list) {
  if (!Array.isArray(comments_list)) return [];
  const comment_map = new Map();
  const root_threads = [];

  for (const raw_cm of comments_list) {
    if (!raw_cm) continue;
    const cm_id = raw_cm.id || raw_cm.card_comment_code;
    const cm_parent_id = raw_cm.parent_id || raw_cm.card_comment_code_parent || null;
    const cm_text = raw_cm.text || raw_cm.card_comment_text || '';
    const cm_created_at =
      raw_cm.created_at ||
      (raw_cm.time_create ? new Date(raw_cm.time_create).getTime() : Date.now());
    const normalized_cm = {
      ...raw_cm,
      id: cm_id,
      card_comment_code: cm_id,
      parent_id: cm_parent_id,
      card_comment_code_parent: cm_parent_id,
      text: cm_text,
      card_comment_text: cm_text,
      created_at: cm_created_at,
      replies: [],
    };
    comment_map.set(cm_id, normalized_cm);
  }

  // Recursive root finder for deeply nested replies to keep them in the parent thread
  function get_root_id(parent_id) {
    let curr = comment_map.get(parent_id);
    let visited = new Set();
    while (curr && curr.parent_id && comment_map.has(curr.parent_id) && !visited.has(curr.id)) {
      visited.add(curr.id);
      curr = comment_map.get(curr.parent_id);
    }
    return curr ? curr.id : null;
  }

  for (const raw_cm of comments_list) {
    if (!raw_cm) continue;
    const cm_id = raw_cm.id || raw_cm.card_comment_code;
    const item = comment_map.get(cm_id);
    if (!item) continue;
    if (!item.parent_id) {
      root_threads.push(item);
    } else {
      const root_id = get_root_id(item.parent_id);
      if (root_id && comment_map.has(root_id)) {
        comment_map.get(root_id).replies.push(item);
      } else {
        root_threads.push(item);
      }
    }
  }

  return root_threads;
}

export default function LUMEN_card_comments_drawer({
  on_post_comment,
  on_delete_comment,
} = {}) {
  useSignals();
  const card_id = activeCommentsCardIdSignal.value;
  const [comment_draft, set_comment_draft] = useState('');
  const [replying_to, set_replying_to] = useState(null);
  const [active_rx_popover_id, set_active_rx_popover_id] = useState(null);
  const [custom_rx_input, set_custom_rx_input] = useState('');
  const [is_profiles_open, set_is_profiles_open] = useState(false);
  const list_end_ref = useRef(null);
  const textarea_ref = useRef(null);

  const current_board = activeBoardSignal.value;
  const card = (current_board.cards || []).find((c) => c.id === card_id);
  const comments = (card_id && cardCommentsSignal.value[card_id]) || [];
  const current_user = currentUserSignal.value;
  const comment_threads = build_comment_threads(comments);

  // Auto-scroll to bottom of comments when new comments arrive
  useEffect(() => {
    if (card_id) {
      list_end_ref.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [card_id, comments.length]);

  // Focus textarea when drawer opens or when card changes
  useEffect(() => {
    if (card_id) {
      set_replying_to(null);
      set_comment_draft('');
      setTimeout(() => textarea_ref.current?.focus(), 100);
    }
  }, [card_id]);

  if (!card_id || !card) return null;

  const handle_start_reply = (target_comment, root_comment = null) => {
    set_replying_to({
      id: target_comment.id,
      root_id: root_comment ? root_comment.id : target_comment.id,
      user_name: target_comment.user_name,
      user_color: target_comment.user_color,
      user_avatar: target_comment.user_avatar,
      text: target_comment.text,
    });
    setTimeout(() => textarea_ref.current?.focus(), 50);
  };

  const handle_cancel_reply = () => {
    set_replying_to(null);
  };

  const handle_submit = async (e) => {
    if (e) e.preventDefault();
    if (!comment_draft.trim()) return;
    const parent_id = replying_to ? replying_to.root_id : null;
    const reply_to_user_name = replying_to ? replying_to.user_name : null;
    const text_payload = comment_draft.trim();
    if (typeof on_post_comment === 'function') {
      try {
        await on_post_comment(card_id, {
          text: text_payload,
          parent_id,
          reply_to_user_name,
        });
      } catch (err) {
        console.warn('[Comments] on_post_comment callback error:', err);
      }
    }
    postCardComment(card_id, text_payload, parent_id, reply_to_user_name);
    set_comment_draft('');
    set_replying_to(null);
  };

  const handle_delete = async (comment_id) => {
    if (typeof on_delete_comment === 'function') {
      try {
        await on_delete_comment(card_id, comment_id);
      } catch (err) {
        console.warn('[Comments] on_delete_comment callback error:', err);
      }
    }
    deleteCardComment(card_id, comment_id);
  };

  const handle_keydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handle_submit();
    }
    if (e.key === 'Escape') {
      if (active_rx_popover_id) {
        set_active_rx_popover_id(null);
      } else if (replying_to) {
        handle_cancel_reply();
      } else {
        closeCardCommentsDrawer();
      }
    }
  };

  // Render emoji reaction badges & quick reaction popover for a comment or reply
  const render_comment_reactions = (item) => {
    const rx_list = Array.isArray(item.reactions) ? item.reactions : [];
    const is_popover_open = active_rx_popover_id === item.id;

    return (
      <div className={styles['lumen-comment-reactions-bar']} onClick={(e) => e.stopPropagation()}>
        {rx_list.map((rx) => {
          const is_user_reacted = Array.isArray(rx.users) && rx.users.includes(current_user.id);
          const reacting_names = (rx.users || []).map((uid) => {
            if (uid === current_user.id) return 'You';
            const prof = COLLABORATOR_PROFILES.find((p) => p.id === uid);
            return prof ? prof.name : 'Collaborator';
          });
          const rx_title = reacting_names.length > 0
            ? `${reacting_names.join(', ')} reacted with ${rx.emoji} (Click to toggle)`
            : `${rx.count} reaction`;

          return (
            <button
              key={rx.emoji}
              type="button"
              className={`${styles['lumen-comment-rx-chip']} ${
                is_user_reacted ? styles['lumen-comment-rx-chip-active'] : ''
              }`}
              onClick={() => toggleCommentReaction(card_id, item.id, rx.emoji)}
              title={rx_title}
            >
              <span className={styles['lumen-comment-rx-emoji']}>{rx.emoji}</span>
              <span className={styles['lumen-comment-rx-count']}>{rx.count}</span>
              {Array.isArray(rx.users) && rx.users.length > 0 && (
                <span className={styles['lumen-comment-rx-user-dots']}>
                  {rx.users.slice(0, 3).map((uid) => {
                    const prof = COLLABORATOR_PROFILES.find((p) => p.id === uid);
                    return (
                      <span
                        key={uid}
                        className={styles['lumen-comment-rx-user-dot']}
                        style={{ backgroundColor: prof?.color || '#2563eb' }}
                        title={uid === current_user.id ? 'You' : (prof?.name || 'User')}
                      >
                        {prof?.avatar || 'U'}
                      </span>
                    );
                  })}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Add Reaction Button & Popover */}
        <div className={styles['lumen-comment-add-rx-wrap']}>
          <button
            type="button"
            className={styles['lumen-comment-add-rx-btn']}
            onClick={() => {
              set_active_rx_popover_id(is_popover_open ? null : item.id);
              set_custom_rx_input('');
            }}
            title="React to comment with emoji"
          >
            <SmilePlus size={11} />
            <span>+</span>
          </button>

          {is_popover_open && (
            <div className={styles['lumen-comment-rx-popover']} onClick={(e) => e.stopPropagation()}>
              <div className={styles['lumen-comment-rx-popover-head']}>
                <span>React</span>
                <button
                  type="button"
                  className={styles['lumen-comment-rx-popover-close']}
                  onClick={() => set_active_rx_popover_id(null)}
                >
                  <X size={11} />
                </button>
              </div>

              <div className={styles['lumen-comment-rx-grid']}>
                {COMMON_REACTION_EMOJIS.slice(0, 8).map((emoji) => {
                  const rx = rx_list.find((r) => r.emoji === emoji);
                  const is_reacted = rx && Array.isArray(rx.users) && rx.users.includes(current_user.id);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`${styles['lumen-comment-rx-btn']} ${
                        is_reacted ? styles['lumen-comment-rx-btn-active'] : ''
                      }`}
                      onClick={() => {
                        toggleCommentReaction(card_id, item.id, emoji);
                        set_active_rx_popover_id(null);
                      }}
                      title={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>

              <form
                className={styles['lumen-comment-rx-custom-form']}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom_rx_input.trim()) {
                    toggleCommentReaction(card_id, item.id, custom_rx_input.trim());
                    set_custom_rx_input('');
                    set_active_rx_popover_id(null);
                  }
                }}
              >
                <input
                  type="text"
                  className={styles['lumen-comment-rx-custom-input']}
                  value={custom_rx_input}
                  onChange={(e) => set_custom_rx_input(e.target.value)}
                  placeholder="Emoji..."
                  autoFocus
                />
                <button
                  type="submit"
                  className={styles['lumen-comment-rx-custom-submit']}
                  disabled={!custom_rx_input.trim()}
                >
                  React
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles['lumen-comments-backdrop']}
      onClick={closeCardCommentsDrawer}
    >
      <aside
        className={styles['lumen-comments-drawer']}
        onClick={(e) => e.stopPropagation()}
        aria-label="Card Comments & Team Discussion"
      >
        {/* Drawer Header */}
        <div className={styles['lumen-comments-header']}>
          <div className={styles['lumen-comments-header-left']}>
            <span className={styles['lumen-comments-card-badge']}>
              <MessageSquare size={12} />
              <span>{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
            </span>
            <span className={styles['lumen-comments-title']} title={card.title || card.type}>
              {card.title || `${card.type.toUpperCase()} Card`}
            </span>
          </div>

          <div className={styles['lumen-comments-header-actions']}>
            {isWsConnectedSignal.value && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#059669',
                  backgroundColor: '#d1fae5',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
                title="Real-time multi-user WebSocket connected"
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                />
                Live
              </span>
            )}
            <button
              type="button"
              className={styles['lumen-comments-close-btn']}
              onClick={closeCardCommentsDrawer}
              title="Close comments drawer (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* User Identity / Persona Switcher */}
        <div className={styles['lumen-comments-user-bar']}>
          <div className={styles['lumen-comments-user-active']}>
            <LUMEN_user_avatar
              user_avatar={current_user.user_avatar || current_user.avatar}
              user_account={current_user.user_account || current_user.id}
              user_full_name={current_user.name}
              size={22}
              bg_color={current_user.color || '#2563eb'}
            />
            <span className={styles['lumen-comments-user-name']}>
              {current_user.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--lumen-text-muted)' }}>
              ({current_user.role})
            </span>
          </div>

          <button
            type="button"
            className={styles['lumen-comments-switch-btn']}
            onClick={() => set_is_profiles_open(!is_profiles_open)}
            title="Switch collaborator persona to test multi-user"
          >
            <span>Switch user</span>
            <ChevronDown size={11} style={{ marginLeft: 2 }} />
          </button>
        </div>

        {/* Profiles Dropdown Switcher */}
        {is_profiles_open && (
          <div className={styles['lumen-comments-profiles-popover']}>
            <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, color: 'var(--lumen-text-muted)', textTransform: 'uppercase' }}>
              Switch Collaborator Persona
            </div>
            {COLLABORATOR_PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`${styles['lumen-comments-profile-choice']} ${
                  current_user.id === profile.id ? styles['lumen-comments-profile-choice-active'] : ''
                }`}
                onClick={() => {
                  switchUserProfile(profile);
                  set_is_profiles_open(false);
                }}
              >
                <LUMEN_user_avatar
                  user_avatar={profile.user_avatar || profile.avatar}
                  user_account={profile.user_account || profile.id}
                  user_full_name={profile.name}
                  size={22}
                  bg_color={profile.color || '#2563eb'}
                />
                <div className={styles['lumen-comments-profile-info']}>
                  <span className={styles['lumen-comments-profile-name']}>{profile.name}</span>
                  <span className={styles['lumen-comments-profile-role']}>{profile.role}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Comments Scrollable List */}
        <div className={styles['lumen-comments-list']}>
          {comments.length === 0 ? (
            <div className={styles['lumen-comments-empty']}>
              <MessageSquare size={36} className={styles['lumen-comments-empty-icon']} />
              <div className={styles['lumen-comments-empty-title']}>No comments yet</div>
              <div className={styles['lumen-comments-empty-desc']}>
                Collaborate with team members by leaving notes, reviews, and questions on this card.
              </div>
            </div>
          ) : (
            comment_threads.map((thread) => {
              const is_own = thread.user_id === current_user.id;
              const has_replies = thread.replies && thread.replies.length > 0;

              return (
                <div key={thread.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Top-Level Comment */}
                  <div className={styles['lumen-comment-item']}>
                    <LUMEN_user_avatar
                      user_avatar={thread.user_avatar}
                      user_account={thread.user_id}
                      user_full_name={thread.user_name}
                      size={28}
                      bg_color={thread.user_color || '#2563eb'}
                      class_name={styles['lumen-comment-avatar']}
                      title={thread.user_name}
                    />

                    <div className={styles['lumen-comment-content']}>
                      <div className={styles['lumen-comment-meta']}>
                        <span className={styles['lumen-comment-author']}>
                          {thread.user_name}
                        </span>
                        <span className={styles['lumen-comment-time']}>
                          {format_time_ago(thread.created_at)}
                        </span>
                      </div>

                      <div className={styles['lumen-comment-text']}>
                        {thread.text}
                      </div>

                      {/* Comment Emoji Reactions */}
                      {render_comment_reactions(thread)}

                      {/* Comment Actions: Reply & Reply Count */}
                      <div className={styles['lumen-comment-actions']}>
                        <button
                          type="button"
                          className={styles['lumen-comment-reply-btn']}
                          onClick={() => handle_start_reply(thread)}
                          title={`Reply to ${thread.user_name}`}
                        >
                          <CornerDownRight size={11} />
                          <span>Reply</span>
                        </button>

                        {has_replies && (
                          <span className={styles['lumen-comment-thread-count']}>
                            <MessageSquare size={10} />
                            <span>
                              {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                            </span>
                          </span>
                        )}
                      </div>

                      {is_own && (
                        <button
                          type="button"
                          className={styles['lumen-comment-delete-btn']}
                          onClick={() => handle_delete(thread.id)}
                          title="Delete your comment"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested Replies List */}
                  {has_replies && (
                    <div className={styles['lumen-comment-replies-list']}>
                      {thread.replies.map((reply) => {
                        const is_reply_own = reply.user_id === current_user.id;

                        return (
                          <div key={reply.id} className={styles['lumen-reply-item']}>
                            <LUMEN_user_avatar
                              user_avatar={reply.user_avatar}
                              user_account={reply.user_id}
                              user_full_name={reply.user_name}
                              size={22}
                              bg_color={reply.user_color || '#2563eb'}
                              class_name={styles['lumen-reply-avatar']}
                              title={reply.user_name}
                            />

                            <div className={styles['lumen-reply-content']}>
                              <div className={styles['lumen-reply-meta']}>
                                <span className={styles['lumen-reply-author']}>
                                  {reply.user_name}
                                </span>
                                <span className={styles['lumen-reply-time']}>
                                  {format_time_ago(reply.created_at)}
                                </span>
                              </div>

                              <div className={styles['lumen-reply-text']}>
                                <span className={styles['lumen-reply-tag']}>
                                  <CornerDownRight size={9} />
                                  @{reply.reply_to_user_name || thread.user_name}
                                </span>
                                {reply.text}
                              </div>

                              {/* Reply Emoji Reactions */}
                              {render_comment_reactions(reply)}

                              <div className={styles['lumen-reply-actions']}>
                                <button
                                  type="button"
                                  className={styles['lumen-reply-actions-btn']}
                                  onClick={() => handle_start_reply(reply, thread)}
                                  title={`Reply to ${reply.user_name}`}
                                >
                                  <CornerDownRight size={10} />
                                  <span>Reply</span>
                                </button>
                              </div>

                              {is_reply_own && (
                                <button
                                  type="button"
                                  className={styles['lumen-reply-delete-btn']}
                                  onClick={() => handle_delete(reply.id)}
                                  title="Delete your reply"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={list_end_ref} />
        </div>

        {/* Input Footer */}
        <form className={styles['lumen-comments-footer']} onSubmit={handle_submit}>
          {/* Replying Banner when user clicked Reply */}
          {replying_to && (
            <div className={styles['lumen-replying-banner']}>
              <div className={styles['lumen-replying-banner-left']}>
                <CornerDownRight size={12} color="var(--lumen-accent)" />
                <span>
                  Replying to <strong>@{replying_to.user_name}</strong>
                </span>
                {replying_to.text && (
                  <span className={styles['lumen-replying-quote']}>
                    “{replying_to.text.slice(0, 32)}{replying_to.text.length > 32 ? '…' : ''}”
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles['lumen-replying-cancel-btn']}
                onClick={handle_cancel_reply}
                title="Cancel reply (Esc)"
              >
                <X size={12} />
                <span>Cancel</span>
              </button>
            </div>
          )}

          <div className={styles['lumen-comments-input-wrap']}>
            <textarea
              ref={textarea_ref}
              className={styles['lumen-comments-textarea']}
              value={comment_draft}
              onChange={(e) => set_comment_draft(e.target.value)}
              onKeyDown={handle_keydown}
              placeholder={
                replying_to
                  ? `Reply to @${replying_to.user_name}... (Press Enter to post)`
                  : `Comment as ${current_user.name}... (Press Enter to post)`
              }
              rows={2}
            />

            <div className={styles['lumen-comments-input-actions']}>
              <span className={styles['lumen-comments-hint']}>
                Enter to send · Shift+Enter for newline
              </span>

              <button
                type="submit"
                className={styles['lumen-comments-send-btn']}
                disabled={!comment_draft.trim()}
              >
                <Send size={11} />
                <span>{replying_to ? 'Reply' : 'Post'}</span>
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
