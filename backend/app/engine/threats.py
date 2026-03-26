import chess

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 300,
    chess.BISHOP: 300,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}

PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}


def detect_threats(board: chess.Board) -> list[dict]:
    """Detect tactical threats in the current position.

    Checks for:
    - Hanging pieces (undefended pieces attacked by the opponent)
    - En prise pieces (attacked by lower-value opponent pieces)

    Returns a list of threat dicts:
      {"type": "hanging"|"en_prise", "square": "e5", "piece": "knight",
       "color": "white", "description": "Your knight on e5 is undefended!"}
    """
    threats: list[dict] = []
    side = board.turn  # the side whose threats we check (they just moved, so we check THEIR pieces being attacked)
    opponent = not side
    side_name = "White" if side == chess.WHITE else "Black"

    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece is None or piece.color != side:
            continue
        if piece.piece_type == chess.KING:
            continue

        square_name = chess.square_name(square)
        piece_name = PIECE_NAMES[piece.piece_type]
        piece_value = PIECE_VALUES[piece.piece_type]

        # Is this piece attacked by the opponent?
        is_attacked = board.is_attacked_by(opponent, square)
        if not is_attacked:
            continue

        # Is this piece defended by our own pieces?
        is_defended = board.is_attacked_by(side, square)

        if not is_defended:
            # Hanging — attacked and undefended
            threats.append({
                "type": "hanging",
                "square": square_name,
                "piece": piece_name,
                "color": side_name.lower(),
                "description": f"Your {piece_name} on {square_name} is hanging (undefended and attacked)!",
            })
        else:
            # Check if attacked by a lower-value piece (en prise)
            for attacker_sq in board.attackers(opponent, square):
                attacker = board.piece_at(attacker_sq)
                if attacker and PIECE_VALUES.get(attacker.piece_type, 0) < piece_value:
                    attacker_name = PIECE_NAMES[attacker.piece_type]
                    threats.append({
                        "type": "en_prise",
                        "square": square_name,
                        "piece": piece_name,
                        "color": side_name.lower(),
                        "description": f"Your {piece_name} on {square_name} is attacked by a {attacker_name} — consider moving it.",
                    })
                    break  # one warning per piece is enough

    return threats
