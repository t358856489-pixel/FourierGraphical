---
description: "傅立叶函数可视化编辑器的实现任务列表"
---

# 任务: 傅立叶函数可视化编辑器

**输入**: 来自 `/specs/001-fourier-visual-editor/` 的设计文档
**前置条件**: plan.md、spec.md、research.md、data-model.md、contracts/core-api.md、contracts/persisted-function.schema.json、quickstart.md

**测试**: **包含**. plan.md 的门控与 research R11 要求严格 TDD(先写失败测试再实现), 覆盖率整体 ≥ 80%、`src/core` ≥ 95%. 每个"测试"小节的任务必须先完成并**确认失败**, 再开始同一故事的实现任务.

**组织结构**: 任务按用户故事分组, 每个故事完成后都是一个可独立验收的增量.

## 格式: `[ID] [P] [Story] 描述`
- **[P]**: 可以并行运行(不同文件, 且不依赖同阶段未完成的任务)
- **[Story]**: US1–US5 对应 spec.md 的用户故事 1–5
- 路径相对于仓库根目录 `/Users/tanglinjie/claude-project/FourierGraphical/`

## 通用约束(适用于每个任务)
- 领域数据不可变; `src/core/` 只写纯函数, 可失败操作返回 `Result<T>`(contracts/core-api.md 通用约定), 不抛异常.
- 图形必须是 `(函数, t)` 的纯函数, **禁止**逐帧累加角度或轨迹(research R4、R5).
- 单文件 < 800 行, 单函数 < 50 行; 取值范围一律引用 `src/core/ranges.ts`, 不写魔法数字.
- 面向用户的文案为简体中文; 不使用 `innerHTML`; 动效只用 `transform`/`opacity`.
- 单元/组件测试与被测文件同目录(`*.test.ts(x)`), AAA 结构, 用行为描述命名.

---

## 阶段 1: 设置(共享基础设施)

**目的**: 项目脚手架与工具链

- [X] T001 在仓库根目录用 pnpm 初始化 Vite 8 + React 19 + TypeScript 7 项目: 创建 `package.json`(scripts: `dev`、`build`、`preview`、`test`、`test:coverage`、`test:e2e`、`lint`、`typecheck`)、`tsconfig.json`(`strict: true`、`noUncheckedIndexedAccess: true`、target ES2022)、`vite.config.ts`、`index.html`、`src/main.tsx`、`src/App.tsx`、`.gitignore`; 按 plan.md"源代码"一节创建空目录结构
- [X] T002 安装依赖: 运行时 `react`、`react-dom`、`zustand`、`zod`、`idb-keyval`、`mediabunny`; 开发时 `vitest`、`@vitest/coverage-v8`、`@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`jsdom`、`fast-check`、`fake-indexeddb`、`@playwright/test`、`@axe-core/playwright`、`eslint`、`typescript-eslint`、`eslint-plugin-react-hooks`、`eslint-plugin-jsx-a11y`、`prettier`
- [X] T003 [P] 配置 `eslint.config.js`(typescript-eslint strict、react-hooks、jsx-a11y; 禁止 `no-param-reassign`、`no-console`)与 `.prettierrc`
- [X] T004 [P] 配置 `vitest.config.ts`(jsdom 环境、`src/test/setup.ts` 引入 jest-dom 与 `fake-indexeddb/auto`、覆盖率门槛: 全局 80%、`src/core/**` 95%)
- [X] T005 [P] 配置 `playwright.config.ts`(projects: chromium、firefox、webkit; `webServer` 指向 `pnpm preview`; testDir `tests/`; 截图基线目录 `tests/visual/__screenshots__`)
- [X] T006 [P] 建立设计令牌 `src/styles/tokens.css`: 按 research R10"实验仪器 / 示波器"方向定义画布深色荧光屏色、面板暖色纸面色、12 个分量语义色 `--component-c0`…`--component-c11`(在两种表面上均满足 WCAG AA)、字号阶梯、间距节奏、时长与缓动; 并创建 `src/styles/typography.css`、`src/styles/global.css`(含 `prefers-reduced-motion` 下关闭过渡)
- [X] T007 [P] 自托管字体: 选定一族界面无衬线 + 一族等宽数值字体, 子集化为 woff2 放入 `public/fonts/`, 在 `src/styles/typography.css` 用 `@font-face`(`font-display: swap`)声明, 中文回退到系统字体; 在 `index.html` 仅 preload 界面字体的常规字重
- [X] T008 [P] 用 `vite.config.ts` 中仅在生产构建生效的插件注入 research R12 的 CSP(章程: 不得破坏开发服务器), 设置 `lang="zh-CN"`、viewport 与页面标题

---

## 阶段 2: 基础(阻塞前置条件)

**目的**: 所有故事共用的类型、数学内核、通用控件与应用骨架

**⚠️ 关键**: 此阶段完成前不得开始任何用户故事

### 基础的测试(先写, 确认失败)

- [X] T009 [P] 在 `src/core/keyframes.test.ts` 编写 contracts/core-api.md §1 契约表的全部用例: constant 的 `evaluate`/`integrate`; 首关键帧前、末关键帧后取值; linear 中点(`0→1` 于 0–5s 时 `evaluate(2.5) === 0.5`); hold 恒值; smooth 为 smoothstep 且端点导数为 0; 三种 easing 的 `integrate` 与 research R4 表中闭式一致; fast-check 性质: 随机轨道上闭式 `integrate` 与 Simpson 数值积分之差 < 1e-9, `integrate` 处处连续
- [X] T010 [P] 在 `src/render/viewport.test.ts` 编写世界↔屏幕坐标互逆、`zoom='auto'` 时按 `boundingRadius` 适配并留 10% 边距、手动 zoom 钳制在 0.1–20、`pixelRatio` 缩放的用例
- [X] T011 [P] 在 `src/ui/NumberField.test.tsx` 编写 FR-005 用例: 输入 `abc` → 显示"请输入数字"并回到上一个有效值; 输入越界值 → 显示允许范围并回到上一个有效值; 合法值在 blur/Enter 时触发 `onCommit`; 方向键按 `step` 增减; 错误信息通过 `aria-describedby` 关联
- [X] T012 [P] 在 `src/ui/Slider.test.tsx` 编写: 拖动过程中持续触发 `onInput`, 释放时触发一次 `onCommit`(供"一次拖拽 = 一步撤销"使用); 键盘方向键/PageUp/PageDown/Home/End 可操作; 渲染为原生 `<input type="range">` 并带可访问名称

### 基础的实现

- [X] T013 在 `src/core/types.ts` 定义 data-model.md 的全部只读类型(`FourierFunction`、`HarmonicComponent`、`ParamTrack` 可辨识联合、`Keyframe`、`Easing`、`ParamName`、`PresentationMode`、`PlaybackState`、`LoopRegion`、`ViewSettings`、`History`、`Vec2`)以及 contracts/core-api.md 的 `Result<T>`、`AppError`、`ErrorCode`, 并导出 `ok()`/`err()` 构造函数
- [X] T014 [P] 在 `src/core/ranges.ts` 按 research R13 表定义取值范围常量(`AMPLITUDE_RANGE`、`FREQUENCY_RANGE`、`PHASE_RANGE`、`SPEED_RANGE`、`STEP_SECONDS`、`MIN_LOOP_SECONDS`、`MAX_COMPONENTS`、`MAX_KEYFRAMES`、`MAX_HISTORY`、`KEYFRAME_TIME_QUANTUM`、`DEFAULT_TRAIL_SECONDS`、`PRESET_BASE_FREQUENCY`、`MAX_VIDEO_SECONDS`)和 `rangeOf(param: ParamName)`(依赖 T013)
- [X] T015 在 `src/core/keyframes.ts` 实现 `evaluate` 与 `integrate`: 二分查找所在段, 按 research R4 的三个闭式公式计算, 每条轨道的段积分前缀和用 `WeakMap<ParamTrack, Float64Array>` 缓存; 使 T009 通过
- [X] T016 [P] 在 `src/render/viewport.ts` 实现 `createViewport(view, boundingRadius, size)` 返回 `{ toScreen, toWorld, scale }`; 使 T010 通过
- [X] T017 [P] 在 `src/render/theme.ts` 实现 `readRenderTheme(root: HTMLElement): RenderTheme`, 用 `getComputedStyle` 从 T006 的 CSS 令牌解析画布背景、网格、轨迹、向量、12 个分量色; 导出 `RenderTheme` 类型与测试用的 `FALLBACK_THEME`
- [X] T018 [P] 在 `src/ui/NumberField.tsx` + `src/ui/number-field.css` 实现带校验的数值输入; 使 T011 通过
- [X] T019 [P] 在 `src/ui/Slider.tsx` + `src/ui/slider.css` 实现滑块(仪器旋钮风格的轨道与拇指, 设计好 hover/focus-visible/active 三态); 使 T012 通过
- [X] T020 [P] 在 `src/ui/` 实现 `Toggle.tsx`、`IconButton.tsx`、`Dialog.tsx`(基于原生 `<dialog>`, 焦点陷阱与 Esc 关闭)、`Toast.tsx` + `ToastRegion.tsx`(`aria-live="polite"`)及各自 css; 为 Dialog 的焦点管理和 Toast 的播报在同目录写组件测试
- [X] T021 [P] 在 `src/hooks/` 实现 `useReducedMotion.ts`(订阅 `matchMedia('(prefers-reduced-motion: reduce)')`)与 `useAnimationFrame.ts`(回调收到以秒为单位的墙钟增量, 卸载时取消), 并各写一个单元测试
- [X] T022 在 `src/state/viewStore.ts`(Zustand, data-model"ViewSettings"默认值: `zoom:'auto'`、四个显示开关为 true、`trailSeconds:8`)与 `src/state/playbackStore.ts`(仅状态与 data-model 规定的初始值 `time:8`、`isPlaying:false`、`speed:1`、`loop:null`、`maxReachedTime:8`; 动作留待 US2)中建立 store(依赖 T013)
- [X] T023 在 `src/App.tsx` + `src/app.css` 搭建语义化应用骨架: `<header>`(标题与函数名占位)、`<main>` 内三个带 `aria-labelledby` 的 `<section>`——画布舞台、分量面板、底部时间区; 桌面为舞台居左占主导 + 右侧面板 + 底部通栏, <768px 时改为纵向堆叠且舞台吸顶; 挂载 `ToastRegion`; 在 `src/main.tsx` 引入三份全局样式

**检查点**: `pnpm test`、`pnpm typecheck`、`pnpm lint` 全绿; `pnpm dev` 能看到空骨架

---

## 阶段 3: 用户故事 1 - 图形化编辑傅立叶函数并实时看到图形(优先级: P1)🎯 MVP

**目标**: 用滑块、数值框、画布拖拽增删和调整分量, 图形在两种呈现模式下即时更新, 支持撤销/重做.

**独立测试**: 打开应用看到示例函数的图形; 添加 3 个分量并分别调整振幅、频率、相位, 图形在拖动过程中持续变化(quickstart"故事 1"第 1–7 步).

### 用户故事 1 的测试(先写, 确认失败)⚠️

- [X] T024 [P] [US1] 在 `src/core/tracks.test.ts` 编写 `setValueAt` 的用例, 覆盖 data-model"状态转换"表的四种改值情形(constant→constant; animated 且 t 处无关键帧→插入; animated 且 t 处有关键帧→替换; 时刻按 0.001 量化判等)、越界返回 `OUT_OF_RANGE` 且原轨道引用不变、非有限数返回 `NOT_A_NUMBER`、第 51 个关键帧返回 `KEYFRAME_LIMIT`
- [X] T025 [P] [US1] 在 `src/core/function.test.ts` 编写 contracts §3 用例(`applyPreset` 除外): `createDefaultFunction` 返回 3 个启用分量的示例; `addComponent` 默认值符合 data-model(振幅 1、频率 =(启用数+1)×0.2、相位 0、颜色轮换)且第 51 个返回 `COMPONENT_LIMIT`; `removeComponent`/`setComponentEnabled`/`moveComponent`/`updateTrack`/`setPresentationMode` 返回新对象且未涉及的分量保持引用相等; `rename` 对空白与超过 60 字符返回 `INVALID_NAME`
- [X] T026 [P] [US1] 在 `src/core/evaluator.test.ts` 编写 contracts §4 中与固定参数有关的用例: 0 个启用分量时 `vectorChain` 为空且 `tipAt=(0,0)`; 停用分量不参与; 单分量 `A=2,f=1,phase=90°` 在 `t=0` 时末端为 `(0,2)`; 负频率反向旋转; `vectorChain` 的 `from/to` 首尾相接且 `radius` 等于振幅; `sampleTrail` 区间为 `[max(0,t−W),t]`、`t=0` 返回空、点数不超过 `maxPoints`、采样率 ≥ `32×max|f|`; `boundingRadius` = 启用分量振幅之和; `t=1e6` 时与用 `frac` 前分离整数圈数的参考实现之差 < 1e-6
- [X] T027 [P] [US1] 在 `src/core/history.test.ts` 编写 contracts §6 用例: `commit` 相同引用不产生新步; `past` 超过 50 丢弃最旧; `commit` 清空 `future`; 空栈 `undo`/`redo` 返回原对象; undo→redo 往返恢复同一引用
- [X] T028 [P] [US1] 在 `src/render/drawFrame.test.ts` 用记录调用的假 `ctx` 编写: `waveform` 模式同时绘制本轮区与波形区、`drawing2d` 只绘制本轮; `showVectors/showCircles/showTrail/showGrid` 各自为 false 时对应绘制调用不出现; `highlightedComponentId` 对应的向量用强调线宽、其余降低不透明度; 0 个启用分量时不抛异常; 相同入参两次调用的调用序列完全一致(确定性)
- [X] T029 [P] [US1] 在 `src/state/documentStore.test.ts` 编写: `previewTrack`(拖拽中)只改 `present` 不增加历史, 随后 `commitEdit` 只增加一步; `undo`/`redo` 动作; `setPresentationMode` 不进入历史; 失败的编辑不改变状态并通过返回值给出 `AppError`
- [X] T030 [P] [US1] 在 `src/features/components-panel/ComponentsPanel.test.tsx` 编写: 点击"添加分量"后列表多一行; 达到 50 个时按钮禁用并显示原因; 删除、停用/启用、上移/下移; 拖动振幅滑块时 store 的 `present` 持续变化而历史只增一步; 数值框非法输入保留旧值; 0 个分量时显示空状态文案; 点击行的"高亮"后 `viewStore.highlightedComponentId` 更新
- [X] T031 [P] [US1] 在 `tests/e2e/us1-edit.spec.ts` 编写 Playwright 流程对应 spec 故事 1 的 5 条验收场景 + quickstart 故事 1 第 3、6、7 步(拖拽向量端点同步列表数值; `Ctrl/Cmd+Z` 一次拖拽一步; 切换模式后分量与时间不变)

### 用户故事 1 的实现

- [X] T032 [P] [US1] 在 `src/core/tracks.ts` 实现 `setValueAt`(含私有的 `quantizeTime`、`insertSorted`); 使 T024 通过
- [X] T033 [P] [US1] 在 `src/core/function.ts` 实现 `createDefaultFunction`、`addComponent`、`removeComponent`、`setComponentEnabled`、`moveComponent`、`updateTrack`、`rename`、`setPresentationMode`(id 用 `crypto.randomUUID()`, 通过可注入的 `idFactory` 参数保持可测); 使 T025 通过
- [X] T034 [P] [US1] 在 `src/core/evaluator.ts` 按 data-model"派生量"公式实现 `vectorChain`、`tipAt`、`sampleTrail`(返回 `[τ,x,y,…]` 的 `Float64Array`)、`boundingRadius`; 圈数先取小数部分再乘 2π; 使 T026 通过(依赖 T015)
- [X] T035 [P] [US1] 在 `src/core/history.ts` 实现 `createHistory`、`commit`、`undo`、`redo`; 使 T027 通过
- [X] T036 [US1] 在 `src/state/documentStore.ts` 实现 Zustand store: 状态 `{ history, lastSavedRef }`; 动作 `previewTrack`、`commitEdit`、`setParamValue(componentId, param, value, t)`(内部调用 `setValueAt`)、`addComponent`、`removeComponent`、`setEnabled`、`moveComponent`、`setPresentationMode`、`undo`、`redo`; 选择器 `selectFunction`、`selectCanUndo`、`selectCanRedo`、`selectHasUnsavedChanges`; 使 T029 通过(依赖 T032、T033、T035)
- [X] T037 [P] [US1] 在 `src/render/drawGrid.ts` 实现坐标网格与坐标轴(示波器刻度风格, 线宽按 `pixelRatio` 校正)
- [X] T038 [P] [US1] 在 `src/render/drawEpicycles.ts` 实现: 按 `vectorChain` 画圆与向量(各用分量色)、末端点、带透明度渐隐的轨迹折线(余辉效果); 处理高亮
- [X] T039 [P] [US1] 在 `src/render/drawWaveform.ts` 实现: 用同一批轨迹采样点画 `y` 对 `t−τ` 的波形, 并画一条从本轮末端到波形起点的水平连接线
- [X] T040 [US1] 在 `src/render/drawFrame.ts` 实现 contracts §8 的 `drawFrame`: 清屏→按 `presentationMode` 划分本轮区/波形区→依显示开关调用 T037–T039; 除 `ctx` 外无副作用; 使 T028 通过(依赖 T016、T034、T037–T039)
- [X] T041 [US1] 在 `src/features/stage/Stage.tsx` + `stage.css` + `useStageLoop.ts` 实现画布舞台: `ResizeObserver` 维护尺寸与 `devicePixelRatio`; `useAnimationFrame` 循环里用 `store.getState()` 直接读取三个 store 并调用 `drawFrame`(**不触发 React 渲染**), 仅当函数引用/时间/视图/尺寸任一变化时重绘; `<canvas role="img">` 的 `aria-label` 为动态摘要("N 个分量, 当前时刻 t 秒, 波形模式")(依赖 T017、T022、T036、T040)
- [X] T042 [US1] 在 `src/features/stage/useVectorDrag.ts` 实现 FR-004: pointerdown 命中最近的向量端点(命中半径 ≥ 24 CSS px 以适配触摸)→拖动中把指针位置换算为该分量的振幅与相位并调用 `previewTrack`→pointerup 时 `commitEdit`; 使用 pointer capture; 为换算函数 `pointerToAmplitudePhase` 在 `useVectorDrag.test.ts` 写单元测试(依赖 T041)
- [X] T043 [US1] 在 `src/features/stage/useZoomPan.ts` 实现 FR-011: 滚轮/双指捏合缩放(以指针为中心)、空白处拖动平移、双击或"适配"按钮回到 `zoom:'auto'`; 键盘 `+`/`-`/`0`(依赖 T041)
- [X] T044 [P] [US1] 在 `src/features/stage/StageToolbar.tsx` + `stage-toolbar.css` 实现: 呈现模式的分段切换(`role="radiogroup"`)、向量/圆/轨迹/网格四个显示开关(FR-012)、"适配视图"按钮
- [X] T045 [P] [US1] 在 `src/features/components-panel/ParamControl.tsx` + `param-control.css` 实现单个参数控件: `Slider` + `NumberField` 联动, 拖动走 `previewTrack`、释放与数值提交走 `commitEdit`; 取值范围、步长、单位后缀来自 `ranges.ts`; 显示当前时刻的求值(`evaluate(track, time)`)
- [X] T046 [US1] 在 `src/features/components-panel/ComponentRow.tsx` + `ComponentsPanel.tsx` + `components-panel.css` 实现分量列表: 每行含分量色标、三个 `ParamControl`、启用开关、高亮、上移/下移、删除; 面板头部含"添加分量"(达上限禁用并说明)、撤销/重做按钮; 0 个分量时的空状态; 行 hover/选中时联动 `viewStore.highlightedComponentId`; 使 T030 通过(依赖 T036、T045)
- [X] T047 [US1] 在 `src/hooks/useKeyboardShortcuts.ts` 实现全局快捷键注册(焦点在 `input`/`textarea`/`[contenteditable]` 内时不触发), 并注册 `Ctrl/Cmd+Z`、`Shift+Ctrl/Cmd+Z`; 写单元测试
- [X] T048 [US1] 在 `src/App.tsx` 装配 `Stage`、`StageToolbar`、`ComponentsPanel` 与快捷键; 首次加载用 `createDefaultFunction()`(FR-007); 编辑失败的 `AppError.message` 通过 Toast 显示; 使 T031 通过

**检查点**: 故事 1 可独立演示——静态时刻(t=8s)下的完整图形编辑

---

## 阶段 4: 用户故事 2 - 控制时间, 让图形动起来(优先级: P2)

**目标**: 播放、暂停、重置、调速、拖动/输入时间、单步、手动循环区间; 播放中编辑不打断动画.

**独立测试**: 用示例函数依次执行播放、暂停、调速、拖动时间轴、重置, 图形表现符合预期(quickstart"故事 2"第 1–7 步).

### 用户故事 2 的测试(先写, 确认失败)⚠️

- [X] T049 [P] [US2] 在 `src/core/playback.test.ts` 编写 contracts §5 用例: `isPlaying=false` 时 `advance` 返回同一引用; `time += dt×speed`; `dt` 钳制到 0.25s; 循环启用时越过 `end` 按模回绕, 单次跨越多个循环长度也正确; 循环未启用或为 null 时持续向前; `maxReachedTime` 单调推进; `seek` 负值钳制为 0 且可超过 `maxReachedTime`; `step` 为 ±1/60 且不改变 `isPlaying`; `setSpeed` 越界返回 `OUT_OF_RANGE`; `setLoop` 在 `end−start<0.1` 或 `start<0` 时返回 `INVALID_LOOP_REGION`; `reset` 后 `time=0,isPlaying=false,maxReachedTime=0`
- [X] T050 [P] [US2] 在 `src/render/trailCache.test.ts` 编写: 同一函数引用且 `t` 小幅前进时只对新增区间采样, 结果与 `sampleTrail` 整体重算逐点相等(容差 1e-12); 函数引用变化、`t` 后退、`t` 跳跃超过窗口、`windowSeconds` 变化时整体重算
- [X] T051 [P] [US2] 在 `src/features/transport/Transport.test.tsx` 编写: 播放/暂停按钮切换 `isPlaying` 且 `aria-pressed` 与名称同步; 重置; 速度控件范围 0.1–10; 时间输入框提交后 `seek`; 循环区间编辑器对非法区间显示提示并保留上一个有效区间; 播放状态变化在 live region 播报一次而时间读数不在 live region 内
- [X] T052 [P] [US2] 在 `src/features/timeline/Timeline.test.tsx` 编写: 滑块右端 = `max(maxReachedTime, loop.end, 最晚关键帧时刻, 10)`; 拖动滑块调用 `seek`; 循环区间在轨道上以区段显示; 方向键按 `STEP_SECONDS` 步进
- [X] T053 [P] [US2] 在 `tests/e2e/us2-playback.spec.ts` 编写故事 2 的 6 条验收场景 + quickstart 故事 2 第 5、7 步; 时间断言用页面暴露的时间读数与 `expect.poll`, 不用固定 `waitForTimeout`; 另加一条: `emulateMedia({ reducedMotion: 'reduce' })` 时打开页面不自动播放(FR-025), 默认情况下自动播放

### 用户故事 2 的实现

- [X] T054 [P] [US2] 在 `src/core/playback.ts` 实现 `advance`、`seek`、`step`、`setSpeed`、`setLoop`、`reset`; 使 T049 通过
- [X] T055 [P] [US2] 在 `src/render/trailCache.ts` 实现 research R5 的环形缓冲 `createTrailCache()` → `get(fn, t, windowSeconds, maxPoints): Float64Array`; 使 T050 通过
- [X] T056 [US2] 在 `src/state/playbackStore.ts` 增加动作 `play`、`pause`、`toggle`、`tick(dt)`、`seek`、`step`、`setSpeed`、`setLoop`、`reset`, 全部委托 `src/core/playback.ts`(依赖 T054)
- [X] T057 [US2] 在 `src/features/stage/useStageLoop.ts` 中: 每帧调用 `playbackStore.tick(dt)`; 把轨迹采样改为经 `trailCache` 获取并传入 `drawFrame`(给 `drawFrame` 增加可选的预采样轨迹参数, 缺省时自行调用 `sampleTrail`, 保持其纯函数性质); 验证播放中编辑参数不重置时间(FR-018)(依赖 T055、T056)
- [X] T058 [P] [US2] 在 `src/features/transport/TransportBar.tsx` + `transport.css` 实现播放/暂停、重置、单步前进/后退按钮与等宽字体的时间读数(读数用 ref + store 订阅直接写文本节点, 不走 React 渲染)
- [X] T059 [P] [US2] 在 `src/features/transport/SpeedControl.tsx`、`TimeInput.tsx`、`LoopRegionEditor.tsx` 实现速度(0.1–10×)、直接输入时间跳转、循环区间起止与启用开关(非法区间显示 `AppError.message`)
- [X] T060 [US2] 在 `src/features/timeline/Timeline.tsx` + `timeline.css` 实现时间轴: 原生 range 作为可访问的主滑块 + 其上的自绘刻度、播放头、循环区段; 右端范围规则按 data-model; 使 T052 通过(依赖 T056)
- [X] T061 [US2] 在 `src/hooks/useKeyboardShortcuts.ts` 的注册处加入空格(播放/暂停)、`←`/`→`(步进)、`Home`(重置); 在 `src/App.tsx` 装配 transport 与 timeline, 并实现启动行为: `useReducedMotion()` 为 false 时自动 `play()`, 为 true 时保持暂停; 使 T051、T053 通过

**检查点**: 故事 1 + 2 = 可发布的 MVP

---

## 阶段 5: 用户故事 3 - 用关键帧让参数随时间变化(优先级: P3)

**目标**: 为振幅/频率/相位添加、移动、修改、删除关键帧, 三种过渡方式, 变频率下旋转连续.

**独立测试**: 为一个分量的振幅在 0s 与 5s 设关键帧(0 与 1), 播放时向量长度连续增长, 拖到 2.5s 显示 0.5(quickstart"故事 3"第 1–7 步).

### 用户故事 3 的测试(先写, 确认失败)⚠️

- [X] T062 [P] [US3] 在 `src/core/tracks.test.ts` 追加 contracts §2 其余用例: `addKeyframe` 把 constant 变为单关键帧 animated、在 animated 上原位插入且新关键帧的值等于插入前 `evaluate` 的值、超过 50 返回 `KEYFRAME_LIMIT`; `moveKeyframe` 保持排序、移到已占用时刻时取代原有者、`from` 不存在返回 `NOT_FOUND`; `setEasing`; `removeKeyframe` 删除最后一个返回 `constant(该值)`
- [X] T063 [P] [US3] 在 `src/core/evaluator.animated.test.ts` 编写 contracts §4 的关键帧相关用例: 频率 `1→−1`(0–4s, linear)区间内相邻 1ms 的 `tipAt` 位移不超过契约给出的上界(无跳变)且经过 0 时方向反转; **fast-check 性质**: 对随机函数, `tipAt(fn,t)` 与"以 1ms 步长从 0 数值累加角度到 t"的参考实现之差 < 1e-3(FR-018f); 振幅过渡到 0 时不产生 NaN; `boundingRadius` 取各启用分量在全部关键帧上的最大振幅之和
- [X] T064 [P] [US3] 在 `src/state/documentStore.keyframes.test.ts` 编写: `addKeyframe`/`moveKeyframe`/`removeKeyframe`/`setKeyframeEasing` 各为一步可撤销; 对已动画参数调用 `setParamValue` 在无关键帧的时刻自动新增、在有关键帧的时刻更新(FR-018e); 删除带关键帧的分量后撤销, 关键帧完整恢复
- [X] T065 [P] [US3] 在 `src/features/timeline/KeyframeLane.test.tsx` 编写: 每个关键帧渲染为可聚焦按钮, 名称含参数名、时刻、值; `←/→` 按 0.1s、`Shift+←/→` 按 0.001s 移动; `Delete` 删除; `Enter` 打开检查器; 选中分量的关键帧带强调样式、停用分量的关键帧不渲染(FR-018d); 指针拖动在释放时只提交一步
- [X] T066 [P] [US3] 在 `tests/e2e/us3-keyframes.spec.ts` 编写故事 3 的 6 条验收场景 + quickstart 故事 3 第 5 步的**一致性检查**: 连续播放到约 3s 暂停, 读取精确时间 `t*` 并截取画布; 重置后在时间框输入 `t*`; 两次画布截图逐像素一致

### 用户故事 3 的实现

- [X] T067 [US3] 在 `src/core/tracks.ts` 实现 `addKeyframe`、`moveKeyframe`、`setEasing`、`removeKeyframe`; 使 T062 通过
- [X] T068 [US3] 在 `src/core/evaluator.ts` 把 `boundingRadius` 扩展为取关键帧上的最大振幅, 并确认 `vectorChain`/`sampleTrail` 的采样率使用"各启用分量频率轨道的最大绝对值"; 使 T063 通过
- [X] T069 [US3] 在 `src/state/documentStore.ts` 增加 `addKeyframe`、`moveKeyframe`(拖动中 preview, 释放 commit)、`removeKeyframe`、`setKeyframeEasing`、`setKeyframeValue` 动作与选择器 `selectLatestKeyframeTime`; 使 T064 通过(依赖 T067)
- [X] T070 [US3] 在 `src/features/components-panel/ParamControl.tsx` 增加: "已动画"标识(分量色的菱形图标 + 文本替代)、"在当前时刻添加关键帧"按钮(达 50 个时禁用并说明)、"上一个/下一个关键帧"跳转; 已动画时控件显示并随播放更新当前求值(订阅 `playbackStore.time`, 节流到每帧一次)
- [X] T071 [P] [US3] 在 `src/features/timeline/KeyframeLane.tsx` + `keyframe-lane.css` 实现关键帧轨道: 按"分量 × 参数"分行, 菱形标记用分量色; 指针拖动与键盘移动; 使 T065 通过(依赖 T069)
- [X] T072 [P] [US3] 在 `src/features/timeline/KeyframeInspector.tsx` 实现选中关键帧的检查器: 时刻与值的 `NumberField`、过渡方式三选一(匀速 / 缓入缓出 / 保持, 附小曲线图示)、删除按钮
- [X] T073 [US3] 在 `src/features/timeline/Timeline.tsx` 装配 `KeyframeLane` 与 `KeyframeInspector`: 共用同一时间→像素映射; 点击关键帧时 `seek` 到其时刻; 行数多时轨道区可纵向滚动而播放头保持可见; 使 T066 通过

**检查点**: 图形可随时间变形; 拖动时间轴与连续播放结果一致

---

## 阶段 6: 用户故事 4 - 从预置波形快速开始(优先级: P4)

**目标**: 方波/锯齿波/三角波预设 + 可调分量个数, 覆盖前确认.

**独立测试**: 选"方波", 把分量数从 1 调到 20, 图形逐步逼近方波(quickstart"故事 4").

### 用户故事 4 的测试(先写, 确认失败)⚠️

- [X] T074 [P] [US4] 在 `src/core/presets.test.ts` 编写: 三种预设第 n 项的频率/振幅/相位符合 data-model"PresetDefinition"表; 全部为 constant 轨道; `count` 超出 1–50 返回 `OUT_OF_RANGE`; 方波 `count=20` 时 `y(t)` 在远离跳变点处与 ±1 之差 < 0.2; 锯齿波与三角波在 `count=30` 时与理想波形的均方误差低于阈值
- [X] T075 [P] [US4] 在 `src/features/presets/PresetPicker.test.tsx` 编写: 选择预设后分量列表被替换; 调整个数时列表同步增减且整个"拖动个数滑块"只占一步撤销; `hasUnsavedChanges` 为 true 时先弹确认(文案提到关键帧将被丢弃), 取消则不变、确认则应用; 为 false 时直接应用
- [X] T076 [P] [US4] 在 `tests/e2e/us4-presets.spec.ts` 编写故事 4 的 3 条验收场景, 并断言从点击预设到出现 20 个分量不超过 3 次交互(SC-004)

### 用户故事 4 的实现

- [X] T077 [P] [US4] 在 `src/core/presets.ts` 实现 `PRESETS`(id、中文名、`generate(count, baseFrequency)`); 使 T074 通过
- [X] T078 [US4] 在 `src/core/function.ts` 增加 `applyPreset` 并在 `function.test.ts` 补用例; 在 `src/state/documentStore.ts` 增加 `applyPreset`(preview/commit 两段式, 以支持个数滑块)(依赖 T077)
- [X] T079 [US4] 在 `src/features/presets/PresetPicker.tsx` + `presets.css` 实现: 三个带波形缩略图(内联 SVG)的预设按钮、个数滑块(1–50)、覆盖确认 `Dialog`; 在 `src/App.tsx` 装配到分量面板头部; 使 T075、T076 通过

**检查点**: 3 步内得到 20 个分量的方波逼近

---

## 阶段 7: 用户故事 5 - 保存与导出作品(优先级: P5)

**目标**: 本地保存/打开/重命名/删除、刷新后恢复草稿、导出 PNG 与视频.

**独立测试**: 保存后刷新并重新打开, 分量/关键帧/时间设置一致; 导出图片与 10 秒视频内容与画面一致(quickstart"故事 5").

### 用户故事 5 的测试(先写, 确认失败)⚠️

- [X] T080 [P] [US5] 在 `src/core/schema.test.ts` 编写: 合法函数通过; 逐项违反 `contracts/persisted-function.schema.json`(未知 `schemaVersion`、51 个分量、关键帧未严格递增、分量 id 重复、值越出参数范围、多余字段、`name` 超长)均失败; `tests/fixtures/corrupt-*.json` 全部失败; `tests/fixtures/sample-function.json` 通过
- [X] T081 [P] [US5] 在 `src/storage/repositoryContract.ts` 编写可复用的契约测试套件 `describeRepositoryContract(name, factory)`, 覆盖 contracts §7: save→findById 往返深度相等; `save` 写入 `updatedAt`; `findAll` 按 `updatedAt` 倒序; `rename`; `remove` 后 `NOT_FOUND`; 底层写入损坏数据后 `findById` 返回 `DATA_CORRUPT` 而 `findAll` 把该项标为 `readable:false` 且不影响其他项; `loadDraft` 无草稿时为 `null`; 任何方法都不抛异常; 并在 `InMemoryFunctionRepository.test.ts` 与 `IndexedDbFunctionRepository.test.ts` 中各调用一次, 后者另测存储不可用时返回 `STORAGE_UNAVAILABLE`、配额错误映射为 `STORAGE_QUOTA`
- [X] T082 [P] [US5] 在 `src/export/exportVideo.test.ts` 用注入的假编码器编写 contracts §9 用例: 帧数 = `ceil((end−start)/speed×fps)`; 第 i 帧函数时间 = `start+i·speed/fps`、时间戳 = `i/fps`; 成片时长 > 60s 返回 `OUT_OF_RANGE`; `signal` 中止返回 `EXPORT_ABORTED` 且调用了编码器的释放; `onProgress` 单调不减并以 1 结束; 编码器抛错映射为 `EXPORT_FAILED`; 在 `src/export/videoSupport.test.ts` 编写: 无 `VideoEncoder` 时 `supported:false` 且 `reason` 为中文、H.264 不支持时同样 `supported:false`(不提供 WebM 回退, FR-023d)
- [X] T083 [P] [US5] 在 `src/state/autosave.test.ts` 编写(假定时器): 编辑后 500ms 防抖只写一次草稿; 草稿含 `function`、`playback:{time,speed,loop}`、`view`、`savedFunctionId` 且不含 `isPlaying`; 写入失败只提示一次 Toast 而不打断编辑
- [X] T084 [P] [US5] 在 `src/features/library/Library.test.tsx` 与 `src/features/export-dialog/ExportDialog.test.tsx` 编写: 保存并命名后出现在列表; 打开某项前若有未保存修改则确认; 重命名、删除(带确认); 不可读条目显示"无法读取"且不可打开; 导出对话框默认区间取循环区间、否则 0–10s; 成片时长超过 60s 时禁用"开始"并说明; 进度条与取消; `supported:false` 时视频页签禁用并显示原因, 图片导出仍可用
- [X] T085 [P] [US5] 在 `tests/e2e/us5-save-export.spec.ts` 编写故事 5 的 5 条验收场景: 保存→刷新→草稿恢复→从列表打开后分量/关键帧/循环区间一致; 导出 PNG 的下载事件与非空文件; 导出 2 秒视频得到 `video/mp4` 或 `video/webm` 的非空文件(仅 chromium 项目断言内容, 其余浏览器断言"成功或入口被正确禁用"); 导出中取消不产生下载

### 用户故事 5 的实现

- [X] T086 [P] [US5] 创建 `tests/fixtures/sample-function.json`(含关键帧的合法函数)与 `tests/fixtures/corrupt-*.json`(至少 5 种损坏形态)
- [X] T087 [P] [US5] 在 `src/core/schema.ts` 用 Zod 4 实现 `fourierFunctionSchema`、`draftSchema` 与 `parseFunction(unknown): Result<FourierFunction>`, 用 `refine` 实现关键帧严格递增、分量 id 唯一、各参数值域; 使 T080 通过
- [X] T088 [US5] 在 `src/storage/FunctionRepository.ts` 定义接口、`FunctionSummary`、`Draft`; 在 `src/storage/InMemoryFunctionRepository.ts` 实现内存版(依赖 T087)
- [X] T089 [US5] 在 `src/storage/IndexedDbFunctionRepository.ts` 用 `idb-keyval` 按 data-model"持久化布局"(`fn:<id>`、`index`、`draft`)实现; 所有读取经 `parseFunction`; 捕获异常并映射为 `STORAGE_UNAVAILABLE`/`STORAGE_QUOTA`/`DATA_CORRUPT`; 使 T081 通过
- [X] T090 [US5] 在 `src/state/autosave.ts` 实现对三个 store 的订阅与 500ms 防抖 `saveDraft`; 在 `src/main.tsx` 启动时 `loadDraft()`, 成功则恢复函数/时间/视图(FR-022), 为 `null` 或失败则用示例函数, `DATA_CORRUPT` 时 Toast 提示; 在 `documentStore` 增加 `loadFunction(fn, savedId)`(重置历史与 `lastSavedRef`)和 `markSaved`; 使 T083 通过
- [X] T091 [US5] 在 `src/features/library/Library.tsx` + `SaveDialog.tsx` + `library.css` 实现"我的函数": 保存/另存为(命名校验用 `rename` 的规则)、列表(名称、等宽字体的更新时间)、打开、重命名、删除; 在 `<header>` 显示当前函数名与未保存标记; 使 T084 的 Library 部分通过
- [X] T092 [P] [US5] 在 `src/export/exportImage.ts` 实现: 离屏 canvas 以 `pixelRatio:2` 调用 `drawFrame` → `toBlob('image/png')` → `Result<Blob>`; 在 `src/export/download.ts` 实现 `downloadBlob(blob, filename)`(用完即 `revokeObjectURL`)
- [X] T093 [P] [US5] 在 `src/export/videoSupport.ts` 实现 `detectVideoSupport()`: 检测 `VideoEncoder` 存在性, 用 `isConfigSupported` 探测 H.264(avc1); 使 T082 的 videoSupport 部分通过
- [X] T094 [US5] 在 `src/export/exportVideo.ts` 实现 research R6: 动态 `import('mediabunny')`; 离屏 canvas 逐帧 `drawFrame` → `VideoFrame` → 编码; 编码队列超过阈值时等待(背压)并在每帧后让出事件循环; `AbortSignal` 取消时关闭编码器并丢弃输出; 编码器通过参数注入以便测试; 使 T082 通过(依赖 T093)
- [X] T095 [US5] 在 `src/features/export-dialog/ExportDialog.tsx` + `export-dialog.css` 实现: 图片/视频两个页签; 视频页签含起止时刻、分辨率(720p/1080p)、帧率(30/60)、按当前播放速度计算的成片时长预览、进度条、取消; 导出开始时暂停播放, 结束后恢复原播放状态; 失败时显示 `AppError.message`; 在 `src/App.tsx` 装配 Library 与 ExportDialog 的入口; 使 T084、T085 通过

**检查点**: 全部 5 个用户故事可独立验收

---

## 阶段 8: 完善与横切关注点

**目的**: 可访问性、响应式、性能、安全与最终验收

- [X] T096 [P] 在 `tests/e2e/a11y.spec.ts` 用 `@axe-core/playwright` 扫描: 初始页、打开导出对话框、打开函数库、选中关键帧四个状态, 在浅色/深色表面上零 serious/critical 违规; 修复发现的问题(SC-007)
- [X] T097 [P] 在 `tests/e2e/keyboard-only.spec.ts` 编写仅用键盘完成"添加分量→调参→播放→暂停→步进→添加关键帧→移动关键帧→保存"的完整流程(FR-024), 并断言每一步焦点可见
- [X] T098 [P] 在 `tests/visual/layout.spec.ts` 建立 320/768/1024/1440 四个断点的截图基线(固定函数与 `t`, 暂停状态), 并断言 `document.documentElement.scrollWidth <= clientWidth`(FR-026); 调整 `src/app.css` 及各 feature 的 css 直至通过
- [X] T099 [P] 在 `src/features/components-panel/ParamControl.tsx` 为 `|频率| > 30` 增加混叠提示文案(research R5"已知限制"), 并补组件测试
- [ ] T100 [P] 在 `tests/perf/render-benchmark.spec.ts` 编写 Playwright 基准: 加载 50 个分量 + 10 条关键帧轨道的夹具, 播放 5 秒, 通过 `requestAnimationFrame` 采样断言 chromium 下 p95 帧间隔 < 20ms; 拖动滑块到画布变化 < 100ms(SC-002、SC-003); 未达标时先按设备自适应降低 `maxPoints`, 仍不达标再评估把采样移入 Worker
- [X] T101 [P] 在 `package.json` 增加 `size` 脚本(构建后统计 gzip 体积)并在 `scripts/check-bundle-size.mjs` 中断言首屏 JS < 300KB、CSS < 50KB、`mediabunny` 位于独立的异步 chunk
- [X] T102 对 `pnpm build && pnpm preview` 的产物做安全核查: 控制台无 CSP 违规; 全仓库无 `innerHTML`/`dangerouslySetInnerHTML`; 函数名仅以文本节点渲染; 无外部网络请求; 并用 security-reviewer 代理复核 `src/storage/` 与 `src/core/schema.ts`
- [X] T103 运行 `pnpm test:coverage` 确认整体 ≥ 80%、`src/core` ≥ 95%, 补齐缺口; 运行 `pnpm test:e2e` 确认三个浏览器全绿
- [X] T104 用 code-reviewer 与 typescript-reviewer/react-reviewer 代理审查全部改动, 修复 CRITICAL 与 HIGH, 尽量修复 MEDIUM; 检查函数 < 50 行、文件 < 800 行、无 `console.log`、无数据变更
- [ ] T105 按 `specs/001-fourier-visual-editor/quickstart.md` 的"手动验收清单"与"横切检查"完整走查一遍(含系统开启"减少动态效果"、隐私模式保存、Safari 与 Firefox 的视频导出), 把结果与发现的偏差记录到 `specs/001-fourier-visual-editor/checklists/acceptance.md`
- [X] T106 [P] 更新仓库根 `CLAUDE.md` 的"命令"与"最近变更", 并新增 `README.md`(用途、运行方式、浏览器支持、已知限制)

---

## 依赖关系与执行顺序

### 阶段依赖

```
阶段 1 设置 ──► 阶段 2 基础 ──► US1 (P1) ──► US2 (P2) ──► US3 (P3) ──┐
                                   │                                  ├──► 阶段 8 完善
                                   ├──► US4 (P4) ─────────────────────┤
                                   └──► US5 (P5) ─────────────────────┘
```

- **US1** 只依赖基础阶段.
- **US2** 依赖 US1(需要 `Stage`、`documentStore`、`drawFrame`).
- **US3** 依赖 US2(关键帧 UI 建在时间轴上); 其核心层任务 T062、T063、T067、T068 只依赖 US1, 可提前并行.
- **US4** 只依赖 US1, 可与 US2/US3 并行.
- **US5** 只依赖 US1; 与 US3 无硬依赖(schema 自始就包含关键帧), 但其 E2E T085 中"关键帧一致"的断言需要 US3 完成, 否则该断言先用夹具数据验证.
- 同时触碰 `src/App.tsx`、`src/state/documentStore.ts`、`src/core/function.ts`、`src/features/timeline/Timeline.tsx` 的任务(T048/T061/T079/T095; T036/T069/T078/T090; T033/T078; T060/T073)不可并行, 按编号顺序执行.

### 每个故事内部

测试任务(先写且失败)→ `src/core` → `src/state` → `src/render`/`src/export` → `src/features` → `src/App.tsx` 装配 → E2E 通过.

### 并行机会

- 阶段 1: T003–T008 全部可并行.
- 阶段 2: T009–T012 四个测试并行; T013 之后 T014、T016–T021 并行.
- US1: 8 个测试任务 T024–T031 并行; 实现中 T032–T035 并行, T037–T039 并行, T044–T045 并行.
- US2: T049–T053 并行; T054–T055 并行; T058–T059 并行.
- US3: T062–T066 并行; T071–T072 并行.
- US5: T080–T085 并行; T086–T087、T092–T093 并行.
- 阶段 8: T096–T101、T106 并行.
- 多人/多代理时: 基础完成并交付 US1 后, US2→US3 一条线, US4 一条线, US5 一条线, 三线并行, 在 `App.tsx` 与 `documentStore.ts` 上按编号串行合并.

## 并行示例

```bash
# US1: 一次启动全部测试任务(不同文件, 互不依赖)
Task: "T024 src/core/tracks.test.ts —— setValueAt 状态转换用例"
Task: "T025 src/core/function.test.ts —— 函数编辑契约用例"
Task: "T026 src/core/evaluator.test.ts —— 固定参数求值用例"
Task: "T027 src/core/history.test.ts —— 撤销/重做用例"
Task: "T028 src/render/drawFrame.test.ts —— 绘制调用序列用例"

# 测试确认失败后, 并行实现四个核心模块
Task: "T032 src/core/tracks.ts"
Task: "T033 src/core/function.ts"
Task: "T034 src/core/evaluator.ts"
Task: "T035 src/core/history.ts"

# US5: 存储线与导出线互不相干, 可两路并行
Task: "T087→T088→T089→T090→T091 (schema、仓储、自动保存、函数库)"
Task: "T092、T093→T094→T095 (图片导出、视频能力检测、视频导出、导出对话框)"
```

## 实施策略

### MVP 优先

1. 阶段 1 + 阶段 2 → 骨架与数学内核就绪.
2. **US1** → 停下验收: 静态时刻下的完整可视化编辑(可演示).
3. **US2** → 停下验收: **这是建议的首个对外发布版本**. 仅 US1 时图形不会动, 尚未兑现"随时间变化的动态图形"这一核心诉求, 因此 MVP 范围定为 US1 + US2(T001–T061, 共 61 个任务).

### 增量交付

4. **US3** 关键帧 → 产品的完整形态.
5. **US4** 预设 → 降低上手门槛(工作量最小, 若需要尽早改善首次体验, 可提前到 US2 之后).
6. **US5** 保存与导出 → 留存与分享.
7. 阶段 8 → 发布前质量门. 其中 T096–T098 建议在每个故事完成时就增量运行, 而不是全部留到最后.

每完成一个故事: 运行该故事的 E2E + `pnpm test:coverage`, 用 code-reviewer 代理审查, 然后提交(`feat: …` 约定式提交).

## 实施状态 (2026-09-21)

- 已完成并标记 [X]: 阶段 1、阶段 2、US1–US5 的全部测试与实现(含端到端), 以及阶段 8 的 T096–T099、T101–T104、T106.
- **未完成**: T100(50 分量性能基准)、T105(按 quickstart 人工走查, 含真机触摸、系统级"减少动态效果"、隐私模式、Safari/Firefox 的真实视频导出).
- 端到端: Chromium、Firefox、WebKit、移动端(Pixel 7)四个配置共 139 通过、1 跳过(移动端的滑块鼠标拖动——Playwright 触摸屏只支持点按, 需真机验证). 视频导出的 E2E 在不支持 H.264 编码的浏览器构建上只验证了"入口被正确禁用".
- T102 的安全核查为静态检查(无 `innerHTML`/`eval`/网络请求/`console`, 生产构建带 CSP)加代码审查代理; 未单独运行 security-reviewer 代理. T098 只断言无横向溢出与关键控件可见, 未建立截图基线.
- 代码审查发现并已修复(均先补失败测试): 拖拽中按撤销会吞掉更早的一步; 关键帧指针拖动在第一次移动后失效; 时间轴整棵子树每帧重渲染. 端到端测试另外暴露并修复: 所有者拒绝的数值仍留在输入框里; 画布按小数 CSS 尺寸清屏导致底边像素与上一帧混合; 移动端数值框触控目标小于 24px.
- 偏离计划: TypeScript 采用 6.0.3 而非 7(typescript-eslint 尚不支持 TS 7); 字体经 `@fontsource` 自托管而非 `public/fonts/`; 仓储为工厂函数而非类; `src/core/tracks.ts` 的关键帧增删改与 `src/core/playback.ts` 是在依赖安装超时期间先写实现后补测试, 未经历"先失败"一步.

## 备注

- 每个任务或逻辑组完成后提交一次; 实现前务必看到对应测试失败.
- `drawFrame` 的签名在 T057 增加一个**可选**参数, 这是全计划中唯一一处对已完成契约的扩展, 不破坏 T028 的既有用例.
- 若 T100 的基准在手机级设备上不达标, 优先调采样点上限, 不要引入逐帧累积式轨迹——那会破坏 FR-018f/FR-008a 的构造性保证.
