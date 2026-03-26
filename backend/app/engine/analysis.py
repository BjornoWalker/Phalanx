import math

import chess

from app.models.schemas import (
    AnalyzedMove,
    GameAnalysis,
    MoveClassification,
)
from app.engine.stockfish import StockfishAdapter


def compute_cp_loss(eval_before: int, eval_after: int, is_white: bool) -> int:
    """Compute centipawn loss from the moving player's perspective.

    Both eval_before and eval_after are from white's perspective.
    Returns a non-negative integer.
    """
    if is_white:
        loss = eval_before - eval_after
    else:
        loss = eval_after - eval_before
    return max(0, loss)


def detect_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """Detect if a move involves a material sacrifice.

    A sacrifice is when:
    - The moved piece goes to a square attacked by the opponent
    - And the moved piece is not capturing a piece of equal or greater value
    """
    piece = board.piece_at(move.from_square)
    if piece is None:
        return False

    captured = board.piece_at(move.to_square)

    PIECE_VALUES = {
        chess.PAWN: 100,
        chess.KNIGHT: 300,
        chess.BISHOP: 300,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 0,
    }

    moving_value = PIECE_VALUES.get(piece.piece_type, 0)
    captured_value = PIECE_VALUES.get(captured.piece_type, 0) if captured else 0

    # Check if the destination is attacked by the opponent
    opponent_color = not piece.color
    is_attacked = board.is_attacked_by(opponent_color, move.to_square)

    # It's a sacrifice if we move to an attacked square and we're not
    # capturing something of equal or greater value
    if is_attacked and captured_value < moving_value:
        return True

    return False


def estimate_position_complexity(board: chess.Board) -> float:
    """Estimate position complexity on a 0-1 scale.

    Considers: number of pieces, legal moves, pieces under attack, etc.
    """
    num_pieces = len(board.piece_map())
    num_legal_moves = board.legal_moves.count()

    # More pieces and more legal moves = more complex
    piece_factor = min(num_pieces / 32.0, 1.0)
    move_factor = min(num_legal_moves / 40.0, 1.0)

    # Check for tactical elements
    is_check = board.is_check()
    check_factor = 0.2 if is_check else 0.0

    return min((piece_factor * 0.4 + move_factor * 0.4 + check_factor) * 1.0, 1.0)


def classify_move(
    cp_loss: int,
    is_sacrifice: bool,
    complexity: float,
    is_best_move: bool,
) -> MoveClassification:
    """Classify a move based on centipawn loss and context."""
    if cp_loss == 0 and is_best_move:
        if is_sacrifice:
            return MoveClassification.BRILLIANT
        if complexity > 0.6:
            return MoveClassification.GREAT
        return MoveClassification.BEST

    if cp_loss <= 50:
        return MoveClassification.GOOD

    if cp_loss <= 150:
        return MoveClassification.MISTAKE

    if cp_loss <= 300:
        return MoveClassification.MISS

    return MoveClassification.BLUNDER


def compute_accuracy(cp_losses: list[int]) -> float:
    """Compute Chess.com-style accuracy from a list of centipawn losses.

    Formula: accuracy = 103.1668 * exp(-0.04354 * avg_cp_loss) - 3.1668
    Clamped to [0, 100].
    """
    if not cp_losses:
        return 100.0

    # Cap individual losses at 1000cp to prevent mate-related values from
    # dominating the average
    capped = [min(loss, 1000) for loss in cp_losses]
    avg_cp_loss = sum(capped) / len(capped)
    accuracy = 103.1668 * math.exp(-0.04354 * avg_cp_loss) - 3.1668
    return max(0.0, min(100.0, round(accuracy, 1)))


def analyze_game(
    engine: StockfishAdapter,
    pgn_moves: list[str],
    depth: int = 20,
    multipv: int = 3,
) -> GameAnalysis:
    """Analyze a complete game and return full analysis with classifications."""
    board = chess.Board()
    analyzed_moves: list[AnalyzedMove] = []
    eval_graph: list[float] = []
    white_cp_losses: list[int] = []
    black_cp_losses: list[int] = []
    white_breakdown: dict[str, int] = {c.value: 0 for c in MoveClassification}
    black_breakdown: dict[str, int] = {c.value: 0 for c in MoveClassification}

    # Get initial evaluation
    prev_result = engine.analyze_position(board.fen(), depth=depth, multipv=1)
    prev_eval = prev_result.evaluation_cp

    for ply, san in enumerate(pgn_moves):
        fen_before = board.fen()
        is_white = board.turn == chess.WHITE

        # Parse and apply the move
        try:
            move = board.parse_san(san)
        except (chess.InvalidMoveError, chess.IllegalMoveError):
            break

        uci = move.uci()
        is_sacrifice = detect_sacrifice(board, move)
        complexity = estimate_position_complexity(board)

        # Analyze position BEFORE the move to get best move
        before_result = engine.analyze_position(fen_before, depth=depth, multipv=multipv)

        # Apply the move
        board.push(move)
        fen_after = board.fen()

        # Handle checkmate/stalemate: if the move ends the game, skip post-analysis
        if board.is_checkmate():
            # Delivering checkmate is always the best possible move
            post_eval = 30000 if is_white else -30000
            cp_loss = 0
            is_best = True
            classification = MoveClassification.BRILLIANT if is_sacrifice else MoveClassification.BEST
        elif board.is_stalemate() or board.is_game_over():
            post_eval = 0
            cp_loss = compute_cp_loss(prev_eval, post_eval, is_white)
            is_best = before_result.best_move_uci == uci
            classification = classify_move(cp_loss, is_sacrifice, complexity, is_best)
        else:
            # Analyze position AFTER the move
            after_result = engine.analyze_position(fen_after, depth=depth, multipv=1)
            post_eval = after_result.evaluation_cp

            # Compute centipawn loss
            cp_loss = compute_cp_loss(prev_eval, post_eval, is_white)

            # Was this the engine's best move?
            is_best = before_result.best_move_uci == uci

            # Classify
            classification = classify_move(cp_loss, is_sacrifice, complexity, is_best)

        # Track stats
        eval_graph.append(post_eval / 100.0)  # convert to pawns for graph
        if is_white:
            white_cp_losses.append(cp_loss)
            white_breakdown[classification.value] += 1
        else:
            black_cp_losses.append(cp_loss)
            black_breakdown[classification.value] += 1

        analyzed_moves.append(
            AnalyzedMove(
                ply=ply,
                san=san,
                uci=uci,
                fen_before=fen_before,
                fen_after=fen_after,
                eval_before=prev_eval / 100.0,
                eval_after=post_eval / 100.0,
                cp_loss=cp_loss,
                classification=classification,
                best_move_uci=before_result.best_move_uci,
                best_move_san=before_result.best_move_san,
                top_lines=before_result.top_lines,
            )
        )

        prev_eval = post_eval

    return GameAnalysis(
        moves=analyzed_moves,
        white_accuracy=compute_accuracy(white_cp_losses),
        black_accuracy=compute_accuracy(black_cp_losses),
        white_breakdown=white_breakdown,
        black_breakdown=black_breakdown,
        eval_graph=eval_graph,
    )
