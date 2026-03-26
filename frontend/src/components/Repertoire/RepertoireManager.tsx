import { useState, useEffect } from 'react';
import type { RepertoireLine } from '../../hooks/useRepertoire';

interface RepertoireManagerProps {
  lines: RepertoireLine[];
  onFetchLines: (color?: string) => Promise<void>;
  onImportPgn: (pgn: string, color: string) => Promise<number>;
  onDeleteLine: (id: string) => Promise<void>;
  onStartDrill: (color?: string) => Promise<void>;
  isLoading: boolean;
}

export default function RepertoireManager({
  lines,
  onFetchLines,
  onImportPgn,
  onDeleteLine,
  onStartDrill,
  isLoading,
}: RepertoireManagerProps) {
  const [pgnInput, setPgnInput] = useState('');
  const [importColor, setImportColor] = useState<'white' | 'black'>('white');
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    onFetchLines(filterColor || undefined);
  }, [onFetchLines, filterColor]);

  const handleImport = async () => {
    if (!pgnInput.trim()) return;
    setFeedback(null);
    const count = await onImportPgn(pgnInput.trim(), importColor);
    setFeedback(`Imported ${count} line${count !== 1 ? 's' : ''}`);
    setPgnInput('');
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto p-4">
      <h2 className="text-lg font-semibold">Opening Repertoire</h2>

      {/* Import PGN */}
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="text-sm font-medium mb-2">Import Opening Lines</div>
        <textarea
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
          placeholder="Paste PGN here... (e.g., 1. e4 e5 2. Nf3 Nc6 3. Bb5)"
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none resize-none"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="flex gap-2 mt-2">
          <div className="flex gap-1">
            {(['white', 'black'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setImportColor(c)}
                className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer capitalize"
                style={{
                  backgroundColor: importColor === c ? 'var(--bg-tertiary)' : 'transparent',
                  border: importColor === c ? '2px solid var(--accent-green)' : '2px solid var(--border-color)',
                  color: importColor === c ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            onClick={handleImport}
            disabled={!pgnInput.trim()}
            className="px-4 py-1.5 rounded text-xs font-bold cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
          >
            Import
          </button>
        </div>
        {feedback && (
          <div className="text-xs mt-2" style={{ color: 'var(--accent-green)' }}>{feedback}</div>
        )}
      </div>

      {/* Filter + Drill button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[null, 'white', 'black'].map((c) => (
            <button
              key={c ?? 'all'}
              onClick={() => setFilterColor(c)}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer capitalize"
              style={{
                backgroundColor: filterColor === c ? 'var(--bg-tertiary)' : 'transparent',
                border: filterColor === c ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                color: filterColor === c ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {c || 'All'}
            </button>
          ))}
        </div>
        <button
          onClick={() => onStartDrill(filterColor || undefined)}
          disabled={lines.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
        >
          Start Drill
        </button>
      </div>

      {/* Repertoire stats */}
      {lines.length > 0 && (
        <div
          className="flex justify-around text-center py-2 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div>
            <div className="text-sm font-bold">{lines.length}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Lines</div>
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>
              {lines.reduce((a, l) => a + l.correct_count, 0)}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Correct</div>
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#ca2c2c' }}>
              {lines.reduce((a, l) => a + l.incorrect_count, 0)}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Incorrect</div>
          </div>
          <div>
            <div className="text-sm font-bold">
              {(() => {
                const total = lines.reduce((a, l) => a + l.correct_count + l.incorrect_count, 0);
                const correct = lines.reduce((a, l) => a + l.correct_count, 0);
                return total > 0 ? `${Math.round((correct / total) * 100)}%` : '—';
              })()}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Accuracy</div>
          </div>
        </div>
      )}

      {/* Lines list */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {lines.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? 'Loading...' : 'No opening lines yet. Import some PGN above!'}
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto">
            {lines.map((line) => (
              <div
                key={line.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: line.color === 'white' ? '#e8e8e8' : '#3d3d3d' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{line.name}</div>
                  <div className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                    {line.moves_san.join(' ')}
                  </div>
                </div>
                <div className="text-right shrink-0 w-16">
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {line.correct_count}✓ {line.incorrect_count}✗
                  </div>
                  {(line.correct_count + line.incorrect_count) > 0 && (
                    <div className="flex h-1 rounded-full overflow-hidden mt-0.5">
                      <div style={{ width: `${(line.correct_count / (line.correct_count + line.incorrect_count)) * 100}%`, backgroundColor: 'var(--accent-green)' }} />
                      <div style={{ flex: 1, backgroundColor: '#ca2c2c' }} />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDeleteLine(line.id)}
                  className="text-xs px-2 py-1 rounded cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                  title="Delete line"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
