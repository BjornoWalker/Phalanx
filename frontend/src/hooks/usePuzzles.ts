import { useState, useCallback } from 'react';

export interface PuzzleInfo {
  puzzle_id: string;
  fen: string;
  setup_move: string;
  rating: number;
  themes: string;
  total_moves: number;
  player_moves: number;
}

export interface HintInfo {
  hint: string;
  from_square?: string;
  to_square?: string;
  san?: string;
  uci?: string;
}

type PuzzleState = 'idle' | 'loading' | 'solving' | 'correct' | 'incorrect' | 'complete';

interface UsePuzzlesReturn {
  state: PuzzleState;
  puzzle: PuzzleInfo | null;
  position: string;
  boardOrientation: 'white' | 'black';
  hint: HintInfo | null;
  hintLevel: number;
  feedback: string | null;
  stats: { solved: number; failed: number; streak: number; bestStreak: number };
  ratingMin: number;
  ratingMax: number;
  selectedTheme: string | null;
  setRatingRange: (min: number, max: number) => void;
  setSelectedTheme: (theme: string | null) => void;
  adaptiveMode: boolean;
  setAdaptiveMode: (v: boolean) => void;
  loadPuzzle: () => Promise<void>;
  makeMove: (from: string, to: string) => Promise<boolean>;
  getHint: () => Promise<void>;
  nextPuzzle: () => void;
}

const STATS_KEY = 'chess_puzzle_stats';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) throw new Error('no stats');
    const data = JSON.parse(raw);
    // Ensure all fields exist (backward compat)
    return {
      solved: data.solved ?? 0,
      failed: data.failed ?? 0,
      streak: data.streak ?? 0,
      bestStreak: data.bestStreak ?? 0,
      todaySolved: data.todaySolved ?? 0,
      todayDate: data.todayDate ?? '',
      weekSolved: data.weekSolved ?? 0,
      weekStart: data.weekStart ?? '',
    };
  } catch { /* ignore */ }
  return { solved: 0, failed: 0, streak: 0, bestStreak: 0, todaySolved: 0, todayDate: '', weekSolved: 0, weekStart: '' };
}

function saveStats(stats: Record<string, unknown>) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export function usePuzzles(): UsePuzzlesReturn {
  const [state, setState] = useState<PuzzleState>('idle');
  const [puzzle, setPuzzle] = useState<PuzzleInfo | null>(null);
  const [position, setPosition] = useState('8/8/8/8/8/8/8/8 w - - 0 1');
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [hint, setHint] = useState<HintInfo | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stats, setStats] = useState(loadStats);
  const [ratingMin, setRatingMin] = useState(800);
  const [ratingMax, setRatingMax] = useState(1600);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [, setRecentResults] = useState<boolean[]>([]); // last 10 results for adaptive

  const setRatingRange = useCallback((min: number, max: number) => {
    setRatingMin(min);
    setRatingMax(max);
  }, []);

  const loadPuzzle = useCallback(async () => {
    setState('loading');
    setHint(null);
    setHintLevel(0);
    setFeedback(null);

    try {
      const params = new URLSearchParams({
        rating_min: ratingMin.toString(),
        rating_max: ratingMax.toString(),
      });
      if (selectedTheme) params.set('theme', selectedTheme);

      const res = await fetch(`/api/puzzles/random?${params}`);
      if (!res.ok) throw new Error('Failed to load puzzle');
      const data: PuzzleInfo = await res.json();

      setPuzzle(data);
      setPosition(data.fen);

      // Determine board orientation based on whose turn it is
      const turn = data.fen.split(' ')[1];
      setBoardOrientation(turn === 'w' ? 'white' : 'black');

      setState('solving');
      setFeedback(`Find the best move (Rating: ${data.rating})`);
    } catch {
      setState('idle');
      setFeedback('Failed to load puzzle. Make sure the puzzle database is installed.');
    }
  }, [ratingMin, ratingMax, selectedTheme]);

  const makeMove = useCallback(async (from: string, to: string): Promise<boolean> => {
    if (!puzzle || state !== 'solving') return false;

    const uci = from + to;

    try {
      const res = await fetch('/api/puzzles/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle_id: puzzle.puzzle_id, move: uci }),
      });
      const data = await res.json();

      if (data.correct) {
        setPosition(data.next_fen);
        setHint(null);
        setHintLevel(0);

        if (data.opponent_move) {
          // Brief pause then show opponent's response
          setFeedback(`Correct! Opponent plays ${data.opponent_move.san}...`);
          setTimeout(() => {
            setPosition(data.opponent_move.fen);
            if (data.complete) {
              finishPuzzle(true);
            } else {
              setFeedback('Find the next move!');
            }
          }, 600);
        } else if (data.complete) {
          finishPuzzle(true);
        } else {
          setFeedback('Correct! Find the next move.');
        }
        return true;
      } else {
        // Incorrect
        setFeedback(`Incorrect. The best move was ${data.expected_san}.`);
        finishPuzzle(false);
        return false;
      }
    } catch {
      return false;
    }
  }, [puzzle, state]);

  function finishPuzzle(solved: boolean) {
    const newStats = { ...loadStats() };
    const today = getToday();
    const week = getWeekStart();

    // Reset daily counter if new day
    if (newStats.todayDate !== today) {
      newStats.todaySolved = 0;
      newStats.todayDate = today;
    }
    // Reset weekly counter if new week
    if (newStats.weekStart !== week) {
      newStats.weekSolved = 0;
      newStats.weekStart = week;
    }

    if (solved) {
      newStats.solved++;
      newStats.streak++;
      newStats.todaySolved++;
      newStats.weekSolved++;
      if (newStats.streak > newStats.bestStreak) newStats.bestStreak = newStats.streak;
      setState('complete');

      // Mastery feedback
      const level = newStats.solved >= 500 ? 'Master' : newStats.solved >= 200 ? 'Expert' : newStats.solved >= 50 ? 'Skilled' : newStats.solved >= 10 ? 'Apprentice' : 'Beginner';
      setFeedback(`Puzzle solved! (${level} — ${newStats.todaySolved} today)`);
    } else {
      newStats.failed++;
      newStats.streak = 0;
      setState('incorrect');
    }
    saveStats(newStats);

    // Adaptive difficulty adjustment
    if (adaptiveMode) {
      setRecentResults((prev) => {
        const next = [...prev, solved].slice(-10); // keep last 10
        const solveRate = next.filter(Boolean).length / next.length;
        // Target ~65% solve rate
        if (next.length >= 5) {
          if (solveRate > 0.85) {
            // Too easy — increase difficulty
            setRatingMin((m) => Math.min(m + 50, 2200));
            setRatingMax((m) => Math.min(m + 50, 2400));
          } else if (solveRate < 0.4) {
            // Too hard — decrease difficulty
            setRatingMin((m) => Math.max(m - 50, 400));
            setRatingMax((m) => Math.max(m - 50, 600));
          }
        }
        return next;
      });
    }
    setStats(newStats);
  }

  const getHint = useCallback(async () => {
    if (!puzzle || state !== 'solving') return;

    const nextLevel = hintLevel + 1;
    try {
      const res = await fetch('/api/puzzles/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle_id: puzzle.puzzle_id, level: nextLevel }),
      });
      const data: HintInfo = await res.json();
      setHint(data);
      setHintLevel(nextLevel);
    } catch { /* ignore */ }
  }, [puzzle, state, hintLevel]);

  const nextPuzzle = useCallback(() => {
    setState('idle');
    setPuzzle(null);
    setHint(null);
    setHintLevel(0);
    setFeedback(null);
    loadPuzzle();
  }, [loadPuzzle]);

  return {
    state,
    puzzle,
    position,
    boardOrientation,
    hint,
    hintLevel,
    feedback,
    stats,
    ratingMin,
    ratingMax,
    selectedTheme,
    setRatingRange,
    setSelectedTheme,
    adaptiveMode,
    setAdaptiveMode,
    loadPuzzle,
    makeMove,
    getHint,
    nextPuzzle,
  };
}
