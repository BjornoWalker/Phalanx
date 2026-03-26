import { useState, useCallback, useRef } from 'react';

export interface GameSummary {
  url: string;
  pgn: string;
  time_control: string;
  time_class: string;
  end_time: number;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

export interface ParsedGame {
  white: string;
  black: string;
  date: string;
  result: string;
  white_elo: number | null;
  black_elo: number | null;
  time_control: string;
  moves: string[];
  pgn: string;
}

export interface AnalyzedMove {
  ply: number;
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  eval_before: number;
  eval_after: number;
  cp_loss: number;
  classification: string;
  best_move_uci: string;
  best_move_san: string;
  top_lines: string[][];
}

export interface GameAnalysis {
  moves: AnalyzedMove[];
  white_accuracy: number;
  black_accuracy: number;
  white_breakdown: Record<string, number>;
  black_breakdown: Record<string, number>;
  eval_graph: number[];
}

type ReviewState = 'idle' | 'loading_games' | 'game_list' | 'analyzing' | 'reviewing';

interface UseGameReviewReturn {
  state: ReviewState;
  error: string | null;
  games: GameSummary[];
  parsedGames: ParsedGame[];
  analysis: GameAnalysis | null;
  selectedGamePgn: string | null;
  selectedGameInfo: { white: string; black: string; whiteRating?: number; blackRating?: number } | null;
  analyzeProgress: string;
  fetchGames: (username: string, count?: number) => Promise<void>;
  fetchLichessGames: (username: string, count?: number) => Promise<void>;
  uploadPgn: (file: File) => Promise<void>;
  selectGame: (pgn: string) => Promise<void>;
  selectParsedGame: (game: ParsedGame) => Promise<void>;
  cancelAnalysis: () => void;
  reset: () => void;
}

export function useGameReview(): UseGameReviewReturn {
  const [state, setState] = useState<ReviewState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [parsedGames, setParsedGames] = useState<ParsedGame[]>([]);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [selectedGamePgn, setSelectedGamePgn] = useState<string | null>(null);
  const [selectedGameInfo, setSelectedGameInfo] = useState<{ white: string; black: string; whiteRating?: number; blackRating?: number } | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const fetchGames = useCallback(async (username: string, count: number = 50) => {
    setState('loading_games');
    setError(null);
    try {
      const normalized = username.trim().toLowerCase();
      const res = await fetch(`/api/games/chesscom/${encodeURIComponent(normalized)}?count=${count}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Failed to fetch games (${res.status})`);
      }
      const data = await res.json();
      setGames(data.games);
      setParsedGames([]);
      setState('game_list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch games');
      setState('idle');
    }
  }, []);

  const fetchLichessGames = useCallback(async (username: string, count: number = 50) => {
    setState('loading_games');
    setError(null);
    try {
      const normalized = username.trim().toLowerCase();
      const res = await fetch(`/api/games/lichess/${encodeURIComponent(normalized)}?count=${count}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Failed to fetch Lichess games (${res.status})`);
      }
      const data = await res.json();
      setGames(data.games);
      setParsedGames([]);
      setState('game_list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch Lichess games');
      setState('idle');
    }
  }, []);

  const uploadPgn = useCallback(async (file: File) => {
    setState('loading_games');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/games/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to parse PGN file');
      }
      const data = await res.json();
      setParsedGames(data.games);
      setGames([]);
      setState('game_list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload PGN');
      setState('idle');
    }
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState('game_list');
    setAnalyzeProgress('');
  }, []);

  const runAnalysis = useCallback(async (pgn: string, moves?: string[]) => {
    // Cancel any previous analysis
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('analyzing');
    setSelectedGamePgn(pgn);
    setAnalyzeProgress('Starting analysis...');
    setError(null);

    try {
      // Scale depth based on game length for reasonable analysis times
      // Short games (<20 moves): depth 15 for better accuracy
      // Medium games (20-60): depth 12
      // Long games (60+): depth 10 to avoid blocking the server
      const moveCount = moves?.length || 40;
      const depth = moveCount < 20 ? 15 : moveCount < 60 ? 12 : 10;

      const body: Record<string, unknown> = { depth, multipv: 1 };
      if (moves && moves.length > 0) {
        body.moves = moves;
        setAnalyzeProgress(`Analyzing ${moves.length} moves (depth ${depth})...`);
      } else {
        body.pgn = pgn;
        setAnalyzeProgress(`Analyzing game (depth ${depth})...`);
      }

      // Set a timeout proportional to game length (min 30s, max 120s)
      const timeoutMs = Math.max(30000, Math.min(120000, moveCount * 1000));
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch('/api/games/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Analysis failed');
      }

      clearTimeout(timeoutId);
      const data: GameAnalysis = await res.json();
      setAnalysis(data);
      setState('reviewing');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return; // cancelled by user
      }
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setState('game_list');
    }
  }, []);

  const selectGame = useCallback(async (pgn: string) => {
    // Find matching game to extract player info
    const match = games.find((g) => g.pgn === pgn);
    if (match) {
      setSelectedGameInfo({
        white: match.white.username,
        black: match.black.username,
        whiteRating: match.white.rating,
        blackRating: match.black.rating,
      });
    }
    await runAnalysis(pgn);
  }, [runAnalysis, games]);

  const selectParsedGame = useCallback(async (game: ParsedGame) => {
    setSelectedGameInfo({
      white: game.white,
      black: game.black,
      whiteRating: game.white_elo ?? undefined,
      blackRating: game.black_elo ?? undefined,
    });
    await runAnalysis(game.pgn, game.moves);
  }, [runAnalysis]);

  const reset = useCallback(() => {
    setState('idle');
    setGames([]);
    setParsedGames([]);
    setAnalysis(null);
    setSelectedGamePgn(null);
    setSelectedGameInfo(null);
    setError(null);
  }, []);

  return {
    state,
    error,
    games,
    parsedGames,
    analysis,
    selectedGamePgn,
    selectedGameInfo,
    analyzeProgress,
    fetchGames,
    fetchLichessGames,
    uploadPgn,
    selectGame,
    selectParsedGame,
    cancelAnalysis,
    reset,
  };
}
