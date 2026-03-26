import random

import chess

from app.models.schemas import MoveClassification


class TemplateCoach:
    """Generate coaching feedback using templates based on move classification."""

    TEMPLATES: dict[MoveClassification, list[str]] = {
        MoveClassification.BRILLIANT: [
            "Incredible move! {san} is a deep and creative choice. You sacrificed material but the engine agrees it's winning. That's real chess understanding!",
            "Wow, {san} is a brilliant move! Most players wouldn't find this. You saw something special in this position.",
            "Outstanding! {san} shows great tactical vision. A sacrifice that leads to a winning advantage — that's the kind of move that wins games.",
        ],
        MoveClassification.GREAT: [
            "Excellent choice! {san} is the top engine move in a complex position. Finding this over the board shows strong play.",
            "Great move! {san} is exactly what the position demands. You navigated the complications well.",
            "Very well played. {san} is the best move here and it wasn't easy to find with so many options on the board.",
        ],
        MoveClassification.BEST: [
            "That's the best move. {san} keeps the position well in hand.",
            "Perfect. {san} is exactly what the engine recommends.",
            "Solid choice. {san} is the top move here — well played.",
        ],
        MoveClassification.GOOD: [
            "{san} is a reasonable move. The engine slightly prefers {best_san} but the difference is small.",
            "Fine move. {san} keeps things on track. {best_san} was marginally better but this is perfectly playable.",
        ],
        MoveClassification.MISTAKE: [
            "{san} is a mistake, costing about {loss:.1f} pawns of advantage. {best_san} was better here. {reason}",
            "Not the best choice. {san} loses some ground — the engine wanted {best_san} instead. {reason}",
            "{san} is inaccurate. You've given up about {loss:.1f} pawns. {best_san} would have been stronger. {reason}",
        ],
        MoveClassification.MISS: [
            "{san} misses an important opportunity! {best_san} was much stronger here. {reason}",
            "You missed a key idea with {san}. The engine saw {best_san} which would have {reason}",
            "{san} overlooks a strong continuation. {best_san} was the move to find — {reason}",
        ],
        MoveClassification.BLUNDER: [
            "{san} is a serious blunder, losing about {loss:.1f} pawns! {best_san} was the right move. {reason}",
            "Oh no! {san} is a blunder. This changes the evaluation dramatically. {best_san} was needed here. {reason}",
            "{san} is a critical mistake. The position goes from {eval_desc} to much worse. {best_san} would have kept things in check. {reason}",
        ],
    }

    def generate_feedback(
        self,
        classification: MoveClassification,
        san: str,
        best_san: str,
        cp_loss: int,
        eval_before: float,
        board_before: chess.Board,
        best_move: chess.Move | None,
        threats: list[dict] | None = None,
    ) -> str:
        templates = self.TEMPLATES.get(classification, self.TEMPLATES[MoveClassification.GOOD])
        template = random.choice(templates)

        reason = self._generate_reason(best_move, board_before) if best_move else ""
        loss = cp_loss / 100.0

        # Describe evaluation
        if eval_before > 1.0:
            eval_desc = "a clear advantage"
        elif eval_before > 0.3:
            eval_desc = "a slight edge"
        elif eval_before > -0.3:
            eval_desc = "an equal position"
        elif eval_before > -1.0:
            eval_desc = "a slightly worse position"
        else:
            eval_desc = "a difficult position"

        feedback = template.format(
            san=san,
            best_san=best_san,
            loss=loss,
            reason=reason,
            eval_desc=eval_desc,
        )

        # Append threat warnings
        if threats:
            threat_msgs = [t["description"] for t in threats[:2]]  # max 2 warnings
            feedback += " " + " ".join(threat_msgs)

        return feedback

    def _generate_reason(self, best_move: chess.Move, board: chess.Board) -> str:
        """Generate a brief tactical reason for why the best move is better."""
        # Check if best move gives check
        board_copy = board.copy()
        board_copy.push(best_move)
        if board_copy.is_check():
            return "It puts the king in check, creating immediate pressure."

        if board_copy.is_checkmate():
            return "It's actually checkmate!"

        # Check if best move captures material
        captured = board.piece_at(best_move.to_square)
        if captured:
            piece_names = {
                chess.PAWN: "a pawn",
                chess.KNIGHT: "the knight",
                chess.BISHOP: "the bishop",
                chess.ROOK: "the rook",
                chess.QUEEN: "the queen",
            }
            name = piece_names.get(captured.piece_type, "a piece")
            return f"It wins {name}, gaining material."

        # Check if the moving piece is attacking key squares after
        piece = board.piece_at(best_move.from_square)
        if piece and piece.piece_type in (chess.KNIGHT, chess.BISHOP):
            return "It develops a piece to a more active square, improving your position."

        if piece and piece.piece_type == chess.PAWN:
            # Check for pawn push to center
            file = chess.square_file(best_move.to_square)
            rank = chess.square_rank(best_move.to_square)
            if file in (3, 4) and rank in (3, 4):
                return "It controls the center, which is key in this type of position."

        return "It improves your position and keeps the initiative."
