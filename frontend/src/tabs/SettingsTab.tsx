import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { COACH_AVATARS } from '../components/CoachChat/CoachAvatar';
import { getCacheStats, clearAllCache } from '../services/analysisCache';

interface OllamaModel {
  name: string;
  size_gb: number;
  modified_at: string;
}

interface RecommendedModel {
  name: string;
  display: string;
  size: string;
  speed: string;
  description: string;
}

const BOARD_THEMES = [
  { id: 'green', name: 'Green', dark: '#779952', light: '#edeed1' },
  { id: 'brown', name: 'Brown', dark: '#b58863', light: '#f0d9b5' },
  { id: 'blue', name: 'Blue', dark: '#5b7aa6', light: '#dee3e6' },
  { id: 'purple', name: 'Purple', dark: '#7b61a6', light: '#e8dff5' },
  { id: 'gray', name: 'Gray', dark: '#86888a', light: '#cbcccb' },
  { id: 'highContrast', name: 'Hi-Con', dark: '#000000', light: '#ffffff' },
];

const PIECE_SETS = [
  { id: 'default', name: 'Default' },
  { id: 'cburnett', name: 'Cburnett' },
  { id: 'merida', name: 'Merida' },
  { id: 'california', name: 'California' },
  { id: 'cardinal', name: 'Cardinal' },
];

export default function SettingsTab() {
  const { settings, updateSettings } = useSettings();
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [recommendedModels, setRecommendedModels] = useState<RecommendedModel[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [cacheCount, setCacheCount] = useState(0);
  const cacheLoadedRef = useRef(false);

  // Load cache stats on mount
  useEffect(() => {
    if (!cacheLoadedRef.current) {
      cacheLoadedRef.current = true;
      getCacheStats().then((s) => setCacheCount(s.count)).catch(() => {});
    }
  }, []);

  const handleClearCache = useCallback(async () => {
    await clearAllCache();
    setCacheCount(0);
  }, []);

  const fetchOllamaStatus = useCallback(() => {
    fetch('/api/settings/ollama/status')
      .then((r) => r.json())
      .then((data) => {
        setOllamaRunning(data.running);
        setInstalledModels(data.installed || []);
        setRecommendedModels(data.recommended || []);
      })
      .catch(() => setOllamaRunning(false));
  }, []);

  useEffect(() => {
    fetchOllamaStatus();
  }, [fetchOllamaStatus]);

  const pullModel = useCallback(async (modelName: string) => {
    setPullingModel(modelName);
    setPullProgress('Starting download...');
    try {
      const res = await fetch('/api/settings/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status === 'success') {
              setPullProgress('Download complete!');
              fetchOllamaStatus();
            } else if (data.status === 'error') {
              setPullProgress(`Error: ${data.message}`);
            } else if (data.percent) {
              setPullProgress(`${data.status} ${data.percent}%`);
            } else {
              setPullProgress(data.status || 'Downloading...');
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setPullProgress(`Error: ${e}`);
    } finally {
      setTimeout(() => {
        setPullingModel(null);
        setPullProgress('');
      }, 2000);
    }
  }, [fetchOllamaStatus]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold">Settings</h2>

      {/* Appearance */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Appearance
        </h3>

        {/* Board Theme */}
        <div className="mb-4">
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Board Theme
          </label>
          <div className="flex gap-2">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => updateSettings({ board_theme: theme.id })}
                className="flex flex-col items-center gap-1 cursor-pointer"
                title={theme.name}
              >
                <div
                  className="w-10 h-10 rounded grid grid-cols-2 grid-rows-2 overflow-hidden"
                  style={{
                    border:
                      settings.board_theme === theme.id
                        ? '2px solid var(--accent-green)'
                        : '2px solid transparent',
                  }}
                >
                  <div style={{ backgroundColor: theme.light }} />
                  <div style={{ backgroundColor: theme.dark }} />
                  <div style={{ backgroundColor: theme.dark }} />
                  <div style={{ backgroundColor: theme.light }} />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {theme.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Piece Set */}
        <div className="mb-4">
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Piece Style
          </label>
          <div className="flex gap-3">
            {PIECE_SETS.map((set) => (
              <button
                key={set.id}
                onClick={() => updateSettings({ piece_set: set.id })}
                className="flex flex-col items-center gap-1 cursor-pointer"
                title={set.name}
              >
                <div
                  className="w-12 h-12 rounded flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: '#779952',
                    border:
                      settings.piece_set === set.id
                        ? '2px solid var(--accent-green)'
                        : '2px solid transparent',
                  }}
                >
                  {set.id === 'default' ? (
                    <span className="text-2xl">♚</span>
                  ) : (
                    <img
                      src={`/pieces/${set.id}/wK.svg`}
                      alt={set.name}
                      className="w-10 h-10"
                    />
                  )}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {set.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Dark Mode */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Dark Mode</span>
          <button
            onClick={() => updateSettings({ dark_mode: !settings.dark_mode })}
            className="w-10 h-6 rounded-full relative cursor-pointer transition-colors"
            style={{
              backgroundColor: settings.dark_mode ? 'var(--accent-green)' : 'var(--border-color)',
            }}
          >
            <div
              className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
              style={{ left: settings.dark_mode ? '22px' : '4px' }}
            />
          </button>
        </div>
      </section>

      {/* Analysis */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Analysis
        </h3>

        {/* Engine choice */}
        <div className="mb-3">
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Analysis Engine
          </label>
          <div className="flex gap-2">
            {([
              { id: 'stockfish' as const, label: 'Stockfish', desc: 'Fast, tactical' },
              { id: 'lc0' as const, label: 'Lc0', desc: 'Neural net, positional' },
              { id: 'both' as const, label: 'Both', desc: 'Compare engines' },
            ]).map((eng) => (
              <button
                key={eng.id}
                onClick={() => updateSettings({ engine_choice: eng.id })}
                className="flex-1 py-2 px-3 rounded-lg text-sm cursor-pointer transition-all text-center"
                style={{
                  backgroundColor: settings.engine_choice === eng.id ? 'var(--bg-tertiary)' : 'transparent',
                  border: settings.engine_choice === eng.id
                    ? '2px solid var(--accent-green)'
                    : '2px solid var(--border-color)',
                  color: settings.engine_choice === eng.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <div className="font-medium">{eng.label}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{eng.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Show best move */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Show best move arrow</span>
          <button
            onClick={() => updateSettings({ show_best_move: !settings.show_best_move })}
            className="w-10 h-6 rounded-full relative cursor-pointer transition-colors"
            style={{
              backgroundColor: settings.show_best_move ? 'var(--accent-green)' : 'var(--border-color)',
            }}
          >
            <div
              className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
              style={{ left: settings.show_best_move ? '22px' : '4px' }}
            />
          </button>
        </div>

        {/* Analysis depth */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">Analysis Depth</span>
            <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
              {settings.analysis_depth}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={25}
            value={settings.analysis_depth}
            onChange={(e) => updateSettings({ analysis_depth: parseInt(e.target.value) })}
            className="w-full accent-[#81b64c]"
          />
        </div>

        {/* MultiPV */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">Engine Lines</span>
            <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
              {settings.multipv}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={settings.multipv}
            onChange={(e) => updateSettings({ multipv: parseInt(e.target.value) })}
            className="w-full accent-[#81b64c]"
          />
        </div>

        {/* Blunder alerts */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Blunder alerts</span>
          <button
            onClick={() => updateSettings({ blunder_alerts: !settings.blunder_alerts })}
            className="w-10 h-6 rounded-full relative cursor-pointer transition-colors"
            style={{
              backgroundColor: settings.blunder_alerts ? 'var(--accent-green)' : 'var(--border-color)',
            }}
          >
            <div
              className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
              style={{ left: settings.blunder_alerts ? '22px' : '4px' }}
            />
          </button>
        </div>

        {settings.blunder_alerts && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">Alert threshold</span>
              <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                {settings.blunder_threshold} cp
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={400}
              step={50}
              value={settings.blunder_threshold}
              onChange={(e) => updateSettings({ blunder_threshold: parseInt(e.target.value) })}
              className="w-full accent-[#81b64c]"
            />
            <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              <span>Sensitive (50cp)</span>
              <span>Blunders only (400cp)</span>
            </div>
          </div>
        )}
      </section>

      {/* Coaching */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Coaching
        </h3>

        {/* Coach Personality */}
        <div className="mb-4">
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Coach Personality
          </label>
          <div className="flex gap-3">
            {Object.entries(COACH_AVATARS).map(([id, { emoji, label, desc }]) => (
              <button
                key={id}
                onClick={() => updateSettings({ coach_avatar: id })}
                className="flex flex-col items-center gap-1 cursor-pointer"
                title={`${label}: ${desc}`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    backgroundColor:
                      settings.coach_avatar === id ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    border:
                      settings.coach_avatar === id
                        ? '2px solid var(--accent-green)'
                        : '2px solid transparent',
                  }}
                >
                  {emoji}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
          {settings.coach_avatar && COACH_AVATARS[settings.coach_avatar] && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {COACH_AVATARS[settings.coach_avatar].desc}
            </p>
          )}
        </div>

        {/* Response Length */}
        <div className="mb-4">
          <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Response Length
          </label>
          <div className="flex gap-2">
            {([
              { id: 'short' as const, label: 'Short', desc: 'To the point' },
              { id: 'medium' as const, label: 'Medium', desc: 'Balanced' },
              { id: 'long' as const, label: 'Long', desc: 'Detailed' },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => updateSettings({ coach_verbosity: opt.id })}
                className="flex-1 py-2 px-3 rounded-lg text-sm cursor-pointer transition-all text-center"
                style={{
                  backgroundColor:
                    settings.coach_verbosity === opt.id ? 'var(--bg-tertiary)' : 'transparent',
                  border:
                    settings.coach_verbosity === opt.id
                      ? '2px solid var(--accent-green)'
                      : '2px solid var(--border-color)',
                  color:
                    settings.coach_verbosity === opt.id
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                }}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          {(['template', 'llm'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateSettings({ coaching_mode: mode })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left cursor-pointer transition-all"
              style={{
                backgroundColor: settings.coaching_mode === mode ? 'var(--bg-tertiary)' : 'transparent',
                border: settings.coaching_mode === mode
                  ? '2px solid var(--accent-green)'
                  : '2px solid var(--border-color)',
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{
                  borderColor: settings.coaching_mode === mode ? 'var(--accent-green)' : 'var(--text-muted)',
                }}
              >
                {settings.coaching_mode === mode && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--accent-green)' }}
                  />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">
                  {mode === 'template' ? 'Template-based (fast)' : 'LLM-powered (richer)'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {mode === 'template'
                    ? 'Instant feedback using predefined templates'
                    : 'Natural language coaching via local Ollama LLM'}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* LLM Model Selection */}
        {settings.coaching_mode === 'llm' && (
          <div className="mt-3 space-y-3">
            {/* Ollama Status */}
            <div className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ollamaRunning ? 'var(--accent-green)' : '#ca2c2c' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>
                {ollamaRunning ? 'Ollama is running' : 'Ollama is not running — start with: ollama serve'}
              </span>
            </div>

            {/* Installed Models Dropdown */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                Active Model
              </label>
              <select
                value={settings.llm_model}
                onChange={(e) => updateSettings({ llm_model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {installedModels.length === 0 && (
                  <option value={settings.llm_model}>{settings.llm_model} (not verified)</option>
                )}
                {installedModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.size_gb} GB)
                  </option>
                ))}
              </select>
            </div>

            {/* Download New Models */}
            <div>
              <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Download Models
              </label>
              <div
                className="text-xs mb-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
              >
                Larger models produce higher quality coaching but respond slower and use more RAM.
              </div>
              <div className="space-y-1">
                {recommendedModels.map((m) => {
                  const isInstalled = installedModels.some((i) => i.name === m.name);
                  const isPulling = pullingModel === m.name;
                  return (
                    <div
                      key={m.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{m.display}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {m.size} &middot; {m.speed}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {m.description}
                        </div>
                      </div>
                      {isInstalled ? (
                        <button
                          onClick={() => updateSettings({ llm_model: m.name })}
                          className="text-xs px-3 py-1 rounded cursor-pointer shrink-0"
                          style={{
                            backgroundColor:
                              settings.llm_model === m.name
                                ? 'var(--accent-green)'
                                : 'var(--bg-secondary)',
                            color: settings.llm_model === m.name ? 'white' : 'var(--text-secondary)',
                          }}
                        >
                          {settings.llm_model === m.name ? 'Active' : 'Use'}
                        </button>
                      ) : isPulling ? (
                        <div className="text-xs shrink-0" style={{ color: 'var(--accent-green)' }}>
                          {pullProgress}
                        </div>
                      ) : (
                        <button
                          onClick={() => pullModel(m.name)}
                          disabled={!ollamaRunning || pullingModel !== null}
                          className="text-xs px-3 py-1 rounded cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: 'var(--accent-green)',
                            color: 'white',
                          }}
                        >
                          Download
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Endgame Tablebases */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Endgame Tablebases
        </h3>
        <TablebaseStatus />
      </section>

      {/* Analysis Cache */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Analysis Cache
        </h3>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span>{cacheCount}</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>cached positions</span>
          </div>
          <button
            onClick={handleClearCache}
            disabled={cacheCount === 0}
            className="text-xs px-3 py-1.5 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            Clear Cache
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Previously analyzed positions load instantly. Cache auto-expires after 30 days.
        </p>
      </section>

      {/* About */}
      <section className="pb-8">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          About
        </h3>
        <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
          <p>Local Chess Engine v2.3.0</p>
          <p>Powered by Stockfish 18 + Lc0</p>
        </div>
      </section>
    </div>
  );
}

function TablebaseStatus() {
  const [status, setStatus] = useState<{
    available: boolean;
    file_count: number;
    size_mb: number;
    path: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/settings/tablebase/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: status.available ? 'var(--accent-green)' : '#ca2c2c' }}
        />
        <span className="text-sm">
          {status.available
            ? `Syzygy 5-piece tablebases (${status.file_count} files, ${status.size_mb} MB)`
            : 'Tablebases not installed'}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {status.available
          ? 'Endgame positions with 5 or fewer pieces show exact win/draw/loss results.'
          : `Download 5-piece Syzygy tables (~1 GB) to ${status.path} for perfect endgame analysis.`}
      </p>
    </div>
  );
}
