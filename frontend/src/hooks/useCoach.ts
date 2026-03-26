import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { WebSocketManager } from '../services/websocket';
import { playMoveSound, playCaptureSound, playNotifySound } from '../services/sounds';
import { useSettings } from '../contexts/SettingsContext';
import type { CoachMessage } from '../components/CoachChat/CoachChat';

type CoachState = 'setup' | 'playing' | 'game_over';

interface UseCoachReturn {
  state: CoachState;
  position: string;
  boardOrientation: 'white' | 'black';
  messages: CoachMessage[];
  isEngineThinking: boolean;
  gameOverReason: string | null;
  difficulty: string;
  playerColor: 'white' | 'black' | 'auto';
  setDifficulty: (d: string) => void;
  setPlayerColor: (c: 'white' | 'black' | 'auto') => void;
  startGame: () => void;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  resetGame: () => void;
}

let msgIdCounter = 0;

export function useCoach(): UseCoachReturn {
  const { settings } = useSettings();
  const [state, setState] = useState<CoachState>('setup');
  const [position, setPosition] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | 'auto'>('auto');
  const [resolvedColor, setResolvedColor] = useState<'white' | 'black'>('white');

  const wsRef = useRef<WebSocketManager | null>(null);
  const gameRef = useRef(new Chess());
  const streamingMsgRef = useRef<number | null>(null);

  useEffect(() => {
    const ws = new WebSocketManager('/ws/coach');
    wsRef.current = ws;

    const unsubscribe = ws.onMessage((data: unknown) => {
      const msg = data as Record<string, unknown>;

      if (msg.type === 'analysis') {
        // Start a new coaching message with the classification
        const id = ++msgIdCounter;
        streamingMsgRef.current = id;
        setMessages((prev) => [
          ...prev,
          {
            id,
            type: 'coach',
            text: '',
            classification: msg.classification as string,
            isStreaming: true,
          },
        ]);
      } else if (msg.type === 'coaching') {
        // Template mode: complete message
        const currentId = streamingMsgRef.current;
        if (currentId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentId
                ? { ...m, text: msg.text as string, isStreaming: false }
                : m
            )
          );
          streamingMsgRef.current = null;
        }
      } else if (msg.type === 'coaching_token') {
        // LLM mode: streaming token
        const currentId = streamingMsgRef.current;
        if (currentId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentId
                ? { ...m, text: m.text + (msg.token as string) }
                : m
            )
          );
        }
      } else if (msg.type === 'engine_move') {
        // Engine made a move
        const uci = msg.uci as string;
        const san = msg.san as string;
        const fenAfter = msg.fen_after as string;

        if (uci) {
          try {
            gameRef.current.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
          } catch {
            // fallback: load FEN directly
            gameRef.current.load(fenAfter);
          }
          setPosition(fenAfter);

          // Play sound for engine move
          san.includes('x') ? playCaptureSound() : playMoveSound();

          // Finish streaming message
          const currentId = streamingMsgRef.current;
          if (currentId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentId ? { ...m, isStreaming: false } : m
              )
            );
            streamingMsgRef.current = null;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: ++msgIdCounter,
              type: 'system',
              text: `Engine plays ${san}`,
            },
          ]);
        }
        setIsEngineThinking(false);
      } else if (msg.type === 'game_over') {
        const reason = msg.reason as string;
        setGameOverReason(reason);
        setState('game_over');
        playNotifySound();
        setIsEngineThinking(false);

        const currentId = streamingMsgRef.current;
        if (currentId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentId ? { ...m, isStreaming: false } : m
            )
          );
          streamingMsgRef.current = null;
        }

        setMessages((prev) => [
          ...prev,
          { id: ++msgIdCounter, type: 'system', text: `Game over: ${reason}` },
        ]);
      } else if (msg.type === 'ready') {
        // WebSocket setup confirmed
      }
    });

    ws.connect();

    return () => {
      unsubscribe();
      ws.close();
    };
  }, []);

  const startGame = useCallback(async () => {
    gameRef.current = new Chess();
    setMessages([]);
    setGameOverReason(null);

    // Resolve 'auto' to a random color
    const color: 'white' | 'black' =
      playerColor === 'auto'
        ? (Math.random() < 0.5 ? 'white' : 'black')
        : playerColor;
    setResolvedColor(color);

    // Send setup to WebSocket
    wsRef.current?.send({
      type: 'setup',
      difficulty,
      coaching_mode: settings.coaching_mode,
      verbosity: settings.coach_verbosity,
      llm_model: settings.llm_model,
      personality: settings.coach_avatar,
    });

    // Start the game via REST
    const res = await fetch('/api/coach/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_color: color, difficulty }),
    });
    const data = await res.json();

    if (data.engine_move) {
      // Engine played first (player is black)
      try {
        gameRef.current.move({
          from: data.engine_move.uci.slice(0, 2),
          to: data.engine_move.uci.slice(2, 4),
        });
      } catch {
        gameRef.current.load(data.fen);
      }
      setMessages([{
        id: ++msgIdCounter,
        type: 'system',
        text: `Engine plays ${data.engine_move.san}`,
      }]);
    }

    setPosition(data.fen);
    setState('playing');
  }, [difficulty, playerColor]);

  const makeMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const game = gameRef.current;
    try {
      const move = game.move({ from, to, promotion: promotion || 'q' });
      if (!move) return false;

      const fenBefore = new Chess(position).fen(); // position before this move
      setPosition(game.fen());
      setIsEngineThinking(true);

      // Play sound for player's move
      move.captured ? playCaptureSound() : playMoveSound();

      // Send move to WebSocket for coaching + engine response
      wsRef.current?.send({
        type: 'move',
        fen: fenBefore,
        move: move.from + move.to + (move.promotion || ''),
        coaching_mode: settings.coaching_mode,
      verbosity: settings.coach_verbosity,
      });

      return true;
    } catch {
      return false;
    }
  }, [position]);

  const resetGame = useCallback(() => {
    setState('setup');
    setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setMessages([]);
    setGameOverReason(null);
    gameRef.current = new Chess();
  }, []);

  return {
    state,
    position,
    boardOrientation: resolvedColor,
    messages,
    isEngineThinking,
    gameOverReason,
    difficulty,
    playerColor,
    setDifficulty,
    setPlayerColor,
    startGame,
    makeMove,
    resetGame,
  };
}
