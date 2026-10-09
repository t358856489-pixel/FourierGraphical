---
description: "查看并复制函数的数学表达式的实现任务列表"
---

# 任务: 查看并复制函数的数学表达式

**输入**: 来自 `/specs/004-view-copy-expression/` 的设计文档
**前置条件**: plan.md、spec.md、research.md、data-model.md、contracts/expression-api.md、quickstart.md; 功能 001–003 已合并

**测试**: **包含**(章程原则 III). 每个"测试"小节先写、确认失败, 再实现. 覆盖率整体 ≥ 80%, `src/core` ≥ 95%.

**组织结构**: 按用户故事分组. 表达式的构建与文本生成(核心纯函数)是三个故事的共同基础, 放在阶段 2; US1 交付视图, US2 交付复制, US3 交付 LaTeX 格式选择, 三者依次叠加在同一个面板上.

## 格式: `[ID] [P] [Story] 描述`
- **[P]**: 可并行(不同文件, 不依赖同阶段未完成任务)
- **[Story]**: US1 = 查看表达式, US2 = 一键复制, US3 = LaTeX 格式
- 路径相对于仓库根目录

## 通用约束
- 不新增运行时依赖; `katex` 只能作为 devDependency 并只在 `*.test.ts` 中导入. `src/core/expression/` 只写无 DOM 的纯函数; 剪贴板访问只在 `src/features/expression/copyText.ts`; 可预期失败用 `Result<T>`, 文案为简体中文.
- 函数、`ViewSettings` 与已保存数据的格式**不变**; 写法/格式/展开状态只存会话 store, 不进自动保存.
- 表达式公式必须与 `src/core/evaluator.ts` 一致: `A·e^{i(2π·f·t + φ°)}`, 相位用度; 不得自行换算单位.
- 不使用 `innerHTML`; 表达式由 JSX 渲染, 文本只作为文本节点. 复制只在用户点击/按键中触发.
- 默认画面回归快照(`src/render/__snapshots__/`、`tests/visual/__screenshots__/`)不得改变; 首屏 JS 增量 < 5 KB gzip.
- 先跑完检查再提交, 不把测试和提交写进同一条命令; 不用 `vitest -u` 更新回归快照.

---

## 阶段 1: 设置

- [X] T001 在 `src/core/ranges.ts` 增加常量 `EXPRESSION_DECIMALS = 4`、`EXPRESSION_REFRESH_MS = 250`、`LATEX_TERMS_PER_LINE = 3`; 在 `src/core/types.ts` 的 `ErrorCode` 增加 `'CLIPBOARD_UNAVAILABLE'`; 新建 `src/core/expression/types.ts` 定义 data-model.md 的 `Coefficient`、`ExpressionTerm`、`Expression`、`Notation`、`CopyFormat`
- [X] T002 [P] `pnpm add -D katex`(katex 自带类型; 若 `types` 字段缺失再加 `@types/katex`); 在 `eslint.config.js` 为 `src/**/!(*.test).ts?(x)` 增加 `no-restricted-imports` 禁止 `katex`(research R8、plan 风险表); 确认 `pnpm size` 的基线数值(记入本文件"实施状态")

---

## 阶段 2: 基础(阻塞前置条件)

**目的**: `(函数, t) → Expression → 纯文本 / LaTeX` 的纯函数链, 以及会话偏好 store. 三个故事都依赖它.

### 基础的测试(先写, 确认失败)

- [X] T003 [P] 新增 `src/core/expression/build.test.ts`, 覆盖 contracts §1 全部行: `formatCoefficient` 的六个具体用例 + fast-check(任意有限数的 `text` 不含 `e`、不以 `.` 结尾、无末尾 0, `-0` 为 `"0"`); `buildExpression` 只含启用分量且顺序一致、`excludedCount` 正确; fast-check: 随机常量轨道函数(1–200 项, 频率 ∈ ±100, 相位 ∈ ±3600)与 `t ∈ [0, 1000]`, 按 `Σ A·(cos, sin)(2π f t + φπ/180)` 求和与 `vectorChain(fn, t)` 末端相差 < 1e-9; 用 `text` 数值时(频率量化到 0.001、相位到 0.1, 振幅任意)相差 ≤ 5e-5 × 项数 + 1e-9; 带关键帧的分量 `isAnimated` 为真且系数 = `evaluate(track, t)`, `hasAnimated`/`time` 随之设置; 空函数与全部停用; 200 项 `buildExpression + toPlainText + toLatex` < 50 ms
- [X] T004 [P] 新增 `src/core/expression/plainText.test.ts`, 覆盖 contracts §2 的纯文本行: 单项 complex 精确等于 `z(t) = 1·e^{i(2π·0.2·t + 0°)}`; 多项 ` + ` 连接; parametric 两行 `x(t) = …`/`y(t) = …`; waveform 用 `sin`; 负频率 `2π·(-0.4)·t`; 负相位 ` - 30°`; 相位 400° 原样; 振幅 0 仍是一项 `0·e^{…}`; 项数 = `terms.length`(正则计数 `e^{` / `cos(` / `sin(`); 说明行两种、顺序固定; `terms = []` → `""`; 字符白名单(无 `−`、`×`)
- [X] T005 [P] 新增 `src/core/expression/latex.test.ts`: 单项无 `aligned`, 多项 `\begin{aligned} … \end{aligned}` 且每行 ≤ 3 项(按 `\\` 切分后计数 `e^{`); parametric 两个块以空行分隔; 说明行为 `\text{…}`; 三种写法 × {1, 3, 200} 项 × {有, 无}说明行共 18 组用 `katex.renderToString(latex, { throwOnError: true, displayMode: true, strict: 'warn' })` 不抛(说明行含中文, KaTeX 默认 `strict: 'warn'` 只告警; 显式写出以防默认值变化); fast-check: 从 LaTeX 与纯文本提取的数字序列相等; `terms = []` → `""`
- [X] T006 [P] 新增 `src/state/expressionStore.test.ts`: 初始 `isOpen=false, notation=null, format='plain'`; `effectiveNotation(null, 'drawing2d') = 'complex'`、`(null, 'waveform') = 'waveform'`、显式选择后不随模式变; `toggleOpen`/`setNotation`/`setFormat`/`reset`. 在 `src/state/autosave.test.ts` 追加: 修改表达式偏好后草稿内容不变

### 基础的实现

- [X] T007 新建 `src/core/expression/build.ts`: `formatCoefficient(value)`(`Number(value.toFixed(EXPRESSION_DECIMALS))`, 负零归 0, `isRounded`), `buildExpression(fn, t)`(用 `evaluate` 取瞬时值, `isAnimated = track.kind === 'animated'` 任一), 使 T003 通过
- [X] T008 [P] 新建 `src/core/expression/plainText.ts`: `toPlainText(expr, notation)`(项模板、负数括号、负相位减号、说明行、空串), 使 T004 通过
- [X] T009 [P] 新建 `src/core/expression/latex.ts`: `toLatex(expr, notation)`(`\cdot`、`\pi`、`^\circ`、`e^{i(…)}`、每 `LATEX_TERMS_PER_LINE` 项一行的 `aligned`、`\text{}` 说明行), 使 T005 通过
- [X] T010 [P] 新建 `src/state/expressionStore.ts`(Zustand, 不持久化)与 `effectiveNotation`/`defaultNotation`; 在 `src/test/resetStores.ts` 调用其 `reset()`; 使 T006 通过
- [X] T011 运行 `pnpm test:coverage`, 确认 `src/core` 行与分支覆盖率 ≥ 95%(新模块的分支——负数、负相位、单项、说明行组合——全部有用例)

**检查点**: 核心链路可在 Vitest 中完整验证; 尚无界面.

---

## 阶段 3: 用户故事 1 — 查看当前函数的数学表达式 (P1) 🎯 MVP

**目标**: 分量面板头部的"表达式"按钮展开一个非模态折叠面板, 按写法显示着色的表达式, 随编辑即时更新, 处理停用、空状态、动画参数与精度说明.

**独立测试**: 预设 5 项方波 → 打开表达式 → 5 项系数与分量列表一致; 改相位立即更新; 停用一项 → 该项消失且出现排除说明.

### US1 的测试(先写, 确认失败)

- [X] T012 [P] [US1] 新增 `src/features/expression/ExpressionPanel.test.tsx`, 覆盖 contracts §5 中与查看相关的行: 切换按钮 `aria-expanded` 与 `aria-controls`; 展开后出现 `role="region"` 名为"表达式", 焦点移到标题; 面板内 Esc 收起并把焦点还给按钮; 5 项方波渲染 5 个 `.expr-term`, 每项 `style` 含 `--term-color: var(--component-cN)` 且与分量 `color` 对应, 文本含 `1.2732`、`0.2`、`0°`; `setParamValue` 改相位后对应项文本更新, `undo()` 恢复、`redo()` 再变; `setEnabled(false)` 后项数 4 且出现"已排除 1 个停用分量"; 写法单选切换文本结构; `presentationMode` 为 `drawing2d` 默认 complex、`waveform` 默认 waveform; 空函数显示"当前没有启用的分量"; 含关键帧分量出现"含动画参数, 按 t = … 取值"与项上的标记, 用 fake timers 推进播放时间后 ≤ 300 ms 内文本更新; 无关键帧时 `usePlaybackStore.subscribe` 的 spy 未被调用; `isRounded` 时出现"显示精度 4 位小数"; 存在视觉隐藏的纯文本节点, 内容 === `toPlainText(expr, notation)`; 视觉公式容器 `aria-hidden="true"`
- [X] T013 [P] [US1] 在 `src/features/components-panel/ComponentsPanel.test.tsx` 追加: 头部出现"表达式"按钮; 点击后面板出现在头部与分量列表之间; 再点击收起; 面板展开时分量列表仍可编辑(改一个滑块, 表达式随之变化)
- [X] T014 [P] [US1] 新增 `tests/e2e/expression.spec.ts` 的故事 1 用例(contracts §6 前两行): 应用 5 项方波 → 点"表达式" → `.expr-term` 计数 5, 第 1 项含 `1.2732` 与第 1 行数值框一致; 把第 2 项相位设为 90 → 第 2 项含 `90°`; 停用第 3 项 → 计数 4 + 排除说明; 图形库"雪花"→ 项数 = 头部计数 `.components-panel__count` 的分子(列表已虚拟化, 不能数 `.component-row`)且 ≤ 150, 1 s 内出现, `scrollIntoView` 最后一项可见; 预设 200 项锯齿 → 项数 200. 在 `tests/e2e/a11y.spec.ts` 追加"表达式面板展开时无 serious 违规"; 在 `tests/e2e/keyboard-only.spec.ts` 追加: Tab 到"表达式"→ Enter → 焦点在面板标题 → 方向键切换写法 → Esc 收起且焦点回到按钮; 在 `tests/visual/layout.spec.ts` 为 320/768/1024/1440 追加"面板展开"状态的无横向溢出断言

### US1 的实现

- [X] T015 [US1] 新建 `src/features/expression/ExpressionTerms.tsx`: 按 `Expression` 渲染 `z(t) = ` 前缀与各项(`<span class="expr-term" style={{'--term-color': …}}>`, `<sup>` 上标, 动画项加 `.expr-term--animated` 与可见的标记), 视觉公式容器 `aria-hidden="true"`, 项组件 `memo` 以分量引用跳过; 附视觉隐藏的 `<p class="visually-hidden">` 纯文本(`global.css` 已有该类), 读屏版本在动画项后加 `[动画]`; 空 terms 渲染空状态文字
- [X] T016 [P] [US1] 新建 `src/features/expression/useAnimatedTime.ts`: 入参 `hasAnimated`; 为真时 `usePlaybackStore.subscribe` 并以 `EXPRESSION_REFRESH_MS` 节流 `setState(time)`, 为假时不订阅且返回最近值; 卸载时退订
- [X] T017 [US1] 新建 `src/features/expression/ExpressionPanel.tsx` + `expression.css`: `<section role="region" aria-labelledby>` 标题(`tabIndex=-1`, 展开时聚焦)、写法 `<fieldset>` 单选(复数形式 / 参数方程 / 波形, 用 `effectiveNotation`)、排除说明、动画说明(含 `formatTime(displayTime)`)、精度说明、滚动容器(`max-height`, `overflow: auto`, `overflow-wrap: anywhere`)内的 `<ExpressionTerms>`; `useMemo(() => buildExpression(present, displayTime), [present, displayTime])`; 面板内 `Escape` → `toggleOpen` 并聚焦切换按钮(通过 `onCollapse` 回调); 样式只用设计令牌(`--font-mono`、`--component-cN`、间距/圆角令牌); 使 T012 通过
- [X] T018 [US1] 在 `src/features/components-panel/ComponentsPanel.tsx` 头部"图形"旁加"表达式"按钮(`aria-expanded`、`aria-controls="expression-panel"`), 读写 `useExpressionStore`; 展开时在 `<PresetPicker />` 之后渲染 `<ExpressionPanel onCollapse={…} />`; 使 T013 通过
- [X] T019 [US1] 运行 T014 的端到端(三个浏览器 + mobile)、`pnpm test:coverage`、`pnpm lint`、`pnpm typecheck`、`pnpm size`(增量 < 5 KB); 确认 `src/render/__snapshots__/` 与 `tests/visual/__screenshots__/` 无改动

**检查点**: US1 可独立演示——打开面板看式子, 改参数即时变化.

---

## 阶段 4: 用户故事 2 — 一键复制表达式 (P1)

**目标**: 面板内"复制"按钮把当前写法的纯文本写入剪贴板, 成功有提示, 失败退回已全选的文本框.

**独立测试**: 点"复制"→ 粘贴与面板内容逐字一致; 剪贴板被拒时出现说明与全选文本框.

### US2 的测试(先写, 确认失败)

- [X] T020 [P] [US2] 新增 `src/features/expression/copyText.test.ts`(contracts §4): `writeText` 成功 → `ok` 且被调用一次、参数为原文; `writeText` 拒绝 `NotAllowedError` → `err('CLIPBOARD_UNAVAILABLE', 含"浏览器不允许")`; `navigator.clipboard` 为 `undefined` → 同样的 `err`; 任何情况都不抛
- [X] T021 [P] [US2] 在 `src/features/expression/ExpressionPanel.test.tsx` 追加: "复制"按钮在空函数时禁用; 点击(桩成功)→ `showInfo` 被调用且文案含"已复制"与项数 `5`; 复制的参数 === 面板内视觉隐藏纯文本的内容; 桩失败 → 出现 `role="alert"` 与 `textarea`, 其 `value` 为同一文本且 `selectionStart === 0 && selectionEnd === value.length`, 焦点在 textarea; 再次成功复制后 textarea 与 alert 消失
- [X] T022 [P] [US2] 在 `tests/e2e/expression.spec.ts` 追加故事 2 用例: `page.addInitScript` 把 `navigator.clipboard.writeText` 换成写 `window.__copied` 的桩 → 点"复制" → `__copied` === 面板纯文本(读视觉隐藏节点的 `textContent`); 提示区(`aria-label="提示"`)出现"已复制 5 项"; `test.skip(browserName !== 'chromium')` 的真剪贴板用例: `context.grantPermissions(['clipboard-read', 'clipboard-write'])` → 复制 → `navigator.clipboard.readText()` 一致; 桩抛 `NotAllowedError` → `textarea` 可见且全选. 在 `tests/e2e/keyboard-only.spec.ts` 的表达式用例追加: Tab 到"复制"→ Enter → 提示出现

### US2 的实现

- [X] T023 [US2] 新建 `src/features/expression/copyText.ts`: `copyText(text): Promise<Result<void>>`, try/await `navigator.clipboard?.writeText`, 无 API 或拒绝 → `err('CLIPBOARD_UNAVAILABLE', '浏览器不允许自动复制, 请在下方文本框中按 Ctrl/⌘+C 复制')`; 使 T020 通过
- [X] T024 [US2] 在 `ExpressionPanel.tsx` 加"复制"按钮(`disabled={expr.terms.length === 0}`): 点击 → `toPlainText(expr, notation)` → `copyText` → 成功 `showInfo(\`已复制 ${n} 项的表达式\`)` 并清除回退; 失败 → 本地 state 保存文本, 渲染 `<p role="alert">` + 只读 `<textarea aria-label="表达式文本">`, 挂载后 `select()` + `focus()`; 使 T021 通过
- [X] T025 [US2] 运行 T022 端到端(三个浏览器 + mobile)与全部单元测试、lint、typecheck

**检查点**: 两次操作把表达式放进剪贴板(SC-001).

---

## 阶段 5: 用户故事 3 — 以 LaTeX 格式复制 (P2)

**目标**: 面板内"格式"单选(纯文本 / LaTeX); 复制时按格式生成; 选择在会话内保留.

**独立测试**: 选 LaTeX 复制 → 粘贴到 Typora/Obsidian 渲染一致、无语法错误; 三种写法各一次.

### US3 的测试(先写, 确认失败)

- [X] T026 [P] [US3] 在 `src/features/expression/ExpressionPanel.test.tsx` 追加: 出现"格式"`fieldset`(纯文本 / LaTeX), 默认纯文本; 选 LaTeX 后复制的参数 === `toLatex(expr, notation)`; 切换写法后 LaTeX 结构随之变化; 收起再展开仍是 LaTeX(store 保留); 剪贴板失败时 textarea 内容为 LaTeX
- [X] T027 [P] [US3] 在 `tests/e2e/expression.spec.ts` 追加故事 3 用例: 选"LaTeX"→ 复制 → `__copied` 以 `\begin{aligned}` 开头(5 项), `\cdot` 出现次数 = 项数 × 2, 含 `^\circ`; 切到参数方程 → 复制 → 含两个 `\begin{aligned}`; 刷新页面 → 格式回到纯文本(会话偏好不保存)

### US3 的实现

- [X] T028 [US3] 在 `ExpressionPanel.tsx` 加"格式"`fieldset` 单选(读写 `useExpressionStore.format`); 复制时 `format === 'latex' ? toLatex : toPlainText`; 提示文案不变; 使 T026 通过
- [X] T029 [US3] 运行 T027 端到端与全部单元测试、lint、typecheck

**检查点**: 三个故事全部可演示.

---

## 阶段 6: 完善与横切

- [X] T030 [P] 性能复核: 在 `tests/perf/render-benchmark.spec.ts` 追加"200 分量 + 表达式面板展开 + 每帧编辑"场景, 判据与功能 003 相同(桌面 60 fps, p95 < 16.7 ms 的既有阈值); 不达标则按 plan 风险表先改为收起时不渲染、再考虑复用 `VirtualList`
- [X] T031 [P] 文档: `README.md` 增加"查看与复制表达式"小节(三种写法、两种格式、动画参数的说明、已知限制); `CLAUDE.md` 的 004 条目改为"已实现"; `specs/001-fourier-visual-editor/data-model.md` 的"派生量"小节追加一行指向本功能的表达式写法
- [X] T032 [P] 在 `src/test/resetStores.ts` 与 `tests/e2e/helpers.ts` 补充本功能用到的辅助(如 `openExpression(page)`、`expressionText(page)`), 消除用例间的重复
- [X] T033 全量门禁: `pnpm typecheck`、`pnpm lint`、`pnpm test:coverage`(整体 ≥ 80%, `src/core` ≥ 95%)、`pnpm size`(通过, 且与 T002 记录的基线人工比对增量 < 5 KB gzip, 确认产物中不含 `katex`)、`pnpm test:perf`、`pnpm exec playwright test` 全矩阵; 回归快照无改动
- [X] T034 用 code-reviewer 与 security-reviewer 代理审查(重点: 表达式与求值器约定的一致性、数字格式的边角、剪贴板失败分支、面板对编辑响应的影响、无 `innerHTML`); 修复 CRITICAL/HIGH, 每个修复先补失败测试
- [ ] T035 按 `quickstart.md` 人工走查, 记入 `checklists/acceptance.md`(由人确认的条目如实标注); 其中 LaTeX 在 Typora/Obsidian 的渲染只能由人确认

---

## 依赖关系

```
阶段 1 → 阶段 2(core/expression + expressionStore) → US1 查看(面板) → US2 复制 → US3 LaTeX 格式 → 阶段 6
```
- US2 与 US3 都在 US1 的 `ExpressionPanel.tsx` 上叠加控件, 因此**串行**: US1 → US2 → US3. 它们各自的测试文件(T020、T022、T026、T027)可在前一故事实现期间并行编写.
- 共享文件串行点: `ExpressionPanel.tsx`(T017 → T024 → T028)、`ExpressionPanel.test.tsx`(T012 → T021 → T026)、`tests/e2e/expression.spec.ts`(T014 → T022 → T027)、`ComponentsPanel.tsx`(仅 T018).

## 并行示例

```bash
# 阶段 2 的四个测试文件一起写, 之后三个核心模块一起实现
Task: "T003 build.test"  Task: "T004 plainText.test"  Task: "T005 latex.test"  Task: "T006 expressionStore.test"
Task: "T008 plainText.ts"  Task: "T009 latex.ts"  Task: "T010 expressionStore.ts"
# US1 的三组测试并行; 实现中 T015 与 T016 并行
Task: "T012 面板组件测试"  Task: "T013 分量面板测试"  Task: "T014 端到端 + a11y + 键盘 + 视觉"
```

## 实施策略

1. 阶段 2 先把"系数与求值器一致"的性质测试做绿——这是 SC-002 的根基, 之后的界面工作不再碰数学.
2. **US1 为 MVP**: 打开面板看到式子、改参数即时更新, 已回答"我搭出来的到底是什么函数".
3. US2 → US3 → 阶段 6. 每个故事完成后跑该故事的端到端与回归快照, 审查后提交.

## 实施状态 (2026-10-09)

- 已完成并标记 [X]: 阶段 1、2, US1–US3 的全部测试与实现, 阶段 6 的 T030–T034. **未完成**: T035(人工走查, 需要用户).
- T034 审查结论(code-reviewer + security-reviewer, 2026-10-09): 安全审查六项全部通过, 无发现; 代码审查无 CRITICAL/HIGH, 2 项 MEDIUM 与 1 项 LOW 均已先补失败测试再修复:
  1. MEDIUM 读屏文本: 原以子串替换在纯文本里标注动画项, 振幅 "1" 与频率 "1" 的 "1·" 子串冲撞会标错位置、标错项. 修复: `toPlainText` 增加 `annotateAnimated` 选项按项定位追加 `[动画]`, 面板直接用它; 用例覆盖子串冲撞与两项同值.
  2. MEDIUM 项的 memo 失效: `buildExpression` 每次都新建全部项对象, 视图里的 `memo` 永远不命中. 修复: 全常量分量的项按分量引用用 `WeakMap` 缓存(与 t 无关), 带关键帧的项照常重算; 用例断言未改动项引用相等且与整体重算结构相等(章程 I).
  3. LOW 负号/括号规则在纯文本、LaTeX、视图三处重复. 修复: 抽成 `core/expression/format.ts`(`signedFactor`、`splitPhase`), 视图直接复用 `plainArgument`.
- 单元/组件/集成(修复后): 693 个测试全绿; 覆盖率整体 ≥ 91%, `src/core` ≥ 95%.
- `pnpm size` 基线(T002, 实施前): 首屏 JS 123.2 KB gzip, CSS 6.9 KB. 实施后: JS 125.2 KB(+2.0 KB), CSS 7.4 KB(+0.5 KB), 预算 300 / 50 KB; 产物中不含 katex.
- 单元/组件/集成: 691 个测试全绿; 覆盖率整体 ≥ 91%, `src/core` ≥ 95%(新模块 `core/expression` 分支 100%).
- 性能基准(桌面 Chromium): 新增"200 分量 + 表达式面板展开 + 每帧编辑"场景 60 fps(p95 16.8 ms); 原有 9 个场景不变.
- 实施中的偏离与决定:
  - LaTeX 的说明行与多个等式放在外层 `gathered` 环境里(每个等式仍是 `aligned`), 而不是计划里"以空行分隔": 顶层 `\\` 在各渲染器中行为不一, `gathered` 是 amsmath 基础命令, KaTeX 验证通过. data-model 已更新.
  - 项的着色用 `data-color="cN"` + CSS 规则映射到 `--component-cN`, 而不是内联 `style` 自定义属性: jsdom 对内联自定义属性支持不稳, 且 12 个映射规则本身就是设计令牌的用法. 文字颜色保持 `--ink`(对比度), 分量色只做色标(与分量列表的 chip 同一做法).
  - 面板的 Esc 用原生 `keydown` 监听(effect 内挂到 `<section>`), 因为 jsx-a11y 不允许在非交互元素上写 `onKeyDown`.
  - `useAnimatedTime` 启用时在下一个 tick 同步一次而不是在 effect 内同步 `setState`(react-hooks 规则); 节流为"前沿触发 + 尾随补发".
  - 端到端里"波形"单选与舞台工具栏的"波形"模式切换同名, 定位器一律限定在表达式区域内.

## 分析修订 (2026-10-09)

按 `/speckit.analyze` 的发现, 在实施前已更新 spec / contracts 与本文件: F1 端到端用头部计数而不是虚拟化的行数; F2 取整系数的一致性只对编辑器可输入精度的频率/相位承诺, 误差界改为绝对值; F3 纯文本符号统一为 π、·、°、`^{}`、ASCII 减号; F4 SC-002 改写为每项系数误差 ≤ 0.00005; F5 视觉公式 `aria-hidden`, 读屏版本标记动画项; F6 补撤销/重做用例; F7 "每个等式一行"; F8 振幅 0 的契约行; F9 包体增量人工比对; F10 KaTeX 显式 `strict`; F11 katex 自带类型.
