interface BoardControlsProps {
  onFlip: () => void;
  onReset: () => void;
  onBack: () => void;
  onForward: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
  isAtStart: boolean;
  isAtEnd: boolean;
  onSetup?: () => void;
}

export default function BoardControls({
  onFlip,
  onReset,
  onBack,
  onForward,
  onGoToStart,
  onGoToEnd,
  isAtStart,
  isAtEnd,
  onSetup,
}: BoardControlsProps) {
  const btnBase =
    'px-3 py-2 rounded text-sm font-medium transition-colors duration-150';
  const btnActive = `${btnBase} bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-color)] cursor-pointer`;
  const btnDisabled = `${btnBase} bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed opacity-50`;

  return (
    <div className="flex items-center gap-1 mt-2">
      <button onClick={onFlip} className={btnActive} title="Flip board">
        ⇅
      </button>
      <button onClick={onReset} className={btnActive} title="New game">
        ↺
      </button>
      {onSetup && (
        <button onClick={onSetup} className={btnActive} title="Setup position">
          ⊞
        </button>
      )}
      <div className="w-2" />
      <button
        onClick={onGoToStart}
        className={isAtStart ? btnDisabled : btnActive}
        disabled={isAtStart}
        title="Go to start"
      >
        ⏮
      </button>
      <button
        onClick={onBack}
        className={isAtStart ? btnDisabled : btnActive}
        disabled={isAtStart}
        title="Previous move"
      >
        ◀
      </button>
      <button
        onClick={onForward}
        className={isAtEnd ? btnDisabled : btnActive}
        disabled={isAtEnd}
        title="Next move"
      >
        ▶
      </button>
      <button
        onClick={onGoToEnd}
        className={isAtEnd ? btnDisabled : btnActive}
        disabled={isAtEnd}
        title="Go to end"
      >
        ⏭
      </button>
    </div>
  );
}
