import { parseColor } from '../core/color'
import { HIGHLIGHT_BANDS } from '../core/ranges'
import type { TrailPlan } from '../core/types'
import { createFakeContext } from '../test/fakeContext'
import { drawRetainedPolyline } from './drawEpicycles'
import { FALLBACK_THEME as theme } from './theme'

const plan = (patch: Partial<TrailPlan> = {}): TrailPlan => ({
  start: 0,
  end: 10,
  step: 0.1,
  stepPower: 0,
  highlightStart: 8,
  mode: 'retained',
  samplesPerTurn: 32,
  isCapped: false,
  isShortened: false,
  ...patch,
})

const draw = (p: TrailPlan, count = 101) => {
  const fake = createFakeContext()
  const timeAt = (index: number) => p.start + ((p.end - p.start) * index) / (count - 1)
  drawRetainedPolyline(fake.ctx, count, (index) => ({ x: index, y: index % 7 }), timeAt, p, theme)
  return fake
}
const strokeColors = (fake: ReturnType<typeof draw>) =>
  fake.calls.filter((call) => call.method === 'stroke').map((call) => String(call.strokeStyle))
const distanceToTrace = (color: string) => {
  const a = parseColor(color)
  const b = parseColor(theme.trace)
  if (!a.ok || !b.ok) throw new Error('unparseable colour')
  return Math.hypot(a.value.r - b.value.r, a.value.g - b.value.g, a.value.b - b.value.b)
}

describe('drawRetainedPolyline', () => {
  test('never uses transparency, so overlapping strokes cannot get brighter', () => {
    const fake = draw(plan())
    expect(fake.calls.every((call) => call.globalAlpha === 1)).toBe(true)
  })

  test('draws everything older than the highlight in the single normal-brightness colour, first', () => {
    const colors = strokeColors(draw(plan()))
    expect(colors[0]).toBe(theme.traceNormal)
    expect(colors.filter((color) => color === theme.traceNormal)).toHaveLength(1)
  })

  test('then brightens towards the full trace colour in a fixed number of bands, oldest first', () => {
    const colors = strokeColors(draw(plan())).slice(1)
    expect(colors).toHaveLength(HIGHLIGHT_BANDS)
    const distances = colors.map(distanceToTrace)
    expect([...distances].sort((a, b) => b - a)).toEqual(distances)
    expect(distances.at(-1)).toBeLessThan(1)
    expect(distances[0]).toBeLessThan(distanceToTrace(theme.traceNormal))
  })

  test('uses smooth curves only when the sampling is sparse', () => {
    expect(draw(plan({ samplesPerTurn: 32 })).count('quadraticCurveTo')).toBe(0)
    expect(draw(plan({ samplesPerTurn: 32 })).count('lineTo')).toBeGreaterThan(50)
    expect(draw(plan({ samplesPerTurn: 10 })).count('quadraticCurveTo')).toBeGreaterThan(50)
  })

  test('copes with a window shorter than the highlight, and with too few points', () => {
    expect(() => draw(plan({ start: 9.5, highlightStart: 9.5 }), 20)).not.toThrow()
    expect(draw(plan(), 1).count('stroke')).toBe(0)
  })

  test('the normal-brightness colour sits between the background and the trace colour', () => {
    expect(distanceToTrace(theme.traceNormal)).toBeGreaterThan(0)
    expect(distanceToTrace(theme.traceNormal)).toBeLessThan(distanceToTrace(theme.background))
  })
})
