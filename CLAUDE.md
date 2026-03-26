# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Phalanx v2.2 — a fully local chess application for macOS with five tabs: Analysis (multi-engine eval + variation tree + candidate moves), Game Review (Chess.com + Lichess with critical moments + improvement suggestions), Coach (timed games + 5 personality coaching), Puzzles (2.3M adaptive Lichess puzzles), and Settings. Includes opening repertoire drills with SM-2 spaced repetition and per-line accuracy stats.

## Commands

```bash
# Production
./scripts/chess

# Development (two terminals)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev

# Frontend checks
cd frontend && npx tsc --noEmit     # type-check
cd frontend && npm run build        # production build -> dist/

# Testing
cd backend && source .venv/bin/activate && python -m pytest tests/ -v  # 71 backend tests
cd frontend && npx vitest run                                          # 22 frontend tests

# Prerequisites
brew install stockfish              # required
brew install lc0                    # optional, for Lc0 engine
brew install ollama                 # optional, for LLM coaching
```

## Architecture

See `backend/README.md` and `frontend/README.md` for detailed module documentation.

```
backend/app/
├── main.py                         # FastAPI app, EngineManager lifecycle, WS routing
├── engine/
│   ├── manager.py                  # EngineManager (Stockfish + Lc0)
│   ├── stockfish.py                # StockfishAdapter singleton
│   ├── lc0.py                      # Lc0Adapter (neural net, Metal GPU)
│   ├── protocol.py                 # EngineProtocol interface
│   ├── analysis.py                 # Move classification, accuracy, game analysis
│   ├── threats.py                  # Hanging/en-prise piece detection
│   ├── tablebase.py                # Syzygy endgame tablebase probing
│   └── pawn_structure.py           # Pawn structure analysis
├── coach/{template,llm,service}.py # Dual-mode coaching (template + Ollama LLM)
├── review/{chesscom,lichess,pgn}.py # Chess.com + Lichess API + PGN parser
├── puzzles/{puzzle_db,puzzle_service}.py  # Lichess puzzles (SQLite)
├── openings/repertoire.py          # Opening repertoire (JSON + SM-2 spaced repetition)
├── api/routes/{analysis,games,coach,puzzles,openings,settings}.py
├── models/schemas.py               # Pydantic models
└── settings_store.py               # JSON persistence (~/.phalanx/)

frontend/src/
├── App.tsx                         # 5-tab navigation
├── tabs/{Analysis,Review,Coach,Puzzles,Settings}Tab.tsx
├── hooks/{useChessGame,useEngine,useCoach,useGameReview,usePuzzles,useRepertoire,useOpeningName,useChessClock}.ts
├── types/gameTree.ts               # Variation tree types (GameNode, GameTree)
├── components/
│   ├── Board/                      # ChessBoard, BoardControls, PositionSetup, OpeningName
│   ├── MoveHistory/                # Tree-aware move list with annotations
│   ├── EvalGraph/                  # EvalBar + EvalGraph with tooltips
│   ├── CoachChat/                  # Chat feed, DifficultySelector, CoachAvatar, ChessClock
│   ├── Review/                     # GameSelector (Chess.com + Lichess), ReviewSummary
│   ├── Repertoire/                 # RepertoireManager, DrillMode
│   └── KeyboardShortcutsHelp.tsx
├── contexts/SettingsContext.tsx
└── services/{api,websocket,sounds,analysisCache,pgnExport}.ts
```

## Key Design Decisions

- **Multi-engine**: `EngineManager` holds Stockfish (always) + Lc0 (optional). Both implement the same interface. Engine choice passed through WebSocket messages. Lc0 uses node-based search (not depth) for consistent timing.
- **Game state**: Tree-based (`GameTree` with flat `Map<string, GameNode>`). Supports variation branching, promotion, deletion. Backward-compatible: derives `history[]` and `currentIndex` from mainline.
- **Communication**: REST for CRUD, WebSocket for streaming. WS endpoints at `/ws/analysis` and `/ws/coach` registered directly on the app (not behind router prefixes) to avoid static-file catch-all conflicts.
- **Analysis caching**: Dexie.js (IndexedDB). Key: `FEN|depth|multipv`. Deeper cached results satisfy shallower requests. Auto-evicts after 30 days. `engineChoiceRef` ensures latest engine selection is used.
- **Endgame optimization**: positions with ≤5 pieces cap at depth 10 + multipv 1 (tablebase gives perfect results). All engine calls have 5s time limit safety net.
- **Double-analysis prevention**: `moveJustPlayedRef` flag prevents the auto-analyze effect from firing when a move was just made (the move handler already triggers analysis with classification).
- **Click-to-move**: Uses `onSquareClick` only (not `onPieceClick`) — both fire on the same click due to event bubbling in react-chessboard v5.
- **Keyboard shortcuts**: Check `tagName` to skip when focus is in INPUT/TEXTAREA/SELECT. Mac-friendly: ⌘←/⌘→ for start/end.
- **Classification thresholds**: 0cp+sacrifice→Brilliant, 0cp+complex→Great, 0cp→Best, 1-50cp→Good, 51-150cp→Mistake, 151-300cp→Miss, 300+→Blunder
- **Coaching**: Template mode appends threat warnings. LLM mode injects threats into prompt. Verbosity controls prompt instruction. 5 personality prompts keyed by avatar ID (`PERSONALITY_PROMPTS` in llm.py).
- **Castling auto-detection**: PositionSetup auto-updates castling rights based on king/rook placement. Tablebase probe catches ValueError for positions with castling rights.
- **Tab persistence**: All tabs mounted with `visibility: hidden` + `position: absolute` (NOT `display: none` which breaks react-chessboard). `ActiveTabContext` provides `isActive` so keyboard handlers only fire for the visible tab.
- **Pawn promotion**: ChessBoard detects promotion via rank check, shows `PromotionDialog` overlay, completes move with chosen piece.
- **Adaptive game analysis**: depth scales with game length (15 for <20 moves, 12 for 20-60, 10 for 60+) to prevent long blocking. Auto-timeout proportional to move count.
- **Adaptive puzzles**: rolling 10-result window adjusts rating range ±50 when solve rate exceeds 85% or drops below 40%.
- **Error boundaries**: Each tab wrapped in `ErrorBoundary` component. Crashes show "Something went wrong" with "Try Again" instead of gray screen.
- **Testing**: 71 pytest backend tests + 22 vitest frontend tests. Run via `pytest tests/ -v` and `npx vitest run`.

## Data Storage

| Data | Location |
|------|----------|
| Settings | `~/.phalanx/settings.json` |
| Puzzles | `~/.phalanx/puzzles.db` (SQLite, ~645MB) |
| Repertoire | `~/.phalanx/repertoire.json` |
| Syzygy tablebases | `~/.phalanx/syzygy/` (~938MB) |
| Lc0 weights | `~/.phalanx/lc0/weights.pb.gz` (~35MB) |
| Analysis cache | Browser IndexedDB `ChessAnalysisCache` |
| Opening DB | `frontend/public/openings.json` (3,641 ECO entries) |

## Python Style

Follow PEP 8. Use type hints. Structure backend code with clear module separation.
