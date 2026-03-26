# Local Chess Engine

A fully local chess application for macOS with real-time Stockfish analysis, Chess.com game review, interactive coaching, puzzle training, and opening drills — all running from a single terminal command.

## Features

### Analysis
- **Drag-and-drop** or **click-to-move** piece interaction
- **Multi-engine**: choose **Stockfish** (fast, tactical), **Lc0** (neural net, positional), or **Both** for side-by-side comparison
- Real-time evaluation with move quality classification (**Brilliant**, **Great**, **Best**, **Good**, **Mistake**, **Miss**, **Blunder**)
- **Lc0 Win/Draw/Loss** probabilities displayed as a visual bar when using the neural net engine
- **Variation exploration** — play a different move from any position to branch into alternative lines, displayed as a collapsible tree in the move history
- **Custom position setup** — drag pieces onto an empty board or paste a FEN string to analyze any position (castling rights auto-detected)
- **Syzygy endgame tablebases** — perfect win/draw/loss results for positions with ≤5 pieces
- **Pawn structure analysis** — toggleable panel showing isolated, doubled, and passed pawns
- **Blunder alerts** — audio + visual flash on mistakes (configurable threshold)
- **Move annotations** — right-click any move to add !, !!, ?, ??, !?, ?! or text comments
- Toggleable **best-move arrow** (green for Stockfish, blue for Lc0) and **evaluation bar**
- **Evaluation graph** with hover tooltips showing move number, SAN, and eval
- **Opening name detection** — 3,641 ECO openings from Lichess, updates as you navigate
- **Analysis caching** — previously analyzed positions load instantly from IndexedDB (auto-expires after 30 days)
- **Candidate move explorer** — click any engine line to instantly play that move and explore
- **PGN export** with engine evaluations, annotations, and variations
- **Board annotations** — right-click squares to add circle highlights, right-click-drag for arrows
- Keyboard shortcuts: `⌘Z` undo, `?` for help overlay

### Game Review
- Fetch recent games from **Chess.com** or **Lichess** (platform toggle)
- **Featured players** quick-select for both platforms
- **Player names and ratings** displayed above/below the board during review
- **Critical moments** — top 3 biggest evaluation swings highlighted, clickable to jump
- **Improvement suggestions** — auto-generated feedback on opening, tactics, and endgame play
- **Clickable move quality rows** — click any classification (Brilliant, Blunder, etc.) to jump to the first occurrence
- **Adaptive analysis depth** — scales with game length (depth 15 for short, 12 for medium, 10 for long games)
- **Cancel** button during long-running analysis
- Upload **PGN files** for offline review
- Full game analysis with **accuracy scores** and per-player move quality breakdown
- **Export** reviewed games as annotated PGN

### Coach Mode
- Play against **Stockfish** at 7 difficulty levels (200–2000 rating)
- Choose White, Black, or **Random** color assignment
- **Time controls**: No Clock, Bullet (1+0, 2+1), Blitz (3+0, 3+2, 5+0, 5+3), Rapid (10+0, 15+10) with live clocks and flag detection
- Move-by-move **coaching feedback** with move quality classification
- **5 coach personalities**: Robot (data-driven), Teacher (patient), Wizard (Socratic), Brain (analytical), Owl (principled) — each with distinct LLM prompts
- **Threat detection** — warns about hanging and en-prise pieces
- Two coaching modes:
  - **Template-based** (default): instant feedback
  - **LLM-powered** (optional): natural language coaching via local Ollama model
- Configurable **response length**: Short (1 sentence), Medium (2–3), Long (4–6)
- **Pawn promotion dialog** — choose Queen, Rook, Bishop, or Knight when promoting
- **Chess move sounds** for moves, captures, and game-over events

### Puzzles
- **2.3 million puzzles** from the Lichess puzzle database (stored locally in SQLite)
- Filter by **rating range** (400–2400) and **tactical theme** (fork, pin, skewer, mate-in-N, sacrifice, and 18 more)
- **Adaptive difficulty** — auto-adjusts rating range based on your solve rate (target ~65%), toggleable
- Interactive solving: find the best move, opponent auto-responds, continue the sequence
- **Progressive hints**: which piece → which square → full move
- **Mastery levels**: Beginner → Apprentice → Skilled → Expert → Master
- **Stats tracking**: solved, streak, today's count, this week's count (persisted in localStorage)

### Opening Drills
- Build a personal **opening repertoire** by importing PGN lines
- **Drill mode**: the app plays opponent moves, you play your prepared responses
- **Spaced repetition** (SM-2 algorithm): lines you struggle with come up more frequently
- **Repertoire statistics**: total lines, overall accuracy, per-line accuracy bars
- Progress tracking with correct/incorrect counts per line

### Settings
- **6 board themes** (including high-contrast for accessibility), 4 piece styles, dark/light mode
- **Engine selector**: Stockfish, Lc0, or Both
- **5 coach personalities** with distinct teaching styles
- Coaching mode, response length, blunder alert threshold
- Analysis depth (10–25) and engine lines (1–5)
- **Ollama model browser**: see installed models, download new ones from the UI
- **Analysis cache** stats and clear button
- **Endgame tablebase** status indicator
- All settings persist across sessions
- **Tab state preserved** — switching tabs doesn't lose your progress

## Prerequisites

- **macOS** (tested on macOS Sequoia with Apple Silicon)
- **Python 3.11+**
- **Node.js 18+** and npm
- **Stockfish** chess engine (required)
- **Lc0** neural net engine (optional — for Lc0/Both engine mode)
- **Ollama** (optional — for LLM coaching mode)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd local-chess-engine
```

### 2. Install Stockfish

```bash
brew install stockfish
```

### 3. Set up the Python backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Set up the React frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Launch

```bash
./scripts/chess
```

This will start the server and open your browser to http://127.0.0.1:8000. Press `Ctrl+C` to stop.

### 6. (Optional) Install Ollama for LLM coaching

```bash
brew install ollama
ollama serve                  # run in a separate terminal
ollama pull llama3.1:8b       # download a model (~4.7GB)
```

You can also download models directly from the Settings tab in the app. Any Ollama-compatible model works.

### 7. (Optional) Install Lc0 for neural net analysis

```bash
brew install lc0
```

Lc0 requires a neural net weights file. Download one and place it at `~/.local-chess-engine/lc0/weights.pb.gz`:

```bash
mkdir -p ~/.local-chess-engine/lc0
curl -L "https://storage.lczero.org/files/networks-contrib/t1-256x10-distilled-swa-2432500.pb.gz" \
  -o ~/.local-chess-engine/lc0/weights.pb.gz
```

Once installed, select "Lc0" or "Both" in Settings > Analysis > Engine.

### 8. (Optional) Create a global shortcut

```bash
ln -sf "$(pwd)/scripts/chess" /usr/local/bin/chess
```

Then just type `chess` from any terminal.

## Development

For development with hot-reloading:

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev

# Type-check
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build
```

The Vite dev server (port 5173) proxies `/api` and `/ws` requests to the backend (port 8000).

## Testing

The project has **93 tests** across backend and frontend covering core logic, move classification, puzzle solving, spaced repetition, game tree operations, and PGN export.

### Run all tests

```bash
# Backend (71 tests, pytest)
cd backend && source .venv/bin/activate && python -m pytest tests/ -v

# Frontend (22 tests, vitest)
cd frontend && npx vitest run
```

### Backend test coverage

| Test file | Tests | What it covers |
|-----------|-------|----------------|
| `test_analysis.py` | 18 | Move classification thresholds (all 7 levels), centipawn loss for white/black, accuracy formula, sacrifice detection, position complexity |
| `test_threats.py` | 5 | Hanging piece detection, en-prise detection, king exclusion, output structure |
| `test_pawn_structure.py` | 8 | Isolated/doubled/passed pawns, pawn islands, no-pawn endgames, description generation |
| `test_template.py` | 5 | Coaching feedback for all classifications, threat appending, tactical reason generation |
| `test_puzzle_service.py` | 9 | Puzzle session lifecycle, correct/wrong moves, 3 hint levels, full puzzle completion |
| `test_repertoire.py` | 13 | Add/delete/import lines, SM-2 correct/incorrect paths, ease factor bounds, file persistence |

### Frontend test coverage

| Test file | Tests | What it covers |
|-----------|-------|----------------|
| `gameTree.test.ts` | 14 | Tree creation, FEN retrieval, mainline extraction, path building, variation handling, display flattening |
| `pgnExport.test.ts` | 8 | Header formatting, move text, classifications, NAG annotations, comments, variations, move numbering |

### Adding new tests

Backend tests go in `backend/tests/` following the module structure. Frontend tests go in `frontend/src/__tests__/`. Both use standard assertion patterns:

```python
# Backend (pytest)
def test_blunder_classification():
    result = classify_move(cp_loss=500, is_sacrifice=False, complexity=0.5, is_best_move=False)
    assert result == MoveClassification.BLUNDER
```

```typescript
// Frontend (vitest)
it('follows first child for mainline', () => {
  const mainline = getMainline(tree);
  expect(mainline[0].san).toBe('e4');
});
```

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                         │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Analysis │ │  Review  │ │  Coach   │ │ Puzzles  │ │ Settings │ │
│  │   Tab    │ │   Tab    │ │   Tab    │ │   Tab    │ │   Tab    │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │            │             │            │       │
│  ┌────┴─────────────┴────────────┴─────────────┴────────────┘       │
│  │  Shared: useChessGame (GameTree), SettingsContext, Sounds        │
│  └────┬──────────────────────────────────┬──────────────────┘       │
│       │ REST API                         │ WebSocket                │
│       │ (fetch)                          │ (streaming)              │
└───────┼──────────────────────────────────┼──────────────────────────┘
        │                                  │
        ▼                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Python)                        │
│                                                                   │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐  │
│  │    REST Routes       │    │    WebSocket Endpoints            │  │
│  │  /api/analysis/*     │    │  /ws/analysis (real-time eval)   │  │
│  │  /api/games/*        │    │  /ws/coach (streaming coaching)  │  │
│  │  /api/coach/*        │    └───────────────┬──────────────────┘  │
│  │  /api/puzzles/*      │                    │                     │
│  │  /api/repertoire/*   │                    │                     │
│  │  /api/settings/*     │                    │                     │
│  └──────────┬───────────┘                    │                     │
│             │                                │                     │
│  ┌──────────┴────────────────────────────────┴──────────────────┐  │
│  │                    Engine Manager                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │  │
│  │  │  Stockfish   │  │     Lc0      │  │  Syzygy Tablebases │  │  │
│  │  │  (UCI, fast) │  │ (Neural net) │  │  (5-piece, ~1GB)   │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Coach Service │  │ Puzzle DB    │  │ Repertoire (SM-2)      │  │
│  │ Template+LLM  │  │ (SQLite)     │  │ (JSON + spaced rep)    │  │
│  └──────┬───────┘  └──────────────┘  └────────────────────────┘  │
│         │                                                         │
│  ┌──────┴───────┐                                                 │
│  │   Ollama     │  ← Local LLM inference (optional)               │
│  │  (localhost) │                                                  │
│  └──────────────┘                                                  │
└───────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  External APIs      │
                    │  (internet, read)   │
                    │  • Chess.com API    │
                    │  • Lichess API      │
                    └────────────────────┘
```

### Data Flow

1. **User plays a move** → ChessBoard component validates via chess.js → `useChessGame` adds to GameTree → triggers `useEngine` → WebSocket sends FEN to backend → EngineManager routes to Stockfish/Lc0 → analysis result streams back → UI updates (eval bar, best-move arrow, classification badge, sounds)

2. **Game review** → Fetch from Chess.com/Lichess API → parse PGN → backend analyzes every move (depth scales with game length) → returns `GameAnalysis` with accuracy scores, classifications, eval graph → ReviewTab renders step-by-step walkthrough

3. **Coach game** → Player move → backend classifies move → detects threats → generates coaching feedback (template or streaming LLM via Ollama) → engine plays response move → all streamed via WebSocket

4. **Puzzle solving** → Backend selects random puzzle from SQLite → sends FEN after setup move → player finds best move → backend validates against solution → auto-plays opponent response → tracks stats in localStorage

### Key Design Principles

- **Fully local**: No cloud infrastructure. Internet only for Chess.com/Lichess game fetching.
- **Low-latency**: UI interactions are instant (client-side). Engine analysis returns in milliseconds. Analysis caching (IndexedDB) makes revisited positions instant.
- **Multi-engine**: Stockfish and Lc0 implement the same interface (`EngineProtocol`). Either can be used for analysis, coaching, or compared side-by-side.
- **Tree-based game state**: `GameTree` with flat `Map<string, GameNode>` supports variation branching, promotion, deletion. Backward-compatible linear `history[]` derived from mainline.
- **Tab persistence**: All 5 tabs stay mounted (using `visibility: hidden`, not `display: none` which breaks react-chessboard). Each tab's keyboard handler checks `isActive` via context.

### File Structure

```
local-chess-engine/
├── backend/                     # Python 3.11+ / FastAPI
│   ├── app/
│   │   ├── main.py              # App entry, engine lifecycle, WebSocket routing
│   │   ├── api/routes/          # REST + WebSocket endpoints
│   │   │   ├── analysis.py      # Position & game analysis, /ws/analysis
│   │   │   ├── games.py         # Chess.com import, PGN upload
│   │   │   ├── coach.py         # Coach game management, /ws/coach
│   │   │   ├── puzzles.py       # Puzzle API (random, check, hint, themes)
│   │   │   ├── openings.py      # Repertoire management + drill API
│   │   │   └── settings.py      # Settings CRUD, Ollama model management
│   │   ├── engine/              # Stockfish adapter, move classification, threats
│   │   ├── coach/               # Template + LLM coaching feedback
│   │   ├── review/              # Chess.com API client + PGN parser
│   │   ├── puzzles/             # Puzzle database (SQLite) + solving logic
│   │   ├── openings/            # Repertoire storage + spaced repetition
│   │   └── models/schemas.py    # Pydantic models
│   └── requirements.txt
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx              # Tab navigation (Analysis, Review, Coach, Puzzles, Settings)
│   │   ├── tabs/                # Tab view components
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Board/           # ChessBoard, BoardControls, PositionSetup, OpeningName
│   │   │   ├── MoveHistory/     # Tree-aware move list with variations
│   │   │   ├── EvalGraph/       # EvalBar + EvalGraph (recharts)
│   │   │   ├── CoachChat/       # Chat feed, DifficultySelector, CoachAvatar
│   │   │   ├── Review/          # GameSelector, ReviewSummary
│   │   │   └── Repertoire/      # RepertoireManager, DrillMode
│   │   ├── hooks/               # State management hooks
│   │   ├── types/               # GameTree types for variation support
│   │   ├── contexts/            # SettingsContext
│   │   └── services/            # API, WebSocket, sounds, analysis cache, PGN export
│   └── public/
│       ├── openings.json        # ECO opening database (3,641 entries)
│       ├── pieces/              # SVG piece sets (4 styles)
│       └── sounds/              # Move, capture, notify audio
└── scripts/chess                # One-command launcher
```

### Communication

| Method | Use Case |
|--------|----------|
| REST API | Settings, game fetching, PGN upload, puzzle queries, repertoire management |
| WebSocket `/ws/analysis` | Real-time position analysis with move classification |
| WebSocket `/ws/coach` | Streaming coaching feedback + engine moves |

### Key Libraries

| Library | Purpose |
|---------|---------|
| [FastAPI](https://fastapi.tiangolo.com/) | Python async web framework with WebSocket support |
| [python-chess](https://python-chess.readthedocs.io/) | Chess logic, Stockfish UCI, PGN parsing |
| [react-chessboard](https://github.com/Clariity/react-chessboard) | Board rendering with drag-drop, click-to-move, arrows |
| [chess.js](https://github.com/jhlywa/chess.js) | Client-side move validation |
| [Dexie.js](https://dexie.org/) | IndexedDB wrapper for analysis caching |
| [recharts](https://recharts.org/) | Evaluation graph |
| [Ollama](https://ollama.com/) | Local LLM inference (optional) |
| [Stockfish](https://stockfishchess.org/) | Chess engine (tactical, fast) |
| [Lc0](https://lczero.org/) | Neural net chess engine (positional, WDL) |

## Data Storage

| Data | Location | Size |
|------|----------|------|
| Settings | `~/.local-chess-engine/settings.json` | <1 KB |
| Puzzle database | `~/.local-chess-engine/puzzles.db` | ~645 MB |
| Opening repertoire | `~/.local-chess-engine/repertoire.json` | Varies |
| Analysis cache | Browser IndexedDB (`ChessAnalysisCache`) | Grows over time, auto-expires after 30 days |
| Syzygy tablebases | `~/.local-chess-engine/syzygy/` | ~938 MB (5-piece) |
| Lc0 neural net | `~/.local-chess-engine/lc0/weights.pb.gz` | ~35 MB |
| Ollama models | `~/.ollama/models/` | 2–12 GB per model |

### Ollama Model Management

```bash
ollama list              # see installed models and sizes
ollama rm <model-name>   # delete a model to free disk space
ollama pull <model-name> # download (can also be done from Settings UI)
```

**Recommended models:**

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| Phi-3 Mini 3.8B | ~2.3 GB | Very fast | Quick feedback |
| Mistral 7B | ~4.1 GB | Fast | Strong reasoning |
| Llama 3.1 8B | ~4.7 GB | Fast | Best balance (recommended) |
| DeepSeek-R1 8B | ~5.2 GB | Fast | Excellent tactical explanations |
| Gemma 2 9B | ~5.4 GB | Moderate | Good explanations |
| DeepSeek-R1 14B | ~9.0 GB | Moderate | More detailed coaching |
| GPT-OSS 20B | ~12 GB | Moderate | Strong reasoning |

## Configuration

All settings are configurable from the Settings tab and persist at `~/.local-chess-engine/settings.json`.

| Setting | Default | Description |
|---------|---------|-------------|
| `board_theme` | `green` | Board color theme |
| `piece_set` | `default` | Piece style |
| `dark_mode` | `true` | Dark/light mode |
| `coaching_mode` | `template` | Coaching feedback mode (template or llm) |
| `coach_verbosity` | `medium` | Response length (short, medium, long) |
| `coach_avatar` | `robot` | Coach icon |
| `llm_model` | `llama3.1:8b` | Ollama model for LLM coaching |
| `analysis_depth` | `20` | Stockfish search depth (10–25) |
| `multipv` | `3` | Number of engine lines (1–5) |
| `show_best_move` | `true` | Show best-move arrow |
| `difficulty` | `Intermediate` | Default engine difficulty |
| `engine_choice` | `stockfish` | Engine for analysis (stockfish, lc0, both) |
| `blunder_alerts` | `true` | Audio + visual alert on blunders |
| `blunder_threshold` | `150` | Centipawn loss threshold for alerts |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / next move |
| `⌘ ←` / `⌘ →` | Go to start / end of game |
| `⌘ Z` / `⌘ ⇧ Z` | Undo / redo move |
| `Space` | Flip the board |
| Scroll wheel | Previous / next move (on board) |
| Right-click square | Toggle circle highlight |
| Right-click drag | Draw arrow |
| `Esc` | Close dialog |
| `?` | Show keyboard shortcuts help |

## Troubleshooting

**Stockfish not found**
```bash
brew install stockfish
```

**Port 8000 already in use**
```bash
lsof -ti:8000 | xargs kill -9
```

**Ollama not running**
```bash
ollama serve    # start in a separate terminal
```
If Ollama is unavailable, the coach falls back to template-based feedback automatically.

**Puzzles not loading**
The puzzle database must be imported first. If `~/.local-chess-engine/puzzles.db` doesn't exist, see the development setup docs in `backend/README.md` for the import script.

**Chess.com returns no games**
Usernames are auto-lowercased. The app searches up to 12 months of history. If the player has very few recent games, try a broader search or upload a PGN file.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- [Stockfish](https://stockfishchess.org/) — open-source chess engine (GPL-3.0)
- [Lc0 / Leela Chess Zero](https://lczero.org/) — neural network chess engine (GPL-3.0)
- [Lichess](https://lichess.org/) — puzzle database (CC0), chess openings (CC0), piece sets (AGPL-3.0), Syzygy tablebases
- [react-chessboard](https://github.com/Clariity/react-chessboard) — board rendering
- [chess.js](https://github.com/jhlywa/chess.js) — client-side chess logic
- [Dexie.js](https://dexie.org/) — IndexedDB wrapper
- [Ollama](https://ollama.com/) — local LLM inference
