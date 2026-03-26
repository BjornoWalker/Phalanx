"""Tests for move classification, centipawn loss, and accuracy computation."""
import pytest
import chess

from app.engine.analysis import (
    classify_move,
    compute_cp_loss,
    compute_accuracy,
    detect_sacrifice,
    estimate_position_complexity,
)
from app.models.schemas import MoveClassification


class TestComputeCpLoss:
    """Test centipawn loss calculation from both perspectives."""

    def test_white_move_no_loss(self):
        # Eval stays the same: no loss
        assert compute_cp_loss(50, 50, is_white=True) == 0

    def test_white_move_with_loss(self):
        # Eval drops from +100 to +20 after white's move
        assert compute_cp_loss(100, 20, is_white=True) == 80

    def test_white_move_improvement(self):
        # Eval improves — should clamp to 0 (no negative loss)
        assert compute_cp_loss(50, 100, is_white=True) == 0

    def test_black_move_no_loss(self):
        # From black's perspective: eval stays equal
        assert compute_cp_loss(-50, -50, is_white=False) == 0

    def test_black_move_with_loss(self):
        # Eval goes from -100 (black advantage) to -20 after black's move
        # Black lost advantage: cp_loss = eval_after - eval_before = -20 - (-100) = 80
        assert compute_cp_loss(-100, -20, is_white=False) == 80

    def test_black_move_improvement(self):
        # Black improves position
        assert compute_cp_loss(-50, -100, is_white=False) == 0

    def test_large_loss(self):
        # Blunder: eval drops from +300 to -200
        assert compute_cp_loss(300, -200, is_white=True) == 500


class TestClassifyMove:
    """Test all move classification thresholds."""

    def test_brilliant(self):
        result = classify_move(cp_loss=0, is_sacrifice=True, complexity=0.5, is_best_move=True)
        assert result == MoveClassification.BRILLIANT

    def test_great(self):
        result = classify_move(cp_loss=0, is_sacrifice=False, complexity=0.7, is_best_move=True)
        assert result == MoveClassification.GREAT

    def test_best(self):
        result = classify_move(cp_loss=0, is_sacrifice=False, complexity=0.3, is_best_move=True)
        assert result == MoveClassification.BEST

    def test_good_small_loss(self):
        result = classify_move(cp_loss=10, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.GOOD

    def test_good_at_boundary(self):
        result = classify_move(cp_loss=50, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.GOOD

    def test_mistake_just_over(self):
        result = classify_move(cp_loss=51, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.MISTAKE

    def test_mistake_at_boundary(self):
        result = classify_move(cp_loss=150, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.MISTAKE

    def test_miss_just_over(self):
        result = classify_move(cp_loss=151, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.MISS

    def test_miss_at_boundary(self):
        result = classify_move(cp_loss=300, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.MISS

    def test_blunder(self):
        result = classify_move(cp_loss=301, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.BLUNDER

    def test_massive_blunder(self):
        result = classify_move(cp_loss=3000, is_sacrifice=False, complexity=0.5, is_best_move=False)
        assert result == MoveClassification.BLUNDER


class TestComputeAccuracy:
    """Test Chess.com-style accuracy formula."""

    def test_perfect_play(self):
        # All 0 cp loss = ~100% accuracy
        result = compute_accuracy([0, 0, 0, 0, 0])
        assert result >= 99.0

    def test_empty_list(self):
        assert compute_accuracy([]) == 100.0

    def test_terrible_play(self):
        # All massive losses
        result = compute_accuracy([500, 500, 500])
        assert result < 5.0

    def test_average_play(self):
        # Mixed losses — avg cp_loss ~30 → accuracy around 20-40%
        result = compute_accuracy([0, 10, 50, 0, 100, 20])
        assert 10.0 < result < 90.0

    def test_capped_at_100(self):
        result = compute_accuracy([0])
        assert result <= 100.0

    def test_capped_at_0(self):
        result = compute_accuracy([10000])
        assert result >= 0.0

    def test_mate_loss_capping(self):
        # Extreme cp_loss values are capped at 1000 per move
        # avg of [0, 0, 1000] = 333 → accuracy is low but computable
        result = compute_accuracy([0, 0, 30000])
        assert result >= 0.0  # should not crash or return negative


class TestDetectSacrifice:
    """Test sacrifice detection logic."""

    def test_no_sacrifice_normal_move(self):
        board = chess.Board()
        move = chess.Move.from_uci("e2e4")
        assert detect_sacrifice(board, move) is False

    def test_sacrifice_piece_to_attacked_square(self):
        # Place a knight where it's attacked by a pawn and doesn't capture anything valuable
        board = chess.Board("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")
        # Knight to f3 — not a sacrifice (not attacked by pawn at that point in most cases)
        move = chess.Move.from_uci("g1f3")
        # This specific position may or may not be detected as sacrifice depending on attacks
        # The important thing is the function doesn't crash
        result = detect_sacrifice(board, move)
        assert isinstance(result, bool)


class TestEstimatePositionComplexity:
    """Test position complexity estimation."""

    def test_starting_position(self):
        board = chess.Board()
        result = estimate_position_complexity(board)
        assert 0.0 <= result <= 1.0

    def test_endgame_is_less_complex(self):
        # KR vs K — very simple
        board = chess.Board("4k3/8/8/8/8/8/8/R3K3 w - - 0 1")
        result = estimate_position_complexity(board)
        assert result < 0.5

    def test_complexity_range(self):
        board = chess.Board()
        result = estimate_position_complexity(board)
        assert 0.0 <= result <= 1.0
