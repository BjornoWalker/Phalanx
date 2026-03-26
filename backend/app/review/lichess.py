import httpx

from app.review.pgn import parse_pgn_string


class LichessClient:
    BASE_URL = "https://lichess.org/api"
    USER_AGENT = "LocalChessEngine/1.0"

    def __init__(self):
        self._client = httpx.AsyncClient(
            headers={
                "User-Agent": self.USER_AGENT,
                "Accept": "application/x-chess-pgn",
            },
            timeout=30.0,
            follow_redirects=True,
        )

    async def close(self):
        await self._client.aclose()

    async def fetch_recent_games(
        self, username: str, count: int = 50
    ) -> list[dict]:
        """Fetch recent games for a Lichess user as PGN, parse into game summaries."""
        url = f"{self.BASE_URL}/games/user/{username}"
        params = {
            "max": str(count),
            "opening": "true",
            "clocks": "true",
        }

        resp = await self._client.get(url, params=params)

        if resp.status_code == 404:
            raise ValueError(f"Player '{username}' not found on Lichess")
        if resp.status_code == 429:
            import asyncio
            await asyncio.sleep(60.0)
            resp = await self._client.get(url, params=params)

        resp.raise_for_status()
        pgn_text = resp.text

        if not pgn_text.strip():
            return []

        # Parse PGN into structured games
        parsed = parse_pgn_string(pgn_text)

        result = []
        for game in parsed:
            result.append({
                "url": "",
                "pgn": game.pgn,
                "time_control": game.time_control,
                "time_class": _classify_time_control(game.time_control),
                "end_time": 0,
                "platform": "lichess",
                "white": {
                    "username": game.white,
                    "rating": game.white_elo or 0,
                    "result": _parse_result(game.result, "white"),
                },
                "black": {
                    "username": game.black,
                    "rating": game.black_elo or 0,
                    "result": _parse_result(game.result, "black"),
                },
            })

        return result


def _classify_time_control(tc: str) -> str:
    """Classify a time control string into a category."""
    try:
        if "+" in tc:
            base, inc = tc.split("+")
            total = int(base) + 40 * int(inc)
        elif "-" in tc:
            return "correspondence"
        else:
            total = int(tc)

        if total < 120:
            return "bullet"
        elif total < 480:
            return "blitz"
        elif total < 1500:
            return "rapid"
        else:
            return "classical"
    except (ValueError, TypeError):
        return "unknown"


def _parse_result(result: str, color: str) -> str:
    """Convert PGN result to Chess.com-style result for a given color."""
    if result == "1-0":
        return "win" if color == "white" else "lose"
    elif result == "0-1":
        return "win" if color == "black" else "lose"
    elif result == "1/2-1/2":
        return "draw"
    return ""
