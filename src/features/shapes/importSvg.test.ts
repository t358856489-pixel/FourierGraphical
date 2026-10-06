import { readFileSync } from 'node:fs'
import { SVG_MAX_BYTES, SVG_MAX_POINTS } from '../../core/ranges'
import type { Vec2 } from '../../core/types'
import { importSvg } from './importSvg'

const fixture = (name: string) => readFileSync(`tests/fixtures/svg/${name}`, 'utf8')
const unwrap = async (text: string) => {
  const result = await importSvg(text)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const close = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6

describe('importSvg', () => {
  test('reads a single path and flips SVG y into world y', async () => {
    const { path, pathCount, warnings } = await unwrap(fixture('single-path.svg'))
    expect(pathCount).toBe(1)
    expect(warnings).toEqual([])
    expect(path.length).toBeGreaterThan(20)
    // SVG 里 M 50 100 ... 顶部的 C 曲线 y 更小(屏幕上更高); 翻转后它的 y 应更大
    const first = path[0] as Vec2
    expect(first).toEqual({ x: 50, y: -100 })
    expect(Math.max(...path.map((p) => p.y))).toBeGreaterThan(first.y)
  })

  test('with several paths uses the longest and says so', async () => {
    const { path, pathCount, warnings } = await unwrap(fixture('multi-path.svg'))
    expect(pathCount).toBe(3)
    expect(warnings.join(' ')).toContain('最长')
    expect(path.some((p) => close(p, { x: 180, y: -180 }))).toBe(true)
  })

  test('converts basic shapes and applies ancestor transforms', async () => {
    const { path, pathCount } = await unwrap(fixture('shapes.svg'))
    expect(pathCount).toBe(3)
    // polygon 0,0 40,0 40,40 0,40 经 translate(10 20) scale(2) → (10,20)…(90,100), 周长 320, 是最长的一条
    expect(path.some((p) => close(p, { x: 10, y: -20 }))).toBe(true)
    expect(path.some((p) => close(p, { x: 90, y: -100 }))).toBe(true)
  })

  test.each([
    ['no-path.svg', 'NOT_FOUND'],
    ['not-svg.txt', 'IMPORT_UNSUPPORTED'],
    ['malformed-d.svg', 'DATA_CORRUPT'],
  ])('%s → %s', async (name, code) => {
    const result = await importSvg(fixture(name))
    expect(result.ok === false && result.error.code).toBe(code)
  })

  test('rejects oversized input before parsing', async () => {
    const huge = `<svg xmlns="http://www.w3.org/2000/svg">${'<!-- x -->'.repeat(SVG_MAX_BYTES / 8)}</svg>`
    const result = await importSvg(huge)
    expect(result.ok === false && result.error.code).toBe('IMPORT_UNSUPPORTED')
  })

  test('rejects a path that flattens to too many points', async () => {
    const d = `M 0 0 ${'L 1 1 L 0 0 '.repeat(SVG_MAX_POINTS / 2 + 10)}`
    const result = await importSvg(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`)
    expect(result.ok === false && result.error.code).toBe('IMPORT_UNSUPPORTED')
  })

  test('a file with scripts, handlers and remote images is parsed without running or fetching anything', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const imageSpy = vi.spyOn(globalThis, 'Image')
    const result = await importSvg(fixture('with-script.svg'))
    expect(result.ok).toBe(true)
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(imageSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    imageSpy.mockRestore()
  })

  test('reports progress for large inputs', async () => {
    // 单条 10 万点的路径(恰在上限内): 进度至少报告 10 次、单调, 3 秒内完成
    const d = `M 0 0 ${Array.from({ length: 99_000 }, (_, i) => `L ${i} ${(i * 7) % 13}`).join(' ')} Z`
    const progress: number[] = []
    const started = performance.now()
    const result = await importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`,
      (fraction) => progress.push(fraction),
    )
    expect(performance.now() - started).toBeLessThan(3000)
    expect(result.ok).toBe(true)
    expect(progress.length).toBeGreaterThanOrEqual(10)
    expect(progress.every((value, i) => i === 0 || value >= (progress[i - 1] ?? 0))).toBe(true)
    expect(progress.at(-1)).toBe(1)
  })
})
