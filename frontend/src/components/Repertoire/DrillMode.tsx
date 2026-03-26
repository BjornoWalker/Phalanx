import { useCallback } from 'react';
import ChessBoard from '../Board/ChessBoard';
import { useSettings } from '../../contexts/SettingsContext';
import { playMoveSound, playNotifySound } from '../../services/sounds';
import type { RepertoireLine } from '../../hooks/useRepertoire';

interface DrillModeProps {
  line: RepertoireLine;
  position: string;
  moveIndex: number;
  feedback: string | null;
  boardOrientation: 'white' | 'black';
  state: 'drilling' | 'correct' | 'incorrect';
  onSubmitMove: (from: string, to: string) => boolean;
  onNextDrill: () => void;
  onBack: () => void;
}

export default function DrillMode({
  line,
  position,
  moveIndex,
  feedback,
  boardOrientation,
  state,
  onSubmitMove,
  onNextDrill,
  onBack,
}: DrillModeProps) {
  const { settings } = useSettings();

  const handlePieceDrop = useCallback(
    (from: string, to: string): boolean => {
      if (state !== 'drilling') return false;
      const result = onSubmitMove(from, to);
      if (result) {
        playMoveSound();
      } else {
        playNotifySound();
      }
      return result;
    },
    [state, onSubmitMove]
  );

  const progress = line.moves.length > 0
    ? Math.round((moveIndex / line.moves.length) * 100)
    : 0;

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Board */}
      <div className="flex flex-col items-center">
        <ChessBoard
          position={position}
          onPieceDrop={handlePieceDrop}
          boardOrientation={boardOrientation}
          boardWidth={560}
          boardTheme={settings.board_theme}
          pieceSet={settings.piece_set}
          interactive={state === 'drilling'}
        />
      </div>

      {/* Right panel */}
      <div className="flex flex-col w-[300px] gap-3">
        {/* Line info */}
        <div
          className="px-4 py-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="text-sm font-semibold mb-1">{line.name}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Playing as {line.color} &middot; {line.moves_san.length} moves
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: 'var(--accent-green)' }}
            />
          </div>
          <div className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
            {moveIndex} / {line.moves.length}
          </div>
        </div>

        {/* Move sequence (dimmed, revealing as you progress) */}
        <div
          className="px-4 py-3 rounded-lg text-xs font-mono"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {line.moves_san.map((san, i) => {
            const isRevealed = i < moveIndex;
            const isCurrent = i === moveIndex;
            const moveNum = Math.floor(i / 2) + 1;
            const prefix = i % 2 === 0 ? `${moveNum}. ` : '';
            return (
              <span
                key={i}
                style={{
                  color: isRevealed
                    ? 'var(--text-secondary)'
                    : isCurrent
                    ? 'var(--accent-green)'
                    : 'var(--bg-tertiary)',
                }}
              >
                {prefix}{isRevealed || state !== 'drilling' ? san : '???'}{' '}
              </span>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className="px-4 py-3 rounded-lg text-sm font-medium text-center"
            style={{
              backgroundColor:
                state === 'correct' ? 'rgba(129, 182, 76, 0.2)' :
                state === 'incorrect' ? 'rgba(202, 44, 44, 0.2)' :
                'var(--bg-secondary)',
              color:
                state === 'correct' ? 'var(--accent-green)' :
                state === 'incorrect' ? '#ff6b6b' :
                'var(--text-primary)',
            }}
          >
            {feedback}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={onBack}
            className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
          {(state === 'correct' || state === 'incorrect') && (
            <button
              onClick={onNextDrill}
              className="flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
            >
              Next Line
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          This line: {line.correct_count} correct, {line.incorrect_count} incorrect
          &middot; Interval: {line.interval_days.toFixed(0)} days
        </div>
      </div>
    </div>
  );
}
