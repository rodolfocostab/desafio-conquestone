# Teste técnico – Tarefas

> **Prazo:** envio até **sexta-feira, 17/04, às 11:00**.

---

## Criar duas aplicações

- Utilize **linguagens diferentes**.
- Cada aplicação deve ter **duas rotas**:
  - Uma retornando um **texto fixo**.
  - Outra retornando o **horário atual do servidor**.

## Camada de cache

As respostas das aplicações devem ser cacheadas com **tempos de expiração diferentes**:

| Aplicação | Tempo de cache |
|-----------|------------------|
| Primeira  | 10 segundos      |
| Segunda   | 1 minuto         |

## Facilitar a execução

1. A infraestrutura deve ser fácil de iniciar e rodar com o **menor número de comandos possível**.
2. Implementar **observabilidade**, se possível.

## Desenhar e analisar a infraestrutura

- Criar um **diagrama** representando a arquitetura.
- **Identificar e sugerir** pontos de melhoria.

### Atualizações

- No desenho, mostrar como seria o **fluxo de atualização** de cada componente da infra e do código.
- Identificar e sugerir pontos de melhoria.

## Entrega esperada

- Código-fonte das aplicações e sua respectiva infra.
- Configuração da camada de cache.
- Infraestrutura automatizada para fácil execução.
- Diagrama da infraestrutura com análise e sugestões de melhoria.
- Manter boas práticas e organização no Git.

## Como entregar

Todo o conteúdo gerado no teste deve estar em um **repositório** de uma ferramenta de versionamento de código, **acessível para avaliação**.

---

## Implementação entregue neste repositório

**Pré-requisitos:** [Docker](https://docs.docker.com/get-docker/) com **Docker Compose v2** (no Windows, normalmente via Docker Desktop).

### Estrutura principal

| Caminho | Conteúdo |
|--------|-----------|
| `apps/node-service/` | API Node.js (Express), cache 10 s |
| `apps/python-service/` | API Python (FastAPI), cache 60 s |
| `docker-compose.yml` | Redis, apps, Prometheus, Grafana |
| `infra/prometheus/` | Configuração de scrape |
| `infra/grafana/` | Datasource + dashboard provisionados |
| `docs/` | Arquitetura (Markdown + imagens de diagrama, se versionadas) |

### Executar (um comando)

Na raiz do projeto:

```bash
docker compose up --build -d
```

Com o Docker em execução, isso sobe **Redis**, as duas aplicações, **Prometheus** e **Grafana** (dashboard de exemplo).

Para encerrar os containers: `docker compose down`.

Atalho opcional (Linux/macOS/Git Bash): `make up` (equivale ao `docker compose up --build -d`).

### Endpoints

| Serviço      | URL base           | Rotas do desafio | Observabilidade |
|-------------|--------------------|------------------|-----------------|
| App Node.js | http://localhost:3000 | `GET /fixed`, `GET /time` | `GET /metrics`, `GET /health` |
| App Python  | http://localhost:8000 | `GET /fixed`, `GET /time` | `GET /metrics`, `GET /health`, `GET /docs` (Swagger) |
| Prometheus  | http://localhost:9090 | — | UI de consultas e targets |
| Grafana      | http://localhost:3002 | — | ver login abaixo · dashboard **Desafio — APIs e cache** |

**Grafana — usuário e senha:** `admin` / `admin` (definidos no `docker-compose`; só para ambiente local).

Cache implementado com **Redis** (`SETEX` com TTL distinto por app via `CACHE_TTL_SECONDS`).

**Navegador vs. API:** nas rotas `/fixed`, `/time`, `/health` e `/metrics`, o **navegador** recebe páginas HTML legíveis quando o `Accept` inclui `text/html`. **Prometheus** continua fazendo scrape em texto em `/metrics` (User-Agent `Prometheus`). `curl` sem `Accept: text/html` costuma receber texto/JSON puro.

### Qualidade / CI

No GitHub, o workflow **Build Docker** (`.github/workflows/docker-build.yml`) roda `docker compose build` em cada push/PR para `main`/`master`, ajudando a garantir que as imagens continuam buildando.

### Diagrama e análise

- Documento principal: [docs/arquitetura.md](docs/arquitetura.md) — diagramas em Mermaid, fluxos de atualização e sugestões de melhoria.
- **Imagens (opcional):** se estiverem versionadas em `docs/`, complementam o texto: `arquitetura-runtime.png`, `arquitetura-git.png`, `arquitetura-infra.png` (nomes sugeridos; ajuste se os seus forem outros).
