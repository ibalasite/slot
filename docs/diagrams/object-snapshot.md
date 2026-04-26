---
diagram: object-snapshot
uml-type: object
source: EDD.md §4.5.3, §5.2, §5.6; ARCH.md §3 Domain Model
generated: 2026-04-26T00:00:00Z
---

# Object Diagram — Concrete Instance Snapshots

> 來源：EDD.md §4.5.3 Object Diagram, §5.2 FullSpinOutcome Schema, §5.6 FG Bonus Multiplier

## Snapshot A: Spin Triggering Thunder Blessing Scatter (FG Entry)

A spin where 3 cascade steps accumulate 8 Lightning Marks, Thunder Blessing fires on the 3rd step, Coin Toss returns Heads (×17 FG), and totalWin = 1250.00.

```mermaid
flowchart TD
    %% SpinRequest object
    subgraph SR ["SpinRequest : object"]
        SR1["playerId = 'a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234'"]
        SR2["betLevel = 50"]
        SR3["extraBet = false"]
        SR4["buyFeature = false"]
        SR5["currency = 'USD'"]
    end

    %% SpinEntity / FullSpinOutcome
    subgraph FSO ["SpinEntity : object  (sessionId = 'sess-9e2b1a34-cf87-4d12-a951-bc7d3e4f5678')"]
        FSO1["playerId = 'a3f7c2d1-8b4e-4f9a-bc12-d5e6f7891234'"]
        FSO2["baseBet = 0.50"]
        FSO3["totalWin = 1250.00   ← SOLE ACCOUNTING AUTHORITY"]
        FSO4["finalRows = 6"]
        FSO5["thunderBlessingTriggered = true"]
        FSO6["thunderBlessingFirstHit = true"]
        FSO7["thunderBlessingSecondHit = true"]
        FSO8["upgradedSymbol = 'P1'"]
        FSO9["coinTossTriggered = true"]
        FSO10["coinTossResult = 'HEADS'"]
        FSO11["fgTriggered = true"]
        FSO12["fgMultiplier = 17"]
        FSO13["totalFGWin = 950.00"]
        FSO14["fgBonusMultiplier = 5"]
        FSO15["sessionFloorApplied = false"]
        FSO16["nearMiss = false"]
        FSO17["engineVersion = '1.0.0'"]
    end

    %% LightningMarkSet
    subgraph LMS ["LightningMarkSet : object"]
        LMS1["count = 8"]
        LMS2["positions[0] = {row:0, col:1}"]
        LMS3["positions[1] = {row:0, col:3}"]
        LMS4["positions[2] = {row:1, col:0}"]
        LMS5["positions[3] = {row:1, col:2}"]
        LMS6["positions[4] = {row:2, col:1}"]
        LMS7["positions[5] = {row:2, col:4}"]
        LMS8["positions[6] = {row:3, col:2}"]
        LMS9["positions[7] = {row:4, col:3}"]
    end

    %% CascadeSequence
    subgraph CS ["CascadeSequence : object"]
        CS1["steps.length = 3"]
        CS2["totalWin = 300.00"]
        CS3["finalRows = 6"]
    end

    %% CascadeStep[0]
    subgraph CSTEP0 ["CascadeStep[0] : object"]
        CST0_1["index = 0"]
        CST0_2["stepWin = 75.00"]
        CST0_3["rows = 4"]
        CST0_4["newLightningMarks = [{r:0,c:1},{r:0,c:3},{r:1,c:0},{r:1,c:2}]"]
    end

    %% CascadeStep[1]
    subgraph CSTEP1 ["CascadeStep[1] : object"]
        CST1_1["index = 1"]
        CST1_2["stepWin = 125.00"]
        CST1_3["rows = 5"]
        CST1_4["newLightningMarks = [{r:2,c:1},{r:2,c:4},{r:3,c:2}]"]
    end

    %% CascadeStep[2] — Thunder Blessing fires here
    subgraph CSTEP2 ["CascadeStep[2] : object  (Thunder Blessing fires)"]
        CST2_1["index = 2"]
        CST2_2["stepWin = 100.00"]
        CST2_3["rows = 6"]
        CST2_4["newLightningMarks = [{r:4,c:3}]"]
        CST2_5["thunderBlessingApplied = true"]
    end

    %% FreeGameSession
    subgraph FGS ["FreeGameSession : object  (sessionId = 'sess-9e2b1a34-cf87-4d12-a951-bc7d3e4f5678')"]
        FGS1["currentMultiplier = 17  (×17)"]
        FGS2["currentStage = 2"]
        FGS3["totalFGWin = 950.00"]
        FGS4["bonusMultiplier = 5  (×5)"]
        FGS5["rounds.length = 5"]
        FGS6["isComplete() = true"]
    end

    %% Relationships
    SR --> FSO
    FSO --> CS
    FSO --> LMS
    CS --> CSTEP0
    CS --> CSTEP1
    CS --> CSTEP2
    FSO --> FGS
```

---

## Snapshot B: FreeGameSession in Progress (Round 3 of 5, Multiplier ×17)

FG session is active after 3rd Heads, currently running round 3, lightning marks persisted from previous rounds.

```mermaid
flowchart TD
    %% FreeGameSession
    subgraph FGS ["FreeGameSession : object  (sessionId = 'sess-7f3d1c28-a95e-4b17-8e42-c0d9f1a23456')"]
        FGS1["playerId = 'b1c2d3e4-f5a6-7890-bcde-f01234567890'"]
        FGS2["currentMultiplier = 17  (stage=2 of 5)"]
        FGS3["currentStage = 2"]
        FGS4["totalFGWin = 410.00  (accumulated so far: rounds 0+1+2)"]
        FGS5["bonusMultiplier = 5  (drawn once at FG entry)"]
        FGS6["floorValue = 0  (not a BuyFeature session)"]
        FGS7["isComplete() = false"]
    end

    %% LightningMarkSet persisted across FG rounds
    subgraph LMS ["LightningMarkSet : object  (persisted, 6 marks accumulated)"]
        LMS1["count = 6"]
        LMS2["positions[0] = {row:1, col:0}"]
        LMS3["positions[1] = {row:2, col:2}"]
        LMS4["positions[2] = {row:3, col:1}"]
        LMS5["positions[3] = {row:0, col:4}"]
        LMS6["positions[4] = {row:4, col:3}"]
        LMS7["positions[5] = {row:5, col:2}"]
    end

    %% FGRound[0] — completed
    subgraph FGR0 ["FGRound[0] : object  (COMPLETED)"]
        FGR0_1["index = 0"]
        FGR0_2["win = 120.00"]
        FGR0_3["multiplier = 17"]
        FGR0_4["coinTossResult = 'HEADS'  (advance to round 1)"]
        FGR0_5["lightningMarksBefore.count = 0"]
        FGR0_6["lightningMarksAfter.count = 2"]
    end

    %% FGRound[1] — completed
    subgraph FGR1 ["FGRound[1] : object  (COMPLETED)"]
        FGR1_1["index = 1"]
        FGR1_2["win = 180.00"]
        FGR1_3["multiplier = 17"]
        FGR1_4["coinTossResult = 'HEADS'  (advance to round 2)"]
        FGR1_5["lightningMarksBefore.count = 2"]
        FGR1_6["lightningMarksAfter.count = 4"]
    end

    %% FGRound[2] — completed
    subgraph FGR2 ["FGRound[2] : object  (COMPLETED)"]
        FGR2_1["index = 2"]
        FGR2_2["win = 110.00"]
        FGR2_3["multiplier = 17"]
        FGR2_4["coinTossResult = 'HEADS'  (advance to round 3 — CURRENT)"]
        FGR2_5["lightningMarksBefore.count = 4"]
        FGR2_6["lightningMarksAfter.count = 6"]
    end

    %% FGRound[3] — ACTIVE (currently running)
    subgraph FGR3 ["FGRound[3] : object  (ACTIVE — in progress)"]
        FGR3_1["index = 3"]
        FGR3_2["win = undefined  (not yet resolved)"]
        FGR3_3["multiplier = 17"]
        FGR3_4["coinTossResult = undefined  (pending)"]
        FGR3_5["lightningMarksBefore.count = 6"]
    end

    %% Redis session hash
    subgraph REDIS ["Redis Hash: session:7f3d1c28-a95e-4b17-8e42-c0d9f1a23456"]
        R1["status = 'FG_ACTIVE'"]
        R2["fgRound = 3"]
        R3["fgMultiplier = 17"]
        R4["fgBonusMultiplier = 5"]
        R5["totalFGWin = 410.00"]
        R6["lightningMarks = '[{r:1,c:0},{r:2,c:2},{r:3,c:1},{r:0,c:4},{r:4,c:3},{r:5,c:2}]'"]
        R7["lockToken = 'lock-a1b2c3d4-e5f6-7890'"]
        R8["TTL = 287s (renewed each round)"]
    end

    FGS --> LMS
    FGS --> FGR0
    FGS --> FGR1
    FGS --> FGR2
    FGS --> FGR3
    FGS -.-> REDIS
```
