import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface EvalGraphProps {
  evalData: number[];
  currentIndex: number;
  onClickMove?: (index: number) => void;
  moveNames?: string[];  // SAN names for tooltip display
  height?: number;
}

export default function EvalGraph({
  evalData,
  currentIndex,
  onClickMove,
  moveNames,
  height = 120,
}: EvalGraphProps) {
  const data = evalData.map((value, index) => ({
    index,
    value: Math.max(-5, Math.min(5, value)),
    raw: value,
    san: moveNames?.[index] || '',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    if (e?.activeTooltipIndex != null && onClickMove) {
      onClickMove(e.activeTooltipIndex as number);
    }
  };

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg text-xs"
        style={{
          height,
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-muted)',
        }}
      >
        Evaluation graph appears here
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden cursor-pointer"
      style={{ height, backgroundColor: 'var(--bg-tertiary)' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
          onClick={handleClick}
        >
          <defs>
            <linearGradient id="whiteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8e8e8" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#e8e8e8" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <XAxis dataKey="index" hide />
          <YAxis domain={[-5, 5]} hide />
          <ReferenceLine y={0} stroke="var(--border-color)" strokeWidth={1} />
          {currentIndex >= 0 && (
            <ReferenceLine
              x={currentIndex}
              stroke="var(--accent-green)"
              strokeWidth={2}
            />
          )}
          <Tooltip
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const item = payload[0].payload;
              const val = item.raw as number;
              const san = item.san as string;
              const idx = item.index as number;
              const moveNum = Math.floor(idx / 2) + 1;
              const isBlack = idx % 2 === 1;
              const evalText = val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);

              return (
                <div
                  className="text-xs px-2.5 py-1.5 rounded shadow-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div className="font-mono font-bold">{evalText}</div>
                  {san && (
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {moveNum}.{isBlack ? '..' : ''} {san}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#e8e8e8"
            strokeWidth={1.5}
            fill="url(#whiteGrad)"
            baseValue={0}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
