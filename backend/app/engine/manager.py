from app.engine.stockfish import StockfishAdapter
from app.engine.lc0 import Lc0Adapter


class EngineManager:
    """Manages multiple chess engines (Stockfish and optionally Lc0)."""

    def __init__(self):
        self.stockfish = StockfishAdapter()
        self._lc0: Lc0Adapter | None = None

    @property
    def lc0(self) -> Lc0Adapter | None:
        return self._lc0

    def is_lc0_available(self) -> bool:
        return Lc0Adapter.is_available()

    def start(self) -> None:
        self.stockfish.start()
        if self.is_lc0_available():
            try:
                self._lc0 = Lc0Adapter()
                self._lc0.start()
            except Exception as e:
                print(f"Warning: Failed to start Lc0: {e}")
                self._lc0 = None

    def close(self) -> None:
        self.stockfish.close()
        if self._lc0 is not None:
            self._lc0.close()

    def get_engine(self, name: str = "stockfish") -> StockfishAdapter | Lc0Adapter:
        if name == "lc0" and self._lc0 is not None:
            return self._lc0
        return self.stockfish

    def get_status(self) -> dict:
        return {
            "stockfish": True,
            "lc0": self._lc0 is not None,
            "lc0_available": self.is_lc0_available(),
        }
