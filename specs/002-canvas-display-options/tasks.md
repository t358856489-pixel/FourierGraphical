---
description: "画布显示选项的实现任务列表"
---

# 任务: 画布显示选项

**输入**: 来自 `/specs/002-canvas-display-options/` 的设计文档
**前置条件**: plan.md、spec.md、research.md、data-model.md、contracts/display-api.md、quickstart.md; 功能 001 已完成

**测试**: **包含**. 项目章程原则 III"测试先行"要求: 每个"测试"小节的任务必须先完成并**确认失败**, 再开始同一阶段的实现任务.
覆盖率门槛: 整体 ≥ 80%, `src/core` ≥ 95%.

**组织结构**: 按用户故事分组; 三个故事彼此独立, 任何一个单独完成都可交付.

## 格式: `[ID] [P] [Story] 描述`
- **[P]**: 可以并行运行(不同文件, 且不依赖同阶段未完成的任务)
- **[Story]**: US1 = 轨迹保留, US2 = 网格与坐标轴, US3 = 背景色
- 路径相对于仓库根目录 `/Users/tanglinjie/claude-project/FourierGraphical/`

## 通用约束(适用于每个任务)
- **默认显示设置下的画面必须与功能 001 逐像素一致**(SC-007): T001 录制的快照与指纹在任何任务之后都不得改变; 若某个任务让它们变了, 那个任务就是错的.
- 画面只由 `(函数, 时刻 t, 显示选项)` 决定: **禁止**逐帧累积轨迹点; 缓存必须与整体重算逐点相等(章程原则 I).
- `src/core/` 只写无 DOM 的纯函数; 可预期的失败用 `Result<T>` 返回, 面向用户的说明为简体中文; 数据不可变.
- 常量一律放进 `src/core/ranges.ts`(取值见 data-model.md"常量"表), 不写魔法数字. 单文件 < 800 行, 单函数 < 50 行.
- **不得修改** `fourierFunctionSchema`、`contracts/persisted-function.schema.json`(功能 001)与任何已保存函数的格式(FR-023a).
- 新控件一律使用原生表单控件或已有的 `src/ui/` 组件; 不新增全局快捷键; 不新增依赖.

---

## 阶段 1: 设置(固化现状)

**目的**: 在改动任何代码之前, 把"默认画面"固定下来作为回归基准(research R12)

- [X] T001 在**未改动**的代码上新增 `src/render/drawFrame.regression.test.ts`: 用 `src/test/fakeContext.ts` 对固定输入(`createDefaultFunction` 以固定的 idFactory 与 clock 生成; `t = 5`; `INITIAL_VIEW`; `{ width: 800, height: 400, pixelRatio: 2 }`; `FALLBACK_THEME`)分别在 `waveform` 与 `drawing2d` 两种模式下调用 `drawFrame`, 把完整的调用序列(方法名、参数、`strokeStyle`、`globalAlpha`、`lineWidth`)用 `toMatchSnapshot()` 录入 `src/render/__snapshots__/`. 运行一次生成快照并提交. 此后该快照**只允许**在 T008 因 `INITIAL_VIEW` 增加字段而重新生成输入时保持**输出**不变, 不得用 `-u` 更新
- [X] T002 [P] 在**未改动**的代码上新增 `tests/e2e/default-look.spec.ts`: 用 `openPaused` 打开、`seekTo(page, 4.5)`, 分别在波形与二维绘图模式下取 `stillShot` 指纹, 与写在测试文件里的期望值比较(首次运行时把实际指纹填入; 按 Playwright project 分别记录, 因为各引擎的光栅化不同). 在 chromium 上运行确认通过

---

## 阶段 2: 基础(阻塞前置条件)

**目的**: 三个故事共用的类型、常量、持久化兼容、store 动作与"画面"面板外壳

**⚠️ 关键**: 此阶段完成前不得开始任何用户故事

### 基础的测试(先写, 确认失败)

- [X] T003 [P] 在 `src/core/schema.test.ts` 追加 contracts §6 的用例, 并创建夹具 `tests/fixtures/draft-v001-grid-on.json`、`tests/fixtures/draft-v001-grid-off.json`(功能 001 时期的草稿: `view` 里只有旧字段, 分别 `showGrid: true / false`): 两个旧草稿都能通过 `parseDraft`, 且 `showAxes === showGrid`、`trailFade === true`、`trailRetention === 'all'`、`background === null`; `background` 为 `'#FFFFFF'`、`'white'`、`123` 时返回 `DATA_CORRUPT`; `trailRetention` 为 `7`、`'forever'` 时返回 `DATA_CORRUPT`; 含全部新字段的草稿通过; **功能 001 的全部函数夹具仍然通过 `parseFunction`**
- [X] T004 [P] 新增 `src/state/viewStore.test.ts`, 覆盖 contracts §7: `toggle('showAxes')`、`toggle('trailFade')` 翻转对应字段; `setTrailRetention(30)`; `setBackground('#FFF')` 后状态为 `'#ffffff'` 且返回 ok; `setBackground('red')` 返回错误、状态不变、错误说明包含 `#RRGGBB`; `setBackground(null)` 恢复默认; 以上动作前后 `useDocumentStore.getState().history` 引用不变、`hasUnsavedChanges()` 不变; `documentStore` 的 `loadFunction`、`applyPreset`、`markSaved` 执行后 `viewStore` 的四个新字段与 `showGrid` 等旧字段不变(FR-023a、FR-025)
- [X] T005 [P] 在 `src/state/autosave.test.ts` 追加: 改变 `showAxes`、`trailFade`、`trailRetention`、`background` 任一字段后 500 ms 内写入草稿且草稿含该字段; `restoreDraft` 恢复这四个字段(FR-023)
- [X] T006 [P] 新增 `src/core/color.test.ts`, 覆盖 contracts §1 中 `parseUserColor` 的全部用例(`'#FFF'`→`'#ffffff'`; `'  #Aa00Ff '`→`'#aa00ff'`; `'red'`、`'#12'`、`'#gggggg'`、`'rgb(0,0,0)'`、`''` 返回错误且说明含 `#RRGGBB`). 其余颜色函数的测试属于 US3(T031)

### 基础的实现

- [X] T007 在 `src/core/types.ts` 增加 `TrailRetention`、`TrailPlan`(字段见 data-model.md), 并给 `ViewSettings` 增加 `showAxes`、`trailFade`、`trailRetention`、`background`; 在 `src/core/ranges.ts` 增加 data-model.md"常量"表中的全部常量
- [X] T008 在 `src/state/viewStore.ts` 给 `INITIAL_VIEW` 补上四个新字段的默认值(`true`、`true`、`'all'`、`null`), 把 `DisplayToggle` 扩展为含 `'showAxes' | 'trailFade'`, 增加 `setTrailRetention`、`setBackground`(调用 T009 的 `parseUserColor`, 返回 `Result`), 并让 `selectViewSettings` 带出新字段; 同步更新 `src/test/resetStores.ts` 与所有手写 `ViewSettings` 字面量的测试文件(`src/render/drawFrame.test.ts` 等)使其通过类型检查. 完成后 T001 的快照必须**原样通过**
- [X] T009 [P] 新建 `src/core/color.ts`, 先只实现 `parseUserColor(text): Result<string>`(去空白、接受 `#RGB` 与 `#RRGGBB`、规范化为小写 6 位); 使 T006 通过. 使 T004 通过(依赖 T008)
- [X] T010 在 `src/core/schema.ts` 把 `draftSchema` 的 `view` 改为"先补默认值再严格校验"(`z.preprocess`: 缺 `showAxes` 取该对象的 `showGrid`, 其余按 data-model.md"读取旧草稿"表), 并为 `background`(`null` 或 `^#[0-9a-f]{6}$`)与 `trailRetention`(8 个字面量)加校验; `fourierFunctionSchema` 不动; 使 T003、T005 通过
- [X] T011 新建"画面"面板外壳 `src/features/display-panel/DisplayPanel.tsx` + `display-panel.css`: 用原生 `<details>` + `<summary>画面</summary>` 实现的非模态展开面板, 内含两个带 `nameplate` 标题的空分区"轨迹"与"背景"(内容由 US1、US3 填入); 视觉沿用仪器面板语言(设计令牌, 不硬编码颜色); 在 `src/features/stage/StageToolbar.tsx` 的显示开关组之后挂载它. 新增 `src/features/display-panel/DisplayPanel.test.tsx`: 摘要可聚焦, Enter/空格展开与收起, 展开后两个分区标题可见

**检查点**: `pnpm test`、`pnpm typecheck`、`pnpm lint` 全绿; T001 快照与 T002 指纹未变; 界面上多了一个空的"画面"面板

---

## 阶段 3: 用户故事 1 - 让划过的轨迹保留下来(优先级: P1)🎯 MVP

**目标**: "轨迹淡化"开关; 关闭后按保留时长(5 秒–10 分钟或"全部")保留轨迹, 最新 2 秒更亮并过渡到稳定的正常亮度; 10 分钟的轨迹仍然流畅.

**独立测试**: 二维绘图模式下关闭淡化、保留时长"全部", 从 0 播放到 20 秒: 0 秒附近的轨迹仍可见且亮度稳定, 笔尖附近更亮; 重新打开淡化后恢复余辉(quickstart"故事 1").

### 用户故事 1 的测试(先写, 确认失败)⚠️

- [X] T012 [P] [US1] 新增 `src/core/trailPlan.test.ts`, 覆盖 contracts §3 的全部行: `periodOf`(示例函数 → 5; 含任一关键帧轨道 → `null`; 无启用分量或频率全 0 → 0; `1.37` 与 `2.5` → 100; 停用分量不参与); `planTrail` 在 `trailFade = true` 时的区间与步长与 `trailStep`/`sampleTrail` 现有规则一致; 关闭淡化 + `drawing2d` + `'all'`: `t = 20` → `[0, 20]`, `t = 900` → 区间长 600 且 `isCapped`; 保留 30 秒且 `t = 100` → `[70, 100]`; 关闭淡化 + `waveform` → 仍是 `trailSeconds` 窗口且 `mode = 'retained'`; `t = 0` → 空区间; 点数 ≤ `RETAINED_TRAIL_POINT_BUDGET` 且 `stepPower` 为满足预算的最小值; 周期函数 `'all'`、`t = 600` → 区间长 5; 周期收缩后区间不短于 `HIGHLIGHT_SECONDS`; `highlightStart = max(start, t − 2)`; fast-check: 相同入参结果深度相等
- [X] T013 [P] [US1] 在 `src/core/evaluator.test.ts` 追加 `sampleTrailPlan` 用例: 首点 τ = `plan.start`、末点 τ = `plan.end` 且等于 `tipAt(fn, t)`; 内部点落在 `k · plan.step` 的绝对网格上; **旧的 `sampleTrail(fn, t, window, maxPoints)` 的返回值与改动前逐点相等**(对示例函数在 `t = 3`、`t = 20` 各录一份期望数组的校验和写进测试)
- [X] T014 [P] [US1] 在 `src/render/trailCache.test.ts` 追加 contracts §4 的缓存契约: 以 `TrailPlan` 为入参; 在 `'all'` 模式下从 `t = 0` 以 1/60 步进到 `t = 30`, 每一步的结果与 `sampleTrailPlan` 整体重算逐点相等; 稳态每步新计算的点数 ≤ 8; 构造一个使 `stepPower` 由 n 升到 n+1 的时间跨越, 断言跨越前后结果仍逐点相等, 且跨越那一步新计算的点数 ≤ 总点数的一半 + 8; 后退、远跳、换函数、改保留时长后仍逐点相等
- [X] T015 [P] [US1] 新增 `src/render/drawRetained.test.ts`(用假 `ctx`), 覆盖 contracts §5 的保留模式各行: 整个轨迹绘制期间 `globalAlpha` 恒为 1; 早于 `highlightStart` 的描边只用 `theme.traceNormal` 一种 `strokeStyle`; 高亮部分恰为 `HIGHLIGHT_BANDS` 段, 其颜色到 `theme.trace` 的距离单调递减; 描边顺序先旧后新; `samplesPerTurn < 16` 时路径用 `quadraticCurveTo`, 否则用 `lineTo`; 区间短于 2 秒时不报错
- [X] T016 [P] [US1] 在 `src/render/drawFrame.test.ts` 追加: `trailFade = false` + `drawing2d` 时调用了保留模式的绘制且没有任何 `globalAlpha < 1` 的轨迹描边; `trailFade = false` + `waveform` 时波形使用保留模式的亮度规则而窗口长度不变; `showTrail = false` 时无论 `trailFade` 如何都不画轨迹; 传入与内部采样相等的预采样轨迹时调用序列不变
- [X] T017 [P] [US1] 在 `src/features/display-panel/DisplayPanel.test.tsx` 追加"轨迹"分区用例: "轨迹淡化"开关反映并修改 `viewStore.trailFade`; 保留时长为原生 `<select>`, 8 个选项的文字为"5 秒 … 10 分钟、全部", 选择后 `trailRetention` 更新; 淡化开启时 `<select>` 为 `disabled` 且通过 `aria-describedby` 关联一句说明(FR-002c); `t > 600` 且 `'all'` 且淡化关闭时显示"轨迹已达到 10 分钟保留上限"; 当前 `TrailPlan.samplesPerTurn < 8` 时显示"轨迹已简化显示"
- [X] T018 [P] [US1] 新增 `tests/e2e/us6-trail-retention.spec.ts`, 覆盖 spec 故事 1 的场景 1–7 与 2a、2b: 用截图指纹断言(关闭淡化、`'all'`、二维绘图)`t = 20` 的画面 ≠ 淡化开启时的画面; 保留 5 秒与"全部"的画面不同, 改回后指纹复原; 重置后画面与刚打开并跳到 0 时相同; **连续播放到 t\* 暂停的指纹 = 重置后直接跳到 t\* 的指纹**(沿用功能 001 `us3` 的方法); 改参数后指纹变化且再改回原值指纹复原; 淡化开启时保留时长控件不可用; 循环区间 4–8 秒下两次回到同一时刻的指纹相同; 导出图片成功

### 用户故事 1 的实现

- [X] T019 [US1] 新建 `src/core/trailPlan.ts`, 实现 `periodOf`(整数化频率后求 gcd, 见 research R4)与 `planTrail`(决定规则见 data-model.md"TrailPlan"); `fading` 分支必须复用 `trailStep` 的现有规则; 使 T012 通过
- [X] T020 [US1] 在 `src/core/evaluator.ts` 增加 `sampleTrailPlan(fn, plan)`, 并让现有的 `sampleTrail` 通过构造等价的计划委托给它; 使 T013 通过, 且 T001 快照不变
- [X] T021 [US1] 在 `src/render/trailCache.ts` 把 `get` 的入参改为 `(fn, plan)`, 缓存键加入 `plan.stepPower`; `stepPower` 增大时保留偶数下标的点并重新编号而不是清空(research R5); 使 T014 通过
- [X] T022 [P] [US1] 在 `src/render/theme.ts` 给 `RenderTheme` 增加 `traceNormal`: `FALLBACK_THEME` 中取 `trace` 与 `background` 按 `NORMAL_BRIGHTNESS_MIX` 混合的十六进制值; `readRenderTheme` 从新的设计令牌 `--screen-trace-normal` 读取, 并在 `src/styles/tokens.css` 定义该令牌(用 `color-mix(in oklch, var(--screen-trace) 55%, var(--screen-bg))` 或等价的 oklch 值)
- [X] T023 [US1] 在 `src/render/drawEpicycles.ts` 新增 `drawRetainedPolyline(ctx, plan, pointCount, pointAt, timeAt, theme)`: 先用 `traceNormal` 描早于 `highlightStart` 的部分, 再按 `HIGHLIGHT_BANDS` 段描高亮部分(颜色用 `src/core/color.ts` 的 `mix`——若尚未实现则在本任务内补上 `mix` 与 `toHex` 及其单元测试); 稀疏时用二次曲线; 全程不改 `globalAlpha`; 使 T015 通过(依赖 T022)
- [X] T024 [US1] 在 `src/render/drawFrame.ts` 用 `planTrail` 取代直接调用 `sampleTrail`, 按 `plan.mode` 分派到现有的 `drawTrail`/`drawWaveform`(fading)或保留模式的绘制; 在 `src/render/drawWaveform.ts` 增加保留模式分支; 可选的预采样轨迹参数保持不变; 使 T016 通过, **T001 快照不变**(依赖 T019、T020、T023)
- [X] T025 [US1] 在 `src/features/stage/useStageLoop.ts` 用 `planTrail` + 新的 `trailCache.get(fn, plan)` 取得轨迹并传给 `drawFrame`; 在 `src/features/export-dialog/ExportDialog.tsx` 确认 `frameInput()` 的 `view` 带出新字段(导出路径不使用缓存, 由 `drawFrame` 自行采样)(依赖 T021、T024)
- [X] T026 [US1] 在 `src/features/display-panel/DisplayPanel.tsx` 的"轨迹"分区实现: `Toggle`"轨迹淡化"; 原生 `<select>` 保留时长(选项来自 `TRAIL_RETENTION_OPTIONS`, 文案函数 `formatRetention` 放同目录的 `formatRetention.ts` 并单测); 淡化开启时禁用并显示说明; 上限与简化两条状态说明(为此用 `planTrail` 对当前 `fn`、暂停时的 `t` 求值; 播放中每秒最多更新一次, 不得每帧重渲染); 使 T017、T018 通过

**检查点**: 故事 1 可独立验收; T001 快照、T002 指纹未变

---

## 阶段 4: 用户故事 2 - 分别控制网格和坐标轴(优先级: P2)

**目标**: "网格"与"坐标轴"两个独立开关; 坐标轴关闭时原位置补普通网格线; 波形区的基准线与时间刻度线分别归属.

**独立测试**: 依次试四种组合, 画面上每次只出现被打开的那一项(quickstart"故事 2").

### 用户故事 2 的测试(先写, 确认失败)⚠️

- [X] T027 [P] [US2] 新增 `src/render/drawGrid.test.ts`(假 `ctx`), 覆盖 contracts §5 的网格各行: `{grid: true, axes: true}` 的调用序列与改动前 `drawGrid` 的调用序列完全相同(先在未改动的函数上录制期望); `{grid: true, axes: false}` 时世界坐标 0 处仍有一条线且 `strokeStyle` 为 `theme.gridMajor` 而非 `theme.axis`; `{grid: false, axes: true}` 时恰好两条线(一横一竖, 受 `verticals` 约束)且颜色为 `theme.axis`; 都为 false 时没有任何描边
- [X] T028 [P] [US2] 在 `src/render/drawFrame.test.ts` 追加: 波形模式下 `showAxes = false` 时不画零值基准线, `showGrid = false` 时不画时间刻度线, 两者互不影响; 四种组合下本轮区的描边数符合预期
- [X] T029 [P] [US2] 在 `src/features/stage/StageToolbar.test.tsx`(新建)中: 显示开关组依次为"向量、圆、轨迹、网格、坐标轴", 默认都 `aria-pressed="true"`; 点击"坐标轴"只改变 `showAxes`; 新增 `tests/e2e/us7-grid-axes.spec.ts` 覆盖 spec 故事 2 的场景 1–5(四种组合的截图指纹两两不同; 都开时的指纹等于 T002 记录的默认指纹)与场景 6(用 `tests/fixtures/draft-v001-grid-off.json` 的内容预先写入 IndexedDB 后打开: 两个开关都为未按下), 以及键盘操作: Tab 聚焦后空格切换且播放状态不变

### 用户故事 2 的实现

- [X] T030 [US2] 把 `src/render/drawGrid.ts` 的签名改为 `drawGrid(ctx, region, viewport, theme, { grid, axes, verticals })` 并实现 research R7 的着色规则; 在 `src/render/drawFrame.ts` 传入 `view.showGrid`/`view.showAxes`(两者都为 false 时跳过调用); 在 `src/render/drawWaveform.ts` 让零值基准线随 `showAxes`、`drawTimeTicks` 随 `showGrid`; 在 `src/features/stage/StageToolbar.tsx` 的 `DISPLAY_TOGGLES` 增加 `{ key: 'showAxes', label: '坐标轴' }`; 使 T027–T029 通过, **T001 快照不变**

**检查点**: 故事 2 可独立验收

---

## 阶段 5: 用户故事 3 - 自定义画布背景色(优先级: P3)

**目标**: 预置色块、取色器、十六进制输入与"恢复默认"; 线条与分量颜色自动适配, 任意背景色下对比度达标; 导出与画面一致.

**独立测试**: 背景改为白色后所有线条清晰可辨; 导出的 PNG 背景为白色; "恢复默认"回到深色背景(quickstart"故事 3").

### 用户故事 3 的测试(先写, 确认失败)⚠️

- [X] T031 [P] [US3] 在 `src/core/color.test.ts` 追加 contracts §1 的其余行: `parseColor` 支持 `#RGB`、`#RRGGBB`、`oklch(L% C H)`; 对 `src/styles/tokens.css` 中画布用到的每个 oklch 令牌, 转换结果与 `FALLBACK_THEME` 中对应的十六进制值每通道相差 ≤ 6(这些十六进制是人工近似值; 精确比对留给 T036 的端到端测试); `mix` 的端点与中点; `relativeLuminance`(黑 0、白 1); `contrastRatio(黑, 白) = 21`、`contrastRatio(x, x) = 1`、与参数顺序无关; `toHex` 与 `parseColor` 互逆
- [X] T032 [P] [US3] 新增 `src/render/palette.test.ts`, 覆盖 contracts §2 的全部行: `derivePalette(null, base) === base`(引用相等); fast-check 性质: 对任意 `#rrggbb` 背景(另加 RGB 立方体 8 个顶点与 `#777777`、`#808080`), `grid`、`gridMajor`、`axis`、`circle`、`vector`、`trace`、`traceNormal` 与 12 个分量色对背景的对比度 ≥ 3, `text` ≥ 4.5; 浅色背景下线条比背景暗、深色背景下更亮; 对 `#000000` 背景已达标的分量色原样保留; 被调整的分量色与原色的 OKLCH 色相差 < 10°; 背景取任一分量色本身时该分量色对比度仍 ≥ 3; `traceNormal` 到背景的距离小于 `trace` 到背景的距离; 相同输入深度相等
- [X] T033 [P] [US3] 新增 `src/features/display-panel/BackgroundPicker.test.tsx`: 四个预置色块是带可访问名称("默认深色、纯黑、纯白、浅米色")的按钮, 当前选中的 `aria-pressed="true"`; 点击后 `viewStore.background` 更新(默认为 `null`); 原生 `input[type=color]` 变更后更新; 十六进制输入框输入 `#FFF` 回车后状态为 `#ffffff` 且框内显示 `#ffffff`; 输入 `red` 后出现 `role="alert"` 的格式说明、状态不变、框内回到上一个有效值; "恢复默认"把状态置为 `null`, 且在已是默认时为 `disabled`
- [X] T034 [P] [US3] 在 `src/features/export-dialog/ExportDialog.test.tsx` 追加: 背景为 `#ffffff` 时传给 `exportImage` 的 `theme.background` 为 `#ffffff`, 且 `theme` 等于 `derivePalette('#ffffff', 基础主题)`(用 `vi.mock` 截获 `exportImage` 的入参); 新增 `tests/e2e/us8-background.spec.ts` 覆盖 spec 故事 3 的场景 1–7: 选"纯白"后画布中心附近某个空白像素为白色(`page.screenshot` + 取像素, 或在页面内对一张画布**副本**取样, 不要对真实画布反复 `getImageData`——见功能 001 tasks.md 关于 GPU/CPU 光栅化切换的教训); 白/黑/米色/自选中灰下的指纹两两不同; "恢复默认"后指纹等于 T002 的默认指纹; 非法输入保留原背景; 刷新后背景保持; 导出图片成功; 面板与时间轴的计算样式不随背景改变

### 用户故事 3 的实现

- [X] T035 [US3] 在 `src/core/color.ts` 补齐 `parseColor`(含约 25 行的 OKLCH→线性 sRGB→sRGB 转换与色域裁剪)、`toHex`、`mix`、`relativeLuminance`、`contrastRatio`(T023 已实现的部分保持不变); 使 T031 通过
- [X] T036 [US3] 新建 `src/render/palette.ts`, 实现 `derivePalette(background, base)`(算法见 research R6: 默认背景原样返回; 按亮度阈值 0.179 选墨色; 各线条按固定比例混合后二分到对比度下界; 分量色只在不达标时沿墨色方向二分调整); 每个私有辅助函数 < 50 行; 使 T032 通过
- [X] T037 [US3] 在 `src/features/stage/useStageLoop.ts` 把主题改为 `derivePalette(view.background, 基础主题)` 并按 `background` 记忆化(背景不变时复用同一个对象, 避免每帧分配); 背景变化必须触发重绘. 在 `src/features/export-dialog/ExportDialog.tsx` 的 `frameInput()` 同样经 `derivePalette`. 在 `src/features/stage/stage.css` 让画布容器的 CSS 背景色跟随(通过写入容器的 CSS 自定义属性), 避免画布尺寸变化的瞬间露出旧的深色底; 使 T034 的单元部分通过(依赖 T036)
- [X] T038 [US3] 新建 `src/features/display-panel/BackgroundPicker.tsx`, 并挂进 `DisplayPanel.tsx` 的"背景"分区: 预置色块(来自 `BACKGROUND_PRESETS`; 色块自身带 1px 描边, 使白色块在浅色面板上、深色块在深色区域上都看得见)、原生取色器、十六进制输入框(错误处理与 `src/ui/NumberField.tsx` 同样的"草稿只在输入期间存在"模式)、"恢复默认"; 使 T033、T034 通过

**检查点**: 三个故事全部可独立验收

---

## 阶段 6: 完善与横切关注点

- [X] T039 [P] 扩展 `tests/perf/render-benchmark.spec.ts`, 新增 research R8 的三个场景(均为 50 个分量、`trailFade = false`、`trailRetention = 'all'`、`drawing2d`、经草稿注入并 `seek` 到 `t = 600`): (a) 周期函数播放; (b) 把其中 5 个分量的频率改为不成整数比(如 `×1.0007`)后播放; (c) 场景 b 下每帧修改一次参数. 判据: a、b 的 p95 帧间隔 < 25 ms; c 的 p95 < 100 ms; 打印实测数字. **若 b 不达标**: 不要自行引入缓存层或 LOD——停下来, 把数字记入本文件的"实施状态", 并按 plan.md 的要求先补"复杂度跟踪"再实施 research R8 的后备方案
- [X] T040 [P] 在 `tests/e2e/a11y.spec.ts` 增加两个状态: 展开"画面"面板(默认背景); 背景为 `#ffffff` 且面板展开. 两者均无 serious / critical 违规. 在 `tests/e2e/keyboard-only.spec.ts` 增加一条: 仅用键盘展开面板、关闭轨迹淡化、把保留时长改为"30 秒"、选择"纯白"、恢复默认, 每一步焦点可见
- [X] T041 [P] 在 `tests/visual/layout.spec.ts` 的四个宽度下各增加"展开画面面板"的状态: 无横向溢出, 面板内的控件全部落在视口宽度内
- [X] T042 [P] 新增 `tests/e2e/display-persistence.spec.ts`, 覆盖 quickstart"横切检查": 改动四类选项后刷新全部恢复; 白色背景下保存函数甲、改为黑色背景、从"我的函数"打开函数甲后背景仍为黑色; 改显示选项不出现"(有未保存的修改)"; 撤销快捷键不改变显示选项; 应用预设后显示选项不变
- [X] T043 运行 `pnpm test:coverage`(整体 ≥ 80%, `src/core` ≥ 95%)、`pnpm lint`、`pnpm typecheck`、`pnpm size`(首屏 JS < 300 KB)、四个浏览器配置的 `pnpm test:e2e` 连续 3 次全绿; 确认 T001 快照文件与 T002 指纹自提交以来**没有被改动过**(`git log -p` 检查这两个文件)
- [X] T044 用 code-reviewer 与 react-reviewer 代理审查本功能的全部改动(重点: `planTrail`/缓存的边界、步长放大、`derivePalette` 的收敛与数值稳定、面板是否每帧重渲染、章程原则 I 与 V), 修复 CRITICAL 与 HIGH, 尽量修复 MEDIUM; 每个修复先补失败测试
- [X] T045 [P] 更新 `README.md`(显示选项与已知限制)、`CLAUDE.md`"最近变更"; 把功能 001 `data-model.md` 中 `ViewSettings` 一节加一行指向本功能 data-model.md 的说明
- [ ] T046 按 `specs/002-canvas-display-options/quickstart.md` 的手动验收清单完整走查一遍, 把结果与偏差记入 `specs/002-canvas-display-options/checklists/acceptance.md`; 由人确认的条目如实标注是谁、何时确认, 未逐项确认的不写"通过"

---

## 依赖关系与执行顺序

### 阶段依赖

```
阶段 1 固化现状 ──► 阶段 2 基础 ──┬──► US1 轨迹保留 (P1) ──┐
                                   ├──► US2 网格/坐标轴 (P2) ├──► 阶段 6 完善
                                   └──► US3 背景色 (P3) ─────┘
```

- 三个故事都只依赖基础阶段, 彼此没有功能依赖, 可以任意顺序或并行实施.
- **共享文件上的串行点**(不同故事都要改, 必须按编号顺序合并):
  `src/render/drawFrame.ts`(T024 → T030)、`src/render/drawWaveform.ts`(T024 → T030)、`src/render/drawFrame.test.ts`(T016 → T028)、
  `src/features/stage/useStageLoop.ts`(T025 → T037)、`src/features/export-dialog/ExportDialog.tsx`(T025 → T037)、
  `src/features/display-panel/DisplayPanel.tsx`(T011 → T026 → T038)、`src/core/color.ts`(T009 → T023 → T035)、`src/core/color.test.ts`(T006 → T031).
- `mix`/`toHex` 同时被 US1(T023)与 US3(T035)需要: 谁先做谁实现并补单测, 后者复用.

### 每个阶段内部

测试任务(先写且失败)→ `src/core` → `src/render` → `src/state` → `src/features` → 端到端通过. 每个实现任务之后都跑一次 T001 的回归快照.

### 并行机会

- 阶段 1: T001、T002 并行.
- 阶段 2: T003–T006 四个测试并行; T009 与 T007/T008 不同文件(但 T004 的通过依赖二者).
- US1: T012–T018 七个测试并行; 实现中 T022 可与 T019–T021 并行.
- US2: T027–T029 并行; 实现只有一个任务.
- US3: T031–T034 并行; T035 → T036 → T037/T038.
- 阶段 6: T039–T042、T045 并行.
- 多代理时: 基础完成后 US1、US2、US3 三线并行, 在上面列出的串行点按编号合并.

## 并行示例

```bash
# US1: 一次启动全部测试任务
Task: "T012 src/core/trailPlan.test.ts —— periodOf 与 planTrail 的契约"
Task: "T013 src/core/evaluator.test.ts —— sampleTrailPlan 与旧 sampleTrail 的等价"
Task: "T014 src/render/trailCache.test.ts —— 缓存与整体重算逐点相等, 含步长放大"
Task: "T015 src/render/drawRetained.test.ts —— 保留模式不使用 globalAlpha"

# US3: 颜色数学与界面测试互不相干
Task: "T031 src/core/color.test.ts"
Task: "T032 src/render/palette.test.ts —— 对比度下界的性质测试"
Task: "T033 src/features/display-panel/BackgroundPicker.test.tsx"
```

## 实施策略

### MVP 优先

1. 阶段 1 + 阶段 2 → 回归基准与共用骨架.
2. **US1(轨迹保留)** → 停下验收. 这是 MVP: 三项里唯一改变"能看到什么"的一项, 也是技术风险所在; 尽早跑 T039 的场景 a、b, 确认 research R3/R4 的性能假设成立.
3. 如果想最快看到成果, 可以先做 **US2**(只有 1 个实现任务), 它与 US1 完全独立.

### 增量交付

4. US2 → US3, 每个故事完成后: 跑该故事的端到端测试 + T001/T002 回归, 用 code-reviewer 审查, 再提交(约定式提交 `feat: …`).
5. 阶段 6 → 发布前质量门. **提交前先跑完检查, 再提交**——不要把"跑测试"和"提交并推送"写在同一条命令里(功能 001 的教训).

## 实施状态 (2026-09-22)

- 已完成并标记 [X]: 阶段 1、2, US1–US3 的全部测试与实现, 阶段 6 的 T039–T045. **未完成**: T046(人工走查, 需要用户).
- 代码审查(T044)结论: 通过, 0 CRITICAL / 0 HIGH / 1 MEDIUM / 1 LOW; 两项均已修复(缩短窗口显式不短于高亮段并加性质测试; 提示文字的 id 改用 useId).
- 单元/组件/集成: 54 个文件 502 个测试, 覆盖率整体 90.9%、`src/core` 99.4%. 端到端: 四个浏览器配置 205 通过、7 跳过, 连续 3 次全量一致. T001 快照与 T002 截图基线自录制以来未改动过.
- 性能基准(50 个分量、淡化关闭、"全部"、t = 600, 桌面 Chromium): 周期函数播放 60.0 fps(p95 16.7 ms); 非周期函数走满 4 万点预算 59.6 fps(p95 16.7 ms, 最慢 49.9 ms); 非周期 + 每帧改参数 16.3 fps(p95 66.7 ms, 满足 SC-002 的 100 ms). 三个场景均达标, **未启用**任何后备方案.
- 实施中的偏离与决定: 修订记录 F2(形状永远正确, 高频时缩短实际保留窗口)按分析报告的建议执行, 用户未另作表态; 端到端测试里"面板收起"改为真实点击(用 JS 移除 open 属性会让 React 状态与 DOM 不一致); 校验非法颜色输入的用例改为断言状态而非像素(全量并行下首帧指纹偶发不稳定); 窄屏下"画面"面板改为相对工具栏定位以避免溢出.
- 文件命名偏离任务列表: 端到端测试合并为 `tests/e2e/display-options.spec.ts`(而非 us6/us7/us8 三个文件)加 `color-conversion.spec.ts`; 持久化用例(T042)也在其中.

## 备注

- 任何任务若需要用 `vitest -u` 更新 T001 的快照, 说明默认画面变了, 即违反 SC-007: 停下来找原因, 不要更新快照.
- 端到端测试里比较画面一律用功能 001 的 `stillShot`(截图指纹); 不要对真实画布反复 `getImageData`, 那会让 Chrome 把画布从 GPU 光栅化切到 CPU 光栅化, 使指纹改变.
- research R3 的 LOD 与 R8 的分块离屏层是**有条件的后备**, 不在本任务列表内; 启用它们需要先更新 plan.md 的"复杂度跟踪".
