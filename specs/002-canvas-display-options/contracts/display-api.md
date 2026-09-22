# 契约: 画布显示选项的模块接口

沿用功能 001 的约定([core-api.md](../../001-fourier-visual-editor/contracts/core-api.md)): `src/core/` 为纯函数、不可变数据、可预期的失败用 `Result<T>` 返回.
每一行契约都先有一个会失败的测试, 再有实现.

## 1. `core/color` — 颜色解析与对比度 (新增)

```ts
interface Rgb { readonly r: number; readonly g: number; readonly b: number }   // 0–255

parseColor(text: string): Result<Rgb>              // '#RGB' | '#RRGGBB' | 'oklch(L% C H)'
parseUserColor(text: string): Result<string>       // 只接受十六进制, 返回规范化的 '#rrggbb'; 失败 → OUT_OF_RANGE, 中文说明格式
toHex(rgb: Rgb): string
mix(a: Rgb, b: Rgb, ratio: number): Rgb            // ratio = 0 → a, 1 → b
relativeLuminance(rgb: Rgb): number                // WCAG 2.x
contrastRatio(a: Rgb, b: Rgb): number              // 1–21, 与参数顺序无关
```

| 契约 | 需求 |
|---|---|
| `parseUserColor('#FFF')` → `'#ffffff'`; `'  #Aa00Ff '` → `'#aa00ff'` | FR-014 |
| `parseUserColor` 对 `'red'`、`'#12'`、`'#gggggg'`、`'rgb(0,0,0)'`、空串返回错误, 说明里包含 `#RRGGBB` | FR-020 |
| `parseColor('oklch(17% 0.025 165)')` 与设计令牌在浏览器中的实际颜色每通道相差 ≤ 1 | research R6 |
| `contrastRatio(黑, 白) = 21`; `contrastRatio(x, x) = 1` | FR-018 |

## 2. `render/palette` — 配色派生 (新增)

```ts
derivePalette(background: string | null, base: RenderTheme): RenderTheme
```

| 契约 | 需求 |
|---|---|
| `background === null` → 返回 `base` 本身(引用相等) | SC-007 |
| 任意合法背景色: 每种线条色与 12 个分量色对背景的对比度 ≥ 3, `text` ≥ 4.5 (fast-check 性质测试, 覆盖整个 RGB 立方体的随机点 + 8 个顶点 + 中灰) | FR-018、FR-019、SC-003 |
| 浅色背景 → 线条比背景暗; 深色背景 → 线条比背景亮 | 故事 3 场景 2、3 |
| 原本已达标的分量色原样保留; 被调整的分量色与原色的色相差 < 10° | FR-019 |
| 背景取某个分量色本身时, 该分量色仍与背景对比度 ≥ 3 | 故事 3 场景 4 |
| 相同输入 → 相同输出(深度相等) | 规范"画布配色方案" |
| `traceNormal` 不透明、比 `trace` 更接近背景, 且对背景的对比度 ≥ 3 | FR-002b |

## 3. `core/trailPlan` — 轨迹区间与采样计划 (新增)

```ts
periodOf(fn: FourierFunction): number | null
planTrail(fn: FourierFunction, t: number, view: ViewSettings, mode: PresentationMode): TrailPlan
```

| 契约 | 需求 |
|---|---|
| `trailFade = true` → 区间、步长与功能 001 的 `sampleTrail` 完全一致 | FR-001、SC-007 |
| 关闭淡化 + 二维绘图 + `'all'`: `t = 20` → `[0, 20]`; `t = 900` → `[300, 900]` 且 `isCapped = true` | FR-002、FR-007 |
| 关闭淡化 + 二维绘图 + `30`: `t = 100` → `[70, 100]` | 场景 2a |
| 关闭淡化 + 波形模式 → 区间仍为 `trailSeconds` 窗口, `mode = 'retained'` | FR-003 |
| `t = 0` → 空区间 | FR-006 |
| 点数 ≤ 预算; `stepPower` 是满足预算的最小值; `step = base · 2^stepPower` | research R3 |
| 示例函数(频率 0.2、0.6、1.0): `periodOf = 5`; `'all'` 且 `t = 600` 时区间长度为 5 | research R4 |
| `periodOf`: 含任一关键帧轨道 → `null`; 全部频率为 0 → `0`; `1.37` 与 `2.5` → `100`; 停用的分量不参与 | research R4 |
| 周期收缩后的区间长度不小于 `HIGHLIGHT_SECONDS` | FR-002b |
| 只依赖入参(相同入参 → 相同结果) | FR-004 |

## 4. `core/evaluator` 与 `render/trailCache` (修改)

```ts
sampleTrailPlan(fn: FourierFunction, plan: TrailPlan): Float64Array     // [τ, x, y, …]
// TrailCache.get 的入参改为 (fn, plan)
```

| 契约 | 需求 |
|---|---|
| 缓存结果与 `sampleTrailPlan` 整体重算**逐点相等**: 连续前进、后退、远跳、改函数、改保留时长、`stepPower` 增大的前后 | 章程原则 I |
| `stepPower` 由 n 变为 n+1 时, 新计算的点数不超过总点数的一半 + 常数(复用了偶数下标) | research R5 |
| "全部"模式下稳态播放, 每帧新计算的点数 ≤ 8 | SC-004 |
| 旧的 `sampleTrail(fn, t, window, maxPoints)` 保留并委托给新实现, 结果与改动前逐点相等 | SC-007 |

## 5. `render/drawGrid`、`render/drawEpicycles`、`render/drawWaveform`、`render/drawFrame` (修改)

```ts
drawGrid(ctx, region, viewport, theme, options: { grid: boolean; axes: boolean; verticals: boolean }): void
drawRetainedPolyline(ctx, plan, pointAt, theme): void      // 新增: 不使用 globalAlpha
// drawFrame 的签名不变; 它从 view 读取新字段
```

| 契约 | 需求 |
|---|---|
| **默认的 view 下, `drawFrame` 的调用序列与改动前录制的快照完全一致** | SC-007 |
| 四种 `{grid, axes}` 组合: 只出现被打开的那一类线; 都关时没有任何网格/坐标轴的描边 | 故事 2 场景 1–4 |
| `axes = false, grid = true`: 世界坐标 0 处仍有一条线, 颜色为主网格色而非坐标轴色 | FR-012 |
| 波形区: 零值基准线随 `axes`; 时间刻度线随 `grid` | FR-010、FR-011 |
| 保留模式: 整个轨迹绘制期间 `globalAlpha` 恒为 1; 早于 `highlightStart` 的部分只用 `traceNormal` 一种颜色; 高亮部分用 `HIGHLIGHT_BANDS` 段、颜色从 `traceNormal` 单调过渡到 `trace`; 先画旧的后画新的 | FR-002b |
| `samplesPerTurn < 16` 时用 `quadraticCurveTo`, 否则用 `lineTo` | FR-008 |
| 背景用 `theme.background` 清屏(沿用按整个像素缓冲清屏的做法) | FR-017 |
| `showTrail = false` 时不画任何轨迹, 与 `trailFade` 无关 | 边界情况 |

## 6. `core/schema` (修改)

| 契约 | 需求 |
|---|---|
| `tests/fixtures/` 中新增的"功能 001 时期的草稿"样本能通过 `parseDraft`, 且 `showAxes === showGrid`、`trailFade === true`、`trailRetention === 'all'`、`background === null`; 分别覆盖 `showGrid` 为 true 与 false | FR-024、SC-006 |
| `background` 为 `'#FFFFFF'`(未规范化)、`'white'`、`123` → `DATA_CORRUPT` | 边界校验 |
| `trailRetention` 为 `7`、`'forever'` → `DATA_CORRUPT` | 边界校验 |
| `fourierFunctionSchema` 与 `persisted-function.schema.json` **没有任何改动**; 功能 001 的全部函数样本仍然通过 | FR-023a |

## 7. `state/viewStore` (修改)

```ts
toggle(key: 'showVectors' | 'showCircles' | 'showTrail' | 'showGrid' | 'showAxes' | 'trailFade'): void
setTrailRetention(value: TrailRetention): void
setBackground(input: string | null): Result<string | null>      // 非法输入 → 错误, 状态不变 (FR-020)
```

| 契约 | 需求 |
|---|---|
| 这些动作不触碰 `documentStore`: 历史不变, `hasUnsavedChanges()` 不变 | FR-025 |
| `documentStore.loadFunction`、`applyPreset`、`markSaved` 不改变 `viewStore` 中的任何显示选项 | FR-023a |
| `setBackground('#FFF')` 后状态为 `'#ffffff'`; `setBackground(null)` 恢复默认 | FR-014、FR-016 |
| 自动保存在这些字段变化后 500 ms 内写入草稿; `restoreDraft` 恢复它们 | FR-023 |
