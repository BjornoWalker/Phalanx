import { useCallback } from 'react';
import ChessBoard from '../components/Board/ChessBoard';
import { usePuzzles } from '../hooks/usePuzzles';
import { useSettings } from '../contexts/SettingsContext';
import { playMoveSound, playNotifySound } from '../services/sounds';
import type { Arrow } from 'react-chessboard';

const THEME_OPTIONS = [
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'skewer', label: 'Skewer' },
  { id: 'discoveredAttack', label: 'Discovered Attack' },
  { id: 'sacrifice', label: 'Sacrifice' },
  { id: 'hangingPiece', label: 'Hanging Piece' },
  { id: 'mateIn1', label: 'Mate in 1' },
  { id: 'mateIn2', label: 'Mate in 2' },
  { id: 'mateIn3', label: 'Mate in 3' },
  { id: 'backRankMate', label: 'Back Rank Mate' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'endgame', label: 'Endgame' },
  { id: 'opening', label: 'Opening' },
  { id: 'middlegame', label: 'Middlegame' },
  { id: 'exposedKing', label: 'Exposed King' },
  { id: 'quietMove', label: 'Quiet Move' },
  { id: 'deflection', label: 'Deflection' },
  { id: 'attraction', label: 'Attraction' },
];

export default function PuzzlesTab() {
  const pz = usePuzzles();
  const { settings } = useSettings();

  const handlePieceDrop = useCallback(
    (from: string, to: string): boolean => {
      if (pz.state !== 'solving') return false;
      pz.makeMove(from, to).then((ok) => {
        if (ok) {
          // Sound is approximate — we don't know if it's a capture from the frontend alone
          playMoveSound();
        } else {
          playNotifySound();
        }
      });
      return true; // optimistically accept the visual move
    },
    [pz]
  );

  // Build hint arrow
  const hintArrows: Arrow[] = [];
  if (pz.hint?.from_square) {
    hintArrows.push({
      startSquare: pz.hint.from_square,
      endSquare: pz.hint.to_square || pz.hint.from_square,
      color: 'rgba(255, 170, 0, 0.7)',
    });
  }

  // Idle / Loading — show puzzle selector
  if (pz.state === 'idle' || pz.state === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-[400px] rounded-xl p-6 flex flex-col gap-5"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <h2 className="text-lg font-semibold text-center">Puzzles</h2>

          {/* Stats */}
          <div
            className="flex justify-around text-center py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--accent-green)' }}>
                {pz.stats.solved}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Solved</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {pz.stats.streak}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Streak</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
                {(pz.stats as Record<string, number>).todaySolved ?? 0}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Today</div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
                {(pz.stats as Record<string, number>).weekSolved ?? 0}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>This Week</div>
            </div>
          </div>

          {/* Rating range */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span style={{ color: 'var(--text-muted)' }}>
                Rating: {pz.ratingMin} — {pz.ratingMax}
              </span>
              <button
                onClick={() => pz.setAdaptiveMode(!pz.adaptiveMode)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer"
                style={{
                  backgroundColor: pz.adaptiveMode ? 'rgba(129,182,76,0.2)' : 'var(--bg-tertiary)',
                  color: pz.adaptiveMode ? 'var(--accent-green)' : 'var(--text-muted)',
                }}
              >
                {pz.adaptiveMode ? '✓ Auto' : '○ Auto'}
              </button>
            </div>
            <div className="flex gap-3 items-center">
              <input
                type="range"
                min={400}
                max={2000}
                step={100}
                value={pz.ratingMin}
                onChange={(e) => pz.setRatingRange(parseInt(e.target.value), Math.max(parseInt(e.target.value) + 200, pz.ratingMax))}
                className="flex-1 accent-[#81b64c]"
              />
              <input
                type="range"
                min={600}
                max={2400}
                step={100}
                value={pz.ratingMax}
                onChange={(e) => pz.setRatingRange(Math.min(parseInt(e.target.value) - 200, pz.ratingMin), parseInt(e.target.value))}
                className="flex-1 accent-[#81b64c]"
              />
            </div>
          </div>

          {/* Theme filter */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Theme (optional)
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
              <button
                onClick={() => pz.setSelectedTheme(null)}
                className="px-2 py-1 rounded text-xs cursor-pointer"
                style={{
                  backgroundColor: pz.selectedTheme === null ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                  color: pz.selectedTheme === null ? 'white' : 'var(--text-secondary)',
                }}
              >
                Any
              </button>
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pz.setSelectedTheme(t.id)}
                  className="px-2 py-1 rounded text-xs cursor-pointer"
                  style={{
                    backgroundColor: pz.selectedTheme === t.id ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    color: pz.selectedTheme === t.id ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={pz.loadPuzzle}
            disabled={pz.state === 'loading'}
            className="w-full py-3 rounded-lg text-base font-bold cursor-pointer transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
          >
            {pz.state === 'loading' ? 'Loading...' : 'Start Puzzle'}
          </button>
        </div>
      </div>
    );
  }

  // Solving / Correct / Incorrect / Complete
  return (
    <div className="flex h-full gap-4 p-4">
      {/* Board */}
      <div className="flex flex-col items-center">
        <ChessBoard
          position={pz.position}
          onPieceDrop={handlePieceDrop}
          boardOrientation={pz.boardOrientation}
          boardWidth={560}
          externalArrows={hintArrows}
          boardTheme={settings.board_theme}
          pieceSet={settings.piece_set}
          interactive={pz.state === 'solving'}
        />
      </div>

      {/* Right panel */}
      <div className="flex flex-col w-[300px] gap-3">
        {/* Puzzle info */}
        <div
          className="px-4 py-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Puzzle</span>
            {pz.puzzle && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Rating: {pz.puzzle.rating}
              </span>
            )}
          </div>
          {pz.puzzle?.themes && (
            <div className="flex flex-wrap gap-1 mb-2">
              {pz.puzzle.themes.split(' ').map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Feedback */}
        {pz.feedback && (
          <div
            className="px-4 py-3 rounded-lg text-sm font-medium text-center"
            style={{
              backgroundColor:
                pz.state === 'complete' ? 'rgba(129, 182, 76, 0.2)' :
                pz.state === 'incorrect' ? 'rgba(202, 44, 44, 0.2)' :
                'var(--bg-secondary)',
              color:
                pz.state === 'complete' ? 'var(--accent-green)' :
                pz.state === 'incorrect' ? '#ff6b6b' :
                'var(--text-primary)',
            }}
          >
            {pz.feedback}
          </div>
        )}

        {/* Hint */}
        {pz.state === 'solving' && (
          <button
            onClick={pz.getHint}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            {pz.hintLevel === 0 ? 'Get Hint' :
             pz.hintLevel === 1 ? 'More Hint' :
             pz.hintLevel === 2 ? 'Show Answer' : 'Hint'}
          </button>
        )}

        {pz.hint && (
          <div
            className="px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(255, 170, 0, 0.15)', color: '#ffa500' }}
          >
            {pz.hint.hint}
          </div>
        )}

        {/* Stats bar */}
        <div
          className="flex justify-around text-center py-2 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>
              {pz.stats.solved}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Solved</div>
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#ca2c2c' }}>
              {pz.stats.failed}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Failed</div>
          </div>
          <div>
            <div className="text-sm font-bold">{pz.stats.streak}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Streak</div>
          </div>
        </div>

        {/* Next puzzle button */}
        {(pz.state === 'complete' || pz.state === 'incorrect') && (
          <button
            onClick={pz.nextPuzzle}
            className="w-full py-3 rounded-lg text-sm font-bold cursor-pointer"
            style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
          >
            Next Puzzle
          </button>
        )}
      </div>
    </div>
  );
}
