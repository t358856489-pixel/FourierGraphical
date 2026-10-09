# 契约: 表达式的构建、文本与复制

约定同功能 001–003: `src/core/` 纯函数、`Result<T>`、不可变. 每行契约先有失败测试(章程 III).

## 1. `core/expression/build`
```ts
formatCoefficient(value: number): Coefficient
buildExpression(fn: FourierFunction, t: number): Expression
```
| 契约 | 需求 |
|---|---|
| `formatCoefficient`: `0.5 → "0.5"`, `0.30000000000000004 → "0.3"`(isRounded), `-0 → "0"`, `1e-5 → "0"`(isRounded), `123.45678 → "123.4568"`(isRounded), `-0.4 → "-0.4"`; 对任意有限数 `text` 不含 `e`、不以 `.` 结尾、无末尾 0 (fast-check) | FR-008 |
| 只含启用分量, 顺序与 `fn.components` 一致; `excludedCount` = 停用数 | FR-004, FR-005 |
| 任意常量轨道函数与 `t ∈ [0, 1000]`: 按 `Σ A·(cos, sin)(2π f t + φπ/180)` 求和与 `vectorChain(fn, t)` 末端相差 < 1e-9 (fast-check) | FR-002, SC-002 |
| 同上但用 `text` 的数值, 且频率量化到 `FREQUENCY_RANGE.step`、相位到 `PHASE_RANGE.step`(编辑器可输入的精度; 任意频率在大 t 下的取整误差会累积, 不在承诺内): 相差 ≤ 5e-5 × terms.length + 1e-9 | FR-008, SC-002 |
| 带关键帧的分量: `isAnimated` 为真, 系数等于 `evaluate(track, t)`; `hasAnimated`、`time` 随之设置 | FR-012a |
| 无分量或全部停用: `terms = []`, `excludedCount` 正确 | FR-006 |
| 200 个分量: `buildExpression` + `toPlainText` + `toLatex` 合计 < 50 ms(基准式单测, 阈值宽松以容忍 CI) | FR-014, SC-004 |

## 2. `core/expression/plainText` 与 `core/expression/latex`
```ts
toPlainText(expr: Expression, notation: Notation): string
toLatex(expr: Expression, notation: Notation): string
```
| 契约 | 需求 |
|---|---|
| 单项 complex: `z(t) = 1·e^{i(2π·0.2·t + 0°)}`; 无 `+` | 边界情况"只有一个分量" |
| 多项: 项之间 ` + `; parametric 输出两行 `x(t) = …\ny(t) = …`; waveform 用 `sin` | FR-002, FR-003 |
| 负频率: `2π·(-0.4)·t`; 负相位写成 ` - 30°`, 不出现 `+ -30°` | 边界情况"负频率" |
| 相位 400° 原样输出, 不归一化 | 边界情况"相位超出 ±360°" |
| 振幅为 0 的分量仍是一项 `0·e^{…}`, 计入项数 | 边界情况"振幅为 0" |
| 每一项的系数文本 = `Coefficient.text`, 项数 = `terms.length`(用正则计数) | FR-010 |
| `hasAnimated` → 首行 `# 含动画参数, 按 t = 5.00 取值`; `isRounded` → `# 显示精度 4 位小数`; 两者都有时两行都出现, 顺序固定 | FR-012a, FR-008 |
| `terms = []` → `""`(两种格式) | FR-006 |
| LaTeX: 三种写法 × {1, 3, 200} 项 × {有, 无}说明行, `katex.renderToString(…, {throwOnError: true})` 全部不抛 | FR-012 |
| LaTeX 与纯文本的系数逐项相同: 从两者提取的数字序列相等 (fast-check) | 故事 3 场景 1 |
| 纯文本不含 Unicode 减号 `−`、乘号 `×`; 只含 `π · ° ^ { } ( ) + - . = , 数字 字母 空格 换行 #` 与说明行中的中文 | FR-010 |

## 3. `state/expressionStore`
```ts
useExpressionStore: { isOpen, notation, format, toggleOpen, setNotation, setFormat, reset }
effectiveNotation(prefs, mode): Notation
```
| 契约 | 需求 |
|---|---|
| 初始 `isOpen=false, notation=null, format='plain'`; `effectiveNotation(null, 'drawing2d')='complex'`, `(null,'waveform')='waveform'`; 显式选择后不随模式变化 | FR-003 |
| 不出现在自动保存的草稿里(`autosave` 测试: 修改偏好后草稿内容不变) | FR-015 |

## 4. `features/expression/copyText`(DOM 边界)
```ts
copyText(text: string): Promise<Result<void>>
```
| 契约 | 需求 |
|---|---|
| `navigator.clipboard.writeText` 成功 → `ok`, 且被调用一次、参数为原文 | FR-009 |
| `writeText` 拒绝(NotAllowedError)或 `navigator.clipboard` 为 `undefined` → `err('CLIPBOARD_UNAVAILABLE', 中文说明)`; 不抛异常 | FR-011 |

## 5. `features/expression/ExpressionPanel`(组件测试, RTL)
| 契约 | 需求 |
|---|---|
| 头部"表达式"按钮 `aria-expanded` 切换; 展开后出现 `region` "表达式", 焦点移到标题; 面板内 Esc 收起并把焦点还给按钮 | FR-001, FR-013 |
| 5 项方波: 渲染 5 个 `.expr-term`, 每项的 `--term-color` 对应分量颜色, 文本含 `1.2732`, `0.2`, `0°` 等 | FR-002, FR-004 |
| 修改相位(`setParamValue`) → 对应项文本即时更新; `undo()` 恢复、`redo()` 再变; 停用一个分量 → 项数 4, 出现"已排除 1 个停用分量" | FR-005, FR-007 |
| 写法单选切换 → 文本结构变化; 二维绘图模式默认 complex, 波形默认 waveform | FR-003 |
| 空函数 → "当前没有启用的分量", "复制"禁用 | FR-006 |
| 点击复制(桩成功)→ `showInfo` 被调用含"已复制"且含项数; 桩失败 → 出现 `role="alert"` 与已全选的 `textarea`(`selectionStart=0`, `selectionEnd=length`) | FR-009, FR-011 |
| 含关键帧分量: 出现"含动画参数"标注与标记的项; 播放时间变化后 ≤ 300 ms 内文本更新(fake timers); 无关键帧时不订阅 `playbackStore`(subscribe spy 未被调用) | FR-012a, R5 |
| 表达式容器有供读屏的纯文本版本(视觉隐藏节点), 内容 = `toPlainText`; 视觉公式容器 `aria-hidden="true"`, 避免读两遍 | FR-013 |
| 复制的文本 === 面板内渲染出的纯文本版本(逐字) | FR-010 |

## 6. 端到端 `tests/e2e/expression.spec.ts`(三个浏览器 + mobile)
| 契约 | 需求 |
|---|---|
| 故事 1: 应用 5 项方波 → 打开表达式 → 5 项, 系数与分量面板的数值框一致; 改相位为 90 → 对应项含 `90°`; 停用 → 排除说明 | 故事 1 场景 1–4 |
| 故事 1: 图形库"雪花"(≈126 项)与 200 分量(预设 200 项锯齿)→ 面板 1 s 内出现且项数正确, 可滚动到最后一项 | 故事 1 场景 5, FR-014 |
| 故事 2: 桩 `writeText` → 点击复制 → `window.__copied` === 面板纯文本; 提示区出现"已复制"; Chromium 另用真剪贴板 `readText` 校验 | 故事 2 场景 1–2 |
| 故事 2: 桩拒绝 → 出现文本框且全选 | 故事 2 场景 3 |
| 故事 3: 选 LaTeX 复制 → 文本以 `\begin{aligned}` 开头(多项)且 `\cdot` 计数 = 项数 × 2 | 故事 3 场景 1 |
| 键盘: Tab 到"表达式"→ Enter 展开 → 方向键切写法 → Tab 到复制 → Enter → 提示; Esc 收起 | FR-013, 故事 1 场景 7 |
| a11y: 面板展开时 axe 零 serious/critical; 320/768/1024/1440 下无横向溢出(视觉测试追加面板展开状态) | SC-005 |
| 默认画面回归快照不变; `pnpm size` 通过且首屏 JS 相对 T002 记录的基线增量 < 5 KB gzip(人工比对) | 章程 V |
