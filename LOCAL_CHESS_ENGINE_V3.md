# Local Chess Engine — V3 Recommendations

Ideas for further improvement based on a comprehensive review of the V2.2 codebase.

---

## Tier 1: Quick Wins (High Impact, Low Effort)

### 1.1 Pawn Promotion UI
Currently hardcoded to auto-promote to queen. Add a piece selection dialog when a pawn reaches the 8th rank — let the user choose Queen, Rook, Bishop, or Knight. Critical for endgame positions where under-promotion matters.

### 1.2 Tab State Persistence
Switching tabs destroys component state — users lose their analysis position, selected game, or drill progress. Fix by keeping all tabs mounted (hidden) or using a context-based state cache per tab.

### 1.3 Undo/Redo in Analysis
Add `Ctrl+Z` / `Cmd+Z` to undo the last move in Analysis. Currently users must manually navigate back. Redo with `Ctrl+Shift+Z`. Store an undo stack alongside the game tree.

### 1.4 WebSocket Reliability
Add visible reconnection indicator ("Reconnecting...") when the WebSocket drops. Auto-reconnect with exponential backoff (the WebSocketManager has this but the UI doesn't surface the state). Show a toast notification on disconnect/reconnect.

### 1.5 Puzzle Progress System
Extend the basic solved/failed/streak stats to include:
- Weekly and monthly progress charts
- Puzzle "mastery levels" (Bronze/Silver/Gold based on repeated solves)
- SM-2 spaced repetition for puzzles (not just drills) — puzzles you fail come back sooner
- Rating estimate based on solve performance

### 1.6 High Contrast Board Theme
Add an accessibility-focused board theme with maximum contrast between light/dark squares and clearer piece outlines. Useful for low-vision users.

---

## Tier 2: UX Improvements (Medium Effort)

### 2.1 Coach Personalities
Different coach avatars currently look different but speak identically. Give each a distinct voice:
- **Robot** — precise, numbers-focused ("This loses 1.3 pawns of advantage")
- **Teacher** — patient, explanatory ("Let me show you why this square is important")
- **Wizard** — mysterious, asks questions ("What do you think Black is threatening?")
- **Brain** — analytical, compares options ("There are 3 candidate moves here...")
- **Owl** — wise, gives principles ("In positions with opposite-colored bishops...")

Implement by varying the LLM system prompt per avatar. Template mode can use different template banks.

### 2.2 Adaptive Puzzle Difficulty
Instead of manual rating range sliders, auto-adjust difficulty based on solve rate:
- Solving >85% → increase range by 100
- Solving <50% → decrease range by 100
- Target: ~65% solve rate for optimal learning
- Show the "effective puzzle rating" to the user

### 2.3 Game Review Summary Improvements
Add to the review summary screen:
- **Game difficulty rating** — how hard was this game based on the positions that arose?
- **Critical moments** — highlight the 2-3 moves where the game's outcome was decided
- **Player improvement suggestions** — "You should study endgames" or "Your opening play was strong"

### 2.4 Opening Repertoire Statistics
Track and display:
- Win rate by opening line (from reviewed games)
- Most commonly reached positions
- Lines that need the most review (lowest drill accuracy)
- Opponent deviation frequency (how often opponents play into your prep vs. sidelines)

### 2.5 Candidate Move Explorer
Instead of showing only the top 3 engine lines, display ALL legal moves as sortable buttons ranked by evaluation. Click any move to instantly explore that line. Helps users understand not just "what's best" but "how bad are the alternatives."

### 2.6 Board Annotation Layer
Draw shapes on the board beyond arrows:
- Circles on squares (highlight key squares)
- Colored square highlighting (attack/defense zones)
- Text labels on squares
- Save annotations with the game for PGN export

---

## Tier 3: Major Features (High Effort)

### 3.1 Blind Spot Detection
Analyze the user's reviewed games to identify recurring weaknesses:
- "You miss back-rank threats 40% more often than average"
- "You lose material advantage in rook endgames"
- "You spend too much time on obvious moves in time pressure"
- Generate targeted puzzle sets based on weaknesses

### 3.2 Strategic Lesson Generator
Use the LLM to generate personalized lessons from your games:
- "Your 3 biggest weaknesses this month"
- Mini-lessons with example positions from YOUR games
- Suggested practice routine (specific puzzles + drills)
- Track lesson completion for long-term improvement

### 3.3 Engine Disagreement Explorer
When Stockfish and Lc0 disagree on a position:
- Highlight the position with a special marker in the eval graph
- Show both engines' reasoning (top lines side by side)
- Explain WHY they disagree (tactical vs positional evaluation)
- These positions are the most educational — build a training mode around them

### 3.4 Endgame Training Mode
Use the Syzygy tablebases to create targeted endgame exercises:
- "Win this KR vs K position" with perfect play required
- "Hold this KP vs K draw" where you must find the only drawing moves
- Progress from simple (KQ vs K) to complex (KRP vs KR)
- Track mastery per endgame type

### 3.5 Game Preparation Tool
For players preparing against specific opponents:
- Import their recent games from Chess.com/Lichess
- Identify their favorite openings and common patterns
- Generate a preparation report: "They play the Sicilian 60% of the time, tend to castle kingside, and struggle with isolated queen's pawn positions"
- Suggest specific opening lines to use against them

### 3.6 Heat Map Visualization
Show a board overlay indicating:
- **Square control** — color intensity by how many pieces attack/defend each square
- **King safety** — visualize the king's exposure level
- **Piece activity** — how mobile is each piece from its current position
- Toggle between different heat map types

### 3.7 Voice Commentary
Use the system's text-to-speech (macOS `say` command or Web Speech API) to read coaching feedback aloud. Useful for:
- Users with reading difficulties
- Playing and learning hands-free
- A more immersive experience

---

## Tier 4: Long-Term Vision

### 4.1 Local Multiplayer
Play against a friend on the same machine or local network:
- Export/import game state as a file or QR code
- Real-time game via local WebSocket between two browser tabs
- Post-game analysis for both players

### 4.2 Custom Puzzle Creator
Let users create puzzles from their own games:
- Mark a position as "interesting" during review
- Set the correct solution sequence
- Add to personal puzzle library with spaced repetition
- Export as shareable puzzle packs

### 4.3 Tournament Mode
Simulate a tournament experience:
- Play a series of rated games against the engine at different difficulty levels
- Swiss-system pairing logic
- Elo tracking across tournaments
- Leaderboard (personal bests)

### 4.4 AI Study Partner
Beyond move-by-move coaching, an AI that:
- Asks you questions about the position before showing the answer ("What is White's plan here?")
- Provides Socratic-method teaching ("Why do you think the knight is better on f5 than d4?")
- Remembers your past mistakes and references them ("Last time you had a similar position, you played Nf3 — remember what happened?")
- Uses RAG over your game history for personalized advice

### 4.5 Video Lesson Integration
Link opening positions to curated YouTube timestamps:
- "This is the Ruy Lopez. Watch this 5-minute explanation by GothamChess [timestamp link]"
- Community-curated lesson database
- Track which lessons you've watched

### 4.6 Mobile PWA
Convert the web app to a Progressive Web App:
- Installable on iOS/Android via Safari/Chrome
- Offline support for puzzles and analysis (already mostly local)
- Touch-optimized board interaction
- Push notifications for drill reminders

---

## Technical Improvements

### Testing
| Area | Priority | Suggestion |
|------|----------|------------|
| Game tree mutations | Critical | Unit tests for makeMove, deleteVariation, promoteVariation, loadPgn |
| Move classification | High | Test all threshold boundaries with known positions |
| Coach WebSocket flow | High | Integration test: setup → move → analysis → coaching → engine move |
| Puzzle solving | Medium | Test correct/incorrect/hint flows |
| Cache hit/miss | Medium | Test IndexedDB caching with mocked Dexie |

### Performance
| Optimization | Impact |
|-------------|--------|
| Memoize `flattenTreeForDisplay` with useMemo keyed on tree version | Reduces re-renders in deep trees |
| Virtualize MoveHistory for games with 50+ moves | Smooth scrolling in long games |
| Debounce FEN input in PositionSetup (300ms) | Prevents multiple WebSocket requests |
| Web Worker for chess.js move validation | Frees main thread during complex positions |
| Lazy-load Lc0 secondary panel only when "Both" mode is active | Saves a WebSocket connection |

### Code Quality
| Improvement | Benefit |
|-------------|---------|
| Split useChessGame into useGameTree + useGameNavigation | Each under 200 lines, easier to test |
| Add React error boundaries around each tab | Single component crash doesn't take down the app |
| Zod schema validation for settings | Type-safe settings with migration support |
| Extract WebSocket management into shared useWebSocket hook | DRY, consistent reconnection across coach/engine |
| Add structured logging to backend | Easier debugging in production |

---

## Suggested V3 Release Plan

**V3.0** — UX Polish
- Pawn promotion UI
- Tab state persistence
- Undo/redo
- WebSocket reliability
- High contrast theme

**V3.1** — Training Intelligence
- Adaptive puzzle difficulty
- Puzzle progress with mastery levels
- Blind spot detection
- Endgame training mode

**V3.2** — Deep Analysis
- Coach personalities
- Engine disagreement explorer
- Candidate move explorer
- Heat map visualization
- Game preparation tool

**V3.3** — Platform
- Voice commentary
- Mobile PWA
- Custom puzzle creator
- Local multiplayer
