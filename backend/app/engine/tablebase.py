import os
from pathlib import Path

import chess
import chess.syzygy

SYZYGY_PATH = Path.home() / ".local-chess-engine" / "syzygy"


class SyzygyProber:
    """Probes Syzygy endgame tablebases for positions with ≤5 pieces.

    Returns WDL (Win/Draw/Loss) and DTZ (Distance To Zeroing) values.
    Thread-safe when using different board objects per call.
    """

    def __init__(self, path: str | None = None):
        self._path = path or str(SYZYGY_PATH)
        self._tablebase: chess.syzygy.Tablebase | None = None

    def is_available(self) -> bool:
        """Check if tablebase files exist."""
        if not os.path.exists(self._path):
            return False
        files = [f for f in os.listdir(self._path) if f.endswith(('.rtbw', '.rtbz'))]
        return len(files) > 0

    def start(self) -> None:
        """Open the tablebase. Call once on startup."""
        if self._tablebase is not None:
            return
        if not self.is_available():
            return
        self._tablebase = chess.syzygy.open_tablebase(self._path)

    def close(self) -> None:
        if self._tablebase is not None:
            self._tablebase.close()
            self._tablebase = None

    def is_tablebase_position(self, board: chess.Board) -> bool:
        """Check if the position has ≤5 pieces (eligible for tablebase probe)."""
        return len(board.piece_map()) <= 5

    def probe(self, board: chess.Board) -> dict | None:
        """Probe the tablebase for the given position.

        Returns:
          {"wdl": int, "dtz": int | None}
          wdl: 2 = win, 1 = cursed win, 0 = draw, -1 = blessed loss, -2 = loss
          dtz: distance to zeroing (positive = winning side makes progress)
        Or None if not a tablebase position or tables not available.
        """
        if self._tablebase is None or not self.is_tablebase_position(board):
            return None

        try:
            wdl = self._tablebase.probe_wdl(board)
            try:
                dtz = self._tablebase.probe_dtz(board)
            except (chess.syzygy.MissingTableError, KeyError, ValueError):
                dtz = None

            return {"wdl": wdl, "dtz": dtz}
        except (chess.syzygy.MissingTableError, KeyError, ValueError):
            # ValueError raised for positions with castling rights
            return None

    def get_status(self) -> dict:
        """Return tablebase status info."""
        if not os.path.exists(self._path):
            return {"available": False, "path": self._path, "file_count": 0, "size_mb": 0}

        files = [f for f in os.listdir(self._path) if f.endswith(('.rtbw', '.rtbz'))]
        total_size = sum(
            os.path.getsize(os.path.join(self._path, f))
            for f in files
        )
        return {
            "available": len(files) > 0,
            "path": self._path,
            "file_count": len(files),
            "size_mb": round(total_size / (1024 * 1024), 1),
        }
