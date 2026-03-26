# Frontend — React + Vite + TypeScript

The frontend is a single-page application built with React, Vite, and TypeScript. It communicates with the backend via REST API and WebSocket connections.

## Running

```bash
# Development (hot-reload on :5173, proxies to backend on :8000)
npm run dev

# Type-check
npx tsc --noEmit

# Production build (output to dist/)
npm run build
```

## Architecture

The app follows a **hooks + components + tabs** pattern:
- **Hooks** manage all state and business logic
- **Components** are pure UI (receive data via props)
- **Tabs** wire hooks to components for each view
- **Contexts** provide global state (settings)
- **Services** handle external communication (API, WebSocket, IndexedDB)

## Tabs (`src/tabs/`)

| Tab | Description |
|-----|-------------|
| `AnalysisTab` | Free analysis board with real-time engine eval, variation tree, position setup, PGN export |
| `ReviewTab` | Chess.com game import, PGN upload, full game analysis with accuracy scores |
| `CoachTab` | Play vs Stockfish with coaching feedback. Includes toggle to Opening Drill mode |
| `PuzzlesTab` | Tactical puzzles from Lichess database with rating/theme filters and hints |
| `SettingsTab` | Appearance, analysis, coaching, Ollama model management, cache |

## Hooks (`src/hooks/`)

| Hook | Purpose | Key State |
|------|---------|-----------|
| `useChessGame` | Core game state backed by a **variation tree** (not a linear array). Supports branching, variation promotion/deletion, FEN loading, PGN loading. Exports backward-compatible `history`/`currentIndex` for components that don't need tree awareness. | `tree: GameTree`, `currentPath`, `position`, `history` |
| `useEngine` | WebSocket connection to `/ws/analysis`. Sends position for analysis, receives eval + best move + classification. **Caches results in IndexedDB** (via Dexie.js) — cache hits skip the WebSocket entirely. Clears stale results on position change. | `evaluation`, `bestMove`, `classification`, `isAnalyzing` |
| `useCoach` | WebSocket connection to `/ws/coach`. Manages coach game lifecycle (setup → playing → game_over). Handles streaming coaching tokens, engine moves, sounds. Reads coaching settings. | `state`, `position`, `messages`, `isEngineThinking` |
| `useGameReview` | State machine for game review flow (idle → loading → game_list → analyzing → reviewing). Fetches from Chess.com API or PGN upload, triggers backend analysis. | `state`, `games`, `analysis`, `selectedGamePgn` |
| `usePuzzles` | Puzzle solving state machine. Fetches random puzzles, validates moves against solution, provides progressive hints, tracks stats in localStorage. | `state`, `puzzle`, `position`, `stats`, `hint` |
| `useRepertoire` | Opening repertoire management and drill mode. Imports PGN lines, runs spaced-repetition drills, tracks correct/incorrect counts. | `lines`, `drillState`, `drillPosition` |
| `useOpeningName` | Looks up the current opening from a static ECO database (`openings.json`). Walks backward through the FEN history to find the most recent match. | `{ eco, name }` |

### The Game Tree (`src/types/gameTree.ts`)

The `useChessGame` hook uses a **tree data structure** instead of a linear array, enabling variation exploration:

```
GameNode {
  id, san, uci, fen, color, parentId, children[],
  classification?, comment?, nags?
}

GameTree {
  nodes: Map<string, GameNode>  // flat map for efficient React updates
  rootId: string                // sentinel node (starting position)
  currentPath: string[]         // [rootId, nodeId1, ...] — which branch we're on
}
```

Navigation is path-based: `goBack()` pops the path, `goForward()` follows the first child. `makeMove()` creates a new branch when a different move is played from a position that already has children.

Backward compatibility: `history`, `currentIndex`, and `fenHistory` are derived from the mainline (first-child chain) so components that haven't been updated to tree-awareness still work.

## Components (`src/components/`)

### `Board/`
| Component | Purpose |
|-----------|---------|
| `ChessBoard` | Wraps `react-chessboard`. Handles drag-drop AND click-to-move (via `onSquareClick` only — using both `onPieceClick` and `onSquareClick` causes double-firing due to event bubbling). Shows legal move dots, best-move arrow, classification highlights, custom arrows. Supports scroll-to-navigate and custom piece sets. |
| `BoardControls` | Navigation buttons: flip, reset, setup, start/back/forward/end |
| `PositionSetup` | Modal with editable board (spare pieces), FEN input, side-to-move toggle, castling checkboxes |
| `OpeningName` | Displays ECO code badge + opening name above the board |

### `MoveHistory/`
Renders the move list in two modes:
- **Tree mode** (Analysis tab): uses `displayItems` from the game tree. Renders mainline in paired rows, variations indented with collapse/expand toggles.
- **Linear mode** (Review/Coach tabs): classic paired move rows from `history[]` with classification icons.

### `EvalGraph/`
| Component | Purpose |
|-----------|---------|
| `EvalBar` | Vertical bar showing white/black advantage with eval text |
| `EvalGraph` | recharts area chart — click to navigate, current move highlighted |

### `CoachChat/`
| Component | Purpose |
|-----------|---------|
| `CoachChat` | Message feed with coach avatar, classification badges, streaming text |
| `CoachAvatar` | Emoji avatar with 5 options |
| `DifficultySelector` | 7-tier card list |

### `Review/`
| Component | Purpose |
|-----------|---------|
| `GameSelector` | Username input, PGN upload, featured players, game list |
| `ReviewSummary` | Accuracy scores, move quality breakdown |

### `Repertoire/`
| Component | Purpose |
|-----------|---------|
| `RepertoireManager` | PGN import, line list, color filter, drill launcher |
| `DrillMode` | Interactive drilling with progress bar and revealed/hidden moves |

## Services (`src/services/`)

| Service | Purpose |
|---------|---------|
| `api.ts` | REST API client (fetch wrapper) |
| `websocket.ts` | `WebSocketManager` with auto-reconnect (exponential backoff) |
| `sounds.ts` | Audio playback for moves, captures, notifications |
| `analysisCache.ts` | Dexie.js IndexedDB wrapper for caching position evaluations. Key: `FEN\|depth\|multipv`. Auto-evicts after 30 days. |
| `pgnExport.ts` | Walks game tree → generates annotated PGN with evals, NAGs, variations |

## Static Assets (`public/`)

| Asset | Purpose |
|-------|---------|
| `openings.json` | 3,641 ECO openings keyed by FEN (Lichess, CC0) |
| `pieces/{set}/*.svg` | 4 piece sets from Lichess (AGPL-3.0) |
| `sounds/*.mp3` | Move/capture/notify sounds from Lichess (BSD) |
