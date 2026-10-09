import { LATEX_TERMS_PER_LINE } from '../ranges'
import { signedFactor, splitPhase } from './format'
import { notesOf } from './plainText'
import type { Expression, ExpressionTerm, Notation } from './types'

/** 2\pi \cdot f \cdot t ± φ^\circ */
const argument = (term: ExpressionTerm): string => {
  const phase = splitPhase(term.phaseDeg)
  return `2\\pi \\cdot ${signedFactor(term.frequency)} \\cdot t ${phase.sign} ${phase.magnitude}^\\circ`
}

const complexTerm = (term: ExpressionTerm): string =>
  `${term.amplitude.text}\\, e^{i(${argument(term)})}`
const trigTerm = (fn: 'cos' | 'sin') => (term: ExpressionTerm) =>
  `${term.amplitude.text}\\${fn}(${argument(term)})`

const chunk = <T>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  )

/** 单项: 普通等式; 多项: aligned 环境, 每行 LATEX_TERMS_PER_LINE 项, 续行以 &+ 开头 */
const equation = (
  lhs: string,
  terms: readonly ExpressionTerm[],
  render: (term: ExpressionTerm) => string,
) => {
  const rendered = terms.map(render)
  if (rendered.length === 1) return `${lhs} = ${rendered[0]}`
  const lines = chunk(rendered, LATEX_TERMS_PER_LINE).map((group, i) =>
    i === 0 ? `${lhs} ={}& ${group.join(' + ')}` : `&+ ${group.join(' + ')}`,
  )
  return `\\begin{aligned}\n${lines.join(' \\\\\n')}\n\\end{aligned}`
}

const equationsOf = (expr: Expression, notation: Notation): readonly string[] => {
  switch (notation) {
    case 'complex':
      return [equation('z(t)', expr.terms, complexTerm)]
    case 'parametric':
      return [
        equation('x(t)', expr.terms, trigTerm('cos')),
        equation('y(t)', expr.terms, trigTerm('sin')),
      ]
    case 'waveform':
      return [equation('y(t)', expr.terms, trigTerm('sin'))]
  }
}

/**
 * LaTeX (FR-012): 只用 amsmath 基础命令(aligned / gathered / \text / \cdot / \pi / ^\circ),
 * 说明行与多个等式作为 gathered 的行; 无启用分量时为空串.
 */
export const toLatex = (expr: Expression, notation: Notation): string => {
  if (expr.terms.length === 0) return ''
  const rows = [...notesOf(expr).map((note) => `\\text{${note}}`), ...equationsOf(expr, notation)]
  if (rows.length === 1) return rows[0] as string
  return `\\begin{gathered}\n${rows.join(' \\\\\n')}\n\\end{gathered}`
}
