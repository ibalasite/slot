# LOCAL_DEPLOY — Local Development Environment Setup Guide
# Thunder Blessing Slot Game

---

## §1 Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | LOCAL_DEPLOY-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Date** | 2026-04-26 |
| **Scope** | Local development environment setup only — not for production |
| **Upstream** | EDD v1.3, ARCH v1.7, API v1.0, SCHEMA v1.0, runbook v1.0 |

---

## §2 Prerequisites

### Runtime and Language

| Tool | Required Version | Notes |
|------|-----------------|-------|
| Node.js | **20 LTS** | Use `nvm` or `fnm` to manage versions |
| npm | 10+ | Ships with Node.js 20 |
| TypeScript | 5.4+ | Installed as a project dev dependency |

Verify your Node.js version:

```bash
node --version
# Expected: v20.x.x
```

### Docker

| Tool | Required Version | Notes |
|------|-----------------|-------|
| Docker | 24+ | Docker Desktop on macOS; Docker Engine on Linux |
| Docker Compose | v2.x (plugin) | Bundled with Docker Desktop; `docker compose` (no hyphen) |

Verify Docker is running:

```bash
docker --version
# Expected: Docker version 24.x.x or later

docker compose version
# Expected: Docker Compose version v2.x.x
```

### CLI Tools

| Tool | Purpose | Install |
|------|---------|---------|
| `git` | Source control | System package manager |
| `psql` | PostgreSQL verification queries | `brew install libpq` (macOS) or `apt install postgresql-client` (Linux) |
| `redis-cli` | Redis connectivity checks | `brew install redis` (macOS) or `apt install redis-tools` (Linux) |
| `curl` | Smoke testing endpoints | Pre-installed on macOS and most Linux distros |

### OS Compatibility

- **macOS** (Ventura 13+) and **Linux** (Ubuntu 22.04+, Debian 12+): primary supported environments.
- **Windows**: use WSL2 (Ubuntu 22.04 image recommended). All commands in this guide run inside the WSL2 shell. Docker Desktop for Windows with WSL2 backend is required.

---

## §3 Repository Setup

### Clone and Enter the Repository

```bash
git clone <repo-url> thunder-blessing-slot
cd thunder-blessing-slot
```

### Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in all values. The table below documents every required variable.

**.env.example — complete template:**

```dotenv
# ─────────────────────────────────────────────────────────────────────────────
# APPLICATION
# ─────────────────────────────────────────────────────────────────────────────

# Node environment. Use "development" locally.
NODE_ENV=development

# HTTP port the Fastify server listens on.
PORT=3000

# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE (PostgreSQL + Auth)
# ─────────────────────────────────────────────────────────────────────────────

# Public Supabase project URL.
# Locally: http://localhost:54321 (Supabase CLI local stack)
# Cloud dev: https://<project-ref>.supabase.co
SUPABASE_URL=http://localhost:54321

# Supabase service role key — bypasses Row Level Security.
# Locally: printed by `supabase start` as "service_role key".
# Never commit this value. Never expose to the browser.
SUPABASE_SERVICE_KEY=<YOUR_SUPABASE_SERVICE_KEY_HERE>

# RS256 public key used by JwtAuthGuard to verify player JWTs issued by Supabase Auth.
# Locally: printed by `supabase start` as "JWT secret" (for local stack it may be the
# HS256 secret — replace with RS256 public key for production-parity local testing).
SUPABASE_JWT_SECRET=<YOUR_SUPABASE_JWT_SECRET_HERE>

# ─────────────────────────────────────────────────────────────────────────────
# POSTGRESQL (direct connection — used by migrations and SupabaseWalletRepository)
# ─────────────────────────────────────────────────────────────────────────────

# PostgreSQL connection string.
# Locally via docker-compose: postgresql://postgres:postgres@localhost:5432/thunder_blessing
# Via Supabase CLI local stack: postgresql://postgres:postgres@localhost:54322/postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/thunder_blessing

# ─────────────────────────────────────────────────────────────────────────────
# REDIS
# ─────────────────────────────────────────────────────────────────────────────

# Redis connection string — used for FG session state, concurrency locks, rate limiting.
# Locally via docker-compose: redis://localhost:6379
# Upstash cloud: rediss://<token>@<host>:<port>
REDIS_URL=redis://localhost:6379

# ─────────────────────────────────────────────────────────────────────────────
# OBSERVABILITY (optional for local development)
# ─────────────────────────────────────────────────────────────────────────────

# OpenTelemetry sampler. Leave as-is for local development.
OTEL_TRACES_SAMPLER=parentbased_traceidratio

# Sampling ratio (5% for normal traffic in production; set to 1.0 for local tracing).
OTEL_TRACES_SAMPLER_ARG=1.0

# ─────────────────────────────────────────────────────────────────────────────
# RATE LIMITING
# ─────────────────────────────────────────────────────────────────────────────

# Max consecutive auth failures per IP in 60s before IP-level rate limiting applies.
RATE_LIMIT_AUTH_FAIL_MAX=10

# ─────────────────────────────────────────────────────────────────────────────
# CORS (development)
# ─────────────────────────────────────────────────────────────────────────────

# Comma-separated list of allowed origins. Use * for local development only.
CORS_ALLOWED_ORIGINS=*
```

---

## §4 Infrastructure Setup (Docker Compose)

The following `docker-compose.yml` starts PostgreSQL 15 and Redis 7 — the two infrastructure dependencies required to run the application locally. pgAdmin is included as an optional DB inspection tool.

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    container_name: thunder-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: thunder_blessing
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d thunder_blessing"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: thunder-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: thunder-pgadmin
    restart: unless-stopped
    profiles: ["tools"]   # only starts with: docker compose --profile tools up
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@local.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pgadmin-data:/var/lib/pgadmin
    healthcheck:
      test: ["CMD", "wget", "-O", "-", "http://localhost:80/misc/ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres-data:
  redis-data:
  pgadmin-data:
```

### Start Infrastructure

```bash
# Start PostgreSQL and Redis (detached):
docker compose up -d postgres redis

# Wait for both health checks to pass:
docker compose ps
# Expected: postgres and redis show "healthy" status

# Optional — also start pgAdmin for DB inspection:
docker compose --profile tools up -d
# Access pgAdmin at: http://localhost:5050
```

### Stop Infrastructure

```bash
docker compose down
```

---

## §5 Database Setup

### Run Migrations

Apply all schema migrations to the local PostgreSQL instance:

```bash
npm run db:migrate
```

If the project uses Supabase CLI migrations directly:

```bash
supabase db push --db-url postgresql://postgres:postgres@localhost:5432/thunder_blessing
```

### Seed Data

Seed game configuration and a test player account:

```bash
npm run db:seed
```

This inserts:
- A test player row in `players` with a starting balance.
- An initial row in `game_config_versions` reflecting the current `GameConfig.generated.ts`.

### Verify Tables Exist

Connect to PostgreSQL and confirm all required tables are present:

```bash
psql "postgresql://postgres:postgres@localhost:5432/thunder_blessing" \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

Expected output — all five tables must be listed:

```
      tablename
─────────────────────────
 fg_sessions
 game_config_versions
 players
 spins
 wallet_transactions
(5 rows)
```

Verify the `players` table has at least one seeded row:

```sql
SELECT id, email, balance, currency FROM players LIMIT 1;
```

---

## §6 Application Startup

### Install Dependencies

```bash
npm install
```

### Validate Environment

Before starting, confirm all required env vars are present:

```bash
node -e "
  const required = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_JWT_SECRET',
    'DATABASE_URL', 'REDIS_URL', 'NODE_ENV'
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Missing env vars:', missing.join(', '));
    process.exit(1);
  }
  console.log('All required env vars are set.');
"
```

### Start the Application

```bash
npm run dev
```

In production-parity mode (compiled output):

```bash
npm run build && npm start
```

Successful startup logs include:

```json
{"level":"info","service":"thunder-blessing-api","event":"server.started","port":3000}
{"level":"info","service":"thunder-blessing-api","event":"config.validated","engineVersion":"1.0.0"}
```

### Verify Startup

```bash
curl -s http://localhost:3000/health
```

Expected response (HTTP 200):

```json
{"status":"ok"}
```

Readiness probe (checks DB and Redis connectivity):

```bash
curl -s http://localhost:3000/ready
```

Expected response (HTTP 200):

```json
{"status":"ok"}
```

---

## §7 Running Tests

### Unit Tests

Runs domain engine, use-case, and utility tests in isolation (no external dependencies):

```bash
npm run test:unit
```

Uses Vitest. Target: ≥ 80% coverage.

### Integration Tests

Requires PostgreSQL and Redis to be running (docker compose up):

```bash
npm run test:integration
```

Uses Supertest against a real Fastify instance with live DB and Redis.

### E2E / BDD Tests

End-to-end tests covering the full spin flow against the running local server:

```bash
npm run test:e2e
```

### All Tests with Coverage Report

```bash
npm test
```

Coverage summary is printed to stdout. The CI gate requires ≥ 80%.

---

## §8 Local Smoke Test

All smoke test commands below assume the server is running on `localhost:3000` and that you have a valid local JWT. For local development without a real Supabase Auth instance, use the seeded test token (set by `npm run db:seed`, printed to stdout).

Set the token in your shell:

```bash
export LOCAL_JWT="<token-printed-by-db-seed>"
export PLAYER_ID="<player-uuid-printed-by-db-seed>"
```

### GET /health

```bash
curl -s http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

### GET /v1/config

```bash
curl -s http://localhost:3000/v1/config \
  -H "Authorization: Bearer $LOCAL_JWT"
```

Expected (HTTP 200 — abridged):

```json
{
  "success": true,
  "data": {
    "engineVersion": "1.0.0",
    "betRange": {
      "USD": {
        "minBetLevel": 1,
        "maxBetLevel": 20,
        "levels": [
          { "level": 1, "baseBet": 0.10, "extraBetCost": 0.30, "buyFeatureCost": 10.00 },
          { "level": 5, "baseBet": 0.50, "extraBetCost": 1.50, "buyFeatureCost": 50.00 },
          "..."
        ]
      },
      "TWD": {
        "minBetLevel": 1,
        "maxBetLevel": 320,
        "levels": [
          { "level": 1, "baseBet": 3, "extraBetCost": 9, "buyFeatureCost": 300 },
          { "level": 10, "baseBet": 30, "extraBetCost": 90, "buyFeatureCost": 3000 },
          "..."
        ]
      }
    }
  }
}
```

### POST /v1/spin — Base Spin

```bash
curl -s -X POST http://localhost:3000/v1/spin \
  -H "Authorization: Bearer $LOCAL_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"playerId\": \"$PLAYER_ID\",
    \"betLevel\": 5,
    \"currency\": \"USD\",
    \"extraBet\": false,
    \"buyFeature\": false
  }"
```

Expected (HTTP 200 — key fields):

```json
{
  "success": true,
  "data": {
    "spinId": "spin-...",
    "sessionId": "sess-...",
    "betLevel": 5,
    "baseBet": 0.50,
    "totalBet": 0.50,
    "totalWin": 0,
    "newBalance": 249.50,
    "currency": "USD",
    "fgTriggered": false,
    "cascadeSequence": { "steps": [], "totalWin": 0 }
  }
}
```

### POST /v1/spin — Extra Bet

```bash
curl -s -X POST http://localhost:3000/v1/spin \
  -H "Authorization: Bearer $LOCAL_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"playerId\": \"$PLAYER_ID\",
    \"betLevel\": 5,
    \"currency\": \"USD\",
    \"extraBet\": true,
    \"buyFeature\": false
  }"
```

Expected: `totalBet` is `1.50` (baseBet `0.50` × 3). A Scatter symbol (`"SC"`) appears in `initialGrid`.

---

## §9 Troubleshooting

### Port Already In Use

**Symptom:** `Error: listen EADDRINUSE 0.0.0.0:3000` or Docker fails to bind port 5432 / 6379.

**Fix:**

```bash
# Find and kill the process using the port (example for port 3000):
lsof -ti :3000 | xargs kill -9

# For Docker port conflicts, stop any competing containers:
docker ps --filter publish=5432
docker stop <container-id>
```

### DB Connection Refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:5432` at startup or during tests.

**Cause:** PostgreSQL container is not running or health check has not passed.

**Fix:**

```bash
docker compose up -d postgres
docker compose ps postgres   # wait for "healthy"
```

### JWT Verification Fails

**Symptom:** All `/v1/*` requests return `401 UNAUTHORIZED` with `code: "UNAUTHORIZED"`.

**Cause:** `SUPABASE_JWT_SECRET` in `.env` does not match the key used to sign the token, or the token has expired.

**Fix:**

1. Re-run `npm run db:seed` to regenerate a fresh test token.
2. Verify `SUPABASE_JWT_SECRET` matches the value printed by `supabase start` (or your local Supabase config).
3. Check the token expiry: `node -e "const [,p]=process.argv[2].split('.'); console.log(JSON.parse(Buffer.from(p,'base64url').toString()))" -- <token>` — look at the `exp` field.

### Redis ECONNREFUSED

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:6379` in logs; `/ready` returns non-200.

**Cause:** Redis container is not running.

**Fix:**

```bash
docker compose up -d redis
docker compose ps redis   # wait for "healthy"

# Verify connectivity manually:
redis-cli -h localhost -p 6379 ping
# Expected: PONG
```

### "Invalid Bet Level" on Smoke Test

**Symptom:** `POST /v1/spin` returns `400 INVALID_BET_LEVEL`.

**Cause:** `BetRangeConfig.generated.ts` is not present, or `npm run db:seed` has not been run to load game config.

**Fix:**

```bash
# Regenerate config files from toolchain (if Thunder_Config.xlsx is available):
node tools/build_config.js
node tools/excel_simulator.js
node tools/verify.js       # must print PASS for all 4 scenarios
node tools/engine_generator.js

# Re-seed:
npm run db:seed
```

### "Spin In Progress" (409) on Repeated Requests

**Symptom:** `POST /v1/spin` returns `409 SPIN_IN_PROGRESS`.

**Cause:** A previous spin request left a Redis concurrency lock (`session:{sessionId}:lock`) that has not yet expired. Lock TTL is 10 seconds.

**Fix:** Wait 10 seconds and retry. To manually clear a stuck lock in local development:

```bash
redis-cli -h localhost -p 6379 DEL "session:<sessionId>:lock"
```

---

## §10 Reset / Clean State

Use this procedure to wipe all local state and start fresh.

### Full Reset

```bash
# 1. Stop containers and remove all volumes (drops PostgreSQL data and Redis data):
docker compose down -v

# 2. Restart infrastructure:
docker compose up -d postgres redis

# 3. Wait for healthy status:
docker compose ps

# 4. Re-apply migrations:
npm run db:migrate

# 5. Re-seed data:
npm run db:seed
```

### Redis Only Reset

Clear all Redis keys without touching PostgreSQL:

```bash
redis-cli -h localhost -p 6379 FLUSHDB
```

### PostgreSQL Only Reset

Drop and recreate the database schema without removing the Docker volume:

```bash
psql "postgresql://postgres:postgres@localhost:5432/thunder_blessing" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
npm run db:seed
```

---

## §11 Reference

### Key Ports Summary

| Service | Host Port | Container Port | Notes |
|---------|-----------|---------------|-------|
| Fastify API | 3000 | 3000 | `npm run dev` |
| PostgreSQL | 5432 | 5432 | docker-compose `postgres` service |
| Redis | 6379 | 6379 | docker-compose `redis` service |
| pgAdmin | 5050 | 80 | `--profile tools` only |

### Useful Commands at a Glance

```bash
# View live application logs:
npm run dev

# View docker-compose service logs:
docker compose logs -f postgres
docker compose logs -f redis

# Run only unit tests:
npm run test:unit

# Run only integration tests (requires Docker services):
npm run test:integration

# Full test suite with coverage:
npm test

# Rebuild generated config (requires Thunder_Config.xlsx):
node tools/build_config.js && \
  node tools/excel_simulator.js && \
  node tools/verify.js && \
  node tools/engine_generator.js
```

### Environment Variable Quick Reference

| Variable | Local Default | Purpose |
|----------|--------------|---------|
| `NODE_ENV` | `development` | Runtime mode |
| `PORT` | `3000` | HTTP listen port |
| `SUPABASE_URL` | `http://localhost:54321` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | `<from supabase start>` | Service role key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | `<from supabase start>` | RS256 public key for JWT verification |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/thunder_blessing` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
