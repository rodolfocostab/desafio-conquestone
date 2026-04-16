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

app.get("/fixed", async (req, res, next) => {
  try {
    const body = await getCached("fixed", () =>
      Promise.resolve("ConquestOne — aplicação Node.js (texto fixo)")
    );
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
    res.type("text/plain; charset=utf-8").send(body);
  } catch (e) {
    next(e);
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: "node" });
});

app.get("/metrics", async (_req, res) => {
  res.type(client.register.contentType);
  res.send(await client.register.metrics());
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).type("text/plain").send("Erro interno");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Node app em http://0.0.0.0:${PORT} (cache TTL ${CACHE_TTL}s)`);
});
