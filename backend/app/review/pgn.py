import io

import chess.pgn

from app.models.schemas import ParsedGame


def parse_pgn_string(pgn_text: str) -> list[ParsedGame]:
    """Parse a PGN string (potentially containing multiple games) into ParsedGame objects."""
    games: list[ParsedGame] = []
    pgn_io = io.StringIO(pgn_text)

    while True:
        game = chess.pgn.read_game(pgn_io)
        if game is None:
            break

        headers = game.headers
        moves: list[str] = []
        board = game.board()
        for move in game.mainline_moves():
            moves.append(board.san(move))
            board.push(move)

        # Reconstruct PGN for this single game
        exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)
        single_pgn = game.accept(exporter)

        # Parse ELO values safely
        white_elo = None
        black_elo = None
        try:
            white_elo = int(headers.get("WhiteElo", ""))
        except (ValueError, TypeError):
            pass
        try:
            black_elo = int(headers.get("BlackElo", ""))
        except (ValueError, TypeError):
            pass

        games.append(ParsedGame(
            white=headers.get("White", "Unknown"),
            black=headers.get("Black", "Unknown"),
            date=headers.get("Date", ""),
            result=headers.get("Result", ""),
            white_elo=white_elo,
            black_elo=black_elo,
            time_control=headers.get("TimeControl", ""),
            moves=moves,
            pgn=single_pgn,
        ))

    return games
