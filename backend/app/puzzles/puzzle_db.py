import os
import sqlite3
from pathlib import Path

DB_PATH = Path.home() / ".local-chess-engine" / "puzzles.db"

# All distinct theme tokens across the database
KNOWN_THEMES = [
    "advancedPawn", "advantage", "anapilosOpening", "arabianMate",
    "attackingF2F7", "attraction", "backRankMate", "bishopEndgame",
    "bodenMate", "capablancaFreeing", "castling", "clearance",
    "crushing", "defensiveMove", "deflection", "discoveredAttack",
    "doubleBishopMate", "doubleCheck", "endgame", "enPassant",
    "equality", "exposedKing", "fork", "hangingPiece",
    "hookMate", "interference", "intermezzo", "kingsideAttack",
    "knightEndgame", "long", "master", "masterVsMaster",
    "mate", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5",
    "middlegame", "oneMove", "opening", "pawnEndgame",
    "pin", "promotion", "queenEndgame", "queenRookEndgame",
    "queensideAttack", "quietMove", "rookEndgame",
    "sacrifice", "short", "skewer", "smotheredMate",
    "superGM", "trappedPiece", "underPromotion",
    "vpilosOpening", "xRayAttack", "zugzwang",
]


class PuzzleDB:
    def __init__(self, db_path: str | None = None):
        self._path = db_path or str(DB_PATH)
        self._conn: sqlite3.Connection | None = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self._path)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def is_available(self) -> bool:
        return os.path.exists(self._path)

    def get_random(
        self,
        rating_min: int = 600,
        rating_max: int = 2400,
        themes: list[str] | None = None,
        count: int = 1,
    ) -> list[dict]:
        query = "SELECT * FROM puzzles WHERE rating BETWEEN ? AND ?"
        params: list = [rating_min, rating_max]

        if themes:
            # Match any of the requested themes
            theme_clauses = []
            for theme in themes:
                theme_clauses.append("themes LIKE ?")
                params.append(f"%{theme}%")
            query += " AND (" + " OR ".join(theme_clauses) + ")"

        query += " ORDER BY RANDOM() LIMIT ?"
        params.append(count)

        rows = self.conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]

    def get_by_id(self, puzzle_id: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM puzzles WHERE id = ?", (puzzle_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_themes(self) -> list[dict]:
        """Return themes with approximate counts."""
        results = []
        for theme in sorted(KNOWN_THEMES):
            row = self.conn.execute(
                "SELECT COUNT(*) as c FROM puzzles WHERE themes LIKE ?",
                (f"%{theme}%",),
            ).fetchone()
            if row and row["c"] > 0:
                results.append({"theme": theme, "count": row["c"]})
        return results

    def get_stats(self) -> dict:
        total = self.conn.execute("SELECT COUNT(*) FROM puzzles").fetchone()[0]
        min_r = self.conn.execute("SELECT MIN(rating) FROM puzzles").fetchone()[0]
        max_r = self.conn.execute("SELECT MAX(rating) FROM puzzles").fetchone()[0]
        return {"total": total, "min_rating": min_r, "max_rating": max_r}

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None
