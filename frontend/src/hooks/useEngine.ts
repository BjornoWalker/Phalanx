import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketManager } from '../services/websocket';
import {
  getCachedAnalysis,
  setCachedAnalysis,
  clearOldEntries,
} from '../services/analysisCache';

interface WdlResult {
  wins: number;
  draws: number;
  losses: number;
}

interface TablebaseResult {
  wdl: number;  // 2=win, 1=cursed win, 0=draw, -1=blessed loss, -2=loss
  dtz: number | null;
}

interface AnalysisResult {
  evaluation: number;
  evaluationCp: number;
  isMate: boolean;
  mateIn: number | null;
  bestMove: string;
  bestMoveSan: string;
  topLines: string[][];
  classification: string | null;
  cpLoss: number | null;
  depth: number;
  tablebase: TablebaseResult | null;
  wdl: WdlResult | null;
  engineName: string;
}

interface UseEngineReturn {
  evaluation: number | null;
  evaluationCp: number | null;
  isMate: boolean;
  mateIn: number | null;
  bestMove: string | null;
  bestMoveSan: string | null;
  topLines: string[][];
  tablebase: TablebaseResult | null;
  wdl: WdlResult | null;
  engineName: string | null;
  classification: string | null;
  cpLoss: number | null;
  isAnalyzing: boolean;
  isConnected: boolean;
  analyzePosition: (fen: string, moveUci?: string, fenBefore?: string) => void;
}

export function useEngine(engineChoice: string = 'stockfish'): UseEngineReturn {
  const wsRef = useRef<WebSocketManager | null>(null);
  const engineChoiceRef = useRef(engineChoice);
  engineChoiceRef.current = engineChoice; // always latest value

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Track the last-requested FEN so we can cache the response
  const lastRequestRef = useRef<{ fen: string; depth: number; multipv: number; hasMove: boolean } | null>(null);

  // Evict old cache entries on mount
  useEffect(() => {
    clearOldEntries(30).catch(() => {});
  }, []);

  useEffect(() => {
    const ws = new WebSocketManager('/ws/analysis');
    wsRef.current = ws;

    const unsubscribe = ws.onMessage((data: unknown) => {
      const msg = data as Record<string, unknown>;
      if (msg.type === 'result') {
        const analysisResult: AnalysisResult = {
          evaluation: msg.evaluation as number,
          evaluationCp: msg.evaluation_cp as number,
          isMate: msg.is_mate as boolean,
          mateIn: msg.mate_in as number | null,
          bestMove: msg.best_move as string,
          bestMoveSan: msg.best_move_san as string,
          topLines: (msg.top_lines as string[][]) || [],
          classification: (msg.classification as string) || null,
          cpLoss: (msg.cp_loss as number) ?? null,
          depth: msg.depth as number,
          tablebase: (msg.tablebase as TablebaseResult) || null,
          wdl: (msg.wdl as WdlResult) || null,
          engineName: (msg.engine as string) || 'stockfish',
        };
        setResult(analysisResult);
        setIsAnalyzing(false);

        // Cache the result (only for position-only requests, not move classifications)
        const req = lastRequestRef.current;
        if (req && !req.hasMove) {
          setCachedAnalysis(req.fen, req.depth, req.multipv, analysisResult).catch(() => {});
        }
      } else if (msg.type === 'error') {
        console.error('Analysis error:', msg.message);
        setIsAnalyzing(false);
      }
    });

    ws.connect();

    const checkConnection = setInterval(() => {
      setIsConnected(ws.isConnected);
    }, 500);

    return () => {
      unsubscribe();
      clearInterval(checkConnection);
      ws.close();
    };
  }, []);

  const analyzePosition = useCallback(
    (fen: string, moveUci?: string, fenBefore?: string) => {
      const depth = 20;
      const multipv = 3;

      // Clear stale result immediately so the UI doesn't show
      // the previous position's best move / eval during the lookup
      setResult(null);

      // For position-only analysis (no move classification), check cache first
      if (!moveUci) {
        getCachedAnalysis(fen, depth, multipv)
          .then((cached) => {
            if (cached) {
              setResult({
                evaluation: cached.evaluation,
                evaluationCp: cached.evaluationCp,
                isMate: cached.isMate,
                mateIn: cached.mateIn,
                bestMove: cached.bestMove,
                bestMoveSan: cached.bestMoveSan,
                topLines: cached.topLines,
                classification: cached.classification,
                cpLoss: cached.cpLoss,
                depth: cached.depth,
                tablebase: null,
                wdl: null,
                engineName: engineChoiceRef.current,
              });
              // Don't set isAnalyzing — instant return
              return;
            }
            // Cache miss — send to engine
            sendToEngine(fen, depth, multipv, moveUci, fenBefore);
          })
          .catch(() => {
            // Cache error — send to engine
            sendToEngine(fen, depth, multipv, moveUci, fenBefore);
          });
        return;
      }

      // Move classification always goes to engine (needs before/after eval)
      sendToEngine(fen, depth, multipv, moveUci, fenBefore);
    },
    []
  );

  function sendToEngine(
    fen: string,
    depth: number,
    multipv: number,
    moveUci?: string,
    fenBefore?: string,
  ) {
    lastRequestRef.current = { fen, depth, multipv, hasMove: !!moveUci };
    setIsAnalyzing(true);
    wsRef.current?.send({
      type: 'analyze',
      fen,
      move: moveUci,
      fen_before: fenBefore,
      depth,
      multipv,
      engine: engineChoiceRef.current,
    });
  }

  return {
    evaluation: result?.evaluation ?? null,
    evaluationCp: result?.evaluationCp ?? null,
    isMate: result?.isMate ?? false,
    mateIn: result?.mateIn ?? null,
    bestMove: result?.bestMove ?? null,
    bestMoveSan: result?.bestMoveSan ?? null,
    topLines: result?.topLines ?? [],
    classification: result?.classification ?? null,
    cpLoss: result?.cpLoss ?? null,
    tablebase: result?.tablebase ?? null,
    wdl: result?.wdl ?? null,
    engineName: result?.engineName ?? null,
    isAnalyzing,
    isConnected,
    analyzePosition,
  };
}
