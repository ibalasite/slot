# gendoc — 對齊掃描報告

**專案：** thunder-blessing-slot-gdd  
**日期：** 2026-04-26  
**掃描範圍：** Dimension 0–5（全維度）

---

```
╔══════════════════════════════════════════════════════════════╗
║           gendoc — 對齊掃描報告                               ║
║           專案：thunder-blessing-slot-gdd  日期：2026-04-26  ║
╠══════════════════════════════════════════════════════════════╣
║  對齊層            CRITICAL  HIGH  MEDIUM  LOW  總計  狀態   ║
║  Dim 0 文件存在性       0      1      0     0     1   ⚠️     ║
║  Dim 1 Doc → Doc        2      7     11    10    30   🔴     ║
║  Dim 2 Doc → Code       0      0      0     0     0   ✅     ║
║  Dim 3 Code → Test      0      0      0     0     0   ✅     ║
║  Dim 4 Doc → Test       3      7      9     2    21   🔴     ║
║  Dim 5 UML/RTM 品質     0      0      2     0     2   ⚠️     ║
╠══════════════════════════════════════════════════════════════╣
║  總計                   5     15     22    12    54          ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Dimension 0 — 必要文件存在性

**[HIGH] MISSING: README.md**
- 根目錄缺少 README.md，開發者無法快速了解專案結構、啟動方式、文件導覽
- 可自動修復：YES（需新增 README.md）

---

## Dimension 1 — Doc → Doc 對齊問題

### CRITICAL

**[CRITICAL] D1-001: features/client/coin_toss/coin_toss_panel.feature 與 PRD §5.5 / EDD §5.6 衝突**
- TC-E2E-COIN-005：「the bar shows six multiplier nodes: ×3, ×5, ×10, ×25, ×50, ×100」
- PRD §5.5 及 EDD §5.6 明確定義：FG 倍率序列為 5 個節點 ×3→×7→×17→×27→×77，最大為 ×77
- TC-E2E-COIN-006：「advances from ×50 to ×100」、「MAX MULTIPLIER ×100」亦錯誤
- 衝突類型：B2-下游偏離（D12b Review 時引入的錯誤覆蓋了正確的上游設計）
- 可自動修復：YES（修正下游 BDD 對齊 PRD/EDD）

**[CRITICAL] D1-002: features/client/thunder_blessing/thunder_blessing_trigger.feature 機制描述根本錯誤**
- TB-001：「the Coin Toss overlay appears over the reel grid」—— Thunder Blessing 與 Coin Toss 是完全不同的機制
- PRD §5.3（US-TBSC-001）：SC 落地 → 閃電標記升級為高階符號（dual-hit 升級），無 Coin Toss
- PRD US-COIN-001：Coin Toss 由「滾輪達到 6 列且 Cascade 再次成功」觸發，與 SC 無關
- TB-002、TB-003：整個場景描述 Coin Toss HEADS/TAILS 路徑，完全屬於錯誤文件
- 衝突類型：B2-下游偏離（D12b 生成時混淆了兩個機制）
- 可自動修復：YES（重寫 TB-001~TB-004 正確描述 Thunder Blessing = SC + Lightning Mark 升級）

### HIGH

**[HIGH] D1-003: features/client/session/session_resume.feature 倍率序列錯誤**
- TC-E2E-SESS-003：「multiplier ×10」、「nodes ×3, ×5, and ×10 all filled」、「remaining nodes (×25, ×50, ×100)」
- 正確值應來自 [×3, ×7, ×17, ×27, ×77]；×10 不在序列中
- Background 中「multiplier ×5」亦不在序列中（應為 ×3 或 ×7）
- 可自動修復：YES

**[HIGH] D1-004: features/config.feature TC-INT-CURR-001c TWD 範圍錯誤**
- 目前：「TWD bet range minimum baseBet should equal 3」、「maximum baseBet should equal 600」
- PRD §5.11 AC-2、EDD §1.1：TWD min=10, max=320, step=10（40 個等級）
- 可自動修復：YES

**[HIGH] D1-005: API.md SESSION_NOT_FOUND 錯誤訊息 TTL 說法錯誤**
- API.md 某處錯誤寫入 TTL=300s
- EDD §5.3 及 SCHEMA.md §4.1：Redis session TTL = 1800s（30 分鐘）
- 可自動修復：YES（更新 API.md 中的說明）

**[HIGH] D1-006: RTM §fg_sessions 節引用章節錯誤**
- RTM 引用 §2.4 → 應為 §2.3
- 可自動修復：YES

**[HIGH] D1-007: RTM Redis key 名稱引用錯誤**
- RTM 使用 player_sessions → 應為 session:{sessionId}:state（per SCHEMA.md §4.1）
- 可自動修復：YES

**[HIGH] D1-008: features/client/coin_toss/coin_toss_panel.feature Background 觸發條件錯誤**
- Background：「the player triggered a spin that revealed an SC (Scatter) symbol」
- 正確：Coin Toss 由「rows=6 + cascade win」觸發，不是 SC 落地
- 可自動修復：YES（修正 Background 描述）

**[HIGH] D1-009: EDD §4.6 Scenario 3 標籤描述不準確**
- 目前：Scenario 3 描述可能被誤解為「Buy FG」與「Extra Bet Off」組合
- 正確標籤：「Free Game (Buy FG Off)」以區分其他 Scenario
- 可自動修復：YES

### MEDIUM

**[MEDIUM] D1-010: FRONTEND.md 缺少 UpgradedSymbolId 型別定義**
- EDD §4.6 / SCHEMA.md 中有 upgraded_symbol 欄位，FRONTEND.md 的 TypeScript 介面未定義對應型別
- 可自動修復：YES（補充型別定義）

**[MEDIUM] D1-011: EDD §5.2 未明確限制 upgraded_symbol 只允許 P1|P2|P3|P4**
- PRD 規格限制符號升級結果，EDD 技術設計應明確列出此業務規則
- 可自動修復：YES

**[MEDIUM] D1-012: runbook.md Session TTL 雙值問題**
- runbook.md 目前同時列出 300s（API.md 舊值）和 1800s（EDD/SCHEMA 正確值）
- 應統一為 1800s，並在 runbook 中說明 API.md 文件待更新
- 可自動修復：YES

**[MEDIUM] D1-013 至 D1-020: 其他 Doc→Doc 次要 MEDIUM/LOW 問題**
- ARCH.md 未明確說明 WebSocket 推送協議版本（LOW）
- VDD.md 部分動畫時序與 PDD.md 數值有小差異（LOW）
- test-plan.md 部分測試類型與 BDD Scenario 標籤未完全對應（MEDIUM）
- API.md 部分 error code 未在 EDD §3.5 中明確列舉（MEDIUM）
- RTM coverage 百分比計算公式需確認四捨五入規則（LOW）
- SCHEMA.md §4.3 rate_limit key 命名在 runbook 已修正但 API.md 文件未同步（MEDIUM）
- AUDIO.md 部分音效觸發條件與 EDD §4.6 Domain Events 映射不完整（MEDIUM）
- ANIM.md 部分動畫序列描述與 FRONTEND.md 組件設計不完全對應（MEDIUM）

---

## Dimension 2 — Doc → Code 對齊問題

**無 finding（src/ 尚未建立，屬於 pre-implementation 專案）**

---

## Dimension 3 — Code → Test 對齊問題

**無 finding（src/ 和 tests/ 尚未建立，屬於 pre-implementation 專案）**

---

## Dimension 4 — Doc → Test 對齊問題

### CRITICAL

**[CRITICAL] D4-001: TC-E2E-COIN-005 / TC-E2E-COIN-006 倍率節點數量錯誤（BDD 與 PRD 衝突）**
- coin_toss_panel.feature TC-E2E-COIN-005：六節點序列（×3/5/10/25/50/100）
- PRD AC-COIN-005：五節點序列（×3/7/17/27/77），最大 ×77
- 影響：E2E 測試驗證錯誤值，通過的測試實際上是驗證錯誤行為
- 可自動修復：YES

**[CRITICAL] D4-002: thunder_blessing_trigger.feature TB-001~TB-004 機制錯誤（驗收錯誤行為）**
- TB-001~TB-004 描述「Thunder Blessing → Coin Toss 出現」的錯誤觸發鏈
- 正確：Thunder Blessing = SC + Lightning Marks → 升級為高階符號，完全無 Coin Toss
- 若測試按此 feature file 實作，會驗收一個不存在的系統行為
- 可自動修復：YES（重寫 TB-001~TB-004）

**[CRITICAL] D4-003: session_resume.feature TC-E2E-SESS-003 使用無效倍率值**
- 「multiplier ×10」不存在於 FG 倍率序列，亦無對應的 progress bar 節點
- 測試驗收的 UI 狀態（×3/5/10 filled, ×25/50/100 dimmed）是不可能出現的系統狀態
- 可自動修復：YES

### HIGH

**[HIGH] D4-004: features/config.feature TC-INT-CURR-001c 斷言錯誤 TWD 數值**
- 測試斷言 TWD min=3、max=600，與 EDD/PRD 定義的 min=10、max=320 衝突
- 若按此 feature file 驗收，API 回傳正確的 10/320 反而會造成測試失敗
- 可自動修復：YES

**[HIGH] D4-005 至D4-010: 其他 HIGH 問題**
- session.feature TC-INT-API-012b: totalFGWin 欄位 boundary check 缺少負值保護（HIGH）
- spin.feature 缺少 rows=6 觸發 Coin Toss 的完整 E2E 場景（HIGH）
- buy-feature.feature 缺少 BuyFeature 後直接進入 FG 不經 Coin Toss 的場景（HIGH）
- probability-engine.feature 部分 AC 未完整覆蓋 FG 倍率序列五節點（HIGH）
- security.feature TC-SEC-BET-003 totalWin 驗證場景，server 端 total_win 欄位名稱已確認為 spins.total_win（HIGH）
- extra-bet.feature 缺少 ExtraBet + SC 同時觸發 Thunder Blessing 的完整場景（HIGH）

### MEDIUM

**[MEDIUM] D4-011: RTM 引用 Scenario ID 部分指向已修改場景**
- RTM 中部分 TC-ID 與當前 feature file 中的 @tag 不完全對應
- 影響 RTM 追溯完整性，但不影響功能正確性
- 可自動修復：YES（更新 RTM TC-ID 引用）

**[MEDIUM] D4-012 至D4-019: 其他 MEDIUM/LOW 問題**
- BDD client feature files 中部分場景缺少 @contract tag（MEDIUM）
- BDD server feature files 缺少 @regression tag 標記（MEDIUM）
- 部分 Background 條件過於簡化（MEDIUM）
- 少數 Scenario 步驟措辭與 FRONTEND.md 術語不一致（LOW）
- cascade.feature 部分場景未覆蓋 6-row cascade 觸發條件（MEDIUM）
- free_game.feature 缺少 FG session 中 reconnect 後 multiplier 正確顯示的 server 端驗證（MEDIUM）

---

## Dimension 5 — UML/RTM 品質

**[MEDIUM] D5-001: docs/diagrams/puml/ 缺少 PlantUML .puml 檔案**
- docs/diagrams/ 目錄中只有 Mermaid 格式圖表，缺少對應的 .puml 原始碼輸出
- 可自動修復：NO（需執行 gendoc-gen-diagrams 補充，或手動轉換）

**[MEDIUM] D5-002: docs/RTM.csv 不存在（缺少機器可讀 RTM）**
- RTM.md 有完整內容，但缺少 CSV 格式的機器可讀版本供 CI 使用
- 可自動修復：YES（從 RTM.md 表格提取轉換）

---

## 修復優先級清單（D16-ALIGN-F 執行順序）

### P0 — CRITICAL（立即修復）

1. **fix-bdd-coin-toss-multiplier**: coin_toss_panel.feature TC-E2E-COIN-005/006 倍率序列 ×3/5/10/25/50/100 → ×3/7/17/27/77，6 nodes → 5 nodes
2. **fix-bdd-thunder-blessing-mechanic**: thunder_blessing_trigger.feature TB-001~TB-004 移除 Coin Toss，改為正確的 SC + Lightning Mark 升級描述
3. **fix-bdd-session-multiplier**: session_resume.feature TC-E2E-SESS-003 + Background 使用正確倍率值
4. **fix-bdd-config-twd**: config.feature TC-INT-CURR-001c TWD min=3/max=600 → min=10/max=320

### P1 — HIGH（本輪修復）

5. **fix-api-session-ttl**: API.md SESSION_NOT_FOUND 相關描述統一為 1800s
6. **fix-rtm-section-ref**: RTM §2.4 → §2.3，player_sessions → session:{sessionId}:state
7. **fix-coin-toss-background**: coin_toss_panel.feature Background 觸發條件（SC → rows=6+cascade win）
8. **add-readme**: 新增根目錄 README.md

### P2 — MEDIUM（本輪修復）

9. **fix-edd-scenario3-label**: EDD Scenario 3 標籤改為「Free Game (Buy FG Off)」
10. **add-frontend-type**: FRONTEND.md 補充 UpgradedSymbolId 型別
11. **fix-rtm-csv**: 從 RTM.md 提取生成 RTM.csv

---

*此報告由 gendoc-align-check 生成，供 D16-ALIGN-F auto-fix 讀取使用。*
