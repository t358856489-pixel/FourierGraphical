import { err, ok, type Result, type Vec2 } from '../types'

const CURVE_SEGMENTS = 16
const ARC_DEGREES_PER_SEGMENT = 5
// 点数上限由导入层按 SVG_MAX_POINTS 判断; 这里只防止极端长度拖垮解析
const MAX_TOKENS = 2_000_000
const BAD = (what: string): Result<never> => err('DATA_CORRUPT', `无法解析 SVG 路径: ${what}`)

type Token =
  | { readonly kind: 'cmd'; readonly value: string }
  | { readonly kind: 'num'; readonly value: number }

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/
const PARAM_COUNT: Readonly<Record<string, number>> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
}

const tokenize = (d: string): Result<readonly Token[]> => {
  const tokens: Token[] = []
  let rest = d.trim()
  while (rest.length > 0) {
    if (tokens.length > MAX_TOKENS) return BAD('内容过长')
    const command = /^[mlhvcsqtaz]/i.exec(rest)
    if (command) {
      tokens.push({ kind: 'cmd', value: command[0] })
      rest = rest.slice(1).trimStart()
      continue
    }
    const number = NUMBER.exec(rest)
    if (!number) return BAD(`无法识别的字符 "${rest[0] ?? ''}"`)
    const value = Number(number[0])
    if (!Number.isFinite(value)) return BAD(`数值越界 ${number[0]}`)
    tokens.push({ kind: 'num', value })
    rest = rest.slice(number[0].length).replace(/^[\s,]+/, '')
  }
  return ok(tokens)
}

/** 把 (x0,y0)→(x1,y1) 的三次贝塞尔展平 */
const cubic = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): Vec2[] =>
  Array.from({ length: CURVE_SEGMENTS }, (_, i) => {
    const t = (i + 1) / CURVE_SEGMENTS
    const u = 1 - t
    return {
      x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
      y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y,
    }
  })

const quadratic = (p0: Vec2, p1: Vec2, p2: Vec2): Vec2[] =>
  cubic(
    p0,
    { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
    { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
    p2,
  )

/** SVG 圆弧(端点参数化)→ 中心参数化后按角度展平; 半径不足时按规范放大 */
const arc = (
  from: Vec2,
  rxIn: number,
  ryIn: number,
  rotation: number,
  large: number,
  sweep: number,
  to: Vec2,
): Vec2[] => {
  if (rxIn === 0 || ryIn === 0) return [to]
  const phi = (rotation * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (from.x - to.x) / 2
  const dy = (from.y - to.y) / 2
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const sign = large === sweep ? -1 : 1
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1
  // 半径极小/极大时上述量会下溢或溢出成 NaN/Infinity; 此时退化为直线到终点, 绝不丢掉终点
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(num / den)) return [to]
  const coefficient = sign * Math.sqrt(Math.max(0, num / den))
  const cx1 = (coefficient * rx * y1) / ry
  const cy1 = (-coefficient * ry * x1) / rx
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  if (sweep && delta < 0) delta += 2 * Math.PI
  const segments = Math.max(
    1,
    Math.ceil(Math.abs(delta) / ((ARC_DEGREES_PER_SEGMENT * Math.PI) / 180)),
  )
  return Array.from({ length: segments }, (_, i) => {
    const theta = start + (delta * (i + 1)) / segments
    const ex = rx * Math.cos(theta)
    const ey = ry * Math.sin(theta)
    return { x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy }
  })
}

interface Walk {
  subpaths: Vec2[][]
  current: Vec2
  start: Vec2
  lastControl: Vec2 | null
  lastCommand: string
}

const perimeter = (pts: Vec2[]): number =>
  pts.reduce(
    (sum, p, i) =>
      sum +
      Math.hypot(
        p.x - (pts[(i + 1) % pts.length] as Vec2).x,
        p.y - (pts[(i + 1) % pts.length] as Vec2).y,
      ),
    0,
  )

const createWalker = () => {
  const walk: Walk = {
    subpaths: [],
    current: { x: 0, y: 0 },
    start: { x: 0, y: 0 },
    lastControl: null,
    lastCommand: '',
  }
  const apply = (cmd: string, args: number[]): void => {
    const lower = cmd.toLowerCase()
    const rel = cmd === lower
    const abs = (x: number, y: number): Vec2 =>
      rel ? { x: walk.current.x + x, y: walk.current.y + y } : { x, y }
    const subpath = walk.subpaths[walk.subpaths.length - 1] as Vec2[]
    const push = (points: Vec2[]) => {
      subpath.push(...points)
      walk.current = points[points.length - 1] as Vec2
    }
    const reflect = (): Vec2 =>
      walk.lastControl && /[csqt]/.test(walk.lastCommand.toLowerCase())
        ? { x: 2 * walk.current.x - walk.lastControl.x, y: 2 * walk.current.y - walk.lastControl.y }
        : walk.current
    const [a0 = 0, a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0] = args
    let control: Vec2 | null = null
    switch (lower) {
      case 'm': {
        const p = abs(a0, a1)
        walk.subpaths.push([p])
        walk.current = p
        walk.start = p
        break
      }
      case 'l':
        push([abs(a0, a1)])
        break
      case 'h':
        push([rel ? { x: walk.current.x + a0, y: walk.current.y } : { x: a0, y: walk.current.y }])
        break
      case 'v':
        push([rel ? { x: walk.current.x, y: walk.current.y + a0 } : { x: walk.current.x, y: a0 }])
        break
      case 'c': {
        const c2 = abs(a2, a3)
        push(cubic(walk.current, abs(a0, a1), c2, abs(a4, a5)))
        control = c2
        break
      }
      case 's': {
        const c2 = abs(a0, a1)
        push(cubic(walk.current, reflect(), c2, abs(a2, a3)))
        control = c2
        break
      }
      case 'q': {
        const c1 = abs(a0, a1)
        push(quadratic(walk.current, c1, abs(a2, a3)))
        control = c1
        break
      }
      case 't': {
        const c1 = reflect()
        push(quadratic(walk.current, c1, abs(a0, a1)))
        control = c1
        break
      }
      case 'a':
        push(arc(walk.current, a0, a1, a2, a3, a4, abs(a5, a6)))
        break
      case 'z':
        walk.current = walk.start
        break
      default:
        break
    }
    walk.lastControl = control
    walk.lastCommand = cmd
  }
  return { apply, walk }
}

/** 解析 SVG path 的 d 属性为折线(最长的一条子路径); 任何畸形输入都返回错误而不抛异常 (FR-016/017) */
export const parsePathData = (
  d: string,
  onPoints?: (count: number) => void,
): Result<readonly Vec2[]> => {
  const tokens = tokenize(d)
  if (!tokens.ok) return tokens
  const { apply, walk } = createWalker()
  let cmd = ''
  let i = 0
  const list = tokens.value
  if (list[0]?.kind !== 'cmd' || list[0].value.toLowerCase() !== 'm') return BAD('必须以 M 开始')
  while (i < list.length) {
    const token = list[i] as Token
    if (token.kind === 'cmd') {
      cmd = token.value
      i += 1
      if (cmd.toLowerCase() === 'z') {
        apply(cmd, [])
        continue
      }
    }
    const needed = PARAM_COUNT[cmd.toLowerCase()] ?? -1
    if (needed <= 0) return BAD(`命令 ${cmd} 后有多余的数值`)
    const args = list.slice(i, i + needed)
    if (args.length < needed || args.some((t) => t.kind !== 'num'))
      return BAD(`命令 ${cmd} 缺少参数`)
    if (
      cmd.toLowerCase() === 'a' &&
      args.some(
        (t, k) => (k === 3 || k === 4) && t.kind === 'num' && t.value !== 0 && t.value !== 1,
      )
    ) {
      return BAD('圆弧标志必须是 0 或 1')
    }
    apply(
      cmd,
      args.map((t) => (t.kind === 'num' ? t.value : 0)),
    )
    i += needed
    onPoints?.(walk.subpaths.reduce((sum, pts) => sum + pts.length, 0))
    // 隐式重复: M 之后的重复坐标按 L 处理
    if (cmd === 'M') cmd = 'L'
    if (cmd === 'm') cmd = 'l'
  }
  const longest = walk.subpaths
    .map((pts) =>
      pts.filter(
        (p, k) =>
          k === 0 || Math.hypot(p.x - (pts[k - 1] as Vec2).x, p.y - (pts[k - 1] as Vec2).y) > 1e-9,
      ),
    )
    // 至少两个不同的点才算一条路径; 是否足够闭合成形由图形层判断
    .filter((pts) => pts.length >= 2)
    .sort((a, b) => perimeter(b) - perimeter(a))[0]
  return longest ? ok(longest) : BAD('路径中没有可用的闭合形状')
}
