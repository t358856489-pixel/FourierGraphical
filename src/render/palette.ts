import { contrastRatio, mix, parseColor, relativeLuminance, toHex, type Rgb } from '../core/color'
import { MIN_LINE_CONTRAST, MIN_TEXT_CONTRAST, NORMAL_BRIGHTNESS_MIX } from '../core/ranges'
import type { RenderTheme } from './theme'

const BLACK: Rgb = { r: 0, g: 0, b: 0 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }
/** 相对亮度高于它时黑色前景的对比度更高, 否则白色更高; 两者在此处相等(约 4.58:1) */
const INK_LUMINANCE_THRESHOLD = 0.179
const SCAN_STEPS = 64

/** 各类线条希望达到的对比度: 保持"网格 < 主网格 < 坐标轴 < 向量"的层次, 全部不低于 3:1 */
const TARGETS = {
  grid: MIN_LINE_CONTRAST,
  gridMajor: 3.6,
  circle: 3.6,
  axis: MIN_TEXT_CONTRAST,
  trace: MIN_TEXT_CONTRAST,
  vector: 7,
  text: 7,
} as const

const rounded = ({ r, g, b }: Rgb): Rgb => ({ r: Math.round(r), g: Math.round(g), b: Math.round(b) })

const rgbOf = (color: string, fallback: Rgb): Rgb => {
  const parsed = parseColor(color)
  return parsed.ok ? parsed.value : fallback
}

/**
 * 把 color 向 target 逐步混合, 返回第一个达到对比度要求的颜色; 达不到就返回 target 本身.
 * 用线性扫描而非二分: 起点可能在背景的"另一侧", 对比度沿途先降后升, 并不单调.
 * 黑或白相对任何背景至少有一个 ≥ 4.58:1, 所以以墨色为目标时 3:1 与 4.5:1 总能达到.
 */
const reach = (color: Rgb, target: Rgb, background: Rgb, wanted: number): Rgb => {
  for (let step = 0; step <= SCAN_STEPS; step++) {
    // 对最终会输出的(取整后的)颜色做判断: 浮点值达标不代表取整成 #rrggbb 后仍达标
    const candidate = rounded(mix(color, target, step / SCAN_STEPS))
    if (contrastRatio(candidate, background) >= wanted) return candidate
  }
  return target
}

const deriveComponents = (base: RenderTheme, background: Rgb, ink: Rgb): readonly string[] =>
  base.components.map((color) => {
    const original = rgbOf(color, ink)
    // 已经够醒目的原样保留; 其余只沿墨色方向调明暗, 色相不变, 与面板色标仍对得上 (FR-019)
    if (contrastRatio(original, background) >= MIN_LINE_CONTRAST) return color
    return toHex(reach(original, ink, background, MIN_LINE_CONTRAST))
  })

/**
 * 由背景色派生整套画布配色 (research R6). 纯函数: 同一背景总得到同一套配色.
 * 默认背景(null)原样返回 base —— 这是"默认画面逐像素不变"的保证.
 */
export const derivePalette = (background: string | null, base: RenderTheme): RenderTheme => {
  if (background === null) return base
  const bg = rgbOf(background, BLACK)
  const ink = relativeLuminance(bg) > INK_LUMINANCE_THRESHOLD ? BLACK : WHITE
  const fromBackground = (wanted: number) => toHex(reach(bg, ink, bg, wanted))

  const trace = reach(rgbOf(base.trace, ink), ink, bg, TARGETS.trace)
  const traceNormal = reach(mix(bg, trace, NORMAL_BRIGHTNESS_MIX), trace, bg, MIN_LINE_CONTRAST)

  return {
    background,
    grid: fromBackground(TARGETS.grid),
    gridMajor: fromBackground(TARGETS.gridMajor),
    axis: fromBackground(TARGETS.axis),
    circle: fromBackground(TARGETS.circle),
    vector: fromBackground(TARGETS.vector),
    text: fromBackground(TARGETS.text),
    trace: toHex(trace),
    traceNormal: toHex(traceNormal),
    components: deriveComponents(base, bg, ink),
  }
}
