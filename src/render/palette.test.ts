import fc from 'fast-check'
import { contrastRatio, parseColor, relativeLuminance, toHex, type Rgb } from '../core/color'
import { MIN_LINE_CONTRAST, MIN_TEXT_CONTRAST } from '../core/ranges'
import { derivePalette } from './palette'
import { FALLBACK_THEME as base, type RenderTheme } from './theme'

const rgb = (color: string): Rgb => {
  const parsed = parseColor(color)
  if (!parsed.ok) throw new Error(`unparseable: ${color}`)
  return parsed.value
}
const lines = (theme: RenderTheme) => [
  theme.grid, theme.gridMajor, theme.axis, theme.circle, theme.vector, theme.trace, theme.traceNormal,
  ...theme.components,
]
const hue = ({ r, g, b }: Rgb) => (Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI
const hueDistance = (a: Rgb, b: Rgb) => {
  const delta = Math.abs(hue(a) - hue(b)) % 360
  return Math.min(delta, 360 - delta)
}
const expectLegible = (background: string) => {
  const theme = derivePalette(background, base)
  const bg = rgb(background)
  expect(theme.background).toBe(background)
  for (const color of lines(theme)) {
    expect(contrastRatio(rgb(color), bg)).toBeGreaterThanOrEqual(MIN_LINE_CONTRAST)
  }
  expect(contrastRatio(rgb(theme.text), bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
}

describe('derivePalette', () => {
  test('returns the base theme itself for the default background, so the default look cannot change', () => {
    expect(derivePalette(null, base)).toBe(base)
  })

  test.each(['#000000', '#ffffff', '#f3ecdc', '#777777', '#808080', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'])(
    'every line is legible on %s',
    (background) => expectLegible(background),
  )

  test('every line is legible on any background whatsoever', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffff }), (value) => {
        expectLegible(`#${value.toString(16).padStart(6, '0')}`)
      }),
      { numRuns: 300 },
    )
  })

  test('lines are darker than a light background and lighter than a dark one', () => {
    const onWhite = derivePalette('#ffffff', base)
    const onBlack = derivePalette('#000000', base)
    for (const color of [onWhite.grid, onWhite.axis, onWhite.vector, onWhite.text]) {
      expect(relativeLuminance(rgb(color))).toBeLessThan(0.5)
    }
    for (const color of [onBlack.grid, onBlack.axis, onBlack.vector, onBlack.text]) {
      expect(relativeLuminance(rgb(color))).toBeGreaterThan(0.05)
    }
  })

  test('keeps the visual hierarchy: grid fainter than major grid, fainter than axes', () => {
    for (const background of ['#ffffff', '#000000', '#336699']) {
      const theme = derivePalette(background, base)
      const contrast = (color: string) => contrastRatio(rgb(color), rgb(background))
      expect(contrast(theme.grid)).toBeLessThanOrEqual(contrast(theme.gridMajor))
      expect(contrast(theme.gridMajor)).toBeLessThanOrEqual(contrast(theme.axis))
    }
  })

  test('component colours that already stand out are left alone', () => {
    const onBlack = derivePalette('#000000', base)
    expect(onBlack.components).toEqual(base.components)
  })

  test('adjusted component colours keep their hue, so they still match the panel swatches', () => {
    const onWhite = derivePalette('#ffffff', base)
    onWhite.components.forEach((color, index) => {
      expect(hueDistance(rgb(color), rgb(base.components[index] as string))).toBeLessThan(12)
    })
  })

  test('a component colour used as the background is still distinguishable from it', () => {
    base.components.forEach((color, index) => {
      const theme = derivePalette(toHex(rgb(color)), base)
      const adjusted = theme.components[index] as string
      expect(contrastRatio(rgb(adjusted), rgb(color))).toBeGreaterThanOrEqual(MIN_LINE_CONTRAST)
    })
  })

  test('normal-brightness trace sits between the background and the trace colour', () => {
    const theme = derivePalette('#ffffff', base)
    const contrast = (color: string) => contrastRatio(rgb(color), rgb('#ffffff'))
    expect(contrast(theme.traceNormal)).toBeLessThan(contrast(theme.trace))
  })

  test('is deterministic', () => {
    expect(derivePalette('#123456', base)).toEqual(derivePalette('#123456', base))
  })
})
