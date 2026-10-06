# 数据模型: 从图形得到傅立叶函数

**日期**: 2026-09-24 | **规范**: [spec.md](./spec.md) | **研究**: [research.md](./research.md)

**持久化实体不变**: `FourierFunction`/`HarmonicComponent` 的字段与 schema 零改动; 唯一的数值变化是 `MAX_COMPONENTS` 50 → 200(schema 中的 `.max()` 随常量走). 旧函数照常打开(FR-002a、SC-005).
以下都是**不保存**的临时或派生结构.

## ShapePath (图形路径)

```ts
type ShapePath = readonly Vec2[]   // 有序、隐式闭合(末点连回首点); **一律世界坐标(y 向上)**: 手绘与 SVG 的来源层负责翻转
```
规则: 长度 ≥ 3; 相邻点不重合. 由 `resample(path, n)` 归一为等弧长的 `n` 点.

## ShapeSpectrum (转换结果)

```ts
interface SpectrumTerm { readonly n: number; readonly amplitude: number; readonly phaseDeg: number }
interface ShapeSpectrum {
  readonly terms: readonly SpectrumTerm[]   // 按 amplitude 降序, 不含 n = 0
  readonly sampleCount: number
}
toComponents(spectrum, count, idFactory): HarmonicComponent[]   // 前 count 项 → 分量(频率 n·0.2, 颜色轮换)
```
不变量: `count ≤ min(terms.length, MAX_COMPONENTS)`; 所有 `terms` 的 `|n| ≤ FREQUENCY_RANGE.max / PRESET_BASE_FREQUENCY`(= 500); 用全部 `terms` 重建的曲线与归一化后的输入逐点相差 < 1e-6.

## BuiltInShape (内置图形)

| 字段 | 说明 |
|---|---|
| `id` | `'snowflake' \| 'star' \| 'heart' \| 'circle' \| 'triangle' \| 'square' \| 'hexagon' \| 'letterF'` |
| `name` | 中文名 |
| `path()` | 生成 `ShapePath` 的纯函数 |
| `defaultCount` | 建议分量数(雪花 150, 心形 40, 圆 1…) |

## DrawingSession (绘制会话, 会话级状态)

| 字段 | 类型 | 说明 |
|---|---|---|
| `isActive` | `boolean` | 是否处于绘制模式(FR-014) |
| `stroke` | `Vec2[]` | 正在画的笔迹(屏幕坐标) |
| `lastRaw` | `Vec2[] \| null` | 最近一次完成的原始路径(FR-014b) |
| `smoothing` | `number` 0–100 | 默认 25 |
| `count` | `number` 2–200 | 默认 60 |
| `resumePlaying` | `boolean` | 进入绘制前是否在播放, 退出时恢复 |

状态: `闲置 → 绘制中(pointerdown) → 已完成(pointerup, 通过最短校验) → 闲置(退出)`; 校验失败回到 `绘制中` 并提示. 刷新后清空.

## ImportResult (导入结果)

```ts
type ImportResult = Result<{ path: ShapePath; pathCount: number; warnings: readonly string[] }>
// 错误码: IMPORT_UNSUPPORTED(非 SVG / 超限) | DATA_CORRUPT(无法解析) | NOT_FOUND(不含路径)
```

## 常量 (`src/core/ranges.ts`)

| 常量 | 值 |
|---|---|
| `MAX_COMPONENTS` | **200**(原 50) |
| `SHAPE_SAMPLE_COUNT` | 1024;  `SHAPE_SAMPLE_MAX` 4096 |
| `SHAPE_TARGET_EXTENT` | 2 |
| `SHAPE_MIN_AMPLITUDE` | 1e-4 |
| `SHAPE_DEFAULT_COUNT` | 60 |
| `DRAW_RESAMPLE_COUNT` | 512;  `DRAW_MIN_POINTS` 20;  `DRAW_MIN_EXTENT_RATIO` 0.05;  `DRAW_DEFAULT_SMOOTHING` 25;  `DRAW_MAX_SMOOTH_HALF_WINDOW` 12 |
| `SVG_MAX_BYTES` | 2 MB;  `SVG_MAX_POINTS` 100 000;  `SVG_YIELD_EVERY` 5 000 |
| `TRAIL_EVALUATION_BUDGET` | 2 000 000(取代固定的 4 万点: 点数预算 = 预算 ÷ 启用分量数, 上限 40 000) |
