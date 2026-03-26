from fastapi import APIRouter, HTTPException

from app.puzzles.puzzle_db import PuzzleDB
from app.puzzles.puzzle_service import PuzzleSession

router = APIRouter(prefix="/api/puzzles", tags=["puzzles"])

# In-memory puzzle sessions (keyed by puzzle_id)
_sessions: dict[str, PuzzleSession] = {}


def _get_db() -> PuzzleDB:
    db = PuzzleDB()
    if not db.is_available():
        raise HTTPException(
            status_code=503,
            detail="Puzzle database not found. Download it from Settings.",
        )
    return db


@router.get("/random")
async def get_random_puzzle(
    rating_min: int = 800,
    rating_max: int = 1800,
    theme: str | None = None,
    count: int = 1,
):
    db = _get_db()
    themes = [theme] if theme else None
    puzzles = db.get_random(rating_min, rating_max, themes, count)
    if not puzzles:
        raise HTTPException(status_code=404, detail="No puzzles match the criteria")

    # Start a session for the first puzzle
    puzzle = puzzles[0]
    session = PuzzleSession(puzzle)
    _sessions[puzzle["id"]] = session

    return {
        "puzzle_id": puzzle["id"],
        "fen": session.start_fen,
        "setup_move": session.setup_move_san,
        "rating": puzzle["rating"],
        "themes": puzzle.get("themes", ""),
        "total_moves": len(session.solution_moves),
        "player_moves": (len(session.solution_moves) + 1) // 2,
    }


@router.get("/{puzzle_id}")
async def get_puzzle(puzzle_id: str):
    db = _get_db()
    puzzle = db.get_by_id(puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    session = PuzzleSession(puzzle)
    _sessions[puzzle_id] = session

    return {
        "puzzle_id": puzzle["id"],
        "fen": session.start_fen,
        "setup_move": session.setup_move_san,
        "rating": puzzle["rating"],
        "themes": puzzle.get("themes", ""),
        "total_moves": len(session.solution_moves),
        "player_moves": (len(session.solution_moves) + 1) // 2,
    }


@router.post("/check")
async def check_puzzle_move(req: dict):
    puzzle_id = req.get("puzzle_id", "")
    move_uci = req.get("move", "")

    session = _sessions.get(puzzle_id)
    if not session:
        raise HTTPException(status_code=404, detail="No active session for this puzzle")

    result = session.check_move(move_uci)
    return result


@router.post("/hint")
async def get_hint(req: dict):
    puzzle_id = req.get("puzzle_id", "")
    level = req.get("level", 1)

    session = _sessions.get(puzzle_id)
    if not session:
        raise HTTPException(status_code=404, detail="No active session for this puzzle")

    return session.get_hint(level)


@router.get("/meta/themes")
async def get_themes():
    db = _get_db()
    return {"themes": db.get_themes()}


@router.get("/meta/stats")
async def get_stats():
    db = _get_db()
    return db.get_stats()
