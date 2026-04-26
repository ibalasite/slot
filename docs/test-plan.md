# Test Plan — Thunder Blessing Slot Game
<!-- Standard: IEEE 829-2008 Software and System Test Documentation -->

---

## Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | TP-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Status** | DRAFT |
| **Author** | AI Generated (devsop-gen-test-plan) |
| **Date** | 2026-04-26 |
| **Standard** | IEEE 829-2008 |
| **Upstream Documents** | IDEA.md, BRD.md, PRD.md, EDD.md v1.3, ARCH.md v1.7, API.md v1.0, SCHEMA.md v1.0, FRONTEND.md v1.0, AUDIO.md v1.0, ANIM.md v1.0, VDD.md v1.0, PDD.md v1.0 |
| **Reviewers** | QA Lead, Engineering Lead, Security Lead |
| **Approver** | QA Lead, Engineering Lead |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | AI Generated | Initial IEEE 829 Test Plan generation |

---

## Table of Contents

1. [Test Strategy](#§1-test-strategy)
2. [Test Scope](#§2-test-scope)
3. [Test Tools](#§3-test-tools)
4. [Test Data](#§4-test-data)
5. [Test Environment](#§5-test-environment)
6. [Entry/Exit Criteria](#§6-entryexit-criteria)
7. [Risk Assessment](#§7-risk-assessment)
8. [Schedule](#§8-schedule)
9. [Unit Test Plan](#§9-unit-test-plan)
10. [Integration Test Plan](#§10-integration-test-plan)
11. [E2E Test Plan](#§11-e2e-test-plan)
12. [Security Test Plan](#§12-security-test-plan)
13. [Performance Test Plan](#§13-performance-test-plan)
14. [Accessibility Test Plan](#§14-accessibility-test-plan)
15. [Regression Test Plan](#§15-regression-test-plan)
16. [Smoke Test Plan](#§16-smoke-test-plan)
17. [CI/CD Integration](#§17-cicd-integration)
18. [Reporting](#§18-reporting)
- [Appendix A: Requirements Traceability Matrix (RTM)](#appendix-a-requirements-traceability-matrix-rtm)
- [Appendix B: Performance Test k6 Script Skeleton](#appendix-b-performance-test-k6-script-skeleton)

---

## §1 Test Strategy

### §1.1 Testing Objectives (SMART)

The following objectives govern all testing activities for Thunder Blessing. Each objective is Specific, Measurable, Achievable, Relevant, and Time-bound (target: prior to Production deployment).

| Objective ID | Objective | Metric | Target |
|-------------|-----------|--------|--------|
| OBJ-01 | Verify RTP accuracy across all four game scenarios | Monte Carlo simulation (1,000,000 spins per scenario) | Each scenario within ±1% of 97.5% target; `verify.js` must report PASS |
| OBJ-02 | Validate backend API correctness | API contract test pass rate | 100% of P0 endpoints return correct status codes and schema for happy + error paths |
| OBJ-03 | Ensure spin latency meets SLO | Prometheus `spin_duration_seconds` histogram | P50 ≤ 150ms, P95 ≤ 300ms, P99 ≤ 500ms (no FG); P99 ≤ 800ms (FG sequence) |
| OBJ-04 | Validate Cascade chain elimination logic | Unit test coverage | 100% of Cascade boundary conditions covered; 0 off-by-one errors in row expansion |
| OBJ-05 | Confirm Free Game multiplier sequence correctness | Integration test | FG sequence ×3→×7→×17→×27→×77 executes correctly in all 4 scenarios; coinProbs[stage] applied correctly |
| OBJ-06 | Verify wallet accounting integrity | Wallet reconciliation integration test | 0 debit/credit discrepancies; `outcome.totalWin` is the sole accounting authority |
| OBJ-07 | Achieve test automation rate ≥ 90% | Automation coverage ratio | ≥ 90% of all test cases are automated (excluding exploratory and manual visual checks) |
| OBJ-08 | Maintain code coverage | Vitest/Jest coverage report | ≥ 80% line coverage, ≥ 80% branch coverage on all `src/domain/**` and `src/application/**` modules |
| OBJ-09 | Validate error rate under load | k6 soak test error counter | < 0.5% HTTP 5xx rate at 500 concurrent users sustained for 2 hours |
| OBJ-10 | Confirm Buy Feature session floor guarantee | Integration test | `totalFGWin` ≥ 20× baseBet for every Buy Feature spin (100% pass rate over 10,000 simulated BuyFG runs) |

### §1.2 Test Scope

#### In Scope

| Domain | Components |
|--------|-----------|
| Backend game engine | `SlotEngine`, `CascadeEngine`, `ThunderBlessingHandler`, `CoinTossEvaluator`, `FreeGameOrchestrator`, `NearMissSelector` |
| Application use cases | `SpinUseCase`, `BuyFeatureUseCase`, `GetSessionStateUseCase`, `SessionFloorGuard`, `ConcurrencyLockGuard` |
| Infrastructure adapters | `SupabaseWalletRepository`, `SupabaseSessionRepository`, `RedisSessionCache`, `JwtAuthGuard` |
| API contract | `POST /v1/spin`, `GET /v1/session/:sessionId`, `GET /v1/config`, `GET /health`, `GET /ready` |
| Database schema | All tables: `players`, `spins`/`spin_logs`, `wallet_transactions`, `fg_sessions`, `wallets` |
| Probability engine | Excel toolchain: `build_config.js`, `excel_simulator.js`, `verify.js`, `engine_generator.js` |
| Frontend (game client) | Scene transitions, AnimationQueue correctness, Pure View compliance (no win recalculation on client) |
| Performance | API throughput and latency under load (k6: smoke, load, stress, soak) |
| Security | Authentication, authorization, betting manipulation prevention, OWASP A01–A10 |
| Accessibility | WCAG 2.1 AA, reduced motion, keyboard navigation |
| Config integrity | `GameConfig.generated.ts` immutability CI guard |

#### Out of Scope

| Excluded Item | Rationale |
|--------------|-----------|
| Real-money payment gateway integration | Handled by B2B platform operator, outside product boundary |
| Third-party RNG certification (hardware RNG) | Regulatory submission is operator responsibility; this plan covers software-level RNG integrity |
| Multi-language (i18n) testing | Deferred to Phase 2 per PRD §4.3 |
| Native mobile app (iOS/Android) packaging | Web-only for Phase 1 per PRD §4.4 |
| Visual asset production (art, audio file recording) | Creative production, not engineering scope |
| Physical compliance filing with gaming authorities | Operator obligation |
| PixiJS-specific visual regression (if Cocos is selected) | One framework will be selected; tests run against chosen framework only |
| DESIGN_VIEW Excel tab automation | Manual QA by Game Designer; toolchain output verified by `verify.js` |

### §1.3 Test Pyramid

```
           /\
          /  \
         / E2E\   10% — Critical user flows, visual regression
        /──────\
       /  Integ \  20% — API contracts, DB integration, Redis
      /──────────\
     /    Unit    \ 70% — Domain engine, game logic, utilities
    /______________\
```

| Level | Target Ratio | Automation Rate | Primary Tools |
|-------|:----------:|:----------:|--------------|
| Unit | 70% | 100% | Vitest, custom RNG seed fixtures |
| Integration | 20% | 100% | Supertest, Vitest, test Supabase DB |
| E2E | 10% | ≥ 90% | Playwright, Percy (visual regression) |
| **Total** | **100%** | **≥ 90%** | — |

**Minimum total automated TCs before production release:** 200 (unit) + 60 (integration) + 30 (E2E) = 290 automated test cases.

### §1.4 Quality Gates

All quality gates are enforced in CI/CD pipeline (§17). Release is blocked if any gate fails.

| Gate ID | Gate | Threshold | Enforced At |
|---------|------|-----------|-------------|
| QG-01 | Unit test pass rate | 100% | PR merge |
| QG-02 | Line coverage (domain + application) | ≥ 80% | PR merge |
| QG-03 | Branch coverage (domain + application) | ≥ 80% | PR merge |
| QG-04 | Integration test pass rate | 100% | PR merge |
| QG-05 | E2E test pass rate (P0 flows) | 100% | Staging deploy |
| QG-06 | RTP verification (`verify.js`) | PASS (all 4 scenarios) | Config change + nightly |
| QG-07 | API P99 latency (no FG) | ≤ 500ms | Load test gate on staging |
| QG-08 | API P99 latency (FG sequence) | ≤ 800ms | Load test gate on staging |
| QG-09 | Error rate under 500 concurrent users | < 0.5% 5xx | Soak test on staging |
| QG-10 | CRITICAL security findings | 0 open CRITICAL | Pre-release security scan |
| QG-11 | `GameConfig.generated.ts` checksum | SHA-256 matches generated output | CI build |
| QG-12 | OWASP ZAP scan HIGH findings | 0 HIGH | Pre-release security scan |

---

## §2 Test Scope

### §2.1 Features to Test (Mapped to PRD P0/P1 User Stories)

| Feature | PRD US-ID | Priority | Test Types |
|---------|-----------|----------|-----------|
| Basic spin — 5×3 grid, payline evaluation, Wild substitution | US-SPIN-001 | P0 | Unit, Integration, E2E |
| Insufficient balance rejection | US-SPIN-001/AC-2 | P0 | Unit, Integration |
| JWT authentication on every spin | US-SPIN-001/AC-3, US-APIV-001 | P0 | Unit, Integration |
| Concurrent spin rejection (409) | US-SPIN-001/AC-4 | P0 | Integration, E2E |
| Cascade chain elimination — symbol removal, gravity drop | US-CASC-001/AC-1 | P0 | Unit |
| Row expansion (3→4→5→6) during Cascade | US-CASC-001/AC-1 | P0 | Unit |
| Lightning Mark generation at winning positions | US-CASC-001/AC-1 | P0 | Unit, Integration |
| MAX_ROWS=6 boundary — no further expansion | US-CASC-001/AC-2 | P0 | Unit |
| Lightning Mark reset on new Main Game spin | US-CASC-001/AC-3 | P0 | Unit |
| Thunder Blessing first hit — mark-to-symbol upgrade | US-TBSC-001/AC-1 | P0 | Unit |
| Thunder Blessing second hit — symbol tier upgrade (40% probability) | US-TBSC-001/AC-2 | P0 | Unit |
| SC with no Lightning Marks — no Thunder Blessing trigger | US-TBSC-001/AC-3 | P0 | Unit |
| Symbol upgrade boundary — P1 stays P1 | US-TBSC-001/AC-4 | P0 | Unit |
| Coin Toss trigger condition (rows=6 + cascade win) | US-COIN-001/AC-1 | P0 | Unit |
| Coin Toss Heads — FG entry at ×3 | US-COIN-001/AC-2 | P0 | Unit, Integration |
| Coin Toss Tails — no FG | US-COIN-001/AC-3 | P0 | Unit |
| Buy Feature — guaranteed Heads (entryBuy=1.0) | US-COIN-001/AC-4 | P0 | Unit, Integration |
| Coin Toss boundary — rows<6 never triggers | US-COIN-001/AC-5 | P0 | Unit |
| FG multiplier sequence ×3→×7→×17→×27→×77 | US-FGAM-001 | P0 | Unit, Integration |
| FG Lightning Marks persist across FG rounds | US-FGAM-001/AC-1 | P0 | Unit, Integration |
| FG Bonus multiplier draw (×1/×5/×20/×100) | US-FGAM-001/AC-6 | P0 | Unit |
| FG ends on Tails — marks cleared, totalWin returned | US-FGAM-001/AC-4, AC-7 | P0 | Unit, Integration |
| FG disconnection recovery | US-FGREC-001 | P1 | Integration |
| Extra Bet ×3 cost deduction | US-EXBT-001/AC-1 | P0 | Unit, Integration |
| Extra Bet guaranteed SC injection | US-EXBT-001/AC-3 | P0 | Unit |
| Buy Feature 100× baseBet cost | US-BUYF-001 | P0 | Unit, Integration |
| Buy Feature session floor ≥ 20× baseBet | US-BUYF-001 | P0 | Unit, Integration |
| RTP verification — 4 scenarios via verify.js | US-RTPV-001 | P0 | Monte Carlo |
| Currency display from BetRangeConfig (USD/TWD) | US-CURR-001 | P0 | Unit, Integration |
| Near Miss visual configuration (toolchain-driven) | US-NRMS-001 | P0 | Unit |
| Single-trip API — complete FG sequence in one response | BR-07 §6.2 | P0 | Integration, E2E |
| Max Win enforcement (30,000× / 90,000×) | EDD §5.8 | P0 | Unit |
| Frontend Pure View compliance (no client-side win calc) | FRONTEND §1.2 | P1 | E2E |
| AnimationQueue sequential drain (no parallel cross-step) | ANIM §1.3 | P1 | E2E |
| Audio deferred load after first user interaction | AUDIO §1.3 | P1 | E2E, Accessibility |

### §2.2 Features NOT to Test (with Rationale)

| Excluded Feature | Rationale |
|-----------------|-----------|
| Real wallet payment processing | Out of scope per PRD §4.4; handled by operator payment gateway |
| Supabase Auth account registration flow | Supabase-managed infrastructure; tested by Supabase Auth team |
| K8s cluster provisioning and node lifecycle | Infrastructure testing; separate ops runbook |
| Excel UI usability for Game Designers | Manual operator workflow, not an engineering deliverable |
| DESIGN_VIEW Excel tab rendering | Excel feature; Game Designer manually verifies via visual inspection |
| Third-party CDN (Cloudflare/CloudFront) caching behavior | CDN vendor responsibility; tested via synthetic probes |
| Native iOS/Android app | Excluded per PRD §4.4; web-first only |
| Multi-language string correctness | i18n deferred to Phase 2 per PRD §4.3 |
| Hardware RNG source entropy quality | OS-provided CSPRNG; not testable at application level |

### §2.3 Game-Specific Test Domains

#### Probability and RTP Testing

- All four scenarios (Main / ExtraBet / BuyFG / EBBuyFG) must independently achieve RTP within ±1% of 97.5% after 1,000,000 Monte Carlo simulated spins each.
- `verify.js` pass/fail output is the authoritative acceptance record.
- Symbol weights (`mainGame`, `extraBet`, `freeGame`, `buyFG`) must not be cross-contaminated between scenarios.
- FG Bonus multiplier distribution (×1/×5/×20/×100 at weights 900/80/15/5) must be statistically verified over 100,000 FG triggers.

#### Cascade Correctness Testing

- Row expansion sequence: 3→4→5→6; row count must never exceed 6.
- Payline count must track row expansion: 25 (3 rows) → 33 (4 rows) → 45 (5 rows) → 57 (6 rows).
- Lightning Mark positions must be deduplicated (no repeated mark at same grid cell).
- Cascade depth limit of 50 steps must abort with ERROR log, never infinite loop.
- Gravity drop after symbol elimination must fill all vacant cells correctly.

#### Free Game Sequence Testing

- FG entry: `coinProbs[0] = 0.80` for Main Game; `entryBuy = 1.00` for Buy Feature.
- FG Coin Toss stage progression: `coinProbs[1..4] = [0.68, 0.56, 0.48, 0.40]`.
- FG Bonus multiplier is drawn exactly once per FG sequence (before round 1).
- FG Lightning Marks: inherited from Main Game entry state; accumulated across FG rounds; cleared only at FG termination.
- `FullSpinOutcome.fgRounds[]` must contain all completed FG rounds; Buy Feature must contain exactly 5 rounds.

#### Coin Toss Testing

- Trigger boundary: `rows = 6 AND lastCascadeHadWin AND mgFgTriggerProb check (0.009624)`.
- Buy Feature: bypasses `mgFgTriggerProb`; directly enters Coin Toss with `entryBuy = 1.00`.
- Statistical distribution of Heads/Tails must match expected `coinProbs` values within 2% margin over 100,000 trials.

---

## §3 Test Tools

### §3.1 Backend Unit/Integration: Vitest + Supertest

| Tool | Version | Purpose | Config File |
|------|---------|---------|------------|
| Vitest | ≥ 1.6 | Unit and integration test runner; TypeScript native; fast HMR | `vitest.config.ts` |
| `@vitest/coverage-v8` | ≥ 1.6 | V8-based code coverage (line/branch/statement/function) | `vitest.config.ts` → `coverage` |
| Supertest | ≥ 7.0 | HTTP assertion layer over Fastify test server (in-process, no port binding) | `test/helpers/supertest.ts` |
| `vitest-mock-extended` | ≥ 2.0 | Type-safe mocking of interfaces (`IWalletRepository`, `ISessionCache`, etc.) | Per test file |
| `@faker-js/faker` | ≥ 8.0 | Test data generation (UUIDs, player IDs, bet levels) | `test/factories/` |

**Coverage thresholds** (enforced in CI by `vitest.config.ts`):
```
lines: 80, branches: 80, functions: 80, statements: 80
```

### §3.2 E2E: Playwright

| Tool | Version | Purpose |
|------|---------|---------|
| Playwright | ≥ 1.44 | Browser automation for full user-flow E2E tests |
| `@playwright/test` | ≥ 1.44 | Test runner with built-in assertions, fixtures, parallelism |
| Playwright screenshots | built-in | Visual regression baseline capture at key breakpoints |

**Browsers:** Chromium (primary), Firefox, WebKit (Safari simulation).
**Viewports tested:** 320px, 768px, 1024px, 1440px.

### §3.3 Performance: k6

| Tool | Version | Purpose |
|------|---------|---------|
| k6 | ≥ 0.51 | Load, stress, and soak testing of `POST /v1/spin` and related endpoints |
| k6 Cloud (optional) | — | Distributed load generation for stress test (2000 concurrent) |
| `k6-reporter` | ≥ 2.4 | HTML summary report from k6 JSON output |

**SLO targets from ARCH §1.1 / EDD:**
- Base spin P99 ≤ 500ms
- FG sequence P99 ≤ 800ms
- Error rate < 0.5% at 500 concurrent users

### §3.4 Security: OWASP ZAP + npm audit

| Tool | Purpose | Run Frequency |
|------|---------|--------------|
| OWASP ZAP (Zed Attack Proxy) | Dynamic application security testing (DAST); automated spider + active scan of all `/v1/*` endpoints | Pre-release, nightly on staging |
| `npm audit` | Dependency vulnerability scan (CRITICAL/HIGH CVEs) | Every PR, every build |
| Semgrep / CodeQL | Static application security testing (SAST); injection, auth bypass, hardcoded secrets | Every PR |
| `trivy` | Container image vulnerability scanning (K8s pod images) | Every Docker build |

### §3.5 Visual Regression: Percy + Playwright Screenshots

| Tool | Purpose |
|------|---------|
| Percy (BrowserStack) | Visual regression diffing against approved baselines; pixel-diff at 320/768/1024/1440px |
| Playwright built-in screenshots | Fallback visual regression for CI (compare against committed baseline PNGs) |

**Key visual regression targets:**
- GameScene idle state (no FG, no marks)
- Cascade step 1 (row=4), step 3 (row=6)
- Thunder Blessing first hit and second hit states
- Coin Toss heads/tails result overlay
- FG entry fanfare (multiplier ×3)
- FG multiplier ×77 state
- Buy Feature result (session floor applied)
- Error state (insufficient funds modal)

### §3.6 Probability/RTP: Monte Carlo Simulation Runner

| Tool | Purpose |
|------|---------|
| `verify.js` (slot-engine toolchain) | Authoritative RTP verification; 1,000,000 spins per scenario; PASS/FAIL per scenario within ±1% of 97.5% |
| `excel_simulator.js` | Feeds simulation results into DESIGN_VIEW tab; precondition for `verify.js` |
| Custom `test/montecarlo/rtp-runner.ts` | CI-integrated RTP sanity check (100,000 spins per scenario) for faster PR-level feedback; full 1M run nightly |

### §3.7 Mobile/Game Client: Cocos Creator Test Runner + FPS Monitor

| Tool | Purpose |
|------|---------|
| Cocos Creator build system | Build `.web-mobile` and `.web-desktop` targets for test |
| Playwright (mobile viewport simulation) | E2E tests at 320px/768px viewport |
| Chrome DevTools Performance tab | Frame rate profiling; verify 60fps desktop / 30fps mobile targets (ANIM §1.3) |
| `stats.js` (game client integration) | In-game FPS monitor for manual QA sessions; `rAF`-based frame counter |
| Web Audio API mock | Jest/Vitest mock for `AudioContext` in unit tests; prevents "user gesture required" errors |

---

## §4 Test Data

### §4.1 Data Creation Strategy

All test data is created programmatically via factory functions. No manual SQL inserts are used in automated tests.

```typescript
// test/factories/player.factory.ts
export function createTestPlayer(overrides?: Partial<PlayerRow>): PlayerRow {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    display_name: faker.person.fullName(),
    balance: 1000.00,
    currency: 'USD',
    is_suspended: false,
    engine_version: '1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// test/factories/spin-request.factory.ts
export function createSpinRequest(overrides?: Partial<SpinRequest>): SpinRequest {
  return {
    playerId: faker.string.uuid(),
    betLevel: 7,
    currency: 'USD',
    extraBet: false,
    buyFeature: false,
    sessionId: faker.string.uuid(),
    ...overrides,
  };
}
```

**Fixture files** (`test/fixtures/`):
- `engine-config.fixture.json` — copy of verified `engine_config.json` for unit tests
- `game-config.fixture.ts` — typed `GameConfig` object with known symbol weights
- `grid-5x3.fixture.ts` — deterministic 5×3 grid with known payline outcomes
- `grid-5x6-cascade.fixture.ts` — 5×6 grid after 3 cascade steps with lightning marks

### §4.2 Data Isolation

- **Unit tests:** Pure in-memory objects. No DB, no Redis. All repositories are injected via `vitest-mock-extended` mocks.
- **Integration tests:** Each test runs inside a PostgreSQL transaction that is rolled back via `ROLLBACK` after the test completes. Redis keys are namespaced with `test:{testRunId}:` prefix and deleted via `FLUSHDB` on the test Redis instance after each suite.
- **E2E tests:** Use a dedicated `test` Supabase project (separate from `staging`). Seed via `test/e2e/setup.ts` (`beforeAll`) and teardown via `afterAll`.

```typescript
// test/integration/setup.ts
let txn: Transaction;

beforeEach(async () => {
  txn = await supabaseTestClient.rpc('begin_transaction');
});

afterEach(async () => {
  await supabaseTestClient.rpc('rollback_transaction', { txn_id: txn.id });
  await redisTestClient.flushdb();
});
```

### §4.3 Game-Specific Test Data — Fixed RNG Seeds

Deterministic cascade sequences are produced by seeding the RNG with known values.

| Seed | Scenario | Expected Outcome |
|------|---------|-----------------|
| `seed-001` | Main Game, 0 wins | Grid with 0 winning paylines; no cascade; totalWin=0 |
| `seed-002` | Main Game, 3 cascade steps | 3 cascade eliminations; 12 lightning marks; rows=6 |
| `seed-003` | Thunder Blessing first hit only | SC falls on marked grid; RNG > 0.40 (no second hit) |
| `seed-004` | Thunder Blessing both hits | SC falls; RNG < 0.40; P4 upgrades to P3 |
| `seed-005` | Coin Toss Heads, FG ×3 | rows=6, cascade win, mgFgTriggerProb passes, Heads result |
| `seed-006` | Full FG sequence ×3→×77 | 5 consecutive Heads; bonusMultiplier=×1 |
| `seed-007` | FG with bonus ×100 | FG triggered; bonusMultiplier=×100 drawn |
| `seed-008` | Buy Feature, floor applied | totalFGWin < 20×baseBet; floor activated |
| `seed-009` | Extra Bet, SC injected | extraBet=true; SC not natural; forced into row 2 col 3 |
| `seed-010` | Max win cap (30,000×) | Raw win exceeds 30,000×; capped at exactly 30,000× |

### §4.4 Test Data for 4 Scenarios

| Scenario | Symbol Weight Fixture | coinProbs | entryProb | Max Win Cap |
|----------|-----------------------|-----------|-----------|-------------|
| Main Game (Extra Bet Off) | `weights.mainGame` | [0.80, 0.68, 0.56, 0.48, 0.40] | 0.009624 | 30,000× baseBet |
| Main Game (Extra Bet On) | `weights.extraBet` | [0.80, 0.68, 0.56, 0.48, 0.40] | 0.009624 | 30,000× baseBet |
| Free Game (Buy FG Off) | `weights.freeGame` | [0.80, 0.68, 0.56, 0.48, 0.40] | 0.009081 (ref only) | 30,000× baseBet |
| Buy Free Game (Buy FG On) | `weights.buyFG` | all 1.00 (guaranteed) | bypass | 90,000× baseBet |

---

## §5 Test Environment

### §5.1 Local Development Environment

| Component | Setup | Notes |
|-----------|-------|-------|
| Node.js | 20 LTS (`nvm use 20`) | Required runtime |
| PostgreSQL | `docker compose up supabase` | Supabase local stack (port 54322) |
| Redis | `docker compose up redis` | Redis 7 on localhost:6379 |
| Backend | `pnpm dev` | Fastify with hot reload (`tsx watch`) |
| Frontend | `cocos-creator --open .` or `npx vite` | Cocos or PixiJS dev server |
| RNG seed injection | `TEST_RNG_SEED=seed-001 pnpm test:unit` | Environment variable for deterministic tests |

```bash
# One-command local test setup
docker compose -f docker-compose.test.yml up -d
pnpm install
pnpm run db:migrate:test
pnpm test:unit
pnpm test:integration
```

### §5.2 CI Environment (GitHub Actions)

```yaml
# .github/workflows/test.yml (abbreviated)
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports: ['54322:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run db:migrate:test
      - run: pnpm test:unit --coverage
      - run: pnpm test:integration
      - run: pnpm test:e2e (on staging only)
```

**CI resource allocation:** 4 vCPU, 16 GB RAM, Ubuntu 24.04. Test suite target completion: < 10 minutes.

### §5.3 Staging Environment (K8s)

| Component | Spec | Notes |
|-----------|------|-------|
| K8s Namespace | `thunder-staging` | Mirror of prod; 2 API replicas |
| API replicas | 2 | HPA 2/4 |
| PostgreSQL | Supabase Pro (yyy instance) | Separate project from prod |
| Redis | Upstash Hobby | Staging tier |
| Deployment | Blue-Green | Zero-downtime staging deploys |
| E2E suite | Playwright in CI against staging URL | Runs after staging deploy |
| k6 load tests | Run against staging API | Performance gate before prod promotion |

**Staging environment setup commands:**
```bash
kubectl apply -f k8s/staging/
kubectl rollout status deployment/thunder-api -n thunder-staging
pnpm test:e2e --base-url=https://api-staging.thunderblessing.example.com
pnpm test:load:smoke --target=https://api-staging.thunderblessing.example.com
```

### §5.4 Environment Setup Commands

```bash
# Fresh local setup
git clone <repo> && cd thunder-blessing
nvm use 20
pnpm install
cp .env.test.example .env.test

# Start local dependencies
docker compose -f docker-compose.test.yml up -d

# Run DB migrations on test DB
pnpm run db:migrate:test

# Full test suite (unit + integration)
pnpm test

# Individual test layers
pnpm test:unit               # Vitest unit tests
pnpm test:integration        # Vitest integration tests (requires DB + Redis)
pnpm test:e2e                # Playwright (requires staging URL or local server)
pnpm test:perf:smoke         # k6 smoke test
pnpm test:rtp:fast           # 100k Monte Carlo RTP check
pnpm test:rtp:full           # 1M Monte Carlo verify.js (nightly only)
pnpm test:security:audit     # npm audit + semgrep
```

---

## §6 Entry/Exit Criteria

### §6.1 Entry Criteria

All conditions must be satisfied before a test phase may begin:

| # | Condition | Measurement | Phase |
|---|-----------|-------------|-------|
| EC-01 | All code changes have passed peer code review (at least 1 approved reviewer on PR) | GitHub PR approved status | Unit, Integration, E2E |
| EC-02 | Unit test coverage ≥ 80% line and branch on `src/domain/**` and `src/application/**` | Vitest coverage report in CI | Integration, E2E |
| EC-03 | Staging environment is available and healthy (`GET /ready` returns HTTP 200) | CI step: `curl https://api-staging.../ready` | E2E, Performance |
| EC-04 | `verify.js` has passed all 4 scenarios for the current `engine_config.json` | `verify.js` output in CI log shows ✅ for all 4 | Any test involving probability |
| EC-05 | No CRITICAL open defects from previous test phase | JIRA/defect tracker: 0 CRITICAL open | Each successive phase |
| EC-06 | Test data factories and seed fixtures are committed and reviewed | File presence in `test/factories/` and `test/fixtures/` | Integration, E2E |
| EC-07 | K8s staging namespace is at green state (0 pod restarts in last 1 hour) | `kubectl get pods -n thunder-staging` | Performance, E2E |

### §6.2 Exit Criteria

All conditions must be satisfied before a test phase is considered complete and sign-off is granted:

| # | Condition | Measurement | Blocking? |
|---|-----------|-------------|-----------|
| EX-01 | All P0 test cases (TC-UNIT, TC-INT, TC-E2E) pass with no failures | 100% pass rate on P0 TCs | YES |
| EX-02 | 0 CRITICAL defects in open state | Defect tracker: CRITICAL count = 0 | YES |
| EX-03 | Line and branch coverage ≥ 80% on domain + application layers | Vitest coverage report | YES |
| EX-04 | `verify.js` reports PASS for all 4 scenarios (1,000,000 spins each, ±1% RTP) | `verify.js` exit code 0 | YES |
| EX-05 | API P99 latency ≤ 500ms (no FG), ≤ 800ms (FG) under 500 concurrent users for 10 minutes | k6 load test report | YES |
| EX-06 | Error rate < 0.5% under 500 concurrent users sustained for 2 hours (soak test) | k6 soak test report | YES |
| EX-07 | 0 HIGH-severity OWASP ZAP findings on staging | ZAP HTML report | YES |
| EX-08 | All P1 defects are documented with resolution plan (fix or accepted risk) | Defect tracker: all P1 have resolution field populated | NO (soft gate) |
| EX-09 | Visual regression baselines approved by Art Director for key screens | Percy dashboard: all snapshots approved | NO (soft gate) |

---

## §7 Risk Assessment

### §7.1 Risk Table

| Risk ID | Description | Category | Probability | Impact | Risk Score | Mitigation | Contingency |
|---------|-------------|----------|:-----------:|:------:|:----------:|-----------|-------------|
| RISK-01 | RTP miscalculation — symbol weights mis-mapped to wrong scenario, causing RTP drift > ±1% | Probability | Medium | Critical | HIGH | Enforce `verify.js` hard gate in CI; cross-scenario weight contamination test (TC-UNIT-PROB-003); 4-scenario isolation unit tests | Re-run full toolchain with corrected Excel; hotfix deploy blocked until `verify.js` PASS |
| RISK-02 | Cascade boundary overflow — rows exceed 6 due to off-by-one in `expandRows()` | Game Logic | Low | High | MEDIUM | Unit test TC-UNIT-CASC-006 validates MAX_ROWS boundary; property-based test generates random cascade depths | Cap rows at 6 defensively in engine code; add runtime assertion in `SlotEngine.spin()` |
| RISK-03 | Free Game sequence corruption — Lightning Marks incorrectly reset mid-FG or not inherited from Main Game | Game Logic | Medium | High | HIGH | Integration test TC-INT-FG-003 verifies mark persistence across FG rounds; TC-INT-FG-004 verifies marks clear at FG end | Redis FG session read fallback from PostgreSQL `fg_sessions` table |
| RISK-04 | Redis cache stampede — concurrent FG session reads after Redis eviction cause DB overload | Infrastructure | Low | High | MEDIUM | ConcurrencyLockGuard (Redis NX lock) prevents concurrent spins; circuit breaker on DB (ARCH §5.2); integration test TC-INT-REDIS-002 | Increase Redis TTL to 3600s; enable Redis persistence (AOF mode) for staging/prod |
| RISK-05 | Wallet double-debit — retry on timeout causes duplicate `debit()` call | Financial | Low | Critical | HIGH | Idempotency key on `wallet_transactions`; `FOR UPDATE` lock in DB transaction; TC-INT-WALLET-005 tests idempotent retry | Automated reconciliation job detects discrepancy within 1 minute; compensating credit issued |
| RISK-06 | Buy Feature session floor not applied — `SessionFloorGuard.applyFloor()` returns raw win below 20× baseBet | Game Logic | Low | High | MEDIUM | TC-UNIT-FLOOR-001 tests floor enforcement; TC-INT-BUYF-003 end-to-end floor application; property test: 10,000 BuyFG simulations all satisfy floor | Manual QA checklist: floor always verified in Buy Feature regression suite |
| RISK-07 | `GameConfig.generated.ts` manual edit in production — config drift from Excel source | Config Integrity | Low | High | MEDIUM | CI SHA-256 checksum guard (QG-11); git pre-commit hook rejects modifications; TC-INT-CONFIG-001 | Regenerate config from Excel and redeploy; rotate affected sessions |
| RISK-08 | Thunder Blessing second hit upgrade path incorrect — L1/L2/L3/L4 upgrade path skips P4 | Game Logic | Low | High | MEDIUM | TC-UNIT-TB-004 tests every symbol upgrade path including boundary cases; table-driven test for all symbol transitions | Hotfix `ThunderBlessingHandler.upgradeSymbol()` with correct jump table |
| RISK-09 | Coin Toss probability stage index off-by-one — `coinProbs[stage]` references wrong index | Probability | Medium | High | HIGH | TC-UNIT-COIN-006 validates each stage (0–4) independently; Monte Carlo distribution test on Coin Toss outcomes | Re-index `stage` offset in `CoinTossEvaluator.evaluate()`; re-verify with `verify.js` |
| RISK-10 | Single-trip API regression — multi-round FG response truncated due to serialization size limit | API | Low | Medium | MEDIUM | TC-INT-API-010 asserts `fgRounds.length` for Buy Feature (must be 5); response size monitoring in k6 | Increase Fastify `bodyLimit` if needed; stream large FG responses |

---

## §8 Schedule

### §8.1 Test Phases and Timeline

| Phase | Activities | Duration | Dependencies |
|-------|-----------|---------|-------------|
| **Phase 0: Test Infrastructure Setup** | Configure Vitest, Supertest, Playwright, k6; create factory functions and seed fixtures; set up CI pipeline (GitHub Actions); configure test DB and Redis | 3 days | Repository scaffolding complete |
| **Phase 1: Unit Testing** | Write and execute all TC-UNIT test cases (≥ 200 TCs); achieve ≥ 80% coverage; probability/RTP Monte Carlo sanity check (100k spins) | 5 days | Phase 0 complete; domain modules coded |
| **Phase 2: Integration Testing** | Write and execute all TC-INT test cases (≥ 60 TCs); API contract testing with Supertest; DB schema tests; Redis session tests | 4 days | Phase 1 pass; staging DB available |
| **Phase 3: E2E Testing** | Write and execute all TC-E2E test cases (≥ 30 TCs) with Playwright; visual regression baselines captured in Percy | 4 days | Phase 2 pass; staging fully deployed |
| **Phase 4: Security Testing** | OWASP ZAP scan on staging; npm audit; Semgrep SAST; JWT boundary tests; betting manipulation tests | 2 days | Phase 2 pass; staging deployed |
| **Phase 5: Performance Testing** | k6 smoke, load, stress, and soak tests on staging; SLO gate validation | 3 days | Phase 2 pass; staging deployed |
| **Phase 6: Full RTP Verification** | `verify.js` 1M Monte Carlo for all 4 scenarios; FG Bonus multiplier distribution check | 1 day (compute: ~4 hours) | Phase 1 pass; toolchain validated |
| **Phase 7: Regression + Smoke** | Full regression suite execution; nightly automation confirmed; pre-release smoke tests | 2 days | Phases 1–6 complete |

**Total estimated test duration:** 24 days (can parallelize Phases 4–6 once Phase 2 is complete).

### §8.2 Milestone Dependencies

```
Phase 0 (Infra Setup)
    │
    ▼
Phase 1 (Unit Tests) ────────────────────────── Phase 6 (RTP Verification)
    │                                                   │
    ▼                                                   │
Phase 2 (Integration Tests)                            │
    │    │    │                                         │
    │    ▼    ▼                                         │
    │  Phase 4  Phase 5                                 │
    │  (Security) (Perf)                                │
    ▼                                                   ▼
Phase 3 (E2E Tests)                              All phases complete
    │                                                   │
    ▼                                                   ▼
Phase 7 (Regression + Smoke) ─────────────────► Production Release
```

---

## §9 Unit Test Plan

### §9.1 Coverage Target

| Scope | Line Coverage | Branch Coverage | Enforcement |
|-------|:-----------:|:-------------:|------------|
| `src/domain/**` | ≥ 80% | ≥ 80% | CI gate QG-02/03 |
| `src/application/**` | ≥ 80% | ≥ 80% | CI gate QG-02/03 |
| `src/infrastructure/**` | ≥ 70% | ≥ 70% | Informational (complex mocking) |
| `src/interface/**` | ≥ 60% | ≥ 60% | Informational (thin route layer) |

Coverage is measured by `@vitest/coverage-v8`. Reports are published as HTML artifacts in CI.

### §9.2 Critical Modules

| Module | File | Key Methods Under Test |
|--------|------|----------------------|
| Probability Engine | `GameConfig.generated.ts` (loader) | config loading, weight sum validation |
| Cascade Logic | `CascadeEngine.ts` | `runCascade()`, `detectWinLines()`, `eliminateSymbols()`, `expandRows()` |
| Lightning Mark Tracker | `CascadeEngine.ts` + `LightningMarkSet.ts` | mark generation, deduplication, persistence across steps |
| Thunder Blessing Handler | `ThunderBlessingHandler.ts` | `evaluate()`, `applyFirstHit()`, `applySecondHit()`, `upgradeSymbol()` |
| FG Multiplier Sequencer | `FreeGameOrchestrator.ts` | `runSequence()`, `drawBonusMultiplier()`, multiplier stage transitions |
| Coin Toss Resolver | `CoinTossEvaluator.ts` | `evaluate(rng, config, stage)`, `isHeads()`, stage index accuracy |
| Session Floor Guard | `SessionFloorGuard.ts` | `applyFloor()`, `isFloorActive()`, 20× baseBet enforcement |
| Max Win Enforcer | `SlotEngine.ts` → `enforceMaxWin()` | 30,000× and 90,000× cap scenarios |
| Near Miss Selector | `NearMissSelector.ts` | `select()`, grid integrity post-selection |
| Currency Formatter | `CurrencyFormatter.ts` | USD and TWD formatting from `BetRangeConfig` |

### §9.3 Test Cases

**TC-ID Format:** `TC-UNIT-{MODULE}-{SEQ}-{PATH}` where PATH = HAPPY / ERROR / BOUNDARY

| TC-ID | Module | Description | Path | Priority |
|-------|--------|-------------|------|----------|
| TC-UNIT-PROB-001-HAPPY | Probability | Symbol weight tables load correctly for all 4 scenarios; total weight = 90 per scenario | Happy | P0 |
| TC-UNIT-PROB-002-BOUNDARY | Probability | Cross-scenario weight isolation: extraBet weights must not be used in mainGame scenario | Boundary | P0 |
| TC-UNIT-PROB-003-ERROR | Probability | `assertValidGameConfig()` throws on missing `fgMults` field | Error | P0 |
| TC-UNIT-CASC-001-HAPPY | CascadeEngine | `runCascade()` with 3-win cascade: rows expand 3→4→5→6, lightningMarks count = winning positions | Happy | P0 |
| TC-UNIT-CASC-002-HAPPY | CascadeEngine | `detectWinLines()` returns correct payline hits for 5×3 grid with known Wild placement | Happy | P0 |
| TC-UNIT-CASC-003-HAPPY | CascadeEngine | `eliminateSymbols()` clears exactly the winning positions; null/empty cells filled by gravity | Happy | P0 |
| TC-UNIT-CASC-004-HAPPY | CascadeEngine | `expandRows()` increments rows from 4→5; payline count updates from 33→45 | Happy | P0 |
| TC-UNIT-CASC-005-ERROR | CascadeEngine | `runCascade()` with 51 cascade depth: terminates with ERROR log; returns partial `CascadeSequence` | Error | P0 |
| TC-UNIT-CASC-006-BOUNDARY | CascadeEngine | `expandRows()` at rows=6: rows stays 6, paylines stays 57; no further expansion | Boundary | P0 |
| TC-UNIT-CASC-007-BOUNDARY | CascadeEngine | Lightning Mark deduplication: winning position that wins in 2 consecutive cascades produces only 1 mark | Boundary | P0 |
| TC-UNIT-CASC-008-HAPPY | CascadeEngine | Main Game: `lightningMarks` cleared at start of new spin (not carried over) | Happy | P0 |
| TC-UNIT-TB-001-HAPPY | ThunderBlessingHandler | First hit: all mark positions replaced with same random premium symbol; `selectedSymbol` in result | Happy | P0 |
| TC-UNIT-TB-002-HAPPY | ThunderBlessingHandler | Second hit triggered (RNG=0.20 < tbSecondHit=0.40): L4 symbol on mark upgrades to P4 | Happy | P0 |
| TC-UNIT-TB-003-HAPPY | ThunderBlessingHandler | Second hit NOT triggered (RNG=0.80 > 0.40): mark symbols remain at first-hit level | Happy | P0 |
| TC-UNIT-TB-004-BOUNDARY | ThunderBlessingHandler | Upgrade path: P1→P1 (no change); P2→P1; P3→P2; P4→P3; L1/L2/L3/L4→P4 | Boundary | P0 |
| TC-UNIT-TB-005-ERROR | ThunderBlessingHandler | SC falls with no lightning marks: `evaluate()` returns `triggered=false`; no symbol modification | Error | P0 |
| TC-UNIT-COIN-001-HAPPY | CoinTossEvaluator | `evaluate(0.50, config, 0)`: coinProbs[0]=0.80 → Heads (0.50 < 0.80) | Happy | P0 |
| TC-UNIT-COIN-002-HAPPY | CoinTossEvaluator | `evaluate(0.85, config, 0)`: coinProbs[0]=0.80 → Tails (0.85 ≥ 0.80) | Happy | P0 |
| TC-UNIT-COIN-003-BOUNDARY | CoinTossEvaluator | Stage boundaries: stage 0→4 correctly maps to coinProbs [0.80, 0.68, 0.56, 0.48, 0.40] | Boundary | P0 |
| TC-UNIT-COIN-004-HAPPY | CoinTossEvaluator | Buy Feature mode: `entryBuy=1.00` always returns Heads regardless of RNG value | Happy | P0 |
| TC-UNIT-COIN-005-BOUNDARY | CoinTossEvaluator | `rows < 6`: Coin Toss must not be invoked; engine guard assertion verified | Boundary | P0 |
| TC-UNIT-FG-001-HAPPY | FreeGameOrchestrator | `runSequence()` Buy Feature (5 guaranteed Heads): `fgRounds.length === 5`; multipliers [3,7,17,27,77] | Happy | P0 |
| TC-UNIT-FG-002-HAPPY | FreeGameOrchestrator | `drawBonusMultiplier()` draws from weights {900:×1, 80:×5, 15:×20, 5:×100}; returns valid multiplier | Happy | P0 |
| TC-UNIT-FG-003-HAPPY | FreeGameOrchestrator | FG Bonus multiplier drawn once (before round 1); same value in all `fgRounds[n].bonusMultiplier` | Happy | P0 |
| TC-UNIT-FG-004-BOUNDARY | FreeGameOrchestrator | ×77 is max: after 5th Heads, additional Heads maintains ×77; does not produce ×78 or higher | Boundary | P0 |
| TC-UNIT-FG-005-HAPPY | FreeGameOrchestrator | Tails at ×17: FG ends; `fgRounds` contains only 2 rounds (×3 round + ×7 round + Tails stops before ×17) | Happy | P0 |
| TC-UNIT-FLOOR-001-HAPPY | SessionFloorGuard | `applyFloor()`: totalFGWin=10 × baseBet=1.00 → adjustedWin=20.00 (floor applied) | Happy | P0 |
| TC-UNIT-FLOOR-002-BOUNDARY | SessionFloorGuard | `applyFloor()`: totalFGWin=20 × baseBet=1.00 → adjustedWin=20.00 (exactly at floor; no change) | Boundary | P0 |
| TC-UNIT-FLOOR-003-HAPPY | SessionFloorGuard | `applyFloor()`: totalFGWin=500 → adjustedWin=500 (above floor; floor not applied) | Happy | P0 |
| TC-UNIT-MAXWIN-001-BOUNDARY | SlotEngine | Main Game: raw win 35,000× baseBet is capped to 30,000× baseBet | Boundary | P0 |
| TC-UNIT-MAXWIN-002-BOUNDARY | SlotEngine | EBBuyFG: raw win 95,000× baseBet is capped to 90,000× baseBet | Boundary | P0 |

---

## §10 Integration Test Plan

### §10.1 API Contract Testing

Every P0 API endpoint requires a happy-path 200 test and at least one error-path test.

| Endpoint | Happy Path Status | Key Error Status Codes |
|----------|:---------------:|----------------------|
| `POST /v1/spin` | 200 with `FullSpinOutcome` | 400 (INSUFFICIENT_FUNDS, INVALID_BET_LEVEL, INVALID_CURRENCY), 401 (UNAUTHORIZED), 403 (FORBIDDEN), 409 (SPIN_IN_PROGRESS), 422 (VALIDATION_ERROR), 429 (RATE_LIMITED) |
| `GET /v1/session/:sessionId` | 200 with session state | 401, 403, 404 (SESSION_NOT_FOUND) |
| `GET /v1/config` | 200 with bet ranges | 401 |
| `GET /health` | 200 `{"status":"ok"}` | N/A (no auth) |
| `GET /ready` | 200 when DB + Redis healthy | 503 (SERVICE_UNAVAILABLE) when DB/Redis down |

**Response schema validation:** All responses are validated against OpenAPI-derived JSON Schema using `ajv`. Schema mismatch = test FAIL.

### §10.2 Database Integration

| Test Target | Constraint Tested |
|-------------|------------------|
| `players` table | `balance CHECK (balance >= 0)` — debit below zero rejected at DB level |
| `players` table | `currency CHECK (currency IN ('USD', 'TWD'))` — invalid currency rejected |
| `wallet_transactions` | Append-only: no UPDATE or DELETE permitted by player role |
| `spin_logs` | FK: `player_id REFERENCES players(id)` — orphaned insert rejected |
| `fg_sessions` | `session_id UNIQUE NOT NULL` — duplicate session_id rejected |
| `fg_sessions` | `status CHECK (status IN ('ACTIVE', 'COMPLETE'))` — invalid status rejected |
| Wallet atomicity | Debit + `wallet_transactions` INSERT inside same DB transaction; ROLLBACK on engine failure |

### §10.3 Redis Cache Integration

| Test Target | Behavior Tested |
|-------------|----------------|
| Session state persistence | FG session saved to Redis on FG entry; retrieved correctly on reconnect |
| Session lock NX | Two concurrent spin requests for same session: first acquires lock, second returns 409 |
| Session TTL | Session state expires after 1800s; `GET /v1/session/:sessionId` returns 404 after expiry |
| Redis disconnect | Circuit breaker OPEN on Redis failure; `POST /v1/spin` returns 503 within 5 seconds |
| Lock release | Lock released after spin completes (success or error); next spin can proceed |
| Rate limit counter | 6th request within 1 second: HTTP 429 with `Retry-After: 1` header |

### §10.4 TC-INT Test Cases

| TC-ID | Endpoint / Module | Description | Path | Priority |
|-------|-------------------|-------------|------|----------|
| TC-INT-API-001-HAPPY | POST /v1/spin | Valid JWT, balance≥baseBet, extraBet=false: 200 with `FullSpinOutcome`; `totalWin` in response | Happy | P0 |
| TC-INT-API-002-ERROR | POST /v1/spin | No Authorization header: 401 UNAUTHORIZED | Error | P0 |
| TC-INT-API-003-ERROR | POST /v1/spin | Expired JWT (exp in past): 401 UNAUTHORIZED | Error | P0 |
| TC-INT-API-004-ERROR | POST /v1/spin | Balance = 0, betLevel=7: 400 INSUFFICIENT_FUNDS | Error | P0 |
| TC-INT-API-005-ERROR | POST /v1/spin | betLevel=999 (exceeds USD max=20): 400 INVALID_BET_LEVEL | Error | P0 |
| TC-INT-API-006-ERROR | POST /v1/spin | currency="EUR" (unsupported): 400 INVALID_CURRENCY | Error | P0 |
| TC-INT-API-007-ERROR | POST /v1/spin | Second concurrent spin from same session: 409 SPIN_IN_PROGRESS | Error | P0 |
| TC-INT-API-008-ERROR | POST /v1/spin | 6 requests in 1 second from same player: 429 RATE_LIMITED with `Retry-After` header | Error | P0 |
| TC-INT-API-009-HAPPY | POST /v1/spin | buyFeature=true, balance≥100×baseBet: 200 with `fgRounds.length === 5`, `sessionFloorApplied` field present | Happy | P0 |
| TC-INT-API-010-HAPPY | POST /v1/spin | Full FG sequence in single response: `fgRounds` array contains all completed rounds; no additional request needed | Happy | P0 |
| TC-INT-API-011-ERROR | POST /v1/spin | Suspended player (`is_suspended=true`): 403 FORBIDDEN | Error | P0 |
| TC-INT-API-012-HAPPY | GET /v1/session/:sessionId | FG session in Redis: 200 with correct `fg_multiplier`, `lightning_marks`, `fg_bonus_mult` | Happy | P1 |
| TC-INT-API-013-ERROR | GET /v1/session/:sessionId | Non-existent or expired session: 404 SESSION_NOT_FOUND | Error | P0 |
| TC-INT-WALLET-001-HAPPY | SupabaseWalletRepository | `debit()` decrements balance by exact baseBet; `wallet_transactions` row inserted | Happy | P0 |
| TC-INT-WALLET-002-HAPPY | SupabaseWalletRepository | `credit()` increments balance by exact `totalWin`; `wallet_transactions` row inserted | Happy | P0 |
| TC-INT-WALLET-003-ERROR | SupabaseWalletRepository | `debit()` when balance = 0: DB CHECK constraint fires; balance not decremented | Error | P0 |
| TC-INT-WALLET-004-HAPPY | SupabaseWalletRepository | Debit + credit in same spin: net balance change = `totalWin - baseBet` | Happy | P0 |
| TC-INT-WALLET-005-HAPPY | SupabaseWalletRepository | Idempotent retry: same idempotency key deduplicates duplicate credit insert | Happy | P0 |
| TC-INT-DB-001-HAPPY | spin_logs | `outcome JSONB` field stores complete `FullSpinOutcome`; retrievable and deserializable | Happy | P0 |
| TC-INT-DB-002-ERROR | spin_logs | INSERT with non-existent `player_id`: FK violation; insert rejected | Error | P0 |
| TC-INT-REDIS-001-HAPPY | RedisSessionCache | `set()` then `get()` returns identical session state; TTL set to 1800s | Happy | P0 |
| TC-INT-REDIS-002-HAPPY | ConcurrencyLockGuard | `acquireLock()` returns true for first caller; false for concurrent caller on same session | Happy | P0 |
| TC-INT-FG-001-HAPPY | FreeGameOrchestrator | FG entry: Lightning Marks from main game cascade are present in `fgRounds[0].lightningMarksBefore` | Happy | P0 |
| TC-INT-FG-002-HAPPY | FreeGameOrchestrator | FG round 2: marks from round 1 cascade accumulated in `fgRounds[1].lightningMarksBefore` | Happy | P0 |
| TC-INT-FG-003-HAPPY | FreeGameOrchestrator | FG end (Tails): `lightningMarks = []` in `FullSpinOutcome`; marks not in subsequent spin response | Happy | P0 |
| TC-INT-BUYF-001-HAPPY | BuyFeatureUseCase | Buy Feature: wallet debited by `100 × baseBet`; `fgRounds.length === 5` | Happy | P0 |
| TC-INT-BUYF-002-ERROR | BuyFeatureUseCase | Buy Feature with extraBet ON: wallet debited by `300 × baseBet` | Error | P0 |
| TC-INT-BUYF-003-HAPPY | SessionFloorGuard | Buy Feature with low win: `totalWin ≥ 20 × baseBet`; `sessionFloorApplied: true` | Happy | P0 |

---

## §11 E2E Test Plan

### §11.1 Critical User Flows (from FRONTEND.md)

| Flow ID | Flow Name | Entry Point | Key Steps | Exit Condition |
|---------|-----------|-------------|-----------|----------------|
| FLOW-01 | Basic Spin (no FG) | GameScene loaded, balance ≥ baseBet | Click Spin → wait for reel stop → verify totalWin displayed | `outcome.totalWin` displayed correctly; balance updated |
| FLOW-02 | Cascade Chain (3 steps) | Fixed RNG seed `seed-002` | Spin → observe 3 cascade eliminations → verify row expansion animation | rows=6 displayed; lightning marks visible |
| FLOW-03 | Extra Bet toggle + spin | Lobby → Extra Bet ON | Toggle Extra Bet ON → verify cost display ×3 → Spin → SC visible in result | SC appears in every spin; cost = baseBet × 3 |
| FLOW-04 | Thunder Blessing sequence | Seed `seed-003` | Spin → cascade → SC falls → first hit animation → symbol upgrade | Mark positions replaced with same premium symbol |
| FLOW-05 | Coin Toss → FG entry | Seed `seed-005` | Cascade to rows=6 → Coin Toss animation → Heads → FG entry fanfare | FG entry screen with ×3 multiplier displayed |
| FLOW-06 | Full FG sequence (Buy Feature) | Buy Feature button | Click Buy Feature → confirm cost → FG entry → 5 rounds → result | `fgRounds.length === 5`; correct multiplier per round displayed |
| FLOW-07 | FG multiplier progression | Seed `seed-006` | Enter FG → Heads consecutive → multiplier HUD updates ×3→×7→×17→×27→×77 | HUD shows correct multiplier at each stage |
| FLOW-08 | Insufficient balance error | balance = 0 | Click Spin → error modal appears | "Insufficient balance" error displayed; no spin executed |
| FLOW-09 | Concurrent spin prevention | Active spin in progress | Click Spin again during animation | Spin button locked; second click ignored |
| FLOW-10 | Session reconnect (FG in progress) | Disconnect during FG | Close browser → reopen → reconnect | FG state restored; correct multiplier and marks displayed |

### §11.2 Playwright Test Scenarios

```typescript
// test/e2e/spin-basic.spec.ts (example)
import { test, expect } from '@playwright/test';

test('basic spin returns totalWin and updates balance', async ({ page }) => {
  await page.goto('/game');
  await page.waitForSelector('[data-testid="spin-button"]');
  const balanceBefore = await page.locator('[data-testid="balance-display"]').textContent();
  await page.click('[data-testid="spin-button"]');
  await page.waitForSelector('[data-testid="spin-result"]');
  const balanceAfter = await page.locator('[data-testid="balance-display"]').textContent();
  // Balance should differ by (totalWin - baseBet)
  expect(balanceBefore).not.toBe(balanceAfter);
  // Spin button re-enabled after result
  await expect(page.locator('[data-testid="spin-button"]')).toBeEnabled();
});
```

**Playwright configuration:**
- `baseURL`: set to staging URL in CI; `localhost:3000` for local
- `retries: 1` in CI (flake tolerance)
- Timeout per test: 30 seconds
- `video: 'retain-on-failure'` for debugging
- `screenshot: 'only-on-failure'`

### §11.3 Visual Regression Testing Targets

| Target | Breakpoints | Percy Snapshot Name |
|--------|------------|---------------------|
| GameScene — idle state | 320, 768, 1024, 1440 | `game-idle-{width}` |
| GameScene — cascade step 1 (row=4) | 768, 1440 | `cascade-step1-{width}` |
| GameScene — rows=6 (max expansion) | 768, 1440 | `cascade-max-rows-{width}` |
| Thunder Blessing — first hit activated | 1440 | `tb-first-hit` |
| Thunder Blessing — second hit (upgrade) | 1440 | `tb-second-hit` |
| Coin Toss — Heads result overlay | 768, 1440 | `coin-toss-heads-{width}` |
| FG entry fanfare (×3 multiplier) | 768, 1440 | `fg-entry-{width}` |
| FG HUD — ×77 multiplier state | 1440 | `fg-mult-77` |
| FG Bonus reveal (×100 bonus) | 1440 | `fg-bonus-100` |
| Buy Feature result (floor applied) | 1440 | `buyfeature-floor-applied` |
| Error modal (insufficient balance) | 375, 1440 | `error-insufficient-funds-{width}` |
| Extra Bet ON state (bet panel) | 375, 1440 | `extra-bet-on-{width}` |

### §11.4 TC-E2E Test Cases

| TC-ID | Flow | Description | Path | Priority |
|-------|------|-------------|------|----------|
| TC-E2E-SPIN-001-HAPPY | FLOW-01 | Basic spin: reel stops, `totalWin` displayed, balance updated correctly | Happy | P0 |
| TC-E2E-SPIN-002-ERROR | FLOW-08 | Insufficient balance: error modal shown; no spin executed; Spin button stays enabled | Error | P0 |
| TC-E2E-SPIN-003-BOUNDARY | FLOW-09 | Concurrent spin: second click during animation ignored; Spin button locked | Boundary | P0 |
| TC-E2E-CASC-001-HAPPY | FLOW-02 | Cascade 3 steps: row expansion animation plays; lightning marks appear on grid | Happy | P0 |
| TC-E2E-TB-001-HAPPY | FLOW-04 | Thunder Blessing first hit: mark positions replaced with same symbol class; animation plays | Happy | P0 |
| TC-E2E-EXBT-001-HAPPY | FLOW-03 | Extra Bet ON: cost display shows baseBet×3; SC appears in every spin result | Happy | P0 |
| TC-E2E-COIN-001-HAPPY | FLOW-05 | Coin Toss Heads: FG entry fanfare plays; FG HUD shows ×3 multiplier | Happy | P0 |
| TC-E2E-FG-001-HAPPY | FLOW-06 | Buy Feature full FG: 5 FG rounds played; multipliers progress correctly; result screen shows totalWin | Happy | P0 |
| TC-E2E-FG-002-HAPPY | FLOW-07 | FG multiplier HUD: each consecutive Heads updates multiplier display ×3→×7→×17→×27→×77 | Happy | P0 |
| TC-E2E-FG-003-HAPPY | FLOW-10 | FG reconnect: refreshing browser during FG restores correct multiplier and mark positions | Happy | P1 |
| TC-E2E-VIS-001-HAPPY | Visual Regression | All visual regression snapshots match approved Percy baselines at 4 breakpoints | Happy | P1 |
| TC-E2E-PURE-001-HAPPY | FLOW-01 | Pure View: `window.__debug_clientComputedWin` is undefined (no client-side win calculation) | Happy | P0 |

---

## §12 Security Test Plan

### §12.1 OWASP A01–A10 Coverage Plan

| OWASP Code | Threat | Test Method | Pass Criteria |
|-----------|--------|-------------|--------------|
| **A01 — Broken Access Control** | Player accessing another player's spin logs or session | Integration test: Player A's JWT requesting `/v1/session/:sessionId_B` | Returns 403 FORBIDDEN; no data leaked |
| A01 | Operator role attempting `POST /v1/spin` | Integration test: operator-role JWT on spin endpoint | Returns 403 FORBIDDEN |
| **A02 — Cryptographic Failures** | Weak or self-signed JWT | Integration test: JWT signed with HS256 (wrong algorithm) | Returns 401 UNAUTHORIZED |
| A02 | Plaintext HTTP (non-HTTPS) | OWASP ZAP active scan | TLS enforced; HTTP connections rejected at ingress |
| **A03 — Injection** | SQL injection via `betLevel` parameter | Send `betLevel: "1'; DROP TABLE players;--"` | Returns 400 VALIDATION_ERROR; no DB effect |
| A03 | NoSQL injection via `sessionId` | Send `sessionId: {"$gt": ""}` | Returns 400 VALIDATION_ERROR |
| **A04 — Insecure Design** | Double-spend via duplicate concurrent spin | Send 2 concurrent POSTs with same sessionId | Second returns 409; wallet debited exactly once |
| A04 | Race condition on wallet debit | k6 concurrent-user test targeting same player | Balance never goes negative; `CHECK (balance >= 0)` never violated |
| **A05 — Security Misconfiguration** | Default Fastify headers exposing server info | Check `X-Powered-By` and `Server` headers | Headers removed or replaced with non-identifying values |
| A05 | Open K8s ports (non-HTTPS) | Port scan on staging K8s NodePort | Only 443 and health probe port accessible |
| **A06 — Vulnerable Components** | Known CVE in npm dependencies | `npm audit --audit-level=high` in CI | 0 HIGH or CRITICAL CVEs in production dependencies |
| A06 | Outdated Fastify or Supabase client | Dependabot alerts | No dependency >90 days old with unresolved HIGH CVE |
| **A07 — Auth Failures** | Brute-force spin with invalid JWTs | 100 rapid requests with forged JWT | All return 401; no successful auth bypass |
| A07 | Expired token reuse | Replay captured JWT after expiry | Returns 401 UNAUTHORIZED |
| **A08 — Software Integrity** | Manual modification of `GameConfig.generated.ts` | Mutate file, run CI | CI build fails with checksum mismatch error |
| A08 | Supply chain attack via `npm install` | `npm ci --ignore-scripts` in CI; package-lock.json committed | No un-reviewed script execution at install time |
| **A09 — Logging Failures** | Missing audit log for spin | Execute spin; check `spin_logs` table | Every spin has a corresponding `spin_logs` row with `outcome` JSONB |
| A09 | Sensitive data in logs (balance, JWT) | Search CI log output for PII patterns | No player balance or JWT token in application log output |
| **A10 — SSRF** | SSRF via crafted spin parameter containing URL | Send `sessionId: "http://169.254.169.254/latest/meta-data"` | Returns 400 VALIDATION_ERROR; no outbound HTTP from backend |

### §12.2 Authentication/Session Tests

| TC-ID | Test | Expected Result |
|-------|------|----------------|
| TC-SEC-AUTH-001 | Missing Authorization header on `POST /v1/spin` | 401 UNAUTHORIZED |
| TC-SEC-AUTH-002 | JWT with algorithm `"alg": "none"` | 401 UNAUTHORIZED (algorithm must be RS256) |
| TC-SEC-AUTH-003 | JWT with `exp` 1 second in past | 401 UNAUTHORIZED |
| TC-SEC-AUTH-004 | JWT with tampered `sub` claim (modified after signing) | 401 UNAUTHORIZED (signature mismatch) |
| TC-SEC-AUTH-005 | JWT with valid `sub` but `role: "service_role"` (forged) | 403 FORBIDDEN (role not player) |
| TC-SEC-SESSION-001 | FG session TTL: session expires after 1800s of inactivity | 404 SESSION_NOT_FOUND |
| TC-SEC-SESSION-002 | Session lock TTL: lock expires after 10s; new spin can proceed | New spin succeeds within 11s of stale lock creation |

### §12.3 Betting API Manipulation Prevention

| TC-ID | Attack Vector | Expected Defense |
|-------|--------------|-----------------|
| TC-SEC-BET-001 | `betLevel: -1` (negative bet) | 400 INVALID_BET_LEVEL |
| TC-SEC-BET-002 | `betLevel: 999999` (far exceeds max) | 400 INVALID_BET_LEVEL |
| TC-SEC-BET-003 | `totalWin` injected in request body (client attempting to set win) | Field ignored; `totalWin` computed solely by engine; response uses engine value |
| TC-SEC-BET-004 | `buyFeature: true` with `betLevel` at minimum (cost would be 100× = possible) | Accepted if balance sufficient; rejected with 400 if not |
| TC-SEC-BET-005 | Request replay attack (same request replayed 10 minutes later) | Redis lock released; spin executes but wallet balance check prevents over-debit |
| TC-SEC-BET-006 | `extraBet: true` combined with `buyFeature: true` (300× cost) | Accepted with correct 300× cost deduction; rejected if insufficient balance |

### §12.4 RNG Integrity Verification

| Test | Method | Acceptance Criteria |
|------|--------|---------------------|
| CSPRNG source | Code review: confirm `crypto.getRandomValues()` or Node.js `crypto.randomBytes()` used; no `Math.random()` in game-critical paths | 0 instances of `Math.random()` in `src/domain/` |
| RNG seed auditability | `rngSeed` field in `FullSpinOutcome` and `spin_logs.outcome` | Every spin log contains reproducible `rngSeed`; replaying with same seed produces identical `FullSpinOutcome` |
| Statistical distribution | Chi-squared test on 100,000 symbol draws per reel position per scenario | p-value > 0.05 (distribution consistent with expected weights) |
| Engine immutability | `verify.js` PASS gate + CI checksum on `GameConfig.generated.ts` | `verify.js` exits 0; checksum matches after deployment |

---

## §13 Performance Test Plan

All performance tests target the staging environment (`thunder-staging` K8s namespace, 2 replicas). SLO targets are sourced from ARCH §1.1 / EDD §5.

### §13.1 Smoke Test (5 users, 1 minute)

**Purpose:** Verify staging deployment is healthy before running heavier load tests.

| Parameter | Value |
|-----------|-------|
| Virtual Users (VUs) | 5 |
| Duration | 60 seconds |
| Ramp-up | 0 seconds (flat start) |
| Target endpoint | `POST /v1/spin` |
| Accept threshold | P99 ≤ 500ms; error rate < 1% |

**Pass criteria:** All requests return HTTP 200; no 5xx errors; P99 latency ≤ 500ms.

### §13.2 Load Test (500 concurrent, 10 minutes)

**Purpose:** Validate SLO targets under expected production load.

| Parameter | Value |
|-----------|-------|
| Virtual Users (VUs) | 500 |
| Duration | 10 minutes |
| Ramp-up | 2 minutes (0→500 VUs linear) |
| Ramp-down | 1 minute |
| Target endpoint | `POST /v1/spin` (mixed: 70% no FG, 20% FG, 10% Buy Feature) |

**SLO targets (from ARCH §1.1 / EDD):**

| Metric | Target |
|--------|--------|
| P50 latency (no FG) | ≤ 150ms |
| P95 latency (no FG) | ≤ 300ms |
| P99 latency (no FG) | ≤ 500ms |
| P99 latency (FG sequence) | ≤ 800ms |
| HTTP 5xx error rate | < 0.5% |
| HTTP 429 rate | < 5% (expected at rate limit boundary) |
| Wallet debit/credit discrepancy | 0 events |

### §13.3 Stress Test (2,000 concurrent peak)

**Purpose:** Find the breaking point and confirm graceful degradation (circuit breaker, 503 responses).

| Parameter | Value |
|-----------|-------|
| Virtual Users (VUs) | Ramp from 500 → 2000 over 5 minutes; hold 2000 for 5 minutes |
| Target endpoint | `POST /v1/spin` |
| HPA behavior | Monitor `kubectl get hpa -n thunder-staging`; expect scale-out to 4–8 replicas |
| Acceptance | System degrades gracefully; 503 returned (not hang); no data corruption; wallet balances consistent after test |

### §13.4 Soak Test (500 concurrent, 2 hours)

**Purpose:** Detect memory leaks, Redis connection pool exhaustion, and slow wallet drift over sustained load.

| Parameter | Value |
|-----------|-------|
| Virtual Users (VUs) | 500 (steady) |
| Duration | 2 hours |
| Metrics monitored | Memory RSS per pod (Grafana), Redis connection count, PostgreSQL connection pool, wallet reconciliation check every 10 minutes |
| Pass criteria | Error rate < 0.5% for full 2 hours; memory RSS stable (< 20% drift); 0 wallet discrepancy events |

### §13.5 k6 Script Skeleton for Spin Endpoint Load Test

See Appendix B for the complete runnable k6 script. Key structure:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '2m', target: 500 },  // ramp up
    { duration: '10m', target: 500 }, // steady load
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    'http_req_duration{type:spin_no_fg}': ['p(99)<500'],
    'http_req_duration{type:spin_fg}': ['p(99)<800'],
    'http_req_failed': ['rate<0.005'],
  },
};
```

---

## §14 Accessibility Test Plan

### §14.1 WCAG 2.1 AA Checklist

All accessibility tests target the game client (Cocos Creator / PixiJS web export) and HUD elements. Screen-level WCAG compliance applies to HUD, modals, and overlay elements rendered as DOM nodes.

| WCAG Criterion | Level | Test Method | Target Element | Pass Criteria |
|----------------|:-----:|------------|----------------|--------------|
| 1.1.1 Non-text Content | A | Manual + axe-core | All symbol images | `alt` text or `aria-label` on canvas elements; informative elements have meaningful description |
| 1.3.1 Info and Relationships | A | axe-core | Balance display, bet panel, win counter | Semantic HTML elements (`<output>`, `<label>`) for balance and bet amounts |
| 1.4.1 Use of Color | A | Manual | Lightning Mark state (gold→orange→white) | Color not sole indicator; brightness change also present (VDD §5.1 threshold system) |
| 1.4.3 Contrast (Minimum) | AA | axe-core + Colour Contrast Analyser | Win counter, balance text, bet label | Contrast ≥ 4.5:1 (text); ≥ 3:1 (large text/UI components) |
| 1.4.11 Non-text Contrast | AA | Manual | Spin button, Extra Bet toggle, Buy Feature button | UI component boundaries have ≥ 3:1 contrast against adjacent backgrounds |
| 2.1.1 Keyboard | A | Manual keyboard navigation | Spin button, Extra Bet toggle, Buy Feature, bet level controls | All interactive controls reachable via Tab; Enter/Space activates; Escape closes modals |
| 2.1.2 No Keyboard Trap | A | Manual | All modals and overlays | Tab cycles out of modal; Escape closes modal |
| 2.4.3 Focus Order | A | Manual | Tab order across HUD | Logical focus order: Bet Level → Extra Bet → Spin → Buy Feature |
| 2.4.7 Focus Visible | AA | Manual + axe-core | Spin button (ANIM §9.2) | Spin button shows visible focus ring (glow effect per ANIM §9.2); focus style not `outline: none` without replacement |
| 3.3.1 Error Identification | A | Manual | Insufficient balance modal | Error message identifies the issue in text (not just color/icon) |
| 4.1.2 Name, Role, Value | A | axe-core | Spin button, balance display, bet panel | `role`, `aria-label`, and `aria-live` attributes on dynamic elements |

### §14.2 Reduced Motion Testing

**Source requirement:** ANIM §1.3, FRONTEND.md, VDD accessibility sections.

```css
/* Verify this media query is respected in game client */
@media (prefers-reduced-motion: reduce) {
  /* Cascade elimination: disable particle explosion; use simple fade */
  /* Lightning Mark: disable pulse animation; static display only */
  /* Coin Toss: disable spin animation; direct reveal of result */
  /* FG entry: disable fanfare sequence; direct transition to FG HUD */
}
```

| Test | Method | Pass Criteria |
|------|--------|--------------|
| Cascade animation (reduced motion) | Enable `prefers-reduced-motion` in OS settings; trigger cascade | Particle explosion replaced by fade; no position-shifting animations |
| Lightning Mark pulse (reduced motion) | Enable reduced motion; accumulate 5+ marks | Mark renders as static icon; no pulsing animation |
| Coin Toss animation (reduced motion) | Enable reduced motion; trigger Coin Toss | Coin does not spin; result (Heads/Tails) shown immediately via text |
| FG entry fanfare (reduced motion) | Enable reduced motion; enter FG | Fanfare particle burst suppressed; HUD transitions via opacity only |

### §14.3 Keyboard Navigation Testing

**Source requirement:** ANIM §9.2 (Spin button focus states), FRONTEND.md §component architecture.

| Interaction | Key | Expected Behavior |
|-------------|-----|------------------|
| Navigate to Spin button | Tab | Focus visible on Spin button (gold glow ring per ANIM §9.2) |
| Activate Spin | Enter / Space | Spin executes if balance sufficient |
| Navigate to Extra Bet toggle | Tab (from Spin) | Focus on Extra Bet toggle |
| Toggle Extra Bet | Enter / Space | Extra Bet state toggles; cost display updates |
| Navigate to Buy Feature | Tab | Focus on Buy Feature button |
| Open Buy Feature confirm | Enter | Confirmation modal opens |
| Dismiss modal | Escape | Modal closes; focus returns to Buy Feature button |
| Bet level increase | Arrow Right / Arrow Up | Bet level increments by 1 step |
| Bet level decrease | Arrow Left / Arrow Down | Bet level decrements by 1 step |

### §14.4 Screen Reader Testing

| Test | Tool | Expected Behavior |
|------|------|------------------|
| Balance display live update | NVDA (Windows), VoiceOver (macOS) | `aria-live="polite"` announces new balance after spin completes |
| Win amount announcement | VoiceOver | `aria-live="assertive"` announces totalWin amount when result is ready |
| Error modal | NVDA | Error message read aloud immediately on modal appearance |
| FG entry notification | VoiceOver | "Free Game activated, multiplier ×3" announced via `aria-live` |
| Spin button disabled state | NVDA | "Spin button, dimmed" announced when spin in progress |

---

## §15 Regression Test Plan

### §15.1 Regression Suite Composition

The regression suite is a curated subset of the full test suite, optimized for speed while covering all P0 features.

| Layer | Included Tests | Approximate Count | Run Time |
|-------|---------------|:-----------------:|---------|
| Unit — Core engine | TC-UNIT-PROB, TC-UNIT-CASC, TC-UNIT-TB, TC-UNIT-COIN, TC-UNIT-FG, TC-UNIT-FLOOR, TC-UNIT-MAXWIN | ~80 TCs | ~2 min |
| Integration — API contracts | TC-INT-API-001 through TC-INT-API-013 | ~25 TCs | ~3 min |
| Integration — Wallet + DB | TC-INT-WALLET, TC-INT-DB | ~10 TCs | ~2 min |
| Integration — Redis session | TC-INT-REDIS, TC-INT-FG, TC-INT-BUYF | ~10 TCs | ~2 min |
| E2E — Critical flows | TC-E2E-SPIN-001, TC-E2E-CASC-001, TC-E2E-FG-001, TC-E2E-EXBT-001, TC-E2E-COIN-001 | ~5 TCs | ~5 min |
| Smoke — Basic health | POST /v1/spin 200, GET /health 200, GET /ready 200 | ~3 TCs | ~1 min |
| **Total** | | **~133 TCs** | **~15 min** |

**Exclusions from regression:** Full 1M Monte Carlo RTP run (nightly only), full visual regression Percy scan (pre-release only), full security OWASP ZAP scan (pre-release only), soak test (scheduled).

### §15.2 Trigger Conditions

| Trigger | Regression Subset | Notes |
|---------|------------------|-------|
| Every PR to `main` or `develop` branch | Full regression suite (~133 TCs) | CI must pass before merge |
| Every commit to PR branch | Unit tests only + affected integration tests | Fast feedback loop |
| Nightly (2:00 AM UTC) | Full regression suite + 100k Monte Carlo RTP sanity + security `npm audit` | Scheduled GitHub Actions workflow |
| Weekly (Sunday 00:00 UTC) | Full regression + full 1M Monte Carlo `verify.js` | Long-running job; separate workflow |
| Pre-production deploy | Full regression + E2E on staging + k6 load test + OWASP ZAP scan | Promotion gate to production |
| `engine_config.json` update | Full regression + full 1M Monte Carlo `verify.js` + 4-scenario RTP verification | Triggered by toolchain PR |
| `GameConfig.generated.ts` update | CI checksum guard (QG-11) + unit tests for probability loader | Guards against manual edits |

---

## §16 Smoke Test Plan

### §16.1 P0 Smoke Tests

The smoke test suite is the fastest possible verification that the deployed system is functional. It runs immediately after each environment deployment.

| TC-ID | Test | Endpoint | Expected Result | Priority |
|-------|------|---------|----------------|----------|
| TC-SMOKE-001 | Liveness probe | GET /health | HTTP 200 `{"status":"ok"}` | P0 |
| TC-SMOKE-002 | Readiness probe (DB + Redis connected) | GET /ready | HTTP 200 `{"db":"ok","redis":"ok"}` | P0 |
| TC-SMOKE-003 | Config endpoint accessible | GET /v1/config | HTTP 200 with bet ranges for USD and TWD | P0 |
| TC-SMOKE-004 | Auth required on spin | POST /v1/spin (no JWT) | HTTP 401 UNAUTHORIZED | P0 |
| TC-SMOKE-005 | Basic spin executes successfully | POST /v1/spin (valid JWT, balance≥baseBet) | HTTP 200 with `totalWin` field; `success: true` | P0 |
| TC-SMOKE-006 | Balance deducted after spin | POST /v1/spin → GET balance | Balance decreased by `baseBet - totalWin` (net) | P0 |
| TC-SMOKE-007 | FG trigger works (Buy Feature) | POST /v1/spin (buyFeature=true, balance≥100×baseBet) | HTTP 200; `fgTriggered: true`; `fgRounds.length === 5` | P0 |
| TC-SMOKE-008 | Session endpoint accessible | GET /v1/session/:sessionId | HTTP 200 (active session) or 404 (expired) | P0 |

### §16.2 Execution Target

**Target:** Complete smoke suite in < 5 minutes.

```bash
# Smoke test execution
pnpm test:smoke --base-url=https://api-staging.thunderblessing.example.com
# Expected output: 8/8 tests passed | Duration: 2m 47s
```

**Automated trigger:** Smoke tests run automatically in CI after each `kubectl rollout` completes in staging or production. Deployment pipeline is blocked if smoke tests fail.

---

## §17 CI/CD Integration

### §17.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       GitHub Actions CI/CD Pipeline                                  │
│                                                                                       │
│  PR Branch Push ──► [Lint] ──► [Unit Tests + Coverage] ──► PR Ready for Review      │
│                                                                                       │
│  PR Merge to develop ──► [Integration Tests] ──► [Smoke Tests] ──► Staging Deploy   │
│                                                                                       │
│  Staging Deploy ──► [E2E Tests] ──► [k6 Load Gate] ──► [Security Audit]            │
│                                                                                       │
│  Promote to prod ──► [k6 Smoke on Prod] ──► [Canary Monitor 5 min] ──► Full Deploy  │
│                                                                                       │
│  Nightly (2 AM) ──► [Full Regression] ──► [100k Monte Carlo RTP] ──► Grafana alert  │
│  Weekly (Sun) ──► [1M Monte Carlo verify.js] ──► [OWASP ZAP scan] ──► Report       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

| Stage | Trigger | Tools | Gate Action |
|-------|---------|-------|------------|
| **Lint** | Every push | ESLint, TypeScript `tsc --noEmit`, Prettier | Block PR if lint fails |
| **Unit Tests + Coverage** | Every push | Vitest + `@vitest/coverage-v8` | Block PR if < 80% coverage or any test fails |
| **Config Integrity Check** | Every push | `sha256sum GameConfig.generated.ts` vs expected hash | Block PR if manual edit detected |
| **Integration Tests** | PR merge to `develop` | Vitest + Supertest + test DB + test Redis | Block merge if any integration test fails |
| **Smoke Tests** | Post-staging deploy | Custom k6 smoke + Supertest | Rollback staging if smoke fails |
| **E2E Tests** | Post-staging deploy | Playwright on staging URL | Alert (no auto-rollback); manual review |
| **k6 Load Gate** | Pre-prod promotion | k6 500 VU 10-min load test | Block prod promotion if P99 ≤ 500ms fails |
| **Security Audit** | Weekly + pre-release | `npm audit`, OWASP ZAP, Semgrep | Block release if HIGH/CRITICAL found |
| **1M Monte Carlo** | Weekly + config change | `verify.js` (all 4 scenarios) | Alert QA Lead if FAIL; block config deploy |
| **OWASP ZAP Scan** | Weekly + pre-release | OWASP ZAP baseline scan on staging | Block release if HIGH found |

### §17.2 Quality Gates

CI quality gates are enforced via `vitest.config.ts` coverage thresholds and pipeline step exit codes.

```typescript
// vitest.config.ts (abbreviated)
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
```

**k6 performance gate (thresholds in script):**
```javascript
thresholds: {
  'http_req_duration{endpoint:spin,fg:false}': ['p(99)<500'],
  'http_req_duration{endpoint:spin,fg:true}': ['p(99)<800'],
  'http_req_failed': ['rate<0.005'],
}
```

### §17.3 Test Reporting

| Report Type | Format | Location | Retention |
|-------------|--------|---------|----------|
| Unit test results | JUnit XML + HTML | `test-results/unit/junit.xml`, `coverage/index.html` | 90 days in CI artifacts |
| Integration test results | JUnit XML | `test-results/integration/junit.xml` | 90 days |
| E2E test results | JUnit XML + Playwright HTML | `test-results/e2e/report.html` | 30 days + failure videos |
| Coverage report | LCOV + HTML | `coverage/lcov.info`, `coverage/index.html` | 90 days; uploaded to Codecov |
| k6 performance report | JSON + HTML (k6-reporter) | `test-results/perf/k6-report.html` | 90 days |
| OWASP ZAP report | HTML | `test-results/security/zap-report.html` | 1 year |
| Monte Carlo RTP report | Text (verify.js stdout) | CI log + `test-results/rtp/verify-output.txt` | 1 year |
| Percy visual regression | Percy dashboard | Percy cloud (30-day approval window) | Percy platform |

**Slack/email notifications:** CI pipeline sends notification on:
- Any FAIL in integration, E2E, or performance gate
- `verify.js` FAIL (high priority; notifies Game Designer and QA Lead immediately)
- OWASP ZAP HIGH finding
- Nightly regression FAIL

---

## §18 Reporting

### §18.1 Test Result Metrics

The following metrics are tracked per test cycle and reported in the QA Dashboard (Grafana or GitHub wiki):

| Metric | Formula | Target |
|--------|---------|--------|
| Overall pass rate | `(passed_TCs / total_TCs) × 100` | ≥ 99% before release |
| P0 pass rate | `(passed_P0_TCs / total_P0_TCs) × 100` | 100% required |
| Code coverage (domain) | `lines_covered / total_lines × 100` | ≥ 80% |
| Automation rate | `automated_TCs / total_TCs × 100` | ≥ 90% |
| Defect density | `total_defects / KLOC` | Tracking only |
| Defect escape rate | `prod_defects / (dev_defects + prod_defects) × 100` | < 5% |
| Mean time to fix (P0 defects) | Average hours from open to VERIFIED | < 24 hours |
| RTP variance (4 scenarios) | `|simulated_RTP - 97.5%| / 97.5% × 100` | < 1% per scenario |

### §18.2 Defect Severity Classification

| Severity | Definition | SLA (Fix) | Examples |
|----------|-----------|-----------|---------|
| CRITICAL | Game-breaking; financial data corruption; security breach; RTP outside ±1% | Fix within 4 hours; immediate escalation | Wallet double-debit, `totalWin` mismatch, JWT bypass, RTP > 98.5% or < 96.5% |
| HIGH | Major feature broken; user blocked; data integrity risk; P0 AC fails | Fix within 24 hours | Buy Feature floor not applied, FG sequence truncated, Cascade rows overflow, 5xx on every spin |
| MEDIUM | Feature degraded but workaround available; P1 AC fails | Fix within 5 business days | Extra Bet cost display wrong, FG multiplier HUD shows wrong stage, visual regression mismatch |
| LOW | Minor cosmetic or usability issue; no functional impact | Fix in next sprint | Typo in error message, animation timing off by 50ms, minor layout shift on 320px |
| INFORMATIONAL | Observation or suggestion; no fix required | Backlog | Test coverage gap in helper utility, suggestion to add more boundary tests |

### §18.3 Sign-Off Criteria

Production release sign-off requires all of the following approvals and evidence:

| # | Sign-Off Item | Approver | Evidence Required |
|---|--------------|---------|------------------|
| 1 | All P0 test cases pass (100%) | QA Lead | CI test results report |
| 2 | Code coverage ≥ 80% on domain + application | QA Lead | Vitest coverage HTML report |
| 3 | `verify.js` PASS for all 4 scenarios (1M spins) | Game Designer + QA Lead | `verify.js` output log |
| 4 | 0 CRITICAL defects open | QA Lead | Defect tracker export |
| 5 | k6 load test SLO gate passed (P99 ≤ 500ms / ≤ 800ms FG) | Engineering Lead | k6 HTML report |
| 6 | k6 soak test passed (< 0.5% error rate, 2 hours) | Engineering Lead | k6 soak HTML report |
| 7 | OWASP ZAP 0 HIGH findings | Security Lead | ZAP HTML report |
| 8 | Visual regression baselines approved | Art Director | Percy dashboard screenshot approval |
| 9 | Wallet reconciliation: 0 discrepancy events in soak test | Engineering Lead | Reconciliation job log |
| 10 | `GameConfig.generated.ts` checksum verified | Engineering Lead | CI checksum step log |

---

## Appendix A: Requirements Traceability Matrix (RTM)

| US-ID | Requirement Summary | TC-ID(s) | Type | Priority | Status |
|-------|---------------------|---------|------|----------|--------|
| US-SPIN-001 | Basic spin: P99 ≤ 500ms, 5×3 grid | TC-UNIT-CASC-002, TC-INT-API-001, TC-E2E-SPIN-001 | Unit/Int/E2E | P0 | Planned |
| US-SPIN-001/AC-2 | Balance < baseBet: display error, no spin | TC-UNIT-PROB-003, TC-INT-API-004, TC-E2E-SPIN-002 | Unit/Int/E2E | P0 | Planned |
| US-SPIN-001/AC-3 | JWT expired/missing: HTTP 401 | TC-INT-API-002, TC-INT-API-003, TC-SEC-AUTH-001 | Int/Security | P0 | Planned |
| US-SPIN-001/AC-4 | Concurrent spin: button locked, no double-debit | TC-INT-API-007, TC-E2E-SPIN-003 | Int/E2E | P0 | Planned |
| US-SPIN-001/AC-5 | Wild substitution in payline | TC-UNIT-CASC-002 | Unit | P0 | Planned |
| US-CASC-001/AC-1 | Cascade: Lightning Mark generated, rows expand | TC-UNIT-CASC-001, TC-UNIT-CASC-003, TC-UNIT-CASC-004 | Unit | P0 | Planned |
| US-CASC-001/AC-2 | rows=6 boundary: no further expansion | TC-UNIT-CASC-006 | Unit | P0 | Planned |
| US-CASC-001/AC-3 | New Main Game spin: marks cleared, rows=3 | TC-UNIT-CASC-008 | Unit | P0 | Planned |
| US-CASC-001/AC-4 | Same payline: max payout, no double-count | TC-UNIT-CASC-002 | Unit | P0 | Planned |
| US-CASC-001/AC-5 | 3+ cascade steps: CascadeStep records correct | TC-INT-FG-001 | Integration | P0 | Planned |
| US-TBSC-001/AC-1 | TB first hit: mark → premium symbol | TC-UNIT-TB-001 | Unit | P0 | Planned |
| US-TBSC-001/AC-2 | TB second hit (RNG < 0.40): symbol upgrade | TC-UNIT-TB-002 | Unit | P0 | Planned |
| US-TBSC-001/AC-3 | SC with no marks: no TB trigger | TC-UNIT-TB-005 | Unit | P0 | Planned |
| US-TBSC-001/AC-4 | P1 upgrade: stays P1 (no overflow) | TC-UNIT-TB-004 | Unit | P0 | Planned |
| US-TBSC-001/AC-5 | TB after cascade: cascade continues if new wins | TC-INT-FG-001 | Integration | P0 | Planned |
| US-COIN-001/AC-1 | Coin Toss at rows=6 + cascade win | TC-UNIT-COIN-001, TC-UNIT-COIN-002 | Unit | P0 | Planned |
| US-COIN-001/AC-2 | Coin Toss Heads: FG at ×3 | TC-UNIT-COIN-001, TC-INT-API-009 | Unit/Int | P0 | Planned |
| US-COIN-001/AC-3 | Coin Toss Tails: no FG | TC-UNIT-COIN-002 | Unit | P0 | Planned |
| US-COIN-001/AC-4 | Buy Feature: entryBuy=1.00, guaranteed Heads | TC-UNIT-COIN-004, TC-INT-BUYF-001 | Unit/Int | P0 | Planned |
| US-COIN-001/AC-5 | rows<6: no Coin Toss | TC-UNIT-COIN-005 | Unit | P0 | Planned |
| US-FGAM-001/AC-1 | FG round 1: ×3 multiplier, inherited marks | TC-UNIT-FG-001, TC-INT-FG-001 | Unit/Int | P0 | Planned |
| US-FGAM-001/AC-2 | FG round 2 Heads: ×7 multiplier | TC-UNIT-FG-001 | Unit | P0 | Planned |
| US-FGAM-001/AC-3 | ×77 + Heads: stays ×77 | TC-UNIT-FG-004 | Unit | P0 | Planned |
| US-FGAM-001/AC-4 | Any FG Tails: FG ends | TC-UNIT-FG-005 | Unit | P0 | Planned |
| US-FGAM-001/AC-5 | Buy Feature: 5 FGSpins, multipliers [3,7,17,27,77] | TC-UNIT-FG-001, TC-INT-BUYF-001 | Unit/Int | P0 | Planned |
| US-FGAM-001/AC-6 | FG Bonus multiplier drawn once | TC-UNIT-FG-002, TC-UNIT-FG-003 | Unit | P0 | Planned |
| US-FGAM-001/AC-7 | FG end at ×77 Tails: marks cleared | TC-INT-FG-003 | Integration | P0 | Planned |
| US-FGREC-001/AC-1 | FG reconnect: Redis state restored | TC-INT-API-012 | Integration | P1 | Planned |
| US-EXBT-001/AC-1 | Extra Bet: debit ×3 baseBet | TC-UNIT-CASC-001, TC-INT-API-001 | Unit/Int | P0 | Planned |
| US-EXBT-001/AC-3 | Extra Bet: SC injected if not natural | TC-UNIT-PROB-002 | Unit | P0 | Planned |
| US-BUYF-001 | Buy Feature: 100× cost, guaranteed Heads×5 | TC-UNIT-COIN-004, TC-INT-BUYF-001 | Unit/Int | P0 | Planned |
| US-BUYF-001 (floor) | Buy Feature: totalWin ≥ 20× baseBet | TC-UNIT-FLOOR-001, TC-INT-BUYF-003 | Unit/Int | P0 | Planned |
| US-RTPV-001 | RTP ±1% per scenario, 1M Monte Carlo | TC via `verify.js` | Monte Carlo | P0 | Planned |
| US-CURR-001 | USD/TWD display from BetRangeConfig | TC-INT-API-005, TC-INT-API-006 | Integration | P0 | Planned |
| US-APIV-001 | JWT auth on every spin | TC-INT-API-002, TC-SEC-AUTH-001 through TC-SEC-AUTH-005 | Int/Security | P0 | Planned |
| US-NRMS-001 | Near Miss: toolchain-configured, no code custom | TC-UNIT-PROB-001 (config integrity) | Unit | P0 | Planned |

---

## Appendix B: Performance Test k6 Script Skeleton

This script is a complete, runnable k6 load test for `POST /v1/spin`. Set environment variables before running.

```javascript
// k6/spin-load-test.js
// Usage: k6 run --env BASE_URL=https://api-staging.example.com \
//               --env JWT_TOKEN=<valid_player_jwt> \
//               --env PLAYER_ID=<player-uuid> \
//               k6/spin-load-test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const spinDurationNoFG = new Trend('spin_duration_no_fg', true);
const spinDurationFG = new Trend('spin_duration_fg', true);
const spinErrors = new Rate('spin_error_rate');
const walletDiscrepancies = new Counter('wallet_discrepancy_count');

// k6 options
export const options = {
  stages: [
    { duration: '2m',  target: 500  },  // ramp-up
    { duration: '10m', target: 500  },  // steady load
    { duration: '1m',  target: 0    },  // ramp-down
  ],
  thresholds: {
    // SLO from ARCH §1.1 / EDD
    'spin_duration_no_fg': ['p(50)<150', 'p(95)<300', 'p(99)<500'],
    'spin_duration_fg':    ['p(99)<800'],
    'spin_error_rate':     ['rate<0.005'],  // < 0.5% error rate
    'http_req_failed':     ['rate<0.005'],
    'wallet_discrepancy_count': ['count==0'],
  },
};

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const JWT_TOKEN  = __ENV.JWT_TOKEN  || 'eyJ...';
const PLAYER_ID  = __ENV.PLAYER_ID  || 'player-uuid';

const headers = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${JWT_TOKEN}`,
};

// Scenario distribution: 70% no-FG, 20% FG, 10% Buy Feature
function chooseScenario() {
  const r = Math.random();
  if (r < 0.70) return 'no_fg';
  if (r < 0.90) return 'fg';
  return 'buy_feature';
}

function buildSpinPayload(scenario) {
  const base = {
    playerId:   PLAYER_ID,
    betLevel:   7,         // USD $1.00 per spin
    currency:   'USD',
    extraBet:   false,
    buyFeature: false,
    sessionId:  `session-${__VU}-${Date.now()}`,
  };

  if (scenario === 'fg') {
    return { ...base, extraBet: true };
  }
  if (scenario === 'buy_feature') {
    return { ...base, buyFeature: true };
  }
  return base;
}

export default function () {
  const scenario = chooseScenario();
  const payload  = JSON.stringify(buildSpinPayload(scenario));

  group(`spin_${scenario}`, () => {
    const res = http.post(`${BASE_URL}/v1/spin`, payload, {
      headers,
      tags: { type: `spin_${scenario}` },
    });

    const success = check(res, {
      'status is 200':            (r) => r.status === 200,
      'response has totalWin':    (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && typeof body.data.totalWin === 'number';
        } catch { return false; }
      },
      'response has sessionId':   (r) => {
        try {
          return !!JSON.parse(r.body).data.sessionId;
        } catch { return false; }
      },
      'no 5xx error':             (r) => r.status < 500,
    });

    spinErrors.add(!success);

    // Track duration by FG type
    if (scenario === 'no_fg') {
      spinDurationNoFG.add(res.timings.duration);
    } else {
      spinDurationFG.add(res.timings.duration);
    }

    // Wallet discrepancy check: totalWin must be non-negative
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body.data && body.data.totalWin < 0) {
          walletDiscrepancies.add(1);
          console.error(`[DISCREPANCY] Negative totalWin: ${body.data.totalWin} sessionId: ${body.data.sessionId}`);
        }
      } catch (e) {
        // parse error; logged via check failure above
      }
    }
  });

  // Think time: 1-3 seconds between spins (simulate real player pace)
  sleep(1 + Math.random() * 2);
}

// Summary handler for custom metrics
export function handleSummary(data) {
  return {
    'test-results/perf/k6-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

// Helper: minimal text summary (inline to avoid external import)
function textSummary(data, opts) {
  const lines = ['=== k6 Load Test Summary ==='];
  const { metrics } = data;
  ['http_req_duration', 'spin_duration_no_fg', 'spin_duration_fg'].forEach(m => {
    if (metrics[m]) {
      const { p90, p95, p99 } = metrics[m].values;
      lines.push(`${m}: p90=${p90.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms`);
    }
  });
  if (metrics['spin_error_rate']) {
    lines.push(`spin_error_rate: ${(metrics['spin_error_rate'].values.rate * 100).toFixed(2)}%`);
  }
  if (metrics['wallet_discrepancy_count']) {
    lines.push(`wallet_discrepancies: ${metrics['wallet_discrepancy_count'].values.count}`);
  }
  lines.push('============================');
  return lines.join('\n');
}
```

**Smoke test variant (5 VU, 60s):**

```javascript
// k6/spin-smoke-test.js
export const options = {
  vus:      5,
  duration: '60s',
  thresholds: {
    'http_req_duration': ['p(99)<500'],
    'http_req_failed':   ['rate<0.01'],
  },
};
// Same default() function as above; import and re-use
```

**Soak test variant (500 VU, 2 hours):**

```javascript
// k6/spin-soak-test.js
export const options = {
  stages: [
    { duration: '5m',   target: 500  },   // ramp up
    { duration: '115m', target: 500  },   // 2-hour soak
    { duration: '2m',   target: 0    },   // ramp down
  ],
  thresholds: {
    'spin_duration_no_fg': ['p(99)<500'],
    'spin_error_rate':     ['rate<0.005'],
    'wallet_discrepancy_count': ['count==0'],
  },
};
```

**Run commands:**

```bash
# Smoke test
k6 run --env BASE_URL=$STAGING_URL --env JWT_TOKEN=$TEST_JWT --env PLAYER_ID=$TEST_PLAYER \
  k6/spin-smoke-test.js

# Load test (SLO gate)
k6 run --env BASE_URL=$STAGING_URL --env JWT_TOKEN=$TEST_JWT --env PLAYER_ID=$TEST_PLAYER \
  k6/spin-load-test.js

# Soak test
k6 run --env BASE_URL=$STAGING_URL --env JWT_TOKEN=$TEST_JWT --env PLAYER_ID=$TEST_PLAYER \
  k6/spin-soak-test.js

# Stress test (2000 VU peak — use k6 Cloud for distributed load)
k6 cloud k6/spin-stress-test.js
```

---

*Test Plan v1.0 — IEEE 829-2008 compliant — Generated for Thunder Blessing Slot Game GDD.*
*Upstream documents: IDEA.md, BRD.md, PRD.md, EDD.md v1.3, ARCH.md v1.7, API.md v1.0, SCHEMA.md v1.0, FRONTEND.md v1.0, AUDIO.md v1.0, ANIM.md v1.0, VDD.md v1.0, PDD.md v1.0.*
