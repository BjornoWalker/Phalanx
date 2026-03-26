import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard, SparePiece, ChessboardProvider } from 'react-chessboard';
import type { PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard';

interface PositionSetupProps {
  onSetPosition: (fen: string) => void;
  onCancel: () => void;
  boardTheme?: string;
  pieceSet?: string;
}

const BOARD_THEMES: Record<string, { dark: string; light: string }> = {
  green: { dark: '#779952', light: '#edeed1' },
  brown: { dark: '#b58863', light: '#f0d9b5' },
  blue: { dark: '#5b7aa6', light: '#dee3e6' },
  purple: { dark: '#7b61a6', light: '#e8dff5' },
  gray: { dark: '#86888a', light: '#cbcccb' },
};

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Convert a position object to FEN piece placement string
function positionToPlacement(pos: Record<string, string>): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const file of 'abcdefgh') {
      const sq = `${file}${rank}`;
      const piece = pos[sq];
      if (piece) {
        if (empty > 0) { row += empty; empty = 0; }
        // piece format from react-chessboard: "wK", "bP", etc.
        const color = piece[0]; // 'w' or 'b'
        const type = piece[1]; // 'K', 'Q', 'R', 'B', 'N', 'P'
        row += color === 'w' ? type.toUpperCase() : type.toLowerCase();
      } else {
        empty++;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

export default function PositionSetup({
  onSetPosition,
  onCancel,
  boardTheme = 'green',
}: PositionSetupProps) {
  const [position, setPosition] = useState<Record<string, string>>(() => {
    // Parse starting position into position object
    const game = new Chess(STARTING_FEN);
    const pos: Record<string, string> = {};
    const board = game.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const sq = piece.square;
          const key = `${piece.color === 'w' ? 'w' : 'b'}${piece.type.toUpperCase()}`;
          pos[sq] = key;
        }
      }
    }
    return pos;
  });

  const [sideToMove, setSideToMove] = useState<'w' | 'b'>('w');
  const [fenInput, setFenInput] = useState(STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [castling, setCastling] = useState({ K: true, Q: true, k: true, q: true });

  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.green;

  const buildFen = useCallback((): string => {
    const placement = positionToPlacement(position);
    let castleStr = '';
    if (castling.K) castleStr += 'K';
    if (castling.Q) castleStr += 'Q';
    if (castling.k) castleStr += 'k';
    if (castling.q) castleStr += 'q';
    if (!castleStr) castleStr = '-';
    return `${placement} ${sideToMove} ${castleStr} - 0 1`;
  }, [position, sideToMove, castling]);

  const handlePieceDrop = useCallback(({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!targetSquare) return false;
    setPosition((prev) => {
      const next = { ...prev };
      // Remove from source (if not spare piece)
      if (sourceSquare && !piece.isSparePiece) {
        delete next[sourceSquare];
      }
      // Place on target
      next[targetSquare] = piece.pieceType;
      return next;
    });
    return true;
  }, []);

  // Auto-update castling rights based on king/rook placement
  useEffect(() => {
    setCastling({
      K: position['e1'] === 'wK' && position['h1'] === 'wR',
      Q: position['e1'] === 'wK' && position['a1'] === 'wR',
      k: position['e8'] === 'bK' && position['h8'] === 'bR',
      q: position['e8'] === 'bK' && position['a8'] === 'bR',
    });
  }, [position]);

  // Right-click to remove a piece
  const handleSquareRightClick = useCallback(({ square }: SquareHandlerArgs) => {
    setPosition((prev) => {
      const next = { ...prev };
      delete next[square];
      return next;
    });
  }, []);

  const handleLoadFen = useCallback(() => {
    try {
      new Chess(fenInput.trim());
      setFenError(null);
      // Parse FEN into position object
      const game = new Chess(fenInput.trim());
      const pos: Record<string, string> = {};
      const board = game.board();
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          const piece = board[rank][file];
          if (piece) {
            pos[piece.square] = `${piece.color === 'w' ? 'w' : 'b'}${piece.type.toUpperCase()}`;
          }
        }
      }
      setPosition(pos);

      const parts = fenInput.trim().split(' ');
      setSideToMove((parts[1] || 'w') as 'w' | 'b');
      const c = parts[2] || '-';
      setCastling({
        K: c.includes('K'),
        Q: c.includes('Q'),
        k: c.includes('k'),
        q: c.includes('q'),
      });
    } catch {
      setFenError('Invalid FEN position');
    }
  }, [fenInput]);

  const handleSetPosition = useCallback(() => {
    const fen = buildFen();
    try {
      new Chess(fen); // validate
      onSetPosition(fen);
    } catch {
      setFenError('Invalid position — check piece placement');
    }
  }, [buildFen, onSetPosition]);

  const handleClear = useCallback(() => {
    setPosition({});
    setCastling({ K: false, Q: false, k: false, q: false });
  }, []);

  const handleStartingPosition = useCallback(() => {
    const game = new Chess(STARTING_FEN);
    const pos: Record<string, string> = {};
    const board = game.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          pos[piece.square] = `${piece.color === 'w' ? 'w' : 'b'}${piece.type.toUpperCase()}`;
        }
      }
    }
    setPosition(pos);
    setSideToMove('w');
    setCastling({ K: true, Q: true, k: true, q: true });
  }, []);

  const whitePieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'];
  const blackPieces = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="rounded-xl p-6 flex gap-6 max-w-4xl"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Board with spare pieces */}
        <div className="flex flex-col items-center gap-3">
          {/* Black spare pieces */}
          <ChessboardProvider
            options={{
              position: buildFen(),
              onPieceDrop: handlePieceDrop,
              onSquareRightClick: handleSquareRightClick,
              darkSquareStyle: { backgroundColor: theme.dark },
              lightSquareStyle: { backgroundColor: theme.light },
              animationDurationInMs: 0,
              boardStyle: { borderRadius: '4px' },
            }}
          >
            <div className="flex gap-1 justify-center">
              {blackPieces.map((p) => (
                <div key={p} className="w-10 h-10">
                  <SparePiece pieceType={p} />
                </div>
              ))}
            </div>
            <div style={{ width: 400, height: 400 }}>
              <Chessboard />
            </div>
            <div className="flex gap-1 justify-center">
              {whitePieces.map((p) => (
                <div key={p} className="w-10 h-10">
                  <SparePiece pieceType={p} />
                </div>
              ))}
            </div>
          </ChessboardProvider>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Drag pieces onto the board. Right-click to remove.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 w-[240px]">
          <h3 className="text-lg font-semibold">Setup Position</h3>

          {/* Side to move */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Side to Move
            </label>
            <div className="flex gap-2">
              {(['w', 'b'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setSideToMove(c)}
                  className="flex-1 py-1.5 rounded text-sm font-medium cursor-pointer"
                  style={{
                    backgroundColor: sideToMove === c ? 'var(--bg-tertiary)' : 'transparent',
                    border: sideToMove === c ? '2px solid var(--accent-green)' : '2px solid var(--border-color)',
                    color: sideToMove === c ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {c === 'w' ? 'White' : 'Black'}
                </button>
              ))}
            </div>
          </div>

          {/* Castling */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Castling Rights
            </label>
            <div className="grid grid-cols-2 gap-1">
              {([
                { key: 'K' as const, label: 'White O-O' },
                { key: 'Q' as const, label: 'White O-O-O' },
                { key: 'k' as const, label: 'Black O-O' },
                { key: 'q' as const, label: 'Black O-O-O' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCastling((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer"
                  style={{
                    backgroundColor: castling[key] ? 'var(--bg-tertiary)' : 'transparent',
                    border: castling[key] ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                    color: castling[key] ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <span>{castling[key] ? '✓' : '○'}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* FEN input */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Load from FEN
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                value={fenInput}
                onChange={(e) => { setFenInput(e.target.value); setFenError(null); }}
                className="flex-1 px-2 py-1.5 rounded text-xs font-mono outline-none"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Paste FEN..."
              />
              <button
                onClick={handleLoadFen}
                className="px-2 py-1.5 rounded text-xs font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                Load
              </button>
            </div>
            {fenError && (
              <p className="text-xs mt-1" style={{ color: '#ca2c2c' }}>{fenError}</p>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={handleStartingPosition}
              className="flex-1 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              Starting Position
            </button>
            <button
              onClick={handleClear}
              className="flex-1 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              Clear Board
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSetPosition}
              className="flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
            >
              Set Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
