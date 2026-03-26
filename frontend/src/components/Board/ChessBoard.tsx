import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { Arrow, PieceDropHandlerArgs, PieceRenderObject, SquareHandlerArgs } from 'react-chessboard';
import PromotionDialog from './PromotionDialog';

interface ChessBoardProps {
  position: string;
  onPieceDrop: (from: string, to: string, piece: string, promotion?: string) => boolean;
  boardOrientation?: 'white' | 'black';
  boardWidth?: number;
  bestMove?: string | null;
  showBestMoveArrow?: boolean;
  bestMoveArrowColor?: string;
  externalArrows?: Arrow[];
  lastMoveClassification?: string | null;
  lastMoveSquare?: string | null;
  boardTheme?: string;
  pieceSet?: string;
  interactive?: boolean;
  onScrollBack?: () => void;
  onScrollForward?: () => void;
}

const BOARD_THEMES: Record<string, { dark: string; light: string }> = {
  green: { dark: '#779952', light: '#edeed1' },
  brown: { dark: '#b58863', light: '#f0d9b5' },
  blue: { dark: '#5b7aa6', light: '#dee3e6' },
  purple: { dark: '#7b61a6', light: '#e8dff5' },
  gray: { dark: '#86888a', light: '#cbcccb' },
  highContrast: { dark: '#000000', light: '#ffffff' },
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  brilliant: 'rgba(26, 188, 156, 0.6)',
  great: 'rgba(86, 130, 209, 0.6)',
  best: 'rgba(129, 182, 76, 0.6)',
  good: 'rgba(129, 182, 76, 0.4)',
  mistake: 'rgba(229, 184, 11, 0.6)',
  miss: 'rgba(230, 126, 34, 0.6)',
  blunder: 'rgba(202, 44, 44, 0.6)',
};

const LEGAL_MOVE_DOT: React.CSSProperties = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)',
  borderRadius: '50%',
};

const LEGAL_MOVE_CAPTURE: React.CSSProperties = {
  background: 'radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)',
  borderRadius: '50%',
};

const SELECTED_SQUARE: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 0, 0.4)',
};

export default function ChessBoard({
  position,
  onPieceDrop,
  boardOrientation = 'white',
  boardWidth = 560,
  bestMove,
  showBestMoveArrow = true,
  bestMoveArrowColor = 'rgba(0, 180, 0, 0.7)',
  externalArrows,
  lastMoveClassification,
  lastMoveSquare,
  boardTheme = 'green',
  pieceSet,
  interactive = true,
  onScrollBack,
  onScrollForward,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<Set<string>>(new Set());
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to navigate moves
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el || (!onScrollBack && !onScrollForward)) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) onScrollForward?.();
      else if (e.deltaY < 0) onScrollBack?.();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [onScrollBack, onScrollForward]);
  const [legalMoves, setLegalMoves] = useState<Map<string, boolean>>(new Map());

  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.green;

  // Detect if a move is a pawn promotion
  const isPromotionMove = useCallback((from: string, to: string): boolean => {
    try {
      const game = new Chess(position);
      const piece = game.get(from as never);
      if (!piece || piece.type !== 'p') return false;
      const targetRank = to[1];
      return (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1');
    } catch { return false; }
  }, [position]);

  // Build custom pieces renderer when a non-default piece set is selected
  const PIECE_KEYS = ['wP','wN','wB','wR','wQ','wK','bP','bN','bB','bR','bQ','bK'] as const;
  const customPieces: PieceRenderObject | undefined = useMemo(() => {
    if (!pieceSet || pieceSet === 'default') return undefined;
    const obj: PieceRenderObject = {};
    for (const key of PIECE_KEYS) {
      const src = `/pieces/${pieceSet}/${key}.svg`;
      obj[key] = ({ svgStyle } = {}) => (
        <img
          src={src}
          alt={key}
          style={{ ...svgStyle, width: '100%', height: '100%' }}
          draggable={false}
        />
      );
    }
    return obj;
  }, [pieceSet]);

  const arrows: Arrow[] = useMemo(() => {
    const all: Arrow[] = [];
    if (externalArrows) {
      all.push(...externalArrows);
    }
    if (showBestMoveArrow && bestMove && bestMove.length >= 4) {
      all.push({
        startSquare: bestMove.slice(0, 2),
        endSquare: bestMove.slice(2, 4),
        color: bestMoveArrowColor,
      });
    }
    return all;
  }, [externalArrows, showBestMoveArrow, bestMove]);

  // Compute legal moves for a given square
  const getLegalMoves = useCallback((square: string): Map<string, boolean> => {
    const moves = new Map<string, boolean>();
    try {
      const game = new Chess(position);
      const legal = game.moves({ square: square as never, verbose: true });
      for (const move of legal) {
        moves.set(move.to, move.captured !== undefined);
      }
    } catch {
      // invalid position
    }
    return moves;
  }, [position]);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoves(new Map());
  }, []);

  const handlePromotionChoice = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (pendingPromotion) {
      onPieceDrop(pendingPromotion.from, pendingPromotion.to, '', piece);
      setPendingPromotion(null);
      clearSelection();
    }
  }, [pendingPromotion, onPieceDrop, clearSelection]);

  const tryMove = useCallback((from: string, to: string): boolean => {
    setHighlightedSquares(new Set()); // clear annotations on move
    if (isPromotionMove(from, to)) {
      setPendingPromotion({ from, to });
      clearSelection();
      return false;
    }
    return onPieceDrop(from, to, '');
  }, [isPromotionMove, onPieceDrop, clearSelection]);

  // Handle ALL clicks through onSquareClick (fires for both piece and empty squares).
  // We do NOT use onPieceClick because both fire on the same click (event bubbles),
  // causing the selection to be set then immediately cleared.
  const handleSquareClick = useCallback(({ square, piece }: SquareHandlerArgs) => {
    if (!interactive) return;

    const hasPiece = piece !== null;

    // Case 1: A piece is already selected
    if (selectedSquare) {
      // If the clicked square is a legal move target, make the move
      if (legalMoves.has(square)) {
        tryMove(selectedSquare, square);
        clearSelection();
        return;
      }

      // If we clicked the same square, deselect
      if (square === selectedSquare) {
        clearSelection();
        return;
      }

      // If we clicked a different piece that has legal moves, switch to it
      if (hasPiece) {
        const moves = getLegalMoves(square);
        if (moves.size > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves);
          return;
        }
      }

      // Otherwise, deselect
      clearSelection();
      return;
    }

    // Case 2: No piece is selected — select the clicked piece if it has legal moves
    if (hasPiece) {
      const moves = getLegalMoves(square);
      if (moves.size > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves);
      }
    }
  }, [interactive, selectedSquare, legalMoves, onPieceDrop, clearSelection, getLegalMoves]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Classification highlight
    if (lastMoveClassification && lastMoveSquare) {
      const color = CLASSIFICATION_COLORS[lastMoveClassification];
      if (color) {
        styles[lastMoveSquare] = { backgroundColor: color };
      }
    }

    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = { ...styles[selectedSquare], ...SELECTED_SQUARE };
    }

    // Legal move indicators
    for (const [sq, isCapture] of legalMoves) {
      styles[sq] = { ...styles[sq], ...(isCapture ? LEGAL_MOVE_CAPTURE : LEGAL_MOVE_DOT) };
    }

    // Circle highlights (right-click annotations)
    for (const sq of highlightedSquares) {
      styles[sq] = {
        ...styles[sq],
        background: `${styles[sq]?.background || ''} radial-gradient(circle, rgba(235, 97, 80, 0.8) 22%, transparent 22%)`.trim(),
      };
    }

    return styles;
  }, [lastMoveClassification, lastMoveSquare, selectedSquare, legalMoves, highlightedSquares]);

  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!targetSquare) return false;
    clearSelection();
    if (isPromotionMove(sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false; // wait for dialog
    }
    return onPieceDrop(sourceSquare, targetSquare, '');
  }, [onPieceDrop, clearSelection, isPromotionMove]);

  // Clear selection when position changes (move was made externally)
  // This is handled naturally since legalMoves is recomputed from position

  // Determine color for promotion dialog
  const promotionColor = pendingPromotion
    ? (position.split(' ')[1] === 'w' ? 'w' : 'b') as 'w' | 'b'
    : 'w';

  return (
    <div ref={boardContainerRef} style={{ width: boardWidth, height: boardWidth, position: 'relative' }}>
      {/* Promotion dialog */}
      {pendingPromotion && (
        <PromotionDialog
          color={promotionColor}
          onSelect={handlePromotionChoice}
          onCancel={() => setPendingPromotion(null)}
          boardWidth={boardWidth}
          targetSquare={pendingPromotion.to}
          boardOrientation={boardOrientation}
        />
      )}
      <Chessboard
        options={{
          position,
          boardOrientation,
          ...(customPieces && { pieces: customPieces }),
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          onSquareRightClick: ({ square }: { square: string }) => {
            // Toggle circle highlight on right-click (arrows handled by drag)
            setHighlightedSquares((prev) => {
              const next = new Set(prev);
              if (next.has(square)) next.delete(square);
              else next.add(square);
              return next;
            });
          },
          darkSquareStyle: { backgroundColor: theme.dark },
          lightSquareStyle: { backgroundColor: theme.light },
          arrows,
          allowDrawingArrows: true,
          squareStyles,
          animationDurationInMs: 200,
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          },
        }}
      />
    </div>
  );
}
