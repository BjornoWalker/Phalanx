from datetime import datetime, timezone

import httpx


class ChessComClient:
    BASE_URL = "https://api.chess.com/pub"
    USER_AGENT = "LocalChessEngine/1.0"

    def __init__(self):
        self._client = httpx.AsyncClient(
            headers={"User-Agent": self.USER_AGENT},
            timeout=15.0,
            follow_redirects=True,
        )

    async def close(self):
        await self._client.aclose()

    async def fetch_monthly_games(
        self, username: str, year: int, month: int
    ) -> list[dict]:
        """Fetch all games for a given month."""
        username = username.lower()
        url = f"{self.BASE_URL}/player/{username}/games/{year}/{month:02d}"
        resp = await self._client.get(url)

        if resp.status_code == 404:
            raise ValueError(f"Player '{username}' not found on Chess.com")
        if resp.status_code == 429:
            import asyncio
            await asyncio.sleep(1.0)
            resp = await self._client.get(url)

        resp.raise_for_status()
        data = resp.json()
        return data.get("games", [])

    async def fetch_game_archives(self, username: str) -> list[str]:
        """Fetch the list of monthly archive URLs for a player."""
        username = username.lower()
        url = f"{self.BASE_URL}/player/{username}/games/archives"
        resp = await self._client.get(url)

        if resp.status_code == 404:
            raise ValueError(f"Player '{username}' not found on Chess.com")

        resp.raise_for_status()
        data = resp.json()
        return data.get("archives", [])

    async def fetch_recent_games(
        self, username: str, count: int = 50, max_months: int = 12
    ) -> list[dict]:
        """Fetch the most recent games for a player.

        Searches backward through monthly archives until `count` games are
        collected or `max_months` have been checked.
        """
        username = username.lower()
        now = datetime.now(timezone.utc)
        games: list[dict] = []

        year, month = now.year, now.month

        for _ in range(max_months):
            try:
                monthly = await self.fetch_monthly_games(username, year, month)
                games = monthly + games
            except (httpx.HTTPError, ValueError):
                pass

            if len(games) >= count:
                break

            month -= 1
            if month < 1:
                month = 12
                year -= 1

        # Sort by end_time descending (most recent first)
        games.sort(key=lambda g: g.get("end_time", 0), reverse=True)

        # Extract useful info
        result = []
        for game in games[:count]:
            white = game.get("white", {})
            black = game.get("black", {})
            result.append({
                "url": game.get("url", ""),
                "pgn": game.get("pgn", ""),
                "time_control": game.get("time_control", ""),
                "time_class": game.get("time_class", ""),
                "end_time": game.get("end_time", 0),
                "white": {
                    "username": white.get("username", ""),
                    "rating": white.get("rating", 0),
                    "result": white.get("result", ""),
                },
                "black": {
                    "username": black.get("username", ""),
                    "rating": black.get("rating", 0),
                    "result": black.get("result", ""),
                },
            })

        return result
