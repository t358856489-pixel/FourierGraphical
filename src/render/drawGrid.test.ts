import { createFakeContext } from '../test/fakeContext'
import { drawGrid } from './drawGrid'
import { FALLBACK_THEME as theme } from './theme'
import { createViewport, type Region } from './viewport'

const region: Region = { x: 0, y: 0, width: 400, height: 400 }
const viewport = createViewport({ zoom: 'auto', pan: { x: 0, y: 0 } }, 2, region)

const strokes = (options: { grid: boolean; axes: boolean; verticals?: boolean }) => {
  const fake = createFakeContext()
  drawGrid(fake.ctx, region, viewport, theme, { verticals: true, ...options })
  return fake.calls.filter((call) => call.method === 'stroke').map((call) => call.strokeStyle)
}

describe('drawGrid', () => {
  test('with both on, draws grid lines plus exactly two axis-coloured lines', () => {
    const colors = strokes({ grid: true, axes: true })
    expect(colors.filter((color) => color === theme.axis)).toHaveLength(2)
    expect(colors.filter((color) => color === theme.grid).length).toBeGreaterThan(4)
  })

  test('axes off: the zero lines stay as ordinary major grid lines, leaving no gap (FR-012)', () => {
    const both = strokes({ grid: true, axes: true })
    const gridOnly = strokes({ grid: true, axes: false })
    expect(gridOnly).toHaveLength(both.length)
    expect(gridOnly).not.toContain(theme.axis)
    expect(gridOnly.filter((color) => color === theme.gridMajor).length).toBe(
      both.filter((color) => color === theme.gridMajor).length + 2,
    )
  })

  test('grid off: only the two axes remain', () => {
    expect(strokes({ grid: false, axes: true })).toEqual([theme.axis, theme.axis])
  })

  test('both off: nothing is drawn', () => {
    expect(strokes({ grid: false, axes: false })).toEqual([])
  })

  test('without verticals only horizontal lines are drawn', () => {
    expect(strokes({ grid: false, axes: true, verticals: false })).toEqual([theme.axis])
  })
})
