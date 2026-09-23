import { mix, parseColor, toHex } from '../core/color'
import { COMPONENT_COLOR_COUNT, NORMAL_BRIGHTNESS_MIX } from '../core/ranges'

export interface RenderTheme {
  readonly background: string
  readonly grid: string
  readonly gridMajor: string
  readonly axis: string
  readonly trace: string
  /** 保留模式下旧轨迹的"正常亮度": 不透明, 由 trace 与 background 混合而来 */
  readonly traceNormal: string
  readonly vector: string
  readonly circle: string
  readonly text: string
  readonly components: readonly string[]
}

/** 正常亮度永远由轨迹色与背景色派生, 不单独定义: 换背景色时自动跟随 */
export const normalTraceOf = (trace: string, background: string): string => {
  const traceRgb = parseColor(trace)
  const backgroundRgb = parseColor(background)
  if (!traceRgb.ok || !backgroundRgb.ok) return trace
  return toHex(mix(backgroundRgb.value, traceRgb.value, NORMAL_BRIGHTNESS_MIX))
}

export const FALLBACK_THEME: RenderTheme = {
  background: '#0f1a16',
  grid: '#2a3b34',
  gridMajor: '#3d544b',
  axis: '#6b8579',
  trace: '#9cf58a',
  traceNormal: normalTraceOf('#9cf58a', '#0f1a16'),
  vector: '#e2ece7',
  circle: '#93a89f',
  text: '#c3d4cc',
  components: [
    '#7fe08a', '#f0a860', '#6fb0f5', '#f582b8', '#e2d85c', '#5cc8d4',
    '#f5705e', '#c08af5', '#6fe0bd', '#e6bd6a', '#7cb6e8', '#f08ad0',
  ],
}

const readToken = (style: CSSStyleDeclaration, name: string, fallback: string): string => {
  const value = style.getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

/** 从 CSS 设计令牌解析画布颜色; 令牌缺失(如测试环境)时退回 FALLBACK_THEME */
export const readRenderTheme = (root: HTMLElement): RenderTheme => {
  const style = getComputedStyle(root)
  const background = readToken(style, '--screen-bg', FALLBACK_THEME.background)
  const trace = readToken(style, '--screen-trace', FALLBACK_THEME.trace)
  return {
    background,
    grid: readToken(style, '--screen-grid', FALLBACK_THEME.grid),
    gridMajor: readToken(style, '--screen-grid-major', FALLBACK_THEME.gridMajor),
    axis: readToken(style, '--screen-axis', FALLBACK_THEME.axis),
    trace,
    traceNormal: normalTraceOf(trace, background),
    vector: readToken(style, '--screen-vector', FALLBACK_THEME.vector),
    circle: readToken(style, '--screen-circle', FALLBACK_THEME.circle),
    text: readToken(style, '--screen-text', FALLBACK_THEME.text),
    components: Array.from({ length: COMPONENT_COLOR_COUNT }, (_, index) =>
      readToken(style, `--component-c${index}`, FALLBACK_THEME.components[index] as string),
    ),
  }
}

export const componentColor = (theme: RenderTheme, color: string): string => {
  const index = Number(color.slice(1))
  return theme.components[index % theme.components.length] ?? theme.vector
}
