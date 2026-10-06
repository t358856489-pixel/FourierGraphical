---
description: "从图形得到傅立叶函数的实现任务列表"
---

# 任务: 从图形得到傅立叶函数

**输入**: 来自 `/specs/003-shape-to-fourier/` 的设计文档
**前置条件**: plan.md、spec.md、research.md、data-model.md、contracts/shape-api.md、quickstart.md; 功能 001、002 已完成

**测试**: **包含**(章程原则 III). 每个"测试"小节先写、确认失败, 再实现. 覆盖率整体 ≥ 80%, `src/core` ≥ 95%.

**组织结构**: 按用户故事分组; 三个故事共用"路径 → 分量"的转换(放在基础阶段), 彼此独立.

## 格式: `[ID] [P] [Story] 描述`
- **[P]**: 可并行(不同文件, 不依赖同阶段未完成任务)
- **[Story]**: US1 = 图形库, US2 = 手绘, US3 = 导入 SVG
- 路径相对于仓库根目录

## 通用约束
- 不新增运行时依赖. `src/core/shape/` 只写无 DOM 的纯函数; 可预期失败用 `Result<T>`, 文案为简体中文.
- 函数与已保存数据的格式**不变**; 唯一改动的持久化相关常量是 `MAX_COMPONENTS`.
- 功能 002 的默认画面回归快照(`src/render/__snapshots__/`、`tests/visual/__screenshots__/`)在任何任务之后都不得改变.
- 外部文件(SVG)是不可信数据: 解析永不抛异常, 不执行脚本, 不发起网络请求.
- 端到端比较画面用 `stillShot`; 面板浮层截图前用真实点击收起(功能 002 的教训). 先跑完检查再提交, 不把测试和提交写进同一条命令.

---

## 阶段 1: 设置

- [ ] T001 在 `src/core/ranges.ts` 增加 data-model.md"常量"表的全部新常量(`SHAPE_*`、`DRAW_*`、`SVG_*`、`TRAIL_EVALUATION_BUDGET`); `MAX_COMPONENTS` 暂不改(T004 先有测试)
- [ ] T002 [P] 创建夹具 `tests/fixtures/svg/`: `single-path.svg`(一条含 C/Q/A 的闭合路径)、`multi-path.svg`(三条长度不同的路径)、`shapes.svg`(polygon + rect + circle 且带 `transform`)、`no-path.svg`、`with-script.svg`(含 `<script>`、`onload`、`<image href="https://example.invalid/x.png">`)、`malformed-d.svg`(`M 1`、`X 0 0`、`1e999`)、`not-svg.txt`; 以及 `tests/fixtures/strokes/heart.json`(一条 2000 点的手绘心形, 点密度不均)

---

## 阶段 2: 基础(阻塞前置条件)

**目的**: 上限 200 及其性能配套; 路径 → 分量的转换; 应用生成函数的动作与覆盖确认

### 基础的测试(先写, 确认失败)

- [ ] T003 [P] 在 `src/core/function.test.ts`、`src/core/schema.test.ts`、`src/state/documentStore.test.ts` 追加: 第 200 个分量可加、第 201 个返回 `COMPONENT_LIMIT`; `applyPreset('square', 200)` 成功、201 返回 `OUT_OF_RANGE`; 含 200 个分量的函数通过 `parseFunction`, 201 个 → `DATA_CORRUPT`; `applyGenerated(components)` 替换全部分量并把 `presentationMode` 置为 `drawing2d`, 是一步可撤销的编辑, 撤销后恢复含关键帧的原函数, 传入 201 个分量时返回错误
- [ ] T004 [P] 在 `src/core/trailPlan.test.ts` 追加: 保留模式的点数预算 = `min(40000, TRAIL_EVALUATION_BUDGET / 启用分量数)`(200 个分量 → 10 000 点); 淡化模式的点数上限同样按分量数缩放; 1 个分量时与改动前的预算相同(回归)
- [ ] T005 [P] 新增 `src/core/shape/spectrum.test.ts`, 覆盖 contracts §1 全部行: `resample` 等弧长(相邻距离的最大最小值之比 < 1.01)、闭合、点数正确; `normalize` 重心为 0、长边 = `SHAPE_TARGET_EXTENT`、y 翻转; 圆的 `analyze` 只有 `n = ±1` 一项显著; 正五边形只在 `n ≡ 1 (mod 5)` 出现非零项; fast-check: 随机闭合点列用全部项 `reconstruct` 与 `normalize(resample(p))` 逐点 < 1e-6; **所有项 `|n| ≤ 500`, 生成分量的 |频率| ≤ `FREQUENCY_RANGE.max`**(含极细锯齿的随机路径); `normalize` 不翻转 y; `toComponents` 的频率、量化、丢弃小项、`count` 超界取全部, 且装进函数后通过 `fourierFunctionSchema`
- [ ] T006 [P] 新增 `src/features/components-panel/VirtualList.test.tsx`: 200 行、可视区高度 400、行高 40 时只渲染约 10 + 上下各 5 行; 滚动后渲染窗口移动; 行的 key 稳定(滚动不重建已有行); 少于 60 行时全部渲染(不虚拟化)

### 基础的实现

- [ ] T007 `MAX_COMPONENTS` 改为 200; 在 `src/core/trailPlan.ts` 把 `RETAINED_TRAIL_POINT_BUDGET` / `DEFAULT_MAX_TRAIL_POINTS` 的使用改为按启用分量数计算(读取 `TRAIL_EVALUATION_BUDGET`); 使 T003 的上限部分与 T004 通过; 功能 002 回归快照不变
- [ ] T008 [P] 新建 `src/core/shape/spectrum.ts`: `resample`、`normalize`(不翻转 y)、`analyze`(直接 DFT, `n ∈ [−500, 500]`, 排除 0, 按振幅降序)、`reconstruct`、`toComponents`(颜色轮换, id 工厂可注入); 每个函数 < 50 行; 使 T005 通过
- [ ] T009 在 `src/state/documentStore.ts` 增加 `applyGenerated(components): Result<FourierFunction>`(走 `applyEdit(…, 'commit')`, 并 `setPresentationMode('drawing2d')` 合并在同一步); 使 T003 通过(依赖 T007)
- [ ] T010 [P] 新建 `src/features/shapes/useOverwriteGuard.ts`: 从 `PresetPicker.tsx` 抽出"有未保存修改时先确认"的逻辑(含"刚应用、未改动"的豁免), 返回 `{ guard(action), dialog }`; `PresetPicker` 改为使用它, 其既有测试不变
- [ ] T011 [P] 新建 `src/features/components-panel/VirtualList.tsx`(用 `IntersectionObserver` 或滚动位置计算可视窗口, 固定行高, 不引入依赖), 在 `ComponentsPanel.tsx` 中用它渲染分量列表; 使 T006 通过; `ComponentsPanel.test.tsx` 与端到端不受影响
- [ ] T012 [P] 在 `tests/perf/render-benchmark.spec.ts` 增加 200 个分量的三个场景(播放; 每帧改参数; 保留"全部"、t = 600), 判据同功能 002; 运行并把数字记入本文件"实施状态". **不达标时停下**, 按 plan.md 的要求先补"复杂度跟踪"

**检查点**: `pnpm test`、`typecheck`、`lint` 全绿; 回归快照不变; 基准达标

---

## 阶段 3: 用户故事 1 - 内置图形库 (P1) 🎯 MVP

**独立测试**: 选"雪花"(150 分量)播放一整圈, 画出尖角清晰的六角雪花并留在画面上; 分量改 10 → 圆润近似(quickstart 故事 1).

### 测试(先写, 确认失败)

- [ ] T013 [P] [US1] 新增 `src/core/shape/builtins.test.ts`, 覆盖 contracts §2: 8 个图形、含 `snowflake`; 每个 `path()` ≥ 3 点、无重合相邻点、首末不重复; 雪花 60° 旋转对称、字母 F 无对称; 每个图形用 200 项重建的 Hausdorff 距离 < 1% 尺寸, 60 项 < 3%(用 `SHAPE_SAMPLE_COUNT` 点比较); 心形重建后尖端在 y 最小处(不倒置); `defaultCount` 在 2–200 内
- [ ] T014 [P] [US1] 新增 `src/features/shapes/ShapeDialog.test.tsx`(图形库页签): 8 个带名称的按钮, 每个含一个内联 `<svg>` 缩略图且其 `d` 由 `path()` 生成; 选中雪花后 `documentStore` 的分量数等于滑块值(默认取 `defaultCount`)、`presentationMode = drawing2d`; 分量滑块 2–200, 拖动后分量数随之变化且整个拖动只占一步撤销; `viewStore` 变为 `showTrail: true, trailFade: false, trailRetention: 'all'` 而 `showGrid`/`background` 不变; `playbackStore` 为 `time: 0` 且播放中(`matchMedia` 模拟 reduced-motion 时为暂停且 `time = 1 / PRESET_BASE_FREQUENCY`, 断言引用该常量而非写死 5); 有未保存修改时先出现确认对话框, 取消则一切不变
- [ ] T015 [P] [US1] 新增 `tests/e2e/shapes.spec.ts` 的故事 1 部分: 点"图形"→"雪花"→ 3 次操作内画面切到二维绘图并播放; 等到 `t ≥ 5` 后 `stillShot` 与再等 5 秒后的一致(图形闭合且留在画面上); 分量改为 10 后指纹变化; 撤销一步 → 分量列表回到 3 项; 默认画面回归(`default-look.spec.ts`)仍通过

### 实现

- [ ] T016 [P] [US1] 新建 `src/core/shape/builtins.ts`: `BUILT_IN_SHAPES`(雪花 = 3 阶 Koch, 五角星、心形、圆、正三/四/六边形、字母 F)与折线按弧长插值; 使 T013 通过. 若雪花 200 项达不到 1%, 降为 2 阶并在 research R4 记录
- [ ] T017 [US1] 新建 `src/features/shapes/ShapeLibrary.tsx` + `ShapeDialog.tsx` + `shapes.css`(复用 `Dialog`; 三页签的 `role="tablist"`, 本任务只填图形库页签; 缩略图内联 SVG; 分量滑块用 `Slider`, 拖动走 preview/commit 两段式)与 `src/features/shapes/applyShape.ts`(把"转换 → `applyGenerated` → 播放与显示选项设置"封装为一个函数, 三个故事共用, 含 reduced-motion 分支, 周期用 `1 / PRESET_BASE_FREQUENCY` 计算); 在 `ComponentsPanel.tsx` 头部加"图形"按钮; 使 T014、T015 通过(依赖 T008–T011、T016)

**检查点**: 3 次操作画出雪花

---

## 阶段 4: 用户故事 2 - 手绘 (P2)

**独立测试**: 画一个心形松手, 向量沿所画轮廓描一遍; 平滑滑块最低→抖动可见, 最高→圆润; 过短的一笔被拒绝(quickstart 故事 2).

### 测试(先写, 确认失败)

- [ ] T018 [P] [US2] 新增 `src/core/shape/drawing.test.ts`, 覆盖 contracts §3: `closeStroke` 对 < 20 点或长度 < 5% 短边返回 `OUT_OF_RANGE` 且文案含"再画长一些"; 正常路径闭合; `smooth(p, 0) === p`; 点数不变; 自相交数不变(对"8"字形); 用夹具 `strokes/heart.json` 以 1× 与 3× 抽稀两种密度处理后逐点 < 2% 尺寸; fast-check: 平滑后的路径仍闭合且重心不变(< 1e-9)
- [ ] T019 [P] [US2] 新增 `src/state/drawingStore.test.ts`: 状态机 `闲置 → 绘制中 → 已完成 → 闲置`; `enter()` 记录 `resumePlaying` 并暂停; `exit()` 按记录恢复; `finish()` 校验失败时保持绘制中并返回错误; `lastRaw` 在完成后保留, 再画一笔后替换; `setSmoothing`/`setCount` 改变后 `derived` 的分量重新计算
- [ ] T020 [P] [US2] 新增 `src/features/stage/DrawingLayer.test.tsx`: 进入绘制模式后覆盖层出现, 合成 `pointerdown/move/up` 画一个方形 → `drawingStore.lastRaw` 有点、`documentStore` 被应用; 绘制中 `useStagePointer` 的向量拖拽不触发(store 的 `editBase` 保持 null); "清除"清空笔迹; "退出"移除覆盖层并恢复播放; 平滑滑块与分量滑块改变后分量重算且各占一步撤销
- [ ] T021 [P] [US2] `tests/e2e/shapes.spec.ts` 故事 2 部分: 进入手绘, 用 `page.mouse` 画一个 40 点的心形 → 应用后画面变化且指纹稳定; 平滑滑块两端的指纹不同; 画一个 3 点的短笔 → 出现"再画长一些"提示且分量数不变; 清除、退出后回到之前的画面与播放状态; 触摸配置(mobile project)下同样能画

### 实现

- [ ] T022 [P] [US2] 新建 `src/core/shape/drawing.ts`: `closeStroke`、`smooth`(循环移动平均, 窗口 `1 + 2·round(smoothing/100 · DRAW_MAX_SMOOTH_HALF_WINDOW)`)、`strokeToSpectrum(raw, smoothing)`(去重 → 闭合 → 重采样 512 → 平滑 → `analyze`); 使 T018 通过
- [ ] T023 [US2] 新建 `src/state/drawingStore.ts`(`DrawingSession`; `enter/exit/append/finish/clear/setSmoothing/setCount`; 完成与参数改变时调用 `applyShape`); 使 T019 通过(依赖 T022)
- [ ] T024 [US2] 新建 `src/features/stage/DrawingLayer.tsx` + `drawing-layer.css`(覆盖在画布上的第二个 canvas 画笔迹, 用 `getCoalescedEvents`; 笔迹用 `viewport.toWorld` 换成世界坐标(y 向上)再交给 `drawing.ts`; 工具条: 平滑滑块、分量滑块、清除、退出); 修改 `useStagePointer.ts` 在绘制模式下直接返回; 在 `Stage.tsx` 挂载; `ShapeDialog` 的"手绘"页签为一个"开始绘制"按钮(关闭对话框并 `enter()`); 使 T020、T021 通过(依赖 T023)

**检查点**: 手绘心形被描出

---

## 阶段 5: 用户故事 3 - 导入 SVG (P3)

**独立测试**: 导入单路径 SVG 画出同样图形; 多路径提示"已使用其中最长的一条"; PNG / 无路径 / 含脚本的文件被明确拒绝且无网络请求(quickstart 故事 3).

### 测试(先写, 确认失败)

- [ ] T025 [P] [US3] 新增 `src/core/shape/pathData.test.ts`, 覆盖 contracts §4 的 `parsePathData`: M/L/H/V/C/S/Q/T/A/Z 各一例(含相对坐标、隐式重复、多段子路径); 贝塞尔与圆弧展平后的点落在解析几何计算的曲线上(< 1e-6); 畸形输入(`M 1`、`X 0 0`、`1e999`、空串、超长数字串)返回 `DATA_CORRUPT` 且**不抛异常**(fast-check 随机字符串也不抛)
- [ ] T026 [P] [US3] 新增 `src/features/shapes/importSvg.test.ts`(jsdom 的 `DOMParser`): 夹具 `single-path.svg` 得到一条路径; `multi-path.svg` 取最长且 `pathCount = 3`、`warnings` 含说明; `shapes.svg` 的 polygon/rect/circle 与 transform 正确转换(与手算顶点比较); `no-path.svg` → `NOT_FOUND`; `not-svg.txt` → `IMPORT_UNSUPPORTED`; 超过 `SVG_MAX_BYTES` / `SVG_MAX_POINTS` → `IMPORT_UNSUPPORTED`; 程序生成的 10 万点样本(恰在上限内)在 3 秒内完成且进度回调 ≥ 10 次; `with-script.svg`: 解析成功且 `window.__pwned` 未被设置、`fetch`/`Image` 未被调用(用 spy)
- [ ] T027 [P] [US3] 新增 `src/features/shapes/ImportPanel.test.tsx`: 文件选择与拖放都触发导入; 成功后 `documentStore` 被应用; 失败时对话框内显示 `AppError.message` 且函数不变; 导入超过 0.5 s(用假计时器与可注入的 `yield` 钩子)时显示"正在导入…"
- [ ] T028 [P] [US3] `tests/e2e/shapes.spec.ts` 故事 3 部分: `setInputFiles` 导入 `single-path.svg` → 画面变化; `multi-path.svg` → 提示文案; `with-script.svg` → 用 `page.on('request')` 断言导入期间没有任何非本站请求, 且 `window.__pwned` 为 undefined; `not-svg.txt` → 错误提示且分量数不变

### 实现

- [ ] T029 [P] [US3] 新建 `src/core/shape/pathData.ts`(纯字符串解析器, 约 150 行, 拆为 tokenizer / 指令处理 / 曲线展平三个 < 50 行的函数); 使 T025 通过
- [ ] T030 [US3] 新建 `src/features/shapes/importSvg.ts`(`DOMParser` 独立文档; **把 SVG 的屏幕坐标翻转为世界坐标(y 向上)**; 收集 path/polygon/polyline/rect/circle/ellipse/line; 应用祖先 transform; 大小与点数上限; 每 `SVG_YIELD_EVERY` 点 `await` 让出一次并回调进度); 使 T026 通过(依赖 T029)
- [ ] T031 [US3] 新建 `src/features/shapes/ImportPanel.tsx`(文件选择器 + 拖放区 + 进度 + 错误文字), 填入 `ShapeDialog` 的"导入"页签; 使 T027、T028 通过(依赖 T030)

**检查点**: 三个故事可独立验收

---

## 阶段 6: 完善

- [ ] T032 [P] `tests/e2e/a11y.spec.ts` 增加: 图形对话框三个页签各一次 axe 检查; 绘制模式的覆盖层(工具条按钮有名称、滑块有标签). `keyboard-only.spec.ts` 增加: 仅用键盘打开图形对话框、选择雪花、调分量数、应用; 仅用键盘导入文件(文件选择器可聚焦); **应用 200 分量后, 从第 60 行起连续 Tab 仍能到达第 61、62… 行的控件**(虚拟化不得切断 Tab 顺序: 实现需在焦点移动时把目标行滚入并渲染)
- [ ] T033 [P] `tests/visual/layout.spec.ts` 四个宽度下增加"图形对话框打开"与"绘制模式"两个状态的溢出检查
- [ ] T034 [P] 200 个分量的分量面板: 在 `ComponentsPanel.test.tsx` 断言应用 200 分量的雪花后只渲染可视窗口内的行; 在端到端里滚动到底部并编辑第 200 个分量的振幅
- [ ] T035 运行 `pnpm test:coverage`(≥ 80% / core ≥ 95%)、`lint`、`typecheck`、`size`、`test:perf`, 四个浏览器配置的 `test:e2e` 连续 3 次全绿; 确认功能 002 的回归快照与截图基线未改动
- [ ] T036 用 code-reviewer 与 security-reviewer 代理审查(重点: `pathData`/`importSvg` 对畸形与恶意输入的处理、DFT 的数值与索引、200 分量下的重渲染、绘制层与 `useStagePointer` 的互斥); 修复 CRITICAL/HIGH, 每个修复先补失败测试
- [ ] T037 [P] 更新 `README.md`(图形库、手绘、导入; 上限 200; 已知限制)、`CLAUDE.md`; 在功能 001 的 `data-model.md` 与 `research.md` R13 注明上限已改为 200
- [ ] T038 按 `quickstart.md` 人工走查, 记入 `checklists/acceptance.md`(由人确认的条目如实标注)

---

## 依赖关系

```
阶段 1 → 阶段 2(上限 200 + 转换 + applyGenerated + 覆盖确认 + 虚拟化 + 基准) ──┬─► US1 图形库 ──┐
                                                                             ├─► US2 手绘 ────┼─► 阶段 6
                                                                             └─► US3 导入 ────┘
```
- 三个故事都只依赖阶段 2; US2、US3 复用 US1 的 `applyShape.ts` 与 `ShapeDialog.tsx`(T017), 所以**US1 先做**, 之后 US2/US3 可并行.
- 共享文件串行点: `ShapeDialog.tsx`(T017 → T024 → T031)、`Stage.tsx`/`useStagePointer.ts`(仅 US2)、`ComponentsPanel.tsx`(T011 → T017 → T034).

## 并行示例

```bash
# 阶段 2 的测试一起写
Task: "T003 上限 200 与 applyGenerated 的用例"   Task: "T005 spectrum 的性质测试"   Task: "T006 VirtualList 用例"
# US1 完成后, US2 与 US3 两线并行
Task: "T018→T022→T019→T023→T020/T021→T024 (手绘)"    Task: "T025→T029→T026→T030→T027/T028→T031 (导入)"
```

## 实施策略

1. 阶段 1–2: 上限 200 的性能配套要**先用基准验证**(T012), 这是本功能最大的技术风险.
2. **US1 为 MVP**: 三次操作画出雪花, 直接兑现用户的例子.
3. US2 → US3 → 阶段 6. 每个故事完成后跑该故事的端到端与回归快照, 审查后提交.

## 分析修订 (2026-10-06)

按 `/speckit.analyze` 的发现并经用户确认, 已更新 research / data-model / contracts 与本文件: F1 频率索引限 `|n| ≤ 500`; F2 `normalize` 不翻转 y, 由手绘与 SVG 的来源层翻转; E1 10 万点 SVG 的耗时与进度用例; E2 周期用常量计算; C3 虚拟化不切断 Tab 顺序.

## 备注

- 雪花达不到 1% 偏差时降 Koch 阶数, 不要提高 `MAX_COMPONENTS`.
- 若 200 分量基准不达标, 先调 `TRAIL_EVALUATION_BUDGET`; 仍不达标再考虑 Worker, 并先补 plan.md 的"复杂度跟踪".
