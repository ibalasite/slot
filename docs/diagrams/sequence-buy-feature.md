---
diagram: sequence-buy-feature
uml-type: sequence
source: EDD.md §4.5.6, §5.7, §6.1; ARCH.md §3.3, §5.1
generated: 2026-04-26T00:00:00Z
---

# Sequence Diagram — POST /v1/spin with buyFeature=true

> 來源：EDD.md §4.5.6 Buy Feature Sequence, §5.7 Session Floor, §6.1 Endpoints; ARCH.md §3.3 Component Inventory

```mermaid
sequenceDiagram
    autonumber

    participant Client as Client (Frontend)
    participant Fastify as Fastify Router
    participant JwtAuthGuard as JwtAuthGuard
    participant BuyFeatureUseCase as BuyFeatureUseCase
    participant SpinUseCase as SpinUseCase
    participant LockGuard as ConcurrencyLockGuard
    participant FloorGuard as SessionFloorGuard
    participant Redis as UpstashCacheAdapter (Redis)
    participant WalletRepo as SupabaseWalletRepository
    participant SlotEngine as SlotEngine
    participant CoinToss as CoinTossEvaluator
    participant FGOrch as FreeGameOrchestrator
    participant SessionRepo as SupabaseSessionRepository
    participant SupaDB as Supabase PostgreSQL

    Client->>Fastify: POST /v1/spin {Authorization: Bearer <token>, playerId: "b1c2d3e4...", betLevel: 100, buyFeature: true, extraBet: false, currency: "USD"}
    Fastify->>JwtAuthGuard: verify(token)
    JwtAuthGuard-->>Fastify: PlayerClaims {playerId: "b1c2d3e4...", role: "player"}

    Fastify->>BuyFeatureUseCase: execute(BuyFeatureRequest {playerId: "b1c2d3e4...", betLevel: 100, currency: "USD"})

    BuyFeatureUseCase->>LockGuard: acquire("sess-buyfeature-001")
    LockGuard->>Redis: SET session:sess-buyfeature-001:lock {lockToken="lock-bf-001"} NX EX 10
    Redis-->>LockGuard: OK
    LockGuard-->>BuyFeatureUseCase: lockToken = "lock-bf-001"

    BuyFeatureUseCase->>WalletRepo: getBalance("b1c2d3e4...", "USD")
    WalletRepo->>SupaDB: SELECT balance FROM wallets WHERE player_id='b1c2d3e4...' FOR UPDATE
    SupaDB-->>WalletRepo: balance = 2500.00
    WalletRepo-->>BuyFeatureUseCase: 2500.00

    Note over BuyFeatureUseCase: Buy Feature cost = 100 × baseBet = 100 × 1.00 = 100.00 USD
    Note over BuyFeatureUseCase: Validate: 2500.00 >= 100.00 → OK
    Note over BuyFeatureUseCase: Session floor = max(totalFGWin, 20 × baseBet) = max(?, 20.00)

    BuyFeatureUseCase->>WalletRepo: debit("b1c2d3e4...", amount=100.00, "USD")
    WalletRepo->>SupaDB: UPDATE wallets SET balance=2400.00; INSERT wallet_transactions DEBIT 100.00
    SupaDB-->>WalletRepo: OK
    WalletRepo-->>BuyFeatureUseCase: void

    Note over BuyFeatureUseCase: Configure guaranteed Heads×5 — override coinProbs to [1.0, 1.0, 1.0, 1.0, 1.0] for this session

    BuyFeatureUseCase->>Redis: SET session:sess-buyfeature-001 {status="FG_ACTIVE", floorValue=20.00, buyFeature=true, fgMultiplier=3, baseBet=1.00, guaranteedHeads=true} EX 300
    Redis-->>BuyFeatureUseCase: OK

    BuyFeatureUseCase->>SlotEngine: spin(SpinRequest {baseBet=1.00, buyFeature=true, guaranteedHeads=true})
    SlotEngine->>SlotEngine: generateGrid(config, extraBet=false)

    SlotEngine->>CoinToss: evaluate(rng=ANY, config.coinToss, stage=0) with guaranteed Heads override
    Note over CoinToss: buyFeature=true → coinProb[stage] forced to 1.0 (guaranteed Heads×5)
    CoinToss-->>SlotEngine: HEADS → fgMultiplier=3 (1st Heads)

    SlotEngine->>FGOrch: runSequence(fgSession{multiplier=3, floorValue=20.00, guaranteedHeads=true}, config)

    %% 5 guaranteed rounds
    loop 5 FG Rounds (all guaranteed Heads until 5th, then Tails)
        FGOrch->>SlotEngine: spin FGRound[n] (baseBet=1.00, fgMultiplier=currentMultiplier)
        SlotEngine-->>FGOrch: CascadeSequence {totalWin: roundWin}
        FGOrch->>CoinToss: evaluate(rng=ANY, config.coinToss, stage=n) — guaranteed Heads until round 4
        alt n < 4 — still guaranteed Heads
            CoinToss-->>FGOrch: HEADS → advance multiplier (3→7→17→27→77)
        else n = 4 — 5th coin toss, guaranteed Tails to end sequence
            CoinToss-->>FGOrch: TAILS → FG sequence ends
        end
        FGOrch->>Redis: HSET session:... fgRound=(n+1) fgMultiplier=(next) totalFGWin=(accumulated); EXPIRE 300
    end

    Note over FGOrch: FG Results: Round0=2.40(×3), Round1=5.60(×7), Round2=8.50(×17), Round3=4.20(×27), Round4=11.00(×77)
    Note over FGOrch: Sum before bonus = 2.40+5.60+8.50+4.20+11.00 = 31.70
    FGOrch->>FGOrch: drawBonusMultiplier(fgBonusWeights) → rng=0.63 → FGBonusMultiplier.X1
    Note over FGOrch: totalFGWin = 31.70 × bonusMultiplier(1) = 31.70

    FGOrch-->>SlotEngine: FreeGameSession {totalFGWin=31.70, bonusMultiplier=1, rounds:[5 FGRound], isComplete=true}
    SlotEngine-->>BuyFeatureUseCase: SpinEntity {totalWin=31.70, fgTriggered=true, fgMultiplier=77, fgBonusMultiplier=1}

    %% Session Floor Check
    BuyFeatureUseCase->>FloorGuard: applyFloor(totalFGWin=31.70, baseBet=1.00)
    FloorGuard->>FloorGuard: computeFloorValue(1.00) → 20.00; isFloorActive: 31.70 >= 20.00 → floor NOT triggered
    FloorGuard-->>BuyFeatureUseCase: adjustedWin = 31.70 (floor not applied since 31.70 >= 20.00)
    Note over BuyFeatureUseCase: sessionFloorApplied = false (totalFGWin 31.70 >= floor 20.00)

    Note over BuyFeatureUseCase: Example where floor IS triggered — if totalFGWin were 12.50 < 20.00, then adjustedWin = 20.00 and sessionFloorApplied = true

    BuyFeatureUseCase->>WalletRepo: credit("b1c2d3e4...", amount=31.70, "USD")
    WalletRepo->>SupaDB: UPDATE wallets SET balance=2431.70; INSERT wallet_transactions CREDIT 31.70
    SupaDB-->>WalletRepo: OK

    BuyFeatureUseCase->>FloorGuard: isFloorActive(session) → check if floor was applied
    FloorGuard-->>BuyFeatureUseCase: false

    BuyFeatureUseCase->>SessionRepo: save(spinLog with buyFeature outcome)
    SessionRepo->>SupaDB: INSERT spin_logs {outcome_jsonb: {buyFeature:true, fgRounds:[5], totalWin:31.70, sessionFloorApplied:false}}
    SupaDB-->>SessionRepo: OK

    BuyFeatureUseCase->>Redis: DEL session:sess-buyfeature-001
    Redis-->>BuyFeatureUseCase: OK

    BuyFeatureUseCase->>LockGuard: release("sess-buyfeature-001", "lock-bf-001")
    LockGuard->>Redis: DEL session:sess-buyfeature-001:lock
    Redis-->>LockGuard: OK

    BuyFeatureUseCase-->>Fastify: FullSpinOutcomeDTO {totalWin=31.70, fgTriggered=true, fgMultiplier=77, fgRounds:[FGRoundDTO×5], fgBonusMultiplier=1, sessionFloorApplied=false, buyFeature=true}

    Fastify-->>Client: 200 OK {success:true, data: FullSpinOutcomeDTO, requestId:"req-bf-001"}
```
