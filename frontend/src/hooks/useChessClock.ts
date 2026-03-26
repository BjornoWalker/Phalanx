import { useState, useRef, useCallback, useEffect } from 'react';

export interface TimeControl {
  label: string;
  baseSeconds: number;
  incrementSeconds: number;
}

export const TIME_PRESETS: TimeControl[] = [
  { label: 'No Clock', baseSeconds: 0, incrementSeconds: 0 },
  { label: '1+0 Bullet', baseSeconds: 60, incrementSeconds: 0 },
  { label: '2+1 Bullet', baseSeconds: 120, incrementSeconds: 1 },
  { label: '3+0 Blitz', baseSeconds: 180, incrementSeconds: 0 },
  { label: '3+2 Blitz', baseSeconds: 180, incrementSeconds: 2 },
  { label: '5+0 Blitz', baseSeconds: 300, incrementSeconds: 0 },
  { label: '5+3 Blitz', baseSeconds: 300, incrementSeconds: 3 },
  { label: '10+0 Rapid', baseSeconds: 600, incrementSeconds: 0 },
  { label: '15+10 Rapid', baseSeconds: 900, incrementSeconds: 10 },
];

interface UseChessClockReturn {
  whiteTime: number;  // milliseconds remaining
  blackTime: number;
  activeClock: 'white' | 'black' | null;
  isRunning: boolean;
  isFlagged: 'white' | 'black' | null;
  start: (color: 'white' | 'black') => void;
  switchTurn: () => void;
  pause: () => void;
  reset: (baseMs: number) => void;
  getTimeSpent: () => number; // ms since last switch
}

export function useChessClock(
  baseSeconds: number,
  incrementSeconds: number,
): UseChessClockReturn {
  const baseMs = baseSeconds * 1000;
  const incMs = incrementSeconds * 1000;

  const [whiteTime, setWhiteTime] = useState(baseMs);
  const [blackTime, setBlackTime] = useState(baseMs);
  const [activeClock, setActiveClock] = useState<'white' | 'black' | null>(null);
  const [isFlagged, setIsFlagged] = useState<'white' | 'black' | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSwitchRef = useRef<number>(Date.now());

  const isRunning = activeClock !== null && isFlagged === null;

  // Tick the active clock
  useEffect(() => {
    if (!isRunning || baseSeconds === 0) return;

    intervalRef.current = setInterval(() => {
      if (activeClock === 'white') {
        setWhiteTime((prev) => {
          const next = prev - 100;
          if (next <= 0) {
            setIsFlagged('white');
            return 0;
          }
          return next;
        });
      } else if (activeClock === 'black') {
        setBlackTime((prev) => {
          const next = prev - 100;
          if (next <= 0) {
            setIsFlagged('black');
            return 0;
          }
          return next;
        });
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeClock, isRunning, baseSeconds]);

  const start = useCallback((color: 'white' | 'black') => {
    setActiveClock(color);
    lastSwitchRef.current = Date.now();
  }, []);

  const switchTurn = useCallback(() => {
    if (!activeClock || isFlagged) return;

    // Add increment to the side that just moved
    if (incMs > 0) {
      if (activeClock === 'white') {
        setWhiteTime((prev) => prev + incMs);
      } else {
        setBlackTime((prev) => prev + incMs);
      }
    }

    const next = activeClock === 'white' ? 'black' : 'white';
    setActiveClock(next);
    lastSwitchRef.current = Date.now();
  }, [activeClock, isFlagged, incMs]);

  const pause = useCallback(() => {
    setActiveClock(null);
  }, []);

  const reset = useCallback((newBaseMs: number) => {
    setWhiteTime(newBaseMs);
    setBlackTime(newBaseMs);
    setActiveClock(null);
    setIsFlagged(null);
    lastSwitchRef.current = Date.now();
  }, []);

  const getTimeSpent = useCallback(() => {
    return Date.now() - lastSwitchRef.current;
  }, []);

  return {
    whiteTime,
    blackTime,
    activeClock,
    isRunning,
    isFlagged,
    start,
    switchTurn,
    pause,
    reset,
    getTimeSpent,
  };
}
