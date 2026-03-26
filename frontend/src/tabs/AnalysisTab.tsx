import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/Board/ChessBoard';
import BoardControls from '../components/Board/BoardControls';
import PositionSetup from '../components/Board/PositionSetup';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import EvalBar from '../components/EvalGraph/EvalBar';
import EvalGraph from '../components/EvalGraph/EvalGraph';
import OpeningName from '../components/Board/OpeningName';
import { useChessGame } from '../hooks/useChessGame';
import { useEngine } from '../hooks/useEngine';
import { useOpeningName } from '../hooks/useOpeningName';
import { useSettings } from '../contexts/SettingsContext';
import { playMoveSound, playCaptureSound, playBlunderSound } from '../services/sounds';
import { exportAnnotatedPgn, downloadPgn } from '../services/pgnExport';
import { ROOT_ID } from '../types/gameTree';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import { useIsActiveTab } from '../contexts/ActiveTabContext';

export default function AnalysisTab() {
  const game = useChessGame();
  const { settings } = useSettings();
  const primaryChoice = settings.engine_choice === 'both' ? 'stockfish' : settings.engine_choice;
  const engine = useEngine(primaryChoice);
  const lc0Engine = useEngine('lc0'); // secondary engine for "both" mode
  const isActive = useIsActiveTab('analysis');
  const opening = useOpeningName(game.fenHistory, game.currentIndex);
  const [showBestMove, setShowBestMove] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [evalData, setEvalData] = useState<number[]>([]);
  const [boardFlash, setBoardFlash] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pawnInfo, setPawnInfo] = useState<{ description: string; isolated: {square:string}[]; passed: {square:string}[]; doubled: {file:string}[] } | null>(null);
  const [showPawns, setShowPawns] = useState(false);
  const prevFenRef = useRef<string>('');
  const moveJustPlayedRef = useRef(false);

  const handlePieceDrop = useCallback(
    (from: string, to: string, _piece: string, promotion?: string): boolean => {
      const fenBefore = game.position;
      const result = game.makeMove(from, to, promotion);
      if (result) {
        result.isCapture ? playCaptureSound() : playMoveSound();
        moveJustPlayedRef.current = true;
        engine.analyzePosition(result.fen, result.uci, fenBefore);
        if (settings.engine_choice === 'both') {
          lc0Engine.analyzePosition(result.fen);
        }
        return true;
      }
      return false;
    },
    [game, engine, lc0Engine, settings.engine_choice]
  );

  // When engine returns a result, store classification and trigger blunder alert
  useEffect(() => {
    if (engine.classification !== null && game.currentNodeId !== ROOT_ID) {
      game.setNodeClassification(game.currentNodeId, engine.classification);

      // Blunder alert
      if (settings.blunder_alerts && engine.cpLoss !== null && engine.cpLoss >= settings.blunder_threshold) {
        playBlunderSound();
        setBoardFlash(true);
        setTimeout(() => setBoardFlash(false), 500);
      }
    }
    if (engine.evaluation !== null && game.currentIndex >= 0) {
      setEvalData((prev) => {
        const next = [...prev];
        while (next.length <= game.currentIndex) next.push(0);
        next[game.currentIndex] = engine.evaluation!;
        return next;
      });
    }
  }, [engine.classification, engine.evaluation, game.currentNodeId, game.currentIndex, game.setNodeClassification]);

  // Auto-analyze on navigation (only when tab is active).
  useEffect(() => {
    if (!isActive) return;
    if (game.position !== prevFenRef.current) {
      prevFenRef.current = game.position;
      if (moveJustPlayedRef.current) {
        moveJustPlayedRef.current = false;
        return;
      }
      engine.analyzePosition(game.position);
      if (settings.engine_choice === 'both') {
        lc0Engine.analyzePosition(game.position);
      }
    }
  }, [game.position, engine, lc0Engine, settings.engine_choice, isActive]);

  // Fetch pawn structure when toggled on or position changes
  useEffect(() => {
    if (!showPawns) { setPawnInfo(null); return; }
    fetch('/api/analysis/pawns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen: game.position }),
    })
      .then((r) => r.json())
      .then(setPawnInfo)
      .catch(() => setPawnInfo(null));
  }, [showPawns, game.position]);

  // Reset eval data when game resets
  useEffect(() => {
    if (game.history.length === 0) {
      setEvalData([]);
    }
  }, [game.history.length]);

  // Keyboard navigation (only when this tab is active, skip when typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Cmd+Z = undo (go back)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); game.goBack(); return;
      }
      // Cmd+Shift+Z = redo (go forward)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault(); game.goForward(); return;
      }
      // Cmd+Left / Cmd+Right = go to start/end (Mac-friendly)
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault(); game.goToStart(); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault(); game.goToEnd(); return;
      }

      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); game.goBack(); break;
        case 'ArrowRight': e.preventDefault(); game.goForward(); break;
        case ' ': e.preventDefault(); game.flipBoard(); break;
        case 'Escape': e.preventDefault(); setShowSetup(false); setShowHelp(false); break;
        case '?': e.preventDefault(); setShowHelp((p) => !p); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game, isActive]);

  // Get current node info for board highlights
  const currentNode = game.tree.nodes.get(game.currentNodeId);
  const lastMoveSquare = currentNode && currentNode.uci
    ? currentNode.uci.slice(2, 4)
    : null;
  const currentClassification = currentNode?.classification ?? null;

  const formatEval = (val: number | null, isMate: boolean, mateIn: number | null) => {
    if (isMate && mateIn !== null) return `M${Math.abs(mateIn)}`;
    if (val === null) return '—';
    return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  };

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Eval Bar */}
      <EvalBar
        evaluation={engine.evaluation}
        isMate={engine.isMate}
        mateIn={engine.mateIn}
        tablebase={engine.tablebase}
        height={560}
      />

      {/* Board Section */}
      <div className="flex flex-col items-center">
        <OpeningName eco={opening?.eco ?? null} name={opening?.name ?? null} />
        <div
          className="rounded transition-all duration-300"
          style={{
            boxShadow: boardFlash ? '0 0 20px 4px rgba(202, 44, 44, 0.6)' : 'none',
          }}
        >
        <ChessBoard
          position={game.position}
          onPieceDrop={handlePieceDrop}
          boardOrientation={game.boardOrientation}
          boardWidth={560}
          bestMove={engine.bestMove}
          showBestMoveArrow={showBestMove}
          bestMoveArrowColor={primaryChoice === 'lc0' ? 'rgba(107, 163, 214, 0.8)' : 'rgba(0, 180, 0, 0.7)'}
          lastMoveClassification={currentClassification}
          lastMoveSquare={lastMoveSquare}
          boardTheme={settings.board_theme}
          pieceSet={settings.piece_set}
          onScrollBack={game.goBack}
          onScrollForward={game.goForward}
        />
        </div>
        <BoardControls
          onFlip={game.flipBoard}
          onReset={game.reset}
          onBack={game.goBack}
          onForward={game.goForward}
          onGoToStart={game.goToStart}
          onGoToEnd={game.goToEnd}
          isAtStart={game.isAtStart}
          isAtEnd={game.isAtEnd}
          onSetup={() => setShowSetup(true)}
        />
      </div>

      {/* Position Setup Modal */}
      {showSetup && (
        <PositionSetup
          onSetPosition={(fen) => {
            game.loadFen(fen);
            setShowSetup(false);
            setEvalData([]);
            engine.analyzePosition(fen);
          }}
          onCancel={() => setShowSetup(false)}
          boardTheme={settings.board_theme}
          pieceSet={settings.piece_set}
        />
      )}

      {/* Keyboard shortcuts help */}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}

      {/* Right Panel */}
      <div className="flex flex-col w-[300px] gap-3 overflow-hidden">
        {/* Engine info bar */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: engine.isConnected ? 'var(--accent-green)' : '#ca2c2c',
              }}
            />
            <span style={{ color: engine.isConnected ? 'var(--text-secondary)' : '#ca2c2c' }}>
              {!engine.isConnected ? 'Reconnecting...'
                : engine.isAnalyzing ? 'Analyzing...'
                : (primaryChoice === 'lc0' ? 'Lc0' : 'Stockfish')}
            </span>
          </div>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
            {formatEval(engine.evaluation, engine.isMate, engine.mateIn)}
          </span>
        </div>

        {/* WDL bar (when available from Lc0) */}
        {engine.wdl && (
          <div
            className="px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center gap-2 text-[10px] mb-1">
              <span style={{ color: 'var(--text-muted)' }}>White Win / Draw / Black Win</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
              <span style={{ color: '#e8e8e8' }}>&#9817; {(engine.wdl.wins / 10).toFixed(1)}%</span>
              <span style={{ color: 'var(--text-muted)' }}>&#189; {(engine.wdl.draws / 10).toFixed(1)}%</span>
              <span style={{ color: '#555' }}>&#9823; {(engine.wdl.losses / 10).toFixed(1)}%</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden">
              <div style={{ width: `${engine.wdl.wins / 10}%`, backgroundColor: '#e8e8e8' }} />
              <div style={{ width: `${engine.wdl.draws / 10}%`, backgroundColor: '#888' }} />
              <div style={{ width: `${engine.wdl.losses / 10}%`, backgroundColor: '#333' }} />
            </div>
          </div>
        )}

        {/* Candidate moves */}
        {engine.topLines.length > 0 && (
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
              Candidate Moves
            </div>
            <div className="space-y-1">
              {engine.topLines.map((line, i) => (
                <button
                  key={i}
                  onClick={() => {
                    // Play the first move of this line to explore it
                    if (line[0]) {
                      try {
                        const g = new Chess(game.position);
                        const move = g.move(line[0]);
                        if (move) {
                          game.makeMove(move.from, move.to, move.promotion || undefined);
                        }
                      } catch { /* ignore */ }
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)] font-mono text-left"
                >
                  <span
                    className="font-bold shrink-0"
                    style={{ color: i === 0 ? 'var(--accent-green)' : 'var(--text-primary)' }}
                  >
                    {line[0]}
                  </span>
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>
                    {line.slice(1).join(' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lc0 secondary engine (both mode) */}
        {settings.engine_choice === 'both' && (
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '3px solid #6ba3d6' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold" style={{ color: '#6ba3d6' }}>Lc0</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {lc0Engine.evaluation !== null
                  ? (lc0Engine.evaluation >= 0 ? `+${lc0Engine.evaluation.toFixed(1)}` : lc0Engine.evaluation.toFixed(1))
                  : lc0Engine.isAnalyzing ? '...' : '—'}
              </span>
            </div>
            {lc0Engine.wdl && (
              <div className="mb-1.5">
                <div className="flex items-center gap-2 text-[10px] font-mono mb-0.5">
                  <span style={{ color: '#e8e8e8' }}>&#9817; {(lc0Engine.wdl.wins / 10).toFixed(1)}%</span>
                  <span style={{ color: 'var(--text-muted)' }}>&#189; {(lc0Engine.wdl.draws / 10).toFixed(1)}%</span>
                  <span style={{ color: '#555' }}>&#9823; {(lc0Engine.wdl.losses / 10).toFixed(1)}%</span>
                </div>
                <div className="flex h-1 rounded-full overflow-hidden">
                  <div style={{ width: `${lc0Engine.wdl.wins / 10}%`, backgroundColor: '#e8e8e8' }} />
                  <div style={{ width: `${lc0Engine.wdl.draws / 10}%`, backgroundColor: '#555' }} />
                  <div style={{ width: `${lc0Engine.wdl.losses / 10}%`, backgroundColor: '#333' }} />
                </div>
              </div>
            )}
            {lc0Engine.topLines.length > 0 && (
              <div className="font-mono space-y-0.5">
                {lc0Engine.topLines.map((line, i) => (
                  <div key={i} className="truncate" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>{' '}
                    {line.join(' ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Best move toggle + Export */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowBestMove(!showBestMove)}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: showBestMove ? 'var(--accent-green)' : 'var(--text-muted)',
            }}
          >
            <span>{showBestMove ? '✓' : '○'}</span>
            <span>Best move</span>
          </button>
          <button
            onClick={() => {
              const pgn = exportAnnotatedPgn(game.tree);
              downloadPgn(pgn);
            }}
            disabled={game.history.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Export PGN</span>
          </button>
          <button
            onClick={() => setShowPawns(!showPawns)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: showPawns ? 'var(--accent-green)' : 'var(--text-muted)',
            }}
          >
            <span>{showPawns ? '✓' : '○'}</span>
            <span>Pawns</span>
          </button>
        </div>

        {/* Pawn structure info */}
        {showPawns && pawnInfo && (
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="font-semibold text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
              Pawn Structure
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>{pawnInfo.description}</p>
            {(pawnInfo.isolated.length > 0 || pawnInfo.passed.length > 0 || pawnInfo.doubled.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {pawnInfo.passed.map((p, i) => (
                  <span key={`p${i}`} className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(129,182,76,0.2)', color: '#81b64c' }}>
                    Passed {p.square}
                  </span>
                ))}
                {pawnInfo.isolated.map((p, i) => (
                  <span key={`i${i}`} className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(229,184,11,0.2)', color: '#e5b80b' }}>
                    Isolated {p.square}
                  </span>
                ))}
                {pawnInfo.doubled.map((p, i) => (
                  <span key={`d${i}`} className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(202,44,44,0.2)', color: '#ca2c2c' }}>
                    Doubled {p.file}-file
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Move History — tree mode */}
        <div
          className="flex flex-col flex-1 rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div
            className="px-3 py-2 text-sm font-semibold shrink-0 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <span>Moves</span>
            {game.hasVariations && (
              <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                variations
              </span>
            )}
          </div>
          <MoveHistory
            history={game.history}
            currentIndex={game.currentIndex}
            onMoveClick={game.goToMove}
            displayItems={game.displayItems}
            onNodeClick={game.goToNode}
            onSetNag={game.setNodeNag}
            onSetComment={game.setNodeComment}
            getNodeComment={(id) => game.tree.nodes.get(id)?.comment}
            getNodeNags={(id) => game.tree.nodes.get(id)?.nags}
          />
        </div>

        {/* Eval Graph */}
        <EvalGraph
          evalData={evalData}
          currentIndex={game.currentIndex}
          onClickMove={game.goToMove}
          moveNames={game.history.map((m) => m.san)}
          height={100}
        />

        {game.isGameOver && (
          <div
            className="px-4 py-2 text-center text-sm font-semibold rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            {game.gameOverReason || 'Game Over'}
          </div>
        )}
      </div>
    </div>
  );
}
