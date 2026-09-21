# 契约: 核心模块接口

本应用没有 HTTP API(纯前端, 见 research R1), 因此"契约"是模块之间的 TypeScript 接口. 这些签名是契约测试的依据: 每个函数先有失败测试, 再有实现. 类型定义见 [data-model.md](../data-model.md).

通用约定:

- `src/core/` 内全部为**纯函数**: 不访问 DOM、时间、随机数、存储; 不修改入参, 总是返回新对象.
- 可失败的操作返回 `Result<T>`, 不抛异常:

```ts
type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError }

type AppError = { readonly code: ErrorCode; readonly message: string } // message 为面向用户的中文文案

type ErrorCode =
  | 'OUT_OF_RANGE' | 'NOT_A_NUMBER'            // FR-005
  | 'COMPONENT_LIMIT' | 'KEYFRAME_LIMIT'       // FR-002, FR-018a
  | 'INVALID_LOOP_REGION'                      // 边界情况
  | 'INVALID_NAME'
  | 'STORAGE_UNAVAILABLE' | 'STORAGE_QUOTA' | 'DATA_CORRUPT' | 'NOT_FOUND'
  | 'EXPORT_UNSUPPORTED' | 'EXPORT_FAILED' | 'EXPORT_ABORTED'
```

---

## 1. `core/keyframes` — 参数轨道求值 (FR-018b/c/f)

```ts
evaluate(track: ParamTrack, t: number): number
integrate(track: ParamTrack, t: number): number          // ∫₀ᵗ, t ≥ 0
```

| 契约 | 对应需求 |
|---|---|
| `constant(v)`: `evaluate = v`, `integrate = v·t` | FR-018c |
| `t ≤ 首关键帧`: 取首值; `t ≥ 末关键帧`: 取末值 | FR-018c, 故事 3 场景 6 |
| `linear` 段中点取两端平均值 (0→1 于 0–5s, `evaluate(2.5) = 0.5`) | 故事 3 独立测试 |
| `hold` 段在到达下一关键帧前恒为前值 | FR-018b |
| `smooth` 段为 smoothstep, 两端导数为 0 | FR-018b |
| `evaluate` 处处连续(`hold` 的跳变点除外); `integrate` 处处连续且单调性与 `evaluate` 的符号一致 | FR-018f |
| `integrate` 与数值积分之差 < 1e-9 (性质测试) | FR-018f |

## 2. `core/tracks` — 轨道编辑 (FR-018a/e)

```ts
setValueAt(track: ParamTrack, t: number, value: number, range: Range): Result<ParamTrack>
addKeyframe(track: ParamTrack, t: number, range: Range): Result<ParamTrack>      // 值取 evaluate(track, t)
moveKeyframe(track: ParamTrack, from: number, to: number): Result<ParamTrack>
setEasing(track: ParamTrack, t: number, easing: Easing): Result<ParamTrack>
removeKeyframe(track: ParamTrack, t: number): Result<ParamTrack>
```

- `setValueAt` 实现 data-model 中"状态转换"表的全部四种改值情形.
- `addKeyframe` 在曲线上原位插入, **不改变** `evaluate` 在任意时刻的结果(`smooth` 段被拆分后允许形状变化, 但新关键帧处的值必须等于插入前的值).
- 第 51 个关键帧 → `KEYFRAME_LIMIT`. 值越界 → `OUT_OF_RANGE`, 原轨道不变.
- `moveKeyframe` 到已占用时刻 → 取代原有关键帧(边界情况).
- `removeKeyframe` 删除最后一个 → 返回 `constant(该关键帧的值)`.

## 3. `core/function` — 函数编辑 (FR-002, FR-019)

```ts
createDefaultFunction(): FourierFunction                                   // FR-007 的示例函数
addComponent(fn): Result<FourierFunction>                                  // 第 51 个 → COMPONENT_LIMIT
removeComponent(fn, componentId): FourierFunction
setComponentEnabled(fn, componentId, enabled: boolean): FourierFunction
moveComponent(fn, componentId, toIndex: number): FourierFunction
updateTrack(fn, componentId, param: ParamName, track: ParamTrack): FourierFunction
applyPreset(fn, preset: PresetId, count: number, baseFrequency?: number): Result<FourierFunction>
rename(fn, name: string): Result<FourierFunction>                          // INVALID_NAME
setPresentationMode(fn, mode: PresentationMode): FourierFunction
```

所有函数保持未涉及的分量**引用相等**(结构共享), 供渲染缓存与撤销历史依赖.

## 4. `core/evaluator` — 图形求值 (FR-008, FR-018f)

```ts
type Vec2 = { readonly x: number; readonly y: number }

vectorChain(fn: FourierFunction, t: number): readonly { componentId: string; from: Vec2; to: Vec2; radius: number }[]
tipAt(fn: FourierFunction, t: number): Vec2
sampleTrail(fn: FourierFunction, t: number, windowSeconds: number, maxPoints: number): Float64Array  // [τ₀,x₀,y₀, τ₁,x₁,y₁, …]
boundingRadius(fn: FourierFunction): number                                                           // 自动缩放用 (FR-011)
```

| 契约 | 对应需求 |
|---|---|
| 只有 `enabled` 的分量参与; 0 个启用分量时 `vectorChain` 为空、`tipAt = (0,0)` | 边界情况(空状态) |
| `vectorChain(fn, t)` 只依赖 `(fn, t)`: 与调用历史无关 | FR-018f 后半句, FR-018g, FR-008a |
| 频率关键帧区间内, `tipAt` 对 `t` 连续(相邻 1ms 的位移 ≤ 振幅之和 × 2π × 100 × 0.001) | 故事 3 场景 5 |
| 频率轨道过 0 时方向反转且无跳变 | 边界情况 |
| `sampleTrail` 的采样区间为 `[max(0, t − W), t]`, `t = 0` 时返回空 | 故事 2 场景 5 |
| `t = 1e6` 时 `tipAt` 与用 `BigInt`/高精度参考实现之差 < 1e-6 | 边界情况(长时间播放) |
| 方波预设 `count = 20` 时, `y(t)` 在非跳变点与理想方波之差 < 0.2 | 故事 4 独立测试 |

## 5. `core/playback` — 时间推进 (FR-013–017, FR-018g)

```ts
advance(state: PlaybackState, wallDeltaSeconds: number): PlaybackState
seek(state, t: number): PlaybackState                        // t < 0 钳制为 0
step(state, direction: 1 | -1): PlaybackState                // ±1/60 秒
setSpeed(state, speed: number): Result<PlaybackState>        // [0.1, 10]
setLoop(state, region: LoopRegion | null): Result<PlaybackState>   // INVALID_LOOP_REGION
reset(state): PlaybackState
```

- `advance` 在 `isPlaying = false` 时返回原对象(引用相等).
- 循环启用且越过 `end` 时按模回绕, 单次 `advance` 跨越多个循环长度也正确.
- `wallDeltaSeconds` 上限钳制为 0.25 秒, 避免标签页从后台恢复时时间跳跃.

## 6. `core/history` — 撤销/重做 (FR-006, FR-018h)

```ts
createHistory(present: FourierFunction): History
commit(h: History, next: FourierFunction): History           // next === present 时不产生新步; past 超过 50 丢弃最旧
undo(h: History): History                                    // 无可撤销时返回原对象
redo(h: History): History
```

## 7. `storage/FunctionRepository` — 本地持久化 (FR-021, FR-022)

```ts
interface FunctionRepository {
  findAll(): Promise<Result<readonly FunctionSummary[]>>      // { id, name, updatedAt, readable: boolean }
  findById(id: string): Promise<Result<FourierFunction>>      // NOT_FOUND | DATA_CORRUPT
  save(fn: FourierFunction): Promise<Result<FourierFunction>> // 写入 updatedAt; STORAGE_UNAVAILABLE | STORAGE_QUOTA
  rename(id: string, name: string): Promise<Result<void>>
  remove(id: string): Promise<Result<void>>
  loadDraft(): Promise<Result<Draft | null>>
  saveDraft(draft: Draft): Promise<Result<void>>
}
```

- 两个实现: `IndexedDbFunctionRepository`(生产) 与 `InMemoryFunctionRepository`(测试). 二者必须通过同一套契约测试.
- 每次读取都经 [persisted-function.schema.json](./persisted-function.schema.json) 对应的 Zod schema 校验.
- 任何方法都不抛异常; 存储不可用时所有方法返回 `STORAGE_UNAVAILABLE`, 应用其余功能不受影响(边界情况).

## 8. `render/drawFrame` — 绘制 (FR-008–012, FR-023b)

```ts
drawFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  fn: FourierFunction, t: number, view: ViewSettings,
  size: { width: number; height: number; pixelRatio: number },
  theme: RenderTheme,                                        // 从 CSS 设计令牌解析出的颜色, 由调用方传入
  trail?: Float64Array,                                      // 可选的预采样轨迹; 缺省时内部调用 sampleTrail. 传入值必须与之逐点等价(章程原则 I)
): void
```

- 除 `ctx` 外无副作用; 相同入参产生相同像素. 实时画布、图片导出、视频导出三处共用.
- 视觉回归测试固定 `(fn, t, view, size)` 截图比对.

## 9. `export` — 导出 (FR-023, FR-023a–d)

```ts
exportImage(input: FrameInput): Promise<Result<Blob>>        // PNG, 2× 像素密度

type VideoOptions = {
  start: number; end: number                                 // 0 < end − start ≤ 60
  speed: number                                              // 取导出时的播放速度 (FR-023b)
  fps: 30 | 60; resolution: '720p' | '1080p'
}
detectVideoSupport(): Promise<{ supported: boolean; reason?: string }>          // 仅探测 H.264/MP4 (FR-023d)
exportVideo(
  input: Omit<FrameInput, 't'>, options: VideoOptions,
  onProgress: (fraction: number) => void, signal: AbortSignal,
): Promise<Result<Blob>>                                     // video/mp4
```

| 契约 | 对应需求 |
|---|---|
| 帧数 = `ceil((end − start) / speed × fps)`; 第 `i` 帧的函数时间 = `start + i·speed/fps`, 视频时间戳 = `i/fps` | FR-023a/b |
| 成片时长(= `(end − start)/speed`)> 60 秒 → `OUT_OF_RANGE` | FR-023a |
| `signal` 中止 → `EXPORT_ABORTED`, 不产生 Blob, 释放编码器 | FR-023c, 故事 5 场景 5 |
| `onProgress` 单调不减, 结束时为 1 | FR-023c |
| 无 WebCodecs 或不支持 H.264 编码 → `detectVideoSupport().supported = false` 且带中文 `reason` | 边界情况 |
| 编码器通过依赖注入, 契约测试使用假编码器验证帧数与时间戳 | — |

注意: "单个视频时长上限 60 秒"按**成片时长**解释. 以 0.1× 速度导出 6 秒的函数时间会得到 60 秒成片, 这是允许的上限.
