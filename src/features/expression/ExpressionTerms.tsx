import { memo, type ReactNode } from 'react'
import { plainArgument } from '../../core/expression/plainText'
import type { Expression, ExpressionTerm, Notation } from '../../core/expression/types'

type TermKind = 'complex' | 'cos' | 'sin'

/** 与 core/expression/plainText 同一记法, 这里只把上标换成 <sup>、按分量着色 (research R4) */
const argumentOf = plainArgument

const body = (term: ExpressionTerm, kind: TermKind): ReactNode => {
  if (kind === 'complex') {
    return (
      <>
        {term.amplitude.text}·e<sup>i({argumentOf(term)})</sup>
      </>
    )
  }
  return `${term.amplitude.text}·${kind}(${argumentOf(term)})`
}

interface TermProps {
  readonly term: ExpressionTerm
  readonly kind: TermKind
  readonly isFirst: boolean
}

/** 一项: 色标 + 文本; 按 term 引用相等跳过重渲染(不可变数据) */
const Term = memo(function Term({ term, kind, isFirst }: TermProps) {
  return (
    <span
      className="expr-term"
      data-color={term.color}
      data-animated={term.isAnimated ? 'true' : undefined}
    >
      <span className="expr-term__op">{isFirst ? '' : '+'}</span>
      <span className="expr-term__chip">
        <span />
      </span>
      <span className="expr-term__body">
        {body(term, kind)}
        {term.isAnimated && <span className="expr-term__badge">动画</span>}
      </span>
    </span>
  )
})

interface EquationProps {
  readonly lhs: string
  readonly kind: TermKind
  readonly terms: readonly ExpressionTerm[]
}

function Equation({ lhs, kind, terms }: EquationProps) {
  return (
    <div className="expression__equation">
      <span className="expression__lhs">{lhs} =</span>
      {terms.map((term, index) => (
        <Term key={term.componentId} term={term} kind={kind} isFirst={index === 0} />
      ))}
    </div>
  )
}

const EQUATIONS: Readonly<Record<Notation, readonly (readonly [string, TermKind])[]>> = {
  complex: [['z(t)', 'complex']],
  parametric: [
    ['x(t)', 'cos'],
    ['y(t)', 'sin'],
  ],
  waveform: [['y(t)', 'sin']],
}

interface ExpressionTermsProps {
  readonly expression: Expression
  readonly notation: Notation
}

/**
 * 视觉公式. 对辅助技术隐藏: 读屏版本是面板里视觉隐藏的纯文本, 避免 <sup> 与色标被读两遍 (FR-013).
 */
export function ExpressionTerms({ expression, notation }: ExpressionTermsProps) {
  return (
    <div className="expression" aria-hidden="true">
      {EQUATIONS[notation].map(([lhs, kind]) => (
        <Equation key={lhs} lhs={lhs} kind={kind} terms={expression.terms} />
      ))}
    </div>
  )
}
