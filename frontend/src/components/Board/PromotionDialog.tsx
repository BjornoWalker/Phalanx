interface PromotionDialogProps {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
  boardWidth: number;
  targetSquare: string;
  boardOrientation: 'white' | 'black';
}

const PIECES = [
  { key: 'q' as const, label: 'Queen', white: '♕', black: '♛' },
  { key: 'r' as const, label: 'Rook', white: '♖', black: '♜' },
  { key: 'b' as const, label: 'Bishop', white: '♗', black: '♝' },
  { key: 'n' as const, label: 'Knight', white: '♘', black: '♞' },
];

export default function PromotionDialog({
  color,
  onSelect,
  onCancel,
  boardWidth,
  targetSquare,
  boardOrientation,
}: PromotionDialogProps) {
  // Position the dialog near the promotion square
  const file = targetSquare.charCodeAt(0) - 97; // a=0, h=7
  const sqSize = boardWidth / 8;
  const isFlipped = boardOrientation === 'black';
  const leftPx = isFlipped ? (7 - file) * sqSize : file * sqSize;
  const isTop = (color === 'w' && !isFlipped) || (color === 'b' && isFlipped);

  return (
    <div
      className="absolute z-40"
      style={{
        left: leftPx,
        [isTop ? 'top' : 'bottom']: 0,
        width: sqSize,
      }}
    >
      <div
        className="flex flex-col rounded shadow-xl overflow-hidden"
        style={{ border: '2px solid var(--accent-green)' }}
      >
        {PIECES.map((p) => (
          <button
            key={p.key}
            onClick={() => onSelect(p.key)}
            className="flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--accent-green)]"
            style={{
              width: sqSize,
              height: sqSize,
              backgroundColor: 'var(--bg-secondary)',
              fontSize: sqSize * 0.65,
            }}
            title={p.label}
          >
            {color === 'w' ? p.white : p.black}
          </button>
        ))}
      </div>
      {/* Backdrop to cancel */}
      <div
        className="fixed inset-0 z-[-1]"
        onClick={onCancel}
      />
    </div>
  );
}
