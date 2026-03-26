import type { GameAnalysis } from '../../hooks/useGameReview';

interface ReviewSummaryProps {
  analysis: GameAnalysis;
  whiteName: string;
  blackName: string;
  onStartReview: () => void;
  onJumpToClassification?: (classification: string) => void;
  onJumpToMove?: (index: number) => void;
}

const CLASSIFICATIONS = [
  { key: 'brilliant', label: 'Brilliant', color: '#1abc9c', icon: '!!' },
  { key: 'great', label: 'Great', color: '#5682d1', icon: '!' },
  { key: 'best', label: 'Best', color: '#81b64c', icon: '✓' },
  { key: 'good', label: 'Good', color: '#81b64c', icon: '○' },
  { key: 'mistake', label: 'Mistake', color: '#e5b80b', icon: '?' },
  { key: 'miss', label: 'Miss', color: '#e67e22', icon: '?' },
  { key: 'blunder', label: 'Blunder', color: '#ca2c2c', icon: '??' },
];

function AccuracyBadge({ value }: { value: number }) {
  let bg = '#ca2c2c';
  if (value >= 80) bg = '#1abc9c';
  else if (value >= 60) bg = '#81b64c';
  else if (value >= 40) bg = '#e5b80b';
  else if (value >= 20) bg = '#e67e22';

  return (
    <div
      className="text-lg font-bold px-3 py-1 rounded"
      style={{ backgroundColor: bg, color: 'white' }}
    >
      {value.toFixed(1)}
    </div>
  );
}

export default function ReviewSummary({
  analysis,
  whiteName,
  blackName,
  onStartReview,
  onJumpToClassification,
  onJumpToMove,
}: ReviewSummaryProps) {
  return (
    <div
      className="flex flex-col gap-4 p-4 rounded-lg"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div className="text-center text-sm font-semibold">Game Review</div>

      {/* Players & Accuracy */}
      <div className="grid grid-cols-3 gap-2 items-center text-center">
        <div />
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Accuracy
        </div>
        <div />

        <div className="text-sm font-medium truncate">{whiteName}</div>
        <AccuracyBadge value={analysis.white_accuracy} />
        <div className="text-sm font-medium truncate">{blackName}</div>
      </div>

      {/* Move Quality Breakdown */}
      <div className="space-y-1">
        {CLASSIFICATIONS.map(({ key, label, color, icon }) => {
          const wCount = analysis.white_breakdown[key] || 0;
          const bCount = analysis.black_breakdown[key] || 0;
          if (wCount === 0 && bCount === 0) return null;

          return (
            <div
              key={key}
              className="grid grid-cols-[40px_1fr_40px] gap-2 items-center text-sm cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[var(--bg-tertiary)]"
              onClick={() => onJumpToClassification?.(key)}
              title={`Jump to first ${label.toLowerCase()}`}
            >
              <span className="text-right font-mono" style={{ color }}>
                {wCount}
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-xs" style={{ color }}>
                  {icon}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
              <span className="text-left font-mono" style={{ color }}>
                {bCount}
              </span>
            </div>
          );
        })}
      </div>

      {/* Critical Moments */}
      <CriticalMoments analysis={analysis} onJumpTo={() => {}} onJumpToIndex={onJumpToMove} />

      {/* Improvement Suggestions */}
      <ImprovementSuggestions analysis={analysis} />

      {/* Start Review Button */}
      <button
        onClick={onStartReview}
        className="w-full py-3 rounded-lg text-sm font-bold cursor-pointer transition-colors"
        style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
      >
        Start Review
      </button>
    </div>
  );
}

function CriticalMoments({
  analysis,
  onJumpToIndex,
}: {
  analysis: GameAnalysis;
  onJumpTo: (idx: number) => void;
  onJumpToIndex?: (idx: number) => void;
}) {
  const swings: { index: number; san: string; swing: number }[] = [];
  for (let i = 0; i < analysis.moves.length; i++) {
    const m = analysis.moves[i];
    const swing = Math.abs(m.eval_after - m.eval_before);
    if (swing > 0.5) {
      swings.push({ index: i, san: m.san, swing });
    }
  }
  swings.sort((a, b) => b.swing - a.swing);
  const top = swings.slice(0, 3);

  if (top.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
        Critical Moments
      </div>
      <div className="space-y-1">
        {top.map((m) => {
          const moveNum = Math.floor(m.index / 2) + 1;
          const isBlack = m.index % 2 === 1;
          return (
            <button
              key={m.index}
              onClick={() => onJumpToIndex?.(m.index)}
              className="w-full flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <span className="font-mono">
                {moveNum}.{isBlack ? '..' : ''} {m.san}
              </span>
              <span style={{ color: m.swing > 2 ? '#ca2c2c' : '#e5b80b' }}>
                ±{m.swing.toFixed(1)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImprovementSuggestions({ analysis }: { analysis: GameAnalysis }) {
  const suggestions: string[] = [];

  const totalWhite = Object.values(analysis.white_breakdown).reduce((a, b) => a + b, 0);
  const totalBlack = Object.values(analysis.black_breakdown).reduce((a, b) => a + b, 0);

  const wBlunders = (analysis.white_breakdown.blunder || 0) + (analysis.white_breakdown.miss || 0);
  const bBlunders = (analysis.black_breakdown.blunder || 0) + (analysis.black_breakdown.miss || 0);
  if (wBlunders > 2 || bBlunders > 2) {
    suggestions.push('Focus on tactical awareness — several blunders and missed opportunities.');
  }

  if (analysis.white_accuracy < 40 || analysis.black_accuracy < 40) {
    suggestions.push('Study common patterns in this opening to improve accuracy.');
  }

  const earlyMoves = analysis.moves.slice(0, 10);
  const lateMoves = analysis.moves.slice(-10);
  const earlyErrors = earlyMoves.filter((m) => ['mistake', 'miss', 'blunder'].includes(m.classification)).length;
  const lateErrors = lateMoves.filter((m) => ['mistake', 'miss', 'blunder'].includes(m.classification)).length;

  if (earlyErrors > lateErrors + 2) {
    suggestions.push('Opening play needs work — more errors in the first 10 moves.');
  } else if (lateErrors > earlyErrors + 2) {
    suggestions.push('Endgame technique needs improvement — accuracy dropped late.');
  }

  const wBest = (analysis.white_breakdown.best || 0) + (analysis.white_breakdown.great || 0) + (analysis.white_breakdown.brilliant || 0);
  const bBest = (analysis.black_breakdown.best || 0) + (analysis.black_breakdown.great || 0) + (analysis.black_breakdown.brilliant || 0);
  if (wBest > totalWhite * 0.6 || bBest > totalBlack * 0.6) {
    suggestions.push('Strong performance — majority of moves were best or great quality.');
  }

  if (suggestions.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
        Suggestions
      </div>
      <div className="space-y-1">
        {suggestions.map((s, i) => (
          <div key={i} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
