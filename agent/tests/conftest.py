from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "asyncio: mark test as async")

    # Load env vars before any test runs so get_llm() sees ANTHROPIC_API_KEY.
    # Mirrors what the existing smoke test does (agent/test_triage.py:76-77).
    # In GitHub Actions the vars are injected via secrets — load_dotenv is a
    # no-op there since the file won't exist, which is fine.
    load_dotenv(dotenv_path=os.path.join("agent", ".env"))
    load_dotenv()  # also pick up repo-root .env / .env.local
