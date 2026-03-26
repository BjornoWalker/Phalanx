import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import SettingsModel
from app import settings_store

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get_settings() -> SettingsModel:
    return settings_store.load()


@router.put("")
async def update_settings(settings: SettingsModel) -> SettingsModel:
    settings_store.save(settings)
    return settings


@router.get("/themes")
async def get_themes():
    return {
        "themes": [
            {"id": "green", "name": "Green", "dark": "#779952", "light": "#edeed1"},
            {"id": "brown", "name": "Brown", "dark": "#b58863", "light": "#f0d9b5"},
            {"id": "blue", "name": "Blue", "dark": "#5b7aa6", "light": "#dee3e6"},
            {"id": "purple", "name": "Purple", "dark": "#7b61a6", "light": "#e8dff5"},
            {"id": "gray", "name": "Gray", "dark": "#86888a", "light": "#cbcccb"},
        ]
    }


@router.get("/tablebase/status")
async def tablebase_status():
    from app.main import get_tablebase
    tb = get_tablebase()
    return tb.get_status()


# --- Ollama model management ---

RECOMMENDED_MODELS = [
    {
        "name": "llama3.1:8b",
        "display": "Llama 3.1 8B",
        "size": "~4.7 GB",
        "speed": "Fast (15-30 tok/s on Apple Silicon)",
        "description": "Great balance of quality and speed. Recommended for most users.",
    },
    {
        "name": "mistral:7b",
        "display": "Mistral 7B",
        "size": "~4.1 GB",
        "speed": "Fast (15-35 tok/s on Apple Silicon)",
        "description": "Strong reasoning with concise outputs.",
    },
    {
        "name": "gemma2:9b",
        "display": "Gemma 2 9B",
        "size": "~5.4 GB",
        "speed": "Moderate (10-25 tok/s on Apple Silicon)",
        "description": "Google's model. Good at explanations.",
    },
    {
        "name": "phi3:mini",
        "display": "Phi-3 Mini 3.8B",
        "size": "~2.3 GB",
        "speed": "Very fast (30-50 tok/s on Apple Silicon)",
        "description": "Smallest and fastest. Good for quick feedback, less detailed.",
    },
    {
        "name": "deepseek-r1:8b",
        "display": "DeepSeek-R1 8B",
        "size": "~5.2 GB",
        "speed": "Fast (15-30 tok/s on Apple Silicon)",
        "description": "Strong reasoning model. Excellent at explaining chess tactics.",
    },
    {
        "name": "deepseek-r1:14b",
        "display": "DeepSeek-R1 14B",
        "size": "~9.0 GB",
        "speed": "Moderate (8-15 tok/s on Apple Silicon)",
        "description": "Higher quality reasoning. Slower but more detailed coaching.",
    },
    {
        "name": "gpt-oss:20b",
        "display": "GPT-OSS 20B",
        "size": "~12 GB",
        "speed": "Moderate (5-12 tok/s on Apple Silicon)",
        "description": "OpenAI's open-weight model. Strong reasoning and agentic capability.",
    },
]


@router.get("/ollama/status")
async def ollama_status():
    """Check if Ollama is running and list installed models."""
    try:
        import ollama
        client = ollama.Client()
        models = client.list()
        installed = []
        for m in models.get("models", []):
            name = m.get("name", "") or m.get("model", "")
            size_bytes = m.get("size", 0)
            size_gb = round(size_bytes / (1024**3), 1) if size_bytes else 0
            installed.append({
                "name": name,
                "size_gb": size_gb,
                "modified_at": m.get("modified_at", ""),
            })
        return {
            "running": True,
            "installed": installed,
            "recommended": RECOMMENDED_MODELS,
        }
    except Exception:
        return {
            "running": False,
            "installed": [],
            "recommended": RECOMMENDED_MODELS,
        }


@router.post("/ollama/pull")
async def ollama_pull(req: dict):
    """Pull (download) an Ollama model. Returns streaming progress."""
    model_name = req.get("model", "")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")

    async def stream_progress():
        try:
            import ollama
            client = ollama.Client()
            import json

            for progress in client.pull(model_name, stream=True):
                status = progress.get("status", "")
                total = progress.get("total", 0)
                completed = progress.get("completed", 0)
                pct = round((completed / total) * 100, 1) if total else 0
                yield json.dumps({
                    "status": status,
                    "total": total,
                    "completed": completed,
                    "percent": pct,
                }) + "\n"

            yield json.dumps({"status": "success", "percent": 100}) + "\n"
        except Exception as e:
            import json
            yield json.dumps({"status": "error", "message": str(e)}) + "\n"

    return StreamingResponse(stream_progress(), media_type="application/x-ndjson")
