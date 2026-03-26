import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import analysis, coach, games, openings, puzzles, settings
from app.engine.manager import EngineManager
from app.engine.tablebase import SyzygyProber

# Singleton instances
engine_manager = EngineManager()
tablebase = SyzygyProber()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    engine_manager.start()
    tablebase.start()
    status = engine_manager.get_status()
    tb_status = "available" if tablebase.is_available() else "not found"
    lc0_status = "available" if status["lc0"] else "not found"
    print(f"Backend ready — Stockfish + Lc0 ({lc0_status}), Syzygy ({tb_status})")
    yield
    # Shutdown
    engine_manager.close()
    tablebase.close()
    print("Backend shutting down")


app = FastAPI(title="Local Chess Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(games.router)
app.include_router(coach.router)
app.include_router(settings.router)
app.include_router(puzzles.router)
app.include_router(openings.router)


@app.get("/api/health")
async def health():
    status = engine_manager.get_status()
    return {"status": "ok", "engines": status}


def get_engine(name: str = "stockfish"):
    return engine_manager.get_engine(name)


def get_engine_manager() -> EngineManager:
    return engine_manager


def get_tablebase() -> SyzygyProber:
    return tablebase


# Register WebSocket endpoints directly on the app (not behind router prefixes)
# so they live at /ws/analysis and /ws/coach, not /api/*/ws/*

@app.websocket("/ws/analysis")
async def ws_analysis(websocket: WebSocket):
    from app.api.routes.analysis import analysis_websocket
    await analysis_websocket(websocket)


@app.websocket("/ws/coach")
async def ws_coach(websocket: WebSocket):
    from app.api.routes.coach import coach_websocket
    await coach_websocket(websocket)


# Serve built frontend in production — MUST be last (catch-all)
frontend_build = os.path.join(os.path.dirname(__file__), "../../frontend/dist")
if os.path.exists(frontend_build):
    app.mount("/", StaticFiles(directory=frontend_build, html=True), name="frontend")
