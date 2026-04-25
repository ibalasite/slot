# 專案名稱：Thunder Blessing Slot GDD

## 1. 核心概念（Elevator Pitch）

Thunder Blessing 是一款希臘神話主題的 5×3（最大5×6）老虎機遊戲，搭載 Cascade 連鎖消除、閃電標記累積、雷霆祝福 Scatter 符號轉換、Coin Toss 硬幣翻轉進入 Free Game（最高×77倍率）等核心機制。目標是為開發團隊提供完整且精確的 GDD 規格文件，使前後端工程師、企劃和 QA 均能 100% 按規格實作。

## 2. 目標使用者

- 線上博弈平台遊戲開發者（前端：Cocos/PixiJS，後端：TypeScript/Fastify）
- 遊戲企劃設計師（負責機率平衡與機制設計）
- QA 工程師（驗收引擎與前端行為）

## 3. 核心問題與解決方案

**問題**：缺乏完整且工程可執行的 GDD，導致開發過程中規格不一致、機率錯誤難以追蹤。

**解決方案**：以既有的 PDF GDD、Probability_Design.md、slot-engine EDD.md 和 engine_config.json 為基礎，整合成一份完整的 GDD 文件套件，涵蓋：

- 完整遊戲機制規格（16 個章節）
- 機率設計（目標 RTP 97.5%，四情境獨立平衡）
- slot-engine 工具鏈整合（Excel→TypeScript 生成流程）

## 4. 核心功能清單

1. **基礎滾輪系統**：5 滾輪 × 3列（初始），25 條連線，左到右判定
2. **Cascade 連鎖消除**：贏→消除→擴展滾輪（最多6列/57條），循環直到無獲獎
3. **閃電標記（Lightning Mark）**：消除位置留下標記，跨 Cascade 累積
4. **雷霆祝福 Scatter**：標記存在時落下 Scatter → 全部標記格轉同一高賠符號（2擊制）
5. **Coin Toss 硬幣翻轉**：6列＋再次Cascade→觸發翻幣→Heads進入FG，Tails結束
6. **Free Game 免費遊戲**：倍率×3→×7→×17→×27→×77，閃電標記整局累積
7. **Extra Bet**：投注額×3，保證出現 Scatter
8. **Buy Feature**：100× 投注額直接購入 Free Game
9. **機率引擎工具鏈**：Excel DATA tab → build_config.js → engine_config.json → GameConfig.generated.ts

## 5. 成功指標

- RTP 97.5%（四情境各自驗收，100萬次蒙地卡羅模擬）
- 最大獎金 30,000× 總投注額
- Cascade 循環正確（無越界、無重複計算）
- Free Game 倍率序列正確（×3→×7→×17→×27→×77）
- Buy Feature 保底：整場 ≥ 20× baseBet

## 6. 技術棧

- 後端：TypeScript / Node.js / Fastify / Clean Architecture
- 資料庫：Supabase PostgreSQL
- 快取：Redis（IoRedis / Upstash）
- 機率引擎：Excel 驅動工具鏈（tools/slot-engine/）
- 前端：Cocos Creator 或 PixiJS（待定）

## 7. 風險

1. 機率平衡複雜度：4 個情境獨立，需 verify.js 通過才能執行 engine_generator
2. Cascade 深度計算：Lightning Mark 位置需跨多步驟正確追蹤
3. Free Game 一次性回傳：單次 spin request/response 涵蓋完整 FG 序列（最多5回合）

## 8. 素材來源（Appendix）

- docs/req/GDD-Thunder-Blessing-Slot-Game.pdf（PDF GDD，20 頁，含截圖）
- docs/req/GDD_Thunder_Blessing_Slot.md（開發者版 GDD，含全機制規格）
- docs/req/Probability_Design.md（機率設計文件）
- docs/req/slot-engine-EDD.md（工程設計文件，工具鏈架構）
- docs/req/engine_config.json（實際引擎配置參數）
- /Users/tobala/projects/thunder-blessing-slot（既有實作 codebase）
