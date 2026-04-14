from __future__ import annotations

import os
from pathlib import Path


TRUE_VALUES = {"1", "true", "yes", "on"}


def load_env_file(env_file: Path) -> None:
    if not env_file.exists():
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        cleaned_value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), cleaned_value)


def env(key: str, default: str | None = None) -> str:
    value = os.getenv(key)
    if value is not None:
        return value

    if default is None:
        raise RuntimeError(f"Missing required environment variable: {key}")

    return default


def env_bool(key: str, default: bool = False) -> bool:
    return env(key, str(default)).strip().lower() in TRUE_VALUES


def env_int(key: str, default: int = 0) -> int:
    return int(env(key, str(default)))


def env_list(key: str, default: str = "") -> list[str]:
    raw_value = env(key, default)
    return [item.strip() for item in raw_value.split(",") if item.strip()]
