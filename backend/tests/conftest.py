"""Shared test fixtures for the chess engine backend."""
import chess
import pytest


# Common FEN positions for testing
STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
ITALIAN_GAME = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"
KR_VS_K = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1"
SCHOLARS_MATE_SETUP = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"

# Position with hanging piece (black knight on c6 attacked by Bb5, undefended)
HANGING_PIECE_FEN = "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"

# Position with passed pawn
PASSED_PAWN_FEN = "8/8/8/3P4/8/8/8/4K2k w - - 0 1"

# Position with isolated pawn
ISOLATED_PAWN_FEN = "8/pp1p1ppp/8/2P5/8/8/PP3PPP/4K2k w - - 0 1"


@pytest.fixture
def starting_board():
    return chess.Board(STARTING_FEN)


@pytest.fixture
def italian_board():
    return chess.Board(ITALIAN_GAME)
