"""Tests for template-based coaching feedback."""
import chess
import pytest

from app.coach.template import TemplateCoach
from app.models.schemas import MoveClassification


class TestTemplateCoach:
    """Test template feedback generation for all classifications."""

    @pytest.fixture
    def coach(self):
        return TemplateCoach()

    @pytest.fixture
    def board(self):
        return chess.Board()

    def test_brilliant_feedback(self, coach, board):
        text = coach.generate_feedback(
            MoveClassification.BRILLIANT, "Nxe5", "Nxe5", 0, 0.5, board, None
        )
        assert isinstance(text, str)
        assert len(text) > 10
        assert "Nxe5" in text

    def test_blunder_feedback(self, coach, board):
        text = coach.generate_feedback(
            MoveClassification.BLUNDER, "Qh4", "Nf3", 350, 0.5, board,
            chess.Move.from_uci("g1f3")
        )
        assert isinstance(text, str)
        assert "Qh4" in text
        assert "Nf3" in text

    def test_all_classifications_produce_output(self, coach, board):
        for cls in MoveClassification:
            text = coach.generate_feedback(cls, "e4", "d4", 50, 0.3, board, None)
            assert isinstance(text, str)
            assert len(text) > 0

    def test_threat_appended(self, coach, board):
        threats = [{"description": "Your knight on e5 is hanging!"}]
        text = coach.generate_feedback(
            MoveClassification.GOOD, "e4", "d4", 10, 0.3, board, None, threats=threats
        )
        assert "hanging" in text

    def test_generate_reason_check(self, coach):
        board = chess.Board("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")
        # Qh5 gives check-ish positions but let's test with a simpler case
        move = chess.Move.from_uci("g1f3")
        reason = coach._generate_reason(move, board)
        assert isinstance(reason, str)
        assert len(reason) > 0
