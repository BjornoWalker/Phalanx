from typing import AsyncGenerator

import chess

from app.engine.stockfish import StockfishAdapter
from app.engine.analysis import (
    classify_move,
    compute_cp_loss,
    detect_sacrifice,
    estimate_position_complexity,
)
from app.models.schemas import MoveClassification
from app.engine.threats import detect_threats
from app.coach.template import TemplateCoach
from app.coach.llm import LLMCoach


class CoachService:
    def __init__(self, engine: StockfishAdapter):
        self.engine = engine
        self.template_coach = TemplateCoach()
        self.llm_coach = LLMCoach()

    def set_difficulty(self, difficulty: str) -> None:
        self.engine.set_difficulty(difficulty)

    def set_llm_model(self, model: str) -> None:
        self.llm_coach.model = model

    def get_engine_move(self, fen: str) -> dict:
        """Get the engine's move at current difficulty."""
        uci, san, fen_after = self.engine.play_move(fen, time_limit=1.0)
        return {"uci": uci, "san": san, "fen_after": fen_after}

    async def evaluate_and_coach(
        self,
        fen_before: str,
        move_uci: str,
        mode: str = "template",
        verbosity: str = "medium",
        personality: str = "",
    ) -> AsyncGenerator[dict, None]:
        """Analyze a player's move and generate coaching feedback.

        Yields dicts:
          {"type": "analysis", ...}  — evaluation data
          {"type": "coaching_token", "token": "..."}  — streaming LLM tokens
          {"type": "coaching", "text": "..."}  — complete template feedback
        """
        board_before = chess.Board(fen_before)
        move = chess.Move.from_uci(move_uci)

        # Analyze position before the move
        before_result = self.engine.analyze_position(fen_before, depth=18, multipv=3)

        # Apply the move
        is_white = board_before.turn == chess.WHITE
        is_sacrifice = detect_sacrifice(board_before, move)
        complexity = estimate_position_complexity(board_before)

        board_after = board_before.copy()
        board_after.push(move)
        fen_after = board_after.fen()

        # Handle checkmate
        if board_after.is_checkmate():
            classification = MoveClassification.BRILLIANT if is_sacrifice else MoveClassification.BEST
            cp_loss = 0
            eval_after_cp = 30000 if is_white else -30000
        else:
            after_result = self.engine.analyze_position(fen_after, depth=18, multipv=1)
            eval_after_cp = after_result.evaluation_cp
            cp_loss = compute_cp_loss(before_result.evaluation_cp, eval_after_cp, is_white)
            is_best = before_result.best_move_uci == move_uci
            classification = classify_move(cp_loss, is_sacrifice, complexity, is_best)

        san = board_before.san(move)
        best_move_san = before_result.best_move_san
        best_move = None
        try:
            best_move = chess.Move.from_uci(before_result.best_move_uci)
        except (chess.InvalidMoveError, ValueError):
            pass

        # Detect threats in the position after the player's move
        threats = detect_threats(board_after)

        # Yield analysis data first
        yield {
            "type": "analysis",
            "classification": classification.value,
            "cp_loss": cp_loss,
            "eval_before": before_result.evaluation_cp / 100.0,
            "eval_after": eval_after_cp / 100.0,
            "best_move": before_result.best_move_uci,
            "best_move_san": best_move_san,
            "top_lines": before_result.top_lines,
            "san": san,
            "threats": threats,
        }

        # Generate coaching feedback
        if mode == "llm":
            async for token in self.llm_coach.generate_feedback(
                classification=classification,
                san=san,
                best_san=best_move_san,
                cp_loss=cp_loss,
                fen_before=fen_before,
                fen_after=fen_after,
                eval_before=before_result.evaluation_cp / 100.0,
                eval_after=eval_after_cp / 100.0,
                top_lines=before_result.top_lines,
                verbosity=verbosity,
                threats=threats,
                personality=personality,
            ):
                yield {"type": "coaching_token", "token": token}
        else:
            text = self.template_coach.generate_feedback(
                classification=classification,
                san=san,
                best_san=best_move_san,
                cp_loss=cp_loss,
                eval_before=before_result.evaluation_cp / 100.0,
                board_before=board_before,
                best_move=best_move,
                threats=threats,
            )
            yield {"type": "coaching", "text": text}
