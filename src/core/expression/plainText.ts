import { signedFactor, splitPhase } from './format'
import type { Expression, ExpressionTerm, Notation } from './types'

/** 纯文本的说明行; `#` 前缀使它在任何文本环境里都能被当作注释 */
export const ANIMATED_NOTE = (time: number): string => `含动画参数, 按 t = ${time.toFixed(2)} 取值`
export const PRECISION_NOTE = '显示精度 4 位小数'

/** 2π·f·t ± φ°; 视图的 <sup> 渲染也用它, 保证与复制文本逐字一致 */
export const plainArgument = (term: ExpressionTerm): string => {
  const phase = splitPhase(term.phaseDeg)
  return `2π·${signedFactor(term.frequency)}·t ${phase.sign} ${phase.magnitude}°`
}

const complexTerm = (term: ExpressionTerm): string =>
  `${term.amplitude.text}·e^{i(${plainArgument(term)})}`
const trigTerm = (fn: 'cos' | 'sin') => (term: ExpressionTerm) =>
  `${term.amplitude.text}·${fn}(${plainArgument(term)})`

export const ANIMATED_MARK = '[动画]'

export interface PlainTextOptions {
  /** 读屏版本: 在每个含动画参数的项后面加 ANIMATED_MARK, 按项定位而不是搜子串 */
  readonly annotateAnimated?: boolean
}

const equation = (
  lhs: string,
  terms: readonly ExpressionTerm[],
  render: (term: ExpressionTerm) => string,
  options: PlainTextOptions,
) =>
  `${lhs} = ${terms
    .map((term) =>
      options.annotateAnimated && term.isAnimated
        ? `${render(term)} ${ANIMATED_MARK}`
        : render(term),
    )
    .join(' + ')}`

export const notesOf = (expr: Expression): readonly string[] => [
  ...(expr.hasAnimated ? [ANIMATED_NOTE(expr.time)] : []),
  ...(expr.isRounded ? [PRECISION_NOTE] : []),
]

const equationsOf = (
  expr: Expression,
  notation: Notation,
  options: PlainTextOptions,
): readonly string[] => {
  switch (notation) {
    case 'complex':
      return [equation('z(t)', expr.terms, complexTerm, options)]
    case 'parametric':
      return [
        equation('x(t)', expr.terms, trigTerm('cos'), options),
        equation('y(t)', expr.terms, trigTerm('sin'), options),
      ]
    case 'waveform':
      return [equation('y(t)', expr.terms, trigTerm('sin'), options)]
  }
}

/** 可读纯文本: 每个等式一行, 说明行在前; 无启用分量时为空串 (FR-010) */
export const toPlainText = (
  expr: Expression,
  notation: Notation,
  options: PlainTextOptions = {},
): string => {
  if (expr.terms.length === 0) return ''
  return [
    ...notesOf(expr).map((note) => `# ${note}`),
    ...equationsOf(expr, notation, options),
  ].join('\n')
}
