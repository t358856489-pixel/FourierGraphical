# 数据模型: 查看并复制函数的数学表达式

**日期**: 2026-10-09 | **规范**: [spec.md](./spec.md) | **研究**: [research.md](./research.md)

**持久化实体零改动**: `FourierFunction`/`HarmonicComponent`/`ViewSettings` 与 schema 都不变(FR-015). 本功能只有**派生结构**与**会话偏好**, 都不保存.

## Expression (表达式, 派生)

```ts
interface ExpressionTerm {
  readonly componentId: string      // 对应分量, 用于 key 与高亮
  readonly color: string            // 分量的语义色索引, 如 "c3" (FR-004)
  readonly amplitude: Coefficient   // 时刻 t 的瞬时值
  readonly frequency: Coefficient   // 圈/秒
  readonly phaseDeg: Coefficient    // 度
  readonly isAnimated: boolean      // 三个参数中任一带关键帧 (FR-012a)
}
interface Coefficient {
  readonly value: number            // 未取整的瞬时值
  readonly text: string             // 最多 4 位小数, 去末尾 0, 负零为 "0" (FR-008)
  readonly isRounded: boolean       // text 与 value 不等
}
interface Expression {
  readonly terms: readonly ExpressionTerm[]  // 只含启用分量, 顺序 = 分量列表顺序 (FR-004, FR-005)
  readonly excludedCount: number             // 停用分量数 (FR-005)
  readonly hasAnimated: boolean              // terms.some(t => t.isAnimated)
  readonly isRounded: boolean                // 任一系数被四舍五入 (FR-008)
  readonly time: number                      // 构建时使用的时刻 t; 仅当 hasAnimated 时有意义
}
buildExpression(fn: FourierFunction, t: number): Expression
```

不变量(契约 §1 测试):
- `terms.length + excludedCount === fn.components.length`
- `terms[i].componentId` 的顺序与 `fn.components.filter(enabled)` 一致
- 对常量轨道的函数, `Σ amplitude.value·(cos, sin)(2π·frequency.value·t + phaseDeg.value·π/180)` 与 `vectorChain(fn, t)` 末端相差 < 1e-9; 用 `text` 代替 `value`(频率、相位在编辑器精度上)时相差 ≤ 5e-5 × terms.length + 1e-9
- `buildExpression(fn, t)` 对相同引用的 `fn` 与相同 `t` 返回结构相等的结果(纯函数)

## Notation (写法) 与 CopyFormat (格式): 会话偏好

```ts
type Notation = 'complex' | 'parametric' | 'waveform'
type CopyFormat = 'plain' | 'latex'

interface ExpressionPrefs {               // src/state/expressionStore.ts, 不持久化 (FR-015)
  readonly isOpen: boolean                // 折叠面板是否展开 (R7)
  readonly notation: Notation | null      // null = 跟随呈现模式 (FR-003)
  readonly format: CopyFormat             // 默认 'plain' (FR-012)
}
defaultNotation(mode: PresentationMode): Notation   // drawing2d → complex, waveform → waveform
effectiveNotation(prefs, mode) = prefs.notation ?? defaultNotation(mode)
```

状态转换: `toggleOpen`、`setNotation(n)`(用户显式选择后不再跟随模式)、`setFormat(f)`、`reset`(测试用). 刷新页面后全部回到默认: 收起、跟随模式、纯文本.

## 文本渲染(派生, 不存)

```ts
toPlainText(expr: Expression, notation: Notation): string   // 空 terms → ""
toLatex(expr: Expression, notation: Notation): string       // 空 terms → ""
```

| 写法 | 纯文本形状 | LaTeX 形状 |
|---|---|---|
| complex | `z(t) = A·e^{i(2π·f·t + φ°)} + …` 一行 | `z(t) = …` 单项; 多项 `\begin{aligned} z(t) ={}& … \\ &+ … \end{aligned}` 每行 3 项 |
| parametric | `x(t) = A·cos(2π·f·t + φ°) + …` 与 `y(t) = A·sin(…) + …` 两行 | 两个 `aligned` 块作为外层 `gathered` 的两行 |
| waveform | `y(t) = A·sin(2π·f·t + φ°) + …` 一行 | 同 complex 的结构, 函数换成 `\sin` |

说明行(FR-012a、FR-008): 纯文本在式子前加 `# 含动画参数, 按 t = 5.00 取值` / `# 显示精度 4 位小数`; LaTeX 用 `\text{…}` 作为外层 `gathered` 的首行(只有一个等式且无说明行时不加 `gathered`). 负系数加括号: `2π·(-0.4)·t`; 负相位写成 ` - 30°`; 单项时无 `+`; 无启用分量时两者都返回空串, 由视图显示空状态并禁用"复制".

## 错误码(扩展)

`ErrorCode` 新增 `'CLIPBOARD_UNAVAILABLE'`: 剪贴板 API 不存在或写入被拒绝; 消息为面向用户的中文说明, 视图据此显示回退文本框(FR-011).
