import { useState, useCallback, useRef, useEffect } from 'react';
import ChessBoard from '../components/Board/ChessBoard';
import OpeningName from '../components/Board/OpeningName';
import CoachAvatar from '../components/CoachChat/CoachAvatar';
import DifficultySelector from '../components/CoachChat/DifficultySelector';
import CoachChat from '../components/CoachChat/CoachChat';
import ChessClock from '../components/CoachChat/ChessClock';
import RepertoireManager from '../components/Repertoire/RepertoireManager';
import DrillMode from '../components/Repertoire/DrillMode';
import { useCoach } from '../hooks/useCoach';
import { useRepertoire } from '../hooks/useRepertoire';
import { useChessClock, TIME_PRESETS, type TimeControl } from '../hooks/useChessClock';
import { useOpeningName } from '../hooks/useOpeningName';
import { useSettings } from '../contexts/SettingsContext';

type CoachView = 'play' | 'repertoire';

export default function CoachTab() {
  const [view, setView] = useState<CoachView>('play');
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(TIME_PRESETS[0]);
  const coach = useCoach();
  const rep = useRepertoire();
  const clock = useChessClock(selectedTimeControl.baseSeconds, selectedTimeControl.incrementSeconds);
  const hasClock = selectedTimeControl.baseSeconds > 0;

  // Track FEN history for opening lookup (coach only moves forward)
  const fenHistoryRef = useRef<string[]>(['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']);
  useEffect(() => {
    if (coach.state === 'setup') {
      fenHistoryRef.current = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
    } else if (coach.position) {
      const last = fenHistoryRef.current[fenHistoryRef.current.length - 1];
      if (coach.position !== last) {
        fenHistoryRef.current = [...fenHistoryRef.current, coach.position];
      }
    }
  }, [coach.position, coach.state]);
  const opening = useOpeningName(fenHistoryRef.current, fenHistoryRef.current.length - 2);
  const { settings } = useSettings();

  const handlePieceDrop = useCallback(
    (from: string, to: string, _piece: string, promotion?: string): boolean => {
      if (coach.isEngineThinking) return false;
      const result = coach.makeMove(from, to, promotion);
      if (result && hasClock) {
        clock.switchTurn(); // player made move, switch to engine's clock
      }
      return result;
    },
    [coach, clock, hasClock]
  );

  // Start clock when game begins
  useEffect(() => {
    if (coach.state === 'playing' && hasClock && !clock.isRunning && !clock.isFlagged) {
      // Start the player's clock
      const playerColor = coach.boardOrientation;
      clock.start(playerColor);
    }
  }, [coach.state, hasClock, clock]);

  // Switch clock when engine finishes moving
  useEffect(() => {
    if (!coach.isEngineThinking && coach.state === 'playing' && hasClock && clock.isRunning) {
      // Engine just finished, switch to player's clock
      const playerColor = coach.boardOrientation;
      if (clock.activeClock !== playerColor) {
        clock.switchTurn();
      }
    }
  }, [coach.isEngineThinking, coach.state, hasClock, clock]);

  // Handle flag (time ran out)
  useEffect(() => {
    if (clock.isFlagged && coach.state === 'playing') {
      clock.pause();
      // The game is over by time — coach.resetGame will handle UI
    }
  }, [clock.isFlagged, coach.state, clock]);

  // Reset clock when game resets
  useEffect(() => {
    if (coach.state === 'setup') {
      clock.reset(selectedTimeControl.baseSeconds * 1000);
    }
  }, [coach.state, selectedTimeControl, clock]);

  // Repertoire drill mode
  if (rep.drillState === 'drilling' || rep.drillState === 'correct' || rep.drillState === 'incorrect') {
    return (
      <DrillMode
        line={rep.currentLine!}
        position={rep.drillPosition}
        moveIndex={rep.drillMoveIndex}
        feedback={rep.drillFeedback}
        boardOrientation={rep.boardOrientation}
        state={rep.drillState}
        onSubmitMove={rep.submitDrillMove}
        onNextDrill={() => { rep.nextDrill(); rep.startDrill(); }}
        onBack={() => { rep.nextDrill(); setView('repertoire'); }}
      />
    );
  }

  // Repertoire manager view
  if (view === 'repertoire') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex gap-2 px-4 pt-4">
          <button
            onClick={() => setView('play')}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            Play Coach
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
          >
            Opening Drill
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <RepertoireManager
            lines={rep.lines}
            onFetchLines={rep.fetchLines}
            onImportPgn={rep.importPgn}
            onDeleteLine={rep.deleteLine}
            onStartDrill={rep.startDrill}
            isLoading={rep.isLoading}
          />
        </div>
      </div>
    );
  }

  // Setup screen
  if (coach.state === 'setup') {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-[360px] rounded-xl p-6 flex flex-col gap-5"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {/* View toggle */}
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
            >
              Play Coach
            </button>
            <button
              onClick={() => setView('repertoire')}
              className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              Opening Drill
            </button>
          </div>

          <h2 className="text-lg font-semibold text-center">Play Coach</h2>

          {/* Color selector */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Your Color
            </div>
            <div className="flex gap-2">
              {(['white', 'auto', 'black'] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => coach.setPlayerColor(color)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all capitalize"
                  style={{
                    backgroundColor:
                      coach.playerColor === color ? 'var(--bg-tertiary)' : 'transparent',
                    border:
                      coach.playerColor === color
                        ? '2px solid var(--accent-green)'
                        : '2px solid var(--border-color)',
                    color:
                      coach.playerColor === color
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {color === 'auto' ? 'Random' : color}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty selector */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Difficulty
            </div>
            <div
              className="max-h-[320px] overflow-y-auto rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <DifficultySelector
                selected={coach.difficulty}
                onSelect={coach.setDifficulty}
              />
            </div>
          </div>

          {/* Time control */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Time Control
            </div>
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map((tc) => (
                <button
                  key={tc.label}
                  onClick={() => setSelectedTimeControl(tc)}
                  className="px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer transition-all"
                  style={{
                    backgroundColor: selectedTimeControl.label === tc.label ? 'var(--bg-tertiary)' : 'transparent',
                    border: selectedTimeControl.label === tc.label
                      ? '2px solid var(--accent-green)'
                      : '2px solid var(--border-color)',
                    color: selectedTimeControl.label === tc.label ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Play button */}
          <button
            onClick={coach.startGame}
            className="w-full py-3 rounded-lg text-base font-bold cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
          >
            Play
          </button>
        </div>
      </div>
    );
  }

  // Playing / Game over
  return (
    <div className="flex h-full gap-4 p-4">
      {/* Board */}
      <div className="flex flex-col items-center">
        <OpeningName eco={opening?.eco ?? null} name={opening?.name ?? null} />
        <ChessBoard
          position={coach.position}
          onPieceDrop={handlePieceDrop}
          boardOrientation={coach.boardOrientation}
          boardWidth={560}
          boardTheme={settings.board_theme}
          pieceSet={settings.piece_set}
        />
        {hasClock && (
          <div className="w-full mt-1" style={{ maxWidth: 560 }}>
            <ChessClock
              whiteTime={clock.whiteTime}
              blackTime={clock.blackTime}
              activeClock={clock.activeClock}
              boardOrientation={coach.boardOrientation}
              isFlagged={clock.isFlagged}
            />
          </div>
        )}
        {clock.isFlagged && coach.state === 'playing' && (
          <div className="mt-2 text-sm font-semibold" style={{ color: '#ca2c2c' }}>
            {clock.isFlagged === coach.boardOrientation ? 'You ran out of time!' : 'Engine ran out of time!'}
          </div>
        )}
        {coach.isEngineThinking && !clock.isFlagged && (
          <div
            className="mt-2 text-sm flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <div
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }}
            />
            Engine is thinking...
          </div>
        )}
      </div>

      {/* Right Panel: Coach Chat */}
      <div
        className="flex flex-col w-[320px] rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', marginTop: 28 }}
      >
        <div
          className="px-4 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <CoachAvatar avatarId={settings.coach_avatar} size="md" />
            <div>
              <div className="text-base font-semibold">Coach</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {coach.difficulty}
              </div>
            </div>
          </div>
        </div>

        <CoachChat messages={coach.messages} avatarId={settings.coach_avatar} />

        {/* Game over footer */}
        {coach.state === 'game_over' && (
          <div
            className="px-4 py-3 shrink-0 space-y-2"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            {coach.gameOverReason && (
              <div
                className="text-center text-sm font-semibold py-1 rounded capitalize"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                {coach.gameOverReason}
              </div>
            )}
            <button
              onClick={coach.resetGame}
              className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--accent-green)', color: 'white' }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
