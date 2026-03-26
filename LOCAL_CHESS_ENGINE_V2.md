# Local Chess Engine — V2 Recommendations

A prioritized list of feature enhancements, fixes, and improvements based on a full review of the V1 codebase.

## Implementation Progress

### V2.0 — Core Features (COMPLETE)
- [x] Phase 2.0.1: Bug fixes (classification thresholds, game-over reasons)
- [x] Phase 2.0.2: Variation tree data structure
- [x] Phase 2.0.3: Variation tree UI in MoveHistory
- [x] Phase 2.0.4: Custom position setup (FEN input, drag pieces)
- [x] Phase 2.0.5: Analysis caching (Dexie.js / IndexedDB)
- [x] Phase 2.0.6: PGN export + threat detection in coaching

### V2.1 — Training Features (IN PROGRESS)
- [x] Phase 2.1.1: Puzzle backend (SQLite, 2.3M Lichess puzzles)
- [x] Phase 2.1.2: Puzzle tab frontend (solving, hints, stats, theme filters)
- [x] Phase 2.1.3: Opening repertoire + drill mode (SM-2 spaced repetition)
- [x] Phase 2.1.4: Blunder alerts + move annotations

### V2.2 — Advanced Features (PLANNED)
- [x] Phase 2.2.1: Lichess integration
- [x] Phase 2.2.2: Syzygy endgame tablebases
- [x] Phase 2.2.3: Multi-engine (Lc0)
- [x] Phase 2.2.4: Time-controlled coach games
- [x] Phase 2.2.5: UI polish (eval tooltips, analysis cancellation, keyboard shortcuts, pawn structure)

---

## Tier 1: Core Fixes & High-Impact Features

These should be addressed first — they fix bugs, fill gaps chess players will notice, and have the biggest quality impact.

### 1.1 Variation Exploration
**Impact: High | Effort: Medium**

Currently the app only supports linear move sequences. Players need to explore "what if" lines:
- Right-click a move in history to branch into an alternative variation
- Show variations as indented sub-lines in the move history
- Toggle between main line and variation
- Engine analysis applies to whichever line is active

### 1.2 Custom Position Setup
**Impact: High | Effort: Medium**

No way to analyze an arbitrary position today:
- "Setup Position" mode: drag pieces onto an empty board
- "Load from FEN" text input for pasting positions
- Useful for analyzing endgames, tactics, or theoretical positions from books

### 1.3 Game Export (Annotated PGN)
**Impact: High | Effort: Low**

Analysis results are trapped in the app:
- Export button in Review and Analysis tabs
- Generate PGN with embedded engine evaluations and move classifications as comments
- Example: `15. Nf5 {[%eval +2.3] Great!} Bxf5 {[%eval +0.8] Mistake — better was 15...Qd7}`
- Copy to clipboard or download as `.pgn` file

### 1.4 Analysis Caching
**Impact: High | Effort: Low-Medium**

Re-analyzing the same game or positions wastes time:
- Cache evaluation results in browser IndexedDB, keyed by `FEN + depth + multipv`
- Instant re-display when navigating to a previously analyzed position
- "Clear cache" button in Settings

### 1.5 Threat Detection in Coaching
**Impact: High | Effort: Medium**

The coach explains what happened but doesn't warn about what's coming:
- "Your bishop on e5 is undefended" warnings
- "Opponent threatens Qxh7 mate" alerts
- Highlight threatened squares on the board
- Integrates with both template and LLM coaching modes

### 1.6 Puzzle / Tactics Mode (New Tab)
**Impact: High | Effort: High**

The most-requested feature in any chess app:
- Curated puzzle database (Lichess has 4M+ CC0-licensed puzzles)
- "Find the best move" interactive mode
- Rating-based difficulty matching
- Track solve rate, streaks, and improvement over time
- Filter by theme: forks, pins, discovered attacks, back rank mates, etc.

---

## Tier 2: Quality of Life Improvements

These make the existing features more polished and pleasant to use.

### 2.1 Move Annotations
**Impact: Medium | Effort: Low**

- Right-click a move to add annotations: `!`, `!!`, `?`, `??`, `!?`, `?!`
- Free-text comments on any move
- Annotations persist and export with PGN

### 2.2 Blunder Audio Alerts
**Impact: Medium | Effort: Low**

- Play a distinct alert sound when the engine detects a blunder or miss
- Configurable threshold in Settings (e.g., alert on >200cp loss)
- Visual flash on the board for critical moments

### 2.3 Eval Graph Tooltips
**Impact: Medium | Effort: Low**

Currently clicking the eval graph navigates but gives no preview:
- Hover shows: move number, SAN notation, evaluation, classification
- Makes the graph much more useful for identifying critical moments

### 2.4 Game Over Reason Display
**Impact: Medium | Effort: Low**

- Show "Checkmate", "Stalemate", "Draw by repetition", etc. clearly in Analysis and Review tabs
- Currently only shows a generic "Game Over" badge

### 2.5 Time Control Display in Review
**Impact: Medium | Effort: Low**

Chess.com PGNs include move timestamps (`%clk` tags):
- Show time remaining per move in the history panel
- Highlight time-scramble moves (e.g., under 10 seconds in blitz)
- Coach could comment on time management

### 2.6 Analysis Cancellation
**Impact: Medium | Effort: Medium**

Full game analysis at depth 20+ for a 50-move game can take a while:
- "Cancel" button that stops analysis mid-game
- Show partial results for moves analyzed so far
- Resume option to continue where it left off

### 2.7 Keyboard Shortcuts Expansion
**Impact: Low | Effort: Low**

- `Escape` — deselect piece / exit current mode
- `Home` / `End` — jump to first / last move
- `Ctrl+F` — flip board
- `Ctrl+N` — new game
- Display shortcut hints in a help overlay (`?` key)

---

## Tier 3: Advanced Features

Bigger investments that significantly expand capability.

### 3.1 Opening Repertoire / Drill Mode
**Impact: High | Effort: High**

- Build a personal opening repertoire by importing PGN lines
- "Drill" mode: app plays opponent's moves, you must play your prepared response
- Tracks which lines you know and which need practice
- Spaced repetition scheduling for review

### 3.2 Endgame Tablebase Integration
**Impact: Medium | Effort: Medium**

- Integrate Syzygy tablebases (free for up to 6 pieces)
- Show "Tablebase: Win in 12 moves" instead of centipawn eval in endgames
- Perfect endgame coaching — the engine can show the exact winning path
- Download tablebases from within the app (~1GB for 6-piece)

### 3.3 Time-Controlled Coach Games
**Impact: Medium | Effort: Medium**

Real games involve time pressure, but coach mode currently has none:
- Optional clock for coach games (bullet, blitz, rapid presets or custom)
- Coach comments on time management ("You spent 45 seconds — trust your instincts here")
- Separate accuracy stats for moves made under time pressure

### 3.4 Multi-Engine Support
**Impact: Medium | Effort: Medium**

- Support Leela Chess Zero (Lc0) as an alternative engine
- Engine comparison view: show Stockfish and Lc0 evaluations side by side
- Different engines often disagree on positional moves, which is educational

### 3.5 Lichess Integration
**Impact: Medium | Effort: Low**

- Import games from Lichess in addition to Chess.com
- Lichess API is well-documented and doesn't require authentication
- Many players use both platforms

### 3.6 Pawn Structure Analysis
**Impact: Medium | Effort: High**

- Identify pawn structure type (Carlsbad, Isolated Queen's Pawn, French, etc.)
- Display pawn skeleton overlay on the board
- Coach explains strategic plans based on structure
- Useful for understanding positional chess

---

## Tier 4: Future Expansion (Post-V2)

Ideas for the longer-term roadmap.

- **Cloud Sync** — sync games, analysis, and settings across devices
- **Collaborative Analysis** — share a live analysis session with a friend via link
- **Puzzle Rating System** — ELO-style rating based on puzzle performance
- **Video Lesson Integration** — embed YouTube chess lessons linked to openings/themes
- **Mobile App** — React Native port reusing most of the frontend logic
- **Multi-Language Support** — i18n for coaching templates and UI labels
- **AI Personality Modes** — coach speaks like a GM (analytical) vs. a friend (casual) vs. a drill sergeant (blunt)
- **Game Database Search** — search master games by opening, player, year, or position
- **Blindfold Mode** — hide pieces for visualization training, reveal on demand

---

## Technical Improvements

### Performance
| Item | Impact | Effort |
|------|--------|--------|
| Cache analysis results in IndexedDB | High | Low |
| Lazy-load eval graph for 100+ move games | Medium | Low |
| Pre-analyze next 2-3 positions ahead while user views current | Medium | Medium |
| Use Web Workers for client-side chess.js computation | Low | Medium |

### Code Quality
| Item | Impact | Effort |
|------|--------|--------|
| Add unit tests for move classification thresholds | High | Low |
| Add integration tests for coach WebSocket flow | Medium | Medium |
| Externalize coaching templates to JSON file | Low | Low |
| Add centralized state management (Zustand) | Medium | Medium |
| Add structured logging to backend | Medium | Low |

### Reliability
| Item | Impact | Effort |
|------|--------|--------|
| Auto-restart Stockfish engine on crash | High | Low |
| WebSocket reconnection with message replay | Medium | Medium |
| Graceful degradation if Ollama mid-stream disconnects | Medium | Low |
| File size validation on PGN upload | Low | Low |
| Rate limit protection for Chess.com API | Low | Low |

---

## Suggested V2 Release Plan

**V2.0** — Core features
- Variation exploration
- Custom position setup
- Annotated PGN export
- Analysis caching
- Bug fixes (move classification thresholds, game-over display)

**V2.1** — Training
- Puzzle / tactics mode
- Opening drill mode
- Blunder alerts

**V2.2** — Polish & Integration
- Lichess game import
- Endgame tablebases
- Time-controlled coach games
- Eval graph tooltips
- Keyboard shortcut expansion
