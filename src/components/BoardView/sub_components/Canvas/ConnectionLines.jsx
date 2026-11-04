import { useSignals } from '@preact/signals-react/runtime';
import styles from './ConnectionLines.module.css';
import {
  activeBoardSignal,
  deleteConnection,
  connectingSourceSignal,
  tempConnectionLineSignal,
} from '../../signals/boardState.js';

function getCardAnchor(card, targetCard) {
  if (!card) return { x: 0, y: 0 };
  const cX = card.x + card.width / 2;
  const cY = card.y + card.height / 2;

  if (!targetCard) {
    return { x: cX, y: cY };
  }

  const tX = targetCard.x + targetCard.width / 2;
  const tY = targetCard.y + targetCard.height / 2;

  const dx = tX - cX;
  const dy = tY - cY;

  // Decide whether horizontal or vertical exit is better
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      // Exit right
      return { x: card.x + card.width, y: cY, dir: 'right' };
    } else {
      // Exit left
      return { x: card.x, y: cY, dir: 'left' };
    }
  } else {
    if (dy > 0) {
      // Exit bottom
      return { x: cX, y: card.y + card.height, dir: 'bottom' };
    } else {
      // Exit top
      return { x: cX, y: card.y, dir: 'top' };
    }
  }
}

function createCurvedPath(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let cx1 = p1.x + dx * 0.45;
  let cy1 = p1.y;
  let cx2 = p2.x - dx * 0.45;
  let cy2 = p2.y;

  if (p1.dir === 'bottom' || p1.dir === 'top') {
    cy1 = p1.y + dy * 0.45;
    cx1 = p1.x;
    cy2 = p2.y - dy * 0.45;
    cx2 = p2.x;
  }

  return `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;
}

export default function ConnectionLines() {
  useSignals();
  const board = activeBoardSignal.value;
  const cards = board.cards || [];
  const connections = board.connections || [];
  const tempLine = tempConnectionLineSignal.value;

  const cardsMap = new Map();
  cards.forEach((c) => cardsMap.set(c.id, c));

  return (
    <svg className={styles.lumenSvgContainer}>
      <defs>
        <marker
          id="lumen-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#2563eb" />
        </marker>
        <marker
          id="lumen-arrow-dashed"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const fromCard = cardsMap.get(conn.fromId);
        const toCard = cardsMap.get(conn.toId);
        if (!fromCard || !toCard) return null;

        const p1 = getCardAnchor(fromCard, toCard);
        const p2 = getCardAnchor(toCard, fromCard);
        const pathData = createCurvedPath(p1, p2);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const isDashed = conn.style === 'dashed';

        return (
          <g key={conn.id} className={styles.lumenConnGroup}>
            {/* Wider transparent hit area for hover/click */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
              style={{ pointerEvents: 'stroke' }}
            />

            {/* Visible Connection Path */}
            <path
              d={pathData}
              className={`${styles.lumenPath} ${isDashed ? styles.lumenPathDashed : ''}`}
              stroke={conn.color || '#2563eb'}
              markerEnd={isDashed ? 'url(#lumen-arrow-dashed)' : 'url(#lumen-arrow)'}
            />

            {/* Optional Connection Label Pill */}
            {conn.label && (() => {
              const labelText = String(conn.label);
              const labelWidth = Math.max(76, Math.round(labelText.length * 7.5 + 24));
              const halfWidth = labelWidth / 2;
              return (
                <g key={`lbl-${conn.id}`}>
                  <g transform={`translate(${midX}, ${midY})`} style={{ pointerEvents: 'auto' }}>
                    <rect
                      x={-halfWidth}
                      y="-13"
                      width={labelWidth}
                      height="26"
                      rx="6"
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      style={{
                        filter: 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18))',
                      }}
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      className={styles.lumenConnLabel}
                    >
                      {labelText}
                    </text>
                  </g>

                  {/* Delete button on hover */}
                  <g
                    className={styles.lumenDeleteBtn}
                    transform={`translate(${midX + halfWidth + 14}, ${midY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConnection(conn.id);
                    }}
                  >
                    <circle cx="0" cy="0" r="9" fill="#dc2626" />
                    <path
                      d="M -3 -3 L 3 3 M 3 -3 L -3 3"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </g>
                </g>
              );
            })()}

            {!conn.label && (
              /* Delete button on hover when no label */
              <g
                className={styles.lumenDeleteBtn}
                transform={`translate(${midX}, ${midY})`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConnection(conn.id);
                }}
              >
                <circle cx="0" cy="0" r="9" fill="#dc2626" />
                <path
                  d="M -3 -3 L 3 3 M 3 -3 L -3 3"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Temporary connecting line while dragging a new connection */}
      {tempLine && (
        <path
          d={`M ${tempLine.x1} ${tempLine.y1} L ${tempLine.x2} ${tempLine.y2}`}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}
