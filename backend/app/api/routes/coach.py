import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.schemas import CoachStartRequest

router = APIRouter(prefix="/api/coach", tags=["coach"])


def _get_engine():
    from app.main import get_engine
    return get_engine()


def _get_coach_service():
    from app.coach.service import CoachService
    return CoachService(_get_engine())


@router.post("/start")
async def start_coach_game(req: CoachStartRequest):
    """Start a new coaching game."""
    service = _get_coach_service()
    service.set_difficulty(req.difficulty)

    starting_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    engine_move = None

    # If player is black, engine makes the first move
    if req.player_color == "black":
        result = service.get_engine_move(starting_fen)
        engine_move = result
        starting_fen = result["fen_after"]

    return {
        "fen": starting_fen,
        "player_color": req.player_color,
        "difficulty": req.difficulty,
        "engine_move": engine_move,
    }


@router.websocket("/ws/coach")
async def coach_websocket(websocket: WebSocket):
    await websocket.accept()
    service = _get_coach_service()

    verbosity = "medium"
    personality = ""

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "setup":
                difficulty = msg.get("difficulty", "Intermediate")
                service.set_difficulty(difficulty)
                mode = msg.get("coaching_mode", "template")
                verbosity = msg.get("verbosity", "medium")
                personality = msg.get("personality", "")
                if msg.get("llm_model"):
                    service.set_llm_model(msg["llm_model"])
                await websocket.send_text(json.dumps({
                    "type": "ready",
                    "difficulty": difficulty,
                    "mode": mode,
                }))

            elif msg.get("type") == "move":
                fen = msg["fen"]
                move_uci = msg["move"]
                mode = msg.get("coaching_mode", "template")
                verbosity = msg.get("verbosity", verbosity)

                # Evaluate and coach the player's move
                async for result in service.evaluate_and_coach(fen, move_uci, mode, verbosity=verbosity, personality=personality):
                    await websocket.send_text(json.dumps(result))

                # Get engine's response move (from the position after player's move)
                import chess
                board = chess.Board(fen)
                board.push(chess.Move.from_uci(move_uci))
                post_fen = board.fen()

                if not board.is_game_over():
                    engine_result = service.get_engine_move(post_fen)
                    await websocket.send_text(json.dumps({
                        "type": "engine_move",
                        **engine_result,
                    }))
                else:
                    await websocket.send_text(json.dumps({
                        "type": "game_over",
                        "fen": post_fen,
                        "reason": _get_game_over_reason(board),
                    }))

    except WebSocketDisconnect:
        pass


def _get_game_over_reason(board) -> str:
    if board.is_checkmate():
        return "checkmate"
    if board.is_stalemate():
        return "stalemate"
    if board.is_insufficient_material():
        return "insufficient material"
    if board.is_fifty_moves():
        return "fifty-move rule"
    if board.is_repetition():
        return "repetition"
    return "game over"
