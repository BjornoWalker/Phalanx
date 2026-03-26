interface ChessClockProps {
  whiteTime: number;  // milliseconds
  blackTime: number;
  activeClock: 'white' | 'black' | null;
  boardOrientation: 'white' | 'black';
  isFlagged: 'white' | 'black' | null;
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 20) {
    // Show tenths for low time
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function ClockFace({
  time,
  isActive,
  isTop,
  color,
  isFlagged,
}: {
  time: number;
  isActive: boolean;
  isTop: boolean;
  color: 'white' | 'black';
  isFlagged: boolean;
}) {
  const isLowTime = time > 0 && time < 30000;

  return (
    <div
      className={`
        flex items-center justify-between px-3 py-1.5 rounded-lg
        text-sm font-mono font-bold transition-colors
        ${isTop ? 'mb-1' : 'mt-1'}
      `}
      style={{
        backgroundColor: isActive
          ? (color === 'white' ? '#e8e8e8' : '#3d3d3d')
          : 'var(--bg-tertiary)',
        color: isFlagged
          ? '#ca2c2c'
          : isActive
            ? (color === 'white' ? '#1a1a1a' : '#e8e8e8')
            : 'var(--text-muted)',
        border: isLowTime && isActive ? '1px solid #ca2c2c' : '1px solid transparent',
      }}
    >
      <span className="text-xs font-normal" style={{ opacity: 0.7 }}>
        {color === 'white' ? '♙' : '♟'}
      </span>
      <span className={isLowTime && isActive ? 'animate-pulse' : ''}>
        {isFlagged ? 'FLAG' : formatTime(time)}
      </span>
    </div>
  );
}

export default function ChessClock({
  whiteTime,
  blackTime,
  activeClock,
  boardOrientation,
  isFlagged,
}: ChessClockProps) {
  // Top clock is the opponent, bottom is the player
  const topColor = boardOrientation === 'white' ? 'black' : 'white';
  const bottomColor = boardOrientation === 'white' ? 'white' : 'black';
  const topTime = topColor === 'white' ? whiteTime : blackTime;
  const bottomTime = bottomColor === 'white' ? whiteTime : blackTime;

  return (
    <div className="w-full">
      <ClockFace
        time={topTime}
        isActive={activeClock === topColor}
        isTop={true}
        color={topColor}
        isFlagged={isFlagged === topColor}
      />
      <ClockFace
        time={bottomTime}
        isActive={activeClock === bottomColor}
        isTop={false}
        color={bottomColor}
        isFlagged={isFlagged === bottomColor}
      />
    </div>
  );
}
