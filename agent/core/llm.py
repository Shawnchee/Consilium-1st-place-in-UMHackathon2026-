"""Z.AI GLM client — mirrors lib/glm.ts on the TypeScript side.

Uses LangChain's ChatOpenAI pointed at the Z.AI base URL. Returns a model
that can be used directly or wrapped with `.bind_tools(TOOLS)` so the
agent node gets native tool-calling.
"""
from __future__ import annotations

import os
from functools import lru_cache

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic


def _require_env(key: str) -> str:
    val = (os.getenv(key) or "").strip()
    if not val:
        raise RuntimeError(
            f"{key} is not set — copy agent/.env.example to agent/.env and fill it in."
        )
    return val


@lru_cache(maxsize=1)
def get_llm():
    # If we have an Anthropic key, use Claude (more reliable for synthesis)
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        return ChatAnthropic(
            model="claude-haiku-4-5",
            api_key=anthropic_key,
            temperature=0.7,
        )
    
    # Fallback to Z.AI
    return ChatOpenAI(
        api_key=_require_env("ZAI_API_KEY"),
        model=os.getenv("ZAI_MODEL", "ilmu-glm-5.1").strip() or "ilmu-glm-5.1",
        base_url=os.getenv("ZAI_BASE_URL", "https://api.ilmu.ai/v1").strip()
        or "https://api.ilmu.ai/v1",
        temperature=0.7,
    )
