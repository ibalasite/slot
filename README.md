<!--
  DOC-ID:  README-thunder-blessing-slot-gdd-20260427
  Version: v2.0
  Status:  DRAFT
  Author:  AI Generated (gendoc readme)
  Date:    2026-04-27
  Upstream docs:
    - IDEA: docs/IDEA.md
    - BRD:  docs/BRD.md  (Business Requirements Document)
    - PRD:  docs/PRD.md  (Product Requirements Document)
    - PDD:  docs/PDD.md  (Product Design Document)
    - EDD:  docs/EDD.md  (Engineering Design Document)
    - ARCH: docs/ARCH.md (Architecture Design)
    - API:  docs/API.md  (REST API Specification)
  Change log:
    v1.0  2026-04-26  AI Generated  Initial generated draft
    v2.0  2026-04-27  AI Generated  Full regeneration with Interactive Prototype + API Explorer links
-->

# Thunder Blessing Slot Game — GDD & Technical Documentation

> A Greek-mythology-themed, high-volatility online slot game (5×3 expanding to 5×6) featuring Cascade elimination, Thunder Blessing Scatter, Coin Toss, and Free Game with max ×77 multiplier — delivered as a fully executable B2B GDD suite.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-000.svg)](https://www.fastify.io/)
[![RTP](https://img.shields.io/badge/RTP-97.5%25-purple.svg)](#core-features)
[![Max Win](https://img.shields.io/badge/Max_Win-30%2C000×-gold.svg)](#core-features)

---

## Table of Contents

- [Interactive Demos](#interactive-demos)
- [Overview](#overview)
- [Core Features](#core-features)
- [Game Mechanics Quick Reference](#game-mechanics-quick-reference)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Quick Reference](#api-quick-reference)
- [Directory Structure](#directory-structure)
- [Documentation](#documentation)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security Policy](#security-policy)
- [Architecture Quick Reference](#architecture-quick-reference)
- [Contributing](#contributing)
- [License](#license)
- [Code of Conduct](#code-of-conduct)

---

## Interactive Demos

| 連結 | 說明 |
|------|------|
| [📱 Interactive Prototype](docs/pages/prototype/index.html) | 可點擊的前端原型（12 個畫面，含動畫音效） |
| [🔌 API Explorer](docs/pages/prototype/api-explorer/index.html) | 互動式 API 試打介面（JavaScript Mock） |
| [📚 文件站](docs/pages/index.html) | 完整工程文件 |

---

## Overview

Thunder Blessing is a Greek-mythology-themed, high-volatility online slot game delivered as a B2B backend service with a fully executable GDD specification suite. The game features a 5×3 expanding-reel grid (expanding to 5×6 during Cascade), chain elimination (Cascade), the Thunder Blessing Scatter upgrade mechanic, Coin Toss, Free Game (FG), Extra Bet, and Buy Feature.

It was built to solve **the lack of engineering-executable GDD documentation** — a gap that matters to B2B game studios because spec inconsistency and manual probability adjustments cause silent RTP drift, merge conflicts, and QA failures that are nearly impossible to trace back to a single source of truth. The Excel-driven toolchain (`Thunder_Config.xlsx` → `GameConfig.generated.ts`) eliminates all manual parameter editing.

**Business value:**
- RTP 97.5% with medium-high volatility
- Single-session burst ceiling: **30,000× baseBet** (Main Game); **90,000× baseBet** (Extra Bet + Buy Feature)
- 100% spec-executable: frontend engineers, backend engineers, and QA can all deliver independently from the same document suite

The project is governed by the upstream documents below; every design decision maps to a tracked requirement:

| Document | Purpose |
|----------|---------|
| [BRD](docs/BRD.md) | Business goals, success metrics, stakeholder sign-off |
| [PRD](docs/PRD.md) | User stories, acceptance criteria, priority tiers |
| [PDD](docs/PDD.md) | UX flows, interaction specs, design tokens |
| [EDD](docs/EDD.md) | Architecture decisions, technology choices, data models |

---

## Core Features

**P0 — Must ship for v1.0:**

- **Cascade Chain Elimination** —獲獎後自動消除中獎符號，上方符號下落填補，滾輪列數從 3 擴展至最多 6 列（57 條連線），循環直到無獲獎連線
- **Thunder Blessing Scatter** — 閃電標記存在時落下 Scatter，第一擊將所有標記格替換為同一高賠符號；第二擊（機率 40%）再次升階，爆發上限極高
- **Coin Toss** — 達到 5×6 + 再次 Cascade 勝利後翻幣：Heads → 進入 Free Game（×3 倍率起），Tails → 結束本輪
- **Free Game** — 倍率序列 ×3→×7→×17→×27→×77；閃電標記整局累積不清除；每局前再翻幣決定倍率是否升階
- **Extra Bet** — 投注額 ×3，保證當局出現 Scatter 符號
- **Buy Feature** — 100× baseBet 直接進入保底 Coin Toss（Heads×5 保證），FG session 最低回收 ≥ 20× baseBet
- **Excel-Driven Probability Toolchain** — `Thunder_Config.xlsx` → `build_config.js` → `engine_config.json` → `GameConfig.generated.ts`；`verify.js` 通過才允許 `engine_generator.js` 執行，禁止手動調參
- **四情境 RTP 驗收** — Main / Extra Bet / Buy FG / Extra Bet + Buy FG 各自 1M Monte Carlo 模擬，容差 ±1%
- **Single-Trip API** — 一次 `POST /v1/spin` 回傳完整 `FullSpinOutcome`，含所有 FG 回合、Coin Toss 結果、`totalWin`

---

## Game Mechanics Quick Reference

| Mechanic | Trigger | Outcome |
|----------|---------|---------|
| Thunder Blessing | SC symbol lands + Lightning Marks present | Arc connects SC to each Lightning Mark; marks upgrade to P1–P4 premium symbols |
| Coin Toss | Reels expand to 6 rows + cascade win | Coin flip: **Heads** → FG starts (×3 multiplier); **Tails** → no FG |
| Free Game (FG) | 5+ Lightning Marks accumulated at FG round end | FG sequence: ×3→×7→×17→×27→×77 (5 nodes, max ×77) |
| Buy Feature | Player pays 100× baseBet | Guaranteed 5 FG rounds, Coin Toss skipped, multiplier starts at ×3 |
| Extra Bet | Player pays 3× baseBet | SC guaranteed in visible 3 rows of the current spin |

**Coin Toss Heads Probability Sequence (per FG stage):** [0.80, 0.68, 0.56, 0.48, 0.40]

---

## System Architecture

```mermaid
flowchart LR
    subgraph Player["Player Layer"]
        A([Cocos Creator / PixiJS Client])
    end

    subgraph CDN["CDN (Cloudflare/CloudFront)"]
        CDN_NODE[Static Asset Delivery]
    end

    subgraph Backend["Thunder Blessing Backend"]
        B[Fastify API\nJWT Auth + Rate Limit]
        C[SpinUseCase\nClean Architecture]
        D[SlotEngine\nCascade + TB + CoinToss]
        E[FreeGameOrchestrator\n×3→×77 sequence]
        F[BuyFeatureUseCase\nSessionFloorGuard]
        G[Probability Toolchain\nExcel → GameConfig]
    end

    subgraph Data["Data Layer"]
        H[(Supabase PostgreSQL\nWallet + Audit Logs)]
        I[(Redis / Upstash\nFG Session State + Lock)]
    end

    subgraph Obs["Observability"]
        J[OpenTelemetry\nCollector]
        K[Prometheus + Grafana]
    end

    A -->|HTTPS| CDN_NODE
    CDN_NODE -->|Static Assets| A
    A -->|POST /v1/spin\nRS256 JWT| B
    B --> C
    C --> D
    D --> E
    D --> F
    G -->|GameConfig.generated.ts| D
    C --> H
    C --> I
    B --> J
    B --> K
```

> Full C4 Model (L1/L2/L3), ADR records, and data flow diagrams: [docs/ARCH.md](docs/ARCH.md) | [arch.html](docs/pages/arch.html)

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Cocos Creator / PixiJS (TBD) | Game client; TypeScript; target platforms: Web, Mobile |
| **Backend** | TypeScript 5.4 + Node.js 20 LTS + Fastify 4 | Clean Architecture (Domain←Application←Adapters←Infrastructure) |
| **Database** | Supabase PostgreSQL 16 | Wallet, audit logs, spin history; Row Level Security enabled |
| **Cache / Session** | Redis (IoRedis) / Upstash | FG session state, concurrency locks, rate limiting (sliding window) |
| **Probability Engine** | Excel workbook (`Thunder_Config.xlsx`) | Single source of truth; toolchain: `build_config.js` → `verify.js` → `engine_generator.js` |
| **Auth** | Supabase Auth (RS256 JWT) | `JwtAuthGuard` as Fastify preHandler; 5 req/s rate limit per player |
| **Infrastructure** | Kubernetes 3-node cluster | Canary deploy (prod), Blue-Green deploy (staging) |
| **CI/CD** | GitHub Actions | Build, lint, type-check, Jest + Monte Carlo tests |
| **Observability** | OpenTelemetry + Prometheus + Grafana | Traces, metrics, alerting |
| **Testing** | Jest (unit/integration) + Playwright (E2E) + Cucumber (BDD) | Coverage target: 80%; RTP validated via `verify.js` (1M Monte Carlo) |

---

## Quick Start

### Docker (Recommended)

The fastest path to a running instance. Docker Compose starts all services — Fastify API, PostgreSQL, and Redis — with a single command.

**Prerequisites:** Docker Desktop 24+ (includes Compose v2)

```bash
git clone <repo-url> thunder-blessing-slot
cd thunder-blessing-slot

# Configure environment
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET

# Start all services
docker compose up -d

# Confirm all services are healthy
docker compose ps
# Expected: api, postgres, redis — all "running (healthy)"
```

Verify the API is responding:

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"1.0.0","uptime":3}
```

---

### macOS / Linux (Native)

**Prerequisites:** Node.js 20 LTS, npm 10+, PostgreSQL 16+, Redis 7+

```bash
git clone <repo-url> thunder-blessing-slot
cd thunder-blessing-slot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your local PostgreSQL and Redis connection strings

# Run database migrations
npm run db:migrate

# Start the development server
npm run dev
```

Expected output:

```
[ThunderBlessing] Listening on http://localhost:3000
[ThunderBlessing] Database: connected (postgresql://localhost:5432/thunder_blessing)
[ThunderBlessing] Redis: connected (redis://localhost:6379)
[ThunderBlessing] GameConfig: loaded (Thunder_Config.xlsx v1.0)
```

---

### Windows (PowerShell / WSL2)

> **Recommendation:** Use WSL2 (Ubuntu 22.04) + Docker Desktop for the smoothest experience.

```powershell
git clone <repo-url> thunder-blessing-slot
Set-Location thunder-blessing-slot

# Install dependencies
npm install

# Configure environment
Copy-Item .env.example .env
# Edit .env in your editor

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Verify:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

---

## Environment Variables

Copy `.env.example` to `.env` before starting. All required variables are validated at startup.

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `NODE_ENV` | Node environment | No | `development` | `production` |
| `PORT` | HTTP port the Fastify server listens on | No | `3000` | `3000` |
| `SUPABASE_URL` | Public Supabase project URL | Yes | — | `http://localhost:54321` |
| `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS) | Yes | — | `eyJhbGci...` |
| `SUPABASE_JWT_SECRET` | RS256 public key for JWT verification | Yes | — | `-----BEGIN PUBLIC KEY-----...` |
| `DATABASE_URL` | PostgreSQL direct connection string | Yes | — | `postgresql://postgres:postgres@localhost:5432/thunder_blessing` |
| `REDIS_URL` | Redis connection string | Yes | — | `redis://localhost:6379` |
| `OTEL_TRACES_SAMPLER` | OpenTelemetry trace sampler | No | `parentbased_traceidratio` | `always_on` |
| `OTEL_TRACES_SAMPLER_ARG` | Sampling ratio (0.0–1.0) | No | `1.0` | `0.05` |

See `docs/LOCAL_DEPLOY.md` for the full annotated `.env.example` and optional tuning parameters.

---

## API Quick Reference

Base URL: `http://localhost:3000`

Authentication: RS256 JWT Bearer token required on all `/v1/*` endpoints.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/spin` | Execute a spin (main game or FG); returns complete `FullSpinOutcome` |
| `GET` | `/v1/session/:sessionId` | Retrieve active FG session state |
| `GET` | `/v1/config` | Get game configuration (bet levels, currencies, RTP) |
| `GET` | `/health` | Health probe (no auth required) |
| `GET` | `/ready` | Readiness probe (no auth required) |

**Rate limit:** 5 req/s per player (HTTP 429 on exceed)

For full request/response schemas, error codes, and pagination see:
- Markdown: [docs/API.md](docs/API.md)
- HTML: [docs/pages/api.html](docs/pages/api.html)
- Interactive: [docs/pages/prototype/api-explorer/index.html](docs/pages/prototype/api-explorer/index.html)

---

## Directory Structure

```
thunder-blessing-slot/
├── .env.example              # Annotated environment variable template
├── docker-compose.yml        # Local multi-service development stack
├── Dockerfile                # Production container image
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── contracts/                # Machine-readable specs (OpenAPI, JSON Schema, seed data)
│   ├── openapi.yaml          # OpenAPI 3.1 spec (generated from API.md)
│   ├── schemas/              # JSON Schema for request/response types
│   └── seed/                 # Seed data for local development
├── docs/                     # Markdown source for all design documents
│   ├── IDEA.md               # Project concept and problem statement
│   ├── BRD.md                # Business Requirements Document
│   ├── PRD.md                # Product Requirements Document
│   ├── PDD.md                # Product Design Document (UX)
│   ├── VDD.md                # Visual Design Document (tokens, animations)
│   ├── EDD.md                # Engineering Design Document
│   ├── ARCH.md               # Architecture Design + ADRs
│   ├── API.md                # REST API specification (v1)
│   ├── SCHEMA.md             # PostgreSQL + Redis data model
│   ├── FRONTEND.md           # Frontend technical design (Cocos/PixiJS)
│   ├── AUDIO.md              # Audio design and SFX/BGM catalogue
│   ├── ANIM.md               # Animation and VFX specification
│   ├── CONSTANTS.md          # Game constants reference
│   ├── test-plan.md          # Test strategy (Unit/Integration/E2E)
│   ├── RTM.md                # Requirements Traceability Matrix
│   ├── runbook.md            # Production operations runbook
│   ├── LOCAL_DEPLOY.md       # Local development setup guide
│   ├── ALIGN_REPORT.md       # Cross-document alignment audit report
│   ├── diagrams/             # UML diagrams (Mermaid source)
│   ├── pages/                # Generated HTML documentation site
│   │   ├── index.html        # Documentation hub
│   │   ├── assets/           # CSS + JS for docs site
│   │   └── prototype/        # Interactive prototype (12 screens + API Explorer)
│   └── req/                  # Raw input materials (PDF GDD, probability design)
├── features/                 # BDD Gherkin feature files
│   ├── spin.feature          # Core spin flow
│   ├── session.feature       # FG session management
│   ├── buy-feature.feature   # Buy Feature flow
│   ├── extra-bet.feature     # Extra Bet flow
│   ├── probability-engine.feature # RTP and Monte Carlo validation
│   ├── security.feature      # Auth and rate limiting
│   ├── config.feature        # Game config endpoint
│   └── client/               # Client-side BDD (E2E)
│       ├── thunder_blessing/  # Thunder Blessing animation scenarios
│       ├── coin_toss/         # Coin Toss panel scenarios
│       └── session/           # Session reconnection scenarios
├── src/                      # Application source code (Clean Architecture)
│   ├── domain/               # Game rules, value objects, domain interfaces
│   │   ├── entities/         # SpinOutcome, Grid, CascadeStep, FGSession
│   │   ├── ports/            # IWalletRepository, ISessionCache, ISessionRepository
│   │   └── interfaces/       # IProbabilityCore, ISlotEngine
│   ├── application/          # Use cases (SpinUseCase, BuyFeatureUseCase, etc.)
│   ├── adapters/             # Controllers, DTOs, presenters
│   │   ├── http/             # Fastify route handlers
│   │   └── dto/              # FullSpinOutcomeDTO, SpinRequestDTO
│   └── infrastructure/       # Concrete implementations
│       ├── supabase/         # SupabaseWalletRepository, SupabaseSessionRepository
│       ├── redis/            # RedisSessionCache
│       └── probability/      # SlotEngine, CascadeEngine, ThunderBlessingHandler
├── tests/                    # Automated tests
│   ├── unit/                 # Domain logic unit tests
│   ├── integration/          # API + database integration tests
│   └── e2e/                  # Playwright E2E tests
└── tools/                    # Probability toolchain
    └── slot-engine/
        ├── build_config.js   # Excel → engine_config.json
        ├── verify.js         # RTP validation (must PASS before engine_generator)
        ├── engine_generator.js # engine_config.json → GameConfig.generated.ts
        └── excel_simulator.js  # 1M Monte Carlo simulation runner
```

---

## Documentation

The full documentation suite is rendered as a static HTML site at `docs/pages/index.html`.

| Document | Markdown Source | HTML | Description |
|----------|----------------|------|-------------|
| IDEA | [docs/IDEA.md](docs/IDEA.md) | [idea.html](docs/pages/idea.html) | Project concept and problem statement |
| BRD | [docs/BRD.md](docs/BRD.md) | [brd.html](docs/pages/brd.html) | Business goals, success metrics, stakeholder sign-off |
| PRD | [docs/PRD.md](docs/PRD.md) | [prd.html](docs/pages/prd.html) | User stories, acceptance criteria, priority tiers |
| PDD | [docs/PDD.md](docs/PDD.md) | [pdd.html](docs/pages/pdd.html) | UX flows, interaction specs, design tokens |
| VDD | [docs/VDD.md](docs/VDD.md) | [vdd.html](docs/pages/vdd.html) | Visual design system, animation tokens |
| CONSTANTS | [docs/CONSTANTS.md](docs/CONSTANTS.md) | [constants.html](docs/pages/constants.html) | Game constants reference |
| EDD | [docs/EDD.md](docs/EDD.md) | [edd.html](docs/pages/edd.html) | Architecture decisions, technology choices, data models |
| ARCH | [docs/ARCH.md](docs/ARCH.md) | [arch.html](docs/pages/arch.html) | C4 Model, ADRs, deployment topology |
| API | [docs/API.md](docs/API.md) | [api.html](docs/pages/api.html) | REST API endpoints, schemas, error codes |
| SCHEMA | [docs/SCHEMA.md](docs/SCHEMA.md) | [schema.html](docs/pages/schema.html) | PostgreSQL + Redis data model |
| FRONTEND | [docs/FRONTEND.md](docs/FRONTEND.md) | [frontend.html](docs/pages/frontend.html) | Frontend technical design (Cocos/PixiJS) |
| AUDIO | [docs/AUDIO.md](docs/AUDIO.md) | [audio.html](docs/pages/audio.html) | SFX/BGM catalogue and audio design |
| ANIM | [docs/ANIM.md](docs/ANIM.md) | [anim.html](docs/pages/anim.html) | Animation and VFX specification |
| Test Plan | [docs/test-plan.md](docs/test-plan.md) | [test-plan.html](docs/pages/test-plan.html) | Test strategy and coverage targets |
| BDD Server | [features/](features/) | [bdd-server.html](docs/pages/bdd-server.html) | Server-side Gherkin feature files |
| BDD Client | [features/client/](features/client/) | [bdd-client.html](docs/pages/bdd-client.html) | Client-side E2E feature files |
| RTM | [docs/RTM.md](docs/RTM.md) | [rtm.html](docs/pages/rtm.html) | Requirements Traceability Matrix |
| Runbook | [docs/runbook.md](docs/runbook.md) | [runbook.html](docs/pages/runbook.html) | Production operations runbook |
| Local Deploy | [docs/LOCAL_DEPLOY.md](docs/LOCAL_DEPLOY.md) | [local_deploy.html](docs/pages/local_deploy.html) | Local development setup guide |

---

## Testing

### Run All Tests

```bash
npm test
```

### Generate Coverage Report

```bash
npm run test:coverage
# Report written to coverage/lcov-report/index.html
```

Coverage target: **80% lines, branches, functions.**

### Individual Test Types

```bash
# Unit tests only (domain logic, slot engine math)
npm run test:unit

# Integration tests (requires DATABASE_URL and REDIS_URL)
npm run test:integration

# BDD / Cucumber feature tests
npm run test:bdd

# End-to-end tests (requires a running app instance on :3000)
npm run test:e2e

# RTP validation — Monte Carlo 1M simulations per scenario (slow, ~15 min)
node tools/slot-engine/verify.js
# Expected: PASS — all 4 scenarios within ±1% of 97.5% RTP
```

### Probability Toolchain

```bash
# Step 1: Validate Excel config (must PASS before generation)
node tools/slot-engine/verify.js

# Step 2: Generate GameConfig (only if verify PASS)
node tools/slot-engine/engine_generator.js

# Step 3: Verify output
ls src/infrastructure/probability/GameConfig.generated.ts
```

> **Never** edit `GameConfig.generated.ts` manually. CI will block PRs that bypass this rule.

---

## Known Limitations

- `GameConfig.generated.ts` must never be modified manually — always regenerate via toolchain after updating `Thunder_Config.xlsx`
- Single-trip API: `POST /v1/spin` may take up to P99 500ms for Free Game sequences with all 5 rounds; progressive rendering is handled client-side from the full response
- Buy Feature session floor (≥ 20× baseBet) is enforced at session level; individual FG rounds may fall below floor — the compensating payout occurs at session close
- TWD max bet level is **320** (not 300 as in earlier design iterations)
- FG session reconnect: if client disconnects during FG, `GET /v1/session/:sessionId` resumes from the last completed round; in-progress round state is not recoverable after Redis TTL (24h)

---

## Development Workflow

### Branch Strategy

| Branch | Purpose | Direct Push |
|--------|---------|-------------|
| `main` | Production-ready code | No — PR only |
| `develop` | Integration branch | No — PR only |
| `feature/<ticket>-description` | New features | Yes (author) |
| `fix/<ticket>-description` | Bug fixes | Yes (author) |

### Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body — what and why, not how]
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`

Examples:
```
feat(engine): implement ThunderBlessingHandler second-hit 40% probability
fix(session): release Redis lock on engine timeout compensating credit
docs(readme): regenerate with prototype and API Explorer links
test(rtp): add 4-scenario Monte Carlo integration test suite
```

### Pull Request Checklist

- [ ] CI checks pass (build, lint, type-check, Jest)
- [ ] Coverage ≥ 80%
- [ ] `verify.js` PASS (if probability config changed)
- [ ] `GameConfig.generated.ts` regenerated (if `Thunder_Config.xlsx` changed)
- [ ] Relevant `docs/` files updated if implementation changed
- [ ] PR description explains *why* the change is needed

---

## Deployment

### Staging

Staging deploys automatically on every merge to `develop`. The pipeline runs the full test suite, builds the Docker image, and triggers a Kubernetes Blue-Green update.

```bash
# Trigger manual staging deploy
gh workflow run deploy.yml -f environment=staging -f ref=develop
```

### Production

Production deploys via Canary strategy on merge to `main`.

```bash
# Tag a release to trigger production deploy
git tag v1.0.0 && git push origin v1.0.0
```

### Rollback

```bash
# Identify previous stable image tag
gh release list --limit 5

# Roll back Kubernetes deployment
kubectl set image deployment/thunder-blessing \
  api=thunder-blessing-slot:<previous-tag> \
  -n thunder-blessing

# Verify pods are healthy
kubectl rollout status deployment/thunder-blessing -n thunder-blessing
```

For detailed runbook steps including database rollback: [docs/runbook.md](docs/runbook.md) | [runbook.html](docs/pages/runbook.html)

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| `Error: connect ECONNREFUSED 127.0.0.1:5432` on startup | PostgreSQL not running or `DATABASE_URL` wrong | Start PostgreSQL via `docker compose up -d postgres`; verify `DATABASE_URL` in `.env` |
| `Error: Redis connection refused` | Redis not running or `REDIS_URL` misconfigured | Start Redis via `docker compose up -d redis`; confirm `REDIS_URL` in `.env` |
| `401 Unauthorized` on `POST /v1/spin` | JWT token invalid, expired, or `SUPABASE_JWT_SECRET` mismatch | Refresh token via Supabase Auth; verify `SUPABASE_JWT_SECRET` matches your Supabase project |
| `429 Too Many Requests` | Exceeding 5 req/s per player rate limit | Implement client-side backoff; check if multiple tabs/clients share same JWT |
| `verify.js` FAIL — RTP out of range | `Thunder_Config.xlsx` parameter changes causing drift | Revert the Excel change, re-run `verify.js` to identify the problematic parameter, adjust and re-run 1M simulation |
| `GameConfig.generated.ts` out of sync | Manually edited or not regenerated after Excel update | Run `node tools/slot-engine/engine_generator.js` after `verify.js` PASS |
| FG session state lost after Redis restart | Redis data not persisted (default config) | Enable Redis AOF persistence in `redis.conf`; or rely on `GET /v1/session/:sessionId` with PostgreSQL fallback |
| Docker Compose services restart repeatedly | Port conflict or missing `.env` values | Run `docker compose logs api` to read the startup error; confirm all required variables are set |

---

## Security Policy

If you discover a security vulnerability, **do not open a public GitHub Issue**.

**Responsible Disclosure:**
- Email: `security@thunder-blessing-slot.example` (or use GitHub Security Advisories)
- Or: [GitHub Private Vulnerability Reporting](../../security/advisories/new)

**Response SLA:**

| Severity | Acknowledgement | Initial Assessment | Fix + Public Disclosure |
|----------|---------------|--------------------|------------------------|
| Critical | 24 hours | 48 hours | 7 days |
| High | 48 hours | 72 hours | 14 days |
| Medium | 72 hours | 7 days | 90 days |
| Low | 7 days | 14 days | Next release |

See [SECURITY.md](SECURITY.md) for full policy.

---

## Architecture Quick Reference

| Key Decision | Choice | Document |
|-------------|--------|---------|
| API paradigm | REST (single-trip POST /spin returns complete FullSpinOutcome) | [docs/ARCH.md — ADR-003](docs/ARCH.md#adr) |
| Backend framework | Fastify 4 (over Express/NestJS) | [docs/ARCH.md — ADR-001](docs/ARCH.md#adr) |
| Architecture pattern | Clean Architecture (Domain←Application←Adapters←Infrastructure) | [docs/ARCH.md — ADR-002](docs/ARCH.md#adr) |
| Primary database | Supabase PostgreSQL (wallet, audit, spin history) | [docs/ARCH.md — ADR-007](docs/ARCH.md#adr) |
| Session store | Redis / Upstash (FG session state, locks, rate limits) | [docs/ARCH.md — ADR-004](docs/ARCH.md#adr) |
| Authentication | RS256 JWT Bearer (Supabase Auth) | [docs/API.md — §1.3](docs/API.md#authentication) |
| Probability source | Excel workbook (`Thunder_Config.xlsx`) — sole source of truth | [docs/ARCH.md — ADR-009](docs/ARCH.md#adr) |
| Accounting authority | `outcome.totalWin` only (never `session.roundWin`) | [docs/ARCH.md — ADR-006](docs/ARCH.md#adr) |
| Deployment platform | Kubernetes (Canary prod, Blue-Green staging) | [docs/ARCH.md — ADR-008](docs/ARCH.md#adr) |
| Toolchain gate | `verify.js` PASS required before `engine_generator.js` | [docs/ARCH.md — ADR-005](docs/ARCH.md#adr) |

Main ADR index: [docs/ARCH.md § Architecture Decision Record Index](docs/ARCH.md#architecture-decision-record-adr-index)

---

## Contributing

Contributions are welcome. Please read this section before submitting a pull request.

### Fork and PR Flow

1. Fork the repository on GitHub
2. Create a feature branch from `develop`: `git checkout -b feature/your-feature develop`
3. Write tests first (TDD) — the test suite must stay green
4. Ensure `verify.js` PASS if you touched probability config
5. Commit using the Conventional Commits format
6. Push your branch and open a PR against `develop` (not `main`)
7. Address all review feedback before requesting re-review

### Code Style

- Formatted by Prettier on save (`.prettierrc`)
- Lint rules in `.eslintrc.json` — CI blocks on lint errors
- Type-checking: `npx tsc --noEmit` — CI blocks on type errors
- Run `npm run format` locally before committing

### Issue Templates

Use GitHub Issue templates:
- **Bug report** — reproduction steps, expected vs actual behavior, environment details
- **Feature request** — problem statement, proposed solution, acceptance criteria
- **Probability / RTP issue** — specify which scenario (Main/EB/BuyFG/EB+BuyFG), simulation count, observed vs expected RTP

---

## License

MIT License

Copyright (c) 2026 Thunder Blessing Slot GDD Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

See [LICENSE](LICENSE) for the full text.

---

## Code of Conduct

This project adopts the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1 as its Code of Conduct. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

For violations, contact: `conduct@thunder-blessing-slot.example`

---

> 📋 **Generated by [gendoc](https://github.com/gendoc)** — Full design and specification suite for Thunder Blessing generated via the gendoc pipeline. See [docs/pages/index.html](docs/pages/index.html) for the complete HTML documentation site.
