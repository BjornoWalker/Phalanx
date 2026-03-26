import { useState, useCallback } from 'react';
import { Chess } from 'chess.js';

export interface RepertoireLine {
  id: string;
  name: string;
  color: 'white' | 'black';
  moves: string[];       // UCI
  moves_san: string[];   // SAN
  last_drilled: string | null;
  interval_days: number;
  ease_factor: number;
  correct_count: number;
  incorrect_count: number;
}

type DrillState = 'idle' | 'loading' | 'drilling' | 'correct' | 'incorrect';

interface UseRepertoireReturn {
  // Line management
  lines: RepertoireLine[];
  isLoading: boolean;
  fetchLines: (color?: string) => Promise<void>;
  importPgn: (pgn: string, color: string) => Promise<number>;
  deleteLine: (id: string) => Promise<void>;

  // Drill mode
  drillState: DrillState;
  currentLine: RepertoireLine | null;
  drillPosition: string;
  drillMoveIndex: number;
  drillFeedback: string | null;
  boardOrientation: 'white' | 'black';
  startDrill: (color?: string) => Promise<void>;
  submitDrillMove: (from: string, to: string) => boolean;
  nextDrill: () => void;
}

export function useRepertoire(): UseRepertoireReturn {
  const [lines, setLines] = useState<RepertoireLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Drill state
  const [drillState, setDrillState] = useState<DrillState>('idle');
  const [currentLine, setCurrentLine] = useState<RepertoireLine | null>(null);
  const [drillPosition, setDrillPosition] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [drillMoveIndex, setDrillMoveIndex] = useState(0);
  const [drillFeedback, setDrillFeedback] = useState<string | null>(null);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [drillBoard, setDrillBoard] = useState<Chess>(new Chess());

  const fetchLines = useCallback(async (color?: string) => {
    setIsLoading(true);
    try {
      const url = color ? `/api/repertoire/lines?color=${color}` : '/api/repertoire/lines';
      const res = await fetch(url);
      const data = await res.json();
      setLines(data.lines || []);
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  const importPgn = useCallback(async (pgn: string, color: string): Promise<number> => {
    const res = await fetch('/api/repertoire/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pgn, color }),
    });
    const data = await res.json();
    await fetchLines();
    return data.imported || 0;
  }, [fetchLines]);

  const deleteLine = useCallback(async (id: string) => {
    await fetch(`/api/repertoire/lines/${id}`, { method: 'DELETE' });
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const startDrill = useCallback(async (color?: string) => {
    setDrillState('loading');
    setDrillFeedback(null);
    try {
      const url = color ? `/api/repertoire/drill?color=${color}` : '/api/repertoire/drill';
      const res = await fetch(url);
      if (!res.ok) {
        setDrillFeedback('No lines available. Import some openings first!');
        setDrillState('idle');
        return;
      }
      const line: RepertoireLine = await res.json();
      setCurrentLine(line);
      setBoardOrientation(line.color as 'white' | 'black');

      // Set up the board and play opponent moves until it's the player's turn
      const board = new Chess();
      let moveIdx = 0;

      // If player is black, first move is opponent's (white) — play it automatically
      if (line.color === 'black' && line.moves.length > 0) {
        const uci = line.moves[0];
        board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
        moveIdx = 1;
      }

      setDrillBoard(board);
      setDrillPosition(board.fen());
      setDrillMoveIndex(moveIdx);
      setDrillState('drilling');
      setDrillFeedback(`Play the ${line.name} line — ${line.moves_san.length} moves`);
    } catch {
      setDrillFeedback('Failed to load drill.');
      setDrillState('idle');
    }
  }, []);

  const submitDrillMove = useCallback((from: string, to: string): boolean => {
    if (!currentLine || drillState !== 'drilling') return false;

    const expectedUci = currentLine.moves[drillMoveIndex];
    const playedUci = from + to;

    if (playedUci === expectedUci) {
      // Correct — apply the move
      const board = drillBoard;
      board.move({ from, to, promotion: expectedUci[4] || undefined });
      const nextIdx = drillMoveIndex + 1;

      // Check if line is complete
      if (nextIdx >= currentLine.moves.length) {
        setDrillPosition(board.fen());
        setDrillMoveIndex(nextIdx);
        setDrillState('correct');
        setDrillFeedback('Line complete! Well done.');
        // Record success
        fetch('/api/repertoire/drill/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_id: currentLine.id, correct: true }),
        }).catch(() => {});
        return true;
      }

      // Play opponent's response
      const oppUci = currentLine.moves[nextIdx];
      board.move({ from: oppUci.slice(0, 2), to: oppUci.slice(2, 4), promotion: oppUci[4] || undefined });
      const afterOppIdx = nextIdx + 1;

      if (afterOppIdx >= currentLine.moves.length) {
        // Line ends on opponent's move
        setDrillPosition(board.fen());
        setDrillMoveIndex(afterOppIdx);
        setDrillState('correct');
        setDrillFeedback('Line complete! Well done.');
        fetch('/api/repertoire/drill/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_id: currentLine.id, correct: true }),
        }).catch(() => {});
        return true;
      }

      setDrillPosition(board.fen());
      setDrillMoveIndex(afterOppIdx);
      setDrillFeedback(`Good! Continue the line... (${afterOppIdx}/${currentLine.moves.length})`);
      return true;
    } else {
      // Incorrect
      const expectedSan = currentLine.moves_san[drillMoveIndex];
      setDrillState('incorrect');
      setDrillFeedback(`Incorrect. The move was ${expectedSan}.`);
      fetch('/api/repertoire/drill/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_id: currentLine.id, correct: false }),
      }).catch(() => {});
      return false;
    }
  }, [currentLine, drillState, drillMoveIndex, drillBoard]);

  const nextDrill = useCallback(() => {
    setDrillState('idle');
    setCurrentLine(null);
    setDrillFeedback(null);
    setDrillMoveIndex(0);
  }, []);

  return {
    lines,
    isLoading,
    fetchLines,
    importPgn,
    deleteLine,
    drillState,
    currentLine,
    drillPosition,
    drillMoveIndex,
    drillFeedback,
    boardOrientation,
    startDrill,
    submitDrillMove,
    nextDrill,
  };
}
