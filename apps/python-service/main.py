import asyncio
import html
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis.asyncio as redis
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
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

_INDEX_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Python</title>
<style>
:root{--bg:#0b1220;--card:#111827;--border:#1f2937;--text:#e5e7eb;--muted:#9ca3af;--accent:#22d3ee;--accent2:#a78bfa}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(1200px 600px at 20% -10%,#1e3a5f 0%,var(--bg) 55%);color:var(--text);display:flex;align-items:center;justify-content:center;padding:2rem}
.card{width:100%;max-width:520px;background:linear-gradient(145deg,#0f172a,var(--card));border:1px solid var(--border);border-radius:16px;padding:1.75rem 1.75rem 1.5rem;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.badge{display:inline-block;font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);border:1px solid rgba(34,211,238,.35);padding:.25rem .6rem;border-radius:999px;margin-bottom:.75rem}
h1{font-size:1.35rem;font-weight:650;margin:0 0 .5rem}
p.lead{color:var(--muted);margin:0 0 1.25rem;font-size:.95rem;line-height:1.55}
.links{display:grid;gap:.5rem}
a.row{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;padding:.65rem .85rem;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.02);color:var(--text);text-decoration:none;transition:border-color .15s,background .15s}
a.row:hover{border-color:rgba(34,211,238,.45);background:rgba(34,211,238,.06)}
a.row code{font-size:.9rem;color:var(--accent2)}
a.row span{font-size:.82rem;color:var(--muted)}
.footer{margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted)}
.footer a{color:var(--accent)}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">Python · FastAPI</div>
    <h1>Desafio ConquestOne</h1>
    <p class="lead">Porta <strong>__PORT__</strong>. A raiz <code>/</code> é só esta página; as rotas do desafio estão abaixo. Documentação interativa: <a href="/docs">/docs</a> (Swagger).</p>
    <div class="links">
      <a class="row" href="/fixed"><code>/fixed</code><span>texto fixo · cache 60s</span></a>
      <a class="row" href="/time"><code>/time</code><span>horário · cache 60s</span></a>
      <a class="row" href="/health"><code>/health</code><span>health check</span></a>
      <a class="row" href="/metrics"><code>/metrics</code><span>Prometheus</span></a>
      <a class="row" href="/docs"><code>/docs</code><span>Swagger UI</span></a>
    </div>
    <div class="footer">Observabilidade local: <a href="http://localhost:9090" target="_blank" rel="noopener">Prometheus</a> · <a href="http://localhost:3002" target="_blank" rel="noopener">Grafana</a> (admin / admin). Dica: em <code>/time</code>, o valor repete até o TTL expirar.</div>
  </div>
</body>
</html>"""

_ROUTE_STYLE = """
:root{--bg:#0b1220;--card:#111827;--border:#1f2937;--text:#e5e7eb;--muted:#9ca3af;--accent:#22d3ee;--accent2:#a78bfa;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(1200px 600px at 20% -10%,#1e3a5f 0%,var(--bg) 55%);color:var(--text);display:flex;align-items:center;justify-content:center;padding:1.5rem}
.wrap{width:100%;max-width:580px}
.card{background:linear-gradient(145deg,#0f172a,var(--card));border:1px solid var(--border);border-radius:16px;padding:1.5rem 1.35rem;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.badge{display:inline-block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);border:1px solid rgba(34,211,238,.35);padding:.2rem .55rem;border-radius:999px;margin-bottom:.75rem}
h1{font-size:1.05rem;font-weight:600;color:var(--muted);margin:0 0 .35rem}
.hl{font-family:var(--mono);font-size:clamp(1.15rem,4vw,1.85rem);font-weight:600;color:var(--accent);line-height:1.4;word-break:break-word;margin:.5rem 0 1rem}
.sub{font-size:.88rem;color:var(--muted);margin:0 0 .75rem;line-height:1.45}
.back{display:inline-block;margin-top:.85rem;font-size:.88rem;color:var(--accent2)}
a{color:var(--accent)}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--mono);font-size:.78rem;line-height:1.5;color:#d1d5db;background:#070c14;border:1px solid var(--border);border-radius:10px;padding:1rem}
.meta{font-size:.8rem;color:var(--muted);margin-top:.75rem}
"""


def _wants_html(request: Request) -> bool:
    return "text/html" in (request.headers.get("accept") or "").lower()


def _is_prometheus_scrape(request: Request) -> bool:
    return "prometheus" in (request.headers.get("user-agent") or "").lower()


def _route_shell(
    title: str,
    badge: str,
    subtitle: str,
    body_inner: str,
    footer_note: str = "",
    extra_head: str = "",
) -> str:
    foot = f'<p class="meta">{footer_note}</p>' if footer_note else ""
    sub = f'<p class="sub">{subtitle}</p>' if subtitle else ""
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{extra_head}
<title>{html.escape(title)}</title>
<style>{_ROUTE_STYLE}</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">{html.escape(badge)}</div>
      <h1>{html.escape(title)}</h1>
      {sub}
      {body_inner}
      {foot}
      <a class="back" href="/">← Início</a>
    </div>
  </div>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return _INDEX_HTML.replace("__PORT__", str(PORT))


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


@app.get("/fixed")
async def fixed(request: Request):
    body = await get_cached(
        "fixed",
        lambda: "ConquestOne — aplicação Python (texto fixo)",
    )
    if _wants_html(request):
        page = _route_shell(
            title="texto fixo",
            badge="Python · FastAPI",
            subtitle=f"Resposta em cache · TTL {CACHE_TTL}s (mesmo texto até expirar).",
            body_inner=f'<div class="hl">{html.escape(body)}</div>',
            footer_note="Rota <code>/fixed</code> do desafio.",
        )
        return HTMLResponse(page)
    return PlainTextResponse(body)


@app.get("/time")
async def time_endpoint(request: Request):
    async def compute():
        return datetime.now(timezone.utc).isoformat()

    body = await get_cached("time", compute)
    if _wants_html(request):
        page = _route_shell(
            title="horário do servidor",
            badge="Python · FastAPI",
            subtitle=f"Cache {CACHE_TTL}s · a página atualiza a cada 2s para você ver quando o valor muda (após o TTL).",
            body_inner=f'<div class="hl">{html.escape(body)}</div>',
            footer_note="Enquanto o cache vale, o horário mostrado é o mesmo. Depois do TTL, vem um novo instante.",
            extra_head='<meta http-equiv="refresh" content="2">',
        )
        return HTMLResponse(page)
    return PlainTextResponse(body)


@app.get("/health")
async def health(request: Request):
    data = {"status": "ok", "app": "python"}
    if _wants_html(request):
        raw = html.escape(json.dumps(data, ensure_ascii=False, indent=2))
        page = _route_shell(
            title="health check",
            badge="Python · FastAPI",
            subtitle="JSON abaixo para integrações; navegador mostra esta página.",
            body_inner=f"<pre>{raw}</pre>",
            footer_note="Rota <code>/health</code> (sem cache).",
        )
        return HTMLResponse(page)
    return data


@app.get("/metrics")
async def metrics(request: Request):
    data = generate_latest(registry)
    if _is_prometheus_scrape(request) or not _wants_html(request):
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)
    text = data.decode("utf-8", errors="replace")
    raw = html.escape(text)
    page = _route_shell(
        title="métricas Prometheus",
        badge="Python · FastAPI",
        subtitle="Formato texto para o Prometheus; scrape no navegador é só para leitura.",
        body_inner=f"<pre>{raw}</pre>",
        footer_note='O scraper do Prometheus usa o mesmo caminho sem HTML; User-Agent contém "Prometheus".',
    )
    return HTMLResponse(page)
