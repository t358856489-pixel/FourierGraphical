import { createComponent } from '../function'
import {
  PRESET_BASE_FREQUENCY,
  SHAPE_MAX_HARMONIC,
  SHAPE_MIN_AMPLITUDE,
  SHAPE_TARGET_EXTENT,
} from '../ranges'
import type { HarmonicComponent, ShapePath, ShapeSpectrum, SpectrumTerm, Vec2 } from '../types'

const TAU = Math.PI * 2
const PHASE_QUANTUM = 0.1

const segmentLengths = (path: ShapePath): number[] =>
  path.map((p, i) => {
    const q = path[(i + 1) % path.length] as Vec2
    return Math.hypot(q.x - p.x, q.y - p.y)
  })

/** 沿闭合路径按弧长均匀取 n 点, 第一个点即原路径的起点 */
export const resample = (path: ShapePath, n: number): ShapePath => {
  const lengths = segmentLengths(path)
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (total === 0) return Array.from({ length: n }, () => path[0] as Vec2)
  const out: Vec2[] = []
  let segment = 0
  let covered = 0
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n
    while (segment < lengths.length - 1 && covered + (lengths[segment] as number) <= target) {
      covered += lengths[segment] as number
      segment += 1
    }
    const a = path[segment] as Vec2
    const b = path[(segment + 1) % path.length] as Vec2
    const u =
      (lengths[segment] as number) === 0 ? 0 : (target - covered) / (lengths[segment] as number)
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
  }
  return out
}

/** 重心移到原点, 包围盒长边缩放到目标尺寸. 不翻转 y: 输入已是世界坐标 */
export const normalize = (path: ShapePath): ShapePath => {
  const mean = path.reduce(
    (acc, p) => ({ x: acc.x + p.x / path.length, y: acc.y + p.y / path.length }),
    { x: 0, y: 0 },
  )
  const xs = path.map((p) => p.x)
  const ys = path.map((p) => p.y)
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const scale = extent === 0 ? 1 : SHAPE_TARGET_EXTENT / extent
  return path.map((p) => ({ x: (p.x - mean.x) * scale, y: (p.y - mean.y) * scale }))
}

/**
 * 离散傅立叶变换: c_n = (1/N)·Σ z_k·e^(−2πi·nk/N). 只保留 |n| ≤ SHAPE_MAX_HARMONIC 的项,
 * 否则频率会超出允许范围; n = 0 是重心, 归一化时已去掉, 不作为分量.
 */
export const analyze = (path: ShapePath): ShapeSpectrum => {
  const N = path.length
  const lowest = Math.max(-SHAPE_MAX_HARMONIC, -Math.floor(N / 2))
  const highest = Math.min(SHAPE_MAX_HARMONIC, Math.ceil(N / 2) - 1)
  const terms: SpectrumTerm[] = []
  for (let n = lowest; n <= highest; n++) {
    if (n === 0) continue
    let re = 0
    let im = 0
    for (let k = 0; k < N; k++) {
      const angle = (-TAU * n * k) / N
      const p = path[k] as Vec2
      re += p.x * Math.cos(angle) - p.y * Math.sin(angle)
      im += p.x * Math.sin(angle) + p.y * Math.cos(angle)
    }
    terms.push({
      n,
      amplitude: Math.hypot(re, im) / N,
      phaseDeg: (Math.atan2(im, re) * 180) / Math.PI,
    })
  }
  terms.sort((a, b) => b.amplitude - a.amplitude || Math.abs(a.n) - Math.abs(b.n))
  return { terms, sampleCount: N }
}

/** 用前 count 项重建 samples 个点(与 resample 的采样时刻一致) */
export const reconstruct = (spectrum: ShapeSpectrum, count: number, samples: number): ShapePath => {
  const used = spectrum.terms.slice(0, count)
  return Array.from({ length: samples }, (_, k) => {
    const t = k / samples
    let x = 0
    let y = 0
    for (const term of used) {
      const angle = (term.phaseDeg * Math.PI) / 180 + TAU * term.n * t
      x += term.amplitude * Math.cos(angle)
      y += term.amplitude * Math.sin(angle)
    }
    return { x, y }
  })
}

const quantize = (value: number, quantum: number): number => Math.round(value / quantum) * quantum

/** 前 count 项 → 分量: 频率 n·f₀, 相位(度)与振幅量化到输入精度, 丢弃过小的项 */
export const toComponents = (
  spectrum: ShapeSpectrum,
  count: number,
  idFactory: () => string = () => crypto.randomUUID(),
): readonly HarmonicComponent[] =>
  spectrum.terms
    .slice(0, count)
    // 先量化再筛选: 量化到 0 的项不能留下
    .map((term) => ({ ...term, amplitude: quantize(term.amplitude, SHAPE_MIN_AMPLITUDE) }))
    .filter((term) => term.amplitude >= SHAPE_MIN_AMPLITUDE)
    .map((term, index) =>
      createComponent(
        idFactory(),
        term.amplitude,
        quantize(term.n * PRESET_BASE_FREQUENCY, 0.001),
        quantize(term.phaseDeg, PHASE_QUANTUM),
        index,
      ),
    )
