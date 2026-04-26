# SCHEMA — Database Schema Design Document
# Thunder Blessing Slot Game

---

## §0 Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | SCHEMA-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Status** | DRAFT |
| **Author** | AI Generated (gendoc D09-SCHEMA) |
| **Date** | 2026-04-26 |
| **Upstream EDD** | [EDD.md](EDD.md) §4 domain model, §5 data structures, §7 database design |
| **Upstream ARCH** | [ARCH.md](ARCH.md) §3 tech stack, §4 components, §5 data flow |
| **Upstream API** | [API.md](API.md) §4 data types, §3.3 config endpoint |
| **Upstream PRD** | [PRD.md](PRD.md) §5 game mechanics, §4 business rules |
| **Upstream BRD** | [BRD.md](BRD.md) §5 non-functional requirements |
| **Reviewers** | Engineering Lead, QA Lead, Security Lead, DBA |
| **Approver** | CTO |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | AI Generated (gendoc D09-SCHEMA) | Initial generation |

---

## §1 Overview

### 1.1 Database Stack

Thunder Blessing uses a two-tier persistence strategy designed for financial accuracy, session resilience, and regulatory auditability:

| Tier | Technology | Purpose | Hosting |
|------|-----------|---------|---------|
| **Primary DB** | Supabase PostgreSQL 15 | Player accounts, wallet ledger, spin audit log, FG session persistence, game config versions | Supabase Pro (managed) |
| **Cache / Session** | Redis 7 (Upstash Standard) | In-flight FG session state, concurrency locks, rate-limit counters, config cache, balance cache | Upstash Standard |
| **Read Replica** | Supabase PostgreSQL (optional, Phase 2) | Analytics queries, spin history reads, wallet transaction history | Supabase Pro (replica) |

### 1.2 Design Principles

| # | Principle | Application |
|---|-----------|-------------|
| 1 | **Financial Immutability** | `wallet_transactions` is append-only; no UPDATE or DELETE is permitted by any role |
| 2 | **UUID Primary Keys** | All tables use `gen_random_uuid()` UUIDs to avoid sequential ID enumeration |
| 3 | **Monetary Precision** | All amounts use `DECIMAL(18,2)` to match accounting precision requirements |
| 4 | **RLS Everywhere** | Every table has Supabase Row Level Security enabled; players see only their own rows |
| 5 | **Idempotency Keys** | `wallet_transactions.idempotency_key` prevents duplicate credits on retry |
| 6 | **Explicit Timestamps** | All tables carry `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| 7 | **Non-Negative Balance** | `CHECK (balance >= 0)` constraint on `players.balance` enforced at DB level |
| 8 | **Cascade-Safe FKs** | Foreign keys use `ON DELETE RESTRICT` to prevent orphaned financial records |

### 1.3 PostgreSQL Version and Extensions

```sql
-- PostgreSQL 15+ required
-- Extensions activated on Supabase project:
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- query analysis
```

---

## §2 PostgreSQL Tables

### 2.1 `players`

**Description:** Master player account table. Each row represents a registered player whose identity is managed by Supabase Auth. The `id` column maps 1:1 to the JWT `sub` claim. Balance is stored here directly (denormalized from a separate wallet table) for simpler queries; the `wallet_transactions` ledger is the source of truth for audit.

**Access Patterns:**
- Read balance before spin (by `id`)
- Update balance atomically on debit/credit (by `id` with `FOR UPDATE`)
- Create on first successful Supabase Auth registration

```sql
CREATE TABLE players (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT         NOT NULL UNIQUE,
    display_name    TEXT         NOT NULL DEFAULT '',
    balance         DECIMAL(18,2) NOT NULL DEFAULT 0.00
                                 CHECK (balance >= 0),
    currency        TEXT         NOT NULL DEFAULT 'USD'
                                 CHECK (currency IN ('USD', 'TWD')),
    is_suspended    BOOLEAN      NOT NULL DEFAULT FALSE,
    engine_version  TEXT         NOT NULL DEFAULT '1.0.0',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE players IS 'Master player account. id maps 1:1 to Supabase Auth sub claim. balance is the live wallet balance maintained atomically via UPDATE ... FOR UPDATE.';
COMMENT ON COLUMN players.balance IS 'Live wallet balance. Always read from DB — never cached. Must be updated inside the same transaction as wallet_transactions INSERT.';
COMMENT ON COLUMN players.is_suspended IS 'When true, all POST /v1/spin requests return HTTP 403 FORBIDDEN.';
```

**Indexes:**

```sql
-- Email lookup for auth sync (unique constraint creates index automatically)
-- No additional indexes needed; all queries are by primary key (id = JWT sub).
```

**RLS Policies:**

```sql
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Players may read only their own row
CREATE POLICY "players_select_own"
    ON players FOR SELECT
    USING (auth.uid() = id);

-- Players may not update directly; all updates go through service_role
CREATE POLICY "players_no_direct_update"
    ON players FOR UPDATE
    USING (FALSE);

-- service_role bypasses RLS for backend mutations
-- (Supabase service_role key bypasses RLS automatically)
```

---

### 2.2 `spins`

**Description:** Immutable audit log of every spin. One row is inserted per POST `/v1/spin` call, after the engine resolves `totalWin`. This table is the regulatory compliance record. The `rng_seed` enables replay/verification. The `outcome_json` JSONB column stores the full `FullSpinOutcome` for forensic investigation without requiring JOIN to reconstruct game state.

**Access Patterns:**
- INSERT once per spin (after engine resolves)
- SELECT by `player_id` + `created_at` range for audit/history
- SELECT by `session_id` to correlate FG session rows
- Regulatory export: full table scan with date range on `created_at` (use partition pruning)

```sql
CREATE TABLE spins (
    id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id                 UUID          NOT NULL
                                            REFERENCES players(id) ON DELETE RESTRICT,
    session_id                TEXT          NOT NULL,
    bet_level                 INTEGER       NOT NULL CHECK (bet_level >= 1 AND bet_level <= 320),
    base_bet                  DECIMAL(18,2) NOT NULL CHECK (base_bet > 0),
    total_bet                 DECIMAL(18,2) NOT NULL CHECK (total_bet > 0),
    currency                  TEXT          NOT NULL CHECK (currency IN ('USD', 'TWD')),

    -- Outcome summary (denormalized for fast audit queries)
    main_cascade_win          DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    total_fg_win              DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    total_win                 DECIMAL(18,2) NOT NULL DEFAULT 0.00
                                            CHECK (total_win >= 0),

    -- Feature flags
    extra_bet_active          BOOLEAN       NOT NULL DEFAULT FALSE,
    buy_feature_active        BOOLEAN       NOT NULL DEFAULT FALSE,

    -- Thunder Blessing
    thunder_blessing_triggered BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Coin Toss
    coin_toss_result          TEXT          CHECK (coin_toss_result IN ('HEADS', 'TAILS')),

    -- Free Game
    fg_triggered              BOOLEAN       NOT NULL DEFAULT FALSE,
    fg_multiplier             INTEGER       CHECK (fg_multiplier IN (3, 7, 17, 27, 77)),
    bonus_multiplier          INTEGER       CHECK (bonus_multiplier IN (1, 5, 20, 100)),

    -- Session Floor (Buy Feature)
    session_floor_applied     BOOLEAN       NOT NULL DEFAULT FALSE,
    session_floor_value       DECIMAL(18,2) CHECK (session_floor_value >= 0),

    -- Near Miss
    near_miss_applied         BOOLEAN       NOT NULL DEFAULT FALSE,

    -- Full outcome JSON for forensics/replay
    outcome_json              JSONB,

    -- Provenance
    rng_seed                  TEXT,
    engine_version            TEXT          NOT NULL,
    ip_address                INET,

    created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()

) PARTITION BY RANGE (created_at);

COMMENT ON TABLE spins IS 'Immutable spin audit log. One row per POST /v1/spin. Partitioned monthly by created_at. Retain 13 months. Regulatory compliance record.';
COMMENT ON COLUMN spins.total_win IS 'outcome.totalWin — the SOLE accounting authority. This value drives the wallet_transactions credit entry.';
COMMENT ON COLUMN spins.outcome_json IS 'Full FullSpinOutcome JSON for forensic replay. May be NULL if JSON storage is disabled for cost reasons; summary columns are always populated.';
COMMENT ON COLUMN spins.rng_seed IS 'RNG seed for deterministic replay in QA/audit scenarios. NULL in production if provably fair is not enabled.';
COMMENT ON COLUMN spins.session_floor_applied IS 'TRUE when Buy Feature session floor (>= 20x baseBet) was applied to override totalFGWin.';
```

**Indexes:**

```sql
-- Primary access pattern: spin history by player (audit dashboard)
CREATE INDEX idx_spins_player_id_created_at
    ON spins (player_id, created_at DESC);

-- Session correlation: find all spins belonging to a session
CREATE INDEX idx_spins_session_id
    ON spins (session_id);

-- Regulatory date-range export
CREATE INDEX idx_spins_created_at
    ON spins (created_at DESC);

-- Anomaly detection: find large win spins
CREATE INDEX idx_spins_total_win
    ON spins (total_win DESC)
    WHERE total_win > 0;

-- FG analytics
CREATE INDEX idx_spins_fg_triggered
    ON spins (fg_triggered, fg_multiplier)
    WHERE fg_triggered = TRUE;
```

**Monthly Partitions (example DDL):**

```sql
-- Initial partitions — extend monthly via migration or scheduled job
CREATE TABLE spins_2026_04 PARTITION OF spins
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE spins_2026_05 PARTITION OF spins
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- ... create 13 months of partitions at deployment, add new month 30 days before start
```

**RLS Policies:**

```sql
ALTER TABLE spins ENABLE ROW LEVEL SECURITY;

-- Players may read their own spin history
CREATE POLICY "spins_select_own"
    ON spins FOR SELECT
    USING (auth.uid() = player_id);

-- No player can INSERT/UPDATE/DELETE directly — all mutations via service_role
CREATE POLICY "spins_insert_service_role_only"
    ON spins FOR INSERT
    WITH CHECK (FALSE); -- service_role bypasses this automatically

-- No UPDATE or DELETE ever allowed on spins (immutable audit log)
-- (service_role still cannot UPDATE/DELETE via policy enforcement)
```

---

### 2.3 `fg_sessions`

**Description:** Persistent Free Game session state for reconnect recovery. When a player disconnects mid-FG sequence, the backend can restore state from this table (Redis is the primary live store; this table is the durable fallback). One row exists per active or recently completed FG session. Rows transition through `PENDING → ACTIVE → COMPLETE | EXPIRED`.

**Access Patterns:**
- INSERT when FG is triggered (after first Coin Toss Heads)
- UPDATE on each FG round completion (fg_round counter, total_fg_win, lightning_marks)
- SELECT by `spin_id` or `player_id` on GET `/v1/session/:sessionId`
- Cleanup job queries rows by `expires_at < NOW()` AND `status != 'COMPLETE'`

```sql
CREATE TYPE fg_session_status AS ENUM ('PENDING', 'ACTIVE', 'COMPLETE', 'EXPIRED');

CREATE TABLE fg_sessions (
    id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    spin_id             UUID              NOT NULL
                                          REFERENCES spins(id) ON DELETE RESTRICT,
    player_id           UUID              NOT NULL
                                          REFERENCES players(id) ON DELETE RESTRICT,
    status              fg_session_status NOT NULL DEFAULT 'PENDING',

    -- FG state
    fg_multiplier       INTEGER           NOT NULL DEFAULT 3
                                          CHECK (fg_multiplier IN (3, 7, 17, 27, 77)),
    bonus_multiplier    INTEGER           NOT NULL DEFAULT 1
                                          CHECK (bonus_multiplier IN (1, 5, 20, 100)),
    fg_round            INTEGER           NOT NULL DEFAULT 0
                                          CHECK (fg_round >= 0 AND fg_round <= 5),
    total_fg_rounds     INTEGER           NOT NULL DEFAULT 0
                                          CHECK (total_fg_rounds >= 0 AND total_fg_rounds <= 5),

    -- Completed rounds: array of FGRound snapshots for reconnect
    completed_rounds    JSONB             NOT NULL DEFAULT '[]',

    -- Lightning marks accumulated across FG rounds (Position[])
    lightning_marks     JSONB             NOT NULL DEFAULT '[]',

    -- Session floor (Buy Feature only; 0.00 if not Buy Feature)
    floor_value         DECIMAL(18,2)     NOT NULL DEFAULT 0.00
                                          CHECK (floor_value >= 0),
    total_fg_win        DECIMAL(18,2)     NOT NULL DEFAULT 0.00
                                          CHECK (total_fg_win >= 0),

    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ       NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

COMMENT ON TABLE fg_sessions IS 'Durable Free Game session state for disconnect recovery. Redis is the primary live store (TTL 300s); this table is the persistent fallback. Rows are created when FG triggers and updated after each round.';
COMMENT ON COLUMN fg_sessions.fg_round IS '0-indexed count of rounds completed. fg_round=0 means FG just started, no rounds played yet.';
COMMENT ON COLUMN fg_sessions.completed_rounds IS 'Array of FGRound JSON snapshots. Allows full FG state reconstruction on reconnect without replaying engine.';
COMMENT ON COLUMN fg_sessions.lightning_marks IS 'Accumulated Position[] across all FG rounds. Persists across FG spins (cleared only when entire FG session completes).';
COMMENT ON COLUMN fg_sessions.floor_value IS 'Buy Feature session floor = 20 * baseBet. 0.00 for non-Buy-Feature sessions. Applied once at FG sequence end.';
COMMENT ON COLUMN fg_sessions.expires_at IS 'Hard expiry for cleanup. Sessions not updated within 10 minutes are marked EXPIRED by the cleanup job.';
```

**Status Transition Constraint:**

```sql
-- Enforce valid status transitions via trigger
CREATE OR REPLACE FUNCTION enforce_fg_session_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- PENDING → ACTIVE allowed
    -- ACTIVE → COMPLETE allowed
    -- ACTIVE → EXPIRED allowed (cleanup job)
    -- COMPLETE → anything NOT allowed
    -- EXPIRED → anything NOT allowed
    IF OLD.status = 'COMPLETE' AND NEW.status != 'COMPLETE' THEN
        RAISE EXCEPTION 'Cannot transition fg_session from COMPLETE to %', NEW.status;
    END IF;
    IF OLD.status = 'EXPIRED' AND NEW.status != 'EXPIRED' THEN
        RAISE EXCEPTION 'Cannot transition fg_session from EXPIRED to %', NEW.status;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fg_session_status_guard
    BEFORE UPDATE ON fg_sessions
    FOR EACH ROW EXECUTE FUNCTION enforce_fg_session_status_transition();
```

**Indexes:**

```sql
-- Primary lookup: by spin_id (GET /v1/session uses spin-derived session ID)
CREATE INDEX idx_fg_sessions_spin_id
    ON fg_sessions (spin_id);

-- Active session lookup by player (reconnect flow)
CREATE INDEX idx_fg_sessions_player_status
    ON fg_sessions (player_id, status)
    WHERE status IN ('PENDING', 'ACTIVE');

-- Cleanup job: find expired sessions
CREATE INDEX idx_fg_sessions_expires_at
    ON fg_sessions (expires_at)
    WHERE status IN ('PENDING', 'ACTIVE');
```

**RLS Policies:**

```sql
ALTER TABLE fg_sessions ENABLE ROW LEVEL SECURITY;

-- Players may read their own FG sessions
CREATE POLICY "fg_sessions_select_own"
    ON fg_sessions FOR SELECT
    USING (auth.uid() = player_id);

-- No direct player mutations — service_role only
CREATE POLICY "fg_sessions_no_player_write"
    ON fg_sessions FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY "fg_sessions_no_player_update"
    ON fg_sessions FOR UPDATE
    USING (FALSE);
```

---

### 2.4 `wallet_transactions`

**Description:** Immutable, append-only financial ledger. Every balance change — spin debit, win credit, or compensating credit on ENGINE_TIMEOUT — produces exactly one row. This table is never updated or deleted. The `idempotency_key` column prevents duplicate credits when the spin endpoint is retried. `balance_before` and `balance_after` allow point-in-time balance reconstruction without scanning `players`.

**Access Patterns:**
- INSERT on every debit/credit (inside the same DB transaction as `players` balance UPDATE)
- SELECT by `player_id` + `created_at` for audit/history
- SELECT by `idempotency_key` before INSERT to detect duplicates
- SELECT by `spin_id` to reconstruct per-spin accounting

```sql
CREATE TYPE wallet_tx_type AS ENUM ('DEBIT', 'CREDIT', 'COMPENSATE');

CREATE TABLE wallet_transactions (
    id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id           UUID              NOT NULL
                                          REFERENCES players(id) ON DELETE RESTRICT,
    spin_id             UUID              -- nullable: COMPENSATE may occur before spin row exists
                                          REFERENCES spins(id) ON DELETE RESTRICT,
    tx_type             wallet_tx_type    NOT NULL,
    amount              DECIMAL(18,2)     NOT NULL CHECK (amount > 0),
    balance_before      DECIMAL(18,2)     NOT NULL CHECK (balance_before >= 0),
    balance_after       DECIMAL(18,2)     NOT NULL CHECK (balance_after >= 0),
    currency            TEXT              NOT NULL CHECK (currency IN ('USD', 'TWD')),
    idempotency_key     TEXT              NOT NULL UNIQUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE wallet_transactions IS 'Immutable financial ledger. Append-only: no UPDATE or DELETE permitted by any role. Retained forever (regulatory requirement).';
COMMENT ON COLUMN wallet_transactions.tx_type IS 'DEBIT = spin cost deducted. CREDIT = totalWin credited. COMPENSATE = refund issued on ENGINE_TIMEOUT (ARCH §6 Partial Failure Compensation).';
COMMENT ON COLUMN wallet_transactions.spin_id IS 'NULL only for COMPENSATE entries where the spin row INSERT failed. Normally always set.';
COMMENT ON COLUMN wallet_transactions.idempotency_key IS 'Format: {tx_type}:{spinId}. UNIQUE constraint prevents double-credit on retry. Checked before INSERT.';
COMMENT ON COLUMN wallet_transactions.balance_before IS 'Player balance immediately before this transaction. Enables point-in-time balance reconstruction.';
COMMENT ON COLUMN wallet_transactions.notes IS 'Optional human-readable annotation for compensating transactions or manual adjustments.';
```

**Idempotency Key Convention:**

```
DEBIT:    "DEBIT:{spinId}"
CREDIT:   "CREDIT:{spinId}"
COMPENSATE: "COMPENSATE:{spinId}:{isoTimestamp}"
```

**Indexes:**

```sql
-- Audit history by player (most recent first)
CREATE INDEX idx_wallet_tx_player_created
    ON wallet_transactions (player_id, created_at DESC);

-- Per-spin accounting lookup
CREATE INDEX idx_wallet_tx_spin_id
    ON wallet_transactions (spin_id)
    WHERE spin_id IS NOT NULL;

-- Duplicate detection (UNIQUE constraint creates index automatically on idempotency_key)

-- Reconciliation: find all COMPENSATEs
CREATE INDEX idx_wallet_tx_type
    ON wallet_transactions (tx_type)
    WHERE tx_type = 'COMPENSATE';
```

**RLS Policies (Append-Only Enforcement):**

```sql
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Players may read their own transaction history
CREATE POLICY "wallet_tx_select_own"
    ON wallet_transactions FOR SELECT
    USING (auth.uid() = player_id);

-- No player or operator may INSERT directly — service_role only
CREATE POLICY "wallet_tx_no_player_insert"
    ON wallet_transactions FOR INSERT
    WITH CHECK (FALSE);

-- Absolutely no UPDATE or DELETE on this table by anyone
-- service_role CANNOT update/delete either — enforced by application layer convention
-- and by granting only INSERT privilege to the service account:
-- REVOKE UPDATE, DELETE ON wallet_transactions FROM service_role;
```

**Append-Only Trigger (belt-and-suspenders):**

```sql
CREATE OR REPLACE FUNCTION prevent_wallet_tx_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'wallet_transactions is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_tx_no_update
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_wallet_tx_mutation();

CREATE TRIGGER wallet_tx_no_delete
    BEFORE DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_wallet_tx_mutation();
```

---

### 2.5 `game_config_versions`

**Description:** Versioned snapshots of game configuration. Each time a new `GameConfig.generated.ts` is deployed (via the Excel → toolchain → CI pipeline), the resulting config JSON is also stored here for auditability. This enables regulatory auditors to answer "what config was active during spin X?" by joining `spins.engine_version` to `game_config_versions.version`.

**Access Patterns:**
- INSERT on each config deploy (CI pipeline step)
- SELECT WHERE `is_active = TRUE` LIMIT 1 (cached in Redis, refreshed every 60s)
- SELECT by `version` to reconstruct historical config

```sql
CREATE TABLE game_config_versions (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    version         TEXT          NOT NULL UNIQUE,
    config          JSONB         NOT NULL,
    rtp_target      DECIMAL(5,4)  NOT NULL DEFAULT 0.9750
                                  CHECK (rtp_target > 0 AND rtp_target <= 1),
    is_active       BOOLEAN       NOT NULL DEFAULT FALSE,
    activated_at    TIMESTAMPTZ,
    created_by      TEXT          NOT NULL DEFAULT 'ci-pipeline',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE game_config_versions IS 'Versioned game configuration snapshots. One row per toolchain run that passes verify.js. Enables regulatory audit: which config was active for any given spin.';
COMMENT ON COLUMN game_config_versions.version IS 'Semantic version matching engineVersion field in FullSpinOutcome. Format: "1.0.0", "1.1.0", etc.';
COMMENT ON COLUMN game_config_versions.config IS 'Full GameConfig JSON as generated by engine_generator.js. Includes symbol weights for all 4 scenarios, paylines, coinProbs, fgMultipliers, fgBonusWeights, nearMiss config.';
COMMENT ON COLUMN game_config_versions.rtp_target IS 'Target RTP at the time this config was generated. 0.9750 = 97.5%.';
COMMENT ON COLUMN game_config_versions.is_active IS 'Only one row should have is_active=TRUE at any time. Managed by the CI deploy step.';
```

**Constraint: Single Active Config:**

```sql
-- Partial unique index: at most one active config at any time
CREATE UNIQUE INDEX idx_game_config_versions_active
    ON game_config_versions (is_active)
    WHERE is_active = TRUE;

-- Index for version lookup
CREATE INDEX idx_game_config_versions_version
    ON game_config_versions (version);
```

**RLS Policies:**

```sql
ALTER TABLE game_config_versions ENABLE ROW LEVEL SECURITY;

-- All authenticated roles may read config versions (operators need audit access)
CREATE POLICY "game_config_select_authenticated"
    ON game_config_versions FOR SELECT
    USING (auth.role() IN ('authenticated', 'service_role'));

-- Only service_role (CI pipeline) may insert/update
CREATE POLICY "game_config_insert_service_only"
    ON game_config_versions FOR INSERT
    WITH CHECK (FALSE); -- service_role bypasses

CREATE POLICY "game_config_update_service_only"
    ON game_config_versions FOR UPDATE
    USING (FALSE); -- service_role bypasses
```

---

## §3 ER Diagram

```mermaid
erDiagram
    players {
        UUID id PK
        TEXT email UK
        TEXT display_name
        DECIMAL balance
        TEXT currency
        BOOLEAN is_suspended
        TEXT engine_version
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    spins {
        UUID id PK
        UUID player_id FK
        TEXT session_id
        INTEGER bet_level
        DECIMAL base_bet
        DECIMAL total_bet
        TEXT currency
        DECIMAL main_cascade_win
        DECIMAL total_fg_win
        DECIMAL total_win
        BOOLEAN extra_bet_active
        BOOLEAN buy_feature_active
        BOOLEAN thunder_blessing_triggered
        TEXT coin_toss_result
        BOOLEAN fg_triggered
        INTEGER fg_multiplier
        INTEGER bonus_multiplier
        BOOLEAN session_floor_applied
        DECIMAL session_floor_value
        BOOLEAN near_miss_applied
        JSONB outcome_json
        TEXT rng_seed
        TEXT engine_version
        INET ip_address
        TIMESTAMPTZ created_at
    }

    fg_sessions {
        UUID id PK
        UUID spin_id FK
        UUID player_id FK
        fg_session_status status
        INTEGER fg_multiplier
        INTEGER bonus_multiplier
        INTEGER fg_round
        INTEGER total_fg_rounds
        JSONB completed_rounds
        JSONB lightning_marks
        DECIMAL floor_value
        DECIMAL total_fg_win
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ expires_at
    }

    wallet_transactions {
        UUID id PK
        UUID player_id FK
        UUID spin_id FK_nullable
        wallet_tx_type tx_type
        DECIMAL amount
        DECIMAL balance_before
        DECIMAL balance_after
        TEXT currency
        TEXT idempotency_key UK
        TEXT notes
        TIMESTAMPTZ created_at
    }

    game_config_versions {
        UUID id PK
        TEXT version UK
        JSONB config
        DECIMAL rtp_target
        BOOLEAN is_active
        TIMESTAMPTZ activated_at
        TEXT created_by
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    players ||--o{ spins : "performs"
    players ||--o{ fg_sessions : "plays"
    players ||--o{ wallet_transactions : "holds"
    spins ||--o| fg_sessions : "triggers"
    spins ||--o{ wallet_transactions : "generates"
```

---

## §4 Redis Schema

Redis (Upstash Standard) serves as the high-speed session store and rate-limiting backend. All keys use consistent naming conventions. TTLs are enforced with `EX` on SET and `EXPIRE` on renewal.

### 4.1 `session:{sessionId}:state`

| Property | Value |
|----------|-------|
| **Key Pattern** | `session:{sessionId}:state` |
| **Data Type** | Hash (Redis HSET/HGET) |
| **TTL** | 300 seconds (renewed on each FG round completion) |
| **Purpose** | Primary live store for in-flight FG session state. Allows sub-millisecond reads on GET `/v1/session/:sessionId`. The PostgreSQL `fg_sessions` table is the durable fallback. |

**Hash Fields:**

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `playerId` | string (UUID) | `"a3f7c2d1-..."` | Owner verification |
| `status` | string | `"ACTIVE"` | `SPINNING\|FG_ACTIVE\|COMPLETE` |
| `baseBet` | string (number) | `"1.00"` | Base bet amount as string |
| `extraBet` | string (boolean) | `"false"` | Serialized boolean |
| `buyFeature` | string (boolean) | `"false"` | Serialized boolean |
| `fgRound` | string (integer) | `"2"` | Rounds completed (0-indexed) |
| `fgMultiplier` | string (integer) | `"17"` | Current FG multiplier |
| `fgBonusMultiplier` | string (integer) | `"5"` | FG bonus multiplier (drawn once at FG start) |
| `totalFGWin` | string (number) | `"4200.00"` | Running FG win total |
| `lightningMarks` | string (JSON) | `"[{\"row\":1,\"col\":2}]"` | Position[] JSON |
| `floorValue` | string (number) | `"20.00"` | Buy Feature floor (0 if not BuyFeature) |
| `lockToken` | string (UUID) | `"lock-uuid-..."` | Optimistic concurrency lock token |
| `lockedAt` | string (integer) | `"1745713200000"` | Unix ms timestamp of lock acquisition |

**Example:**

```
HSET session:sess-abc123:state playerId "a3f7c2d1" status "FG_ACTIVE" fgRound "2" fgMultiplier "17" totalFGWin "4200.00"
EXPIRE session:sess-abc123:state 300
```

---

### 4.2 `session:{sessionId}:lock`

| Property | Value |
|----------|-------|
| **Key Pattern** | `session:{sessionId}:lock` |
| **Data Type** | String (SET NX EX) |
| **TTL** | 10 seconds (hard maximum; auto-releases if spin stalls) |
| **Purpose** | Concurrency guard — prevents two simultaneous spin requests for the same session. Only one spin may hold this lock at a time. Failure to acquire returns HTTP 409 `SPIN_IN_PROGRESS`. |

**Operations:**

```
# Acquire (NX = only set if key does not exist)
SET session:sess-abc123:lock {lockToken-uuid} NX EX 10
# Returns "OK" if acquired, nil if already held

# Release (only by lock holder)
DEL session:sess-abc123:lock
```

**Example Value:** `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`

---

### 4.3 `player:{playerId}:ratelimit`

| Property | Value |
|----------|-------|
| **Key Pattern** | `player:{playerId}:ratelimit` |
| **Data Type** | String (counter via INCR) or Sorted Set (sliding window) |
| **TTL** | 1 second (sliding window, managed by `@fastify/rate-limit`) |
| **Purpose** | Sliding window rate limit: 5 requests/second per player (keyed by JWT `sub`). Exceeding returns HTTP 429 `RATE_LIMITED`. |

**Implementation (sliding window with sorted set):**

```
# On each request:
ZADD player:a3f7c2d1:ratelimit {currentMs} {currentMs}
ZREMRANGEBYSCORE player:a3f7c2d1:ratelimit 0 {currentMs - 1000}
ZCARD player:a3f7c2d1:ratelimit  # if > 5, return 429
EXPIRE player:a3f7c2d1:ratelimit 2  # 2s buffer
```

**Example Value (sorted set members):** `{ 1745713200000, 1745713200200, 1745713200400 }`

---

### 4.4 `config:active`

| Property | Value |
|----------|-------|
| **Key Pattern** | `config:active` |
| **Data Type** | String (JSON serialized) |
| **TTL** | 60 seconds |
| **Purpose** | Cached active game config. Avoids hitting PostgreSQL on every spin for config lookup. Invalidated and refreshed when a new config version is activated via CI pipeline. |

**Example Value:**

```json
{
  "version": "1.0.0",
  "symbols": [...],
  "paylines": [...],
  "coinProbs": [0.80, 0.68, 0.56, 0.48, 0.40],
  "fgMultipliers": [3, 7, 17, 27, 77],
  "fgBonusWeights": [...],
  "maxWinMain": 30000,
  "maxWinEBBuyFG": 90000
}
```

**Invalidation:** `DEL config:active` on new config deploy; next request triggers cache miss and re-populates from `game_config_versions WHERE is_active = TRUE`.

---

### 4.5 `player:{playerId}:balance`

| Property | Value |
|----------|-------|
| **Key Pattern** | `player:{playerId}:balance` |
| **Data Type** | String (decimal as string) |
| **TTL** | 30 seconds |
| **Purpose** | Short-lived balance cache for read-before-debit checks. **Note:** The actual debit/credit always goes directly to PostgreSQL with `FOR UPDATE` locking. This cache is used only for pre-validation display and insufficient-funds fast-path. It is invalidated immediately after every debit or credit. |

> **Warning:** Never use this cached value as the authoritative balance for wallet accounting. The canonical balance is always `players.balance` read with `SELECT ... FOR UPDATE` inside a transaction.

**Example Value:** `"249.75"`

**Invalidation:** `DEL player:{playerId}:balance` immediately after any debit or credit completes.

---

### 4.6 Redis Key Summary

| Key Pattern | Type | TTL | Usage Frequency |
|-------------|------|-----|-----------------|
| `session:{id}:state` | Hash | 300s | Per FG round |
| `session:{id}:lock` | String | 10s | Per spin |
| `player:{id}:ratelimit` | Sorted Set | 1s (sliding) | Per request |
| `config:active` | String | 60s | Per spin (cache hit) |
| `player:{id}:balance` | String | 30s | Pre-validation reads |

---

## §5 Indexes and Query Patterns

### 5.1 Spin History by Player (Audit)

**Query:** Retrieve paginated spin history for a player for regulatory audit or player history UI.

```sql
SELECT id, session_id, base_bet, total_bet, total_win, fg_triggered,
       fg_multiplier, buy_feature_active, session_floor_applied, created_at
FROM spins
WHERE player_id = $1
  AND created_at >= $2  -- date range start
  AND created_at <  $3  -- date range end
ORDER BY created_at DESC
LIMIT 50 OFFSET $4;
```

**Supporting Index:** `idx_spins_player_id_created_at ON spins (player_id, created_at DESC)`
**Partition Pruning:** PostgreSQL automatically prunes monthly partitions using the `created_at` range predicates.
**Expected Performance:** P99 < 10ms with index scan on a single partition.

---

### 5.2 Active FG Session Lookup by Player (Reconnect)

**Query:** Find the active FG session for a player on reconnect (GET `/v1/session/:sessionId`). Redis is checked first; this query is the fallback.

```sql
SELECT id, spin_id, fg_multiplier, bonus_multiplier, fg_round,
       completed_rounds, lightning_marks, floor_value, total_fg_win,
       status, expires_at
FROM fg_sessions
WHERE player_id = $1
  AND status IN ('PENDING', 'ACTIVE')
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;
```

**Supporting Index:** `idx_fg_sessions_player_status ON fg_sessions (player_id, status) WHERE status IN ('PENDING', 'ACTIVE')`
**Expected Performance:** P99 < 5ms (small result set, partial index).

---

### 5.3 Wallet Transaction History by Player

**Query:** Retrieve transaction history for audit reconciliation or player account statement.

```sql
SELECT id, spin_id, tx_type, amount, balance_before, balance_after,
       currency, idempotency_key, created_at
FROM wallet_transactions
WHERE player_id = $1
ORDER BY created_at DESC
LIMIT 100 OFFSET $2;
```

**Supporting Index:** `idx_wallet_tx_player_created ON wallet_transactions (player_id, created_at DESC)`
**Expected Performance:** P99 < 15ms for first page.

---

### 5.4 Idempotency Check Before Credit INSERT

**Query:** Before inserting a CREDIT or COMPENSATE transaction, check if `idempotency_key` already exists to prevent double-credit.

```sql
SELECT id FROM wallet_transactions
WHERE idempotency_key = $1
LIMIT 1;
```

**Supporting Index:** Unique index on `wallet_transactions.idempotency_key` (created automatically by `UNIQUE` constraint).
**Expected Performance:** O(log n) B-tree lookup, < 1ms.

---

### 5.5 Rate Limit Check (Redis)

Rate limiting does not use PostgreSQL. The `player:{playerId}:ratelimit` sorted set in Redis is checked and updated atomically using a Lua script via `@fastify/rate-limit`. See §4.3 for key details.

---

### 5.6 Active Config Fetch

```sql
-- Cache miss fallback (Redis config:active expired)
SELECT version, config, rtp_target
FROM game_config_versions
WHERE is_active = TRUE
LIMIT 1;
```

**Supporting Index:** `idx_game_config_versions_active` (partial unique index where `is_active = TRUE`)
**Expected Performance:** Single-row lookup, < 2ms.

---

## §6 Data Integrity Rules

### 6.1 Wallet Balance Non-Negativity

**Enforcement:** `CHECK (balance >= 0)` on `players.balance`. PostgreSQL will reject any `UPDATE` that would result in a negative balance.

**Application-Level Guard:** `SpinUseCase` calls `getBalance()` then checks `balance >= cost` before calling `debit()`. The DB constraint is the final backstop.

```sql
-- This will raise: ERROR: new row for relation "players" violates check constraint "players_balance_check"
UPDATE players SET balance = balance - 1000.00 WHERE id = $1 AND balance < 1000.00;
```

### 6.2 Wallet Transactions Append-Only

**Enforcement:** Three-layer defense:
1. **Trigger:** `prevent_wallet_tx_mutation()` raises exception on UPDATE or DELETE.
2. **RLS:** No UPDATE or DELETE policies defined for any role on `wallet_transactions`.
3. **Privilege:** Application service account is granted only `SELECT, INSERT` on `wallet_transactions`:

```sql
-- Grant only SELECT and INSERT to application service account
GRANT SELECT, INSERT ON wallet_transactions TO service_role;
-- UPDATE and DELETE not granted; trigger provides final backstop
```

### 6.3 FG Session Status Transitions

Valid transitions (enforced by `enforce_fg_session_status_transition` trigger):

```
PENDING → ACTIVE      (FG sequence begins, first round starts)
ACTIVE  → COMPLETE    (FG sequence finishes, all rounds done)
ACTIVE  → EXPIRED     (cleanup job marks stale sessions)
COMPLETE → (blocked)  (terminal state)
EXPIRED  → (blocked)  (terminal state)
```

### 6.4 Idempotency: Unique `wallet_transactions.idempotency_key`

The `UNIQUE` constraint on `idempotency_key` prevents duplicate credit entries. Before inserting any transaction, the application layer checks for existence using the pattern `{tx_type}:{spinId}`. If the key already exists, the INSERT is skipped and the existing transaction is returned. This handles network retries safely.

### 6.5 Single Active Game Config

The partial unique index `idx_game_config_versions_active WHERE is_active = TRUE` ensures at most one row has `is_active = TRUE`. The CI pipeline uses the following atomic swap pattern:

```sql
BEGIN;
UPDATE game_config_versions SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE;
UPDATE game_config_versions SET is_active = TRUE, activated_at = NOW(), updated_at = NOW()
    WHERE version = $1;
COMMIT;
```

### 6.6 Buy Feature Session Floor Invariant

**Business rule (from BRD §BR-07):** For Buy Feature spins, `totalWin >= 20 * baseBet`.

**Enforcement:** `SessionFloorGuard.applyFloor()` compares `totalFGWin` against `floorValue` at the end of the FG sequence and adjusts the credited amount. The `fg_sessions.floor_value` column stores this threshold. The `spins.session_floor_applied` column records whether the floor was triggered.

**Verification query (reconciliation job):**

```sql
SELECT id, base_bet, total_win, session_floor_value
FROM spins
WHERE buy_feature_active = TRUE
  AND total_win < (base_bet * 20)
  AND session_floor_applied = FALSE;
-- Should return zero rows in correct operation
```

---

## §7 Partitioning and Retention

### 7.1 `spins` Table Partitioning

**Strategy:** Range partitioning by `created_at` (monthly).
**Rationale:** Spin volume at 100 RPS sustained = up to ~8.6M rows/day (theoretical maximum). Monthly partitions enable:
- Efficient date-range queries (partition pruning)
- Fast partition drop for retention enforcement
- Online partition maintenance without locking

**Retention Policy:** 13 months. After 13 months, drop the oldest partition:

```sql
-- Drop partition older than 13 months (run as monthly cron job)
-- Example: dropping April 2025 partition in May 2026
DROP TABLE IF EXISTS spins_2025_04;
```

**Partition Creation Automation:** A database cron job (pg_cron or external scheduler) creates the next month's partition 30 days in advance:

```sql
-- Example: creates June 2026 partition on May 1, 2026
CREATE TABLE spins_2026_06 PARTITION OF spins
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

**Local indexes on each partition:**

```sql
-- Each partition inherits the parent indexes, but may also have partition-local indexes
-- PostgreSQL 15 propagates index definitions to new partitions automatically
```

### 7.2 `wallet_transactions` Retention

**Retention:** Forever (regulatory requirement — gambling financial records must be retained indefinitely in most jurisdictions).

**Strategy:** No partitioning in Phase 1. If the table grows beyond 100M rows, apply range partitioning by `created_at` (annual) without dropping old partitions.

**Archiving (Phase 3+):** Rows older than 7 years may be moved to cold storage (e.g., Supabase Storage as Parquet files) with a summary index retained in the primary table.

### 7.3 `fg_sessions` Cleanup

**TTL-Based Cleanup:** Sessions with `status IN ('PENDING', 'ACTIVE')` and `expires_at < NOW()` are marked `EXPIRED` by a scheduled job.

**Cleanup Job (run every 5 minutes):**

```sql
UPDATE fg_sessions
SET status = 'EXPIRED', updated_at = NOW()
WHERE status IN ('PENDING', 'ACTIVE')
  AND expires_at < NOW();
```

**Archiving:** `COMPLETE` and `EXPIRED` rows older than 90 days may be archived to cold storage. The `spins.outcome_json` column retains the full FG result independently.

```sql
-- Archive old completed sessions (run monthly)
DELETE FROM fg_sessions
WHERE status IN ('COMPLETE', 'EXPIRED')
  AND updated_at < NOW() - INTERVAL '90 days';
```

### 7.4 Retention Summary

| Table | Partition Strategy | Retention | Enforcement |
|-------|-------------------|-----------|-------------|
| `players` | None | Forever | N/A |
| `spins` | Monthly range on `created_at` | 13 months | DROP PARTITION monthly cron |
| `fg_sessions` | None | 90 days (COMPLETE/EXPIRED) | DELETE monthly cron |
| `wallet_transactions` | None (annual in Phase 3+) | Forever | No deletion |
| `game_config_versions` | None | Forever | No deletion (audit trail) |

---

## §8 Migration Strategy

### 8.1 Migration File Convention

All schema changes are applied via numbered, sequential migration files:

```
migrations/
├── 001_initial_schema.sql         -- All tables, indexes, RLS policies
├── 002_add_spins_partitions.sql   -- Monthly spin partitions
├── 003_add_fg_session_trigger.sql -- Status transition trigger
├── 004_add_wallet_tx_guard.sql    -- Append-only trigger
├── 005_add_config_versions.sql    -- game_config_versions table
└── 006_add_anomaly_indexes.sql    -- Additional analytics indexes
```

**Naming:** `{NNN}_{description}.sql` — three-digit zero-padded sequence number.

**Runner:** Migrations are applied using Supabase CLI (`supabase db push`) or a custom runner that tracks applied migrations in a `schema_migrations` table.

### 8.2 Additive-Only Policy

In production, schema migrations follow these rules:

| Operation | Allowed in Production | Notes |
|-----------|----------------------|-------|
| `CREATE TABLE` | Yes | Safe to add new tables |
| `ALTER TABLE ADD COLUMN` | Yes (nullable or with DEFAULT) | Safe for existing rows |
| `CREATE INDEX CONCURRENTLY` | Yes | Avoids locking |
| `CREATE INDEX` (non-concurrent) | Staging/maintenance window only | Locks table briefly |
| `ALTER TABLE DROP COLUMN` | No | Deprecate first (nullable + app ignores) |
| `DROP TABLE` | No | Archive to cold storage instead |
| `ALTER COLUMN TYPE` | No | Add new column, migrate data, deprecate old |
| `RENAME COLUMN` | No | Add new column, copy data, deprecate old |

**Deprecation Period:** Minimum 2 sprint cycles (4 weeks) between column deprecation and removal.

### 8.3 Zero-Downtime Migration Approach

For columns requiring backfill or type changes, use the expand-migrate-contract pattern:

```sql
-- Phase 1 (Expand): Add new column alongside old
ALTER TABLE spins ADD COLUMN total_win_v2 DECIMAL(18,2);

-- Phase 2 (Migrate): Backfill in batches (run offline or during low-traffic window)
UPDATE spins SET total_win_v2 = total_win WHERE total_win_v2 IS NULL
    AND id IN (SELECT id FROM spins WHERE total_win_v2 IS NULL LIMIT 10000);

-- Phase 3 (Contract): After all app instances use new column, drop old
-- ALTER TABLE spins DROP COLUMN total_win; -- only after full deprecation period
```

**Index Creation:** Always use `CREATE INDEX CONCURRENTLY` in production to avoid table locks:

```sql
-- Safe: builds index without locking reads or writes
CREATE INDEX CONCURRENTLY idx_spins_new_column ON spins (new_column);
```

### 8.4 Rollback Strategy

Each migration file must have a corresponding rollback in comments or a separate `{NNN}_rollback.sql` file:

```sql
-- 006_add_anomaly_indexes.sql rollback:
-- DROP INDEX IF EXISTS idx_spins_total_win;
-- DROP INDEX IF EXISTS idx_spins_fg_triggered;
```

For table-level changes that cannot be rolled back safely, a new forward migration (e.g., `007_revert_006.sql`) is used instead.

---

## §9 Atomicity and Transaction Patterns

### 9.1 Spin Debit/Credit Transaction

The wallet debit and credit operations use PostgreSQL transactions with `SELECT ... FOR UPDATE` to prevent race conditions:

```sql
-- Debit pattern (inside SpinUseCase, before engine call)
BEGIN;

SELECT balance FROM players
WHERE id = $playerId AND currency = $currency
FOR UPDATE;                          -- Row-level lock; prevents concurrent debit

-- Application checks: balance >= cost

UPDATE players
SET balance = balance - $cost,
    updated_at = NOW()
WHERE id = $playerId;

INSERT INTO wallet_transactions
    (player_id, spin_id, tx_type, amount, balance_before, balance_after,
     currency, idempotency_key)
VALUES
    ($playerId, $spinId, 'DEBIT', $cost, $balanceBefore, $balanceAfter,
     $currency, 'DEBIT:' || $spinId);

COMMIT;
```

```sql
-- Credit pattern (inside SpinUseCase, after engine resolves totalWin)
BEGIN;

UPDATE players
SET balance = balance + $totalWin,
    updated_at = NOW()
WHERE id = $playerId;

INSERT INTO wallet_transactions
    (player_id, spin_id, tx_type, amount, balance_before, balance_after,
     currency, idempotency_key)
VALUES
    ($playerId, $spinId, 'CREDIT', $totalWin, $balanceBefore, $balanceAfter,
     $currency, 'CREDIT:' || $spinId);

COMMIT;
```

### 9.2 Engine Timeout Compensation (ARCH §6)

When the spin engine times out after the wallet has already been debited:

```sql
BEGIN;

-- Read current balance
SELECT balance FROM players WHERE id = $playerId FOR UPDATE;

-- Credit back the deducted amount
UPDATE players
SET balance = balance + $cost, updated_at = NOW()
WHERE id = $playerId;

-- Insert COMPENSATE transaction
INSERT INTO wallet_transactions
    (player_id, spin_id, tx_type, amount, balance_before, balance_after,
     currency, idempotency_key, notes)
VALUES
    ($playerId, NULL, 'COMPENSATE', $cost, $balanceBefore, $balanceAfter,
     $currency,
     'COMPENSATE:' || $spinId || ':' || to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS'),
     'ENGINE_TIMEOUT compensation for spin attempt ' || $spinId);

COMMIT;
```

---

## §10 Observability and Monitoring

### 10.1 Key DB Metrics to Monitor

| Metric | Alert Threshold | Query |
|--------|-----------------|-------|
| Wallet balance discrepancies | Any | Reconciliation job: compare sum of wallet_transactions vs players.balance |
| Orphaned FG sessions | > 10 per hour | `SELECT COUNT(*) FROM fg_sessions WHERE status='ACTIVE' AND expires_at < NOW()` |
| Compensating transactions | > 0 per hour | `SELECT COUNT(*) FROM wallet_transactions WHERE tx_type = 'COMPENSATE'` |
| Negative balance attempts | Any | Caught by CHECK constraint; alert on `pg_stat_activity` errors |

### 10.2 Daily Reconciliation Job

```sql
-- Verify wallet balance integrity: players.balance should equal sum of credits minus debits
SELECT
    p.id,
    p.balance AS current_balance,
    COALESCE(SUM(CASE WHEN wt.tx_type = 'CREDIT' THEN wt.amount
                      WHEN wt.tx_type = 'COMPENSATE' THEN wt.amount
                      ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN wt.tx_type = 'DEBIT' THEN wt.amount ELSE 0 END), 0)
    AS computed_balance,
    p.balance - (
        COALESCE(SUM(CASE WHEN wt.tx_type IN ('CREDIT','COMPENSATE') THEN wt.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN wt.tx_type = 'DEBIT' THEN wt.amount ELSE 0 END), 0)
    ) AS discrepancy
FROM players p
LEFT JOIN wallet_transactions wt ON wt.player_id = p.id
GROUP BY p.id, p.balance
HAVING ABS(
    p.balance - (
        COALESCE(SUM(CASE WHEN wt.tx_type IN ('CREDIT','COMPENSATE') THEN wt.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN wt.tx_type = 'DEBIT' THEN wt.amount ELSE 0 END), 0)
    )
) > 0.01;  -- Alert if discrepancy > $0.01
```

---

*End of SCHEMA.md — Thunder Blessing Slot Game*
