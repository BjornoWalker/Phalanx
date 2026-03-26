"""Tests for puzzle solving logic."""
import pytest

from app.puzzles.puzzle_service import PuzzleSession


SAMPLE_PUZZLE = {
    "id": "test001",
    "fen": "r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24",
    "moves": "f2g3 e6e7 b2b1 b3c1 b1c1 h6c1",
    "rating": 1500,
    "themes": "crushing middlegame",
}


class TestPuzzleSession:
    """Test puzzle solving state machine."""

    def test_setup_move_applied(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        # The start_fen should be AFTER the first move (f2g3)
        assert session.start_fen != SAMPLE_PUZZLE["fen"]
        assert session.setup_move_san != ""

    def test_initial_state(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        assert session.current_step == 0
        assert not session.is_complete
        assert session.is_player_turn

    def test_correct_move(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        # The second move in the sequence is the player's first move
        expected_uci = session.solution_moves[0]
        result = session.check_move(expected_uci)
        assert result["correct"] is True

    def test_wrong_move(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        result = session.check_move("a7a6")  # random wrong move
        assert result["correct"] is False
        assert "expected_uci" in result
        assert "expected_san" in result

    def test_hint_level_1(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        hint = session.get_hint(1)
        assert "hint" in hint
        assert "from_square" in hint

    def test_hint_level_2(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        hint = session.get_hint(2)
        assert "to_square" in hint

    def test_hint_level_3(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        hint = session.get_hint(3)
        assert "san" in hint
        assert "uci" in hint

    def test_complete_puzzle(self):
        session = PuzzleSession(SAMPLE_PUZZLE)
        # Play only player moves — check_move auto-plays opponent responses
        while not session.is_complete:
            if session.is_player_turn:
                expected = session.solution_moves[session.current_step]
                result = session.check_move(expected)
                assert result["correct"] is True
                if result.get("complete"):
                    break
            else:
                # This shouldn't happen if check_move auto-plays opponent
                break
        assert session.is_complete or result.get("complete")


class TestPuzzleSessionEdgeCases:
    """Test edge cases in puzzle solving."""

    def test_single_move_puzzle(self):
        puzzle = {
            "id": "single",
            "fen": "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq - 0 2",
            "moves": "d8h4 e1e2",  # setup: Qh4+, solution: Ke2
            "rating": 800,
            "themes": "mateIn1",
        }
        session = PuzzleSession(puzzle)
        assert len(session.solution_moves) == 1
