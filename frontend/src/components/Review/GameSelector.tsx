import { useState, useRef } from 'react';
import type { GameSummary, ParsedGame } from '../../hooks/useGameReview';

const CHESSCOM_PLAYERS = [
  { username: 'magnuscarlsen', display: 'Magnus Carlsen' },
  { username: 'hikaru', display: 'Hikaru Nakamura' },
  { username: 'fabianocaruana', display: 'Fabiano Caruana' },
  { username: 'lachesisq', display: 'Ian Nepomniachtchi' },
  { username: 'firouzja2003', display: 'Alireza Firouzja' },
  { username: 'gmwso', display: 'Wesley So' },
  { username: 'rpragchess', display: 'Praggnanandhaa' },
  { username: 'polish_fighter3000', display: 'Jan-Krzysztof Duda' },
  { username: 'gothamchess', display: 'GothamChess' },
  { username: 'chesswithakeem', display: 'ChesswithAkeem' },
  { username: 'walkerbjorn12', display: 'walkerbjorn12' },
];

const LICHESS_PLAYERS = [
  { username: 'drnykterstein', display: 'Magnus Carlsen' },
  { username: 'penguingm1', display: 'Andrew Tang' },
  { username: 'alireza2003', display: 'Alireza Firouzja' },
  { username: 'nihalsarin2004', display: 'Nihal Sarin' },
  { username: 'rebeccaharris', display: 'Hikaru Nakamura' },
  { username: 'gmwilly', display: 'Wesley So' },
  { username: 'gothamchess', display: 'GothamChess' },
];

interface GameSelectorProps {
  onFetchGames: (username: string) => void;
  onFetchLichessGames: (username: string) => void;
  onReset: () => void;
  onUploadPgn: (file: File) => void;
  onSelectGame: (pgn: string) => void;
  onSelectParsedGame: (game: ParsedGame) => void;
  games: GameSummary[];
  parsedGames: ParsedGame[];
  isLoading: boolean;
  error: string | null;
}

function formatResult(white: GameSummary['white'], black: GameSummary['black']): string {
  if (white.result === 'win') return '1-0';
  if (black.result === 'win') return '0-1';
  return '½-½';
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeClass(tc: string): string {
  const map: Record<string, string> = {
    bullet: 'Bullet',
    blitz: 'Blitz',
    rapid: 'Rapid',
    daily: 'Daily',
    classical: 'Classical',
  };
  return map[tc] || tc;
}

export default function GameSelector({
  onFetchGames,
  onFetchLichessGames,
  onReset,
  onUploadPgn,
  onSelectGame,
  onSelectParsedGame,
  games,
  parsedGames,
  isLoading,
  error,
}: GameSelectorProps) {
  const [username, setUsername] = useState('');
  const [platform, setPlatform] = useState<'chesscom' | 'lichess'>('chesscom');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      if (platform === 'lichess') {
        onFetchLichessGames(username.trim());
      } else {
        onFetchGames(username.trim());
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPgn(file);
    }
  };

  const hasGames = games.length > 0 || parsedGames.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Platform toggle */}
      <div className="flex gap-1">
        {([
          { id: 'chesscom' as const, label: 'Chess.com' },
          { id: 'lichess' as const, label: 'Lichess' },
        ]).map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
            style={{
              backgroundColor: platform === p.id ? 'var(--bg-tertiary)' : 'transparent',
              border: platform === p.id ? '2px solid var(--accent-green)' : '2px solid var(--border-color)',
              color: platform === p.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Search / Upload controls */}
      <div className="flex gap-3">
        <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Chess.com username"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent-green)',
              color: 'white',
            }}
          >
            {isLoading ? 'Loading...' : 'Fetch Games'}
          </button>
        </form>

        <div className="flex items-center" style={{ color: 'var(--text-muted)' }}>
          or
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          Upload PGN
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pgn"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Featured Players */}
      {!hasGames && (
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Featured Players ({platform === 'lichess' ? 'Lichess' : 'Chess.com'})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(platform === 'lichess' ? LICHESS_PLAYERS : CHESSCOM_PLAYERS).map((p) => (
              <button
                key={p.username}
                onClick={() => {
                  setUsername(p.username);
                  if (platform === 'lichess') {
                    onFetchLichessGames(p.username);
                  } else {
                    onFetchGames(p.username);
                  }
                }}
                disabled={isLoading}
                className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
                title={p.username}
              >
                {p.display}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'rgba(202, 44, 44, 0.2)', color: '#ff6b6b' }}
        >
          {error}
        </div>
      )}

      {/* Game list */}
      {hasGames && (
        <div
          className="flex flex-col rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div
            className="px-4 py-2 text-sm font-semibold flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <span>
              {games.length > 0
                ? `${games.length} games found`
                : `${parsedGames.length} games in PGN`}
            </span>
            <button
              onClick={() => { onReset(); setUsername(''); }}
              className="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              ← New search
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {/* Chess.com games */}
            {games.map((game, i) => (
              <button
                key={i}
                onClick={() => onSelectGame(game.pgn)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-[var(--bg-tertiary)]"
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {game.white.username} ({game.white.rating}) vs{' '}
                    {game.black.username} ({game.black.rating})
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatTimeClass(game.time_class)} &middot; {formatDate(game.end_time)}
                  </div>
                </div>
                <div
                  className="text-sm font-mono font-bold shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {formatResult(game.white, game.black)}
                </div>
              </button>
            ))}

            {/* Parsed PGN games */}
            {parsedGames.map((game, i) => (
              <button
                key={i}
                onClick={() => onSelectParsedGame(game)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-[var(--bg-tertiary)]"
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {game.white}
                    {game.white_elo ? ` (${game.white_elo})` : ''} vs{' '}
                    {game.black}
                    {game.black_elo ? ` (${game.black_elo})` : ''}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {game.date} &middot; {game.moves.length} moves
                  </div>
                </div>
                <div
                  className="text-sm font-mono font-bold shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {game.result}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
