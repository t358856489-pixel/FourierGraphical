# 数据模型: 傅立叶函数可视化编辑器

**日期**: 2026-09-21 | **规范**: [spec.md](./spec.md) | **研究**: [research.md](./research.md)

所有实体都是**不可变**的: 任何修改都返回新对象. 类型为 TypeScript 记法, 持久化格式见 [contracts/persisted-function.schema.json](./contracts/persisted-function.schema.json).

## 实体关系

```
FourierFunction 1 ──── * HarmonicComponent 1 ──── 3 ParamTrack ──── * Keyframe
       │                                          (amplitude / frequency / phase)
       └── presentationMode

PlaybackState ── 0..1 LoopRegion        ViewSettings        PresetDefinition (内置, 只读)
```

`FourierFunction` 是唯一被保存和可撤销的聚合根. `PlaybackState` 与 `ViewSettings` 属于会话状态: 随草稿一起自动保存以便恢复(FR-022), 但不进入撤销历史.

---

## FourierFunction (傅立叶函数)

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | `string` (UUID) | 创建时生成, 不变 |
| `schemaVersion` | `1` | 用于未来迁移; 不识别的版本按"数据不兼容"处理 |
| `name` | `string` | 去首尾空白后 1–60 字符; 在已保存列表中**允许重名**(以 `id` 区分) |
| `components` | `readonly HarmonicComponent[]` | 长度 0–50 (FR-002); 顺序即首尾相接的顺序 |
| `presentationMode` | `'waveform' \| 'drawing2d'` | 上次使用的呈现模式 (FR-008) |
| `createdAt` / `updatedAt` | ISO 8601 字符串 | `updatedAt` 在每次保存时更新 |

**生命周期**: `草稿(未保存)` → 保存 → `已保存` → 编辑 → `已保存且有未保存修改` → 保存 → `已保存`. "有未保存修改"在运行时通过比较当前文档引用与上次保存时的引用得出; 它随草稿以 `isDirty` 持久化, 刷新恢复后据此还原(`isDirty` 为 true 时 `lastSavedRef` 置空). 该状态决定 FR-020 的覆盖确认是否弹出.

## HarmonicComponent (谐波分量)

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | `string` (UUID) | 函数内唯一; 关键帧、高亮、选中都通过它引用 |
| `amplitude` | `ParamTrack` | 值域 `[0, 100]` |
| `frequency` | `ParamTrack` | 值域 `[−100, 100]` 圈/秒, 符号 = 旋转方向 (FR-001) |
| `phase` | `ParamTrack` | 值域 `[−3600, 3600]` 度 |
| `enabled` | `boolean` | 停用的分量不参与求和, 其关键帧在时间轴上隐藏 (FR-002) |
| `color` | `string` | 取自设计令牌中的分量调色板索引, 如 `"c3"`; 新分量按顺序轮换分配 |

新分量的默认值: 振幅 1, 频率 = (当前启用分量数 + 1) × 0.2, 相位 0, 启用.

## ParamTrack (参数轨道)

一个参数要么是固定值, 要么由关键帧决定 (FR-018c). 用可辨识联合表达, 使"非法状态不可表示":

```ts
type ParamTrack =
  | { readonly kind: 'constant'; readonly value: number }
  | { readonly kind: 'animated'; readonly keyframes: readonly Keyframe[] } // 长度 1–50, 按 time 严格递增
```

**状态转换**:

| 操作 | 之前 | 之后 |
|---|---|---|
| 在时刻 `t` 添加关键帧 (FR-018a) | `constant(v)` | `animated([{t, v}])` |
| 手动改值为 `v'`, 时刻 `t` 无关键帧 (FR-018e) | `animated(ks)` | `animated(insert(ks, {t, v'}))` |
| 手动改值为 `v'`, 时刻 `t` 有关键帧 (FR-018e) | `animated(ks)` | `animated(replaceAt(ks, t, v'))` |
| 手动改值 | `constant(v)` | `constant(v')` |
| 删除最后一个关键帧 (故事 3 场景 4) | `animated([k])` | `constant(k.value)` |
| 移动关键帧到已有关键帧的时刻 (边界情况) | `animated(ks)` | 移入者取代原有者 |

"时刻相同"按 1 毫秒量化判断: 关键帧时刻存储前四舍五入到 0.001 秒.

## Keyframe (关键帧)

| 字段 | 类型 | 规则 |
|---|---|---|
| `time` | `number` (秒) | `≥ 0`, 量化到 0.001; 同一轨道内唯一 |
| `value` | `number` | 落在所属参数的值域内 |
| `easing` | `'linear' \| 'smooth' \| 'hold'` | 到**下一个**关键帧的过渡方式, 默认 `linear` (FR-018b); 最后一个关键帧的该字段无效果但保留 |

关键帧没有独立 `id`: 它由 `(componentId, param, time)` 唯一确定, 这正是规范中"同一参数在同一时刻至多一个关键帧"的约束.

**求值** (定义见 research R4): `evaluate(track, t)` 返回参数值; `integrate(track, t)` 返回 `∫₀ᵗ`, 仅用于频率. 首关键帧之前取首值, 末关键帧之后取末值.

## 派生量 (不存储)

```
turns_k(t)  = phase_k(t)/360 + integrate(frequency_k, t)
θ_k(t)      = 2π · frac(turns_k(t))
tip_n(t)    = Σ_{k ≤ n, enabled}  amplitude_k(t) · (cos θ_k(t), sin θ_k(t))     // 第 n 个向量的末端
y(t)        = tip_N(t).y                                                         // 波形模式的纵向投影
```

轨迹 = `tip_N` 在 `[max(0, t − W), t]` 上的采样 (research R5). 自动缩放范围 (FR-011) = 所有启用分量在全部关键帧上的最大振幅之和.

## PlaybackState (时间状态)

| 字段 | 类型 | 规则 |
|---|---|---|
| `time` | `number` (秒) | `≥ 0` |
| `maxReachedTime` | `number` | 时间轴滑块的右端 = `max(maxReachedTime, loop.end, 最晚关键帧时刻, 10)`; 直接输入时间可超过它并将其推进 (FR-015) |
| `isPlaying` | `boolean` | |
| `speed` | `number` | `[0.1, 10]` (FR-014) |
| `loop` | `LoopRegion \| null` | `null` = 持续向前播放 (FR-017 默认) |

**初始值**: `time = 8`(等于默认轨迹窗口 `W`)、`isPlaying = false`、`speed = 1`、`loop = null`. 初始时刻不取 0 是因为轨迹在 `t = 0` 时为空(见 research R5): 取 `W` 能让首次打开、尚未播放(含"减少动态效果")时就显示完整图形. "重置"仍回到 0 并清空轨迹.

**LoopRegion**: `{ start: number; end: number; enabled: boolean }`, 约束 `start ≥ 0` 且 `end − start ≥ 0.1`; 违反时拒绝并保留上一个有效区间(边界情况).

**推进规则**: 每帧 `time += dt_wall × speed`. 若循环启用且 `time ≥ end`, 则 `time = start + (time − end) mod (end − start)`. 因为所有图形都是 `time` 的纯函数, 回到起点时状态自动正确 (FR-018g).

**状态机**:

```
        play                 pause
停止 ─────────► 播放中 ◄──────────► 暂停
 ▲                │  seek/step: 不改变播放状态      │
 └──── reset ─────┴───────────── reset ────────────┘      reset: time=0, isPlaying=false, maxReachedTime=0
```

## ViewSettings (视图设置)

| 字段 | 类型 | 规则 |
|---|---|---|
| `zoom` | `number \| 'auto'` | `'auto'` = 自动适配 (FR-011); 手动范围 0.1–20 |
| `pan` | `{ x: number; y: number }` | 世界坐标; 回到 `'auto'` 时清零 |
| `showVectors` / `showCircles` / `showTrail` / `showGrid` | `boolean` | FR-012 |
| `trailSeconds` | `number` | 轨迹窗口 `W`, 1–30, 默认 8 |
| `highlightedComponentId` | `string \| null` | FR-010 |
| `selectedComponentId` | `string \| null` | 决定时间轴上突出哪些关键帧 (FR-018d) |

呈现模式存于 `FourierFunction.presentationMode` 而非此处, 因为规范要求它随函数保存.

## PresetDefinition (预设波形)

内置只读. `generate(count: 1..50, baseFrequency = 0.2) → HarmonicComponent[]`, 全部为 `constant` 轨道:

| 预设 | 第 `n` 项 (n = 1…count) | 频率 | 振幅 | 相位 |
|---|---|---|---|---|
| 方波 | 奇次谐波 `m = 2n−1` | `m·f₀` | `4/(π·m)` | 0° |
| 锯齿波 | `m = n` | `m·f₀` | `2/(π·m)` | `180°`(n 为偶数) / `0°` |
| 三角波 | 奇次谐波 `m = 2n−1` | `m·f₀` | `8/(π²·m²)` | `0°`(n 为奇数) / `180°`(n 为偶数) |

以上均按 `y(t) = Σ A·sin θ` 的约定给出, 即标准正弦级数: 方波 `(4/π)Σ sin(mωt)/m`, 锯齿波 `(2/π)Σ (−1)^{n+1} sin(nωt)/n`, 三角波 `(8/π²)Σ (−1)^{n+1} sin(mωt)/m²`.

应用预设 = 用生成结果替换 `components`(原有关键帧随之丢弃, 已含在 FR-020 的确认文案中), 是一次可撤销的编辑.

## 持久化布局 (IndexedDB)

| 键 | 值 | 用途 |
|---|---|---|
| `fn:<id>` | `FourierFunction` | 已保存的函数 (FR-021) |
| `index` | `{ id, name, updatedAt }[]` | 列表页, 避免读取全部函数 |
| `draft` | `{ function, playback: {time, speed, loop}, view, savedFunctionId \| null, isDirty: boolean }` | 重新打开时恢复 (FR-022); 不保存 `isPlaying` |

读取的每个值都先经 schema 校验; 失败时该条目在列表中标记为"无法读取", 不影响其他条目.

## 撤销历史

`History = { past: FourierFunction[]; present: FourierFunction; future: FourierFunction[] }`, `past` 上限 50 (FR-006). 范围: 对 `FourierFunction` 的所有编辑, 含关键帧 (FR-018h) 与预设应用. 历史不持久化, 刷新后清空.

**呈现模式与撤销**: 模式切换是视图行为, 不占用撤销步——它只替换 `present`. 由于 `presentationMode` 位于快照之内, `undo`/`redo` **必须**把恢复出的快照的 `presentationMode` 覆盖为撤销前的当前值, 使撤销永远不会改变呈现模式.
