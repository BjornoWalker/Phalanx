import { useState, useEffect, useCallback, useMemo } from 'react';
import ChessBoard from '../components/Board/ChessBoard';
import BoardControls from '../components/Board/BoardControls';
import MoveHistory from '../components/MoveHistory/MoveHistory';
import EvalBar from '../components/EvalGraph/EvalBar';
import EvalGraph from '../components/EvalGraph/EvalGraph';
import GameSelector from '../components/Review/GameSelector';
import ReviewSummary from '../components/Review/ReviewSummary';
import OpeningName from '../components/Board/OpeningName';
import { useGameReview } from '../hooks/useGameReview';
import { useOpeningName } from '../hooks/useOpeningName';
import { useSettings } from '../contexts/SettingsContext';
import type { MoveRecord } from '../hooks/useChessGame';
import { downloadPgn } from '../services/pgnExport';
import { useIsActiveTab } from '../contexts/ActiveTabContext';

export default function ReviewTab() {
  const isActive = useIsActiveTab('review');
  const review = useGameReview();
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showSummary, setShowSummary] = useState(true);

  // Build move records from analysis
  const moveRecords: MoveRecord[] = review.analysis?.moves.map((m) => ({
    san: m.san,
    uci: m.uci,
    fen: m.fen_after,
    color: (m.ply % 2 === 0 ? 'w' : 'b') as 'w' | 'b',
    isCapture: m.san.includes('x'),
    isCheck: m.san.includes('+') || m.san.includes('#'),
  })) ?? [];

  const classifications = review.analysis?.moves.map((m) => m.classification) ?? [];
  const evalData = review.analysis?.eval_graph ?? [];

  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const currentFen = currentIndex >= 0 ? moveRecords[currentIndex]?.fen ?? startFen : startFen;

  // Build FEN history for opening lookup (startFen + each move's fen_after)
  const reviewFenHistory = useMemo(() => {
    const fens = [startFen];
    if (review.analysis) {
      for (const m of review.analysis.moves) {
        fens.push(m.fen_after);
      }
    }
    return fens;
  }, [review.analysis]);
  const opening = useOpeningName(reviewFenHistory, currentIndex);
  const { settings } = useSettings();
  const currentMove = currentIndex >= 0 ? review.analysis?.moves[currentIndex] : null;

  const goBack = useCallback(() => setCurrentIndex((i) => Math.max(-1, i - 1)), []);
  const goForward = useCallback(
    () => setCurrentIndex((i) => Math.min(moveRecords.length - 1, i + 1)),
    [moveRecords.length]
  );
  const goToStart = useCallback(() => setCurrentIndex(-1), []);
  const goToEnd = useCallback(
    () => setCurrentIndex(moveRecords.length - 1),
    [moveRecords.length]
  );

  // Keyboard nav (only when this tab is active)
  useEffect(() => {
    if (review.state !== 'reviewing' || !isActive) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [review.state, goBack, goForward, isActive]);

  // Reset index when analysis changes
  useEffect(() => {
    if (review.analysis) {
      setCurrentIndex(-1);
      setShowSummary(true);
    }
  }, [review.analysis]);

  // Extract player names
  const whiteName = review.selectedGameInfo?.white || 'White';
  const blackName = review.selectedGameInfo?.black || 'Black';

  // Idle + game selection
  if (review.state === 'idle' || review.state === 'loading_games' || review.state === 'game_list') {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <h2 className="text-lg font-semibold mb-4">Game Review</h2>
        <GameSelector
          onFetchGames={review.fetchGames}
          onFetchLichessGames={review.fetchLichessGames}
          onReset={review.reset}
          onUploadPgn={review.uploadPgn}
          onSelectGame={review.selectGame}
          onSelectParsedGame={review.selectParsedGame}
          games={review.games}
          parsedGames={review.parsedGames}
          isLoading={review.state === 'loading_games'}
          error={review.error}
        />
      </div>
    );
  }

  // Analyzing
  if (review.state === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div
          className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {review.analyzeProgress}
        </p>
        <button
          onClick={review.cancelAnalysis}
          className="px-4 py-1.5 rounded-lg text-xs cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // Reviewing
  return (
    <div className="flex h-full gap-4 p-4">
      {/* Eval Bar */}
      <EvalBar
        evaluation={currentMove?.eval_after ?? null}
        isMate={false}
        mateIn={null}
        height={560}
      />

      {/* Board */}
      <div className="flex flex-col items-center">
        <OpeningName eco={opening?.eco ?? null} name={opening?.name ?? null} />
        {/* Black player (top) */}
        {review.selectedGameInfo && (
          <div className="flex items-center gap-2 mb-1 w-full px-1" style={{ maxWidth: 560 }}>
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#3d3d3d' }} />
            <span className="text-sm font-medium truncate">{review.selectedGameInfo.black}</span>
            {review.selectedGameInfo.blackRating ? (
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                ({review.selectedGameInfo.blackRating})
              </span>
            ) : null}
          </div>
        )}
        <ChessBoard
          position={currentFen}
          onPieceDrop={() => false}
          boardWidth={560}
          bestMove={currentMove?.best_move_uci ?? null}
          showBestMoveArrow={currentIndex >= 0}
          lastMoveClassification={currentMove?.classification ?? null}
          lastMoveSquare={
            currentMove ? currentMove.uci.slice(2, 4) : null
          }
          boardTheme={settings.board_theme}
          pieceSet={settings.piece_set}
          onScrollBack={goBack}
          onScrollForward={goForward}
        />
        {/* White player (bottom) */}
        {review.selectedGameInfo && (
          <div className="flex items-center gap-2 mt-1 w-full px-1" style={{ maxWidth: 560 }}>
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#e8e8e8' }} />
            <span className="text-sm font-medium truncate">{review.selectedGameInfo.white}</span>
            {review.selectedGameInfo.whiteRating ? (
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                ({review.selectedGameInfo.whiteRating})
              </span>
            ) : null}
          </div>
        )}
        <BoardControls
          onFlip={() => {}}
          onReset={() => { review.reset(); }}
          onBack={goBack}
          onForward={goForward}
          onGoToStart={goToStart}
          onGoToEnd={goToEnd}
          isAtStart={currentIndex === -1}
          isAtEnd={currentIndex === moveRecords.length - 1}
        />
      </div>

      {/* Right Panel */}
      <div className="flex flex-col w-[300px] gap-3 overflow-hidden">
        {/* Summary / coach message */}
        {showSummary && review.analysis ? (
          <ReviewSummary
            analysis={review.analysis}
            whiteName={whiteName}
            blackName={blackName}
            onStartReview={() => {
              setShowSummary(false);
              setCurrentIndex(0);
            }}
            onJumpToClassification={(classification) => {
              const idx = review.analysis?.moves.findIndex(
                (m) => m.classification === classification
              );
              if (idx !== undefined && idx >= 0) {
                setShowSummary(false);
                setCurrentIndex(idx);
              }
            }}
            onJumpToMove={(idx) => {
              setShowSummary(false);
              setCurrentIndex(idx);
            }}
          />
        ) : currentMove ? (
          <div
            className="px-3 py-3 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-bold text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor:
                    currentMove.classification === 'blunder' ? '#ca2c2c' :
                    currentMove.classification === 'miss' ? '#e67e22' :
                    currentMove.classification === 'mistake' ? '#e5b80b' :
                    currentMove.classification === 'brilliant' ? '#1abc9c' :
                    currentMove.classification === 'great' ? '#5682d1' :
                    '#81b64c',
                  color: 'white',
                }}
              >
                {currentMove.classification}
              </span>
              <span className="font-mono">{currentMove.san}</span>
              {currentMove.cp_loss > 0 && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  ({currentMove.cp_loss > 0 ? `-${(currentMove.cp_loss / 100).toFixed(1)}` : '0'})
                </span>
              )}
            </div>
            {(currentMove.classification === 'blunder' ||
              currentMove.classification === 'miss' ||
              currentMove.classification === 'mistake') && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Best was <span className="font-mono font-bold">{currentMove.best_move_san}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Move History */}
        <div
          className="flex flex-col flex-1 rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div
            className="px-3 py-2 text-sm font-semibold shrink-0"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            Moves
          </div>
          <MoveHistory
            history={moveRecords}
            currentIndex={currentIndex}
            onMoveClick={setCurrentIndex}
            classifications={classifications}
          />
        </div>

        {/* Eval Graph */}
        <EvalGraph
          evalData={evalData}
          currentIndex={currentIndex}
          onClickMove={setCurrentIndex}
          moveNames={moveRecords.map((m) => m.san)}
          height={100}
        />

        {/* Export + Back */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (review.selectedGamePgn) {
                // Build annotated PGN from original with eval comments
                const moves = review.analysis?.moves ?? [];
                let annotated = review.selectedGamePgn;
                if (moves.length > 0) {
                  // Simple annotation: append eval comments
                  const evalComments = moves.map(
                    (m) => `${m.san} {${m.classification}, eval: ${m.eval_after > 0 ? '+' : ''}${m.eval_after.toFixed(1)}}`
                  ).join(' ');
                  // Replace move section with annotated version
                  const headerEnd = annotated.lastIndexOf(']\n');
                  if (headerEnd >= 0) {
                    annotated = annotated.slice(0, headerEnd + 2) + '\n' + evalComments + ' *\n';
                  }
                }
                downloadPgn(annotated, 'review.pgn');
              }
            }}
            className="flex-1 text-xs py-2 cursor-pointer rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            Export PGN
          </button>
          <button
            onClick={review.reset}
            className="flex-1 text-xs py-2 cursor-pointer rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          >
            ← New search
          </button>
        </div>
      </div>
    </div>
  );
}
