import os
from supabase import create_client, Client

_SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL"
_SUPABASE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY"

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.getenv(_SUPABASE_URL_ENV)
        key = os.getenv(_SUPABASE_KEY_ENV)
        if not url or not key:
            raise RuntimeError(
                f"Missing Supabase credentials. Ensure {_SUPABASE_URL_ENV} and "
                f"{_SUPABASE_KEY_ENV} are set."
            )
        _client = create_client(url, key)
    return _client
