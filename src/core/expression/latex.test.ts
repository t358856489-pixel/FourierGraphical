import fc from 'fast-check'
import katex from 'katex'
import { createComponent, createDefaultFunction } from '../function'
import type { FourierFunction } from '../types'
import { buildExpression } from './build'
import { toLatex } from './latex'
import { toPlainText } from './plainText'
import type { Expression, Notation } from './types'

const NOTATIONS: readonly Notation[] = ['complex', 'parametric', 'waveform']

const fnOf = (
  params: readonly (readonly [amplitude: number, frequency: number, phase: number])[],
): FourierFunction => ({
  ...createDefaultFunction(),
  components: params.map(([a, f, p], index) => createComponent(`c${index}`, a, f, p, index)),
})
const exprOf = (
  params: readonly (readonly [number, number, number])[],
  overrides: Partial<Expression> = {},
): Expression => ({ ...buildExpression(fnOf(params), 0), ...overrides })
// 锯齿波的振幅 2/(π·n) 必然被取整; 这里只测结构, 说明行由专门的用例测, 故清掉标志
const sawtooth = (count: number) =>
  exprOf(
    Array.from(
      { length: count },
      (_, i) => [2 / (Math.PI * (i + 1)), (i + 1) * 0.2, i % 2 ? 180 : 0] as const,
    ),
    { isRounded: false },
  )

const renders = (latex: string) =>
  katex.renderToString(latex, { throwOnError: true, displayMode: true, strict: 'warn' })

/** 数字序列: 用于比对两种格式的系数逐项相同 */
const numbersIn = (text: string) => text.match(/-?\d+(?:\.\d+)?/g) ?? []

describe('toLatex', () => {
  test('a single term is a plain equation without an environment', () => {
    const latex = toLatex(exprOf([[1, 0.2, 0]]), 'complex')
    expect(latex).toBe('z(t) = 1\\, e^{i(2\\pi \\cdot 0.2 \\cdot t + 0^\\circ)}')
    expect(latex).not.toContain('aligned')
  })

  test('multiple terms use aligned with at most 3 terms per line', () => {
    const latex = toLatex(sawtooth(7), 'complex')
    expect(latex.startsWith('\\begin{aligned}')).toBe(true)
    expect(latex.trimEnd().endsWith('\\end{aligned}')).toBe(true)
    const lines = latex.split('\\\\')
    expect(lines).toHaveLength(3)
    for (const line of lines) expect(line.split('e^{').length - 1).toBeLessThanOrEqual(3)
    expect(latex.split('e^{').length - 1).toBe(7)
  })

  test('parametric notation gives two aligned blocks inside gathered; waveform uses \\sin', () => {
    const latex = toLatex(sawtooth(4), 'parametric')
    expect(latex.split('\\begin{aligned}')).toHaveLength(3)
    expect(latex).toContain('\\begin{gathered}')
    expect(latex).toContain('x(t) =')
    expect(latex).toContain('y(t) =')
    expect(latex).toContain('\\cos(')
    expect(toLatex(sawtooth(2), 'waveform')).toContain('\\sin(')
    expect(toLatex(sawtooth(2), 'waveform')).not.toContain('\\cos(')
  })

  test('negative frequency is parenthesised, negative phase becomes a minus, degrees use ^\\circ', () => {
    const latex = toLatex(exprOf([[2, -0.4, -30]]), 'waveform')
    expect(latex).toBe('y(t) = 2\\sin(2\\pi \\cdot (-0.4) \\cdot t - 30^\\circ)')
  })

  test('notes are \\text lines placed before the equation', () => {
    const latex = toLatex(
      exprOf([[1, 0.2, 0]], { hasAnimated: true, time: 5, isRounded: true }),
      'complex',
    )
    expect(latex.indexOf('\\text{含动画参数, 按 t = 5.00 取值}')).toBeLessThan(
      latex.indexOf('\\text{显示精度 4 位小数}'),
    )
    expect(latex.indexOf('\\text{显示精度 4 位小数}')).toBeLessThan(latex.indexOf('z(t) ='))
  })

  test('empty expression → empty string', () => {
    for (const notation of NOTATIONS) expect(toLatex(exprOf([]), notation)).toBe('')
  })

  describe('renders in KaTeX without errors (FR-012)', () => {
    for (const notation of NOTATIONS) {
      for (const count of [1, 3, 200]) {
        for (const withNotes of [false, true]) {
          test(`${notation} × ${count} terms × notes=${withNotes}`, () => {
            const expr = sawtooth(count)
            const latex = toLatex(
              withNotes ? { ...expr, hasAnimated: true, time: 2.5, isRounded: true } : expr,
              notation,
            )
            expect(() => renders(latex)).not.toThrow()
          })
        }
      }
    }
  })

  test('LaTeX and plain text carry the same coefficients, term by term', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.double({ min: 0, max: 100, noNaN: true }),
            fc.double({ min: -100, max: 100, noNaN: true }),
            fc.double({ min: -3600, max: 3600, noNaN: true }),
          ),
          { minLength: 1, maxLength: 12 },
        ),
        fc.constantFrom(...NOTATIONS),
        (params, notation) => {
          const expr = exprOf(params)
          // 去掉两种格式各自固有的数字(2π 的 2、小数位说明), 只比系数
          const strip = (text: string) =>
            numbersIn(text.replace(/2\\pi|2π/g, '').replace(/#.*|\\text\{[^}]*\}/g, ''))
          expect(strip(toLatex(expr, notation))).toEqual(strip(toPlainText(expr, notation)))
        },
      ),
      { numRuns: 100 },
    )
  })
})
