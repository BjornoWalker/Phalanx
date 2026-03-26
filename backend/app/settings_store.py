import json
import os
from pathlib import Path

from app.models.schemas import SettingsModel

SETTINGS_DIR = Path.home() / ".phalanx"
SETTINGS_FILE = SETTINGS_DIR / "settings.json"


def load() -> SettingsModel:
    if SETTINGS_FILE.exists():
        try:
            data = json.loads(SETTINGS_FILE.read_text())
            return SettingsModel(**data)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    return SettingsModel()


def save(settings: SettingsModel) -> None:
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(
        json.dumps(settings.model_dump(), indent=2)
    )
