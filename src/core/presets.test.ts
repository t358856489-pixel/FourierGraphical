import { tipAt } from './evaluator'
import { applyPreset, createDefaultFunction } from './function'
import { PRESETS, type PresetId } from './presets'
import type { FourierFunction } from './types'

const BASE = 0.2
const PERIOD = 1 / BASE
const build = (preset: PresetId, count: number): FourierFunction => {
  const result = applyPreset(createDefaultFunction(), preset, count)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const value = (fn: FourierFunction, t: number) => tipAt(fn, t).y
const constantOf = (fn: FourierFunction, index: number, param: 'amplitude' | 'frequency' | 'phase') => {
  const track = fn.components[index]?.[param]
  return track?.kind === 'constant' ? track.value : Number.NaN
}

const ideal: Record<PresetId, (phase: number) => number> = {
  square: (p) => (p < 0.5 ? 1 : -1),
  sawtooth: (p) => (p < 0.5 ? 2 * p : 2 * p - 2),
  triangle: (p) => (p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4),
}

describe('presets', () => {
  test('offers square, sawtooth and triangle with Chinese names', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(['square', 'sawtooth', 'triangle'])
    expect(PRESETS.map((preset) => preset.name)).toEqual(['方波', '锯齿波', '三角波'])
  })

  test('square wave uses odd harmonics with amplitude 4/(πm)', () => {
    const fn = build('square', 3)
    expect([0, 1, 2].map((i) => constantOf(fn, i, 'frequency') / BASE)).toEqual([1, 3, 5].map((m) => expect.closeTo(m, 10)))
    expect(constantOf(fn, 1, 'amplitude')).toBeCloseTo(4 / (Math.PI * 3), 12)
    expect(constantOf(fn, 1, 'phase')).toBe(0)
  })

  test('sawtooth alternates phase on even harmonics; triangle on every other odd harmonic', () => {
    expect([0, 1, 2].map((i) => constantOf(build('sawtooth', 3), i, 'phase'))).toEqual([0, 180, 0])
    expect([0, 1, 2].map((i) => constantOf(build('triangle', 3), i, 'phase'))).toEqual([0, 180, 0])
    expect(constantOf(build('triangle', 2), 1, 'amplitude')).toBeCloseTo(8 / (Math.PI ** 2 * 9), 12)
  })

  test('generated components are constant, enabled and uniquely identified', () => {
    const fn = build('square', 20)
    expect(fn.components).toHaveLength(20)
    expect(fn.components.every((c) => c.enabled && c.amplitude.kind === 'constant')).toBe(true)
    expect(new Set(fn.components.map((c) => c.id)).size).toBe(20)
  })

  test.each<[PresetId, number, number]>([
    ['square', 20, 0.2],
    ['sawtooth', 30, 0.2],
    ['triangle', 10, 0.02],
  ])('%s with %i components approximates the ideal wave away from its jumps', (preset, count, tolerance) => {
    const fn = build(preset, count)
    for (const phase of [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]) {
      expect(Math.abs(value(fn, phase * PERIOD) - ideal[preset](phase))).toBeLessThan(tolerance)
    }
  })

  test('more components approximate the square wave better', () => {
    const error = (count: number) => Math.abs(value(build('square', count), 0.25 * PERIOD) - 1)
    expect(error(25)).toBeLessThan(error(2))
  })

  test.each([0, 51, 2.5, Number.NaN])('rejects a component count of %s', (count) => {
    const result = applyPreset(createDefaultFunction(), 'square', count)
    expect(result.ok === false && result.error.code).toBe('OUT_OF_RANGE')
  })

  test('applyPreset replaces the components but keeps identity, name and mode', () => {
    const original = createDefaultFunction()
    const fn = build('triangle', 4)
    expect(fn.name).toBe(original.name)
    expect(fn.presentationMode).toBe(original.presentationMode)
    expect(fn.components).toHaveLength(4)
  })
})
