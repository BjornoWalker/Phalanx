# Backend — Python / FastAPI

The backend provides the chess engine integration, game analysis, coaching logic, puzzle database, and opening repertoire management. It serves both a REST API and WebSocket endpoints.

## Running

```bash
# Development (with auto-reload)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Production (launched by scripts/chess)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level warning
```

## Module Overview

### `app/main.py`
Application entry point. Manages:
- FastAPI app with CORS middleware
- Stockfish engine lifecycle (started on app startup, closed on shutdown)
- WebSocket endpoint registration at `/ws/analysis` and `/ws/coach` (registered directly on the app, not behind router prefixes, to avoid conflicts with the static file catch-all mount)
- Static file serving for the built frontend (`frontend/dist/`)

### `app/engine/` — Chess Engine Layer

| File | Purpose |
|------|---------|
| `stockfish.py` | `StockfishAdapter` — singleton wrapper around Stockfish via `python-chess` UCI protocol. Methods: `analyze_position()`, `play_move()`, `set_difficulty()`. Difficulty maps to Skill Level (0–13) for lower ratings or `UCI_Elo` for higher. |
| `analysis.py` | Move quality classification (`classify_move()` using centipawn loss thresholds), accuracy computation (Chess.com formula), full game analysis (`analyze_game()`). Handles checkmate/stalemate edge cases. |
| `threats.py` | `detect_threats()` — scans the board for hanging pieces (attacked + undefended) and en-prise pieces (attacked by lower-value pieces). Used by the coaching system. |

**Classification thresholds:**
- 0 cp + best move + sacrifice → Brilliant
- 0 cp + best move + high complexity → Great
- 0 cp + best move → Best
- 1–50 cp → Good
- 51–150 cp → Mistake
- 151–300 cp → Miss
- 300+ cp → Blunder

### `app/coach/` — Coaching System

| File | Purpose |
|------|---------|
| `template.py` | `TemplateCoach` — generates feedback from predefined templates per classification. Interpolates move names, centipawn loss, tactical reasons. Appends threat warnings. |
| `llm.py` | `LLMCoach` — streams natural language coaching from a local Ollama model. Uses before/after FEN prompting to reduce hallucinations. Supports verbosity control (short/medium/long). Appends threat context. |
| `service.py` | `CoachService` — orchestrator that connects `StockfishAdapter` → move classification → threat detection → coaching feedback (template or LLM). Async generator that yields analysis, coaching tokens, and engine moves. |

**Coaching data flow:**
1. Player move arrives via WebSocket
2. `CoachService.evaluate_and_coach()` analyzes position before/after the move
3. Classifies the move (centipawn loss thresholds)
4. Detects threats in the resulting position
5. Yields `{type: "analysis", ...}` with classification and threats
6. Yields coaching feedback: `{type: "coaching", text}` (template) or `{type: "coaching_token", token}` stream (LLM)
7. Yields `{type: "engine_move", ...}` with the engine's response

### `app/review/` — Game Import

| File | Purpose |
|------|---------|
| `chesscom.py` | `ChessComClient` — fetches games from Chess.com's public API. Auto-lowercases usernames, follows redirects, handles 429 rate limiting. Searches up to 12 months back. |
| `pgn.py` | `parse_pgn_string()` — parses PGN text (multi-game) into `ParsedGame` objects using `python-chess`. |

### `app/puzzles/` — Puzzle Training

| File | Purpose |
|------|---------|
| `puzzle_db.py` | `PuzzleDB` — SQLite interface to the Lichess puzzle database at `~/.local-chess-engine/puzzles.db`. Queries by rating range and tactical themes. |
| `puzzle_service.py` | `PuzzleSession` — manages solving a single puzzle. Validates player moves against the expected solution sequence, provides progressive hints (piece → square → full move), auto-plays opponent responses. |

**Puzzle database setup:**
The puzzle database is a filtered subset of the [Lichess puzzle database](https://database.lichess.org/). To regenerate it, download `lichess_db_puzzle.csv.zst`, decompress, and run the import script that filters by rating (600–2400), popularity (≥70), and play count (≥500).

### `app/openings/` — Opening Repertoire

| File | Purpose |
|------|---------|
| `repertoire.py` | `RepertoireDB` — JSON-based storage for personal opening lines at `~/.local-chess-engine/repertoire.json`. Supports PGN import, SM-2 spaced repetition scheduling, drill result recording. |

**SM-2 spaced repetition:**
- Correct drill: `interval *= ease_factor`, ease increases (max 3.0)
- Incorrect drill: `interval = 1 day`, ease decreases (min 1.3)

### `app/api/routes/` — API Endpoints

| Route file | Endpoints |
|-----------|-----------|
| `analysis.py` | `POST /api/analysis/position`, `POST /api/analysis/game`, `WebSocket /ws/analysis` |
| `games.py` | `GET /api/games/chesscom/{username}`, `POST /api/games/upload`, `POST /api/games/analyze` |
| `coach.py` | `POST /api/coach/start`, `WebSocket /ws/coach` |
| `puzzles.py` | `GET /api/puzzles/random`, `GET /api/puzzles/{id}`, `POST /api/puzzles/check`, `POST /api/puzzles/hint`, `GET /api/puzzles/meta/themes`, `GET /api/puzzles/meta/stats` |
| `openings.py` | `GET /api/repertoire/lines`, `POST /api/repertoire/lines`, `POST /api/repertoire/import`, `DELETE /api/repertoire/lines/{id}`, `GET /api/repertoire/drill`, `POST /api/repertoire/drill/result` |
| `settings.py` | `GET /api/settings`, `PUT /api/settings`, `GET /api/settings/themes`, `GET /api/settings/ollama/status`, `POST /api/settings/ollama/pull` |

### `app/models/schemas.py`
Pydantic models for all request/response types: `SettingsModel`, `MoveClassification` enum, `AnalyzedMove`, `GameAnalysis`, `ParsedGame`, `CoachStartRequest`, etc.

### `app/settings_store.py`
Simple JSON file persistence at `~/.local-chess-engine/settings.json`. Functions: `load() → SettingsModel`, `save(settings)`.

## Dependencies

See `requirements.txt`. Key packages:
- `fastapi` + `uvicorn` — web framework and ASGI server
- `python-chess` — chess logic and Stockfish UCI integration
- `httpx` — async HTTP client for Chess.com API
- `ollama` — Ollama Python SDK for LLM coaching
- `python-multipart` — file upload support
- `websockets` — WebSocket protocol support
