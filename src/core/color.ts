import { err, ok, type Result } from './types'

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/
const LONG_HEX = /^#[0-9a-f]{6}$/

/** 用户输入的颜色: 只接受十六进制, 规范化为小写的 #rrggbb (FR-014, FR-020) */
export const parseUserColor = (text: string): Result<string> => {
  const value = text.trim().toLowerCase()
  if (LONG_HEX.test(value)) return ok(value)
  const short = SHORT_HEX.exec(value)
  if (short) return ok(`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`)
  return err('OUT_OF_RANGE', '请输入十六进制颜色, 格式为 #RRGGBB 或 #RGB')
}

const clampChannel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)))

export const toHex = (rgb: Rgb): string =>
  `#${[rgb.r, rgb.g, rgb.b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`

/** ratio = 0 → a, 1 → b */
export const mix = (a: Rgb, b: Rgb, ratio: number): Rgb => ({
  r: a.r + (b.r - a.r) * ratio,
  g: a.g + (b.g - a.g) * ratio,
  b: a.b + (b.b - a.b) * ratio,
})

const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/

const linearToSrgb = (value: number): number => {
  const clamped = Math.min(1, Math.max(0, value))
  return 255 * (clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055)
}

/** OKLCH → sRGB (Björn Ottosson 的 OKLab 矩阵), 超出色域的通道按边界裁剪 */
const oklchToRgb = (lightness: number, chroma: number, hueDegrees: number): Rgb => {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: Math.round(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: Math.round(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: Math.round(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  }
}

/** 解析十六进制或设计令牌使用的 oklch(L% C H); 无 DOM 依赖, 因而可做性质测试 */
export const parseColor = (text: string): Result<Rgb> => {
  const hex = parseUserColor(text)
  if (hex.ok) {
    const value = Number.parseInt(hex.value.slice(1), 16)
    return ok({ r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 })
  }
  const match = OKLCH.exec(text.trim().toLowerCase())
  if (!match) return err('OUT_OF_RANGE', `无法解析颜色: ${text}`)
  return ok(oklchToRgb(Number(match[1]) / 100, Number(match[2]), Number(match[3])))
}

const channelLuminance = (channel: number): number => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x 相对亮度 */
export const relativeLuminance = (rgb: Rgb): number =>
  0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b)

export const contrastRatio = (a: Rgb, b: Rgb): number => {
  const [darker, lighter] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => x - y) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}
