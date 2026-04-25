# EDD — Thunder Blessing Slot Engine Generator

> Engineering Design Document
> 工具路徑：`tools/slot-engine/`
> 最後更新：2026-04-04

---

## 1. 目的

`engine_generator.js` 是將 Excel（`Thunder_Config.xlsx`）中定義的機率參數，
自動轉換為遊戲可執行的 `GameConfig.ts` 與 `SlotEngine.ts` 的工具鏈。

**核心原則：所有機率邏輯、RTP 設計、保底規則、必中條件，只在 Excel 定義。
程式碼中不允許任何繞過 Excel 的調整（禁止 payout scale 乘數、禁止 retry loop、
禁止 UI 層保底）。**

---

## 2. 四個獨立情境

每個情境擁有完全獨立的符號權重、觸發率、保底邏輯與 RTP 設計：

| 情境 | 模式 | Extra Bet |
|------|------|-----------|
| 1 | Main Game | Off |
| 2 | Main Game | On |
| 3 | Buy Free Game | Off |
| 4 | Buy Free Game | On |

每個情境的 **target RTP = 100%**，由 Excel DATA tab 分別定義，獨立平衡。

---

## 3. RTP 平衡設計

### 3.1 中獎組合期望值
引擎先計算所有中獎組合的期望報酬：
```
期望報酬 = Σ (每種中獎組合的機率 × 賠率)
```

### 3.2 Near Miss（獨立定義，不計入 RTP）
- Near miss 是「接近中獎但實際 0 獎」的特殊視覺情境
- 在 Excel 中**獨立定義**（獨立的符號排列、觸發條件）
- **不計入** RTP 計算（near miss 不產生任何 win）
- 功能：增加遊戲張力與娛樂性，不影響數學期望值

### 3.3 0 獎填充順序（達成 target RTP）
1. 計算中獎組合期望值後，確認需要多少 0 獎 spin 才能讓整體 = target RTP
2. **優先**填入 Excel 定義的 near miss spin
3. **剩餘** 0 獎名額填入一般 0 獎 spin（純粹數學平衡用）
4. 四個情境各自獨立執行此流程

---

## 4. SlotEngine：原子性 Spin 模型

### 4.1 基本概念
- SlotEngine 以**一個 spin 為原子性單位**
- 一次 `computeFullSpin()` 呼叫涵蓋完整流程：主遊戲 → 收集 FREE → 進入 FG 的全部回合
- Output 是**完整且自洽的**：所有 win 已在引擎計算完畢，client 直接播放即可

### 4.2 一個 Spin 的完整邊界

**無論觸發方式（main game 觸發 或 buyFG），只要該 spin 的 result 包含 FG，
完整的 `FullSpinOutcome` 必須涵蓋以下全部流程：**

```
主遊戲消除（baseSpins）
    → 收集 FREE（符號累積到 MAX_ROWS）
    → entryCoinToss（決定是否進入 FG）
    → FG 序列：
        toss coin x3  → 消除回合（cascadeSteps）
        toss coin x7  → 消除回合
        toss coin x17 → 消除回合
        toss coin x27 → 消除回合
        toss coin x77 → 消除回合
    → totalWin（全程加總）
```

- **main game**：toss coin 某次反面即停，output 包含到停止為止的所有回合
- **buyFG**：全 5 個 toss coin 保證正面，output 包含完整 5 回合

**Client 與 Server 之間只有一次 spin 的來回（request / response），
不會在 FG 過程中多次請求引擎。** FG 的所有結果在第一次 response 中一次性回傳。

### 4.3 Input
```typescript
{
    mode:     'main' | 'buyFG'
    totalBet: number   // baseBet（如 0.25）
    extraBet: boolean
}
```

> 術語說明：
> - `baseBet`（= engine `totalBet`）：玩家設定的基礎押注，如 0.25
> - `wagered`（實際扣款）：main = baseBet；buyFG = baseBet × 100
> - `20× BET`：指 20 × baseBet，非 wagered

### 4.4 Output
```typescript
FullSpinOutcome {
    mode:          'main' | 'buyFG'
    wagered:       number                  // 實際扣款金額
    baseSpins:     BaseSpin[]              // 主遊戲各回合（收集 FREE）
    entryCoinToss: CoinToss | undefined    // 進入 FG 的拋硬幣結果
    fgTriggered:   boolean
    fgSpins:       FGSpin[]               // FG 各倍率回合
    totalWin:      number                 // 引擎計算的最終總獎（唯一權威值）
}

BaseSpin {
    grid:       SymType[][]
    cascadeSteps: CascadeStep[]           // 每步消除回合（各含 wins）
    finalRows:  number
    tbStep?:    TBStep
}

FGSpin {
    spin:         SpinResponse            // 含 cascadeSteps
    multiplier:   3 | 7 | 17 | 27 | 77
    coinToss:     CoinToss                // 正面=繼續, 反面=停止
    multipliedWin: number                 // 該 FG spin 的最終 win（含保底）
    spinBonus?:   number
}
```

### 4.5 FG 流程
- Main 模式：toss coin 正面繼續（x3→x7→x17→x27→x77），反面即停
- BuyFG 模式：全 5 回合 toss coin 保證正面（全部完成）

---

## 5. BuyFG 保底規則

### 5.1 費用結構

| 情境 | 費用（× baseBet） | EB 乘數 | 實際扣款 |
|------|-----------------|---------|---------|
| BuyFG | 100× | — | 100× baseBet |
| EBBuyFG | 100× | 3× | 300× baseBet（費用 100×，所有 win × 3）|

### 5.2 保底規則（Session Floor Only）

| 規則 | 值 | 定義位置 |
|------|-----|---------|
| 整場 session 最低 totalWin | ≥ 20 × baseBet | Excel → `BUY_FG_MIN_WIN_MULT = 20` |
| EBBuyFG 最低 totalWin | ≥ 20 × baseBet × 3 = 60 × baseBet | EB 乘數自動套用 |

> ⚠️ **Per-spin floor 已於 2026-04-04 移除**（原 `BUY_FG_SPIN_MIN_WIN_MULT`）
> 原設計：5 spin × 20× = 100× 保底 → 等於 100% 最低 RTP，使 97.5% 目標在數學上不可能達到。
> 新設計：僅設整場 session floor = 20× baseBet，遠低於平均回報（97.5× baseBet），極少觸發。

### 5.3 獎項範圍

| 情境 | 最低 win（floor） | 平均 win（97.5% RTP） | 最高 win（Max Win） |
|------|----------------|---------------------|-------------------|
| BuyFG | 20× baseBet | 97.5× baseBet | 30,000× baseBet |
| EBBuyFG | 60× baseBet | 292.5× baseBet | 90,000× baseBet |

### 5.4 實作規則

- Session floor 邏輯**只在 SlotEngine 內實作**
- 禁止 per-spin floor（已移除 `BUY_FG_SPIN_MIN_WIN_MULT`）
- 引擎 output（`totalWin`）已反映 session floor
- Client 直接使用引擎值，不做任何額外保底處理

---

## 6. UI 層（GameFlowController）職責

### 6.1 原則
- UI 層**只負責播放動畫與顯示**，不做任何 win 計算或修改
- 所有 win 值來自引擎 output，UI 不得重新計算或調整

### 6.2 WIN 顯示邏輯
```
每一個 cascade 消除回合動畫播完 → WIN: += 該回合 win（來自引擎 cascadeStep）
所有回合播完後，WIN: 累加值 = outcome.totalWin
```

### 6.3 入帳邏輯
```typescript
// 正確：使用引擎的唯一權威值
const totalWin = outcome.totalWin;

// 禁止：session.roundWin 是動畫用的顯示計數器，不得用於入帳
// const totalWin = this._session.roundWin;  ← 禁止
```

### 6.4 最終 WIN 顯示（所有動畫結束後）
```typescript
// 正確：最終顯示用引擎值
await this._ui.showTotalWin(outcome.totalWin);

// 動畫進行中的中間顯示：可用 session.roundWin（反映當下累加進度）
```

---

## 7. Excel 分頁設計

### 7.1 分頁職責總覽

| Tab | 使用者 | 讀/寫 | 說明 |
|-----|--------|-------|------|
| DATA | 企劃（唯一編輯入口） | 讀寫 | 所有機率參數的唯一來源 |
| DESIGN_VIEW | 企劃（查看用） | 唯讀（工具自動寫入） | 調整參數後的視覺化結果 |
| ENG_TOOLS | 工具程式（計算用） | 唯讀（工具自動寫入） | 工程工具運算使用的中間值與查表 |
| MODE_MATH | 工程師（參考用） | 唯讀（工具自動寫入） | 四情境解析式 RTP 估算 |
| SIMULATION | 工程師（驗收用） | 唯讀（工具自動寫入） | 蒙地卡羅模擬最終驗證結果 |

---

### 7.2 DATA Tab（企劃唯一編輯入口）

**企劃在此 tab 修改所有機率參數，其他 tab 均由工具自動產生，禁止手動編輯。**

包含：
- 機台基本規格（滾輪數、列數、最大列數、最高獎金上限）
- 基礎賠率表（`BASE_PAYTABLE`）與縮放係數（`PAYTABLE_SCALE`）
- 四個情境各自的符號權重（`SYMBOL_WEIGHTS_*`）
- 四個情境各自的觸發率（`FG_TRIGGER_PROB`）
- 四個情境各自的保底參數（`BUY_FG_SPIN_MIN_WIN_MULT` 等）
- FG 倍率序列（`FG_MULTIPLIERS`）與 toss coin 機率（`COIN_TOSS_HEADS_PROB`）
- Near miss 定義（各情境獨立）
- 四個情境各自的 target RTP

---

### 7.3 DESIGN_VIEW Tab（企劃視覺化預覽）

**目的：企劃調整 DATA tab 參數後，執行模擬，可在此 tab 直觀看到調整結果。**

由 `excel_simulator.js` 執行後自動寫入，企劃不得手動編輯。

顯示內容（四個情境各一區塊）：
- **RTP 總覽**：模擬 RTP（%）、目標 RTP、差距
- **Paytable 各配獎比例**：每種符號組合的命中率（%）、平均獎金、對 RTP 的貢獻（%）
- **期望值分解**：
  - Base spin 貢獻（%）
  - FG 觸發貢獻（%）
  - Near miss 頻率（%）
  - 0 獎比例（含 near miss 和一般 0 獎）
- **FG 倍率分佈**：各倍率回合（x3/x7/x17/x27/x77）的平均 win、命中率
- **最高獎金分佈**：>1000x / >5000x / 30000x（max win）的發生比例

**設計原則**：
- 企劃不需看程式碼，只需看此 tab 即可判斷參數是否符合設計目標
- 顏色標示：RTP 在目標 ±1% 內標綠，超出標紅

---

### 7.4 ENG_TOOLS Tab（工程工具計算用）

**目的：供 `build_config.js`、`engine_generator.js`、`verify.js` 等工具程式讀取的中間計算值。**

由 `build_config.js` 執行後自動寫入，工程師不得手動編輯。

包含（程式可直接讀取的結構化數據）：
- **已解算的賠率矩陣**：四個情境各自的實際賠率（BASE × PAYTABLE_SCALE，展開為完整矩陣）
- **Reel strip 展開表**：依各情境符號權重展開的完整 reel strip（供 RNG 取樣用）
- **連線命中率表**：各符號在各情境的理論命中機率
- **Near miss slot 數量**：各情境中已分配給 near miss 的 0 獎 spin 數量，與剩餘一般 0 獎數量
- **0 獎填充計算**：依 target RTP 反算所需 0 獎比例，拆分為 near miss 佔比與一般 0 獎佔比
- **Generator 版本戳記**：記錄此次 build 的時間與來源 Excel checksum（供 CI 比對）

**設計原則**：
- 所有欄位有固定的 cell 位址（A1, B2 等），工具程式用 cell 位址讀取，不用 sheet_to_json
- 格式變動需同步更新工具程式的讀取邏輯

---

## 8. 工具鏈架構

```
Thunder_Config.xlsx（DATA tab — 企劃編輯）
    │
    ▼
build_config.js
    ├─→ 解析 DATA tab 參數
    ├─→ 計算中間值（賠率矩陣、reel strip、0 獎填充）
    ├─→ 寫入 ENG_TOOLS tab（工程工具計算用）
    └─→ 輸出 engine_config.json（供 engine_generator.js 使用）
    │
    ▼
engine_generator.js
    ├─→ 讀 engine_config.json（或直接讀 ENG_TOOLS tab）
    └─→ 生成 assets/scripts/GameConfig.generated.ts
    │
    ▼
excel_simulator.js
    ├─→ 跑 100 萬次蒙地卡羅模擬（四情境）
    ├─→ 寫入 SIMULATION tab（驗收用）
    └─→ 寫入 DESIGN_VIEW tab（企劃視覺化預覽）
    │
    ▼
verify.js
    ├─→ 讀 SIMULATION tab 結果
    └─→ 比對 target RTP，輸出 verify_report.txt（通過才能執行 engine_generator）
```

### 8.1 GameConfig.generated.ts 包含
- 四個情境的符號權重（`SYMBOL_WEIGHTS_*`）
- Paytable（`PAYTABLE`）
- FG 倍率序列（`FG_MULTIPLIERS`）
- Coin toss 機率（`COIN_TOSS_HEADS_PROB`）
- Near miss 定義
- 保底參數（`BUY_FG_SPIN_MIN_WIN_MULT`、`BUY_FG_MIN_WIN_MULT`）
- 觸發率（`FG_TRIGGER_PROB`）

### 8.2 修改流程
```
1. 修改 Thunder_Config.xlsx DATA tab
2. node tools/slot-engine/build_config.js
3. node tools/slot-engine/engine_generator.js
4. node tools/slot-engine/excel_simulator.js   （100 萬次模擬）
5. node tools/slot-engine/verify.js            （確認四情境 RTP 通過）
6. 將 GameConfig.generated.ts 覆蓋 GameConfig.ts
7. 重新編譯 dist/，重建 K8s image
```

---

## 8. 禁止事項

| 禁止行為 | 原因 |
|---------|------|
| 在程式碼中加入 payout scale 乘數 | 破壞 Excel 的 RTP 設計 |
| 在 SlotEngine 加入 retry loop 保底 | 應由 Excel 符號權重設計 |
| 在 UI 層做任何 win 調整或保底 | win/totalWin 只來自引擎 |
| 修改 GameConfig.generated.ts（手動） | 必須透過 Excel → 工具鏈 |
| 以 session.roundWin 作為入帳或最終顯示依據 | session.roundWin 是動畫顯示計數器 |

---

## 9. 測試要求

每次修改 Excel 後，必須通過：
- `pnpm test:unit` — 四個情境的 unit test（BuyFGFlow、ExtraBetBuyFG、ProbabilityCore 等）
- 100 萬次模擬各情境 RTP 在容許誤差內（`verify.js`）
- `pnpm test:integration` — FullGameRTP simulation

---

## 10. 幣種（Currency）Bet Range 規格

### 10.1 設計原則

- 支援幣種：**USD**（美元）、**TWD**（台幣）
- 每個幣種擁有**獨立的** bet range 定義（minLevel、maxLevel、stepLevel、baseUnit）
- **Bet range 規格唯一來源：Excel DATA tab**，不允許在 `BetRangeService.ts` 或任何程式碼中硬編碼
- 工具鏈 `build_config.js` 從 Excel 讀取後產生 `BetRangeConfig.generated.ts`，
  `BetRangeService` 只讀取此產生檔，不允許直接定義數值

### 10.2 幣種換算規則

| 幣種 | baseUnit | betLevel 單位 | 範例 |
|------|----------|--------------|------|
| USD | `0.01` | 美分（cent）| betLevel 25 = $0.25 |
| TWD | `1` | 台幣元 | betLevel 10 = TWD 10 |

計算公式：`totalBet（幣值）= betLevel × baseUnit`

### 10.3 Excel DATA Tab — Bet Range 欄位

每個幣種在 DATA tab 中各有一獨立區塊，定義以下欄位：

| 欄位 | USD | TWD | 說明 |
|------|-----|-----|------|
| `BET_MIN_LEVEL` | 25 | 10 | 最小 betLevel（整數） |
| `BET_MAX_LEVEL` | 1000 | 300 | 最大 betLevel（整數） |
| `BET_STEP_LEVEL` | 25 | 10 | 每次增減的 betLevel 步進 |
| `BASE_UNIT` | 0.01 | 1 | 每個 betLevel 對應的幣值 |

玩家可見押注範圍（初始參考值，以 Excel 定義為準）：

| 幣種 | 最低押注 | 最高押注 | 步進 | Level 數 |
|------|---------|---------|------|---------|
| USD | $0.25 | $10.00 | $0.25 | 40 |
| TWD | TWD 10 | TWD 300 | TWD 10 | 30 |

> TWD 設計考量：1 USD ≈ 32 TWD；TWD 10~300（step 10）
> 對應 $0.31~$9.38，與 USD $0.25~$10.00 量級相近。

### 10.4 工具鏈產生流程

```
Excel DATA tab（BET_RANGE 區塊）
    │
    ▼
build_config.js
    └─→ 產生 assets/scripts/generated/BetRangeConfig.generated.ts
        └─→ 產生 apps/web/src/generated/BetRangeConfig.generated.ts

BetRangeService.ts
    └─→ import { BET_RANGE_CONFIG } from '../generated/BetRangeConfig.generated'
        （禁止直接定義數值）
```

產生的 `BetRangeConfig.generated.ts` 格式：
```typescript
// 自動產生 — 請勿手動修改，從 Thunder_Config.xlsx 產生
export const BET_RANGE_CONFIG = {
  USD: { baseUnit: '0.01', minLevel: 25, maxLevel: 1000, stepLevel: 25 },
  TWD: { baseUnit: '1',    minLevel: 10, maxLevel: 300,  stepLevel: 10 },
} as const;
```

### 10.5 Server 端（BetRangeService）

`BetRangeService.ts` 不得直接定義數值：
```typescript
// ✓ 正確：從 generated 檔讀取
import { BET_RANGE_CONFIG } from '../generated/BetRangeConfig.generated';

// ✗ 禁止：硬編碼在程式碼中
const USD_LEVELS = Array.from({ length: 40 }, (_, i) => (i + 1) * 25);
```

`getBetRange(currency)` 需根據設定動態建立 `levels` 陣列：
```typescript
const { minLevel, maxLevel, stepLevel, baseUnit } = BET_RANGE_CONFIG[currency];
const levels = Array.from(
  { length: Math.round((maxLevel - minLevel) / stepLevel) + 1 },
  (_, i) => minLevel + i * stepLevel,
);
```

### 10.6 Client 端（GameBootstrap）

- 啟動時呼叫 `client.fetchBetRange()` 取得當前幣種的 bet range
- Client 的 `BET_MIN`、`BET_MAX`、`BET_STEP` 從 server 回傳值設定，不依賴 `GameConfig.ts` 的靜態常數
- 幣種由 `window.__THUNDER_CONFIG.currency` 或 URL 參數（`?currency=TWD`）指定
- GameConfig.ts 中的 `BET_MIN`/`BET_MAX`/`BET_STEP` 僅作為 fallback 預設值（USD）

### 10.7 Bet Range 修改流程

```
1. 修改 Thunder_Config.xlsx DATA tab（對應幣種的 Bet Range 區塊）
2. node tools/slot-engine/build_config.js
   （重新產生 ENG_TOOLS tab + BetRangeConfig.generated.ts）
3. pnpm test:unit   （確認 bet range 相關 unit test 通過）
4. 重建 K8s image
```
