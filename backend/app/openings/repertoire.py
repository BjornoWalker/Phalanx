import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import chess
import chess.pgn
import io

REPERTOIRE_PATH = Path.home() / ".local-chess-engine" / "repertoire.json"


class RepertoireDB:
    """Manages a personal opening repertoire with SM-2 spaced repetition.

    Each line is stored as:
    {
        "id": str,
        "name": str,
        "color": "white" | "black",
        "moves": ["e2e4", "e7e5", ...],  # UCI moves
        "moves_san": ["e4", "e5", ...],
        "last_drilled": str (ISO datetime) | null,
        "interval_days": float,
        "ease_factor": float,
        "correct_count": int,
        "incorrect_count": int,
    }
    """

    def __init__(self, path: str | None = None):
        self._path = Path(path) if path else REPERTOIRE_PATH
        self._lines: list[dict] = []
        self._load()

    def _load(self):
        if self._path.exists():
            try:
                self._lines = json.loads(self._path.read_text())
            except (json.JSONDecodeError, TypeError):
                self._lines = []
        else:
            self._lines = []

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._lines, indent=2))

    def get_lines(self, color: str | None = None) -> list[dict]:
        if color:
            return [l for l in self._lines if l["color"] == color]
        return list(self._lines)

    def add_line(self, name: str, color: str, moves_san: list[str]) -> dict:
        """Add a new opening line from SAN moves."""
        board = chess.Board()
        uci_moves = []
        for san in moves_san:
            move = board.parse_san(san)
            uci_moves.append(move.uci())
            board.push(move)

        line = {
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "color": color,
            "moves": uci_moves,
            "moves_san": moves_san,
            "last_drilled": None,
            "interval_days": 1.0,
            "ease_factor": 2.5,
            "correct_count": 0,
            "incorrect_count": 0,
        }
        self._lines.append(line)
        self._save()
        return line

    def import_pgn(self, pgn_text: str, color: str) -> list[dict]:
        """Import one or more opening lines from PGN text."""
        added = []
        pgn_io = io.StringIO(pgn_text)

        while True:
            game = chess.pgn.read_game(pgn_io)
            if game is None:
                break

            name = game.headers.get("Opening", "") or game.headers.get("Event", "Imported Line")
            board = game.board()
            moves_san = []
            for move in game.mainline_moves():
                moves_san.append(board.san(move))
                board.push(move)

            if moves_san:
                line = self.add_line(name, color, moves_san)
                added.append(line)

        return added

    def delete_line(self, line_id: str) -> bool:
        before = len(self._lines)
        self._lines = [l for l in self._lines if l["id"] != line_id]
        if len(self._lines) < before:
            self._save()
            return True
        return False

    def get_next_drill(self, color: str | None = None) -> dict | None:
        """Get the line most due for review using SM-2 scheduling."""
        candidates = self.get_lines(color)
        if not candidates:
            return None

        now = datetime.now(timezone.utc)
        best = None
        best_urgency = float('-inf')

        for line in candidates:
            if line["last_drilled"] is None:
                # Never drilled — highest priority
                urgency = 999999
            else:
                last = datetime.fromisoformat(line["last_drilled"])
                days_since = (now - last).total_seconds() / 86400
                # Urgency = how overdue it is (days since last drill / interval)
                urgency = days_since / max(line["interval_days"], 0.1)

            if urgency > best_urgency:
                best_urgency = urgency
                best = line

        return best

    def record_drill_result(self, line_id: str, correct: bool) -> dict | None:
        """Update spaced repetition data after a drill attempt.

        SM-2 simplified:
        - Correct: interval *= ease_factor, ease_factor += 0.1 (max 3.0)
        - Incorrect: interval = 1 day, ease_factor -= 0.2 (min 1.3)
        """
        for line in self._lines:
            if line["id"] == line_id:
                now = datetime.now(timezone.utc).isoformat()
                line["last_drilled"] = now

                if correct:
                    line["correct_count"] += 1
                    line["interval_days"] = max(1.0, line["interval_days"] * line["ease_factor"])
                    line["ease_factor"] = min(3.0, line["ease_factor"] + 0.1)
                else:
                    line["incorrect_count"] += 1
                    line["interval_days"] = 1.0
                    line["ease_factor"] = max(1.3, line["ease_factor"] - 0.2)

                self._save()
                return line
        return None
