import { SVG_MAX_BYTES, SVG_MAX_POINTS, SVG_YIELD_EVERY } from '../../core/ranges'
import { parsePathData } from '../../core/shape/pathData'
import { err, ok, type Result, type ShapePath, type Vec2 } from '../../core/types'

export interface ImportedShape {
  readonly path: ShapePath
  readonly pathCount: number
  readonly warnings: readonly string[]
}
export type ImportResult = Result<ImportedShape>
type Matrix = readonly [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
const SHAPE_TAGS = ['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line']
const ELLIPSE_SEGMENTS = 72

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const applyMatrix = (m: Matrix, p: Vec2): Vec2 => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
})

/** 解析 transform 属性: translate / scale / rotate / matrix; skew 忽略并告警 */
const parseTransform = (text: string | null, warnings: string[]): Matrix => {
  if (!text) return IDENTITY
  let result: Matrix = IDENTITY
  for (const match of text.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const name = match[1] ?? ''
    const a = (match[2] ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (a.some((v) => !Number.isFinite(v))) continue
    const [a0 = 0, a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0] = a
    let m: Matrix | null = null
    if (name === 'translate') m = [1, 0, 0, 1, a0, a.length > 1 ? a1 : 0]
    else if (name === 'scale') m = [a0, 0, 0, a.length > 1 ? a1 : a0, 0, 0]
    else if (name === 'rotate') {
      const r = (a0 * Math.PI) / 180
      const rot: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]
      m = a.length > 2 ? multiply(multiply([1, 0, 0, 1, a1, a2], rot), [1, 0, 0, 1, -a1, -a2]) : rot
    } else if (name === 'matrix' && a.length === 6) m = [a0, a1, a2, a3, a4, a5]
    else if (name === 'skewX' || name === 'skewY') warnings.push('已忽略不支持的 skew 变换')
    if (m) result = multiply(result, m)
  }
  return result
}

const ancestorsTransform = (element: Element, warnings: string[]): Matrix => {
  const chain: Element[] = []
  for (
    let node: Element | null = element;
    node && node.tagName.toLowerCase() !== 'svg';
    node = node.parentElement
  )
    chain.unshift(node)
  return chain.reduce<Matrix>(
    (m, node) => multiply(m, parseTransform(node.getAttribute('transform'), warnings)),
    IDENTITY,
  )
}

const numberAttr = (element: Element, name: string, fallback = 0): number => {
  const value = Number.parseFloat(element.getAttribute(name) ?? '')
  return Number.isFinite(value) ? value : fallback
}

const ellipsePoints = (cx: number, cy: number, rx: number, ry: number): Vec2[] =>
  Array.from({ length: ELLIPSE_SEGMENTS }, (_, i) => {
    const a = (2 * Math.PI * i) / ELLIPSE_SEGMENTS
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
  })

const pointsAttr = (element: Element): Vec2[] => {
  const numbers = (element.getAttribute('points') ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  const pts: Vec2[] = []
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = numbers[i] as number
    const y = numbers[i + 1] as number
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
  }
  return pts
}

/** 把一个图形元素转成折线(元素自身坐标系); 解析失败返回错误 */
const elementToPoints = (element: Element, onPoints?: (count: number) => void): Result<Vec2[]> => {
  switch (element.tagName.toLowerCase()) {
    case 'path': {
      const parsed = parsePathData(element.getAttribute('d') ?? '', onPoints)
      return parsed.ok ? ok([...parsed.value]) : parsed
    }
    case 'polygon':
    case 'polyline':
      return ok(pointsAttr(element))
    case 'rect': {
      const x = numberAttr(element, 'x')
      const y = numberAttr(element, 'y')
      const w = numberAttr(element, 'width')
      const h = numberAttr(element, 'height')
      return ok([
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ])
    }
    case 'circle':
      return ok(
        ellipsePoints(
          numberAttr(element, 'cx'),
          numberAttr(element, 'cy'),
          numberAttr(element, 'r'),
          numberAttr(element, 'r'),
        ),
      )
    case 'ellipse':
      return ok(
        ellipsePoints(
          numberAttr(element, 'cx'),
          numberAttr(element, 'cy'),
          numberAttr(element, 'rx'),
          numberAttr(element, 'ry'),
        ),
      )
    case 'line':
      return ok([
        { x: numberAttr(element, 'x1'), y: numberAttr(element, 'y1') },
        { x: numberAttr(element, 'x2'), y: numberAttr(element, 'y2') },
      ])
    default:
      return ok([])
  }
}

const perimeter = (pts: readonly Vec2[]): number =>
  pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length] as Vec2
    return sum + Math.hypot(q.x - p.x, q.y - p.y)
  }, 0)

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * 在独立文档里解析 SVG (FR-015–018): DOMParser 不执行脚本、不触发事件处理器、不加载外部资源.
 * 只读取图形元素; 取周长最长的一条; SVG 的 y 向下, 输出翻转为世界坐标(y 向上).
 */
export const importSvg = async (
  text: string,
  onProgress?: (fraction: number) => void,
): Promise<ImportResult> => {
  if (text.length > SVG_MAX_BYTES) return err('IMPORT_UNSUPPORTED', 'SVG 文件超过 2 MB, 无法导入')
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.tagName.toLowerCase() !== 'svg') {
    return err('IMPORT_UNSUPPORTED', '这不是一个可读取的 SVG 文件')
  }
  const elements = Array.from(doc.querySelectorAll(SHAPE_TAGS.join(',')))
  if (elements.length === 0) return err('NOT_FOUND', 'SVG 中没有找到任何路径或图形')

  const warnings: string[] = []
  const candidates: Vec2[][] = []
  let processed = 0
  let hadError: Result<never> | null = null
  // 单条路径的解析是同步的: 每累计 SVG_YIELD_EVERY 个点就报告一次进度, 元素之间再让出事件循环
  let reported = 0
  const reportPoints = (count: number) => {
    const total = processed + count
    if (total - reported < SVG_YIELD_EVERY) return
    reported = total
    onProgress?.(Math.min(0.99, total / SVG_MAX_POINTS))
  }
  for (const element of elements) {
    const points = elementToPoints(element, reportPoints)
    if (!points.ok) {
      hadError = points
      continue
    }
    const matrix = ancestorsTransform(element, warnings)
    const transformed = points.value.map((p) => applyMatrix(matrix, p))
    processed += transformed.length
    if (processed > SVG_MAX_POINTS)
      return err('IMPORT_UNSUPPORTED', 'SVG 路径过于复杂(超过 10 万个点), 无法导入')
    if (transformed.length >= 3) candidates.push(transformed)
    onProgress?.(Math.min(0.99, processed / SVG_MAX_POINTS))
    await yieldToEventLoop()
  }
  if (candidates.length === 0) return hadError ?? err('NOT_FOUND', 'SVG 中没有可用的闭合路径')
  const longest = candidates.reduce((best, pts) => (perimeter(pts) > perimeter(best) ? pts : best))
  if (elements.length > 1) warnings.push(`文件含 ${elements.length} 条路径, 已使用其中最长的一条`)
  onProgress?.(1)
  return ok({
    path: longest.map((p) => ({ x: p.x, y: -p.y })),
    pathCount: elements.length,
    warnings,
  })
}
