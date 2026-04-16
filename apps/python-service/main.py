import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest, CollectorRegistry

PORT = int(os.environ.get("PORT", "8000"))
REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
CACHE_TTL = int(os.environ.get("CACHE_TTL_SECONDS", "60"))

registry = CollectorRegistry()
cache_hits = Counter(
    "cache_hits_total",
    "Acertos de cache",
    ["route"],
    registry=registry,
)
cache_misses = Counter(
    "cache_misses_total",
    "Falhas de cache",
    ["route"],
    registry=registry,
)
http_requests = Counter(
    "http_requests_total",
    "Total de requisicoes HTTP",
    ["method", "route", "status"],
    registry=registry,
)

r: redis.Redis | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global r
    r = redis.from_url(REDIS_URL, decode_responses=True)
    yield
    if r:
        await r.aclose()


app = FastAPI(title="Desafio App Python", lifespan=lifespan)


async def get_cached(route_key: str, compute):
    assert r is not None
    key = f"app:python:{route_key}"
    hit = await r.get(key)
    if hit is not None:
        cache_hits.labels(route=route_key).inc()
        return hit
    cache_misses.labels(route=route_key).inc()
    if asyncio.iscoroutinefunction(compute):
        body = await compute()
    elif callable(compute):
        body = compute()
    else:
        body = compute
    await r.setex(key, CACHE_TTL, body)
    return body


@app.middleware("http")
async def metrics_middleware(request, call_next):
    response = await call_next(request)
    route = request.url.path
    http_requests.labels(
        method=request.method,
        route=route,
        status=str(response.status_code),
    ).inc()
    return response


@app.get("/fixed", response_class=PlainTextResponse)
async def fixed():
    body = await get_cached(
        "fixed",
        lambda: "ConquestOne — aplicação Python (texto fixo)",
    )
    return body


@app.get("/time", response_class=PlainTextResponse)
async def time_endpoint():
    async def compute():
        return datetime.now(timezone.utc).isoformat()

    body = await get_cached("time", compute)
    return body


@app.get("/health")
async def health():
    return {"status": "ok", "app": "python"}


@app.get("/metrics")
async def metrics():
    data = generate_latest(registry)
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
