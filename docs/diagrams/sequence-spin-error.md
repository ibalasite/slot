---
diagram: sequence-spin-error
uml-type: sequence
source: EDD.md §6.3 Error Codes, §5.1; ARCH.md §5.1, §6 Partial Failure Compensation
generated: 2026-04-26T00:00:00Z
---

# Sequence Diagram — POST /v1/spin Error Paths

> 來源：EDD.md §6.3 Error Codes; ARCH.md §5.1 Sync/Async Communication Matrix, §6 Partial Failure Compensation

```mermaid
sequenceDiagram
    autonumber

    participant Client as Client (Frontend)
    participant Fastify as Fastify Router
    participant JwtAuthGuard as JwtAuthGuard
    participant SpinUseCase as SpinUseCase
    participant LockGuard as ConcurrencyLockGuard
    participant Redis as UpstashCacheAdapter (Redis)
    participant WalletRepo as SupabaseWalletRepository
    participant SlotEngine as SlotEngine
    participant ErrorMapper as DomainErrorMapper
    participant AuditLog as AuditLogger

    Note over Client,AuditLog: ─── Error Path 1: 401 Invalid JWT ───

    Client->>Fastify: POST /v1/spin {Authorization: Bearer <expired_token>}
    Fastify->>JwtAuthGuard: verify(token: "eyJhbGci...expired")
    JwtAuthGuard->>JwtAuthGuard: SupabaseAuth.verifyJWT → throws UnauthorizedError("Invalid or expired JWT")
    JwtAuthGuard-->>Fastify: UnauthorizedError
    Fastify->>ErrorMapper: map(UnauthorizedError)
    ErrorMapper-->>Fastify: {httpStatus: 401, code: "UNAUTHORIZED"}
    Fastify-->>Client: 401 {success:false, code:"UNAUTHORIZED", message:"Missing or invalid JWT", requestId:"req-err-001", timestamp:"2026-04-26T..."}

    Note over Client,AuditLog: ─── Error Path 2: 409 Concurrent Spin (lock already held) ───

    Client->>Fastify: POST /v1/spin {Authorization: Bearer <valid_token>, sessionId: "sess-active-999"}
    Fastify->>JwtAuthGuard: verify(token)
    JwtAuthGuard-->>Fastify: PlayerClaims {playerId: "player-xyz"}
    Fastify->>SpinUseCase: execute(SpinRequest {sessionId: "sess-active-999"})
    SpinUseCase->>LockGuard: acquire(sessionId: "sess-active-999")
    LockGuard->>Redis: SET session:sess-active-999:lock {lockToken} NX EX 10
    Redis-->>LockGuard: nil (lock already held by concurrent request)
    LockGuard-->>SpinUseCase: throws SpinInProgressError("Concurrent spin detected")
    SpinUseCase->>ErrorMapper: map(SpinInProgressError)
    ErrorMapper-->>SpinUseCase: {httpStatus: 409, code: "SPIN_IN_PROGRESS"}
    SpinUseCase-->>Fastify: 409 error
    Fastify-->>Client: 409 {success:false, code:"SPIN_IN_PROGRESS", message:"A spin is already in progress for this session. Retry after current spin completes.", requestId:"req-err-002"}

    Note over Client,AuditLog: ─── Error Path 3: 400 Insufficient Balance ───

    Client->>Fastify: POST /v1/spin {Authorization: Bearer <valid_token>, betLevel: 1000, currency: "USD"}
    Fastify->>JwtAuthGuard: verify(token)
    JwtAuthGuard-->>Fastify: PlayerClaims {playerId: "player-broke"}
    Fastify->>SpinUseCase: execute(SpinRequest {betLevel: 1000, cost: 10.00})
    SpinUseCase->>LockGuard: acquire(sessionId: "sess-broke-001")
    LockGuard->>Redis: SET session:sess-broke-001:lock NX EX 10
    Redis-->>LockGuard: OK
    LockGuard-->>SpinUseCase: lockToken = "lock-broke-001"

    SpinUseCase->>WalletRepo: getBalance("player-broke", "USD")
    WalletRepo-->>SpinUseCase: balance = 2.50
    Note over SpinUseCase: Validate: 2.50 < cost(10.00) → InsufficientFundsError

    SpinUseCase->>LockGuard: release("sess-broke-001", "lock-broke-001")
    LockGuard->>Redis: DEL session:sess-broke-001:lock
    SpinUseCase->>ErrorMapper: map(InsufficientFundsError)
    ErrorMapper-->>SpinUseCase: {httpStatus: 400, code: "INSUFFICIENT_FUNDS"}
    SpinUseCase-->>Fastify: 400 error
    Fastify-->>Client: 400 {success:false, code:"INSUFFICIENT_FUNDS", message:"Balance 2.50 USD is less than spin cost 10.00 USD", requestId:"req-err-003"}

    Note over Client,AuditLog: ─── Error Path 4: 400 Invalid Bet Level ───

    Client->>Fastify: POST /v1/spin {Authorization: Bearer <valid_token>, betLevel: 9999, currency: "TWD"}
    Fastify->>JwtAuthGuard: verify(token)
    JwtAuthGuard-->>Fastify: PlayerClaims {playerId: "player-abc"}
    Fastify->>SpinUseCase: execute(SpinRequest {betLevel: 9999, currency: "TWD"})

    Note over SpinUseCase: betLevel 9999 exceeds TWD max=320 per BetRangeConfig → InvalidBetLevelError (no lock acquired)
    SpinUseCase->>ErrorMapper: map(InvalidBetLevelError)
    ErrorMapper-->>SpinUseCase: {httpStatus: 400, code: "INVALID_BET_LEVEL"}
    SpinUseCase-->>Fastify: 400 error
    Fastify-->>Client: 400 {success:false, code:"INVALID_BET_LEVEL", message:"betLevel 9999 exceeds TWD maximum of 320", requestId:"req-err-004"}

    Note over Client,AuditLog: ─── Error Path 5: 504 Engine Timeout + Compensating Credit ───

    Client->>Fastify: POST /v1/spin {Authorization: Bearer <valid_token>, betLevel: 50}
    Fastify->>JwtAuthGuard: verify(token)
    JwtAuthGuard-->>Fastify: PlayerClaims {playerId: "player-timeout"}
    Fastify->>SpinUseCase: execute(SpinRequest {betLevel: 50, cost: 0.50})

    SpinUseCase->>LockGuard: acquire("sess-timeout-001")
    LockGuard->>Redis: SET session:sess-timeout-001:lock NX EX 10
    Redis-->>LockGuard: OK
    LockGuard-->>SpinUseCase: lockToken = "lock-timeout-001"

    SpinUseCase->>WalletRepo: getBalance("player-timeout", "USD")
    WalletRepo-->>SpinUseCase: 100.00

    SpinUseCase->>WalletRepo: debit("player-timeout", 0.50, "USD")
    WalletRepo->>WalletRepo: UPDATE wallets SET balance=99.50; INSERT DEBIT transaction
    WalletRepo-->>SpinUseCase: OK — WALLET IS NOW DEBITED

    SpinUseCase->>SlotEngine: spin(SpinRequest) — timeout timer starts (2000ms)
    Note over SlotEngine: Engine hangs > 2000ms (complex cascade / RNG contention)
    SlotEngine-->>SpinUseCase: EngineTimeoutError after 2000ms

    Note over SpinUseCase: COMPENSATING CREDIT — wallet was debited before engine
    SpinUseCase->>WalletRepo: credit("player-timeout", 0.50, "USD") — compensate
    WalletRepo->>WalletRepo: UPDATE wallets SET balance=100.00; INSERT CREDIT transaction (type=COMPENSATION)
    WalletRepo-->>SpinUseCase: OK

    SpinUseCase->>AuditLog: emit EngineTimeout {sessionId, playerId, compensationAmount: 0.50}
    AuditLog->>AuditLog: INSERT spin_logs {outcome_jsonb: {error:"ENGINE_TIMEOUT", compensated:true}, total_win: 0}

    SpinUseCase->>LockGuard: release("sess-timeout-001", "lock-timeout-001")
    LockGuard->>Redis: DEL session:sess-timeout-001:lock

    SpinUseCase->>ErrorMapper: map(EngineTimeoutError)
    ErrorMapper-->>SpinUseCase: {httpStatus: 504, code: "ENGINE_TIMEOUT"}
    SpinUseCase-->>Fastify: 504 error
    Fastify-->>Client: 504 {success:false, code:"ENGINE_TIMEOUT", message:"Spin timed out. Your balance has been restored.", requestId:"req-err-005"}
```
