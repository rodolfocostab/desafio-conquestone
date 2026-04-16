import express from "express";
import Redis from "ioredis";
import client from "prom-client";

const PORT = Number(process.env.PORT || 3001);
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || 10);

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP",
  labelNames: ["method", "route", "status"],
  registers: [client.register],
});

const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Acertos de cache",
  labelNames: ["route"],
  registers: [client.register],
});

const cacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Falhas de cache",
  labelNames: ["route"],
  registers: [client.register],
});

const ROUTE_STYLE = `
:root{--bg:#0b1220;--card:#111827;--border:#1f2937;--text:#e5e7eb;--muted:#9ca3af;--accent:#34d399;--accent2:#a78bfa;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#134e4a 0%,var(--bg) 55%);color:var(--text);display:flex;align-items:center;justify-content:center;padding:1.5rem}
.wrap{width:100%;max-width:580px}
.card{background:linear-gradient(145deg,#0f172a,var(--card));border:1px solid var(--border);border-radius:16px;padding:1.5rem 1.35rem;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.badge{display:inline-block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);border:1px solid rgba(52,211,153,.35);padding:.2rem .55rem;border-radius:999px;margin-bottom:.75rem}
h1{font-size:1.05rem;font-weight:600;color:var(--muted);margin:0 0 .35rem}
.hl{font-family:var(--mono);font-size:clamp(1.15rem,4vw,1.85rem);font-weight:600;color:var(--accent);line-height:1.4;word-break:break-word;margin:.5rem 0 1rem}
.sub{font-size:.88rem;color:var(--muted);margin:0 0 .75rem;line-height:1.45}
.back{display:inline-block;margin-top:.85rem;font-size:.88rem;color:var(--accent2)}
a{color:var(--accent)}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--mono);font-size:.78rem;line-height:1.5;color:#d1d5db;background:#070c14;border:1px solid var(--border);border-radius:10px;padding:1rem}
.meta{font-size:.8rem;color:var(--muted);margin-top:.75rem}
`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function acceptsHtml(req) {
  return (req.headers.accept || "").includes("text/html");
}

function isPrometheusScrape(req) {
  return (req.headers["user-agent"] || "").toLowerCase().includes("prometheus");
}

function htmlShell({ badge, title, subtitle, bodyHtml, extraHead = "", footerNote = "" }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${extraHead}
<style>${ROUTE_STYLE}</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">${badge}</div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
      ${bodyHtml}
      ${footerNote ? `<p class="meta">${footerNote}</p>` : ""}
      <a class="back" href="/">← Início</a>
    </div>
  </div>
</body>
</html>`;
}

const app = express();

app.use((req, res, next) => {
  res.on("finish", () => {
    const route = req.path || "unknown";
    httpRequests.inc({
      method: req.method,
      route,
      status: String(res.statusCode),
    });
  });
  next();
});

async function getCached(routeKey, compute) {
  const key = `app:node:${routeKey}`;
  const hit = await redis.get(key);
  if (hit != null) {
    cacheHits.inc({ route: routeKey });
    return hit;
  }
  cacheMisses.inc({ route: routeKey });
  const body = await compute();
  await redis.setex(key, CACHE_TTL, body);
  return body;
}

app.get("/", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Node</title>
<style>
:root{--bg:#0b1220;--card:#111827;--border:#1f2937;--text:#e5e7eb;--muted:#9ca3af;--accent:#34d399;--accent2:#a78bfa}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#134e4a 0%,var(--bg) 55%);color:var(--text);display:flex;align-items:center;justify-content:center;padding:2rem}
.card{width:100%;max-width:520px;background:linear-gradient(145deg,#0f172a,var(--card));border:1px solid var(--border);border-radius:16px;padding:1.75rem 1.75rem 1.5rem;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.badge{display:inline-block;font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);border:1px solid rgba(52,211,153,.35);padding:.25rem .6rem;border-radius:999px;margin-bottom:.75rem}
h1{font-size:1.35rem;font-weight:650;margin:0 0 .5rem}
p.lead{color:var(--muted);margin:0 0 1.25rem;font-size:.95rem;line-height:1.55}
.links{display:grid;gap:.5rem}
a.row{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;padding:.65rem .85rem;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.02);color:var(--text);text-decoration:none;transition:border-color .15s,background .15s}
a.row:hover{border-color:rgba(52,211,153,.45);background:rgba(52,211,153,.06)}
a.row code{font-size:.9rem;color:var(--accent2)}
a.row span{font-size:.82rem;color:var(--muted)}
.footer{margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted)}
.footer a{color:var(--accent)}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">Node.js · Express</div>
    <h1>Desafio ConquestOne</h1>
    <p class="lead">Porta <strong>${PORT}</strong>. A raiz <code>/</code> é só esta página; as rotas do desafio estão abaixo.</p>
    <div class="links">
      <a class="row" href="/fixed"><code>/fixed</code><span>texto fixo · cache 10s</span></a>
      <a class="row" href="/time"><code>/time</code><span>horário · cache 10s</span></a>
      <a class="row" href="/health"><code>/health</code><span>health check</span></a>
      <a class="row" href="/metrics"><code>/metrics</code><span>Prometheus</span></a>
    </div>
    <div class="footer">Observabilidade local: <a href="http://localhost:9090" target="_blank" rel="noopener">Prometheus</a> · <a href="http://localhost:3002" target="_blank" rel="noopener">Grafana</a> (admin / admin). Dica: em <code>/time</code>, o valor repete até o TTL expirar.</div>
  </div>
</body>
</html>`;
  res.status(200).type("html").send(html);
});

app.get("/fixed", async (req, res, next) => {
  try {
    const body = await getCached("fixed", () =>
      Promise.resolve("ConquestOne — aplicação Node.js (texto fixo)")
    );
    if (acceptsHtml(req)) {
      const page = htmlShell({
        badge: "Node.js · Express",
        title: "texto fixo",
        subtitle: `Resposta em cache · TTL ${CACHE_TTL}s (mesmo texto até expirar).`,
        bodyHtml: `<div class="hl">${escapeHtml(body)}</div>`,
        footerNote: "Rota <code>/fixed</code> do desafio.",
      });
      return res.status(200).type("html").send(page);
    }
    res.type("text/plain; charset=utf-8").send(body);
  } catch (e) {
    next(e);
  }
});

app.get("/time", async (req, res, next) => {
  try {
    const body = await getCached("time", () =>
      Promise.resolve(new Date().toISOString())
    );
    if (acceptsHtml(req)) {
      const page = htmlShell({
        badge: "Node.js · Express",
        title: "horário do servidor",
        subtitle: `Cache ${CACHE_TTL}s · a página atualiza a cada 2s para você ver quando o valor muda (após o TTL).`,
        bodyHtml: `<div class="hl">${escapeHtml(body)}</div>`,
        footerNote: "Enquanto o cache vale, o horário mostrado é o mesmo. Depois do TTL, vem um novo instante.",
        extraHead: `<meta http-equiv="refresh" content="2">`,
      });
      return res.status(200).type("html").send(page);
    }
    res.type("text/plain; charset=utf-8").send(body);
  } catch (e) {
    next(e);
  }
});

app.get("/health", (req, res) => {
  const data = { status: "ok", app: "node" };
  if (acceptsHtml(req)) {
    const page = htmlShell({
      badge: "Node.js · Express",
      title: "health check",
      subtitle: "JSON abaixo para integrações; navegador mostra esta página.",
      bodyHtml: `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`,
      footerNote: "Rota <code>/health</code> (sem cache).",
    });
    return res.status(200).type("html").send(page);
  }
  res.json(data);
});

app.get("/metrics", async (req, res) => {
  const raw = await client.register.metrics();
  const ct = client.register.contentType;
  if (isPrometheusScrape(req) || !acceptsHtml(req)) {
    res.type(ct);
    return res.send(raw);
  }
  const text = typeof raw === "string" ? raw : String(raw);
  const page = htmlShell({
    badge: "Node.js · Express",
    title: "métricas Prometheus",
    subtitle: "Formato texto para o Prometheus; scrape no navegador é só para leitura.",
    bodyHtml: `<pre>${escapeHtml(text)}</pre>`,
    footerNote:
      "O scraper do Prometheus usa o mesmo caminho sem HTML; User-Agent contém “Prometheus”.",
  });
  res.status(200).type("html").send(page);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).type("text/plain").send("Erro interno");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Node app em http://0.0.0.0:${PORT} (cache TTL ${CACHE_TTL}s)`);
});
