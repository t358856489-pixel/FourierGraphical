import { createDefaultFunction, setComponentEnabled, setPresentationMode } from '../core/function'
import { DEFAULT_TRAIL_SECONDS } from '../core/ranges'
import type { ViewSettings } from '../core/types'
import { createFakeContext } from '../test/fakeContext'
import { drawFrame, layoutRegions } from './drawFrame'
import { FALLBACK_THEME } from './theme'

const size = { width: 800, height: 400, pixelRatio: 2 }
const view: ViewSettings = {
  zoom: 'auto',
  pan: { x: 0, y: 0 },
  showVectors: true,
  showCircles: true,
  showTrail: true,
  showGrid: true,
  trailSeconds: DEFAULT_TRAIL_SECONDS,
  showAxes: true,
  trailFade: true,
  trailRetention: 'all',
  background: null,
  highlightedComponentId: null,
  selectedComponentId: null,
}
const fn = createDefaultFunction()
const render = (overrides: Partial<ViewSettings> = {}, source = fn, t = 5) => {
  const fake = createFakeContext()
  drawFrame(fake.ctx, source, t, { ...view, ...overrides }, size, FALLBACK_THEME)
  return fake
}

describe('layoutRegions', () => {
  test('waveform mode splits the canvas into an epicycle region and a waveform region', () => {
    const regions = layoutRegions('waveform', size)
    expect(regions.waveform).not.toBeNull()
    expect(regions.epicycles.width + (regions.waveform?.width ?? 0)).toBeLessThanOrEqual(size.width)
  })

  test('drawing2d mode gives the whole canvas to the epicycles', () => {
    const regions = layoutRegions('drawing2d', size)
    expect(regions.waveform).toBeNull()
    expect(regions.epicycles.width).toBe(size.width)
  })
})

describe('drawFrame', () => {
  test('clears the whole pixel buffer before scaling by the pixel ratio', () => {
    // CSS 尺寸可能是小数: 按 CSS 尺寸清屏会让最后一行像素只被部分覆盖, 与上一帧残留混合
    const fake = createFakeContext()
    drawFrame(fake.ctx, fn, 5, view, { width: 800.4, height: 400.6, pixelRatio: 2 }, FALLBACK_THEME)
    expect(fake.calls[0]).toMatchObject({ method: 'setTransform', args: [1, 0, 0, 1, 0, 0] })
    expect(fake.calls[1]).toMatchObject({ method: 'fillRect', args: [0, 0, 1601, 802] })
    expect(fake.calls[2]).toMatchObject({ method: 'setTransform', args: [2, 0, 0, 2, 0, 0] })
  })

  test('draws one circle per enabled component when circles are shown', () => {
    // 末端圆点半径固定为几个像素; 分量圆的半径 = 振幅 × 缩放, 远大于它
    const circles = (fake: ReturnType<typeof render>) =>
      fake.calls.filter((call) => call.method === 'arc' && Number(call.args[2]) > 8).length
    expect(circles(render())).toBe(3)
    expect(circles(render({ showCircles: false }))).toBe(0)
    const second = fn.components[1]
    if (!second) throw new Error('fixture')
    expect(circles(render({}, setComponentEnabled(fn, second.id, false)))).toBe(2)
  })

  test('each display toggle removes its drawing calls', () => {
    const strokes = (fake: ReturnType<typeof render>) => fake.count('stroke')
    const all = strokes(render())
    expect(strokes(render({ showGrid: false }))).toBeLessThan(all)
    expect(strokes(render({ showTrail: false }))).toBeLessThan(all)
    expect(strokes(render({ showVectors: false }))).toBeLessThan(all)
  })

  test('only waveform mode draws the dashed connector from the tip to the waveform', () => {
    expect(render().count('setLineDash')).toBeGreaterThan(0)
    expect(render({}, setPresentationMode(fn, 'drawing2d')).count('setLineDash')).toBe(0)
  })

  test('highlighting dims the other vectors and thickens the highlighted one', () => {
    const highlighted = fn.components[1]
    if (!highlighted) throw new Error('fixture')
    // 关闭网格/坐标轴/轨迹/圆并用二维模式后, 剩下的"两点线段"描边只有向量
    const fake = render(
      {
        highlightedComponentId: highlighted.id,
        showCircles: false,
        showGrid: false,
        showAxes: false,
        showTrail: false,
      },
      setPresentationMode(fn, 'drawing2d'),
    )
    const vectorStrokes = fake.calls.filter(
      (call, index) =>
        call.method === 'stroke' &&
        fake.calls[index - 1]?.method === 'lineTo' &&
        fake.calls[index - 2]?.method === 'moveTo',
    )
    expect(vectorStrokes).toHaveLength(3)
    expect(vectorStrokes.filter((call) => Number(call.globalAlpha) < 1)).toHaveLength(2)
    const widths = vectorStrokes.map((call) => Number(call.lineWidth))
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths))
  })

  test('does not throw with no enabled components or at t = 0', () => {
    const empty = { ...fn, components: [] }
    expect(() => render({}, empty)).not.toThrow()
    expect(() => render({}, fn, 0)).not.toThrow()
  })

  test('is deterministic: identical inputs give an identical call sequence', () => {
    expect(render().calls).toEqual(render().calls)
  })

  test('a pre-sampled trail equal to the internal sampling gives the same result', async () => {
    const { sampleTrail } = await import('../core/evaluator')
    const { DEFAULT_MAX_TRAIL_POINTS } = await import('../core/ranges')
    const trail = sampleTrail(fn, 5, view.trailSeconds, DEFAULT_MAX_TRAIL_POINTS)
    const fake = createFakeContext()
    drawFrame(fake.ctx, fn, 5, view, size, FALLBACK_THEME, trail)
    expect(fake.calls).toEqual(render().calls)
  })
})

describe('drawFrame: grid and axes are independent (feature 002)', () => {
  const axisStrokes = (overrides: Partial<ViewSettings>) =>
    render(overrides).calls.filter(
      (call) => call.method === 'stroke' && call.strokeStyle === FALLBACK_THEME.axis,
    ).length

  test('hiding the axes removes every axis-coloured line, including the waveform baseline', () => {
    expect(axisStrokes({})).toBeGreaterThanOrEqual(3)
    expect(axisStrokes({ showAxes: false })).toBe(0)
  })

  test('hiding the grid keeps the axes and the waveform baseline', () => {
    expect(axisStrokes({ showGrid: false })).toBe(axisStrokes({}))
  })

  test('hiding the grid removes the waveform time ticks', () => {
    const count = (overrides: Partial<ViewSettings>) => render(overrides).count('stroke')
    expect(count({ showGrid: false, showAxes: false })).toBeLessThan(count({ showAxes: false }))
  })
})

describe('drawFrame: retained trail (feature 002)', () => {
  const drawing = setPresentationMode(fn, 'drawing2d')
  const traceStrokes = (fake: ReturnType<typeof render>) =>
    fake.calls.filter((call) => call.method === 'stroke' && call.lineWidth === 2)

  test('with fading off, the 2D trail is drawn opaquely, starting with the normal-brightness colour', () => {
    const strokes = traceStrokes(render({ trailFade: false }, drawing, 20))
    expect(strokes.length).toBeGreaterThan(1)
    expect(strokes.every((call) => call.globalAlpha === 1)).toBe(true)
    expect(strokes[0]?.strokeStyle).toBe(FALLBACK_THEME.traceNormal)
  })

  test('with fading on, the trail still fades through transparency as before', () => {
    const strokes = traceStrokes(render({}, drawing, 20))
    expect(strokes.some((call) => Number(call.globalAlpha) < 1)).toBe(true)
  })

  test('the retained 2D trail reaches back to zero, far beyond the fading window', () => {
    const points = (overrides: Partial<ViewSettings>) => render(overrides, drawing, 4).count('lineTo')
    const longAgo = (overrides: Partial<ViewSettings>) => render(overrides, drawing, 40).count('lineTo')
    expect(points({ trailFade: false })).toBeLessThan(longAgo({ trailFade: false }))
  })

  test('the waveform keeps its window but switches to the opaque brightness rule', () => {
    const strokes = traceStrokes(render({ trailFade: false }, fn, 20))
    expect(strokes.every((call) => call.globalAlpha === 1)).toBe(true)
    expect(strokes.map((call) => call.strokeStyle)).toContain(FALLBACK_THEME.traceNormal)
  })

  test('hiding the trail hides it in either mode', () => {
    expect(traceStrokes(render({ trailFade: false, showTrail: false }, drawing, 20))).toHaveLength(0)
  })
})
