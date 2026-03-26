import { useEffect, useRef, useState } from 'react';
import type { MoveRecord } from '../../hooks/useChessGame';
import type { DisplayItem } from '../../types/gameTree';

interface MoveHistoryProps {
  // Legacy linear mode (Review/Coach tabs)
  history: MoveRecord[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
  classifications?: (string | null)[];

  // Tree mode (Analysis tab) — when provided, renders the tree
  displayItems?: DisplayItem[];
  onNodeClick?: (nodeId: string) => void;

  // Annotation callbacks (tree mode only)
  onSetNag?: (nodeId: string, nag: number | null) => void;
  onSetComment?: (nodeId: string, comment: string) => void;

  // Node details for annotations
  getNodeComment?: (nodeId: string) => string | undefined;
  getNodeNags?: (nodeId: string) => number[] | undefined;
}

const CLASSIFICATION_ICONS: Record<string, { icon: string; color: string }> = {
  brilliant: { icon: '!!', color: '#1abc9c' },
  great: { icon: '!', color: '#5682d1' },
  best: { icon: '✓', color: '#81b64c' },
  good: { icon: '○', color: '#81b64c' },
  mistake: { icon: '?', color: '#e5b80b' },
  miss: { icon: '?', color: '#e67e22' },
  blunder: { icon: '??', color: '#ca2c2c' },
};

export default function MoveHistory({
  history,
  currentIndex,
  onMoveClick,
  classifications,
  displayItems,
  onNodeClick,
  onSetNag,
  onSetComment,
  getNodeComment,
  getNodeNags,
}: MoveHistoryProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [collapsedVariations, setCollapsedVariations] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex, displayItems]);

  const toggleCollapse = (nodeId: string) => {
    setCollapsedVariations((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleRightClickMove = (nodeId: string, x: number, y: number) => {
    setContextMenu({ nodeId, x, y });
    setCommentInput(getNodeComment?.(nodeId) || '');
  };

  const closeContextMenu = () => setContextMenu(null);

  // --- Tree rendering mode ---
  if (displayItems && onNodeClick) {
    return (
      <div
        className="flex-1 overflow-y-auto rounded-lg relative"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
        onClick={closeContextMenu}
      >
        <div className="p-2">
          {displayItems.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Play a move to begin
            </p>
          ) : (
            <TreeRenderer
              items={displayItems}
              onNodeClick={onNodeClick}
              activeRef={activeRef}
              collapsedVariations={collapsedVariations}
              onToggleCollapse={toggleCollapse}
              onRightClickMove={onSetNag ? handleRightClickMove : undefined}
              getNodeComment={getNodeComment}
              getNodeNags={getNodeNags}
            />
          )}
        </div>

        {/* Annotation context menu */}
        {contextMenu && onSetNag && (
          <div
            className="fixed z-50 rounded-lg shadow-lg p-2 min-w-[160px]"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 180),
              top: Math.min(contextMenu.y, window.innerHeight - 250),
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-semibold mb-1 px-1" style={{ color: 'var(--text-muted)' }}>
              Annotate
            </div>
            <div className="flex gap-1 mb-2">
              {[
                { nag: 1, label: '!' },
                { nag: 3, label: '!!' },
                { nag: 2, label: '?' },
                { nag: 4, label: '??' },
                { nag: 5, label: '!?' },
                { nag: 6, label: '?!' },
              ].map(({ nag, label }) => {
                const currentNags = getNodeNags?.(contextMenu.nodeId) || [];
                const isActive = currentNags.includes(nag);
                return (
                  <button
                    key={nag}
                    onClick={() => { onSetNag(contextMenu.nodeId, isActive ? null : nag); closeContextMenu(); }}
                    className="px-2 py-1 rounded text-xs font-bold cursor-pointer"
                    style={{
                      backgroundColor: isActive ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {onSetComment && (
              <>
                <div className="text-[10px] font-semibold mb-1 px-1" style={{ color: 'var(--text-muted)' }}>
                  Comment
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add comment..."
                    className="flex-1 px-2 py-1 rounded text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSetComment(contextMenu.nodeId, commentInput);
                        closeContextMenu();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => { onSetComment(contextMenu.nodeId, commentInput); closeContextMenu(); }}
                    className="px-2 py-1 rounded text-xs cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Legacy linear rendering mode ---
  const movePairs: { moveNumber: number; white: MoveRecord; black?: MoveRecord }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  const renderMove = (move: MoveRecord, index: number) => {
    const isActive = index === currentIndex;
    const classification = classifications?.[index];
    const classInfo = classification ? CLASSIFICATION_ICONS[classification] : null;

    return (
      <button
        key={index}
        ref={isActive ? activeRef : null}
        onClick={() => onMoveClick(index)}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-mono cursor-pointer
          transition-colors duration-100 min-w-[70px] text-left
          ${isActive
            ? 'bg-[var(--accent-green)] text-white'
            : 'text-[var(--text-primary)] hover:bg-[var(--border-color)]'
          }
        `}
      >
        <span>{move.san}</span>
        {classInfo && (
          <span
            className="text-xs font-bold ml-auto"
            style={{ color: isActive ? 'white' : classInfo.color }}
          >
            {classInfo.icon}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="flex-1 overflow-y-auto rounded-lg"
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    >
      <div className="p-2">
        {history.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Play a move to begin
          </p>
        ) : (
          <div className="space-y-0.5">
            {movePairs.map((pair) => (
              <div key={pair.moveNumber} className="flex items-center gap-1">
                <span
                  className="text-xs font-mono w-8 text-right shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {pair.moveNumber}.
                </span>
                <div className="flex-1">
                  {renderMove(pair.white, (pair.moveNumber - 1) * 2)}
                </div>
                <div className="flex-1">
                  {pair.black && renderMove(pair.black, (pair.moveNumber - 1) * 2 + 1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tree renderer sub-component ---

function TreeRenderer({
  items,
  onNodeClick,
  activeRef,
  collapsedVariations,
  onToggleCollapse,
  onRightClickMove,
  getNodeComment,
  getNodeNags,
}: {
  items: DisplayItem[];
  onNodeClick: (nodeId: string) => void;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  collapsedVariations: Set<string>;
  onToggleCollapse: (nodeId: string) => void;
  onRightClickMove?: (nodeId: string, x: number, y: number) => void;
  getNodeComment?: (nodeId: string) => string | undefined;
  getNodeNags?: (nodeId: string) => number[] | undefined;
}) {
  // Group mainline moves into pairs for the standard two-column layout.
  // Variations are rendered inline between the mainline rows.

  const elements: React.ReactNode[] = [];
  let i = 0;
  let skipUntilDepth: number | null = null;
  let skipVariationId: string | null = null;

  while (i < items.length) {
    const item = items[i];

    // Handle collapsed variation skipping
    if (skipUntilDepth !== null) {
      if (item.type === 'variation-end' && item.nodeId === skipVariationId) {
        skipUntilDepth = null;
        skipVariationId = null;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (item.type === 'variation-start') {
      const isCollapsed = collapsedVariations.has(item.nodeId);
      if (isCollapsed) {
        // Find the first move in this variation for the preview
        const nextItem = items[i + 1];
        elements.push(
          <div
            key={`vs-${item.nodeId}`}
            className="flex items-center gap-1 cursor-pointer"
            style={{ paddingLeft: `${item.depth * 16}px` }}
            onClick={() => onToggleCollapse(item.nodeId)}
          >
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              ▶
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              {nextItem?.san || '...'}
            </span>
          </div>
        );
        skipUntilDepth = item.depth;
        skipVariationId = item.nodeId;
        i++;
        continue;
      }

      // Expanded variation start
      elements.push(
        <div
          key={`vs-${item.nodeId}`}
          className="flex items-center gap-1 mt-1 cursor-pointer"
          style={{ paddingLeft: `${item.depth * 16}px` }}
          onClick={() => onToggleCollapse(item.nodeId)}
        >
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>▼</span>
        </div>
      );
      i++;
      continue;
    }

    if (item.type === 'variation-end') {
      i++;
      continue;
    }

    // Regular move
    if (item.depth === 0) {
      // Mainline: try to pair white + black
      const whiteItem = !item.isBlack ? item : null;
      const blackItem = item.isBlack ? item : null;
      let pairedBlack: DisplayItem | null = blackItem;

      if (whiteItem && !blackItem) {
        // Check if next item is the paired black move at same depth
        const next = items[i + 1];
        if (next && next.type === 'move' && next.depth === 0 && next.isBlack) {
          pairedBlack = next;
          i++; // consume the black move
        }
      }

      const moveNum = whiteItem?.moveNumber || pairedBlack?.moveNumber || 0;

      elements.push(
        <div key={`ml-${i}`} className="flex items-center gap-1">
          <span
            className="text-xs font-mono w-8 text-right shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {moveNum}.
          </span>
          <div className="flex-1">
            {whiteItem && (
              <MoveButton
                item={whiteItem}
                onClick={onNodeClick}
                activeRef={activeRef}
                onRightClick={onRightClickMove}
                nags={getNodeNags?.(whiteItem.nodeId)}
                comment={getNodeComment?.(whiteItem.nodeId)}
              />
            )}
          </div>
          <div className="flex-1">
            {pairedBlack && (
              <MoveButton
                item={pairedBlack}
                onClick={onNodeClick}
                activeRef={activeRef}
                onRightClick={onRightClickMove}
                nags={getNodeNags?.(pairedBlack.nodeId)}
                comment={getNodeComment?.(pairedBlack.nodeId)}
              />
            )}
          </div>
        </div>
      );
    } else {
      // Variation move: render inline with indentation
      const moveNum = item.moveNumber;
      const prefix = item.isBlack ? `${moveNum}...` : `${moveNum}.`;

      elements.push(
        <div
          key={`var-${item.nodeId}`}
          className="flex items-center gap-1"
          style={{ paddingLeft: `${item.depth * 16}px` }}
        >
          <span
            className="text-xs font-mono w-10 text-right shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {prefix}
          </span>
          <MoveButton
            item={item}
            onClick={onNodeClick}
            activeRef={activeRef}
            onRightClick={onRightClickMove}
            nags={getNodeNags?.(item.nodeId)}
            comment={getNodeComment?.(item.nodeId)}
          />
        </div>
      );
    }

    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

const NAG_SYMBOLS: Record<number, string> = {
  1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!',
};

function MoveButton({
  item,
  onClick,
  activeRef,
  onRightClick,
  nags,
  comment,
}: {
  item: DisplayItem;
  onClick: (nodeId: string) => void;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  onRightClick?: (nodeId: string, x: number, y: number) => void;
  nags?: number[];
  comment?: string;
}) {
  const classInfo = item.classification ? CLASSIFICATION_ICONS[item.classification] : null;
  const isActive = item.isCurrentMove;
  const isVariation = item.depth > 0;
  const nagText = nags?.map((n) => NAG_SYMBOLS[n] || '').join('') || '';

  return (
    <span>
      <button
        ref={isActive ? activeRef : null}
        onClick={() => onClick(item.nodeId)}
        onContextMenu={(e) => {
          if (onRightClick) {
            e.preventDefault();
            onRightClick(item.nodeId, e.clientX, e.clientY);
          }
        }}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono cursor-pointer
          transition-colors duration-100 min-w-[60px] text-left
          ${isVariation ? 'text-xs' : 'text-sm'}
          ${isActive
            ? 'bg-[var(--accent-green)] text-white'
            : isVariation
              ? 'text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
              : 'text-[var(--text-primary)] hover:bg-[var(--border-color)]'
          }
        `}
      >
        <span>{item.san}{nagText && <span style={{ color: isActive ? 'white' : '#e5b80b' }}>{nagText}</span>}</span>
        {classInfo && (
          <span
            className="text-xs font-bold ml-auto"
            style={{ color: isActive ? 'white' : classInfo.color }}
          >
            {classInfo.icon}
          </span>
        )}
      </button>
      {comment && (
        <div className="text-[10px] italic px-2 mt-0.5 mb-1" style={{ color: 'var(--text-muted)' }}>
          {comment}
        </div>
      )}
    </span>
  );
}
