import { useSignals } from '@preact/signals-react/runtime';
import styles from './LUMEN_collaborator_cursors.module.css';
import { remoteCursorsSignal, currentUserSignal, CLIENT_SESSION_ID } from '../../signals/realtimeState.js';

export default function LUMEN_collaborator_cursors() {
  useSignals();

  const cursors_map = remoteCursorsSignal.value;
  const current_user = currentUserSignal.value;
  const now = Date.now();

  const active_cursors = Object.values(cursors_map).filter((item) => {
    if (!item || !item.user) return false;
    const item_peer_id = item.client_id || item.user.client_id;
    if (item_peer_id) {
      if (item_peer_id === CLIENT_SESSION_ID) return false;
    } else if (item.user.id === current_user.id) {
      return false;
    }
    // Hide stale cursors after 12 seconds of inactivity
    return now - (item.lastActive || 0) < 12000;
  });

  if (active_cursors.length === 0) {
    return null;
  }

  return (
    <div className={styles['lumen-cursor-container']}>
      {active_cursors.map((cursor_item) => {
        const user = cursor_item.user;
        const peer_key = cursor_item.client_id || user.client_id || user.id;
        const x = cursor_item.x || 0;
        const y = cursor_item.y || 0;
        const user_color = user.color || '#2563eb';

        return (
          <div
            key={peer_key}
            className={styles['lumen-collaborator-cursor']}
            style={{
              transform: `translate3d(${x}px, ${y}px, 0)`,
            }}
          >
            {/* SVG Pointer Arrow */}
            <svg
              className={styles['lumen-cursor-pointer']}
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 3.5L19.5 12L12 13.5L8.5 20.5L4.5 3.5Z"
                fill={user_color}
                stroke="#ffffff"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>

            {/* Floating Collaborator Name Pill */}
            <div
              className={styles['lumen-cursor-badge']}
              style={{ backgroundColor: user_color }}
            >
              <span className={styles['lumen-cursor-name']}>{user.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
