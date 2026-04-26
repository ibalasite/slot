# Operations Runbook — Thunder Blessing Slot Game

---

## §1 Document Control

| Field | Value |
|-------|-------|
| **DOC-ID** | RUNBOOK-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Date** | 2026-04-26 |
| **Owner** | On-Call SRE / Engineering Lead |
| **Scope** | Production backend operations: deployment, incident response, common tasks, escalation |
| **Upstream** | EDD v1.3, ARCH v1.7, API v1.0, SCHEMA v1.0, FRONTEND v1.0 |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | gendoc D14-runbook | Initial generation |

---

## §2 System Overview

### Service Identity

| Property | Value |
|----------|-------|
| Service name | `thunder-blessing-api` |
| Container port | `3000` (HTTP; TLS terminated at Ingress) |
| Protocol | HTTPS / REST (TLS 1.3, nginx-ingress) |
| Runtime | Node.js 20 LTS / TypeScript 5.4+ / Fastify 4.x |
| API prefix | `/v1` (health probes at root: `/health`, `/ready`) |

### Tech Stack Summary

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| HTTP framework | Fastify | 4.x | Rate limit plugin (`@fastify/rate-limit`); JWT preHandler |
| Language | TypeScript | 5.4+ | Compiled; no hot reload in production |
| Database | Supabase PostgreSQL | 15 | Managed; PgBouncer pooling (pool_size=20 per pod) |
| Session cache | Redis / Upstash | 7.x | FG session state, concurrency locks, rate-limit counters |
| Auth | Supabase Auth (JWT RS256) | — | RS256 public key cached in-memory (TTL 1h) |
| Container | Docker | 24+ | Image tagged by git SHA |
| Orchestration | Kubernetes | 1.29+ | Namespace `thunder-prod` |
| Observability | OpenTelemetry + Grafana | — | Traces → Grafana Tempo; metrics → Prometheus |

### External Dependencies

| System | Purpose | Timeout | Circuit Breaker Threshold |
|--------|---------|---------|--------------------------|
| Supabase PostgreSQL | Player wallet, spin_logs, fg_sessions | 2000ms | 5 failures / 10s window |
| Redis / Upstash | FG session state, concurrency lock, rate limit | 500ms | 10 failures / 10s window |
| Supabase Auth (JWT) | RS256 token verification | 1000ms | 5 failures / 10s window |
| CDN (Cloudflare / CloudFront) | Static frontend assets | — | N/A (frontend only) |

### Environment Matrix

| Environment | K8s Namespace | Replicas | HPA Min/Max | Deploy Strategy | Notes |
|------------|---------------|----------|-------------|----------------|-------|
| Local | N/A (docker-compose) | 1 | N/A | N/A | `NODE_ENV=development`; Redis localhost:6379 |
| Development | `thunder-dev` | 1 | N/A | Rolling | Auto-deploy on `staging` branch push |
| Staging | `thunder-staging` | 2 | 2/4 | Blue-Green | Mirror prod config |
| Production | `thunder-prod` | 3 | 3/10 | Canary (5%→25%→100%) | PDB minAvailable=2 |

---

## §3 Health Checks & Monitoring

### Health Endpoints

#### GET /health — Liveness Probe

- **Auth:** None required
- **Expected response:** HTTP 200
- **Example response:**
  ```json
  { "status": "ok" }
  ```
- **K8s config:** `initialDelaySeconds: 10`, `periodSeconds: 15`, `failureThreshold: 3` (45s before pod restart)
- **Action on failure:** K8s automatically restarts the pod. If repeated restarts occur, check for config load failures (`fatal` log level) or OOM.

#### GET /ready — Readiness Probe

- **Auth:** None required
- **Expected response:** HTTP 200 when both PostgreSQL and Redis are reachable
- **K8s config:** `initialDelaySeconds: 5`, `periodSeconds: 10`
- **Action on failure:** Pod is removed from Ingress rotation. Investigate downstream connectivity (DB/Redis). Check circuit breaker state in Grafana.

### Key Metrics to Watch

| Metric | Type | Alert Threshold | Severity |
|--------|------|----------------|----------|
| `spin_duration_seconds` P99 | Histogram | > 500ms sustained 2 min | Warning |
| `spin_error_total / spin_total` | Counter ratio | > 0.5% sustained 1 min | Critical |
| `circuit_breaker_state{dependency="postgresql"}` | Gauge | OPEN | Critical |
| `circuit_breaker_state{dependency="redis"}` | Gauge | OPEN | Critical |
| `redis_lock_failures_total` | Counter | > 10/min | Warning |
| `fg_triggered_total` | Counter | anomalous spike (2× baseline) | Warning |
| Wallet discrepancy events | Custom alert | Any event | Critical |
| Rate limit flood | Counter | > 1000 hits/min | Warning |

### Alert Thresholds (Grafana)

| Alert Name | Condition | Action |
|-----------|-----------|--------|
| `HighSpinLatency` | P99 > 500ms for 2 min | Investigate engine bottleneck; check DB slow queries |
| `SpinErrorRate` | 5xx rate > 0.5% for 1 min | PagerDuty page; triage per INC-001 |
| `CircuitBreakerOpen` | Any dependency OPEN | PagerDuty page; triage per INC-002 or INC-003 |
| `WalletDiscrepancy` | debit != credit for any spin | Freeze affected player account; page P0 |
| `RateLimitFlood` | > 1000 rate-limit hits/min | Review source IP for abuse/ban |
| `ConfigIntegrityFailure` | CI checksum mismatch | Halt deployment; escalate to Engineering Lead |

### Log Locations

All logs are structured JSON, correlated by `traceId` and `spanId`.

| Environment | Log destination |
|------------|----------------|
| Production | Stdout → K8s log aggregation → Grafana Loki (or equivalent) |
| Staging | Stdout → K8s log aggregation |
| Local | Stdout (docker-compose logs thunder-api) |

**Log levels in use:**
- `debug` — RNG values, grid state (dev/staging only; never in production)
- `info` — Spin start/complete, FG trigger, wallet operations
- `warn` — Rate limit hit, circuit breaker HALF_OPEN
- `error` — Engine errors, DB failures, unexpected exceptions
- `fatal` — Config load failure, unrecoverable startup error

**Finding a specific spin in logs:**
```bash
# Filter by sessionId (replace with actual value)
kubectl logs -n thunder-prod -l app=thunder-blessing-api --since=1h | \
  jq 'select(.sessionId == "sess-9e2b1a34-6f7c-4d2e-b8a1-c5d9e0f12345")'
```

---

## §4 Startup & Shutdown Procedures

### Required Environment Variables at Startup

All secrets are stored in K8s Secret `thunder-secrets` and ConfigMap `thunder-config`.

| Env Var | Source | Purpose |
|---------|--------|---------|
| `SUPABASE_URL` | ConfigMap `thunder-config` key `supabase-url` | Supabase project URL (public, non-secret) |
| `SUPABASE_SERVICE_KEY` | Secret `thunder-secrets` key `supabase-service-key` | Supabase service role key; bypasses RLS |
| `SUPABASE_JWT_SECRET` | Secret `thunder-secrets` key `supabase-jwt-secret` | RS256 public key for JWT verification |
| `REDIS_URL` | Secret `thunder-secrets` key `redis-url` | Redis / Upstash connection string (TLS) |
| `DATABASE_URL` | Secret `thunder-secrets` key `database-url` | PostgreSQL connection string (TLS) |
| `NODE_ENV` | Pod spec env | `production` in prod; `development` locally |
| `OTEL_TRACES_SAMPLER` | Pod spec env | `parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | Pod spec env | `0.05` (5% normal traffic sampling) |

**Critical startup validation:** At startup, the service calls `assertValidGameConfig(config)` and `assertValidBetRangeConfig(betConfig)`. If either fails, the process exits with a `fatal` log and K8s restarts the pod. Repeated restarts with `CONFIG_VALIDATION_FAILED` indicate a broken `GameConfig.generated.ts` — roll back to the previous Docker image.

### Service Startup Sequence

Dependencies must be ready before the API begins serving traffic:

1. **Supabase PostgreSQL** — must accept connections (readiness probe checks this)
2. **Redis / Upstash** — must accept connections (readiness probe checks this)
3. **thunder-blessing-api pods** — start after readiness probe passes

```bash
# Verify K8s pod readiness in production
kubectl get pods -n thunder-prod -l app=thunder-blessing-api

# Expected output: all pods in Running state with READY 1/1
# NAME                                    READY   STATUS    RESTARTS   AGE
# thunder-blessing-api-5d8f9b74c-abc12   1/1     Running   0          2h
# thunder-blessing-api-5d8f9b74c-def34   1/1     Running   0          2h
# thunder-blessing-api-5d8f9b74c-ghi56   1/1     Running   0          2h
```

### Graceful Shutdown Sequence

On `SIGTERM` (K8s rolling update or manual drain):

1. Fastify stops accepting new connections (`server.close()`)
2. In-flight requests complete (up to 30s drain window)
3. All Redis concurrency locks are released (`DEL session:{sessionId}:lock`)
4. Database connections are closed cleanly
5. Process exits with code 0

K8s `terminationGracePeriodSeconds` should be set to at least 35s to accommodate the 30s drain window.

```bash
# Gracefully drain a specific pod (before manual maintenance)
kubectl drain <node-name> --namespace thunder-prod --ignore-daemonsets --delete-emptydir-data

# Force-delete a stuck pod (last resort; active sessions will lose lock — 10s TTL auto-recovers)
kubectl delete pod <pod-name> -n thunder-prod --grace-period=0 --force
```

---

## §5 Deployment Procedures

### Rolling Deploy Steps (Production Canary)

Production uses a Canary strategy: 5% → 25% → 100% with automated rollback if error rate exceeds 1%.

1. Ensure all CI/CD quality gates have passed:
   - TypeScript compilation: 0 errors
   - Unit test coverage: ≥ 80%
   - SAST scan: no CRITICAL findings
   - `verify.js` 4-scenario RTP: all PASS
   - `GameConfig.generated.ts` checksum: no diff
   - Docker image scan: no CRITICAL CVEs

2. Tag the Docker image with the git SHA:
   ```bash
   docker build -t thunder-blessing-api:<git-sha> .
   docker push <registry>/thunder-blessing-api:<git-sha>
   ```

3. Apply the new image to the production deployment:
   ```bash
   kubectl set image deployment/thunder-blessing-api \
     api=<registry>/thunder-blessing-api:<git-sha> \
     -n thunder-prod
   ```

4. Monitor the rollout:
   ```bash
   kubectl rollout status deployment/thunder-blessing-api -n thunder-prod --timeout=5m
   ```

5. Watch the canary error rate in Grafana. If `spin_error_total / spin_total` exceeds 1% within 5 minutes, trigger rollback (step below).

6. After 100% traffic shifted, run post-deploy smoke tests (see §5.4).

### Rollback Procedure

```bash
# Immediate rollback to the previous revision
kubectl rollout undo deployment/thunder-blessing-api -n thunder-prod

# Verify rollback in progress
kubectl rollout status deployment/thunder-blessing-api -n thunder-prod

# Verify running image after rollback
kubectl get deployment thunder-blessing-api -n thunder-prod \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Database Migration Steps

Migrations must run **before** deploying the new API version.

1. Run migrations in a non-transactional context for `CREATE INDEX CONCURRENTLY` steps:
   ```bash
   supabase db push --project-ref <project-ref>
   # For CONCURRENTLY indexes, run separately:
   supabase db execute --no-transaction -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS ..."
   ```

2. Verify migration success:
   ```sql
   -- Connect to Supabase SQL editor or psql
   SELECT * FROM schema_migrations ORDER BY inserted_at DESC LIMIT 5;
   ```

3. Confirm all tables exist and constraints are valid:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public'
   ORDER BY tablename;
   -- Expected: fg_sessions, game_config_versions, players, spins, wallet_transactions
   ```

4. Deploy the new API version after migrations are confirmed.

### Post-Deploy Smoke Test Checklist

Run these checks immediately after a production deploy:

```bash
# 1. Liveness probe
curl -sf https://api.yourdomain.com/health
# Expected: {"status":"ok"}  HTTP 200

# 2. Readiness probe (DB + Redis connectivity)
curl -sf https://api.yourdomain.com/ready
# Expected: HTTP 200

# 3. Config endpoint (valid JWT required)
curl -sf https://api.yourdomain.com/v1/config \
  -H "Authorization: Bearer <valid-player-jwt>"
# Expected: HTTP 200 with bet range and currency config JSON

# 4. Spin endpoint (use a test player account; betLevel 1 USD)
curl -sf -X POST https://api.yourdomain.com/v1/spin \
  -H "Authorization: Bearer <test-player-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"playerId":"<test-player-uuid>","betLevel":1,"extraBet":false,"buyFeature":false,"currency":"USD"}' \
  | jq '{success, totalWin: .data.totalWin, spinId: .data.spinId}'
# Expected: HTTP 200, success: true, totalWin >= 0, spinId present

# 5. Verify spin log persisted
# In Supabase SQL editor:
# SELECT id, total_win, created_at FROM spins WHERE player_id = '<test-player-uuid>'
# ORDER BY created_at DESC LIMIT 1;
```

All five checks must pass before declaring the deploy successful.

---

## §6 Incident Response Playbooks

### INC-001: High Error Rate (5xx > 1% sustained 5 min)

**Trigger:** `spin_error_total / spin_total` > 1% for 5 consecutive minutes. PagerDuty alert fires.

**Investigation steps:**
1. Check Grafana dashboard for which error codes are spiking:
   ```bash
   # In Grafana: query spin_error_total by error_code label
   # Common codes: INTERNAL_ERROR (500), ENGINE_TIMEOUT (504), SERVICE_UNAVAILABLE (503)
   ```
2. Check circuit breaker state:
   ```bash
   # Grafana: circuit_breaker_state metric — is PostgreSQL or Redis OPEN?
   ```
3. Check recent pod logs for stack traces:
   ```bash
   kubectl logs -n thunder-prod -l app=thunder-blessing-api --since=10m | \
     jq 'select(.level == "error" or .level == "fatal")'
   ```
4. Check if it's a config issue (recent deploy?):
   ```bash
   kubectl rollout history deployment/thunder-blessing-api -n thunder-prod
   ```

**Resolution:**
- If caused by a bad deploy: rollback immediately (§5.2).
- If `SERVICE_UNAVAILABLE` (503): circuit breaker is open; follow INC-002 or INC-003.
- If `ENGINE_TIMEOUT` (504) spikes: check if DB is slow (high query latency in Supabase dashboard); scale pods if CPU-bound.
- If `INTERNAL_ERROR` (500): examine stack trace in logs; may require code fix.

**Escalation:** If not resolved within 15 minutes, escalate to Engineering Lead. Severity P1.

---

### INC-002: Database Connection Failure (PostgreSQL unreachable)

**Trigger:** Circuit breaker for `postgresql` enters OPEN state. `SERVICE_UNAVAILABLE` (503) responses spike. The `spins`, `players`, `fg_sessions`, `wallet_transactions` tables are unreachable.

**Investigation steps:**
1. Check Supabase dashboard for PostgreSQL status at https://supabase.com/dashboard.
2. Test direct connectivity from a pod:
   ```bash
   kubectl exec -n thunder-prod -it <any-api-pod> -- \
     node -e "const { createClient } = require('@supabase/supabase-js'); \
       const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); \
       c.from('players').select('id').limit(1).then(console.log);"
   ```
3. Check connection pool exhaustion:
   ```sql
   -- Run in Supabase SQL editor
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   -- If count(*) WHERE state='idle in transaction' is high, lock contention is likely
   ```
4. Check for long-running queries blocking connections:
   ```sql
   SELECT pid, now() - query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC
   LIMIT 10;
   ```

**Resolution:**
- If Supabase is degraded: wait for managed service recovery; escalate to Supabase support.
- If connection pool exhausted: `SELECT pg_terminate_backend(pid)` on `idle in transaction` sessions.
- If a long-running query is blocking: `SELECT pg_cancel_backend(pid)` on the blocking query.
- Circuit breaker auto-recovers after 30s probe succeeds.

**Escalation:** P0 if service is fully down. Page Engineering Lead and CTO.

---

### INC-003: Redis Session Loss (SESSION_NOT_FOUND spike)

**Trigger:** `SESSION_NOT_FOUND` (404) error code spikes on `GET /v1/session/:sessionId`. FG sessions are being lost mid-sequence. Players report losing their Free Game progress.

**Investigation steps:**
1. Check Redis / Upstash status at https://upstash.com/dashboard.
2. Check circuit breaker state for Redis in Grafana (`circuit_breaker_state{dependency="redis"}`).
3. Inspect the Redis key directly:
   ```bash
   # Connect to Redis (use REDIS_URL from K8s secret)
   redis-cli -u $REDIS_URL
   # Look up a specific session
   HGETALL session:<sessionId>:state
   # Check TTL remaining
   TTL session:<sessionId>:state
   ```
4. Check if sessions are expiring prematurely. Default TTL is 300s (5 minutes). If TTL is much shorter, the TTL renewal on FG round completion may be broken.
   Note: SCHEMA.md §4.1 documents 1800s but API contract defines 300s — use 300s as the operative value for session expiry incidents.
5. Check PostgreSQL `fg_sessions` for the durable fallback:
   ```sql
   SELECT id, status, fg_round, total_fg_win, expires_at
   FROM fg_sessions
   WHERE player_id = '<affected-player-uuid>'
   ORDER BY created_at DESC LIMIT 5;
   ```

**Resolution:**
- If Redis is down: circuit breaker opens; new spins return 503. Existing in-flight FG sessions cannot complete until Redis recovers.
- If TTL renewal is broken: deploy fix; affected sessions must be manually expired (see §7.3).
- If a player's FG session exists in `fg_sessions` but not Redis, it can be manually reconstructed:
  ```sql
  SELECT completed_rounds, lightning_marks, fg_multiplier, total_fg_win, floor_value
  FROM fg_sessions WHERE player_id = '<player-uuid>' AND status = 'ACTIVE';
  ```
  Then re-seed Redis using the admin tooling (contact Engineering Lead).

**Escalation:** P1. Page Engineering Lead within 15 minutes if session loss is confirmed.

---

### INC-004: RNG Service Unavailable

**Context:** The Thunder Blessing engine uses Node.js's built-in `Math.random()` (or a seeded PRNG from `GameConfig.generated.ts` toolchain). There is no separate external RNG service. If the game engine itself is unavailable (process crash), incidents manifest as pod restarts or `INTERNAL_ERROR` (500) responses.

**Trigger:** Repeated pod restarts with `fatal` log entries indicating `CONFIG_VALIDATION_FAILED` or engine initialization failure.

**Investigation steps:**
1. Check pod restart count:
   ```bash
   kubectl get pods -n thunder-prod -l app=thunder-blessing-api
   # Look for high RESTARTS count
   ```
2. Examine pod crash logs:
   ```bash
   kubectl logs -n thunder-prod <crashing-pod-name> --previous | \
     jq 'select(.level == "fatal")'
   ```
3. Verify `GameConfig.generated.ts` integrity — a manual edit or corrupted deploy breaks startup validation:
   ```bash
   kubectl exec -n thunder-prod -it <any-running-pod> -- \
     node -e "const config = require('./src/config/GameConfig.generated.ts'); console.log('OK');"
   ```

**Resolution:**
- If `GameConfig.generated.ts` is corrupted: roll back to the previous Docker image (§5.2).
- If pod is OOM: increase memory limit in the Deployment spec (default limit: 512Mi).
- Never manually edit `GameConfig.generated.ts`. It must only be regenerated via the toolchain (`verify.js` → `engine_generator.js`).

**Escalation:** P1 if more than one pod is failing. P0 if all pods are failing.

---

### INC-005: Balance Discrepancy Alert

**Trigger:** Grafana alert `WalletDiscrepancy` — a `wallet_transactions` row with `tx_type = 'DEBIT'` has no corresponding `CREDIT` or `COMPENSATE` entry within 60 seconds, or `outcome.totalWin` differs from the credited amount.

**Critical rule:** `outcome.totalWin` in `spins.outcome_json` is the **sole** accounting authority. The wallet credit must exactly equal `outcome.totalWin`. Never use `session.roundWin` or per-cascade step sums.

**Investigation steps:**
1. Find the mismatched transaction:
   ```sql
   -- Find DEBITs without a matching CREDIT within 60s
   SELECT wt.id, wt.player_id, wt.amount, wt.created_at, wt.spin_id
   FROM wallet_transactions wt
   WHERE wt.tx_type = 'DEBIT'
     AND NOT EXISTS (
       SELECT 1 FROM wallet_transactions wt2
       WHERE wt2.player_id = wt.player_id
         AND wt2.spin_id = wt.spin_id
         AND wt2.tx_type IN ('CREDIT', 'COMPENSATE', 'CREDIT_BUY_FEATURE_FLOOR')
         AND wt2.created_at <= wt.created_at + INTERVAL '60 seconds'
     )
   ORDER BY wt.created_at DESC LIMIT 10;
   ```
2. Check the corresponding spin outcome:
   ```sql
   SELECT id, total_win, outcome_json->>'totalWin' AS json_total_win, engine_version, created_at
   FROM spins
   WHERE id = '<spin-id-from-above>';
   ```
3. Check if an async reconciliation job ran:
   ```sql
   SELECT * FROM wallet_transactions
   WHERE player_id = '<player-uuid>'
     AND tx_type = 'COMPENSATE'
   ORDER BY created_at DESC LIMIT 5;
   ```

**Resolution:**
- If player was not credited and no compensation is pending: issue a manual `COMPENSATE` credit equal to the debited amount. Use the `service_role` via Supabase dashboard or the admin API.
- Suspend the affected player's account from further spins until the discrepancy is resolved (`UPDATE players SET is_suspended = TRUE WHERE id = '<player-uuid>'`).
- File an incident report and review the engine version involved.

**Escalation:** P0 immediately. Page Engineering Lead and CTO. Do not resolve without compliance review.

---

### INC-006: Rate Limiting False Positives (RATE_LIMITED for legitimate traffic)

**Trigger:** Legitimate players report `RATE_LIMITED` (HTTP 429) responses despite not exceeding 5 req/s. `redis_lock_failures_total` or `spin_error_total{error_code="RATE_LIMITED"}` spikes unexpectedly.

**Investigation steps:**
1. Confirm the rate limit key in use — it should be the JWT `sub` claim (player UUID), not a shared IP:
   ```bash
   # Check Fastify rate-limit plugin config in pod
   kubectl exec -n thunder-prod -it <pod-name> -- \
     node -e "console.log(process.env.RATE_LIMIT_KEY_GENERATOR || 'default: jwt.sub')"
   ```
2. Check if multiple players share an IP behind a NAT (mobile networks):
   - If the `keyGenerator` has fallen back to IP (JWT verification failed), one NAT IP hitting the limit affects all players behind it.
   - Check logs for `warn` entries with `event: "rate_limit_key_fallback_to_ip"`.
3. Check Redis rate-limit counters:
   ```bash
   redis-cli -u $REDIS_URL
   # Rate limit keys follow pattern: player:{player-uuid}:ratelimit
   KEYS player:*:ratelimit
   TTL player:{player-uuid}:ratelimit
   ```

**Resolution:**
- If the JWT key extractor is broken (falling back to IP): deploy a fix for `keyGenerator`.
- If a legitimate player has hit the limit due to a client retry loop: wait for the 1-second window to expire, or flush the key:
  ```bash
  redis-cli -u $REDIS_URL DEL player:{player-uuid}:ratelimit
  ```
- If the rate limit is genuinely too restrictive for the traffic pattern, adjust `RATE_LIMIT_MAX` env var and redeploy.

**Escalation:** P2. Notify Engineering Lead if widespread.

---

## §7 Common Operational Tasks

### 7.1 Check a Player's Active FG Session (Redis Key Lookup)

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Retrieve all fields of a session hash
HGETALL session:<sessionId>:state

# Example output fields:
# playerId          <player-uuid>
# status            FG_ACTIVE
# baseBet           1.00
# fgRound           2
# fgMultiplier      7
# fgBonusMultiplier 1
# totalFGWin        0.00
# lightningMarks    [{"r":1,"c":2},{"r":3,"c":4}]
# floorValue        20.00
# lockToken         <uuid>
# lockedAt          1745713200000

# Check TTL remaining
TTL session:<sessionId>:state

# Check if a concurrency lock is held
EXISTS session:<sessionId>:lock
GET session:<sessionId>:lock    # returns lockToken if held
```

### 7.2 Inspect a Spin Result (DB Query)

```sql
-- Look up a spin by session_id
SELECT
    id,
    player_id,
    session_id,
    base_bet,
    total_bet,
    total_win,
    fg_triggered,
    fg_multiplier,
    bonus_multiplier,
    session_floor_applied,
    session_floor_value,
    coin_toss_result,
    thunder_blessing_triggered,
    engine_version,
    created_at
FROM spins
WHERE session_id = '<session-id>'
ORDER BY created_at DESC
LIMIT 5;

-- Retrieve full outcome JSON for forensic replay
SELECT outcome_json
FROM spins
WHERE id = '<spin-uuid>';

-- Check wallet transactions for a specific spin
SELECT tx_type, amount, balance_before, balance_after, created_at
FROM wallet_transactions
WHERE spin_id = '<spin-uuid>'
ORDER BY created_at;
```

### 7.3 Manually Expire a Stuck Session

Use this when a session is stuck in `FG_ACTIVE` or `SPINNING` state and the player cannot initiate new spins (concurrency lock is held).

```bash
# Step 1: Force-release the Redis concurrency lock
redis-cli -u $REDIS_URL DEL session:<sessionId>:lock

# Step 2: Force-delete the session state hash
redis-cli -u $REDIS_URL DEL session:<sessionId>:state

# Step 3: Mark the PostgreSQL fg_sessions row as EXPIRED
# (if the session has a db row)
```

```sql
UPDATE fg_sessions
SET status = 'EXPIRED', updated_at = NOW()
WHERE player_id = '<player-uuid>'
  AND status IN ('PENDING', 'ACTIVE');
```

```bash
# Step 4: Verify no lock remains
redis-cli -u $REDIS_URL EXISTS session:<sessionId>:lock
# Expected: 0 (integer)
```

**Warning:** If the player had an active FG sequence, they will lose their FG progress. Check `fg_sessions.total_fg_win` and issue a manual `COMPENSATE` credit if the player was mid-session with accumulated winnings.

### 7.4 Rotate JWT Signing Keys

JWT signing is managed by Supabase Auth. The backend holds only the RS256 **public** key for verification.

1. In Supabase Auth dashboard, initiate a JWT secret rotation. Supabase provides a rolling period during which both old and new keys are valid.
2. Update the K8s secret with the new public key:
   ```bash
   kubectl create secret generic thunder-secrets \
     --from-literal=supabase-jwt-secret="<new-rs256-public-key>" \
     --dry-run=client -o yaml | kubectl apply -f - -n thunder-prod
   ```
   ⚠️  In-memory cache: The application caches the RS256 public key with a 1-hour TTL. During emergency rotation (key compromise), trigger a rolling restart immediately after updating the secret so all pods reload the new key. Until the rolling restart completes, existing pods continue verifying tokens against the cached old key.
3. Trigger a rolling restart so all pods pick up the new secret:
   ```bash
   kubectl rollout restart deployment/thunder-blessing-api -n thunder-prod
   ```
4. Verify the new pods start successfully and the readiness probe passes:
   ```bash
   kubectl rollout status deployment/thunder-blessing-api -n thunder-prod
   ```
5. The in-memory JWT public key cache (TTL 1h) will also auto-refresh on next expiry.

### 7.5 Adjust Bet Levels in Config

Bet levels are defined in `BetRangeConfig.generated.ts`, which is generated by the Excel toolchain. **Never edit this file manually.**

To change bet level ranges:
1. Edit `Thunder_Config.xlsx` BET_RANGE tab with the new `minBetLevel` / `maxBetLevel` values.
   - TWD `maxBetLevel` must not exceed **320**.
2. Run the full toolchain:
   ```bash
   node build_config.js           # emit engine_config.json
   node excel_simulator.js        # 1M Monte Carlo simulation
   node verify.js                 # MUST PASS all 4 scenarios before proceeding
   node engine_generator.js       # generates BetRangeConfig.generated.ts
   ```
3. Commit the generated files; CI will validate the checksum guard.
4. Deploy via the normal pipeline.

---

## §8 Backup & Recovery

### Database Backup Schedule

| Data Store | Backup Type | Frequency | Retention | Location |
|-----------|-------------|-----------|-----------|----------|
| Supabase PostgreSQL | Automated daily backup | Daily (Supabase Pro) | 30 days | Supabase managed storage |
| Supabase PostgreSQL | Point-in-time recovery (PITR) | Continuous (5-minute granularity) | 7 days | Supabase managed |
| `GameConfig.generated.ts` | Git history | Every toolchain run | Indefinite | GitHub repository |
| `Thunder_Config.xlsx` | Manual / CI artifact | Every operator edit | Indefinite | Repository / CI artifacts |

### Redis Persistence Strategy

- **RDB snapshots:** Every 5 minutes (Upstash Standard managed)
- **AOF persistence:** Enabled on Upstash Standard tier

**Recovery scenario:** If Redis is fully lost, all in-flight FG sessions become `SESSION_NOT_FOUND`. Active sessions can be partially reconstructed from `fg_sessions` PostgreSQL table (which is the durable fallback). Players mid-FG sequence should be manually compensated (see INC-003).

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single pod failure | < 30s (K8s self-heals) | 0 (stateless) |
| Full cluster failure | 30 minutes | 5 minutes (PostgreSQL PITR) |
| PostgreSQL failure | 30 minutes | 5 minutes (PITR granularity) |
| Redis failure | ~5 minutes (Upstash recovery) | Up to 5 minutes of session state |
| Full data recovery (worst case) | 30 minutes | 5 minutes |

### Restore Procedure

```bash
# PostgreSQL PITR restore (via Supabase dashboard)
# 1. Go to Supabase dashboard → Project settings → Database → Point-in-time recovery
# 2. Select target timestamp (must be within 7-day window)
# 3. Confirm restore; Supabase provisions a new instance
# 4. Update DATABASE_URL K8s secret with the new connection string
# 5. Rolling restart: kubectl rollout restart deployment/thunder-blessing-api -n thunder-prod
```

---

## §9 Security Operations

### 9.1 JWT Key Rotation Procedure

See §7.4 for the full step-by-step procedure. Rotation schedule: when notified by Supabase Auth or on-demand after a suspected key compromise.

**Emergency rotation (key compromise suspected):**
1. Immediately rotate the JWT secret in Supabase Auth dashboard (this invalidates all existing tokens).
2. Update the K8s secret and force a rolling restart (§7.4 steps 2–4).
3. All active player sessions will require re-login. Inform customer support.

### 9.2 CORS Allowlist Update

The CORS allowed origins are configured via the `CORS_ALLOWED_ORIGINS` environment variable.

```bash
# Update the ConfigMap or add a new env var to the Deployment
kubectl set env deployment/thunder-blessing-api \
  CORS_ALLOWED_ORIGINS="https://game.yourdomain.com,https://staging.game.yourdomain.com" \
  -n thunder-prod

# Rolling restart to apply
kubectl rollout restart deployment/thunder-blessing-api -n thunder-prod
```

In development only: `Access-Control-Allow-Origin: *`. This must never appear in production.

### 9.3 Rate Limit Threshold Adjustment

The rate limit is configured via `@fastify/rate-limit` plugin settings. Currently: 5 req/s per player, sliding window, Redis-backed.

To adjust:
1. Update the `max` and/or `timeWindow` values in `src/interface/routes/spin.route.ts` (or the rate-limit plugin registration in the Fastify server bootstrap).
2. Deploy via normal pipeline.
3. Redis rate-limit counters use keys with pattern `player:{playerId}:ratelimit` with a 1-second TTL — they expire automatically.

**Aggressive auth-failure lockout:** After 10 consecutive JWT failures from the same IP in 60s, the IP is more aggressively rate-limited. Threshold configurable via `RATE_LIMIT_AUTH_FAIL_MAX` env var.

### 9.4 Secret Rotation Schedule

| Secret | K8s Secret Name | Key | Rotation Frequency |
|--------|----------------|-----|-------------------|
| `SUPABASE_SERVICE_KEY` | `thunder-secrets` | `supabase-service-key` | 90 days |
| `SUPABASE_JWT_SECRET` | `thunder-secrets` | `supabase-jwt-secret` | On key rotation event |
| `REDIS_URL` | `thunder-secrets` | `redis-url` | On credential change |
| `DATABASE_URL` | `thunder-secrets` | `database-url` | 90 days |

After updating any K8s secret, always trigger a rolling restart:
```bash
kubectl rollout restart deployment/thunder-blessing-api -n thunder-prod
```

---

## §10 Escalation Matrix

| Severity | Definition | Initial Response | Escalation Path | Response SLA |
|----------|-----------|-----------------|----------------|--------------|
| **P0** | Service fully down; all players blocked; data integrity breach | On-call SRE immediately paged | SRE → Engineering Lead → CTO → (if data loss) Legal/Compliance | 5 min acknowledge; 30 min RTO |
| **P1** | Partial outage; FG sessions lost; wallet discrepancy; >1% error rate sustained | On-call SRE paged | SRE → Engineering Lead | 15 min acknowledge; 60 min resolution target |
| **P2** | Performance degradation (P99 latency elevated); elevated rate-limit hits; non-critical feature broken | On-call SRE notified (non-page) | SRE → Engineering Lead (if not resolved in 1h) | 30 min acknowledge; next business day resolution |
| **P3** | Cosmetic defect; minor UX issue; non-blocking bug | Standard Jira ticket | Engineering backlog | Next sprint |

### Escalation Contacts

| Role | Contact Method | Notes |
|------|---------------|-------|
| On-call SRE | PagerDuty rotation | First point of contact for all P0/P1 alerts |
| Engineering Lead | PagerDuty (P0/P1) / Slack (P2) | Owns architectural decisions and code fixes |
| CTO | Direct message / phone (P0 only) | Final escalation for data integrity or service-down events |
| Supabase Support | https://supabase.com/support | For managed DB / Auth service issues |
| Upstash Support | https://upstash.com/support | For Redis service issues |

---

## §11 Runbook Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | gendoc D14-runbook | Initial generation from EDD v1.3, ARCH v1.7, API v1.0, SCHEMA v1.0, FRONTEND v1.0 |
