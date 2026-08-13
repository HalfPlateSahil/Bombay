"""
Yatri Railways Live GPS Service
================================
Fetches real-time GPS coordinates for Mumbai local trains from the
reverse-engineered Yatri Railways API. Includes TTL-based caching,
batch requests, and structured diagnostics.
"""

import time
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# ── In-Memory Cache ─────────────────────────────────────────────────────────
_cache: Dict[str, Any] = {
    "data": {},           # train_number -> location dict
    "fetched_at": 0.0,    # timestamp of last successful fetch
    "train_numbers_queried": [],
}

# ── Diagnostics ─────────────────────────────────────────────────────────────
_diagnostics: Dict[str, Any] = {
    "last_success_at": None,
    "last_error_at": None,
    "last_error_message": None,
    "total_api_calls": 0,
    "total_successes": 0,
    "total_errors": 0,
    "total_trains_with_gps": 0,
    "total_trains_queried": 0,
    "last_latency_ms": 0,
    "cache_hits": 0,
    "cache_misses": 0,
}

# Shared httpx async client (connection pooling)
_client: Optional[httpx.AsyncClient] = None

def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_connections=5)
        )
    return _client


def get_yatri_diagnostics() -> Dict[str, Any]:
    """Return current diagnostics for the Yatri service."""
    return {
        **_diagnostics,
        "cache_age_seconds": round(time.time() - _cache["fetched_at"], 1) if _cache["fetched_at"] > 0 else None,
        "cached_trains": len(_cache["data"]),
        "enabled": settings.YATRI_ENABLED,
        "cache_ttl": settings.YATRI_CACHE_TTL_SECONDS,
    }


async def _fetch_batch(client: httpx.AsyncClient, train_numbers: List[str]) -> Dict[str, Dict]:
    """
    POST a batch of train numbers to the Yatri API.
    Returns a dict of train_number -> location data.
    """
    headers = {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "version-code": "1013",
        "device-type": "android",
        "request-source": "mobile",
        "app-type": "yatri",
        "api-key": settings.YATRI_API_KEY,
    }

    url = f"{settings.YATRI_API_BASE_URL}/live-locations"
    payload = {"train_numbers": train_numbers}

    response = await client.post(url, json=payload, headers=headers)
    response.raise_for_status()

    body = response.json()

    if body.get("status") not in (0, 1):
        logger.warning(f"[Yatri] Unexpected status: {body.get('status')} — {body.get('message')}")
        return {}

    result = {}
    for loc in body.get("live_locations", []):
        # The API returns `local_train_number` for the train number
        train_num = loc.get("local_train_number") or loc.get("train_number")
        if train_num:
            result[str(train_num)] = {
                "latitude": float(loc.get("latitude", 0)),
                "longitude": float(loc.get("longitude", 0)),
                "time": loc.get("time", ""),
                "train_status": loc.get("train_status", -1),
                "nearest_station_id": loc.get("nearest_station_id", ""),
                "nearest_station_position": loc.get("nearest_station_position", 0),
                "train_accuracy_status": loc.get("train_accuracy_status", -1),
                "nearest_station_position_feedback": loc.get("nearest_station_position_feedback", ""),
                "train_status_feedback": loc.get("train_status_feedback", ""),
                "train_live_status": loc.get("train_live_status", ""),
            }

    return result


async def fetch_live_locations(train_numbers: List[str]) -> Dict[str, Dict]:
    """
    Fetch live GPS locations for the given train numbers.
    Uses a TTL cache to avoid redundant API calls.
    Returns a dict mapping train_number -> location data.
    """
    global _cache, _diagnostics

    if not settings.YATRI_ENABLED or not train_numbers:
        return {}

    # ── Cache check ──────────────────────────────────────────────────────
    cache_age = time.time() - _cache["fetched_at"]
    if cache_age < settings.YATRI_CACHE_TTL_SECONDS and _cache["data"]:
        _diagnostics["cache_hits"] += 1
        # Return cached data filtered to requested train numbers
        return {k: v for k, v in _cache["data"].items() if k in train_numbers}

    _diagnostics["cache_misses"] += 1

    # ── Batch fetch ──────────────────────────────────────────────────────
    client = _get_client()
    batch_size = settings.YATRI_BATCH_SIZE
    all_results: Dict[str, Dict] = {}

    t0 = time.time()

    try:
        # Split into batches
        batches = [train_numbers[i:i + batch_size] for i in range(0, len(train_numbers), batch_size)]

        # Execute batches concurrently (max 3 concurrent to be respectful)
        semaphore = asyncio.Semaphore(3)

        async def fetch_with_semaphore(batch):
            async with semaphore:
                return await _fetch_batch(client, batch)

        tasks = [fetch_with_semaphore(batch) for batch in batches]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if isinstance(r, Exception):
                logger.error(f"[Yatri] Batch error: {r}")
                _diagnostics["total_errors"] += 1
            elif isinstance(r, dict):
                all_results.update(r)

        latency_ms = round((time.time() - t0) * 1000)

        # Update cache
        _cache["data"] = all_results
        _cache["fetched_at"] = time.time()
        _cache["train_numbers_queried"] = train_numbers

        # Update diagnostics
        _diagnostics["total_api_calls"] += len(batches)
        _diagnostics["total_successes"] += 1
        _diagnostics["total_trains_with_gps"] = len(all_results)
        _diagnostics["total_trains_queried"] = len(train_numbers)
        _diagnostics["last_latency_ms"] = latency_ms
        _diagnostics["last_success_at"] = datetime.utcnow().isoformat()

        gps_count = len(all_results)
        total_count = len(train_numbers)
        logger.info(
            f"[Yatri] ✅ GPS data for {gps_count}/{total_count} trains "
            f"({len(batches)} batch{'es' if len(batches) > 1 else ''}, {latency_ms}ms)"
        )

    except Exception as e:
        latency_ms = round((time.time() - t0) * 1000)
        _diagnostics["total_errors"] += 1
        _diagnostics["last_error_at"] = datetime.utcnow().isoformat()
        _diagnostics["last_error_message"] = str(e)
        _diagnostics["last_latency_ms"] = latency_ms
        logger.error(f"[Yatri] ❌ API error ({latency_ms}ms): {e}")

    return all_results
