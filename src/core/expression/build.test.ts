import fc from 'fast-check'
import { vectorChain } from '../evaluator'
import { applyPreset, createComponent, createDefaultFunction, updateTrack } from '../function'
import { evaluate } from '../keyframes'
import { FREQUENCY_RANGE, PHASE_RANGE } from '../ranges'
import { animated, type FourierFunction } from '../types'
import { buildExpression, formatCoefficient } from './build'
import { toLatex } from './latex'
import { toPlainText } from './plainText'

const TAU = Math.PI * 2

const withComponents = (
  params: readonly (readonly [amplitude: number, frequency: number, phase: number])[],
): FourierFunction => ({
  ...createDefaultFunction(),
  components: params.map(([a, f, p], index) => createComponent(`c${index}`, a, f, p, index)),
})

const quantize = (value: number, step: number) => Math.round(value / step) * step

const arbitraryFunction = (quantized: boolean) =>
  fc
    .array(
      fc.tuple(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: -3600, max: 3600, noNaN: true }),
      ),
      { minLength: 1, maxLength: 200 },
    )
    .map((params) =>
      withComponents(
        params.map(([a, f, p]) =>
          quantized
            ? ([a, quantize(f, FREQUENCY_RANGE.step), quantize(p, PHASE_RANGE.step)] as const)
            : ([a, f, p] as const),
        ),
      ),
    )

/** 按契约公式 Σ A·(cos, sin)(2π f t + φ·π/180) 从表达式的系数求向量末端 */
const tipFromExpression = (fn: FourierFunction, t: number, useText: boolean) =>
  buildExpression(fn, t).terms.reduce(
    (acc, term) => {
      const pick = (c: { value: number; text: string }) => (useText ? Number(c.text) : c.value)
      const theta = TAU * pick(term.frequency) * t + (pick(term.phaseDeg) * Math.PI) / 180
      const a = pick(term.amplitude)
      return { x: acc.x + a * Math.cos(theta), y: acc.y + a * Math.sin(theta) }
    },
    { x: 0, y: 0 },
  )

const tipFromEvaluator = (fn: FourierFunction, t: number) => {
  const chain = vectorChain(fn, t)
  return chain.length === 0 ? { x: 0, y: 0 } : (chain.at(-1)?.to ?? { x: 0, y: 0 })
}

describe('formatCoefficient (FR-008)', () => {
  test.each([
    [0.5, '0.5', false],
    [0.30000000000000004, '0.3', true],
    [-0, '0', false],
    [1e-5, '0', true],
    [123.45678, '123.4568', true],
    [-0.4, '-0.4', false],
    [1.27, '1.27', false],
  ])('%p → %p (isRounded %p)', (value, text, isRounded) => {
    expect(formatCoefficient(value)).toEqual({ value, text, isRounded })
  })

  test('for any value in the editor ranges the text has no exponent, no trailing dot and no trailing zeros', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (value) => {
        const { text } = formatCoefficient(value)
        expect(text).not.toMatch(/e/i)
        expect(text).not.toMatch(/\.$/)
        if (text.includes('.')) expect(text).not.toMatch(/0$/)
        expect(text).not.toBe('-0')
        expect(Math.abs(Number(text) - value)).toBeLessThanOrEqual(5e-5 + 1e-12)
      }),
    )
  })
})

describe('buildExpression', () => {
  test('keeps only enabled components, in list order, and counts the excluded ones', () => {
    const fn = withComponents([
      [1, 0.2, 0],
      [0.5, 0.4, 90],
      [0.25, 0.6, 180],
    ])
    const disabled = {
      ...fn,
      components: fn.components.map((c, i) => (i === 1 ? { ...c, enabled: false } : c)),
    }
    const expr = buildExpression(disabled, 0)
    expect(expr.terms.map((term) => term.componentId)).toEqual(['c0', 'c2'])
    expect(expr.terms.map((term) => term.color)).toEqual(['c0', 'c2'])
    expect(expr.excludedCount).toBe(1)
    expect(expr.hasAnimated).toBe(false)
    expect(expr.terms[1]?.phaseDeg.text).toBe('180')
  })

  test('the square wave preset yields the familiar 4/(π·m) coefficients', () => {
    const preset = applyPreset(createDefaultFunction(), 'square', 5)
    if (!preset.ok) throw new Error(preset.error.message)
    const expr = buildExpression(preset.value, 0)
    expect(expr.terms.map((term) => term.amplitude.text)).toEqual([
      '1.2732',
      '0.4244',
      '0.2546',
      '0.1819',
      '0.1415',
    ])
    expect(expr.terms.map((term) => term.frequency.text)).toEqual(['0.2', '0.6', '1', '1.4', '1.8'])
    expect(expr.isRounded).toBe(true)
  })

  test('the written formula reproduces the evaluator exactly (unrounded coefficients)', () => {
    fc.assert(
      fc.property(
        arbitraryFunction(false),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (fn, t) => {
          const expected = tipFromEvaluator(fn, t)
          const actual = tipFromExpression(fn, t, false)
          const scale = Math.max(1, Math.abs(expected.x), Math.abs(expected.y))
          expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(
            1e-9 * scale,
          )
        },
      ),
      { numRuns: 200 },
    )
  })

  test('with displayed (rounded) coefficients at editor precision the error is bounded by 5e-5 per term', () => {
    fc.assert(
      fc.property(
        arbitraryFunction(true),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (fn, t) => {
          const expected = tipFromEvaluator(fn, t)
          const actual = tipFromExpression(fn, t, true)
          const terms = fn.components.length
          // 频率与相位在编辑器精度上不会被取整, 误差只来自振幅; 大 t 下三角函数的浮点误差另给余量
          expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThanOrEqual(
            5e-5 * terms + 1e-9 * Math.max(1, t) * terms,
          )
        },
      ),
      { numRuns: 200 },
    )
  })

  test('animated tracks are evaluated at t and flagged', () => {
    const base = withComponents([
      [1, 0.2, 0],
      [0.5, 0.4, 0],
    ])
    const first = base.components[0]
    if (!first) throw new Error('missing component')
    const fn = updateTrack(
      base,
      first.id,
      'amplitude',
      animated([
        { time: 0, value: 1, easing: 'linear' },
        { time: 10, value: 3, easing: 'linear' },
      ]),
    )
    const expr = buildExpression(fn, 2.5)
    expect(expr.hasAnimated).toBe(true)
    expect(expr.time).toBe(2.5)
    expect(expr.terms[0]?.isAnimated).toBe(true)
    expect(expr.terms[0]?.amplitude.value).toBe(
      evaluate(fn.components[0]?.amplitude ?? first.amplitude, 2.5),
    )
    expect(expr.terms[0]?.amplitude.text).toBe('1.5')
    expect(expr.terms[1]?.isAnimated).toBe(false)
  })

  test('an empty function and an all-disabled function give no terms', () => {
    const empty = { ...createDefaultFunction(), components: [] }
    expect(buildExpression(empty, 0)).toEqual({
      terms: [],
      excludedCount: 0,
      hasAnimated: false,
      isRounded: false,
      time: 0,
    })
    const fn = createDefaultFunction()
    const allOff = { ...fn, components: fn.components.map((c) => ({ ...c, enabled: false })) }
    const expr = buildExpression(allOff, 1)
    expect(expr.terms).toEqual([])
    expect(expr.excludedCount).toBe(3)
  })

  test('terms of unchanged constant components keep their identity across edits (memo-friendly cache)', () => {
    const fn = withComponents([
      [1, 0.2, 0],
      [0.5, 0.4, 90],
      [0.25, 0.6, 180],
    ])
    const before = buildExpression(fn, 0)
    const second = fn.components[1]
    if (!second) throw new Error('missing component')
    const edited = updateTrack(fn, second.id, 'phase', { kind: 'constant', value: 45 })
    const after = buildExpression(edited, 7)
    expect(after.terms[0]).toBe(before.terms[0])
    expect(after.terms[2]).toBe(before.terms[2])
    expect(after.terms[1]).not.toBe(before.terms[1])
    expect(after.terms[1]?.phaseDeg.text).toBe('45')
    // 缓存与整体重算逐项结构相等 (章程 I)
    expect(after).toEqual(buildExpression(edited, 7))
  })

  test('is a pure function of (fn, t)', () => {
    const fn = createDefaultFunction()
    expect(buildExpression(fn, 3)).toEqual(buildExpression(fn, 3))
  })

  test('200 components build and render both formats well under the budget (FR-014)', () => {
    const preset = applyPreset(createDefaultFunction(), 'sawtooth', 200)
    if (!preset.ok) throw new Error(preset.error.message)
    const started = performance.now()
    const expr = buildExpression(preset.value, 0)
    const plain = toPlainText(expr, 'complex')
    const latex = toLatex(expr, 'parametric')
    expect(performance.now() - started).toBeLessThan(50)
    expect(expr.terms).toHaveLength(200)
    expect(plain.length).toBeGreaterThan(200 * 20)
    expect(latex.length).toBeGreaterThan(200 * 20)
  })
})
