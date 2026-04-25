# VDD — Visual Design Document
# Thunder Blessing Slot Game

---

## §0 Document Control

| 欄位 | 內容 |
|------|------|
| **DOC-ID** | VDD-THUNDERBLESSING-20260426 |
| **產品名稱** | Thunder Blessing Slot Game |
| **文件版本** | v1.0 |
| **狀態** | DRAFT |
| **作者** | AI Generated (gendoc-gen agent) |
| **日期** | 2026-04-26 |
| **上游文件** | IDEA.md, BRD.md, PRD.md, PDD.md v1.0, engine_config.json |
| **審閱者** | Art Director, UI/UX 設計師 |
| **核准者** | Art Director, Engineering Lead |

### Change Log

| 版本 | 日期 | 作者 | 變更摘要 |
|------|------|------|---------|
| v1.0 | 2026-04-26 | AI Generated | 初始生成，精化 PDD §11–§14 視覺規格 |

### 與 PDD 的關係

| 維度 | PDD | VDD |
|------|-----|-----|
| 定義層次 | 「設計什麼」 | 「怎麼做到視覺品質」 |
| 色彩 | 色名 + HEX + 粗略 OKLCH | 精確 OKLCH + sRGB HEX + CSS Token |
| 動畫 | 時長描述 + 大略 easing | cubic-bezier 精確值 + Keyframe 表 |
| 特效 | 性質描述 | 粒子預算 + Blend Mode + Shader 參數 |
| 資源 | 格式列表 | 壓縮設定 + 輸出 pipeline 規格 |

---

## §1 Visual Identity System（視覺識別系統）

### 1.1 品牌色板

以 PDD §11 為基礎，提供工程可直接使用的精確色值。所有色彩以 OKLCH 為主色空間，同時提供 sRGB HEX 供 Photoshop / Spine 工作流程使用。

#### Primary Palette（主色）

| Token 名稱 | OKLCH | sRGB HEX | CMYK（印刷參考） | 用途 |
|-----------|-------|----------|----------------|------|
| `--color-gold-primary` | `oklch(75% 0.14 80)` | `#C9A227` | C0 M37 Y85 K8 | 主框架、按鈕描邊、Win 連線 |
| `--color-gold-bright` | `oklch(85% 0.17 88)` | `#FFD700` | C0 M16 Y100 K0 | Win 數字、閃電標記、HIGH LIGHT |
| `--color-gold-divine` | `oklch(91% 0.14 88)` | `#FFE55C` | C0 M10 Y64 K0 | Divine Lightning Wild 外光暈 |
| `--color-blue-olympus` | `oklch(22% 0.06 250)` | `#1B2A4A` | C64 M43 Y0 K71 | 主背景色、HUD 底色 |
| `--color-blue-deep` | `oklch(14% 0.04 253)` | `#0A0F1E` | C72 M55 Y0 K88 | 最深背景層、遮罩底色 |
| `--color-purple-zeus` | `oklch(25% 0.12 300)` | `#4A1B6B` | C53 M83 Y0 K58 | FG 場景副色、Buy FG 按鈕 |

#### Secondary Palette（次色）

| Token 名稱 | OKLCH | sRGB HEX | 用途 |
|-----------|-------|----------|------|
| `--color-marble-white` | `oklch(95% 0.01 80)` | `#F5F0E8` | 對話框文字、主文字 |
| `--color-orange-thunder` | `oklch(68% 0.18 55)` | `#FF8C00` | Extra Bet ON、Near Miss 高亮 |
| `--color-arc-white` | `oklch(96% 0.02 228)` | `#E8F4FF` | 電弧粒子、Scatter 外光 |
| `--color-fg-blue` | `oklch(75% 0.12 220)` | `#00BFFF` | FG 倍率進度條填充 |

#### Functional Palette（功能色）

| Token 名稱 | OKLCH | sRGB HEX | 用途 |
|-----------|-------|----------|------|
| `--color-error` | `oklch(43% 0.18 28)` | `#D32F2F` | 系統錯誤、Tails 文字 |
| `--color-disabled` | `oklch(50% 0 0)` | `#757575` | 禁用按鈕 |
| `--color-success` | `oklch(60% 0.16 145)` | `#2E8B57` | 餘額增加提示 |
| `--color-warning` | `oklch(75% 0.18 65)` | `#FFA500` | 低餘額警示、L2 符號色 |

#### Symbol Palette（符號專屬色）

| 符號 | Token 名稱 | OKLCH | sRGB HEX |
|------|-----------|-------|----------|
| Wild（Divine Lightning）| `--color-sym-wild` | `oklch(88% 0.19 92)` | `#FFD700` |
| P1 Zeus | `--color-sym-p1` | `oklch(88% 0.19 92)` | `#FFD700` |
| Scatter | `--color-sym-scatter-inner` | `oklch(96% 0.02 228)` | `#E8F4FF` |
| Scatter 電弧 | `--color-sym-scatter-arc` | `oklch(52% 0.18 240)` | `#1A6EBF` |
| P2 Pegasus | `--color-sym-p2` | `oklch(82% 0.08 300)` | `#D4BBFF` |
| P3 Athena | `--color-sym-p3` | `oklch(77% 0.05 235)` | `#B0C4DE` |
| P4 Eagle | `--color-sym-p4` | `oklch(70% 0.12 76)` | `#DAA520` |
| L1 Z | `--color-sym-l1` | `oklch(88% 0.19 88)` | `#FFD700` |
| L2 E | `--color-sym-l2` | `oklch(72% 0.18 55)` | `#FFA500` |
| L3 U | `--color-sym-l3` | `oklch(60% 0.12 56)` | `#CD7F32` |
| L4 S | `--color-sym-l4` | `oklch(46% 0.10 68)` | `#8B6914` |

### 1.2 設計 Token 命名系統

以 CSS custom property 風格定義，供前端（PixiJS Filter / Cocos Material）直接引用：

```css
:root {
  /* Primary */
  --color-gold-primary:    oklch(75% 0.14 80);
  --color-gold-bright:     oklch(85% 0.17 88);
  --color-gold-divine:     oklch(91% 0.14 88);
  --color-blue-olympus:    oklch(22% 0.06 250);
  --color-blue-deep:       oklch(14% 0.04 253);
  --color-purple-zeus:     oklch(25% 0.12 300);

  /* Functional */
  --color-marble-white:    oklch(95% 0.01 80);
  --color-orange-thunder:  oklch(68% 0.18 55);
  --color-arc-white:       oklch(96% 0.02 228);
  --color-fg-blue:         oklch(75% 0.12 220);
  --color-error:           oklch(43% 0.18 28);
  --color-disabled:        oklch(50% 0 0);

  /* Animation tokens */
  --duration-snap:         80ms;
  --duration-fast:         150ms;
  --duration-normal:       300ms;
  --duration-slow:         600ms;
  --duration-cascade-drop: 420ms;
  --duration-coin-flip:    2800ms;

  --ease-out-cubic:        cubic-bezier(0.33, 1, 0.68, 1);
  --ease-out-back:         cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-expo:         cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-cubic:     cubic-bezier(0.65, 0, 0.35, 1);
  --ease-coin-decel:       cubic-bezier(0.05, 0.7, 0.1, 1.0);
}
```

### 1.3 視覺一致性規則（禁止用色清單）

| 禁止行為 | 原因 |
|---------|------|
| 使用純黑 `#000000` 作為背景 | 品牌背景色為 `--color-blue-deep`，純黑破壞深海藍氛圍 |
| 使用飽和度 > 0.25 的 OKLCH 色彩用於 UI 底色 | 過飽和背景會搶奪符號視覺注意力 |
| 使用 `#FF0000` 正紅色用於 Win 展示 | 品牌 Win 色為金色系，正紅色傳遞錯誤感 |
| 在暗背景使用 OKLCH lightness < 40% 的文字 | 對比不足，違反 WCAG AA |
| 對 FG 進度條使用非 `--color-fg-blue` 色系 | 破壞倍率進度的視覺編碼一致性 |
| 混用 sRGB 與 Display P3 色域符號資源 | 在 P3 螢幕上色偏不可預測 |

---

## §2 Typography Specification（字體規格精化）

### 2.1 字體家族與 Load 策略

| 用途分組 | 字體名稱 | 格式 | Subset | font-display |
|---------|---------|------|--------|-------------|
| WIN 數字主字體 | Trajan Pro（若未取得授權，可以 Orbitron 作為備援；最終選型需 Art Director 確認）| WOFF2 | 數字 `0–9` + `$,. ×` | `swap` |
| WIN 大獎展示備用 | Impact（系統字）| 系統 | — | — |
| HUD 標籤 | Open Sans | WOFF2 | Latin + `$,.%×` | `swap` |
| 符號銘文底部 | Cinzel | WOFF2 | A–Z uppercase only | `optional` |
| BIG WIN / JACKPOT 特效文字 | 自訂 Display 字體（GreeK-Display）（佔位符命名，最終字體需確認商業授權，TBD 待 Art Director 確認）| WOFF2 | 大寫 A–Z + `!×` | `swap` |
| 對話框內文 | Open Sans | WOFF2 | 同 HUD | `swap` |

> **選型說明（WIN 數字）**：Orbitron 的幾何圓弧感與希臘神話的「電能科技」風格契合，同時在高對比背景下數字間距清晰，適合快速滾動的計數動畫。備選 Impact 作為系統字降級。

### 2.2 完整 Type Scale 表（1920×1080 基準）

| 元素 | Token | px 值 | em（基於 16px root） | 字重 | 字距（letter-spacing） | 行高（line-height） |
|------|-------|------:|--------------------:|:----:|:-------------------:|:-----------------:|
| WIN 數字 Small | `--text-win-sm` | 32px | 2.0em | 700 | 0.02em | 1.2 |
| WIN 數字 Medium | `--text-win-md` | 56px | 3.5em | 700 | 0.01em | 1.1 |
| WIN 數字 Big | `--text-win-lg` | 96px | 6.0em | 700 | 0em | 1.0 |
| WIN 數字 Mega | `--text-win-xl` | 144px | 9.0em | 700 | -0.01em | 1.0 |
| WIN 數字 Jackpot | `--text-win-2xl` | 200px | 12.5em | 700 | -0.02em | 1.0 |
| HUD 主要數值 | `--text-hud-value` | 22px | 1.375em | 600 | 0.02em | 1.4 |
| HUD 標籤 | `--text-hud-label` | 14px | 0.875em | 400 | 0.05em | 1.5 |
| 按鈕標籤 | `--text-btn` | 16px | 1.0em | 600 | 0.08em | 1.3 |
| 符號銘文 | `--text-symbol` | 13px | 0.8125em | 400 | 0.06em | 1.2 |
| FREE 字母 | `--text-free` | 40px | 2.5em | 700 | 0.1em | 1.0 |
| 倍率顯示 ×3–×17 | `--text-mult-mid` | 52px | 3.25em | 700 | 0em | 1.0 |
| 倍率顯示 ×27–×77 | `--text-mult-max` | 72px | 4.5em | 700 | -0.02em | 1.0 |
| CASCADE × N 浮字 | `--text-cascade` | 36px | 2.25em | 700 | 0.04em | 1.0 |
| 對話框標題 | `--text-dialog-title` | 28px | 1.75em | 700 | 0.02em | 1.3 |
| 對話框內文 | `--text-dialog-body` | 18px | 1.125em | 400 | 0em | 1.6 |
| 計數器數字 | `--text-counter` | 24px | 1.5em | 600 | 0.02em | 1.3 |

### 2.3 WIN 數字動畫字體規格

使用 **Trajan Pro Bold**（備援字體 Orbitron Bold；最終選型需 Art Director 確認）配合以下動畫規格：

- 數字 roll-up 期間啟用 `font-variant-numeric: tabular-nums`（等寬數字，防止版面抖動）
- 計數器滾動結束後 0.1s 播放 `scale(1.0 → 1.08 → 1.0)` 彈跳（duration: 200ms，ease-out-back）
- 超過 Big Win（20× BET）時，字體色從 `--color-gold-bright` 過渡至 `--color-gold-divine`（漸層動畫，0.3s）

---

## §3 Icon & Symbol Visual Specs（符號視覺精確規格）

### 3.1 Canvas 符號尺寸系統（1920×1080 基準）

格子渲染尺寸：190×190px（含 10px 間距後符號可用區域）

| 符號分組 | 設計源尺寸 | 渲染尺寸 | 格子佔比 | 留邊（單側） | 含出血設計尺寸 |
|---------|:--------:|:------:|:------:|:---------:|:-----------:|
| Wild / Scatter | 200×200px | 171×171px | 90% | 5% (9.5px) | 220×220px |
| P1 / P2 / P3 / P4 | 180×180px | 162×162px | 85% | 7.5% (14px) | 200×200px |
| L1 / L2 / L3 / L4 | 160×160px | 144×144px | 76% | 12% (23px) | 180×180px |

> **留邊設計意圖**：Wild / Scatter 更大佔比強化視覺層級；Low 符號較小留邊讓多符號同框時不顯擁擠。

### 3.2 符號色調規格與關鍵渲染參數

| 符號 | 主色 Token | 輔色 Token | 外光暈 | Bloom 半徑 | 陰影 |
|------|-----------|-----------|-------|:----------:|------|
| Wild（Divine Lightning）| `--color-gold-divine` | `--color-arc-white` | 白金放射光，半徑 24px | 16px | drop-shadow(0 4px 12px rgba(255,215,0,0.6)) |
| Scatter | `--color-arc-white` | `--color-sym-scatter-arc` | 藍白電弧光，半徑 20px | 14px | drop-shadow(0 4px 16px rgba(26,110,191,0.7)) |
| P1 Zeus | `--color-sym-wild` | `--color-gold-primary` | 帝王金放射光，半徑 18px | 12px | drop-shadow(0 3px 10px rgba(255,215,0,0.5)) |
| P2 Pegasus | `--color-sym-p2` | `--color-purple-zeus` | 紫金柔光，半徑 14px | 8px | drop-shadow(0 3px 8px rgba(212,187,255,0.4)) |
| P3 Athena | `--color-sym-p3` | `--color-arc-white` | 銀藍冷光，半徑 12px | 6px | drop-shadow(0 2px 8px rgba(176,196,222,0.4)) |
| P4 Eagle | `--color-sym-p4` | `--color-gold-primary` | 琥珀暖光，半徑 10px | 6px | drop-shadow(0 2px 6px rgba(218,165,32,0.4)) |
| L1–L4 | 各 `--color-sym-l*` | — | 無外光暈 | 0px | drop-shadow(0 1px 4px rgba(0,0,0,0.5)) |

### 3.3 Spine 骨骼動畫幀率規格

| 動畫狀態 | 所有符號幀率 | 最大幀數（預算） | 備註 |
|---------|:----------:|:-----------:|------|
| Idle（loop） | 24fps | 96幀（4s@24fps）| 桌面播放；行動裝置降至 12fps |
| Win | 60fps | 90幀（1.5s@60fps）| Wild=72幀(1.2s) / P1=90幀(1.5s) / P2=78幀(1.3s) / P3=72幀(1.2s) / P4=60幀(1.0s) / L1-L4=48幀(0.8s) |
| Special（升階） | 60fps | 150幀（2.5s@60fps）| Wild Special 最長 |

> **Spine 版本要求**：≥ 4.1；Spine Runtime 需與前端框架（Cocos Creator 3.x / PixiJS 7.x）版本對齊。
> **Atlas 規格**：每個符號獨立 atlas，最大 2048×2048px，啟用 `premultipliedAlpha`。

### 3.4 多解析度輸出規格

| 輸出倍率 | 用途 | Wild/SC 尺寸 | P 類尺寸 | L 類尺寸 |
|:-------:|------|:----------:|:------:|:------:|
| 1× | 低端行動裝置（768px 以下）| 220×220px | 200×200px | 180×180px |
| 2× | 主流桌面 / 中高端行動裝置 | 440×440px | 400×400px | 360×360px |
| 3× | 2K / Retina 顯示器 | 660×660px | 600×600px | 540×540px |

---

## §4 Animation Timing System（動畫時序系統）

### 4.1 全域動畫 Token

所有動畫均從以下 Token 派生，禁止在動畫中硬編碼數值：

| Token | 值 | 說明 |
|-------|:--:|------|
| `--duration-snap` | 80ms | 即時響應（按鈕點擊） |
| `--duration-fast` | 150ms | 快速過渡（toggle、hover） |
| `--duration-normal` | 300ms | 標準動畫 |
| `--duration-slow` | 600ms | 強調動畫 |
| `--ease-out-cubic` | `cubic-bezier(0.33, 1, 0.68, 1)` | 通用滑出 |
| `--ease-out-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 彈跳落定 |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | 符號擴展 |
| `--ease-in-out-cubic` | `cubic-bezier(0.65, 0, 0.35, 1)` | 進度條填充 |
| `--ease-coin-decel` | `cubic-bezier(0.05, 0.7, 0.1, 1.0)` | 硬幣翻轉減速（Y2=1.0 線性結尾，硬幣停止效果；需設計師在動畫工具預覽確認物理感）|

### 4.2 符號落下動畫（Cascade Drop）

| 階段 | 屬性 | 起始值 | 結束值 | 時長 | Easing |
|------|------|--------|--------|------|--------|
| 落下 | `translateY` | -200px（滾輪頂端外） | 0px | 420ms | `--ease-out-cubic` |
| 落下 | `opacity` | 0 | 1 | 100ms | linear |
| 落定彈跳 | `scale` | 1.0 | 1.05 → 1.0 | 150ms | `--ease-out-back` |
| 階梯延遲 | `delay` | col×20ms + row×30ms | — | — | — |

> 5 滾輪 × 6 列最大延遲：col 4 × 20ms + row 5 × 30ms = 230ms（符號依序落下）

### 4.3 符號消除爆炸動畫

| 階段 | 屬性 | 起始值 | 結束值 | 時長 | Easing |
|------|------|--------|--------|------|--------|
| 符號縮小 | `scale` | 1.0 | 0.0 | 200ms | `ease-in` |
| 碎片飛散 | 粒子 translateX/Y | 0 | ±80px（隨機） | 400ms | `ease-out` |
| 碎片透明 | `opacity` | 1.0 | 0.0 | 300ms（delay 100ms）| linear |
| 格子透明 | `opacity` | 1.0 | 0.0 | 80ms | linear |
| **雷霆祝福消除** | 電弧爆炸 scale | 0.5 | 2.5（外溢 20%）| 600ms | `--ease-out-expo` |

### 4.4 滾輪行數擴展動畫

| 階段 | 屬性 | 起始值 | 結束值 | 時長 | Easing |
|------|------|--------|--------|------|--------|
| 框架高度延伸 | `scaleY` transform | 當前 | 當前 + 200px | 300ms | `--ease-out-cubic` |
| 雲霧消散 | `opacity` | 1.0 | 0.0 | 250ms | linear |
| 新列淡入 | `opacity` | 0.0 | 1.0 | 300ms（delay 200ms）| linear |
| FREE 字母點亮 | `brightness` | 0.3 | 1.0 | 200ms | `--ease-out-cubic` |
| FREE 字母 scale | `scale` | 0.8 | 1.15 → 1.0 | 300ms | `--ease-out-back` |

### 4.5 Coin Toss 翻轉動畫

| 階段 | 屬性 | 值 | 時長 | Easing |
|------|------|----|------|--------|
| 硬幣飛入 | `translateY`: -800px → 0 | — | 500ms | `--ease-out-cubic` |
| 加速旋轉 | `rotateY`: 0° → 2520°（7圈）| — | 800ms | `ease-in` |
| 持續旋轉 | `rotateY`: 繼續至 3960°–4320°（隨機 11–12圈）| — | 1000ms | linear |
| 減速停止 | `rotateY`: 繼續至最終面 | — | 1500ms | `--ease-coin-decel` |
| **總時長** | — | — | 2500ms–3500ms（隨機）| — |
| 結果爆光（Heads）| `scale`: 1.0 → 1.3 → 1.0 | `opacity` glow: 0→1→0 | 600ms | `--ease-out-back` |
| 結果暗沉（Tails）| `brightness`: 1.0 → 0.6 | — | 400ms | `--ease-in-out-cubic` |

### 4.6 FG 場景切換

| 階段 | 屬性 | 時長 | Easing | 備註 |
|------|------|------|--------|------|
| 舊場景溶解 | `opacity`: 1→0 | 800ms | linear | Cross-dissolve 前半 |
| 新場景淡入 | `opacity`: 0→1 | 800ms（delay 400ms）| linear | Cross-dissolve 後半 |
| FG 標題橫幅落下 | `translateY`: -200px → 0 | 600ms | `--ease-out-cubic` | delay 1200ms |
| 倍率數字展示 | `scale`: 0→2→1 | 800ms | `--ease-out-back` | delay 1800ms |

### 4.7 Win 數字 Roll-up

| 參數 | 規格 |
|------|------|
| 滾動算法 | `requestAnimationFrame`，每幀增量 = `(目標值 - 當前值) × 0.15`（exponential decay） |
| 最長滾動時長 | `min(totalWin / 50, 5000)ms`（單位：ms；totalWin 單位：BET 倍數） |
| 最短滾動時長 | 200ms（Small Win，確保動畫可見） |
| 數字格式更新幀率 | 每幀更新（不限制更新頻率） |
| 結束彈跳 | `scale: 1.0 → 1.08 → 1.0`，200ms，`--ease-out-back` |
| Easing 曲線 | `--ease-out-expo`（前 70% 快速，後 30% 緩降至精確值） |

### 4.8 FG Multiplier 進度條色彩過渡

依 PDD §6.4 修正，進度條節點顏色精確值：

| 節點 | 倍率 | Heads 機率 | 節點色（OKLCH） | 連線色 |
|:----:|:---:|:---------:|:-------------:|:------:|
| 1 | ×3 | 80% | `oklch(60% 0.16 145)` #2E8B57 | 連接 1→2：`oklch(78% 0.17 88)` 黃 |
| 2 | ×7 | 68% | `oklch(80% 0.18 88)` #FFD040 | 連接 2→3：`oklch(78% 0.17 88)` 黃 |
| 3 | ×17 | 56% | `oklch(75% 0.18 65)` #FFA500 | 連接 3→4：`oklch(68% 0.18 45)` 橙 |
| 4 | ×27 | 48% | `oklch(62% 0.20 30)` #E85C1A | 連接 4→5：`oklch(55% 0.22 25)` 橘紅 |
| 5 | ×77 | 40% | `oklch(48% 0.24 18)` #CC2200 | 連接 5：紅色電弧 |

> 進度線從綠→黃→黃橙→橙→紅漸進，對應 Heads 機率 80%→68%→56%→48%→40%，視覺傳達難度遞增。

---

## §5 Shader & Visual Effect Specs（Shader 與特效規格）

### 5.1 閃電電弧效果（Lightning Mark & Thunder Blessing）

#### 閃電標記（持續態）

| 參數 | 規格 |
|------|------|
| 粒子系統類型 | Sprite Sheet Particle（PNG Sprite） |
| 每格粒子數（靜態態） | 6–12 個（依裝置能力動態調整） |
| 粒子速度 | 20–60px/s，隨機方向，上方偏向性（cos bias） |
| 粒子生命週期 | 0.4s–0.8s |
| 粒子色 | `--color-gold-bright`（50%）+`--color-arc-white`（50%），隨機混合 |
| Blend Mode | `Additive`（亮度疊加，避免壓暗底層符號） |
| 透明度 | 整體 overlay opacity：0.6（讓底層符號仍可辨識） |
| Z-order | 符號層上方，連線高亮層下方 |

#### Thunder Blessing 引爆特效

| 參數 | 規格 |
|------|------|
| 引爆瞬間粒子數 | 每個標記格 80–120 個（電弧爆炸粒子） |
| 全盤同時引爆最大粒子數 | 550 個（桌面上限，30 格 × 18 粒子均值）|
| 粒子速度 | 80–400px/s，外放射 |
| 粒子生命週期 | 0.3s–1.0s |
| 電弧連線效果 | SC 到每個標記格：Bezier 曲線電弧 renderer，寬度 2px，色 `--color-arc-white`，Additive Blend |
| 背景白光閃爍 | `brightness: 1→3→1`，duration: 300ms，Overlay 層 |
| 行動裝置降級 | 粒子數減半至最大 275 個；電弧連線省略（改為簡單 Flash） |

### 5.2 符號 Win 高亮效果

| 參數 | 規格 |
|------|------|
| Bloom 強度 | Low（L類）: 0.2；Mid（P4/P3）: 0.5；High（P2/P1）: 0.8；Wild/SC: 1.2 |
| Outline 寬度 | 2px（L類）；4px（P類）；6px（Wild/SC） |
| Outline 色 | 對應符號主色 Token（見 §3.2） |
| Bloom 半徑 | 對應 §3.2 各符號規格 |
| Win Flash 頻率 | 每 0.8s 循環一次（連線輪播節拍） |
| Blend Mode | Screen（Bloom 層）+ Normal（Outline 層） |

### 5.3 背景視差層速度規格

精化 PDD §3.2，提供精確 Parallax ratio：

| 層次 | 元素 | Parallax Ratio | 移動觸發方式 |
|:----:|------|:-------------:|------------|
| 0 | 天空漸層 | 0（靜止）| 不移動 |
| 1 | 遠景雲層 | 0.05 | 自動橫向漂移，速度 8px/s；Thunder Blessing 觸發：加速至 40px/s（1s 後回速）|
| 2 | 奧林匹斯山 | 0.10 | 鼠標或觸控 gyro 驅動 |
| 3 | 帕德嫩神殿（遠）| 0.20 | 同上 |
| 4 | 神殿前景柱 | 0.40 | 同上 |
| 5 | 滾輪 + 符號 | 1.0（固定）| 不隨 parallax 移動 |

> 行動裝置無 mousemove，層 2–4 改用 Gyroscope API（`DeviceOrientationEvent`），傾斜角度映射至 ±15px 位移。

### 5.4 粒子預算（Particle Budget）

全遊戲同時最大粒子數限制：

| 場景 | 桌面上限 | 行動裝置上限 |
|------|:-------:|:---------:|
| 平常 Idle（所有標記）| 120 個 | 60 個 |
| Cascade 消除（單次）| 200 個 | 100 個 |
| Thunder Blessing 引爆 | 550 個 | 275 個 |
| Big Win / Mega Win 粒子 | 300 個 | 150 個 |
| FG Bonus ×100 全屏特效 | 3000 個（3s 爆發，允許超預算）| 800 個 |
| MAX WIN 30,000× 金幣雨 | 2000 個 | 600 個 |
| **絕對瞬時上限** | **500 個** | **200 個** |

> **特殊例外**：FG Bonus ×100 特殊演出期間例外允許桌面最高 1000 粒子（短時間爆發，由效能測試驗證後可調整）。此上限對齊 PDD §14.2；Thunder Blessing 引爆場景的高粒子數為局部爆發峰值，瞬時超出後立即透過「舊粒子提前 fade-out」回收策略壓回上限。

> 超出上限時，採用「舊粒子提前 fade-out」回收策略，禁止拒絕新粒子生成。

### 5.5 Bloom / Glow Shader 參數

使用 PixiJS `KawaseBlurFilter` 或 Cocos Creator `BloomEffect`：

| 參數 | Wild/SC | P1/P2 | P3/P4 | L類 |
|------|:-------:|:-----:|:-----:|:---:|
| Blur 半徑（radius）| 16px | 10px | 6px | 0px |
| Blur 迭代次數（quality）| 4 | 3 | 2 | 0 |
| 亮度增益（strength）| 1.5 | 1.2 | 1.0 | — |
| Blend Mode | Screen | Screen | Screen | — |

---

## §6 Screen Layout Pixel Specs（屏幕佈局像素規格）

### 6.1 1920×1080 基準佈局精確 Pixel 值

#### 滾輪主體

| 元素 | X（左邊距）| Y（頂邊距）| W（寬）| H（高，3列基準）|
|------|:---------:|:---------:|:-----:|:--------------:|
| 滾輪容器（外框） | 460px | 80px | 1000px | 590px |
| 單格格子（含間距）| — | — | 200px | 200px |
| 格子可渲染區（扣間距）| +5px offset | +5px offset | 190px | 190px |
| 格子間距（水平）| — | — | 10px | — |
| 格子間距（垂直）| — | — | — | 10px |

> 5 格滾輪：460 + 5 × 200 = 1460px（右邊到 1460px，留右側 460px 給背景）。
> 3 列總高：3 × 200 - 10 = 590px（最後一列不加間距）。

#### 各列數下滾輪高度

| 列數 | 滾輪 H | Y 底邊 |
|:----:|:------:|:------:|
| 3 | 590px | 670px |
| 4 | 780px | 860px |
| 5 | 970px | 1050px |
| 6 | 1160px | 1240px（超出 1080px → 底部遮罩 + 特效遮蔽）|

> 6 列時底部超出屏幕，設計意圖：滾輪「突破天際」視覺效果，底部以雲霧遮蔽。

#### HUD 底部工具列

| 元素 | X | Y（top）| W | H |
|------|:-:|:-------:|:-:|:-:|
| HUD 底部容器 | 0px | 914px | 1920px | 166px |
| BALANCE 標籤 | 60px | 924px | 160px | 20px |
| BALANCE 值 | 60px | 948px | 200px | 30px |
| WIN 標籤 | 440px | 924px | 100px | 20px |
| WIN 值 | 420px | 948px | 160px | 36px |
| BET 標籤 | 780px | 924px | 80px | 20px |
| BET 值 | 770px | 948px | 130px | 28px |
| LINES 標籤 | 980px | 924px | 80px | 20px |
| LINES 值 | 975px | 948px | 100px | 24px |
| BET − 按鈕 | 1200px | 934px | 48px | 48px |
| BET + 按鈕 | 1320px | 934px | 48px | 48px |
| EXTRA BET 開關 | 1400px | 930px | 160px | 56px |
| SPIN 按鈕（圓形）| 1630px（center）| 970px（center）| 100px（直徑）| 100px |
| AUTO 按鈕 | 1760px | 940px | 140px | 50px |
| BUY FG 按鈕 | 1760px | 940px | 140px | 50px |

> **AUTO 與 BUY FG 互斥顯示說明**：AUTO 按鈕與 BUY FG 按鈕採互斥顯示——Main Game 期間顯示 BUY FG 按鈕，BUY FG 按鈕隱藏時 AUTO 按鈕出現在相同位置（X=1760px, Y=940px）。兩者佔用相同空間（W=140px, H=50px），不可同時可見。

#### HUD 頂部工具列

| 元素 | X | Y | W | H |
|------|:-:|:-:|:-:|:-:|
| INFO 按鈕 | 20px | 20px | 48px | 48px |
| SOUND 按鈕 | 80px | 20px | 48px | 48px |
| LINES 顯示（頂部）| 850px | 24px | 160px | 36px |
| SETTINGS 按鈕 | 1852px | 20px | 48px | 48px |

#### FREE 字母進度指示器

| 元素 | X（center per letter）| Y | W | H |
|------|:--------------------:|:-:|:-:|:-:|
| F 字母 | 814px | 50px | 40px | 50px |
| R 字母 | 861px | 50px | 40px | 50px |
| E（第 3 個）| 908px | 50px | 40px | 50px |
| E（第 4 個）| 955px | 50px | 40px | 50px |

#### 閃電標記計數器

| 元素 | X | Y | W | H |
|------|:-:|:-:|:-:|:-:|
| 計數器容器 | 1465px | 90px | 120px | 48px |
| 閃電圖示 | 1470px | 100px | 24px | 24px |
| 計數數字 | 1510px | 96px | 60px | 36px |

### 6.2 安全邊距（Safe Margin）

| 平台 | 上 | 下 | 左 | 右 |
|------|:-:|:-:|:-:|:-:|
| 桌面（1920×1080）| 20px | 20px | 20px | 20px |
| iOS 橫屏（含 Home Indicator）| 20px | 54px | 44px | 44px |
| iOS 直屏（含動態島）| 58px | 34px | 0px | 0px |
| Android 橫屏 | 20px | 48px | 32px | 32px |

> 所有可互動元素（按鈕、開關）必須在安全邊距內。滾輪背景視覺可延伸至安全邊距外。

---

## §7 Color Animation Specs（色彩動畫規格）

### 7.1 Win Flash 動畫 Keyframe

Win 中獎連線高亮循環（0.8s 1 cycle）：

```
Keyframe  0%:   opacity: 1.0; filter: brightness(1.0)
Keyframe 30%:   opacity: 1.0; filter: brightness(1.8)
Keyframe 50%:   opacity: 0.7; filter: brightness(0.8)
Keyframe 70%:   opacity: 1.0; filter: brightness(1.6)
Keyframe 100%:  opacity: 1.0; filter: brightness(1.0)
```

非中獎符號同步 keyframe：
```
0%–100%:  opacity: 0.5; filter: brightness(0.6) saturate(0.4)
```

### 7.2 Cascade 連鎖層級色彩遞進

每次 Cascade 成功，WIN 數字區域 tint 加深，傳達「能量累積」感：

| Cascade 次數 | WIN 區域背景 tint | 計數浮字色彩 |
|:-----------:|:----------------:|:----------:|
| 1 | `rgba(255,215,0,0.05)` | `--color-gold-bright` |
| 2 | `rgba(255,215,0,0.12)` | `--color-gold-bright` |
| 3 | `rgba(255,165,0,0.18)` | `--color-orange-thunder` |
| 4 | `rgba(255,100,0,0.25)` | `oklch(70% 0.22 40)` 橙紅 |
| 5 次以上 | `rgba(255,50,0,0.30)` | `oklch(62% 0.25 25)` 紅橙 |

> tint 以 `mix-blend-mode: overlay` 疊加於 WIN 數字容器背景，不影響數字本身可讀性。

### 7.3 FG Multiplier 色彩過渡（精確修正 PDD §6.4）

Coin Toss Heads 後進度條色彩過渡動畫（duration: 500ms，`--ease-in-out-cubic`）：

| 過渡方向 | 起始 OKLCH | 結束 OKLCH | 說明 |
|---------|-----------|-----------|------|
| ×3 → ×7 | `oklch(60% 0.16 145)` 綠 | `oklch(80% 0.18 88)` 黃 | 進度線段色漸變 |
| ×7 → ×17 | `oklch(80% 0.18 88)` 黃 | `oklch(75% 0.18 65)` 黃橙 | |
| ×17 → ×27 | `oklch(75% 0.18 65)` 黃橙 | `oklch(62% 0.20 30)` 橙紅 | |
| ×27 → ×77 | `oklch(62% 0.20 30)` 橙紅 | `oklch(48% 0.24 18)` 深紅 | + 紅色電弧粒子 |

達到 ×77 時全節點閃爍：
```
Keyframe 0%:   filter: brightness(1.0)
Keyframe 25%:  filter: brightness(2.5) saturate(1.5)
Keyframe 50%:  filter: brightness(1.2)
Keyframe 75%:  filter: brightness(2.0)
Keyframe 100%: filter: brightness(1.0)
Animation: 1.5s ease-in-out infinite（持續至 FG 結束）
```

### 7.4 Thunder Blessing 觸發全域色彩動畫

| 時序 | 效果 | 精確值 |
|------|------|--------|
| 0.0s | 背景 overlay 閃白 | `rgba(255,255,255,0)` → `rgba(255,255,255,0.9)` |
| 0.3s | 白光消退 | `rgba(255,255,255,0.9)` → `rgba(255,255,255,0)` |
| 0.8s | 符號替換完成，全盤金色光暈 | `filter: sepia(0.3) brightness(1.4)` on reel layer |
| 1.8s | 光暈退出 | 回到 `filter: none` |
| 2.3s | 第二擊（若觸發）再次白光 | 強度降至 0.6（`rgba(255,255,255,0.6)`）|

---

## §8 Accessibility Visual Standards（無障礙視覺標準）

### 8.1 色盲適配方案

Thunder Blessing 主色系（金/藍/紫）在常見色盲類型下的可辨識性：

| 色盲類型 | 影響 | 適配措施 |
|---------|------|---------|
| Protanopia（紅色盲）| 紅色系（Cascade tint 5次+）辨識困難 | Cascade 高次數時以圖形（閃電圖標數量）補充提示，不純依賴色彩 |
| Deuteranopia（綠色盲）| ×3 進度節點（綠色）與其他節點可能混淆 | 進度節點形狀依倍率不同（×3:圓形；×7:菱形；×17:五角星；×27:六芒星；×77:閃電形）|
| Tritanopia（藍色盲）| Scatter 藍色電弧辨識受影響 | Scatter 加入環形白色外框（2px），不依賴藍色唯一標識 |
| 全色盲 | 僅依靠亮度 | 關鍵符號（Wild、Scatter）亮度差 ≥ 30%（OKLCH lightness 差）|

### 8.2 高頻閃爍限制

| 規範 | 要求 | 對應設計 |
|------|------|---------|
| PRD A11y-01 | 閃爍頻率 < 3Hz | Win Flash 循環 0.8s（1.25Hz）✅ |
| WCAG 2.3.1（三閃限制）| 1s 內紅色閃爍 < 3次 | 不使用純紅色閃爍效果 |
| 雷霆祝福白光 | 單次 0.3s 衝擊光 | 觸發間隔 ≥ 1s，整場不超過 3次連續白光 |
| FG Bonus ×100 全屏特效 | 爆炸持續 3.0s | 閃爍幀 < 3 個/s（每 400ms 一個高亮峰值）|

### 8.3 動態縮減（Reduced Motion）替代方案

偵測 `prefers-reduced-motion: reduce`（或遊戲內設定「低效果模式」）時：

| 原始效果 | 縮減替代 |
|---------|---------|
| 符號落下彈跳 | 直接顯示，無落下動畫 |
| Cascade 消除碎片飛散 | 符號直接淡出（opacity 1→0，300ms） |
| 硬幣翻轉 3D 旋轉 | 靜態硬幣正面/反面切換（200ms fade） |
| FG 場景 Cross-dissolve | 場景直接切換（無過渡，或 100ms fade） |
| Win 數字 Roll-up | 直接顯示最終值（無滾動） |
| ×77 節點閃爍 | 靜態高亮（恆亮，無 pulse） |
| 背景視差 | 所有層固定，不隨輸入移動 |
| 粒子特效 | 關閉所有粒子（僅保留靜態光暈圖片） |

---

## §9 Asset Quality Standards（資源品質標準）

### 9.1 輸出解析度 Pipeline

```
設計原稿（3× @ 2560×1440 等效）
    │
    ├── 導出 3× PNG（Retina / 2K：660×660px Wild）
    │       ↓ pngquant --quality=85-95 --strip
    │
    ├── 導出 2× PNG（主流桌面：440×440px Wild）
    │       ↓ pngquant --quality=88-95 --strip
    │
    └── 導出 1× PNG（低端行動：220×220px Wild）
            ↓ pngquant --quality=80-90 --strip
            ↓ 同步轉換 WebP（cwebp -q 90 -m 6）
```

### 9.2 壓縮設定精確規格

| 資源類型 | 格式 | 壓縮工具 | quality 參數 | 最大檔案大小 |
|---------|------|---------|:-----------:|:-----------:|
| 符號靜態 Idle（PNG）| PNG-32 | pngquant | 85-95 | 120 KB（Wild 3×）|
| 背景圖層（PNG，桌面）| PNG-32 | pngquant | 88-95 | 800 KB（1920×1080）|
| 背景圖層（WebP，行動）| WebP | cwebp | -q 90 -m 6 | 200 KB（750×1334）|
| UI 元件（PNG）| PNG-32 | pngquant | 90-95 | 50 KB |
| 粒子 Sprite Sheet | PNG-32 | pngquant | 88 | 256 KB（2048×2048）|
| Spine 骨骼 JSON | JSON | gzip | — | 80 KB（Wild 完整動畫）|

### 9.3 Spine 骨骼架構建議

每個動態符號的 Spine 檔案結構：

```
symbol_[name].spine
├── skeleton
│   ├── root（根骨骼）
│   ├── body（主體）
│   │   ├── head（如 Zeus 頭部）
│   │   ├── hand_L / hand_R（雙手）
│   │   └── accessory（配件：閃電叉、翅膀等）
│   ├── frame（外框骨骼，分離以便獨立動畫）
│   └── glow（光暈層，IK 跟隨 body）
├── animations
│   ├── idle（loop: true，duration: 4s 以內）
│   ├── win（loop: false，duration: ≤ 1.5s）
│   └── special（loop: false，duration: ≤ 2.5s）
└── atlas
    └── symbol_[name]_2x.atlas（2× 為主 atlas）
```

> **骨骼數量預算**：每符號最大 24 個骨骼；Wild / Scatter 允許最多 32 個（複雜度較高）。
> **IK 約束**：限用於 Wild 手持閃電叉跟隨動畫，其他符號避免 IK 防止運算負擔。

### 9.4 命名與目錄結構（對齊 PDD §14.3）

> **行動端背景命名說明**：行動端背景採 `.webp` 後綴，PDD §14.3 命名示例中的 `.png` 後綴為佔位符，實際交付以 `.webp` 為準。

```
assets/
├── symbols/
│   ├── wild/
│   │   ├── symbol_wild_idle.png          # 1× 靜態 fallback
│   │   ├── symbol_wild_idle@2x.png
│   │   ├── symbol_wild_idle@3x.png
│   │   ├── symbol_wild.spine             # Spine 骨骼（含 idle/win/special）
│   │   └── symbol_wild.atlas
│   ├── sc/
│   ├── p1/ p2/ p3/ p4/
│   └── l1/ l2/ l3/ l4/
├── ui/
│   ├── buttons/
│   │   ├── ui_btn_spin_normal@2x.png
│   │   ├── ui_btn_spin_pressed@2x.png
│   │   └── ...
│   ├── hud/
│   │   ├── ui_hud_background@2x.png
│   │   └── ui_hud_background.webp        # 行動端
│   └── dialogs/
│       └── ui_dialog_buyfg@2x.png
├── fx/
│   ├── fx_cascade_explode_premium.spine
│   ├── fx_cascade_explode_low.spine      # 行動裝置降級版
│   ├── fx_lightning_mark_appear.spine
│   ├── fx_thunder_blessing_hit1.spine
│   ├── fx_thunder_blessing_hit2.spine
│   ├── fx_coin_toss_flip.spine
│   ├── fx_win_bigwin_banner.spine
│   ├── fx_win_megawin_banner.spine
│   └── fx_fg_bonus_100x.spine
├── backgrounds/
│   ├── bg_main_sky_1920x1080.png
│   ├── bg_main_sky_750x1334.webp
│   ├── bg_main_temple_1920x1080.png
│   ├── bg_freegame_sky_1920x1080.png
│   └── bg_freegame_sky_750x1334.webp
├── particles/
│   ├── particle_lightning_arc_sheet.png  # 128×128px 幀，8×8 排列
│   ├── particle_coin_gold_sheet.png
│   └── particle_explosion_sheet.png
└── fonts/
    ├── Orbitron-Bold.woff2               # Subset: 0-9 $ , . × %
    ├── OpenSans-Regular.woff2
    ├── OpenSans-SemiBold.woff2
    └── Cinzel-Regular.woff2              # Subset: A-Z uppercase
```

---

## §10 Visual QA Checklist（視覺 QA 清單）

### 10.1 設計評審檢查點（交付前，設計師自查）

#### 色彩系統

- [ ] 所有色彩值有對應 Token（`--color-*`），無硬編碼 HEX
- [ ] OKLCH 值已轉換確認 sRGB HEX 在目標色域下正確顯示
- [ ] FG 進度條 5 個節點色彩依 §4.8 / §7.3 精確規格（綠→黃→黃橙→橙→紅）
- [ ] 所有符號主色在 Spine 中使用 Slot Tint 而非直接繪製，確保可程式化切換

#### 動畫系統

- [ ] 所有 easing curve 使用 §4.1 Token（`--ease-out-cubic` 等），無自定義随意 curve
- [ ] Coin Toss 翻轉總時長在 2500–3500ms 範圍（含隨機）
- [ ] Win roll-up 最長 ≤ 5000ms（計算：`min(totalWin/50, 5000)ms`）
- [ ] Cascade drop 階梯延遲正確（`col×20ms + row×30ms`，最大 230ms）
- [ ] FG 進度條過渡 500ms，easing `--ease-in-out-cubic`

#### 資源規格

- [ ] Wild / SC 靜態尺寸 220×220px（含出血），渲染尺寸 171×171px
- [ ] P 類靜態尺寸 200×200px（含出血），渲染尺寸 162×162px
- [ ] L 類靜態尺寸 180×180px（含出血），渲染尺寸 144×144px
- [ ] Spine 骨骼數量 ≤ 24（Wild / SC ≤ 32）
- [ ] Atlas 最大 2048×2048px，啟用 premultipliedAlpha

### 10.2 上線前視覺驗收標準

#### 效能

- [ ] 桌面 60fps 穩定（Chrome DevTools Performance，無 frame drop > 5ms）
- [ ] 行動裝置 30fps 穩定（Cascade 消除 + 視差最差情況下）
- [ ] 全盤粒子數在桌面不超過 500 個瞬時上限（FG Bonus ×100 演出期間例外允許最高 1000 個），行動不超過 200 個
- [ ] Spine atlas 紋理已壓縮（Crunch 或 ETC2/ASTC for mobile）

#### 視覺正確性

- [ ] 1920×1080：所有 HUD 元素 pixel 位置與 §6.1 表格吻合（±2px 容差）
- [ ] FREE 字母 4 個位置（814/861/908/955px X）正確
- [ ] 閃電標記計數器位置（1465px X, 90px Y）正確
- [ ] 6 列擴展時底部超出 1080px，雲霧遮蔽效果正常

#### 色彩驗收

- [ ] Marble White (#F5F0E8) 對 Olympus Blue (#1B2A4A) 對比 ≥ 7:1（AAA）
- [ ] Win Gold (#FFD700) 對 Olympus Blue (#1B2A4A) 對比 ≥ 4.5:1（AA）
- [ ] HUD 主要數值文字對比 ≥ 4.5:1（AA）

#### 無障礙

- [ ] Win Flash 閃爍頻率 ≤ 1.25Hz（0.8s 循環）
- [ ] 雷霆祝福白光單次 ≤ 0.3s，間隔 ≥ 1s
- [ ] `prefers-reduced-motion: reduce` 下所有粒子/動畫已縮減（手動測試）
- [ ] 色盲模式：進度節點形狀差異化（圓/菱/五角/六芒/閃電）可辨識

### 10.3 常見視覺 Bug 類型及預防

| Bug 類型 | 原因 | 預防措施 |
|---------|------|---------|
| 符號 Z-order 錯誤（閃電標記被符號壓住）| Spine layer 排序未設定 | 每次 Cascade 後強制重置 Z-order（`zIndex: markLayer = symbolLayer + 10`）|
| Win Flash 不同步（多線同時高亮 blink 不同步）| 各連線 CSS animation 起始時間不同步 | 所有連線 animation 使用同一 `animationTimeline` 起始點 |
| FG 進度條色彩停在前一節點色 | Tween 被 interrupt 未 complete | 使用 `onComplete` callback 強制設為目標色 |
| 行動端 Bloom 造成畫面偏亮 | `KawaseBlurFilter` 在 WebGL 1 下 Screen blend 溢出 | 行動端 Bloom strength 最大 0.8，並 clamp `rgb(255,255,255)` |
| Coin Toss 翻轉在特定角度出現「停頓感」| `rotateY` 360° 邊界重置導致 glitch | 使用累積角度（不重置），避免 modulo 歸零 |
| 粒子在低端裝置爆量 | Thunder Blessing 觸發粒子計算在主線程 | 使用 Worker offscreen canvas 或預計算粒子路徑 |
| 字體閃爍（FOUT）| Orbitron 字體載入延遲 | 預載入（`<link rel="preload" as="font">`），設 `font-display: swap` 降級顯示 |

---

*VDD 版本 1.0 — 基於 PDD v1.0（DOC-ID: PDD-THUNDERBLESSING-20260426）精化生成。*
*所有設計 Token、像素值及動畫規格均以 PDD 規格為基礎，提供工程直接可用的精確規格。*
*VDD 不重複 PDD 的設計意圖說明，聚焦於「怎麼做到視覺品質」的精確實作規格。*

STEP_COMPLETE: D05-VDD
