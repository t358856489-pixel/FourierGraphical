# 实施计划: 查看并复制函数的数学表达式

**分支**: `004-view-copy-expression` | **日期**: 2026-10-09 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/004-view-copy-expression/spec.md` 的功能规范

## 摘要

在分量面板里加一个非模态的"表达式"折叠面板, 把当前函数按求值器的约定写成标准数学式——复数形式 `z(t) = Σ A·e^{i(2π·f·t + φ°)}`、参数方程 `x(t)`/`y(t)`、
波形 `y(t)`——各项按分量顺序排列并着分量色, 随每次编辑即时更新; 一键复制为纯文本或 LaTeX, 剪贴板不可用时退回到已全选的文本框.
表达式的构建与两种文本生成全部是 `src/core/expression/` 的纯函数; 含关键帧的参数按当前时刻的瞬时值显示并标注. 函数格式与保存内容零改动.

## 技术背景

**语言/版本**: TypeScript 6 (strict) —— 沿用
**主要依赖**: 运行时不新增. 开发依赖新增 `katex`, 仅在 Vitest 中验证生成的 LaTeX 无语法错误(research R8), 不进入构建产物
**存储**: 无变化; 写法/格式/展开状态是会话偏好(新 `expressionStore`), 不进入自动保存
**测试**: Vitest + fast-check(表达式系数与 `vectorChain` 的一致性、数字格式、两种格式系数一致); RTL 组件测试; Playwright 三个故事 + 键盘 + axe; 视觉测试追加面板展开状态
**目标平台**: 沿用; 剪贴板依赖安全上下文(https / localhost), 否则走回退文本框
**项目类型**: 单一项目, 新增 `src/core/expression/`、`src/features/expression/`、`src/state/expressionStore.ts`
**性能目标**: 200 项构建 + 两种文本生成 < 50 ms(单测上限); 面板 1 s 内显示; 编辑到表达式更新 < 100 ms; 动画参数的刷新节流为 250 ms; 画布 60 fps 不受影响
**约束条件**: 章程全部原则; 不引入排版引擎(视图用结构化 HTML); 首屏 JS 增量 < 5 KB gzip; 默认画面回归快照不变
**规模/范围**: 3 个故事、16 条 FR; 新增约 4 个核心模块(各 < 150 行)、1 个 store、1 个面板组件、1 个剪贴板边界模块

## 章程检查

依据章程 v1.0.0.

| 原则 | 研究前 | 设计后 | 依据 |
|---|---|---|---|
| I 确定性 | 通过 | 通过 | 表达式是 `(函数, t)` 的纯派生, 与画面同源(直接抄写求值器公式, R1); 不改任何渲染路径, 回归快照不变 |
| II 纯核心 / 边界校验 | 通过 | 通过 | `core/expression/*` 无 DOM; 剪贴板访问独立在 `features/expression/copyText.ts`, 失败以 `Result` 返回中文说明(R6); 无外部输入进入核心 |
| III 测试先行 | 通过 | 通过 | contracts 每行对应先失败的测试; 性质测试锁定系数与求值器一致、数字格式、两种格式系数相同; LaTeX 用真实渲染器验证 |
| IV 可访问性 | 通过 | 通过 | 折叠面板 `aria-expanded`/`aria-controls`、`region` 与标题、单选用 `fieldset`; 表达式有视觉隐藏的纯文本供读屏; 复制结果经 `aria-live` 提示; Esc 收起并还焦点(R7); axe 零 serious/critical |
| V 性能预算 | 通过 | 通过 | 60 fps 路径(rAF 画布)完全不涉及; 表达式只在 React commit 中重算, 项组件按引用相等跳过; 播放时间只在含动画参数时以 250 ms 节流订阅(R5); 包体增量有断言 |
| VI 简单 / 本地 | 通过 | 通过 | 无运行时依赖、无网络; 不引入 KaTeX/MathJax 到产品(R4); `katex` 仅为测试工具; 不做虚拟化(200 项直接渲染即可) |
| 附加约束 · 安全 | 通过 | 通过 | 不用 `innerHTML`: 表达式由结构化 JSX 渲染, 文本只作为文本节点; 剪贴板只在用户手势中写入, 不读取剪贴板 |
| 附加约束 · 设计 | 通过 | 通过 | 颜色用 `--component-cN` 令牌, 字体沿用 `--font-mono`/`--font-ui`, 不新增字族; 面板样式走设计令牌 |

无违规. `katex` 是开发依赖而非运行时依赖, 不触发复杂度跟踪, 但在技术背景中声明.

## 项目结构

### 文档(此功能)

```
specs/004-view-copy-expression/
├── plan.md              # 此文件
├── research.md          # R1–R8
├── data-model.md        # Expression / Coefficient / ExpressionPrefs
├── quickstart.md        # 开发顺序与手动验收
├── contracts/expression-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks 生成
```

### 源代码(仓库根目录)

```
src/core/expression/        + types.ts (Expression, Coefficient, Notation, CopyFormat)
                            + build.ts (formatCoefficient, buildExpression)
                            + plainText.ts (toPlainText)
                            + latex.ts (toLatex)
src/core/types.ts           ~ ErrorCode + 'CLIPBOARD_UNAVAILABLE'
src/core/ranges.ts          ~ EXPRESSION_DECIMALS = 4, EXPRESSION_REFRESH_MS = 250, LATEX_TERMS_PER_LINE = 3
src/state/expressionStore.ts + isOpen / notation / format; effectiveNotation
src/features/expression/    + ExpressionPanel.tsx (折叠面板: 写法与格式单选、复制、说明、滚动区)
                            + ExpressionTerms.tsx (按项着色渲染 + 视觉隐藏的纯文本)
                            + useAnimatedTime.ts (仅含动画参数时节流订阅播放时间)
                            + copyText.ts (剪贴板边界, Result)
                            + expression.css
src/features/components-panel/ComponentsPanel.tsx ~ 头部"表达式"切换按钮; 展开时渲染 <ExpressionPanel />
src/test/resetStores.ts     ~ 重置 expressionStore
tests/e2e/expression.spec.ts + 三个故事、键盘、a11y;  tests/visual/layout.spec.ts ~ 追加面板展开状态
package.json                ~ devDependencies + katex
```

**结构决策**: 沿用按功能组织. 数学文本生成放 `core/expression/` 以便性质测试与 95% 覆盖率; 唯一需要浏览器 API 的剪贴板放在 features 的边界层; 面板嵌入既有的分量面板而不是新开对话框(R7).

## 关键设计要点

| 需求 | 手段 | 详见 |
|---|---|---|
| FR-002 忠实于求值约定 | 直接从 `evaluator.ts` 的 `θ = 2π·frac(phase/360 + ∫f)` 抄写; 性质测试与 `vectorChain` 对比 | R1 |
| FR-008 数字格式 | `formatCoefficient`: 4 位小数、去末尾 0、负零为 0、`isRounded` 标志 | R2 |
| FR-003/010/012 写法与格式 | `Expression` 结构 + `toPlainText`/`toLatex`; 视图与复制同源; LaTeX 每行 3 项的 `aligned` | R3 |
| FR-004/013 着色与读屏 | 结构化 JSX, `--term-color` 令牌; 视觉隐藏的纯文本 | R4 |
| FR-007/012a 即时更新与动画参数 | React 订阅 documentStore; 含动画时 250 ms 节流订阅播放时间; 项组件 memo | R5 |
| FR-009/011 复制与回退 | `copyText → Result`; 成功 `showInfo`, 失败 `role="alert"` + 全选的 textarea | R6 |
| FR-001 入口与形态 | 分量面板头部切换按钮 + 非模态折叠面板, Esc 收起 | R7 |
| FR-012 LaTeX 正确性 | KaTeX(devDependency)在测试中 `throwOnError` 渲染 | R8 |

## 风险

| 风险 | 缓解 |
|---|---|
| 200 项的面板使每次滑块拖动的 React 提交变慢, 拖累编辑响应 | 项组件 `memo` 按分量引用跳过; 契约有 < 50 ms 的构建上限; 若仍超预算, 面板收起时完全不渲染(默认收起), 必要时再加虚拟化(复用 `VirtualList`) |
| Firefox/WebKit 的 Playwright 无剪贴板权限 | 跨浏览器用 `addInitScript` 桩, Chromium 另跑真剪贴板(R6) |
| 右侧面板在 320 px 下加入折叠面板后溢出 | 视觉测试追加展开状态; 表达式区 `overflow: auto` + `overflow-wrap: anywhere` |
| LaTeX 在 Typora/Obsidian 等渲染器与 KaTeX 行为不一致 | 只用 `aligned`、`\cdot`、`\pi`、`^\circ`、`\text` 等 amsmath 基础命令; 手动验收中各试一次 |
| `katex` 作为开发依赖被误引入运行时 | `pnpm size` 断言首屏 JS 增量 < 5 KB; lint 规则限制 `katex` 只能在 `*.test.ts` 中导入 |

## 复杂度跟踪

无.
