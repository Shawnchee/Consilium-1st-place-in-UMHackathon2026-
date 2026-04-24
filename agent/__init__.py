"""Package init.

On Windows, Python's default asyncio loop is `ProactorEventLoop`, but
psycopg async (used by AsyncPostgresStore) only supports `SelectorEventLoop`.
Setting the policy here means every caller of `agent.*` gets the right
loop automatically — no change needed in run_local.py or inline snippets.
"""
from __future__ import annotations

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
