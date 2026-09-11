"""NASA FIRMS API proxy router.

Enables browser clients to fetch NASA FIRMS satellite CSV datasets without
violating cross-origin resource sharing (CORS) policies.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Response

router = APIRouter(prefix="/api/firms", tags=["firms"])

FIRMS_UPSTREAM_BASE = "https://firms.modaps.eosdis.nasa.gov/api"


@router.get("/{path:path}")
async def proxy_firms(path: str) -> Response:
    """Proxy requests to NASA FIRMS API and return CSV content with CORS headers."""
    target_url = f"{FIRMS_UPSTREAM_BASE}/{path}"
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.get(target_url)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "text/csv"),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with NASA FIRMS: {exc}",
        ) from exc
