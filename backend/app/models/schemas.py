from enum import Enum
from typing import Literal

from pydantic import BaseModel


class MoveClassification(str, Enum):
    BRILLIANT = "brilliant"
    GREAT = "great"
    BEST = "best"
    GOOD = "good"
    MISTAKE = "mistake"
    MISS = "miss"
    BLUNDER = "blunder"


class SettingsModel(BaseModel):
    board_theme: str = "green"
    piece_set: str = "default"
    coaching_mode: Literal["template", "llm"] = "template"
    llm_model: str = "llama3.1:8b"
    difficulty: str = "Intermediate"
    show_best_move: bool = True
    dark_mode: bool = True
    analysis_depth: int = 20
    multipv: int = 3
    coach_avatar: str = "robot"
    coach_verbosity: Literal["short", "medium", "long"] = "medium"
    blunder_alerts: bool = True
    blunder_threshold: int = 150
    engine_choice: str = "stockfish"


class HealthResponse(BaseModel):
    status: str


class MoveRequest(BaseModel):
    fen: str
    move: str  # UCI notation (e.g., "e2e4")


class PositionAnalysisRequest(BaseModel):
    fen: str
    depth: int = 20
    multipv: int = 3


class AnalysisResponse(BaseModel):
    evaluation: float
    best_move: str
    best_move_san: str
    classification: MoveClassification | None = None
    top_lines: list[list[str]] = []


class AnalyzedMove(BaseModel):
    ply: int
    san: str
    uci: str
    fen_before: str
    fen_after: str
    eval_before: float
    eval_after: float
    cp_loss: int
    classification: MoveClassification
    best_move_uci: str
    best_move_san: str
    top_lines: list[list[str]] = []


class GameAnalysis(BaseModel):
    moves: list[AnalyzedMove]
    white_accuracy: float
    black_accuracy: float
    white_breakdown: dict[str, int]
    black_breakdown: dict[str, int]
    eval_graph: list[float]


class ParsedGame(BaseModel):
    white: str
    black: str
    date: str = ""
    result: str = ""
    white_elo: int | None = None
    black_elo: int | None = None
    time_control: str = ""
    moves: list[str] = []
    pgn: str = ""


class CoachStartRequest(BaseModel):
    player_color: Literal["white", "black"] = "white"
    difficulty: str = "Intermediate"


class CoachMoveRequest(BaseModel):
    fen: str
    move: str  # UCI notation
