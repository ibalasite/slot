# BRD — Thunder Blessing Slot GDD

> 版本：1.0 | 狀態：DRAFT | 日期：2026-04-26

---

## §0 Elevator Pitch

Thunder Blessing 是一款希臘神話主題的高爆發老虎機，以「滾輪持續擴展 × 符號鍊式消除 × 閃電能量蓄積」為核心遊戲循環。每次獲獎觸發 Cascade 連鎖消除並擴展滾輪列數（最多 5×6），累積的閃電標記一旦被 Scatter 引爆，即可將整版標記格轉換為同一高賠符號，最終透過 Coin Toss 翻幣決定是否進入最高 ×77 倍率的 Free Game。

**商業價值**：RTP 97.5% 搭配中高波動設計，使單次 session 爆發天花板達 30,000× baseBet（Extra Bet + Buy FG 最高可達 90,000×），兼顧主流玩家留存率與高價值玩家追求峰值的需求，適合部署於競爭激烈的線上博弈平台。本 GDD 套件設計成「工程可執行」等級，所有規格即文件即程式，前後端與 QA 均可 100% 按文件交付。

---

## §1 商業背景與目標

### 商業定位

- **波動等級**：中高波動（Medium-High Volatility）
- **目標 RTP**：97.5%（四情境獨立驗收）
- **最大獎金**：30,000× baseBet（Main Game）；90,000× baseBet（Extra Bet + Buy FG）
- **遊戲類型**：Cascade + Expanding Reels Slot，含 Coin Toss 及 Free Game 機制

### 目標市場

- 線上博弈平台（B2B 遊戲供應商模式）
- 幣種支援：USD（$0.25～$10.00）、TWD（TWD10～TWD320）
- 前端技術：Cocos Creator 或 PixiJS
- 後端技術：TypeScript / Fastify / Clean Architecture

### 競爭優勢

| 差異化要素 | 說明 |
|-----------|------|
| Cascade 擴展滾輪 | 獲獎後自動擴展至 5×6 + 57 條連線，持續累積獎金 |
| 雷霆 Scatter 引爆機制 | 閃電標記 × Scatter 雙擊制，整版符號升階，爆發上限極高 |
| ×77 Free Game 倍率 | Coin Toss 倍率序列 ×3→×7→×17→×27→×77，稀有峰值極具話題性 |
| 工程可執行 GDD | Excel 驅動工具鏈，禁止人工調參，RTP 透明可驗收 |

---

## §2 利害關係人

| 角色 | 關心重點 |
|------|---------|
| 遊戲企劃 | 機率平衡完整性、四情境 RTP 各自通過 verify.js、機制邊界條件正確性 |
| 後端工程師 | slot-engine 工具鏈整合、API 設計（單次 spin 回傳完整 FG 序列）、Supabase / Redis 架構 |
| 前端工程師 | 動畫流程時序、UI 規格（Cascade 擴展動畫、閃電標記特效、Coin Toss 動畫）、幣種顯示 |
| QA 工程師 | 驗收標準（unit test + 100 萬次 Monte Carlo 模擬）、四情境 RTP 各在 ±1% 容許範圍內 |
| 營運 / 合規 | RTP 透明（verify.js 輸出可稽核）、最大獎金上限明確（30,000×）、幣種合規顯示 |

---

## §3 核心功能需求（Business Requirements）

### BR-01 基礎滾輪系統

- 5 滾輪 × 3 列（初始），每輪 SPIN 開始時重置為 3 列
- 初始連線數：25 條；最大連線數：57 條（6 列時）
- 連線判定：從最左滾輪往右，同一連線只計最高獎金，不重複計算
- Wild（W）可代替除 SC 外所有符號
- 符號升級路徑（雷霆祝福第二擊）：L1/L2/L3/L4 → P4（所有 L 級符號一步直升 P4，不經中間階）→ P3 → P2 → P1（最高，不再升）

### BR-02 Cascade 連鎖消除

- 觸發條件：本次判定有中獎連線
- 流程：
  1. 在中獎符號位置生成閃電標記（Lightning Mark）
  2. 消除中獎符號，上方符號下落填補空位
  3. 若目前 rows < MAX_ROWS（6），則 rows + 1，連線數對應增加
  4. 新符號從滾輪頂端落下，補足新增列
  5. 重新判定全部連線，如再次中獎則循環本流程
  6. 直至無獲獎連線為止
- 閃電標記在普通遊戲中每次新 SPIN 開始前清除；Free Game 中整局累積不清除

### BR-03 閃電標記 + 雷霆祝福 Scatter（Thunder Blessing）

- 觸發條件：盤面存在閃電標記 AND 本次新符號中有 Scatter 落下
- **第一擊**：將盤面所有閃電標記格的符號，統一替換為同一種隨機高賠符號，重新計算全盤連線與獎金
- **第二擊**（機率 40%，`tbSecondHit: 0.4`）：將第一擊後標記格的符號再升一級（依升級路徑），重新計算全盤連線與獎金
- 雷霆祝福觸發後，Cascade 流程繼續（若有新獲獎則繼續消除擴展）

### BR-04 Coin Toss 硬幣翻轉

- 觸發條件（Main Game）：滾輪已達 MAX_ROWS（6 列）且本次 Cascade 再次成功，以 `mgFgTriggerProb`（0.009624）判定是否進入 Coin Toss
- 觸發條件（Buy FG 模擬情境）：`fgTriggerProb`（0.009081）作為 Buy FG 符號池設計的參考參數，用於 Monte Carlo 模擬，**不用於** Buy Feature 入場判定
- Buy Feature 入場：完全繞過 `fgTriggerProb` / `mgFgTriggerProb`，直接進入 Coin Toss（保證 Heads × 5）
- **Heads（正面）**：進入 Free Game，初始倍率 ×3
- **Tails（反面）**：本輪 SPIN 結束，不進入 FG
- 進入 FG 的 Coin Toss Heads 機率：Main Game = 0.80；Buy Feature = 1.00（保證）

### BR-05 Free Game 免費遊戲

- **進入倍率**：×3（首次 Coin Toss Heads 後）
- **倍率升級序列**：每局 FG Spin **開始前**翻一次 Coin Toss（第一次 Heads 已在 BR-04 觸發 FG 時完成，此後每輪 FG Spin 前翻一次）
  - Heads → 倍率升一級（×3 → ×7 → ×17 → ×27 → ×77）
  - ×77 為最高倍率，達到後維持不再升
  - Tails → FG 當輪結束（保留當前倍率至 FG 結束）
  - 達到 ×77 後，每局 FG Spin 開始前仍翻一次 Coin Toss（機率 coinProbs[4] = 0.40）；Tails 即結束整場 FG，允許連續多局 ×77 FGSpin
- **Coin Toss Heads 機率序列（各回合）**：[0.80, 0.68, 0.56, 0.48, 0.40]（對應倍率階段）
- 整個 FG 期間閃電標記跨 Spin 累積不清除，FG 全部結束後才清除
- **FG 總獎金額外乘數**：進入 FG 時由 FG Bonus 表隨機抽取乘數（×1/×5/×20/×100），套用於整局 FG 總獎金（見 §4.5）
- **Buy Free Game 特例**：5 回合 Coin Toss 均保證 Heads，不受 `fgTriggerProb` 限制

### BR-06 Extra Bet（額外投注）

- 開啟條件：玩家主動切換 Extra Bet ON
- **費用**：投注額 × 3（`extraBetMult: 3`）
- **效果**：保證每次 Spin 至少出現 1 個 Scatter（SC）
- 關閉時：Scatter 依正常機率隨機出現
- Extra Bet 使用獨立符號權重表（`extraBet` 權重組）

### BR-07 Buy Feature（購買功能）

- **費用**：100× baseBet（Extra Bet 開啟時：300× baseBet）
  - `buyCostMult: 100`，Extra Bet 疊加時再乘以 `extraBetMult: 3`
- **效果**：直接進入 Coin Toss 流程，5 回合均保證 Heads（`entryBuy: 1.0`）
- **保底機制**：整場 session totalWin ≥ 20× baseBet（`buyFGMinWin: 20`）；Extra Bet ON 時保底為 20 × baseBet × extraBetMult（3）= 60× baseBet
- Buy Feature 使用獨立符號權重表（`buyFG` 權重組）

### BR-08 Near Miss（視覺張力機制）

- **定義**：接近中獎但實際獲獎為 0 的特殊符號排列，在 Excel DATA tab 中獨立設計
- **效果**：純視覺特效，不計入 RTP，不產生任何 win，用於增加遊戲緊張感
- **工具鏈**：Near Miss 配置由 `build_config.js` 自動寫入 ENG_TOOLS tab 及 DESIGN_VIEW tab；`engine_generator.js` 生成對應的 `GameConfig.generated.ts` 欄位
- **實作限制**：Near Miss 邏輯只在 Excel 定義，遊戲引擎只讀取生成後的 GameConfig，禁止在程式碼中客製 Near Miss 排列

---

## §4 機率設計需求

### §4.1 目標 RTP

- **整體目標 RTP**：97.5%
- 各情境 target RTP 各自設計為 100%，整體產品設計目標 RTP 為 97.5%（四情境獨立平衡，非合併後正規化）

| 情境 | 模式 | Extra Bet |
|------|------|-----------|
| 1 | Main Game | Off |
| 2 | Main Game | On |
| 3 | Free Game | Off |
| 4 | Buy Free Game | On |

> ⚠️ EDD §2 將情境 3 標記為「Buy Free Game Off」，正確名稱應為「Free Game（Buy FG Off）」，使用 `freeGame` 符號權重組，EDD §2 待同步修正。

### §4.2 賠率表（Paytable）

> 獎金 = 總投注額 × 賠率倍數（Free Game 時再乘以 FG 倍率）
> 所有模式共用同一張賠率表

| 符號 | 說明 | 3 連線 | 4 連線 | 5 連線 |
|------|------|:------:|:------:|:------:|
| W | Wild（百搭）| ×0.17 | ×0.43 | ×1.17 |
| P1 | Zeus（宙斯）| ×0.17 | ×0.43 | ×1.17 |
| P2 | Pegasus（天馬）| ×0.11 | ×0.27 | ×0.67 |
| P3 | Athena（雅典娜）| ×0.09 | ×0.23 | ×0.67 |
| P4 | Eagle（雄鷹）| ×0.07 | ×0.17 | ×0.57 |
| L1 | Z | ×0.03 | ×0.07 | ×0.17 |
| L2 | E | ×0.03 | ×0.07 | ×0.17 |
| L3 | U | ×0.02 | ×0.05 | ×0.13 |
| L4 | S | ×0.02 | ×0.05 | ×0.13 |
| SC | Thunder Blessing Scatter | — | — | — |

> SC 無直接賠率，觸發雷霆祝福特效  
> 1～2 個同符號不計分，3 個起計

### §4.3 符號權重（四情境）

> 來源：`engine_config.json` → `weights`

#### 情境 1：Main Game（Extra Bet Off）

| 符號 | 權重 | 合計 |
|------|:----:|:----:|
| W | 3 | |
| SC | 2 | |
| P1 | 6 | |
| P2 | 7 | |
| P3 | 8 | |
| P4 | 10 | |
| L1 | 13 | |
| L2 | 13 | |
| L3 | 14 | |
| L4 | 14 | **合計 90** |

#### 情境 2：Main Game（Extra Bet On）

| 符號 | 權重 | 合計 |
|------|:----:|:----:|
| W | 4 | |
| SC | 7 | |
| P1 | 7 | |
| P2 | 8 | |
| P3 | 8 | |
| P4 | 9 | |
| L1 | 10 | |
| L2 | 11 | |
| L3 | 13 | |
| L4 | 13 | **合計 90** |

#### 情境 3：Free Game（Buy FG Off）

| 符號 | 權重 | 合計 |
|------|:----:|:----:|
| W | 4 | |
| SC | 6 | |
| P1 | 9 | |
| P2 | 10 | |
| P3 | 11 | |
| P4 | 12 | |
| L1 | 9 | |
| L2 | 9 | |
| L3 | 10 | |
| L4 | 10 | **合計 90** |

#### 情境 4：Buy Free Game（Buy FG On）

| 符號 | 權重 | 合計 |
|------|:----:|:----:|
| W | 2 | |
| SC | 4 | |
| P1 | 2 | |
| P2 | 3 | |
| P3 | 3 | |
| P4 | 6 | |
| L1 | 14 | |
| L2 | 14 | |
| L3 | 19 | |
| L4 | 23 | **合計 90** |

### §4.4 FG 倍率序列與 Coin Toss 機率

| 倍率階段 | FG 倍數 | Coin Toss Heads 機率 |
|---------|:-------:|:-------------------:|
| 第 1 次 Heads（進入 FG）| ×3 | 0.80（Main）/ 1.00（Buy）|
| 第 2 次 Heads | ×7 | 0.68 |
| 第 3 次 Heads | ×17 | 0.56 |
| 第 4 次 Heads | ×27 | 0.48 |
| 第 5 次+ Heads | ×77（維持）| 0.40 |

> `fgMults: [3, 7, 17, 27, 77]`  
> `coinProbs: [0.80, 0.68, 0.56, 0.48, 0.40]`  
> `entryMain: 0.80`，`entryBuy: 1.00`  
> ⚠️ **coinProbs[0]（0.80）即為 entryMain，是 BR-04 入場 Coin Toss 的機率**，與 entryMain 數值相同且角色相同。  
> 入場 Heads 後，×3 FGSpin **無條件開始**（不再需要額外 toss）。  
> coinProbs[1..4]（0.68 / 0.56 / 0.48 / 0.40）分別對應每局 FGSpin **開始前**的倍率升級 Coin Toss（×7 / ×17 / ×27 / ×77 升階門檻）。

### §4.5 FG Bonus 額外倍數

> 進入 Free Game 時，由 FG Bonus 表額外抽取一個乘數，套用於整局 FG 總獎金

| 額外倍數 | 權重 | 合計 |
|:--------:|:----:|:----:|
| ×1 | 900 | |
| ×5 | 80 | |
| ×20 | 15 | |
| ×100 | 5 | **合計 1000** |

### §4.6 特殊機率參數

| 參數 | 值 | 說明 |
|------|:--:|------|
| `fgTriggerProb` | 0.009081 | Buy FG 情境符號池設計用（Monte Carlo 模擬參考值）；Buy Feature 入場不受此限制 |
| `mgFgTriggerProb` | 0.009624 | Main Game FG 觸發機率 |
| `tbSecondHit` | 0.40 | 雷霆祝福第二擊觸發機率 |
| `extraBetMult` | 3 | Extra Bet 投注倍數 |
| `buyCostMult` | 100 | Buy Feature 費用倍數（× baseBet）|
| `buyFGMinWin` | 20 | Buy Feature 保底最低獲獎（× baseBet）|
| `PAYTABLE_SCALE` | 3.622 | 賠率表縮放係數（僅工具鏈內部使用）|

---

## §5 slot-engine 工具鏈需求

### §5.1 工具鏈流程

```
Excel DATA tab（唯一參數來源）
    │
    ▼
build_config.js
    │
    ├──► engine_config.json（機率參數）
    └──► ENG_TOOLS tab（驗收指標）
            │
            ▼
        excel_simulator.js（100 萬次 Monte Carlo 模擬）
            │
            ▼
        verify.js（RTP 驗收，四情境各 ±1% 容許）
            │  ← ⚠️ 必須通過 verify.js，才可繼續執行下方步驟
            ▼
        engine_generator.js
            │
            ▼
        GameConfig.generated.ts（禁止手動修改）
```

**工具鏈黃金法則**：Excel DATA tab 是唯一合法的參數定義來源。所有機率邏輯、RTP 設計、保底規則，只在 Excel 中定義。

> ⚠️ 步驟順序以本圖為準：slot-engine-EDD.md §8.2 的步驟列表中，engine_generator.js 排在 verify.js 之前（即先生成再驗收）。本 BRD 採更嚴格的 gating 要求（verify.js 通過後才執行 engine_generator.js），EDD §8.2 待同步修正。

### §5.2 禁止行為（Non-Negotiable）

| # | 禁止事項 |
|---|---------|
| 1 | 禁止在程式碼中加入 payout scale 乘數（`PAYTABLE_SCALE` 僅限工具鏈內部計算使用）|
| 2 | 禁止 retry loop 保底（即禁止在遊戲執行期以重試循環強制達到目標 RTP；保底的機率設計只在 Excel 定義；session 級別的底線邏輯由 SlotEngine 實作，不視為 retry loop）|
| 3 | 禁止 UI 層做任何 win 計算或修改（UI 只顯示引擎回傳的 `totalWin`）|
| 4 | 禁止手動修改 `GameConfig.generated.ts`（需修改請從 Excel 重新執行 `engine_generator.js`）|
| 5 | 禁止跨情境混用符號權重（四情境各自獨立，絕對不可混用）|
| 6 | 禁止以 `session.roundWin` 作為入帳或最終顯示依據（`session.roundWin` 是動畫顯示計數器；入帳唯一依據為引擎輸出 `outcome.totalWin`）|

### §5.3 Bet Range 規格

| 幣種 | 最小投注 | 最大投注 | 步進 |
|------|:-------:|:-------:|:----:|
| USD | $0.25 | $10.00 | $0.25 |
| TWD | TWD 10 | TWD 320 | TWD 10 |

> 幣種投注範圍從 `BetRangeConfig.generated.ts` 讀取，**禁止硬編碼**。  
> ⚠️ TWD 上限以 `engine_config.json`（`maxLevel: 320`）為準；若 slot-engine-EDD.md 中出現 TWD 300 的描述，以本文件（TWD 320）為準，EDD 待同步修正。

---

## §6 架構需求

### §6.1 後端架構

- **語言 / 框架**：TypeScript / Node.js / Fastify
- **架構模式**：Clean Architecture（Domain → Application → Infrastructure 三層）
- **資料庫**：Supabase PostgreSQL（玩家錢包、spin 日誌、session 狀態）
- **快取**：Redis / Upstash（spin session 狀態，用於 FG 多回合狀態保持）
- **認證**：Supabase Auth（JWT 驗證，每次 spin request 必須驗證）

### §6.2 API 設計原則

- **單次 spin request / response**：回傳完整 FG 序列，不做多次來回（≤ 1 次 API 往返）
- FG 最多 5 回合（Coin Toss 序列），所有結果在單一 response 中回傳
- 錢包入帳依據：引擎 `totalWin`（唯一權威值），UI 不得自行計算或修改

### §6.3 狀態管理

- 閃電標記位置、FG 倍率、FG 剩餘回合等 session 狀態，由後端 Redis 維護
- 前端不持有任何遊戲狀態（Pure View 原則）

---

## §7 非功能需求

| 需求類別 | 規格 |
|---------|------|
| 最大獎金上限（Main Game）| 30,000× baseBet |
| 最大獎金上限（Extra Bet + Buy FG）| 90,000× baseBet |
| RTP 驗收標準 | 100 萬次 Monte Carlo 模擬，四情境各 ±1% 容許範圍 |
| Buy Feature 保底 | session totalWin ≥ 20× baseBet |
| 幣種支援 | USD / TWD（從 `BetRangeConfig.generated.ts` 讀取，禁止硬編碼）|
| 錢包入帳唯一權威 | 引擎回傳之 `totalWin`，UI 顯示值不得作為入帳依據 |
| 前端框架 | Cocos Creator 或 PixiJS（待定）|
| API 往返次數上限 | 每次完整 spin（含 FG 全序列）≤ 1 次 HTTP 往返 |

---

## §8 成功指標（KPI）

| # | 指標 | 驗收標準 |
|---|------|---------|
| KPI-01 | RTP 97.5% | 四情境各自通過 `verify.js`（±1% 容許範圍） |
| KPI-02 | 最大獎金可達性 | 模擬結果中 30,000× baseBet 峰值可觸發 |
| KPI-03 | Cascade 連鎖消除正確率 | Unit test 100% 通過（含邊界：6 列上限、閃電標記跨步驟追蹤）|
| KPI-04 | Buy Feature 保底 | 整場 session totalWin ≥ 20× baseBet（session 級別保底）|
| KPI-05 | API 往返效率 | 單次 spin response 包含完整 FG 序列，≤ 1 次 API 往返 |
| KPI-06 | 工具鏈自動化 | Excel 修改後，依 §5.1 流程：`build_config.js` → `excel_simulator.js` → `verify.js`（通過後）→ `engine_generator.js`，即可重新生成 `GameConfig.generated.ts`，無需人工介入 |

---

## §9 範圍界定（In / Out Scope）

### In Scope

- GDD 全套文件（IDEA / BRD / PRD / EDD / ARCH / API / SCHEMA / FRONTEND / AUDIO / ANIM / BDD）
- 機率設計驗收（四情境 100 萬次 Monte Carlo 模擬 + `verify.js` 通過）
- slot-engine 工具鏈完整規格（Excel → TypeScript 生成流程）
- 後端 API 設計與實作（Fastify + Supabase + Redis）
- 前端遊戲邏輯實作（Cocos Creator 或 PixiJS）
- 幣種支援（USD / TWD）
- Buy Feature 與 Extra Bet 完整機制
- Near Miss 視覺機制規格（BR-08）
- 所有機制的 Unit Test 與 E2E 驗收

### Out Scope

- 實際前端視覺資產製作（美術圖檔、音效製作等）
- 真實金流系統整合（Payment Gateway、真實錢包對接）
- 實體合規申請（RNG 認證、監管機構送審）
- 多語系本地化（i18n）
- 行動裝置原生 App 打包

---

*BRD 版本 1.0 — 基於 IDEA.md、GDD_Thunder_Blessing_Slot.md、Probability_Design.md、slot-engine-EDD.md 及 engine_config.json 整合生成。*
