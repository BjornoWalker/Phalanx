from fastapi import APIRouter, File, UploadFile, HTTPException

from app.models.schemas import GameAnalysis
from app.review.chesscom import ChessComClient
from app.review.lichess import LichessClient
from app.review.pgn import parse_pgn_string

router = APIRouter(prefix="/api/games", tags=["games"])


def _get_engine():
    from app.main import get_engine
    return get_engine()


@router.get("/chesscom/{username}")
async def fetch_chesscom_games(username: str, count: int = 50):
    client = ChessComClient()
    try:
        games = await client.fetch_recent_games(username, count=count)
        return {"games": games, "count": len(games)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chess.com API error: {e}")
    finally:
        await client.close()


@router.get("/lichess/{username}")
async def fetch_lichess_games(username: str, count: int = 50):
    client = LichessClient()
    try:
        games = await client.fetch_recent_games(username, count=count)
        return {"games": games, "count": len(games)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lichess API error: {e}")
    finally:
        await client.close()


@router.post("/upload")
async def upload_pgn(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    games = parse_pgn_string(text)
    if not games:
        raise HTTPException(status_code=400, detail="No valid games found in PGN file")

    return {
        "games": [g.model_dump() for g in games],
        "count": len(games),
    }


@router.post("/analyze")
async def analyze_game(req: dict) -> GameAnalysis:
    from app.engine.analysis import analyze_game as run_analysis

    engine = _get_engine()
    pgn_moves: list[str] = req.get("moves", [])
    depth = req.get("depth", 18)
    multipv = req.get("multipv", 1)

    if not pgn_moves and "pgn" in req:
        games = parse_pgn_string(req["pgn"])
        if games:
            pgn_moves = games[0].moves

    if not pgn_moves:
        raise HTTPException(status_code=400, detail="No moves provided")

    return run_analysis(engine, pgn_moves, depth=depth, multipv=multipv)
