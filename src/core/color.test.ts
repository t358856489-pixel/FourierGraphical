import { contrastRatio, mix, parseColor, parseUserColor, relativeLuminance, toHex } from './color'

describe('parseUserColor', () => {
  test.each([
    ['#FFF', '#ffffff'],
    ['  #Aa00Ff ', '#aa00ff'],
    ['#0f1a16', '#0f1a16'],
  ])('normalises %j to %s', (input, expected) => {
    const result = parseUserColor(input)
    expect(result.ok && result.value).toBe(expected)
  })

  test.each(['red', '#12', '#gggggg', 'rgb(0,0,0)', '', '#12345', '#1234567'])(
    'rejects %j and explains the accepted format',
    (input) => {
      const result = parseUserColor(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.message).toContain('#RRGGBB')
    },
  )
})

describe('mix and toHex', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }

  test('mix returns the endpoints at 0 and 1 and the midpoint at 0.5', () => {
    expect(mix(black, white, 0)).toEqual(black)
    expect(mix(black, white, 1)).toEqual(white)
    expect(toHex(mix(black, white, 0.5))).toBe('#808080')
  })

  test('toHex pads and rounds each channel', () => {
    expect(toHex({ r: 0, g: 15.6, b: 255 })).toBe('#0010ff')
  })
})

describe('parseColor, luminance and contrast', () => {
  test('parses short and long hex', () => {
    expect(parseColor('#fff')).toEqual({ ok: true, value: { r: 255, g: 255, b: 255 } })
    expect(parseColor('#0F1A16')).toEqual({ ok: true, value: { r: 15, g: 26, b: 22 } })
  })

  test('parses oklch design tokens', () => {
    const white = parseColor('oklch(100% 0 0)')
    const black = parseColor('oklch(0% 0 0)')
    expect(white.ok && toHex(white.value)).toBe('#ffffff')
    expect(black.ok && toHex(black.value)).toBe('#000000')
    // oklch(62.8% 0.2577 29.23) 是 sRGB 纯红的 OKLCH 坐标
    const red = parseColor('oklch(62.8% 0.2577 29.23)')
    if (!red.ok) throw new Error('expected ok')
    expect(red.value.r).toBeGreaterThan(250)
    expect(red.value.g).toBeLessThan(8)
    expect(red.value.b).toBeLessThan(8)
  })

  // FALLBACK_THEME 的十六进制是人工估的近似值, 这里只是防止数量级错误; 与浏览器的精确比对在端到端测试里
  test('lands near the hand-picked fallback theme colour', () => {
    const screen = parseColor('oklch(17% 0.025 165)')
    if (!screen.ok) throw new Error('expected ok')
    expect(Math.abs(screen.value.r - 0x0f)).toBeLessThanOrEqual(12)
    expect(Math.abs(screen.value.g - 0x1a)).toBeLessThanOrEqual(12)
    expect(Math.abs(screen.value.b - 0x16)).toBeLessThanOrEqual(12)
  })

  test.each(['', 'red', 'oklch(a b c)', 'color-mix(in oklch, red, blue)'])('rejects %j', (text) => {
    expect(parseColor(text).ok).toBe(false)
  })

  test('relative luminance and contrast follow WCAG', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }
    expect(relativeLuminance(black)).toBe(0)
    expect(relativeLuminance(white)).toBeCloseTo(1, 10)
    expect(contrastRatio(black, white)).toBeCloseTo(21, 10)
    expect(contrastRatio(white, black)).toBeCloseTo(21, 10)
    expect(contrastRatio(white, white)).toBe(1)
  })
})
