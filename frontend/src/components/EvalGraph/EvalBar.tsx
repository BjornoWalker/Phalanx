interface TablebaseInfo {
  wdl: number;
  dtz: number | null;
}

interface EvalBarProps {
  evaluation: number | null; // in pawns, positive = white advantage
  isMate: boolean;
  mateIn: number | null;
  tablebase?: TablebaseInfo | null;
  height?: number;
}

export default function EvalBar({
  evaluation,
  isMate,
  mateIn,
  tablebase,
  height = 560,
}: EvalBarProps) {
  let whitePercent = 50;
  let displayText = '0.0';
  let isTB = false;

  // Tablebase takes priority
  if (tablebase) {
    isTB = true;
    if (tablebase.wdl >= 1) {
      whitePercent = 95;
      displayText = tablebase.dtz !== null ? `TB:${Math.abs(tablebase.dtz)}` : 'TB Win';
    } else if (tablebase.wdl <= -1) {
      whitePercent = 5;
      displayText = tablebase.dtz !== null ? `TB:${Math.abs(tablebase.dtz)}` : 'TB Loss';
    } else {
      whitePercent = 50;
      displayText = 'TB Draw';
    }
  } else if (isMate && mateIn !== null) {
    whitePercent = mateIn > 0 ? 100 : 0;
    displayText = `M${Math.abs(mateIn)}`;
  } else if (evaluation !== null) {
    const clamped = Math.max(-10, Math.min(10, evaluation));
    whitePercent = 50 + (clamped / 10) * 50;
    whitePercent = Math.max(2, Math.min(98, whitePercent));
    displayText = evaluation >= 0
      ? `+${evaluation.toFixed(1)}`
      : evaluation.toFixed(1);
  }

  const blackPercent = 100 - whitePercent;
  const isWhiteAdvantage = whitePercent >= 50;

  return (
    <div
      className="flex flex-col w-7 rounded overflow-hidden relative"
      style={{ height, backgroundColor: '#333' }}
    >
      {/* Black section (top) */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          height: `${blackPercent}%`,
          backgroundColor: '#3d3d3d',
        }}
      />
      {/* White section (bottom) */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          height: `${whitePercent}%`,
          backgroundColor: isTB ? '#6ba3d6' : '#e8e8e8',
        }}
      />
      {/* Eval text */}
      <div
        className="absolute left-0 right-0 text-center text-[9px] font-bold leading-tight"
        style={{
          ...(isWhiteAdvantage
            ? { bottom: '4px', color: isTB ? 'white' : '#333' }
            : { top: '4px', color: isTB ? '#6ba3d6' : '#e8e8e8' }),
        }}
      >
        {displayText}
      </div>
    </div>
  );
}
