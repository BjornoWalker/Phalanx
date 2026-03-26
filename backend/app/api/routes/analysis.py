import json
import traceback

import chess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.engine.analysis import (
    analyze_game,
    classify_move,
    compute_cp_loss,
    detect_sacrifice,
    estimate_position_complexity,
)
from app.models.schemas import (
    GameAnalysis,
    PositionAnalysisRequest,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _get_engine(name: str = "stockfish"):
    from app.main import get_engine
    return get_engine(name)


def _get_engine_manager():
    from app.main import get_engine_manager
    return get_engine_manager()


def _get_tablebase():
    from app.main import get_tablebase
    return get_tablebase()


def _probe_tablebase(fen: str) -> dict | None:
    """Probe tablebase and return result if position is eligible."""
    try:
        tb = _get_tablebase()
        board = chess.Board(fen)
        return tb.probe(board)
    except Exception:
        return None


@router.get("/engines")
async def get_engines():
    mgr = _get_engine_manager()
    return mgr.get_status()


@router.post("/pawns")
async def analyze_pawns(req: dict):
    from app.engine.pawn_structure import analyze_pawn_structure
    fen = req.get("fen", "")
    board = chess.Board(fen)
    return analyze_pawn_structure(board)


@router.post("/position")
async def analyze_position(req: PositionAnalysisRequest):
    engine = _get_engine()
    result = engine.analyze_position(req.fen, depth=req.depth, multipv=req.multipv)

    response = {
        "evaluation": result.evaluation_cp / 100.0,
        "evaluation_cp": result.evaluation_cp,
        "is_mate": result.is_mate,
        "mate_in": result.mate_in,
        "best_move": result.best_move_uci,
        "best_move_san": result.best_move_san,
        "top_lines": result.top_lines,
        "depth": result.depth,
    }

    # Tablebase probe for endgame positions
    tb_result = _probe_tablebase(req.fen)
    if tb_result is not None:
        response["tablebase"] = tb_result

    return response


@router.post("/game")
async def analyze_full_game(req: dict) -> GameAnalysis:
    engine = _get_engine()
    pgn_moves = req.get("moves", [])
    depth = req.get("depth", 20)
    multipv = req.get("multipv", 3)

    if not pgn_moves and "pgn" in req:
        # Parse PGN to get moves
        import chess.pgn
        import io

        pgn_io = io.StringIO(req["pgn"])
        game = chess.pgn.read_game(pgn_io)
        if game:
            board = game.board()
            for move in game.mainline_moves():
                pgn_moves.append(board.san(move))
                board.push(move)

    return analyze_game(engine, pgn_moves, depth=depth, multipv=multipv)


@router.websocket("/ws/analysis")
async def analysis_websocket(websocket: WebSocket):
    await websocket.accept()
    engine = _get_engine()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "analyze":
                fen = msg["fen"]
                move_uci = msg.get("move")
                depth = msg.get("depth", 20)
                multipv = msg.get("multipv", 3)

                # Cap analysis depth for endgame positions (≤5 pieces)
                # Tablebase gives perfect results; deep engine search is unnecessary
                # and can block the event loop
                board_check = chess.Board(fen)
                if len(board_check.piece_map()) <= 5:
                    depth = min(depth, 10)
                    multipv = 1

                # Select engine
                engine_name = msg.get("engine", "stockfish")
                selected_engine = _get_engine(engine_name)

                try:
                    # Analyze the position after the move
                    result = selected_engine.analyze_position(fen, depth=depth, multipv=multipv)

                    response: dict = {
                        "type": "result",
                        "evaluation": result.evaluation_cp / 100.0,
                        "evaluation_cp": result.evaluation_cp,
                        "is_mate": result.is_mate,
                        "mate_in": result.mate_in,
                        "best_move": result.best_move_uci,
                        "best_move_san": result.best_move_san,
                        "top_lines": result.top_lines,
                        "depth": result.depth,
                        "engine": engine_name,
                    }

                    # Include WDL probabilities if available (Lc0 provides these natively)
                    if result.wdl is not None:
                        w, d, l = result.wdl
                        response["wdl"] = {"wins": w, "draws": d, "losses": l}

                    # If we have the move that was played and the position before,
                    # classify it
                    if move_uci and msg.get("fen_before"):
                        fen_before = msg["fen_before"]
                        board_before = chess.Board(fen_before)

                        # Cap depth for endgame "before" position too
                        before_depth = depth
                        before_multipv = multipv
                        if len(board_before.piece_map()) <= 5:
                            before_depth = min(before_depth, 10)
                            before_multipv = 1

                        # Analyze position before the move
                        before_result = selected_engine.analyze_position(
                            fen_before, depth=before_depth, multipv=before_multipv
                        )

                        # Parse the move
                        try:
                            move = chess.Move.from_uci(move_uci)
                        except chess.InvalidMoveError:
                            move = None

                        if move:
                            is_sacrifice = detect_sacrifice(board_before, move)
                            complexity = estimate_position_complexity(board_before)
                            is_white = board_before.turn == chess.WHITE

                            cp_loss = compute_cp_loss(
                                before_result.evaluation_cp,
                                result.evaluation_cp,
                                is_white,
                            )

                            is_best = before_result.best_move_uci == move_uci
                            classification = classify_move(
                                cp_loss, is_sacrifice, complexity, is_best
                            )

                            response["classification"] = classification.value
                            response["cp_loss"] = cp_loss
                            response["before_eval"] = before_result.evaluation_cp / 100.0
                            response["before_best_move"] = before_result.best_move_uci
                            response["before_best_move_san"] = before_result.best_move_san
                            response["before_top_lines"] = before_result.top_lines

                    # Tablebase probe
                    tb_result = _probe_tablebase(fen)
                    if tb_result is not None:
                        response["tablebase"] = tb_result

                    await websocket.send_text(json.dumps(response))

                except Exception as e:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": str(e),
                        "traceback": traceback.format_exc(),
                    }))

    except WebSocketDisconnect:
        pass
