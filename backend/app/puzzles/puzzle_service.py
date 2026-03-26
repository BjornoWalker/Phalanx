import chess


class PuzzleSession:
    """Manages solving a single puzzle.

    Lichess puzzle format:
    - `moves` is a space-separated UCI string
    - First move is the opponent's "setup" move (played automatically)
    - Remaining moves alternate: player move, opponent response, player move...
    - The player must find all their moves correctly
    """

    def __init__(self, puzzle: dict):
        self.puzzle_id = puzzle["id"]
        self.initial_fen = puzzle["fen"]
        self.all_moves = puzzle["moves"].split()
        self.rating = puzzle["rating"]
        self.themes = puzzle.get("themes", "")

        # Apply the setup move to get the starting position
        board = chess.Board(self.initial_fen)
        setup_move = chess.Move.from_uci(self.all_moves[0])
        self.setup_move_san = board.san(setup_move)
        board.push(setup_move)
        self.start_fen = board.fen()

        # The solution moves (after setup): player, opponent, player, ...
        self.solution_moves = self.all_moves[1:]
        self.current_step = 0  # index into solution_moves
        self.board = board.copy()

    @property
    def is_complete(self) -> bool:
        return self.current_step >= len(self.solution_moves)

    @property
    def is_player_turn(self) -> bool:
        return self.current_step % 2 == 0

    @property
    def current_fen(self) -> str:
        return self.board.fen()

    def check_move(self, uci: str) -> dict:
        """Check if the player's move is correct.

        Returns:
          {"correct": True, "complete": bool, "opponent_move"?: {uci, san, fen},
           "next_fen": str}
        or:
          {"correct": False, "expected_uci": str, "expected_san": str}
        """
        if self.is_complete:
            return {"correct": True, "complete": True}

        expected_uci = self.solution_moves[self.current_step]

        if uci == expected_uci:
            # Correct move
            move = chess.Move.from_uci(uci)
            san = self.board.san(move)
            self.board.push(move)
            self.current_step += 1

            result: dict = {
                "correct": True,
                "san": san,
                "next_fen": self.board.fen(),
                "complete": self.is_complete,
            }

            # If not complete and next is opponent's move, auto-play it
            if not self.is_complete and not self.is_player_turn:
                opp_uci = self.solution_moves[self.current_step]
                opp_move = chess.Move.from_uci(opp_uci)
                opp_san = self.board.san(opp_move)
                self.board.push(opp_move)
                self.current_step += 1
                result["opponent_move"] = {
                    "uci": opp_uci,
                    "san": opp_san,
                    "fen": self.board.fen(),
                }
                result["next_fen"] = self.board.fen()
                result["complete"] = self.is_complete

            return result
        else:
            # Wrong move — show the correct answer
            expected_move = chess.Move.from_uci(expected_uci)
            expected_san = self.board.san(expected_move)
            return {
                "correct": False,
                "expected_uci": expected_uci,
                "expected_san": expected_san,
            }

    def get_hint(self, level: int = 1) -> dict:
        """Progressive hints.

        Level 1: which piece to move (the from-square)
        Level 2: the target square
        Level 3: the full move in SAN
        """
        if self.is_complete:
            return {"hint": "Puzzle already solved!"}

        expected_uci = self.solution_moves[self.current_step]
        expected_move = chess.Move.from_uci(expected_uci)
        expected_san = self.board.san(expected_move)

        piece = self.board.piece_at(expected_move.from_square)
        piece_name = {
            chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop",
            chess.ROOK: "rook", chess.QUEEN: "queen", chess.KING: "king",
        }.get(piece.piece_type, "piece") if piece else "piece"

        from_sq = chess.square_name(expected_move.from_square)
        to_sq = chess.square_name(expected_move.to_square)

        if level <= 1:
            return {"hint": f"Move your {piece_name} on {from_sq}", "from_square": from_sq}
        elif level == 2:
            return {"hint": f"Move your {piece_name} from {from_sq} to {to_sq}", "from_square": from_sq, "to_square": to_sq}
        else:
            return {"hint": f"The move is {expected_san}", "from_square": from_sq, "to_square": to_sq, "san": expected_san, "uci": expected_uci}
