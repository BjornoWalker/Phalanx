import shutil
from dataclasses import dataclass, field
from pathlib import Path

import chess
import chess.engine

from app.engine.stockfish import AnalysisResult

WEIGHTS_PATH = Path.home() / ".local-chess-engine" / "lc0" / "weights.pb.gz"


class Lc0Adapter:
    """Adapter for the Leela Chess Zero (Lc0) neural network engine.

    Uses the same python-chess UCI protocol as Stockfish.
    Provides WDL (Win/Draw/Loss) probabilities natively.
    """

    def __init__(
        self,
        path: str | None = None,
        weights: str | None = None,
    ):
        if path is None:
            path = shutil.which("lc0")
        self._path = path
        self._weights = weights or str(WEIGHTS_PATH)
        self._engine: chess.engine.SimpleEngine | None = None

    @staticmethod
    def is_available() -> bool:
        """Check if Lc0 binary and weights are available."""
        return shutil.which("lc0") is not None and WEIGHTS_PATH.exists()

    def start(self) -> None:
        if self._engine is not None:
            return
        if self._path is None:
            raise RuntimeError("Lc0 binary not found. Install with: brew install lc0")

        self._engine = chess.engine.SimpleEngine.popen_uci(self._path)
        if Path(self._weights).exists():
            self._engine.configure({"WeightsFile": self._weights})

    def close(self) -> None:
        if self._engine is not None:
            self._engine.quit()
            self._engine = None

    @property
    def engine(self) -> chess.engine.SimpleEngine:
        if self._engine is None:
            raise RuntimeError("Lc0 not started. Call start() first.")
        return self._engine

    def analyze_position(
        self,
        fen: str,
        depth: int = 20,
        multipv: int = 3,
    ) -> AnalysisResult:
        board = chess.Board(fen)

        if board.is_game_over():
            return AnalysisResult(evaluation_cp=0)

        # Lc0 uses nodes rather than depth for search control
        # ~800 nodes gives reasonable quality in ~1-2 seconds on Apple Silicon
        nodes = min(800, depth * 40)

        infos = self.engine.analyse(
            board,
            chess.engine.Limit(nodes=nodes, time=5.0),
            multipv=min(multipv, 3),
        )

        if not isinstance(infos, list):
            infos = [infos]

        first = infos[0]
        score = first["score"].white()

        is_mate = score.is_mate()
        if is_mate:
            mate_in = score.mate()
            eval_cp = 30000 if (mate_in is not None and mate_in > 0) else -30000
        else:
            cp = score.score()
            eval_cp = cp if cp is not None else 0

        pv = first.get("pv", [])
        best_move_uci = pv[0].uci() if pv else ""
        best_move_san = board.san(pv[0]) if pv else ""

        top_lines: list[list[str]] = []
        for info in infos:
            line_pv = info.get("pv", [])
            if line_pv:
                san_line = []
                temp_board = board.copy()
                for move in line_pv[:8]:
                    san_line.append(temp_board.san(move))
                    temp_board.push(move)
                top_lines.append(san_line)

        result = AnalysisResult(
            evaluation_cp=eval_cp,
            is_mate=is_mate,
            mate_in=score.mate() if is_mate else None,
            best_move_uci=best_move_uci,
            best_move_san=best_move_san,
            top_lines=top_lines,
            depth=first.get("depth", 0),
        )

        # Extract WDL probabilities if available
        try:
            wdl = score.wdl()
            result.wdl = (wdl.wins, wdl.draws, wdl.losses)
        except Exception:
            pass

        return result

    def get_best_move(self, fen: str, time_limit: float = 1.0) -> tuple[str, str]:
        board = chess.Board(fen)
        if board.is_game_over():
            return ("", "")
        result = self.engine.play(board, chess.engine.Limit(time=time_limit))
        if result.move is None:
            return ("", "")
        return (result.move.uci(), board.san(result.move))

    def play_move(self, fen: str, time_limit: float = 1.0) -> tuple[str, str, str]:
        board = chess.Board(fen)
        if board.is_game_over():
            return ("", "", fen)
        result = self.engine.play(board, chess.engine.Limit(time=time_limit))
        if result.move is None:
            return ("", "", fen)
        uci = result.move.uci()
        san = board.san(result.move)
        board.push(result.move)
        return (uci, san, board.fen())

    def set_difficulty(self, tier: str) -> None:
        # Lc0 doesn't have Skill Level — we adjust by node count
        # This is handled in analyze_position via the depth parameter
        pass
