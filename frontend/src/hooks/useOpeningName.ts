import { useState, useEffect, useCallback, useRef } from 'react';

interface Opening {
  eco: string;
  name: string;
}

type OpeningDB = Record<string, Opening>;

function fenToKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Hook that looks up the current opening name from a static ECO database.
 * The database is loaded once from /openings.json (3,641 openings from Lichess).
 *
 * Accepts the full FEN history and current index so that when navigating
 * backward/forward, it walks back from the current position to find the
 * most recent opening match — ensuring the displayed name is always correct
 * for the current point in the game.
 */
export function useOpeningName(fenHistory: string[], currentIndex: number) {
  const dbRef = useRef<OpeningDB | null>(null);
  const [currentOpening, setCurrentOpening] = useState<Opening | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load the opening database once
  useEffect(() => {
    fetch('/openings.json')
      .then((r) => r.json())
      .then((data: OpeningDB) => {
        dbRef.current = data;
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  const lookupFen = useCallback((fen: string): Opening | null => {
    if (!dbRef.current) return null;
    return dbRef.current[fenToKey(fen)] ?? null;
  }, []);

  // Walk backward from current position to find the most recent opening match
  useEffect(() => {
    if (!isLoaded || !dbRef.current) return;

    // fenHistory[0] is the starting position, fenHistory[1] is after move 1, etc.
    // currentIndex -1 means starting position (before any moves)
    const endIdx = currentIndex + 1; // +1 because fenHistory includes starting pos at [0]

    // Walk backward from current position
    for (let i = endIdx; i >= 0; i--) {
      const fen = fenHistory[i];
      if (!fen) continue;
      const found = lookupFen(fen);
      if (found) {
        setCurrentOpening(found);
        return;
      }
    }

    // No opening found at any point — we're at the starting position with no moves
    setCurrentOpening(null);
  }, [fenHistory, currentIndex, isLoaded, lookupFen]);

  return currentOpening;
}
