# Thunder Blessing Slot Game — GDD & Technical Documentation

Full design and specification suite for the **Thunder Blessing** slot game, generated via the gendoc pipeline.

## Interactive Demos

| 連結 | 說明 |
|------|------|
| [📱 Interactive Prototype](docs/pages/prototype/index.html) | 可點擊的前端原型（12 個畫面，含動畫音效） |
| [🔌 API Explorer](docs/pages/prototype/api-explorer/index.html) | 互動式 API 試打介面（JavaScript Mock） |
| [📚 文件站](docs/pages/index.html) | 完整工程文件 |

## Document Structure

```
docs/
├── BRD.md          — Business Requirements Document
├── PRD.md          — Product Requirements (User Stories + AC)
├── PDD.md          — Product Design Document (UI/UX)
├── VDD.md          — Visual Design Document (tokens, animations)
├── EDD.md          — Engineering Design Document
├── ARCH.md         — Architecture design
├── API.md          — REST API specification (v1)
├── SCHEMA.md       — PostgreSQL + Redis data model
├── FRONTEND.md     — Frontend (web client) technical design
├── AUDIO.md        — Audio design and SFX/BGM catalogue
├── ANIM.md         — Animation and VFX specification
├── test-plan.md    — Test strategy (Unit / Integration / E2E)
├── RTM.md          — Requirements Traceability Matrix
├── runbook.md      — Production operations runbook
├── LOCAL_DEPLOY.md — Local development setup guide
└── diagrams/       — UML diagrams (Mermaid)

features/           — BDD acceptance scenarios (Gherkin)
├── *.feature       — Server-side BDD (API integration)
└── client/         — Client-side BDD (UI/E2E)
```

## Game Mechanics Quick Reference

| Mechanic | Trigger | Outcome |
|----------|---------|---------|
| Thunder Blessing | SC symbol lands + Lightning Marks present | Arc connects SC to each Lightning Mark; marks upgrade to P1–P4 premium symbols |
| Coin Toss | Reels expand to 6 rows + cascade win | Coin flip: **Heads** → FG starts (×3 multiplier); **Tails** → no FG |
| Free Game (FG) | 5+ Lightning Marks accumulated at FG round end | FG sequence: ×3→×7→×17→×27→×77 (5 nodes, max ×77) |
| Buy Feature | Player pays 100× baseBet | Guaranteed 5 FG rounds, Coin Toss skipped, multiplier starts at ×3 |
| Extra Bet | Player pays 3× baseBet | SC guaranteed in visible 3 rows of the current spin |

## Local Development

See `docs/LOCAL_DEPLOY.md` for full Docker Compose setup and smoke test instructions.

Quick start:
```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET
docker compose up -d
curl http://localhost:3000/health
```

## API Overview

Base URL: `http://localhost:3000`

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/spin | Execute a spin (main game or FG) |
| GET  | /v1/session/:sessionId | Retrieve active FG session state |
| GET  | /v1/config | Get game configuration (bet levels, currencies) |

Authentication: RS256 JWT bearer token required on all endpoints.

## BDD Scenarios

Server BDD (`features/*.feature`): API integration tests covering spin logic, session management, config, security, and probability engine.

Client BDD (`features/client/**/*.feature`): E2E UI tests covering Thunder Blessing animation, Coin Toss panel, Free Game HUD, session reconnection, and more.
