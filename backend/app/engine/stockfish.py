import shutil
from dataclasses import dataclass, field

import chess
import chess.engine


@dataclass
class AnalysisResult:
    evaluation_cp: int  # centipawns from white's perspective
    is_mate: bool = False
    mate_in: int | None = None
    best_move_uci: str = ""
    best_move_san: str = ""
    top_lines: list[list[str]] = field(default_factory=list)
    depth: int = 0
    wdl: tuple[int, int, int] | None = None  # (wins, draws, losses) per mille


# Difficulty tier -> engine config
DIFFICULTY_TIERS: dict[str, dict] = {
    "New to Chess": {"type": "skill", "value": 0},
    "Beginner": {"type": "skill", "value": 2},
    "Novice": {"type": "skill", "value": 5},
    "Intermediate": {"type": "skill", "value": 8},
    "Intermediate II": {"type": "skill", "value": 13},
    "Advanced": {"type": "elo", "value": 1600},
    "Expert": {"type": "elo", "value": 2000},
    "Full Strength": {"type": "full", "value": 0},
}


class StockfishAdapter:
    def __init__(
        self,
        path: str | None = None,
        threads: int = 4,
        hash_mb: int = 256,
    ):
        if path is None:
            path = shutil.which("stockfish")
        if path is None:
            raise RuntimeError(
                "Stockfish binary not found. Install with: brew install stockfish"
            )

        self._path = path
        self._threads = threads
        self._hash_mb = hash_mb
        self._engine: chess.engine.SimpleEngine | None = None
        self._difficulty = "Full Strength"

    def start(self) -> None:
        if self._engine is not None:
            return
        self._engine = chess.engine.SimpleEngine.popen_uci(self._path)
        self._engine.configure({
            "Threads": self._threads,
            "Hash": self._hash_mb,
        })

    def close(self) -> None:
        if self._engine is not None:
            self._engine.quit()
            self._engine = None

    @property
    def engine(self) -> chess.engine.SimpleEngine:
        if self._engine is None:
            raise RuntimeError("Engine not started. Call start() first.")
        return self._engine

    def set_difficulty(self, tier: str) -> None:
        config = DIFFICULTY_TIERS.get(tier)
        if config is None:
            config = DIFFICULTY_TIERS["Full Strength"]

        self._difficulty = tier

        if config["type"] == "skill":
            self.engine.configure({
                "UCI_LimitStrength": False,
                "Skill Level": config["value"],
            })
        elif config["type"] == "elo":
            self.engine.configure({
                "UCI_LimitStrength": True,
                "UCI_Elo": config["value"],
            })
        else:
            # Full strength
            self.engine.configure({
                "UCI_LimitStrength": False,
                "Skill Level": 20,
            })

    def analyze_position(
        self,
        fen: str,
        depth: int = 20,
        multipv: int = 3,
    ) -> AnalysisResult:
        board = chess.Board(fen)

        if board.is_game_over():
            return AnalysisResult(evaluation_cp=0)

        infos = self.engine.analyse(
            board,
            chess.engine.Limit(depth=depth, time=5.0),
            multipv=multipv,
        )

        if not isinstance(infos, list):
            infos = [infos]

        first = infos[0]
        score = first["score"].white()

        # Extract evaluation
        is_mate = score.is_mate()
        if is_mate:
            mate_in = score.mate()
            eval_cp = 30000 if (mate_in is not None and mate_in > 0) else -30000
        else:
            cp = score.score()
            eval_cp = cp if cp is not None else 0

        # Best move
        pv = first.get("pv", [])
        best_move_uci = pv[0].uci() if pv else ""
        best_move_san = board.san(pv[0]) if pv else ""

        # Top lines as SAN
        top_lines: list[list[str]] = []
        for info in infos:
            line_pv = info.get("pv", [])
            if line_pv:
                san_line = []
                temp_board = board.copy()
                for move in line_pv[:8]:  # limit to 8 moves per line
                    san_line.append(temp_board.san(move))
                    temp_board.push(move)
                top_lines.append(san_line)

        return AnalysisResult(
            evaluation_cp=eval_cp,
            is_mate=is_mate,
            mate_in=score.mate() if is_mate else None,
            best_move_uci=best_move_uci,
            best_move_san=best_move_san,
            top_lines=top_lines,
            depth=first.get("depth", depth),
        )

    def get_best_move(
        self,
        fen: str,
        time_limit: float = 1.0,
    ) -> tuple[str, str]:
        """Returns (uci, san) for the engine's best move."""
        board = chess.Board(fen)
        if board.is_game_over():
            return ("", "")

        result = self.engine.play(
            board,
            chess.engine.Limit(time=time_limit),
        )
        if result.move is None:
            return ("", "")

        return (result.move.uci(), board.san(result.move))

    def play_move(
        self,
        fen: str,
        time_limit: float = 1.0,
    ) -> tuple[str, str, str]:
        """Returns (uci, san, fen_after) for the engine's chosen move at current difficulty."""
        board = chess.Board(fen)
        if board.is_game_over():
            return ("", "", fen)

        result = self.engine.play(
            board,
            chess.engine.Limit(time=time_limit),
        )
        if result.move is None:
            return ("", "", fen)

        uci = result.move.uci()
        san = board.san(result.move)
        board.push(result.move)
        return (uci, san, board.fen())
