# 数据模型: 画布显示选项

**日期**: 2026-09-21 | **规范**: [spec.md](./spec.md) | **研究**: [research.md](./research.md)

本功能只扩展一个已有实体(`ViewSettings`), 并新增若干**派生、不保存**的值. `FourierFunction` 及其持久化 schema **不变**(FR-023a).
所有类型只读; 任何修改返回新对象.

## ViewSettings (扩展)

功能 001 中已有的字段(`zoom`、`pan`、`showVectors`、`showCircles`、`showTrail`、`showGrid`、`trailSeconds`、`highlightedComponentId`、`selectedComponentId`)保持不变. 新增:

| 字段 | 类型 | 默认值 | 规则 |
|---|---|---|---|
| `showAxes` | `boolean` | `true` | 控制本轮视图的两条坐标轴与波形视图的零值基准线 (FR-010). `showGrid` 的含义相应收窄为: 网格线与波形视图的时间刻度线 (FR-011) |
| `trailFade` | `boolean` | `true` | `true` 时轨迹行为与功能 001 完全一致 (FR-001) |
| `trailRetention` | `TrailRetention` | `'all'` | 仅在 `trailFade === false` 且二维绘图模式下生效 (FR-002a) |
| `background` | `string \| null` | `null` | `null` = 应用默认背景; 否则为小写的 `#rrggbb` (FR-014). 存储前一律规范化为 6 位小写 |

```ts
type TrailRetention = 5 | 10 | 30 | 60 | 120 | 300 | 600 | 'all'   // 秒; 'all' 受 600 秒上限约束 (FR-007)
```

`trailRetention` 用有限的字面量联合而不是任意数字: 界面只提供这 8 档(research R10), 让非法状态不可表示.

**归属**: 应用级偏好(Clarifications 第 2 条). 随草稿保存于 `draft.view`, 重新打开应用时恢复(FR-023); 不属于任何函数, 不进入撤销历史, 改变它们不会使函数变为"有未保存的修改"(FR-025).

### 常量 (`src/core/ranges.ts`)

| 常量 | 值 | 依据 |
|---|---|---|
| `TRAIL_RETENTION_OPTIONS` | `[5, 10, 30, 60, 120, 300, 600, 'all']` | FR-002a |
| `MAX_RETENTION_SECONDS` | `600` | FR-007 |
| `HIGHLIGHT_SECONDS` | `2` | FR-002b |
| `HIGHLIGHT_BANDS` | `12` | research R2 |
| `NORMAL_BRIGHTNESS_MIX` | `0.55` | research R2; 最终颜色还要过 3:1 的对比度校验 |
| `RETAINED_TRAIL_POINT_BUDGET` | `40000` | research R3 |
| `SMOOTH_BELOW_SAMPLES_PER_TURN` | `16` | research R3 |
| `SIMPLIFIED_BELOW_SAMPLES_PER_TURN` | `8` | research R3: 低于它时提示"轨迹已简化显示" |
| `MIN_LINE_CONTRAST` / `MIN_TEXT_CONTRAST` | `3` / `4.5` | FR-018 |
| `BACKGROUND_PRESETS` | 默认(`null`)、`#000000`、`#ffffff`、`#f3ecdc` | FR-015 |

## 派生值 (不保存)

### TrailPlan —— 这一帧要画哪一段轨迹、怎么采样

```ts
interface TrailPlan {
  readonly start: number            // 采样区间起点
  readonly end: number              // = t
  readonly step: number             // 基础步长 × 2ⁿ
  readonly stepPower: number        // n
  readonly highlightStart: number   // max(start, t − HIGHLIGHT_SECONDS); 淡化开启时 = start(不使用)
  readonly mode: 'fading' | 'retained'
  readonly samplesPerTurn: number   // 供"平滑绘制 / 简化提示"判断
  readonly isCapped: boolean        // 'all' 且 t > 600: 供 FR-007 的说明
}

planTrail(fn, t, view, presentationMode): TrailPlan      // 纯函数
```

决定规则(research R1、R3、R4):

```
fading                → [max(0, t − trailSeconds), t], 步长与点数上限沿用功能 001
retained + 波形模式    → [max(0, t − trailSeconds), t], mode = 'retained'
retained + 二维绘图    → R = retention === 'all' ? 600 : retention
                         window = min(R, t)
                         P = periodOf(fn);  若 P !== null 且 P < window → window = max(P, HIGHLIGHT_SECONDS)
                         start = t − window
                         n = 使 window / (base·2ⁿ) ≤ RETAINED_TRAIL_POINT_BUDGET 的最小非负整数
```

**状态转换**: 无. `TrailPlan` 每帧由输入重新算出; 这正是"拖动时间轴、循环、导出得到同一画面"的保证(FR-004).

### periodOf(fn): number | null

| 情形 | 结果 |
|---|---|
| 任一启用分量的振幅、频率或相位是关键帧轨道 | `null` |
| 没有启用的分量, 或所有频率为 0 | `0`(图形静止) |
| 其他 | `1000 / gcd(|round(1000·fᵢ)|)` 秒, 只对频率非 0 的分量取 gcd |

### RenderTheme (已有类型, 来源改变)

功能 001 中它直接读自 CSS 设计令牌. 现在:

```
RenderTheme = derivePalette(view.background, 从 CSS 令牌读出的基础主题)
```

- `background === null` → 原样返回基础主题(引用相等), 保证默认画面不变(SC-007).
- 否则按 research R6 派生. 新增一个字段 `traceNormal`: 保留模式下"正常亮度"的轨迹色(不透明). 基础主题中它由 `trace` 与 `background` 按 `NORMAL_BRIGHTNESS_MIX` 混合得到.
- 不变量(由性质测试保证): 对任意合法背景色, `grid`、`gridMajor`、`axis`、`circle`、`vector`、`trace`、`traceNormal`、12 个分量色相对背景的对比度 ≥ 3; `text` ≥ 4.5.

## 持久化

| 键 | 变化 |
|---|---|
| `fn:<id>`、`index` | **不变** |
| `draft` | `view` 多出四个字段 |

**读取旧草稿**(research R9): 在严格校验之前先补默认值——

| 缺失的字段 | 取值 |
|---|---|
| `showAxes` | 该草稿的 `showGrid`(升级前坐标轴与网格同显同隐, 故事 2 场景 6) |
| `trailFade` | `true` |
| `trailRetention` | `'all'` |
| `background` | `null` |

补完后仍走原有的严格校验: `background` 非 `null` 时必须匹配 `^#[0-9a-f]{6}$`; `trailRetention` 必须是 8 个取值之一. 校验失败按"草稿已损坏"处理(沿用功能 001 的行为).
新版本写出的草稿旧版本读不了(多出未知字段)——不支持降级, 属于可接受的限制.
