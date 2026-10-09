import { createComponent, createDefaultFunction } from '../function'
import type { FourierFunction } from '../types'
import { buildExpression } from './build'
import { toPlainText } from './plainText'
import type { Expression } from './types'

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

const countTerms = (text: string, kind: 'e^{' | 'cos(' | 'sin(') => text.split(kind).length - 1

describe('toPlainText', () => {
  test('a single complex term has no plus sign and exactly the documented shape', () => {
    expect(toPlainText(exprOf([[1, 0.2, 0]]), 'complex')).toBe('z(t) = 1·e^{i(2π·0.2·t + 0°)}')
  })

  test('multiple terms are joined with " + " in list order', () => {
    const text = toPlainText(
      exprOf([
        [1, 0.2, 0],
        [0.5, 0.6, 90],
      ]),
      'complex',
    )
    expect(text).toBe('z(t) = 1·e^{i(2π·0.2·t + 0°)} + 0.5·e^{i(2π·0.6·t + 90°)}')
  })

  test('parametric notation gives two lines x(t) and y(t); waveform gives y(t) with sin', () => {
    const expr = exprOf([
      [1, 0.2, 0],
      [0.5, 0.6, 90],
    ])
    const parametric = toPlainText(expr, 'parametric')
    expect(parametric.split('\n')).toEqual([
      'x(t) = 1·cos(2π·0.2·t + 0°) + 0.5·cos(2π·0.6·t + 90°)',
      'y(t) = 1·sin(2π·0.2·t + 0°) + 0.5·sin(2π·0.6·t + 90°)',
    ])
    expect(toPlainText(expr, 'waveform')).toBe(
      'y(t) = 1·sin(2π·0.2·t + 0°) + 0.5·sin(2π·0.6·t + 90°)',
    )
  })

  test('negative frequencies are parenthesised and negative phases become a minus sign', () => {
    const text = toPlainText(exprOf([[2, -0.4, -30]]), 'complex')
    expect(text).toBe('z(t) = 2·e^{i(2π·(-0.4)·t - 30°)}')
    expect(text).not.toContain('+ -')
  })

  test('phases beyond ±360° and zero amplitudes are written as they are', () => {
    const text = toPlainText(
      exprOf([
        [0, 0.2, 400],
        [1, 0.4, 0],
      ]),
      'waveform',
    )
    expect(text).toBe('y(t) = 0·sin(2π·0.2·t + 400°) + 1·sin(2π·0.4·t + 0°)')
    expect(countTerms(text, 'sin(')).toBe(2)
  })

  test('every coefficient text appears and the term count matches', () => {
    const expr = exprOf(
      Array.from({ length: 37 }, (_, i) => [1 / (i + 1), (i + 1) * 0.2, (i * 37) % 360] as const),
    )
    const complex = toPlainText(expr, 'complex')
    expect(countTerms(complex, 'e^{')).toBe(37)
    for (const term of expr.terms) {
      expect(complex).toContain(`${term.amplitude.text}·e^{i(2π·${term.frequency.text}·t`)
    }
    expect(countTerms(toPlainText(expr, 'parametric'), 'cos(')).toBe(37)
    expect(countTerms(toPlainText(expr, 'parametric'), 'sin(')).toBe(37)
  })

  test('animation and precision notes come first, in a fixed order', () => {
    const animatedOnly = toPlainText(
      exprOf([[1, 0.2, 0]], { hasAnimated: true, time: 5 }),
      'complex',
    )
    expect(animatedOnly.split('\n')).toEqual([
      '# 含动画参数, 按 t = 5.00 取值',
      'z(t) = 1·e^{i(2π·0.2·t + 0°)}',
    ])

    const roundedOnly = toPlainText(exprOf([[1, 0.2, 0]], { isRounded: true }), 'complex')
    expect(roundedOnly.split('\n')[0]).toBe('# 显示精度 4 位小数')

    const both = toPlainText(
      exprOf([[1, 0.2, 0]], { hasAnimated: true, time: 12.345, isRounded: true }),
      'complex',
    )
    expect(both.split('\n').slice(0, 2)).toEqual([
      '# 含动画参数, 按 t = 12.35 取值',
      '# 显示精度 4 位小数',
    ])
  })

  test('annotateAnimated marks exactly the animated terms, after the term, even when texts collide', () => {
    // 动画项振幅 "1", 另一项频率恰为 1: 子串 "1·" 在两处出现, 只能标第一项
    const expr = exprOf([
      [1, 0.2, 0],
      [0.2546, 1, 0],
    ])
    const marked = {
      ...expr,
      hasAnimated: true,
      time: 2,
      terms: expr.terms.map((term, i) => (i === 0 ? { ...term, isAnimated: true } : term)),
    }
    const text = toPlainText(marked, 'waveform', { annotateAnimated: true })
    expect(text.split('\n')[1]).toBe('y(t) = 1·sin(2π·0.2·t + 0°) [动画] + 0.2546·sin(2π·1·t + 0°)')
    expect(text.match(/\[动画\]/g)).toHaveLength(1)
    // 两个动画项同为 "1": 各标一次
    const both = { ...marked, terms: marked.terms.map((term) => ({ ...term, isAnimated: true })) }
    expect(
      toPlainText(both, 'parametric', { annotateAnimated: true }).match(/\[动画\]/g),
    ).toHaveLength(4)
    // 默认不标注
    expect(toPlainText(marked, 'waveform')).not.toContain('[动画]')
  })

  test('no enabled components → empty string for every notation', () => {
    const empty = exprOf([])
    for (const notation of ['complex', 'parametric', 'waveform'] as const) {
      expect(toPlainText(empty, notation)).toBe('')
    }
  })

  test('uses only ASCII operators plus π · ° (no Unicode minus or times sign)', () => {
    const text = toPlainText(
      exprOf(
        [
          [1.5, -0.2, -45],
          [0.25, 100, 3600],
        ],
        { hasAnimated: true, time: 1, isRounded: true },
      ),
      'parametric',
    )
    expect(text).not.toMatch(/[−×]/)
    const formulaLines = text.split('\n').filter((line) => !line.startsWith('#'))
    for (const line of formulaLines) expect(line).toMatch(/^[π·°^{}()+\-.=, 0-9a-z]+$/)
  })
})
