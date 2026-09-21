import { createViewport, type Region } from './viewport'

const region: Region = { x: 0, y: 0, width: 400, height: 200 }
const auto = { zoom: 'auto' as const, pan: { x: 0, y: 0 } }

describe('createViewport', () => {
  test('auto zoom fits the bounding radius with a 10% margin in the smaller dimension', () => {
    const viewport = createViewport(auto, 5, region)
    expect(viewport.scale).toBeCloseTo(100 / (5 * 1.1), 10)
  })

  test('maps the world origin to the region centre and flips the y axis', () => {
    const viewport = createViewport(auto, 1, { x: 50, y: 20, width: 400, height: 200 })
    expect(viewport.toScreen({ x: 0, y: 0 })).toEqual({ x: 250, y: 120 })
    expect(viewport.toScreen({ x: 0, y: 1 }).y).toBeLessThan(120)
  })

  test('toWorld is the inverse of toScreen', () => {
    const viewport = createViewport({ zoom: 2, pan: { x: 0.3, y: -0.7 } }, 3, region)
    const world = { x: 1.25, y: -2.5 }
    const roundTrip = viewport.toWorld(viewport.toScreen(world))
    expect(roundTrip.x).toBeCloseTo(world.x, 10)
    expect(roundTrip.y).toBeCloseTo(world.y, 10)
  })

  test('falls back to a unit radius when the bounding radius is zero', () => {
    const viewport = createViewport(auto, 0, region)
    expect(Number.isFinite(viewport.scale)).toBe(true)
    expect(viewport.scale).toBeCloseTo(100 / 1.1, 10)
  })

  test('manual zoom multiplies the auto scale and is clamped to the allowed range', () => {
    const base = createViewport(auto, 1, region).scale
    expect(createViewport({ zoom: 2, pan: { x: 0, y: 0 } }, 1, region).scale).toBeCloseTo(base * 2, 10)
    expect(createViewport({ zoom: 999, pan: { x: 0, y: 0 } }, 1, region).scale).toBeCloseTo(base * 20, 10)
    expect(createViewport({ zoom: 0.0001, pan: { x: 0, y: 0 } }, 1, region).scale).toBeCloseTo(base * 0.1, 10)
  })

  test('pan shifts the world point shown at the centre', () => {
    const viewport = createViewport({ zoom: 1, pan: { x: 2, y: 0 } }, 1, region)
    expect(viewport.toScreen({ x: 2, y: 0 })).toEqual({ x: 200, y: 100 })
  })
})
