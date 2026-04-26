# API.md — API Design Document
# Thunder Blessing Slot Game

---

## §0 Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | API-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Status** | DRAFT |
| **Author** | AI Generated (gendoc D08-API) |
| **Date** | 2026-04-26 |
| **client_type** | game (Cocos Creator / PixiJS frontend) |

### Upstream Document Links

| Document | Section | Relevance |
|----------|---------|-----------|
| [PRD.md](PRD.md) | §4 Scope, §5 User Stories | Requirements; AC-1 to AC-5 per use case |
| [EDD.md](EDD.md) | §5.2 FullSpinOutcome, §6 API Design, §6.3 Error Codes, §8 Security | Canonical schema, error code table, auth |
| [ARCH.md](ARCH.md) | §1.2 ADRs, §3 Component Diagram, §5 Communication Patterns, §6 Data Layering | ADR-002/003 single-trip; rate limiting; circuit breakers |
| [PDD.md](PDD.md) | §1 Design Vision, §2 Symbol Design | Symbol identifiers, currency display |
| [diagrams/class-application.md](diagrams/class-application.md) | FullSpinOutcomeDTO, CascadeStepDTO | DTO field names and types |
| [diagrams/class-domain.md](diagrams/class-domain.md) | SymbolId enum, Value Objects | Canonical symbol enumeration |
| [diagrams/sequence-spin-happy.md](diagrams/sequence-spin-happy.md) | Happy-path spin sequence | Request/response flow reference |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | AI Generated (gendoc D08-API) | Initial generation |

---

## §1 API Overview

### 1.1 Base URL

```
/v1
```

All game endpoints are prefixed with `/v1`. Health and readiness probes are at the root level (`/health`, `/ready`) with no version prefix.

### 1.2 Protocol

- **HTTPS only** — TLS 1.3 terminated at the Kubernetes Ingress (nginx-ingress).
- Plaintext HTTP connections are rejected at the Ingress level.
- HSTS header is set: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

### 1.3 Authentication

- **Algorithm:** RS256 JWT Bearer token issued by **Supabase Auth**
- **Header:** `Authorization: Bearer <access_token>`
- **Token TTL:** Access token 3600s (1 hour); Refresh token 604800s (7 days)
- **Claims:** `sub` (player UUID), `role` (`player` | `operator` | `service_role`), `exp`, `iat`
- **Verification:** `JwtAuthGuard` runs as a Fastify `preHandler` on all `/v1/*` routes. The RS256 public key is cached in memory (TTL 1 hour) — no DB call per request.
- Health/readiness probes (`GET /health`, `GET /ready`) require **no auth**.

### 1.4 Rate Limits

- **Global limit:** 5 requests/second per player (keyed by JWT `sub` claim)
- **Implementation:** `@fastify/rate-limit` with Redis store (sliding window algorithm)
- **Exceed response:** HTTP 429 — see §5 for full rate-limit response format
- Extra Bet and Buy Feature requests count against the same limit

### 1.5 Content-Type

All requests and responses use `application/json`. Requests with a body must include `Content-Type: application/json`.

### 1.6 Versioning Strategy

- Current version: `v1` (path-based versioning: `/v1/...`)
- New non-breaking fields may be added to response bodies without a version bump (additive-only changes)
- Breaking changes (field removal, type change, semantic change) require a new path prefix (`/v2/...`)
- `v1` endpoints remain supported for a minimum of 12 months after `v2` GA release
- Deprecation is announced via `Deprecation` and `Sunset` response headers

### 1.7 Standard Error Envelope

All error responses from `/v1/*` endpoints use this envelope:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Human-readable description of the error",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-04-26T12:34:56.789Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `false` for errors |
| `code` | `string` | Machine-readable error code (see §1.8) |
| `message` | `string` | Human-readable message; never exposes raw DB errors or internal stack traces |
| `requestId` | `string` (UUID) | Unique identifier for log correlation; matches `X-Request-Id` response header |
| `timestamp` | `string` (ISO 8601) | Server time when error was generated |

### 1.8 All Error Codes

| HTTP Status | Code | Trigger Endpoint(s) | Description |
|-------------|------|---------------------|-------------|
| 400 | `INSUFFICIENT_FUNDS` | POST /v1/spin | Player balance is less than the spin cost (baseBet or baseBet×100 for Buy Feature) |
| 400 | `INVALID_BET_LEVEL` | POST /v1/spin | `betLevel` is outside the configured range (USD: 1–20; TWD: 1–320); or `betLevel` is not an integer |
| 400 | `INVALID_CURRENCY` | POST /v1/spin | `currency` is not `"USD"` or `"TWD"` |
| 400 | `BUY_FEATURE_NOT_ALLOWED` | POST /v1/spin | `buyFeature: true` combined with invalid bet level or in a context where Buy Feature is unavailable |
| 400 | `VALIDATION_ERROR` | POST /v1/spin | Request body fails JSON schema validation (missing required field, wrong type, out-of-range value) |
| 401 | `UNAUTHORIZED` | POST /v1/spin, GET /v1/session/:sessionId, GET /v1/config | JWT is missing, malformed, expired, or signature invalid |
| 403 | `FORBIDDEN` | POST /v1/spin, GET /v1/session/:sessionId | JWT is valid but the player's account is suspended, or the player is attempting to access another player's session |
| 404 | `SESSION_NOT_FOUND` | GET /v1/session/:sessionId | Session ID does not exist in Redis (expired after 300s TTL or never created) |
| 409 | `SPIN_IN_PROGRESS` | POST /v1/spin | A concurrent spin is already in progress for this player (Redis NX lock is held); request is rejected without debiting wallet |
| 422 | `VALIDATION_ERROR` | POST /v1/spin | Semantically invalid payload where `extraBet: true` + `buyFeature: true` is a **valid** combination (costs 300× baseBet) and is NOT itself a validation error. VALIDATION_ERROR occurs only when `betLevel` is out of range for the given currency, or `extraBet`/`buyFeature` is unavailable for the game config. Note: `INSUFFICIENT_FUNDS` (not VALIDATION_ERROR) is returned when balance < 300× baseBet for the extraBet+buyFeature combination. |
| 429 | `RATE_LIMITED` | POST /v1/spin | Player has exceeded 5 requests/second |
| 500 | `INTERNAL_ERROR` | All /v1/* | Unexpected engine or infrastructure error not matching any specific code |
| 503 | `SERVICE_UNAVAILABLE` | POST /v1/spin | Circuit breaker OPEN on PostgreSQL or Redis (cascading failure protection) |
| 504 | `ENGINE_TIMEOUT` | POST /v1/spin | Spin engine took > 2000ms; wallet IS debited before engine runs; a compensating credit is issued automatically (see ARCH §6 Partial Failure Compensation) |

---

## §2 Authentication & Security

### 2.1 JWT Flow

**Step 1 — Obtain access token (client-side, Supabase Auth SDK):**

```
POST https://<project>.supabase.co/auth/v1/token?grant_type=password
Content-Type: application/json

{ "email": "player@example.com", "password": "..." }
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1.refresh-token-string",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

**Step 2 — Attach token to game API requests:**

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 3 — Backend verifies token:**

`JwtAuthGuard` calls `SupabaseAuthAdapter.verifyJWT(token)`, which:
1. Verifies the RS256 signature using the cached Supabase public key
2. Checks `exp` claim — expired tokens return 401 `UNAUTHORIZED`
3. Checks `role` claim — suspended accounts return 403 `FORBIDDEN`
4. Extracts `sub` as `playerId`, attaches `PlayerClaims` to request context

### 2.2 Token Refresh Flow

When the access token expires (after 3600s), the client must refresh before the next spin:

```
POST https://<project>.supabase.co/auth/v1/token?grant_type=refresh_token
Content-Type: application/json

{ "refresh_token": "v1.refresh-token-string" }
```

Response: new `access_token` + rotated single-use `refresh_token`. Refresh tokens are valid for 604800s (7 days).

**Frontend integration note:** The Supabase JS SDK handles token refresh automatically via `onAuthStateChange`. The game client should listen for the `TOKEN_REFRESHED` event and update the stored token before the next spin call.

### 2.3 JWT Claims Structure

| Claim | Type | Example | Description |
|-------|------|---------|-------------|
| `sub` | string (UUID) | `"a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234"` | Player UUID; used as `playerId` throughout the API |
| `role` | string | `"player"` | `player`, `operator`, or `service_role` |
| `exp` | number | `1745716800` | Unix timestamp; token expires at this time |
| `iat` | number | `1745713200` | Unix timestamp; token issued at this time |
| `aud` | string | `"authenticated"` | Supabase audience claim |

### 2.4 Rate Limiting Details

- **Algorithm:** Sliding window counter, backed by Redis
- **Window:** 1 second
- **Limit:** 5 requests per player per window
- **Key:** JWT `sub` claim (player UUID); falls back to client IP if JWT not yet verified
- **Response on limit exceeded:** HTTP 429 with rate-limit headers (see §5)
- **Auth failure lockout:** After 10 consecutive failed JWT verifications from the same IP within 60s, the IP is rate-limited more aggressively (configurable via `RATE_LIMIT_AUTH_FAIL_MAX` env var)

### 2.5 Role-Based Endpoint Access

| Endpoint | player | operator | service_role |
|----------|--------|----------|--------------|
| POST /v1/spin | ✅ | ❌ (403) | ✅ |
| GET /v1/session/:sessionId | ✅ (own) | ❌ (403) | ✅ |
| GET /v1/config | ✅ | ✅ | ✅ |
| GET /health | ✅ | ✅ | ✅ |
| GET /ready | ✅ | ✅ | ✅ |

> See EDD §8.1 permission matrix for full authorization rules.

### 2.6 CORS Policy

```
Access-Control-Allow-Origin: https://*.yourdomain.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-Id
Access-Control-Max-Age: 86400
```

In development, `Access-Control-Allow-Origin: *` is permitted. In production, only listed origins are allowed. The allowed origins list is configured via the `CORS_ALLOWED_ORIGINS` environment variable.

---

## §3 Endpoints

### 3.1 POST /v1/spin

**Summary:** Execute a single spin. Returns the complete `FullSpinOutcome` including all Cascade steps, Thunder Blessing results, Coin Toss outcome, and all Free Game rounds (if triggered). This is a single-trip endpoint — one POST returns everything the frontend needs to render the entire game round.

**Authentication required:** Yes — JWT Bearer token

**Rate limit:** 5 req/s per player (global default)

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <access_token>` |
| `Content-Type` | Yes | `application/json` |
| `X-Request-Id` | No | Client-provided UUID for idempotency tracking; echoed in response `X-Request-Id` header |

#### Request Body

```json
{
  "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
  "sessionId": "sess-9e2b1a34-6f7c-4d2e-b8a1-c5d9e0f12345",
  "betLevel": 5,
  "currency": "USD",
  "extraBet": false,
  "buyFeature": false
}
```

#### Request Body JSON Schema

```json
{
  "type": "object",
  "required": ["playerId", "betLevel", "currency", "extraBet", "buyFeature"],
  "additionalProperties": false,
  "properties": {
    "playerId": {
      "type": "string",
      "format": "uuid",
      "description": "Player UUID — must match JWT sub claim"
    },
    "sessionId": {
      "type": ["string", "null"],
      "description": "Session identifier (format: sess-{uuid}). Existing session for FG resume; null or omitted for a new spin"
    },
    "betLevel": {
      "type": "integer",
      "minimum": 1,
      "maximum": 320,
      "description": "Bet level index. USD valid range: 1–20. TWD valid range: 1–320. Values outside the currency-specific range return INVALID_BET_LEVEL."
    },
    "currency": {
      "type": "string",
      "enum": ["USD", "TWD"],
      "description": "Player's selected currency. Determines baseBet amount from BetRangeConfig."
    },
    "extraBet": {
      "type": "boolean",
      "description": "If true: spin cost is baseBet × 3; a Scatter symbol is guaranteed to appear in the grid."
    },
    "buyFeature": {
      "type": "boolean",
      "description": "If true: spin cost is baseBet × 100; triggers guaranteed Heads × 5 FG sequence; session floor ≥ 20× baseBet is applied."
    }
  }
}
```

**Bet Level to baseBet Mapping (examples):**

| betLevel | USD baseBet | TWD baseBet | USD totalBet (extraBet=false) | USD totalBet (extraBet=true) |
|----------|-------------|-------------|-------------------------------|------------------------------|
| 1 | $0.10 | TWD 3 | $0.10 | $0.30 |
| 5 | $0.50 | TWD 15 | $0.50 | $1.50 |
| 10 | $1.00 | TWD 30 | $1.00 | $3.00 |
| 15 | $1.50 | TWD 45 | $1.50 | $4.50 |
| 20 | $2.00 | TWD 60 | $2.00 | $6.00 |

Full bet table is available via `GET /v1/config`.

#### Response 200 — FullSpinOutcome

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-04-26T14:22:31.445Z",
  "data": {
    "spinId": "spin-7d3a9b2c-1e4f-4c8d-a5b6-9e0f12345678",
    "sessionId": "sess-9e2b1a34-6f7c-4d2e-b8a1-c5d9e0f12345",
    "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
    "betLevel": 5,
    "baseBet": 0.50,
    "totalBet": 0.50,
    "totalWin": 1.25,
    "newBalance": 249.75,
    "currency": "USD",
    "extraBetActive": false,
    "buyFeatureActive": false,

    "initialGrid": [
      ["P2", "L1", "P4", "W", "L3"],
      ["L2", "P1", "L4", "P3", "L1"],
      ["P4", "L3", "W", "L2", "P2"]
    ],
    "finalGrid": [
      ["L3", "P2", "L1", "P4", "W"],
      ["P2", "L2", "P1", "L4", "P3"],
      ["L4", "P4", "L3", "W", "L2"],
      ["P3", "L1", "P2", "L3", "P4"]
    ],
    "finalRows": 4,

    "cascadeSequence": {
      "steps": [
        {
          "index": 0,
          "grid": [
            ["P2", "L1", "P4", "W", "L3"],
            ["L2", "P1", "L4", "P3", "L1"],
            ["P4", "L3", "W", "L2", "P2"]
          ],
          "winLines": [
            {
              "paylineId": 3,
              "symbolId": "L2",
              "matchCount": 3,
              "positions": [
                { "row": 1, "col": 0 },
                { "row": 1, "col": 1 },
                { "row": 1, "col": 2 }
              ],
              "payout": 0.75
            }
          ],
          "stepWin": 0.75,
          "newLightningMarks": [
            { "row": 1, "col": 0 },
            { "row": 1, "col": 1 },
            { "row": 1, "col": 2 }
          ],
          "rows": 3
        },
        {
          "index": 1,
          "grid": [
            ["L3", "P2", "L1", "P4", "W"],
            ["P2", "L2", "P1", "L4", "P3"],
            ["L4", "P4", "L3", "W", "L2"],
            ["P3", "L1", "P2", "L3", "P4"]
          ],
          "winLines": [
            {
              "paylineId": 1,
              "symbolId": "P4",
              "matchCount": 3,
              "positions": [
                { "row": 0, "col": 3 },
                { "row": 2, "col": 1 },
                { "row": 3, "col": 4 }
              ],
              "payout": 0.50
            }
          ],
          "stepWin": 0.50,
          "newLightningMarks": [
            { "row": 0, "col": 3 },
            { "row": 2, "col": 1 },
            { "row": 3, "col": 4 }
          ],
          "rows": 4
        }
      ],
      "totalWin": 1.25,
      "finalGrid": [
        ["L3", "P2", "L1", "P4", "W"],
        ["P2", "L2", "P1", "L4", "P3"],
        ["L4", "P4", "L3", "W", "L2"],
        ["P3", "L1", "P2", "L3", "P4"]
      ],
      "finalRows": 4,
      "lightningMarks": {
        "positions": [
          { "row": 1, "col": 0 },
          { "row": 1, "col": 1 },
          { "row": 1, "col": 2 },
          { "row": 0, "col": 3 },
          { "row": 2, "col": 1 },
          { "row": 3, "col": 4 }
        ],
        "count": 6
      }
    },

    "thunderBlessingTriggered": false,
    "thunderBlessingFirstHit": false,
    "thunderBlessingSecondHit": false,
    "upgradedSymbol": null,
    "thunderBlessingResult": null,

    "coinTossTriggered": false,
    "coinTossResult": null,

    "fgTriggered": false,
    "fgMultiplier": null,
    "fgRounds": [],
    "fgBonusMultiplier": null,
    "totalFGWin": null,

    "sessionFloorApplied": false,
    "sessionFloorValue": null,

    "nearMissApplied": false,
    "engineVersion": "1.0.0",
    "timestamp": "2026-04-26T14:22:31.445Z"
  }
}
```

#### Response 200 JSON Schema — FullSpinOutcome (data object)

```json
{
  "type": "object",
  "required": [
    "spinId", "sessionId", "playerId", "betLevel", "baseBet", "totalBet",
    "totalWin", "newBalance", "currency", "extraBetActive", "buyFeatureActive",
    "initialGrid", "finalGrid", "finalRows", "cascadeSequence",
    "thunderBlessingTriggered", "thunderBlessingFirstHit", "thunderBlessingSecondHit",
    "upgradedSymbol", "thunderBlessingResult",
    "coinTossTriggered", "coinTossResult",
    "fgTriggered", "fgMultiplier", "fgRounds", "fgBonusMultiplier", "totalFGWin",
    "sessionFloorApplied", "sessionFloorValue",
    "nearMissApplied", "engineVersion", "timestamp"
  ],
  "properties": {
    "spinId": { "type": "string", "description": "Spin identifier (format: spin-{uuid})" },
    "sessionId": { "type": "string", "description": "Session identifier (format: sess-{uuid})" },
    "playerId": { "type": "string", "format": "uuid" },
    "betLevel": { "type": "integer", "minimum": 1, "maximum": 320 },
    "baseBet": { "type": "number", "description": "Base bet amount in player's currency" },
    "totalBet": { "type": "number", "description": "Actual amount debited: baseBet × 1 (normal), × 3 (extraBet), × 100 (buyFeature)" },
    "totalWin": { "type": "number", "description": "Total win credited to wallet. SOLE ACCOUNTING AUTHORITY. 0 if no win." },
    "newBalance": { "type": "number", "description": "Player wallet balance after this spin (post-credit)" },
    "currency": { "type": "string", "enum": ["USD", "TWD"] },
    "extraBetActive": { "type": "boolean" },
    "buyFeatureActive": { "type": "boolean" },
    "initialGrid": {
      "type": "array",
      "description": "5×3 initial grid before Cascade. Outer array = rows (0-indexed top to bottom), inner = columns (left to right).",
      "items": {
        "type": "array",
        "items": { "type": "string", "enum": ["W", "SC", "P1", "P2", "P3", "P4", "L1", "L2", "L3", "L4"] }
      }
    },
    "finalGrid": {
      "type": "array",
      "description": "Final grid after all Cascade steps. Rows count equals finalRows.",
      "items": {
        "type": "array",
        "items": { "type": "string", "enum": ["W", "SC", "P1", "P2", "P3", "P4", "L1", "L2", "L3", "L4"] }
      }
    },
    "finalRows": { "type": "integer", "enum": [3, 4, 5, 6], "description": "Final row count after Cascade expansion" },
    "cascadeSequence": { "$ref": "#/definitions/CascadeSequence" },
    "thunderBlessingTriggered": { "type": "boolean" },
    "thunderBlessingFirstHit": { "type": "boolean" },
    "thunderBlessingSecondHit": { "type": "boolean" },
    "upgradedSymbol": {
      "type": ["string", "null"],
      "enum": ["P1", "P2", "P3", "P4", null],
      "description": "Symbol ID that all Lightning Mark positions were upgraded to on first hit. Null if Thunder Blessing was not triggered. Convenience shortcut — always equals `thunderBlessingResult.convertedSymbol` when `thunderBlessingTriggered = true`. Null when `thunderBlessingTriggered = false`."
    },
    "thunderBlessingResult": {
      "oneOf": [
        { "$ref": "#/definitions/ThunderBlessingResult" },
        { "type": "null" }
      ]
    },
    "coinTossTriggered": { "type": "boolean" },
    "coinTossResult": {
      "type": ["string", "null"],
      "enum": ["HEADS", "TAILS", null]
    },
    "fgTriggered": { "type": "boolean" },
    "fgMultiplier": {
      "type": ["integer", "null"],
      "enum": [3, 7, 17, 27, 77, null],
      "description": "Final FG multiplier reached in the Coin Toss sequence. Null if FG was not triggered."
    },
    "fgRounds": {
      "type": "array",
      "items": { "$ref": "#/definitions/FGRound" },
      "description": "All FG rounds played (up to 5). Empty array if fgTriggered is false."
    },
    "fgBonusMultiplier": {
      "type": ["integer", "null"],
      "enum": [1, 5, 20, 100, null],
      "description": "Bonus multiplier drawn once at end of FG sequence. Null if FG not triggered."
    },
    "totalFGWin": {
      "type": ["number", "null"],
      "description": "Sum of raw round wins across all FG rounds, before applying fgMultiplier and bonusMultiplier. Effective FG win = totalFGWin × fgMultiplier × bonusMultiplier (capped by maxWin). totalWin is the sole accounting authority. Null if FG not triggered."
    },
    "sessionFloorApplied": { "type": "boolean", "description": "True if Buy Feature session floor (≥ 20× baseBet) was applied" },
    "sessionFloorValue": {
      "type": ["number", "null"],
      "description": "Floor value applied (20 × baseBet). Null if not a Buy Feature spin."
    },
    "nearMissApplied": { "type": "boolean" },
    "engineVersion": { "type": "string", "description": "Version of GameConfig.generated.ts used" },
    "timestamp": { "type": "string", "format": "date-time" },
    "rngSeed": { "type": ["string", "null"], "description": "RNG seed for this spin; used for audit replay" }
  },
  "definitions": {
    "CascadeSequence": {
      "type": "object",
      "description": "Complete cascade result. If totalWin > 0, steps array contains at least one entry.",
      "required": ["steps", "totalWin", "finalGrid", "finalRows", "lightningMarks"],
      "properties": {
        "steps": { "type": "array", "items": { "$ref": "#/definitions/CascadeStep" } },
        "totalWin": { "type": "number" },
        "finalGrid": {
          "type": "array",
          "items": { "type": "array", "items": { "type": "string" } }
        },
        "finalRows": { "type": "integer", "enum": [3, 4, 5, 6] },
        "lightningMarks": { "$ref": "#/definitions/LightningMarkSet" }
      }
    },
    "CascadeStep": {
      "type": "object",
      "required": ["index", "grid", "winLines", "stepWin", "newLightningMarks", "rows"],
      "properties": {
        "index": { "type": "integer", "minimum": 0, "description": "0-based cascade step index" },
        "grid": {
          "type": "array",
          "items": { "type": "array", "items": { "type": "string" } },
          "description": "Grid state at the start of this cascade step"
        },
        "winLines": {
          "type": "array",
          "items": { "$ref": "#/definitions/WinLine" }
        },
        "stepWin": { "type": "number", "description": "Total win from all winLines in this cascade step" },
        "newLightningMarks": {
          "type": "array",
          "items": { "$ref": "#/definitions/Position" },
          "description": "Positions that received Lightning Marks in this step (subset of all accumulated marks)"
        },
        "rows": { "type": "integer", "enum": [3, 4, 5, 6], "description": "Row count after this cascade step" }
      }
    },
    "WinLine": {
      "type": "object",
      "required": ["paylineId", "symbolId", "matchCount", "positions", "payout"],
      "properties": {
        "paylineId": { "type": "integer", "minimum": 1, "maximum": 57, "description": "Payline identifier (1–25 at 3 rows; up to 57 at 6 rows)" },
        "symbolId": { "type": "string", "enum": ["W", "SC", "P1", "P2", "P3", "P4", "L1", "L2", "L3", "L4"] },
        "matchCount": { "type": "integer", "minimum": 3, "maximum": 5 },
        "positions": { "type": "array", "items": { "$ref": "#/definitions/Position" } },
        "payout": { "type": "number", "description": "Win amount for this payline in the player's currency" }
      }
    },
    "Position": {
      "type": "object",
      "required": ["row", "col"],
      "properties": {
        "row": { "type": "integer", "minimum": 0, "maximum": 5, "description": "0-indexed row (top = 0)" },
        "col": { "type": "integer", "minimum": 0, "maximum": 4, "description": "0-indexed column (left = 0)" }
      }
    },
    "LightningMarkSet": {
      "type": "object",
      "required": ["positions", "count"],
      "properties": {
        "positions": {
          "type": "array",
          "items": { "$ref": "#/definitions/Position" },
          "description": "All accumulated Lightning Mark positions (across all cascade steps)"
        },
        "count": { "type": "integer", "minimum": 0 }
      }
    },
    "ThunderBlessingResult": {
      "type": "object",
      "required": ["marksConverted", "convertedSymbol", "firstHitApplied", "secondHitApplied"],
      "properties": {
        "marksConverted": {
          "type": "array",
          "items": { "$ref": "#/definitions/Position" },
          "description": "Grid positions where Lightning Marks were converted to the upgraded symbol"
        },
        "convertedSymbol": {
          "type": "string",
          "enum": ["P1", "P2", "P3", "P4"],
          "description": "Symbol all Lightning Mark positions were upgraded to on first hit"
        },
        "firstHitApplied": { "type": "boolean" },
        "secondHitApplied": {
          "type": "boolean",
          "description": "True if the second hit (RNG < tbSecondHit probability of 0.40) was also applied, upgrading symbols one tier higher"
        }
      }
    },
    "FGRound": {
      "type": "object",
      "description": "Represents a single round within an FG sequence. The bonusMultiplier is drawn once at the start of the FG sequence (before round 1) and is identical in all FGRound objects within the same sequence.",
      "required": ["round", "multiplier", "bonusMultiplier", "grid", "cascadeSequence", "roundWin", "coinTossResult", "lightningMarksBefore", "lightningMarksAfter"],
      "properties": {
        "round": { "type": "integer", "minimum": 1, "maximum": 5, "description": "1-indexed FG round number" },
        "multiplier": { "type": "integer", "enum": [3, 7, 17, 27, 77], "description": "FG multiplier for this round" },
        "bonusMultiplier": { "type": "integer", "enum": [1, 5, 20, 100], "description": "Bonus multiplier drawn once at the start of the FG sequence (before round 1). This value is identical in all FGRound objects within the same sequence. Cross-reference: EDD §5.6." },
        "grid": {
          "type": "array",
          "items": { "type": "array", "items": { "type": "string" } },
          "description": "Initial grid for this FG round (5×3 reset per round; Lightning Marks persist)"
        },
        "cascadeSequence": { "$ref": "#/definitions/CascadeSequence" },
        "roundWin": { "type": "number", "description": "Raw win for this FG round before multiplier application (for frontend display)" },
        "coinTossResult": {
          "type": "string",
          "enum": ["HEADS", "TAILS"],
          "description": "Coin Toss result at the end of this FG round. TAILS ends the FG sequence."
        },
        "lightningMarksBefore": { "$ref": "#/definitions/LightningMarkSet" },
        "lightningMarksAfter": { "$ref": "#/definitions/LightningMarkSet" }
      }
    }
  }
}
```

#### Error Responses

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `INSUFFICIENT_FUNDS` | `balance < totalBet` |
| 400 | `INVALID_BET_LEVEL` | `betLevel` out of range for the given `currency` |
| 400 | `INVALID_CURRENCY` | `currency` is not `"USD"` or `"TWD"` |
| 400 | `BUY_FEATURE_NOT_ALLOWED` | `buyFeature: true` at an invalid bet level |
| 400 | `VALIDATION_ERROR` | Missing required field, wrong type, or invalid enum value |
| 401 | `UNAUTHORIZED` | JWT missing, expired, or invalid signature |
| 403 | `FORBIDDEN` | Account suspended |
| 409 | `SPIN_IN_PROGRESS` | Redis concurrency lock already held for this session |
| 422 | `VALIDATION_ERROR` | Semantically invalid payload: `betLevel` out of range for currency, or `extraBet`/`buyFeature` unavailable in this game config. Note: `extraBet: true` + `buyFeature: true` is a **valid** combination (costs 300× baseBet); `INSUFFICIENT_FUNDS` is returned when balance < 300× baseBet for this combination. |
| 429 | `RATE_LIMITED` | More than 5 req/s per player |
| 500 | `INTERNAL_ERROR` | Unexpected server-side error |
| 504 | `ENGINE_TIMEOUT` | Engine took > 2000ms; compensating credit issued automatically |

#### Example — Free Game Triggered Spin

**Request:**

```json
POST /v1/spin
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
  "sessionId": null,
  "betLevel": 10,
  "currency": "USD",
  "extraBet": false,
  "buyFeature": false
}
```

**Response 200 (FG triggered, multiplier ×17, bonusMultiplier ×5):**

```json
{
  "success": true,
  "requestId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "timestamp": "2026-04-26T14:55:12.000Z",
  "data": {
    "spinId": "spin-4c2a8e91-3b7f-4d1c-9a5b-2e6f78901234",
    "sessionId": "sess-b1c2d3e4-f5a6-4b7c-8d9e-0f1234567890",
    "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
    "betLevel": 10,
    "baseBet": 1.00,
    "totalBet": 1.00,
    "totalWin": 255.00,
    "newBalance": 1254.00,
    "currency": "USD",
    "extraBetActive": false,
    "buyFeatureActive": false,
    "initialGrid": [
      ["P1", "L2", "SC", "P3", "L4"],
      ["L1", "P2", "L3", "W", "P4"],
      ["P3", "L4", "P1", "L2", "L1"]
    ],
    "finalGrid": [
      ["L2", "P2", "L3", "P1", "L4"],
      ["P4", "L1", "P3", "L2", "P2"],
      ["L3", "P4", "L1", "P3", "L3"],
      ["P2", "L3", "P4", "L1", "P4"],
      ["L1", "P1", "L2", "P4", "L2"],
      ["P3", "L2", "P1", "L3", "P1"]
    ],
    "finalRows": 6,
    "cascadeSequence": {
      "steps": [
        {
          "index": 0,
          "grid": [["P1","L2","SC","P3","L4"],["L1","P2","L3","W","P4"],["P3","L4","P1","L2","L1"]],
          "winLines": [
            {
              "paylineId": 7,
              "symbolId": "P1",
              "matchCount": 3,
              "positions": [{"row":0,"col":0},{"row":1,"col":1},{"row":2,"col":2}],
              "payout": 3.00
            }
          ],
          "stepWin": 3.00,
          "newLightningMarks": [{"row":0,"col":0},{"row":1,"col":1},{"row":2,"col":2}],
          "rows": 3
        }
      ],
      "totalWin": 3.00,
      "finalGrid": [
        ["L2","P2","L3","P1","L4"],["P4","L1","P3","L2","P2"],
        ["L3","P4","L1","P3","L3"],["P2","L3","P4","L1","P4"],
        ["L1","P1","L2","P4","L2"],["P3","L2","P1","L3","P1"]
      ],
      "finalRows": 6,
      "lightningMarks": {
        "positions": [{"row":0,"col":0},{"row":1,"col":1},{"row":2,"col":2}],
        "count": 3
      }
    },
    "thunderBlessingTriggered": false,
    "thunderBlessingFirstHit": false,
    "thunderBlessingSecondHit": false,
    "upgradedSymbol": null,
    "thunderBlessingResult": null,
    "coinTossTriggered": true,
    "coinTossResult": "HEADS",
    "fgTriggered": true,
    "fgMultiplier": 17,
    "fgRounds": [
      {
        "round": 1,
        "multiplier": 3,
        "bonusMultiplier": 5,
        "grid": [["P2","L1","P4","W","L3"],["L2","P1","L4","P3","L1"],["P4","L3","W","L2","P2"]],
        "cascadeSequence": {
          "steps": [], // steps abbreviated for brevity; actual response contains cascade step details
          "totalWin": 12.00,
          "finalGrid": [["P2","L1","P4","W","L3"],["L2","P1","L4","P3","L1"],["P4","L3","W","L2","P2"]],
          "finalRows": 3,
          "lightningMarks": {"positions":[{"row":0,"col":4},{"row":2,"col":0}],"count":2}
        },
        "roundWin": 12.00,
        "coinTossResult": "HEADS",
        "lightningMarksBefore": {"positions":[{"row":0,"col":0},{"row":1,"col":1},{"row":2,"col":2}],"count":3},
        "lightningMarksAfter": {"positions":[{"row":0,"col":0},{"row":0,"col":4},{"row":1,"col":1},{"row":2,"col":0},{"row":2,"col":2}],"count":5}
      },
      {
        "round": 2,
        "multiplier": 7,
        "bonusMultiplier": 5,
        "grid": [["L4","P2","W","P1","L2"],["P3","L1","P4","L3","P2"],["W","P4","L2","P3","L4"]],
        "cascadeSequence": {
          "steps": [], // steps abbreviated for brevity; actual response contains cascade step details
          "totalWin": 8.00,
          "finalGrid": [["L4","P2","W","P1","L2"],["P3","L1","P4","L3","P2"],["W","P4","L2","P3","L4"]],
          "finalRows": 3,
          "lightningMarks": {"positions":[{"row":1,"col":3}],"count":1}
        },
        "roundWin": 8.00,
        "coinTossResult": "HEADS",
        "lightningMarksBefore": {"positions":[{"row":0,"col":0},{"row":0,"col":4},{"row":1,"col":1},{"row":2,"col":0},{"row":2,"col":2}],"count":5},
        "lightningMarksAfter": {"positions":[{"row":0,"col":0},{"row":0,"col":4},{"row":1,"col":1},{"row":1,"col":3},{"row":2,"col":0},{"row":2,"col":2}],"count":6}
      },
      {
        "round": 3,
        "multiplier": 17,
        "bonusMultiplier": 5,
        "grid": [["P1","W","L3","P2","L1"],["L4","P3","P1","L2","P4"],["P2","L1","L4","P3","W"]],
        "cascadeSequence": {
          "steps": [], // steps abbreviated for brevity; actual response contains cascade step details
          "totalWin": 30.00,
          "finalGrid": [["P1","W","L3","P2","L1"],["L4","P3","P1","L2","P4"],["P2","L1","L4","P3","W"]],
          "finalRows": 3,
          "lightningMarks": {"positions":[],"count":0}
        },
        "roundWin": 30.00,
        "coinTossResult": "TAILS",
        "lightningMarksBefore": {"positions":[{"row":0,"col":0},{"row":0,"col":4},{"row":1,"col":1},{"row":1,"col":3},{"row":2,"col":0},{"row":2,"col":2}],"count":6},
        "lightningMarksAfter": {"positions":[],"count":0}
      }
    ],
    "fgBonusMultiplier": 5,
    "totalFGWin": 50.00,
    "sessionFloorApplied": false,
    "sessionFloorValue": null,
    "nearMissApplied": false,
    "engineVersion": "1.0.0",
    "timestamp": "2026-04-26T14:55:12.000Z"
  }
}
```

_Note: `totalWin = mainCascadeWin + (totalFGWin × fgMultiplier × bonusMultiplier)` = `3.00 + (50.00 × 17 × 5)` = `3.00 + 4250.00`, capped to `255.00` by `enforceMaxWin()` in this example (maxWin cap applied). The exact calculation is `effectiveFGWin = totalFGWin × fgMultiplier × bonusMultiplier`, then `totalWin = mainCascadeWin + min(effectiveFGWin, maxWin × baseBet)`. `outcome.totalWin` is the sole accounting authority._

---

### 3.2 GET /v1/session/:sessionId

**Summary:** Reconnect endpoint. Returns the current in-progress FG session state from Redis. Used when the client disconnects mid-FG sequence and needs to resume. The session expires after 300s of inactivity (TTL auto-renewed on each FG round).

**Authentication required:** Yes — JWT Bearer token. Player may only access their own sessions (403 if `playerId` in session does not match JWT `sub`).

**Rate limit:** Global 5 req/s per player

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <access_token>` |

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string (UUID) | Yes | Session ID previously returned in a `POST /v1/spin` response |

#### Request Example

```
GET /v1/session/sess-9e2b1a34-6f7c-4d2e-b8a1-c5d9e0f12345
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response 200 — Session State

```json
{
  "success": true,
  "requestId": "7ca8b910-9dad-22d2-80b4-00c04fd431a9",
  "timestamp": "2026-04-26T14:56:30.000Z",
  "data": {
    "sessionId": "sess-9e2b1a34-6f7c-4d2e-b8a1-c5d9e0f12345",
    "playerId": "a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234",
    "status": "FG_ACTIVE",
    "baseBet": 1.00,
    "currency": "USD",
    "extraBet": false,
    "buyFeature": false,
    "fgRound": 2,
    "fgMultiplier": 7,
    "fgBonusMultiplier": 5,
    "totalFGWin": 12.00,
    "lightningMarks": {
      "positions": [
        { "row": 0, "col": 0 },
        { "row": 0, "col": 4 },
        { "row": 1, "col": 1 },
        { "row": 2, "col": 0 },
        { "row": 2, "col": 2 }
      ],
      "count": 5
    },
    "floorValue": 0,
    "completedRounds": [
      {
        "round": 1,
        "multiplier": 3,
        "bonusMultiplier": 5,
        "grid": [["P2","L1","P4","W","L3"],["L2","P1","L4","P3","L1"],["P4","L3","W","L2","P2"]],
        "cascadeSequence": {
          "steps": [], // steps abbreviated for brevity; actual response contains cascade step details
          "totalWin": 12.00,
          "finalGrid": [["P2","L1","P4","W","L3"],["L2","P1","L4","P3","L1"],["P4","L3","W","L2","P2"]],
          "finalRows": 3,
          "lightningMarks": {"positions":[{"row":0,"col":4},{"row":2,"col":0}],"count":2}
        },
        "roundWin": 12.00,
        "coinTossResult": "HEADS",
        "lightningMarksBefore": {"positions":[{"row":0,"col":0},{"row":1,"col":1},{"row":2,"col":2}],"count":3},
        "lightningMarksAfter": {"positions":[{"row":0,"col":0},{"row":0,"col":4},{"row":1,"col":1},{"row":2,"col":0},{"row":2,"col":2}],"count":5}
      }
    ],
    "remainingMaxRounds": 4,
    "ttlSeconds": 243
  }
}
```

#### Response 200 JSON Schema — Session State (data object)

```json
{
  "type": "object",
  "required": ["sessionId", "playerId", "status", "baseBet", "currency", "extraBet", "buyFeature", "fgRound", "fgMultiplier", "totalFGWin", "lightningMarks", "floorValue", "completedRounds", "remainingMaxRounds", "ttlSeconds"],
  "properties": {
    "sessionId": { "type": "string", "description": "Session identifier (format: sess-{uuid})" },
    "playerId": { "type": "string", "format": "uuid" },
    "status": { "type": "string", "enum": ["SPINNING", "FG_ACTIVE", "COMPLETE"] },
    "baseBet": { "type": "number" },
    "currency": { "type": "string", "enum": ["USD", "TWD"] },
    "extraBet": { "type": "boolean" },
    "buyFeature": { "type": "boolean" },
    "fgRound": { "type": "integer", "minimum": 0, "maximum": 5, "description": "Current FG round index (0-based; 0 means not yet started)" },
    "fgMultiplier": { "type": ["integer", "null"], "enum": [3, 7, 17, 27, 77, null], "description": "Current FG multiplier; null when no active FG sequence" },
    "fgBonusMultiplier": { "type": ["integer", "null"], "enum": [1, 5, 20, 100, null], "description": "Bonus multiplier drawn at FG sequence start. Null if no FG sequence is active or bonus multiplier has not yet been determined." },
    "totalFGWin": { "type": "number" },
    "lightningMarks": { "$ref": "#/definitions/LightningMarkSet" },
    "floorValue": { "type": "number", "description": "20 × baseBet if buyFeature; 0 otherwise" },
    "completedRounds": { "type": "array", "items": { "$ref": "#/definitions/FGRound" } },
    "remainingMaxRounds": { "type": "integer", "minimum": 0, "maximum": 5 },
    "ttlSeconds": { "type": "integer", "description": "Seconds remaining before this Redis session key expires" }
  }
}
```

#### Error Responses

| HTTP Status | Code | When |
|-------------|------|------|
| 401 | `UNAUTHORIZED` | JWT missing or expired |
| 403 | `FORBIDDEN` | JWT is valid but `playerId` in session does not match JWT `sub` |
| 404 | `SESSION_NOT_FOUND` | Session ID does not exist in Redis (TTL expired or never created) |

---

### 3.3 GET /v1/config

**Summary:** Returns the game configuration needed by the frontend: bet level table (USD and TWD), game parameters summary, and RTP targets per scenario. Used at game startup to initialize the bet selector UI.

**Authentication required:** Yes — JWT Bearer token (any valid role: `player`, `operator`, `service_role`)

**Rate limit:** Global 5 req/s per player

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <access_token>` |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `currency` | string | No | Returns both | Filter to `USD` or `TWD` bet levels only |

#### Request Example

```
GET /v1/config
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response 200 — Game Config

```json
{
  "success": true,
  "requestId": "8db9ca20-bcde-33e3-91c5-11d15fe542b0",
  "timestamp": "2026-04-26T14:00:00.000Z",
  "data": {
    "engineVersion": "1.0.0",
    "betRange": {
      "USD": {
        "minBetLevel": 1,
        "maxBetLevel": 20,
        "levels": [
          { "level": 1,  "baseBet": 0.10, "extraBetCost": 0.30, "buyFeatureCost": 10.00 },
          { "level": 2,  "baseBet": 0.20, "extraBetCost": 0.60, "buyFeatureCost": 20.00 },
          { "level": 3,  "baseBet": 0.25, "extraBetCost": 0.75, "buyFeatureCost": 25.00 },
          { "level": 4,  "baseBet": 0.30, "extraBetCost": 0.90, "buyFeatureCost": 30.00 },
          { "level": 5,  "baseBet": 0.50, "extraBetCost": 1.50, "buyFeatureCost": 50.00 },
          { "level": 6,  "baseBet": 0.75, "extraBetCost": 2.25, "buyFeatureCost": 75.00 },
          { "level": 7,  "baseBet": 1.00, "extraBetCost": 3.00, "buyFeatureCost": 100.00 },
          { "level": 8,  "baseBet": 1.25, "extraBetCost": 3.75, "buyFeatureCost": 125.00 },
          { "level": 9,  "baseBet": 1.50, "extraBetCost": 4.50, "buyFeatureCost": 150.00 },
          { "level": 10, "baseBet": 2.00, "extraBetCost": 6.00, "buyFeatureCost": 200.00 },
          { "level": 11, "baseBet": 2.50, "extraBetCost": 7.50, "buyFeatureCost": 250.00 },
          { "level": 12, "baseBet": 3.00, "extraBetCost": 9.00, "buyFeatureCost": 300.00 },
          { "level": 13, "baseBet": 3.50, "extraBetCost": 10.50, "buyFeatureCost": 350.00 },
          { "level": 14, "baseBet": 4.00, "extraBetCost": 12.00, "buyFeatureCost": 400.00 },
          { "level": 15, "baseBet": 5.00, "extraBetCost": 15.00, "buyFeatureCost": 500.00 },
          { "level": 16, "baseBet": 6.00, "extraBetCost": 18.00, "buyFeatureCost": 600.00 },
          { "level": 17, "baseBet": 7.00, "extraBetCost": 21.00, "buyFeatureCost": 700.00 },
          { "level": 18, "baseBet": 8.00, "extraBetCost": 24.00, "buyFeatureCost": 800.00 },
          { "level": 19, "baseBet": 9.00, "extraBetCost": 27.00, "buyFeatureCost": 900.00 },
          { "level": 20, "baseBet": 10.00, "extraBetCost": 30.00, "buyFeatureCost": 1000.00 }
        ]
      },
      "TWD": {
        "minBetLevel": 1,
        "maxBetLevel": 320,
        "levels": [
          { "level": 1,   "baseBet": 3,   "extraBetCost": 9,    "buyFeatureCost": 300   },
          { "level": 5,   "baseBet": 15,  "extraBetCost": 45,   "buyFeatureCost": 1500  },
          { "level": 10,  "baseBet": 30,  "extraBetCost": 90,   "buyFeatureCost": 3000  },
          { "level": 20,  "baseBet": 60,  "extraBetCost": 180,  "buyFeatureCost": 6000  },
          { "level": 50,  "baseBet": 150, "extraBetCost": 450,  "buyFeatureCost": 15000 },
          { "level": 100, "baseBet": 300, "extraBetCost": 900,  "buyFeatureCost": 30000 },
          { "level": 200, "baseBet": 600, "extraBetCost": 1800, "buyFeatureCost": 60000 },
          { "level": 320, "baseBet": 600, "extraBetCost": 1800, "buyFeatureCost": 60000 }
        ],
        "note": "Full TWD level table (1–320) is served; only representative levels shown here for brevity. betLevels 200–320 share baseBet cap of 600 TWD per game design (capped tier)."
      }
    },
    "gameParameters": {
      "reels": 5,
      "initialRows": 3,
      "maxRows": 6,
      "paylines": {
        "at3Rows": 25,
        "at4Rows": 33,
        "at5Rows": 45,
        "at6Rows": 57
      },
      "symbols": [
        { "id": "W",  "name": "Wild (Divine Lightning)", "isWild": true,  "isScatter": false },
        { "id": "SC", "name": "Thunder Blessing Scatter", "isWild": false, "isScatter": true  },
        { "id": "P1", "name": "Zeus",    "isWild": false, "isScatter": false, "tier": "premium" },
        { "id": "P2", "name": "Pegasus", "isWild": false, "isScatter": false, "tier": "premium" },
        { "id": "P3", "name": "Athena",  "isWild": false, "isScatter": false, "tier": "premium" },
        { "id": "P4", "name": "Eagle",   "isWild": false, "isScatter": false, "tier": "premium" },
        { "id": "L1", "name": "Z",       "isWild": false, "isScatter": false, "tier": "low" },
        { "id": "L2", "name": "E",       "isWild": false, "isScatter": false, "tier": "low" },
        { "id": "L3", "name": "U",       "isWild": false, "isScatter": false, "tier": "low" },
        { "id": "L4", "name": "S",       "isWild": false, "isScatter": false, "tier": "low" }
      ],
      "fgMultiplierSequence": [3, 7, 17, 27, 77],
      "fgBonusMultipliers": [1, 5, 20, 100],
      "coinTossProbabilities": {
        "stage0_entry": 0.80,
        "stage1_x7":    0.68,
        "stage2_x17":   0.56,
        "stage3_x27":   0.48,
        "stage4_x77":   0.40
      },
      "maxWin": {
        "mainGame":   30000,
        "extraBetBuyFeature": 90000,
        "unit": "× baseBet"
        // extraBetBuyFeature: Maximum win cap when both Extra Bet and Buy Feature are active simultaneously.
      },
      "buyFeatureSessionFloor": 20,
      "extraBetCostMultiplier": 3,
      "buyFeatureCostMultiplier": 100
    },
    "rtpTargets": {
      "mainGame":    { "target": 97.5, "tolerance": 1.0, "unit": "%" },
      "extraBet":    { "target": 97.5, "tolerance": 1.0, "unit": "%" },
      "buyFeature":  { "target": 97.5, "tolerance": 1.0, "unit": "%" },
      "ebBuyFeature":{ "target": 97.5, "tolerance": 1.0, "unit": "%" }
    }
  }
}
```

#### Error Responses

| HTTP Status | Code | When |
|-------------|------|------|
| 401 | `UNAUTHORIZED` | JWT missing or expired |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### 3.4 GET /health

**Summary:** Kubernetes liveness probe. Returns immediately without checking dependencies. If the process is up and the event loop is running, this returns 200.

**Authentication required:** No

**Rate limit:** Not rate-limited (Kubernetes internal traffic)

#### Request Example

```
GET /health
```

#### Response 200

```json
{
  "status": "ok",
  "timestamp": "2026-04-26T14:00:00.000Z"
}
```

#### Response JSON Schema

```json
{
  "type": "object",
  "required": ["status", "timestamp"],
  "properties": {
    "status": { "type": "string", "enum": ["ok"] },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```

---

### 3.5 GET /ready

**Summary:** Kubernetes readiness probe. Checks live connectivity to Supabase PostgreSQL and Redis before marking the pod as ready to receive traffic. A pod that fails readiness is removed from the load balancer rotation.

**Authentication required:** No

**Rate limit:** Not rate-limited

#### Request Example

```
GET /ready
```

#### Response 200 — All dependencies healthy

```json
{
  "status": "ready",
  "timestamp": "2026-04-26T14:00:00.000Z",
  "checks": {
    "db": "ok",
    "redis": "ok"
  }
}
```

#### Response 503 — One or more dependencies unhealthy

```json
{
  "status": "not_ready",
  "timestamp": "2026-04-26T14:00:05.123Z",
  "checks": {
    "db": "fail",
    "redis": "ok"
  }
}
```

#### Response JSON Schema

```json
{
  "type": "object",
  "required": ["status", "timestamp", "checks"],
  "properties": {
    "status": { "type": "string", "enum": ["ready", "not_ready"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "checks": {
      "type": "object",
      "required": ["db", "redis"],
      "properties": {
        "db":    { "type": "string", "enum": ["ok", "fail"] },
        "redis": { "type": "string", "enum": ["ok", "fail"] }
      }
    }
  }
}
```

HTTP status is 200 when `status = "ready"`, 503 when `status = "not_ready"`.

---

## §4 Data Types (Shared Schemas)

### 4.1 SymbolId Enumeration

Thunder Blessing uses 10 distinct symbol identifiers (2 special + 4 premium + 4 low):

```typescript
type SymbolId =
  | "W"   // Wild (Divine Lightning / Golden Thunderbolt) — substitutes all except SC
  | "SC"  // Thunder Blessing Scatter — triggers Thunder Blessing when marks present
  | "P1"  // Zeus — highest premium symbol
  | "P2"  // Pegasus
  | "P3"  // Athena
  | "P4"  // Eagle — lowest premium symbol; upgrade target for L-symbols
  | "L1"  // Z (low symbol)
  | "L2"  // E (low symbol)
  | "L3"  // U (low symbol)
  | "L4"; // S (low symbol)
```

**Thunder Blessing Upgrade Path (first hit):** All Lightning Mark positions are replaced with a single randomly selected symbol from `{P1, P2, P3, P4}`.

**Thunder Blessing Upgrade Path (second hit, probability 0.40):** Each upgraded symbol rises one tier:
- `L1/L2/L3/L4` → `P4`
- `P4` → `P3`
- `P3` → `P2`
- `P2` → `P1`
- `P1` → `P1` (ceiling; no change)

### 4.2 Grid

```typescript
interface Grid {
  cells: SymbolId[][];  // [row][col], row 0 = top row, col 0 = leftmost reel
  rows: number;         // 3 | 4 | 5 | 6
  cols: number;         // always 5
}
```

In the JSON API, `Grid` is serialized as a 2D string array (`string[][]`). The outer array has `rows` elements; each inner array has exactly 5 elements (one per reel).

**Grid index convention:**
- `grid[0][0]` = top-left cell (row 0, reel 1)
- `grid[rows-1][4]` = bottom-right cell

### 4.3 Position

```typescript
interface Position {
  row: number;  // 0-indexed; 0 = top row
  col: number;  // 0-indexed; 0 = leftmost reel
}
```

### 4.4 WinLine

```typescript
interface WinLine {
  paylineId: number;    // 1–57; paylines 1–25 active at 3 rows; up to 57 at 6 rows
  symbolId: SymbolId;   // winning symbol (Wild is normalized to the matched symbol)
  matchCount: number;   // 3 | 4 | 5
  positions: Position[]; // grid positions contributing to this win
  payout: number;       // win amount in player currency (baseBet × payline multiplier × matchCount multiplier)
}
```

### 4.5 CascadeStep

```typescript
interface CascadeStep {
  index: number;                 // 0-based; first step = 0
  grid: SymbolId[][];            // grid state at start of this step (before elimination)
  winLines: WinLine[];           // all winning paylines detected in this step
  stepWin: number;               // sum of all winLine payouts in this step
  newLightningMarks: Position[]; // positions newly marked in this step (additive; not total)
  rows: number;                  // 3 | 4 | 5 | 6 — row count after expansion in this step
}
```

### 4.6 CascadeSequence

```typescript
interface CascadeSequence {
  steps: CascadeStep[];         // all cascade steps, 0-indexed; empty if no wins
  totalWin: number;             // sum of all stepWin values across all steps
  finalGrid: SymbolId[][];      // grid state after all cascade steps complete
  finalRows: number;            // 3 | 4 | 5 | 6
  lightningMarks: LightningMarkSet; // all accumulated marks (union across all steps)
}
```

### 4.7 LightningMarkSet

```typescript
interface LightningMarkSet {
  positions: Position[]; // all unique grid positions that have received Lightning Marks
  count: number;         // positions.length (provided for convenience)
}
```

**Lifecycle:**
- **Main Game:** Cleared at the start of each new spin.
- **Free Game:** Accumulated across all FG rounds within the same FG sequence; cleared when FG sequence ends.

### 4.8 ThunderBlessingResult

```typescript
interface ThunderBlessingResult {
  marksConverted: Position[];   // all positions where Lightning Marks were converted
  convertedSymbol: SymbolId;    // P1 | P2 | P3 | P4 — symbol chosen for first hit
  firstHitApplied: boolean;     // always true when ThunderBlessingResult is non-null
  secondHitApplied: boolean;    // true if RNG < 0.40 (tbSecondHit probability)
}
```

Thunder Blessing is triggered when:
1. A new symbol that is `SC` falls into the grid during Cascade
2. `lightningMarks.count > 0`

If neither condition is met, `thunderBlessingTriggered = false` and `thunderBlessingResult = null`.

### 4.9 FGRound

```typescript
interface FGRound {
  round: number;                      // 1–5 (1-indexed; max 5 rounds = 5 consecutive Heads)
  multiplier: number;                 // 3 | 7 | 17 | 27 | 77 — multiplier for this round
  bonusMultiplier: number;            // 1 | 5 | 20 | 100 — drawn once, same across all rounds
  grid: SymbolId[][];                 // initial 5×3 grid for this FG round
  cascadeSequence: CascadeSequence;   // full cascade result for this FG round
  roundWin: number;                   // raw win (before multiplier); for frontend running total
  coinTossResult: "HEADS" | "TAILS"; // HEADS = advance to next multiplier; TAILS = FG ends
  lightningMarksBefore: LightningMarkSet; // accumulated marks entering this round
  lightningMarksAfter: LightningMarkSet;  // accumulated marks after this round completes
}
```

**FG Win Calculation:**
```
totalFGWin = sum(round.roundWin for all rounds)
effectiveFGWin = totalFGWin × fgMultiplier × bonusMultiplier
totalWin = mainCascadeWin + effectiveFGWin  (capped by maxWin)
```

### 4.10 BetLevel

```typescript
interface BetLevel {
  level: number;          // 1–20 (USD) | 1–320 (TWD)
  baseBet: number;        // USD: 0.10–10.00 | TWD: 3–600
  extraBetCost: number;   // baseBet × 3
  buyFeatureCost: number; // baseBet × 100
}
```

**USD Bet Level Summary:**

| Level | baseBet |
|-------|---------|
| 1 | $0.10 |
| 5 | $0.50 |
| 10 | $1.00 |
| 15 | $1.50 |
| 20 | $2.00 |

_Full table of 20 levels served by `GET /v1/config`._

**TWD Bet Level Constraints:**
- `betLevel` max for TWD = 320 (not 20 — TWD uses a higher-resolution bet scale)
- TWD `baseBet` range: 3 TWD (level 1) to 600 TWD (max level)

### 4.11 SessionStateDTO

```typescript
interface SessionStateDTO {
  sessionId: string;              // UUID
  playerId: string;               // UUID; must match JWT sub
  status: "SPINNING" | "FG_ACTIVE" | "COMPLETE";
  baseBet: number;
  currency: "USD" | "TWD";
  extraBet: boolean;
  buyFeature: boolean;
  fgRound: number;                // 0-based; current FG round index
  fgMultiplier: number;           // 3 | 7 | 17 | 27 | 77
  totalFGWin: number;
  lightningMarks: LightningMarkSet;
  floorValue: number;             // 20 × baseBet if buyFeature; 0 otherwise
  completedRounds: FGRound[];     // FG rounds already resolved
  remainingMaxRounds: number;     // max rounds still possible
  ttlSeconds: number;             // seconds until Redis key expires
}
```

---

## §5 Rate Limiting & Throttling

### 5.1 Rate Limit Headers

Every response from `/v1/*` includes the following headers:

| Header | Type | Description |
|--------|------|-------------|
| `X-RateLimit-Limit` | integer | Maximum requests allowed per window (5) |
| `X-RateLimit-Remaining` | integer | Requests remaining in the current window |
| `X-RateLimit-Reset` | integer | Unix timestamp (seconds) when the window resets |
| `X-Request-Id` | string (UUID) | Unique identifier for this request (for log correlation) |

### 5.2 HTTP 429 Response

When a player exceeds 5 requests/second, the server returns:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 1
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1745713261
```

```json
{
  "success": false,
  "code": "RATE_LIMITED",
  "message": "Too many requests. Maximum 5 requests per second per player.",
  "requestId": "9ec0db30-cdef-44f4-a2d7-22e26ff653c1",
  "timestamp": "2026-04-26T14:01:00.000Z",
  "retryAfter": 1
}
```

### 5.3 Retry-After

- `Retry-After` header value is always `1` second for game spin endpoints (matches the sliding window size)
- Clients should implement exponential backoff if they receive multiple consecutive 429 responses
- The Supabase Auth endpoint has a separate rate limit (not managed by this API)

### 5.4 Circuit Breaker 503 Response

When the circuit breaker is OPEN (PostgreSQL or Redis unavailable), spins are rejected before any wallet debit:

```
HTTP/1.1 503 Service Unavailable
Retry-After: 30
```

```json
{
  "success": false,
  "code": "SERVICE_UNAVAILABLE",
  "message": "Service temporarily unavailable. Please try again in 30 seconds.",
  "requestId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f23456789",
  "timestamp": "2026-04-26T14:02:00.000Z",
  "retryAfter": 30
}
```

---

## §6 WebSocket API

**No WebSocket API.** Per ADR-003 (ARCH.md §1.2 / EDD.md §3.2), the game uses a **single-trip REST design**. One `POST /v1/spin` returns the complete `FullSpinOutcome` including all FG rounds, Cascade steps, and the final `totalWin`. The frontend plays back the animation sequence locally using the returned data, requiring no persistent connection.

**Rationale (ADR-003):**
- Eliminates client-server round trips during FG
- Simplifies state management (no partial state to synchronize)
- Reduces reconnect risk during animations
- Frontend animations are driven entirely by the locally stored `FullSpinOutcome`

**Reconnect scenario:** If the client disconnects after a spin completes but before the animation finishes, `GET /v1/session/:sessionId` provides the full FG sequence data for playback resumption.

---

## §7 Versioning & Backward Compatibility

### 7.1 Current Version

API version `v1` — path prefix `/v1`.

### 7.2 Backward-Compatible Changes (no version bump)

The following changes are safe and do not require a version increment:

- **Adding new optional fields** to response bodies (existing clients ignore unknown fields)
- **Adding new enum values** (clients should handle unknown enum values gracefully)
- **Adding new endpoints** under `/v1/`
- **Expanding rate limits** (increasing from 5 to 10 req/s)

### 7.3 Breaking Changes (require /v2/)

The following changes require a new API version:

- Removing or renaming existing response fields
- Changing field types (e.g., `number` → `string`)
- Changing semantic meaning of existing fields
- Changing HTTP method for an endpoint
- Removing an endpoint

### 7.4 Deprecation Policy

1. Breaking changes are introduced under `/v2/` — `/v1/` continues to work.
2. Deprecated endpoints return a `Deprecation: true` and `Sunset: <date>` response header.
3. `/v1/` remains supported for a minimum of **12 months** after the `/v2/` GA release.
4. Operators are notified via the B2B developer channel at least 6 months before sunset.

### 7.5 Versioning for New Fields

When adding optional fields to `FullSpinOutcome` in a minor update:
- New fields default to `null` or `false` when not applicable
- The `engineVersion` field in every response identifies the exact config generation in use
- Clients should treat unknown fields as informational (not fatal)

---

## §8 Security Considerations

### 8.1 JWT Claims and Verification

The backend verifies the following claims on every `/v1/*` request:

| Claim | Verification | Failure |
|-------|-------------|---------|
| Signature (RS256) | Validated against Supabase public key | 401 UNAUTHORIZED |
| `exp` | Must be in the future | 401 UNAUTHORIZED |
| `sub` | Must be a valid UUID; used as `playerId` | 401 UNAUTHORIZED |
| `role` | Must be `player`, `operator`, or `service_role` | 403 FORBIDDEN |
| `playerId` match | JWT `sub` must match `playerId` in request body | 403 FORBIDDEN |

### 8.2 Expired Token Handling

- The server returns `401 UNAUTHORIZED` with `code: "UNAUTHORIZED"` immediately on expired tokens.
- No partial state is created — the spin is rejected before any lock acquisition or wallet debit.
- The client must refresh the token using the Supabase Auth refresh token flow and retry the spin.

### 8.3 CORS Allowed Origins

```
Production:  https://*.yourdomain.com (configured via CORS_ALLOWED_ORIGINS env var)
Staging:     https://*.staging.yourdomain.com
Development: * (all origins permitted)
```

The `Access-Control-Allow-Origin` header is set per-request based on the `Origin` header match against the allowlist.

### 8.4 HTTPS Enforcement

- TLS 1.3 is enforced at the Kubernetes Ingress (nginx-ingress).
- The following security headers are set on all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 8.5 Session Ownership Enforcement

`GET /v1/session/:sessionId` verifies that the `playerId` stored in Redis for the session matches the JWT `sub`. Mismatches return `403 FORBIDDEN` with `code: "FORBIDDEN"`. Players cannot access or resume another player's session.

### 8.6 Wallet Safety Invariants

- The wallet is debited **before** the engine runs. If the engine times out (504), a compensating credit equal to the debited amount is issued automatically.
- `outcome.totalWin` is the sole authority for wallet credit — the frontend totalWin display is for animation only and does not affect accounting.
- Redis optimistic lock (`SET NX EX 10`) prevents double-debiting from concurrent requests.

### 8.7 Input Sanitization

All request body fields are validated against the Fastify/JSON Schema before reaching any use case:

- `playerId`: UUID format enforced
- `betLevel`: integer, range-checked per currency
- `currency`: strict enum (`"USD"` | `"TWD"`)
- `extraBet` / `buyFeature`: boolean type enforced
- No raw SQL is constructed from user input — all DB queries use parameterized statements via the Supabase JS Client

---

## §9 SDK / Integration Notes

### 9.1 Frontend Integration Checklist (Cocos Creator / PixiJS)

**At game startup:**
1. Authenticate via Supabase Auth SDK → obtain `access_token` + `refresh_token`
2. Call `GET /v1/config` → initialize bet selector UI with bet levels and symbols
3. Store `access_token`; register `onAuthStateChange` listener to handle `TOKEN_REFRESHED` events

**On Spin button press:**
1. Disable Spin button immediately (prevent double-tap / double-click)
2. Read current `betLevel`, `currency`, `extraBet`, `buyFeature` from UI state
3. Call `POST /v1/spin` with current JWT token
4. On 200: store `FullSpinOutcome`; begin animation sequence
5. Re-enable Spin button only after full animation playback completes
6. On 409 `SPIN_IN_PROGRESS`: show "Please wait" — do not retry automatically
7. On 401 `UNAUTHORIZED`: refresh token → retry once → if still 401, show login screen
8. On 429 `RATE_LIMITED`: wait `retryAfter` seconds → retry once
9. On 504 `ENGINE_TIMEOUT`: show "Connection issue" — do NOT retry (compensating credit is already issued server-side)

**Animation playback from FullSpinOutcome:**
1. Play initial grid → `initialGrid`
2. For each `cascadeSequence.steps[i]`:
   a. Highlight `winLines[j].positions` for each winning line
   b. Animate Lightning Marks appearing at `newLightningMarks` positions
   c. Eliminate winning symbols; apply gravity; expand rows to `step.rows`
3. If `thunderBlessingTriggered`:
   a. Play SC trigger animation
   b. Apply first hit: replace all mark positions with `upgradedSymbol`
   c. If `thunderBlessingSecondHit`: play second hit animation; upgrade all marks one tier
   d. Re-evaluate paylines from updated grid
4. If `coinTossTriggered`: play Coin Toss animation with `coinTossResult`
5. If `fgTriggered`:
   a. Show FG multiplier reveal (`fgMultiplier`)
   b. For each `fgRounds[i]`: play FG round spin + Cascade sequence
   c. After last round: show Bonus Multiplier reveal (`fgBonusMultiplier`)
6. Display `totalWin` as the final win amount

**Reconnect flow (player returns after disconnect):**
1. On app resume: call `GET /v1/session/:sessionId` with the last known `sessionId`
2. If 200 `FG_ACTIVE`: replay `completedRounds` animations; resume from `fgRound` index
3. If 404 `SESSION_NOT_FOUND`: session has expired or completed — show final state from locally cached `FullSpinOutcome` if available

### 9.2 Request ID Tracing

The client may set `X-Request-Id` header with a client-generated UUID on each request. The server echoes this value in the response `X-Request-Id` header and includes it in structured logs. This enables end-to-end tracing from the client's perspective.

```
POST /v1/spin
X-Request-Id: my-client-generated-uuid-here
```

### 9.3 Currency Display

- All monetary amounts in API responses are in the player's selected `currency` (USD or TWD)
- USD: display as `$0.00` format (2 decimal places)
- TWD: display as `NT$0` format (whole numbers; TWD amounts are integers in the bet table)
- The `CurrencyFormatter` service on the backend uses `BetRangeConfig.generated.ts` as the source of truth for all bet amounts

### 9.4 Error Handling Guidance

| Code | Frontend Action |
|------|----------------|
| `INSUFFICIENT_FUNDS` | Show balance warning; update balance display; do NOT retry |
| `INVALID_BET_LEVEL` | Clamp bet selector to valid range; should not occur if UI is initialized from `/v1/config` |
| `UNAUTHORIZED` | Refresh token; retry once; show login if still unauthorized |
| `SPIN_IN_PROGRESS` | Show "spin in progress" UI state; poll `/v1/session/:sessionId` to check completion |
| `RATE_LIMITED` | Wait `retryAfter` seconds; do not retry faster |
| `ENGINE_TIMEOUT` | Show error; do NOT retry — compensating credit already issued |
| `INTERNAL_ERROR` | Show generic error message; log `requestId` for support |

### 9.5 Bet Level Constraints Summary

| Currency | Min Level | Max Level | Min baseBet | Max baseBet |
|----------|-----------|-----------|-------------|-------------|
| USD | 1 | 20 | $0.10 | $10.00 |
| TWD | 1 | 320 | TWD 3 | TWD 600 |

The frontend bet selector must enforce these ranges. Requests with `betLevel` outside the currency-specific range will receive `400 INVALID_BET_LEVEL`.
