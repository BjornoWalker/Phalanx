"""Tests for pawn structure analysis."""
import chess
import pytest

from app.engine.pawn_structure import analyze_pawn_structure


class TestPawnStructure:
    """Test pawn structure analysis for various positions."""

    def test_starting_position(self):
        board = chess.Board()
        result = analyze_pawn_structure(board)
        assert len(result["white_pawns"]) == 8
        assert len(result["black_pawns"]) == 8
        assert result["isolated"] == []
        assert result["doubled"] == []
        assert result["passed"] == []
        assert result["pawn_islands"]["white"] == 1
        assert result["pawn_islands"]["black"] == 1

    def test_passed_pawn(self):
        # White pawn on d5, no black pawns on c/d/e files ahead
        board = chess.Board("4k3/8/8/3P4/8/8/8/4K3 w - - 0 1")
        result = analyze_pawn_structure(board)
        assert len(result["passed"]) == 1
        assert result["passed"][0]["square"] == "d5"
        assert result["passed"][0]["color"] == "white"

    def test_isolated_pawn(self):
        # White pawn on c5 with pawns on a2 and f2 — c5 is isolated
        board = chess.Board("4k3/8/8/2P5/8/8/P4P2/4K3 w - - 0 1")
        result = analyze_pawn_structure(board)
        isolated_squares = [p["square"] for p in result["isolated"]]
        assert "c5" in isolated_squares

    def test_doubled_pawns(self):
        # Two white pawns on the e-file
        board = chess.Board("4k3/8/8/4P3/4P3/8/8/4K3 w - - 0 1")
        result = analyze_pawn_structure(board)
        assert len(result["doubled"]) == 1
        assert result["doubled"][0]["file"] == "e"
        assert result["doubled"][0]["color"] == "white"

    def test_pawn_islands(self):
        # White pawns on a2, b2 (island 1), e4 (island 2), h2 (island 3)
        board = chess.Board("4k3/8/8/8/4P3/8/PP5P/4K3 w - - 0 1")
        result = analyze_pawn_structure(board)
        assert result["pawn_islands"]["white"] == 3

    def test_no_pawns(self):
        # Endgame with no pawns
        board = chess.Board("4k3/8/8/8/8/8/8/4K3 w - - 0 1")
        result = analyze_pawn_structure(board)
        assert result["white_pawns"] == []
        assert result["black_pawns"] == []
        assert result["pawn_islands"]["white"] == 0

    def test_description_generated(self):
        board = chess.Board("4k3/8/8/3P4/8/8/8/4K3 w - - 0 1")
        result = analyze_pawn_structure(board)
        assert isinstance(result["description"], str)
        assert len(result["description"]) > 0

    def test_result_structure(self):
        board = chess.Board()
        result = analyze_pawn_structure(board)
        assert "white_pawns" in result
        assert "black_pawns" in result
        assert "isolated" in result
        assert "doubled" in result
        assert "passed" in result
        assert "pawn_islands" in result
        assert "description" in result
