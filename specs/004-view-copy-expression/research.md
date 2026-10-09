# 阶段 0 研究: 查看并复制函数的数学表达式

**日期**: 2026-10-09 | **规范**: [spec.md](./spec.md) | **基础**: 功能 [001](../001-fourier-visual-editor/research.md) 的求值约定(R4)

技术栈不变(TypeScript 6 + React 19 + Zustand + 原生 CSS), **不新增运行时依赖**. 未知项集中在: 表达式与求值器约定的精确对应、
数字格式、三种写法与两种格式的文本生成、在视图内如何排版、怎样随函数与时刻更新而不触碰 60 fps 路径、剪贴板的边界处理与测试.

---

## R1. 表达式与求值器约定的精确对应

- **Decision**: 第 k 个启用分量的项写为 `A·e^{i(2π·f·t + φ°)}`(复数形式), 其中 `A = amplitude`, `f = frequency`(圈/秒), `φ = phase`(度), 三者都是**该分量在时刻 t 的轨道值**(常量轨道即其值; 关键帧轨道取 `evaluate(track, t)`). 参数方程 `x(t) = Σ A·cos(…)`, `y(t) = Σ A·sin(…)`; 波形写法只给 `y(t)`. 这与 `src/core/evaluator.ts` 的 `θ = 2π·frac(phase/360 + ∫f)`、`tip = Σ A·(cos θ, sin θ)` 逐字对应: 对常量频率, `∫₀ᵗ f = f·t`, 取小数圈数不改变 cos/sin 的值, 故 `θ ≡ 2π·f·t + φ·π/180 (mod 2π)`. 对**带关键帧的频率**, `∫f` 不是 `f·t`, 这正是规范把动画参数限定为"瞬时值 + 标注"的原因: 表达式只承诺"用当前时刻的瞬时值写出的式子", 不承诺它在其他时刻也成立(FR-012a).
- **Rationale**: FR-002 要求忠实; 唯一能让"独立求值 = 画面"(SC-002)按构造成立的办法, 就是直接从求值器的公式抄写. 契约里用性质测试锁定: 对任意常量轨道的函数与任意 t, 从 `Expression` 的系数按 `Σ A·(cos, sin)(2π f t + φ·π/180)` 求和, 与 `vectorChain(fn, t)` 末端相差 < 1e-9(未取整的系数)、< 2e-4·ΣA(取整到 4 位小数的系数).
- **Alternatives considered**: *相位换算成弧度写出*: 与分量列表里的度数对不上, 违背 SC-006"一眼找到对应分量". *写成角频率 `ω`*: 同理. *把关键帧写成分段函数*: 用户已否决.

## R2. 数字格式

- **Decision**: 新增纯函数 `formatCoefficient(value): { text: string; isRounded: boolean }`: `Number(value.toFixed(4))` 去掉末尾 0, `-0` 归为 `0`(`Object.is(x, -0)` 或 `x === 0` 时输出 `"0"`); `isRounded = Math.abs(Number(text) - value) > 0`. 负数在乘积内加括号: `2π·(-0.4)·t`. 纯文本里的负号用 ASCII `-`, 乘号用中点 `·`, 圆周率用 `π`, 度用 `°`; LaTeX 里分别是 `-`、`\cdot`、`\pi`、`^\circ`. 不用 Unicode 的 `−`(U+2212)与 `×`: 粘贴进计算器与代码时 ASCII `-` 更不易出错, 而 `·` 在任何字体下都可读. 规范边界情况里的 `0×…` 是示意写法, 本决定即其落地形式.
- **Rationale**: FR-008 规定 4 位小数、省略末尾 0、负零为 0, 并要求在发生四舍五入时注明——`isRounded` 就是这个标志, 由 `Expression.isRounded = terms.some(...)` 汇总. 复用 `ranges.ts` 的 `formatValue(value, step)` 不合适: 它按参数步长取位(振幅 2 位、频率 3 位), 而功能 003 生成的振幅精确到 4 位, 用 2 位会把雪花的小项显示为 `0`.
- **Alternatives considered**: *`Intl.NumberFormat`*: 会按地区插入千分位, 对数学式不合适. *保留全部小数*: 浮点噪声(`0.30000000000000004`)不可读.

## R3. 三种写法、两种格式: 文本生成放在 `core/expression`

- **Decision**: 派生结构 `Expression`(见 data-model)由 `buildExpression(fn, t)` 生成, 两个渲染器把它变成文本: `toPlainText(expr, notation)` 与 `toLatex(expr, notation)`, 全部是 `src/core/expression/` 下的纯函数.
  - **纯文本**: 每个等式一行: `z(t) = term + term + …`; 参数方程两行 `x(t) = …` 与 `y(t) = …`. 没有启用分量时渲染器返回空字符串(由视图显示空状态, 复制按钮禁用). 含动画参数时在最前面加一行 `# 含动画参数, 按 t = 5.00 取值`, 含四舍五入时加一行 `# 显示精度 4 位小数`(FR-012a 要求复制文本也带说明; 用 `#` 前缀使其在任何文本环境里都能被看成注释).
  - **LaTeX**: 单项时 `z(t) = A e^{i(2\pi \cdot f \, t + \varphi^\circ)}`; 多项用 `\begin{aligned} z(t) ={}& t_1 + t_2 + t_3 \\ &+ t_4 + t_5 + t_6 \\ … \end{aligned}`, 每行 3 项, 使 200 项也能在 KaTeX/MathJax/Typora/Obsidian 中渲染成可读的多行(单行 200 项的式子在渲染器里不会换行). 说明文字用 `\text{…}` 作为首行.
  - 写法默认值: `presentationMode === 'drawing2d' → 'complex'`, `'waveform' → 'waveform'`; 用户的选择与格式选择存在一个新的会话 store(`expressionStore`), 不进 `ViewSettings`, 因此不被自动保存(FR-015).
- **Rationale**: 章程 II: 文本生成不依赖 DOM, 可在 Vitest 里做性质测试并计入 `src/core` 的 95% 覆盖率. 把"结构"与"文本"分开, 视图可以直接用结构渲染(每项一个带颜色的元素), 复制时才生成文本——两者来自同一结构, 保证 FR-010 的"逐字一致".
- **Alternatives considered**: *直接在 React 组件里拼字符串*: 无法在 core 内测试, 且视图与复制文本容易不一致. *每行 1 项的 LaTeX*: 200 行太长; 每行 3 项是可读性与长度的折中, 契约只锁定"可渲染"与"系数一致", 不锁定行宽.

## R4. 视图内的排版: 结构化 HTML, 不引入排版引擎

- **Decision**: 视图用普通 HTML 渲染 `Expression`: 每一项是一个 `<span class="expr-term">`, 用 `style="--term-color: var(--component-cN)"` 取该分量的语义色; 上标用 `<sup>`, 下标用 `<sub>`; 字体用已有的 `--font-mono`(数字对齐)与 `--font-ui`(符号), 不新增字族. 整个式子包在一个 `aria-live="off"` 的容器里, 并附一个视觉隐藏的纯文本版本供屏幕阅读器朗读(FR-013). 200 项时直接渲染全部 `<span>`(约 1 000 个节点, 远低于分量面板已证明可行的规模), 容器 `max-height` + 滚动, **不做虚拟化**.
- **Rationale**: 章程 VI(无新依赖)与安全约束(生产 CSP 不允许第三方脚本; KaTeX 等需要自托管字体与样式, 为一个只读视图引入约 300 KB 不成比例). 结构化 HTML 足以表达 `e^{i(…)}` 一层上标, 且每项能单独着色(FR-004), 这是整段式子交给排版引擎时反而难做到的.
- **Alternatives considered**: *MathML Core*: 零依赖且语义最好, 但 React 对 MathML 元素的命名空间处理在 19 中仍有边角问题(`<math>` 在 HTML 文档中需要正确的命名空间才会被排版), 不值得为此承担风险; 若日后需要可在渲染器层替换. *KaTeX 自托管*: 体积与 CSP 成本见上. *Canvas 绘制公式*: 不可选中、不可读屏.

## R5. 随函数与时刻更新, 不触碰 60 fps 路径

- **Decision**:
  - **随函数更新**: 视图是普通 React 组件, 用 `useDocumentStore((s) => s.history.present)` 订阅; `buildExpression` 在 `useMemo` 中按 `(present, displayTime)` 重算. 200 项的构建 + 渲染预计 < 5 ms(契约里有 < 50 ms 的上限测试). 每一项组件用 `memo` 包裹, 以分量对象的引用相等跳过未改动的项——这正是不可变数据(章程 II)带来的红利.
  - **随时刻更新(仅当含动画参数)**: 不在 React 中订阅 `playbackStore.time`(它每帧变化). 视图在 `hasAnimated` 为真时, 用 `usePlaybackStore.subscribe` 读取时间并以 `EXPRESSION_REFRESH_MS = 250` 的节流写入本地 state(`displayTime`); `hasAnimated` 为假时不订阅. 节流后的时刻按 `formatTime`(两位小数)显示在标注里.
  - 画布的 rAF 循环完全不知道表达式视图的存在(章程 V: 60 fps 路径不经过 React); 表达式的重算成本只落在 React 的 commit 里, 和分量面板同一量级.
- **Rationale**: FR-007、SC-003(0.1 s 内更新——store 更新是同步的, React 在下一帧 commit); 边界情况"更新频率以读清数字为准"→ 250 ms. 契约用性能测试证明 200 项构建 + 两种文本生成 < 50 ms, 用组件测试证明无动画参数时不订阅播放时间.
- **Alternatives considered**: *每帧更新*: 数字闪动不可读, 且 200 项 × 60 Hz 的 React 提交会挤占主线程. *把表达式缓存进 store*: 派生状态进 store 违反"不存冗余派生值"的既有规则.

## R6. 剪贴板: 边界层、失败回退与测试

- **Decision**: `src/features/expression/copyText.ts`: `copyText(text: string): Promise<Result<void>>`——`navigator.clipboard?.writeText` 存在且成功 → `ok`; 不存在(非安全上下文、旧浏览器)或被拒绝(权限、非用户手势、文档失焦)→ `err('CLIPBOARD_UNAVAILABLE', '浏览器不允许自动复制, 请在下方文本框中按 Ctrl/⌘+C 复制')`. 视图收到 `err` 时显示一个只读 `<textarea>`(内容为同一份文本, 挂载后 `select()` 并聚焦), 并把错误说明放在 `role="alert"`. 成功时 `showInfo('已复制 N 项的表达式')`, 由已有的 `aria-live="polite"` 提示区朗读(FR-009). 复制只由按钮的 click/键盘激活触发, 不在打开视图时自动写入. 新增 `ErrorCode` 值 `'CLIPBOARD_UNAVAILABLE'`.
  - **端到端测试**: 三个浏览器都用 `page.addInitScript` 把 `navigator.clipboard.writeText` 替换为写入 `window.__copied` 的桩, 断言内容与视图文本一致; 仅在 Chromium 额外用 `context.grantPermissions(['clipboard-read','clipboard-write'])` 走一遍真剪贴板(`navigator.clipboard.readText`); 回退路径用一个 `writeText` 抛 `NotAllowedError` 的桩验证文本框出现且已全选(`selectionStart === 0 && selectionEnd === length`).
- **Rationale**: 章程 II(失败走 `Result`, 不静默)、FR-011. Firefox/WebKit 的 Playwright 不支持剪贴板权限, 桩是唯一可跨浏览器的确定性做法; Chromium 真剪贴板用例保证桩没有掩盖 API 用法错误.
- **Alternatives considered**: *`document.execCommand('copy')`*: 已废弃且在部分浏览器静默失败. *自动回退到 execCommand 再回退到文本框*: 多一层不可测的分支, 直接给文本框更可靠.

## R7. 视图的位置与形态: 非模态的折叠面板

- **Decision**: 在分量面板头部"图形"按钮旁加"表达式"切换按钮(`aria-expanded`、`aria-controls`); 展开后在面板头部与分量列表之间插入 `<section aria-labelledby="expression-heading" class="expression-panel">`, 含写法选择(`<fieldset>` 单选: 复数形式 / 参数方程 / 波形)、格式选择(纯文本 / LaTeX)、"复制"按钮、排除与动画说明、滚动的表达式区. 面板是**非模态**的: 用户可以一边改参数一边看式子变化(FR-007 验收场景 3 明确要求"不需要关闭再打开"). 展开状态是会话状态(存 `expressionStore`), 不自动保存. 展开时焦点移到面板标题; Esc 在面板内按下时收起并把焦点还给切换按钮.
- **Rationale**: 既有 `Dialog` 是模态的(`showModal`), 打开期间无法编辑, 与故事 1 场景 3 冲突; 折叠面板复用面板的滚动容器与设计令牌, 改动最小; 右侧面板在 320 px 宽度下仍是纵向排列, 不会溢出(视觉测试覆盖).
- **Alternatives considered**: *模态对话框*: 与 FR-007 冲突. *非模态 `<dialog>.show()`*: 定位与层叠要另写一套样式, 且与舞台重叠会遮住图形. *停靠在舞台下方*: 占用时间轴空间.

## R8. LaTeX 正确性的验证手段

- **Decision**: 把 `katex` 作为 **devDependency**(仅测试使用, 不进入任何构建产物), 在 Vitest 中用 `katex.renderToString(latex, { throwOnError: true, displayMode: true })` 断言生成的 LaTeX(三种写法 × 1/3/200 项 × 含说明行)全部无错. 运行时代码不引用它.
- **Rationale**: FR-012 要求"在常见渲染器中无语法错误", 用真实渲染器验证比自写的括号匹配检查可信得多; 它只是测试工具, 不触及章程 VI 对**运行时**依赖的限制, 也不影响包体预算(契约有 `pnpm size` 断言不变). 仍记入计划的"技术背景", 以便审查者知情.
- **Alternatives considered**: *手写语法检查*: 只能查括号与命令白名单, 查不出 `aligned` 的 `&` 用法等错误. *MathJax*: 体积大、加载慢, 作为测试工具不如 KaTeX 轻.
