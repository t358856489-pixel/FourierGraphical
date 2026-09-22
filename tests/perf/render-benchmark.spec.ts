import { expect, test, type Page } from '@playwright/test'
import { applyPreset, createDefaultFunction, updateTrack } from '../../src/core/function'
import { MAX_COMPONENTS } from '../../src/core/ranges'
import type { Draft } from '../../src/core/schema'
import { animated, type FourierFunction } from '../../src/core/types'
import { INITIAL_VIEW } from '../../src/state/viewStore'

/**
 * 性能基准 (SC-002 / SC-003, 章程原则 V): 50 个分量 + 10 条关键帧轨道.
 * 帧率取决于运行机器, 所以断言只用作回归护栏(宽松阈值), 实测数字打印出来供记录.
 */
const ANIMATED_TRACKS = 10
const MEASURE_MS = 5000
const FRAME_BUDGET_60 = 1000 / 60
// 帧间隔被垂直同步量化为 16.7ms 的整数倍(59.94Hz 下两帧是 33.4ms), 所以"不低于 30 fps"的判据是"不超过两帧"
const TWO_FRAMES_MS = 34

const heavyFunction = (): FourierFunction => {
  const preset = applyPreset(createDefaultFunction(), 'sawtooth', MAX_COMPONENTS)
  if (!preset.ok) throw new Error(preset.error.message)
  return preset.value.components.slice(0, ANIMATED_TRACKS).reduce((fn, component, index) => {
    const base = component.amplitude.kind === 'constant' ? component.amplitude.value : 0
    const keyframes = Array.from({ length: 6 }, (_, k) => ({
      time: k * 2,
      value: base * (k % 2 === 0 ? 1 : 0.3),
      easing: (['linear', 'smooth', 'hold'] as const)[(k + index) % 3] ?? 'linear',
    }))
    return updateTrack(fn, component.id, 'amplitude', animated(keyframes))
  }, preset.value)
}

const loadDraft = async (
  page: Page,
  fn: FourierFunction,
  view: Draft['view'] = INITIAL_VIEW,
  time = 0,
) => {
  const draft: Draft = {
    function: fn,
    playback: { time, speed: 1, loop: null },
    view,
    savedFunctionId: null,
    isDirty: true,
  }
  await page.goto('/')
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('fourier-graphical')
        request.onupgradeneeded = () => request.result.createObjectStore('keyval')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put(value, 'draft')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
    draft,
  )
  await page.reload()
  await expect(page.locator('.component-row')).toHaveCount(MAX_COMPONENTS)
}

interface FrameStats {
  readonly frames: number
  readonly meanMs: number
  readonly p95Ms: number
  readonly worstMs: number
  readonly over33ms: number
}

/** 采样 rAF 间隔; onFrame 在页面内每帧执行, 用来制造负载(例如每帧改一次参数) */
const measureFrames = (page: Page, durationMs: number, stressSlider: boolean): Promise<FrameStats> =>
  page.evaluate(
    ({ duration, stress }) =>
      new Promise<FrameStats>((resolve) => {
        const slider = document.querySelector<HTMLInputElement>('input[aria-label="分量 50 相位"]')
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        const intervals: number[] = []
        const started = performance.now()
        let previous = started
        let tick = 0
        const frame = (now: number) => {
          intervals.push(now - previous)
          previous = now
          if (stress && slider && setValue) {
            // 走 React 的受控输入路径: 每帧一次真实的参数编辑 → 文档变更 → 轨迹整体重算
            setValue.call(slider, String((tick++ % 360) - 180))
            slider.dispatchEvent(new Event('input', { bubbles: true }))
          }
          if (now - started < duration) return requestAnimationFrame(frame)
          const sorted = intervals.slice(1).sort((a, b) => a - b)
          resolve({
            frames: sorted.length,
            meanMs: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
            p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            worstMs: sorted.at(-1) ?? 0,
            over33ms: sorted.filter((value) => value > 33.4).length,
          })
        }
        requestAnimationFrame(frame)
      }),
    { duration: durationMs, stress: stressSlider },
  )

const report = (label: string, stats: FrameStats) =>
  // eslint-disable-next-line no-console -- 基准的产出就是这些数字
  console.log(
    `[perf] ${label}: ${(1000 / stats.meanMs).toFixed(1)} fps mean, p95 ${stats.p95Ms.toFixed(1)} ms, ` +
      `worst ${stats.worstMs.toFixed(1)} ms, ${stats.over33ms}/${stats.frames} frames over 33 ms`,
  )

test.describe('render benchmark: 50 components, 10 keyframed tracks', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium desktop only (uses CDP)')
  test.describe.configure({ mode: 'serial' })

  test('steady playback holds the 60 fps frame budget', async ({ page }) => {
    await loadDraft(page, heavyFunction())
    await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible()
    const stats = await measureFrames(page, MEASURE_MS, false)
    report('playback, desktop', stats)
    expect(stats.p95Ms).toBeLessThan(FRAME_BUDGET_60 * 1.5)
  })

  test('editing a parameter every frame during playback stays interactive (SC-002)', async ({ page }) => {
    await loadDraft(page, heavyFunction())
    const stats = await measureFrames(page, MEASURE_MS, true)
    report('playback + edit every frame (full trail resample), desktop', stats)
    // SC-002: 参数变化到画面更新 < 100 ms; 每帧都在编辑时, 最慢的一帧就是最坏的响应延迟
    expect(stats.p95Ms).toBeLessThan(100)
  })

  test('with a 4x CPU slowdown (phone-class estimate) playback stays above 30 fps', async ({ page }) => {
    await loadDraft(page, heavyFunction())
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const playback = await measureFrames(page, MEASURE_MS, false)
    report('playback, 4x CPU throttle', playback)
    const editing = await measureFrames(page, MEASURE_MS, true)
    report('playback + edit every frame, 4x CPU throttle', editing)
    expect(playback.p95Ms).toBeLessThan(TWO_FRAMES_MS)
    // 降速下每帧编辑仍须满足 SC-002 的 100 ms 响应
    expect(editing.p95Ms).toBeLessThan(100)
  })
})

/**
 * 功能 002 (SC-004): 轨迹淡化关闭、保留"全部"、t = 600.
 * a) 周期函数: 只需采样一个周期; b) 不成整数比: 走满点数预算; c) 场景 b 下每帧改一次参数(整条轨迹重算).
 */
test.describe('retained trail at the ten minute cap: 50 components', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium desktop only')
  test.describe.configure({ mode: 'serial' })

  const retainedView = { ...INITIAL_VIEW, trailFade: false, trailRetention: 'all' as const }
  const periodic = (): FourierFunction => {
    const preset = applyPreset(createDefaultFunction(), 'sawtooth', MAX_COMPONENTS)
    if (!preset.ok) throw new Error(preset.error.message)
    return { ...preset.value, presentationMode: 'drawing2d' }
  }
  const aperiodic = (): FourierFunction => {
    const fn = periodic()
    return fn.components.slice(0, 5).reduce((current, component) => {
      const value = component.frequency.kind === 'constant' ? component.frequency.value : 0
      return updateTrack(current, component.id, 'frequency', { kind: 'constant', value: value * 1.0007123 })
    }, fn)
  }

  test('a periodic figure plays at 60 fps', async ({ page }) => {
    await loadDraft(page, periodic(), retainedView, 600)
    // 应用打开后自动播放
    await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible()
    const stats = await measureFrames(page, MEASURE_MS, false)
    report('retained "all", t=600, periodic', stats)
    expect(stats.p95Ms).toBeLessThan(25)
  })

  test('a non-periodic figure using the full point budget plays at 60 fps', async ({ page }) => {
    await loadDraft(page, aperiodic(), retainedView, 600)
    // 应用打开后自动播放
    await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible()
    const stats = await measureFrames(page, MEASURE_MS, false)
    report('retained "all", t=600, non-periodic (full budget)', stats)
    expect(stats.p95Ms).toBeLessThan(25)
  })

  test('editing a parameter every frame redraws the whole retained trail within 100 ms', async ({ page }) => {
    await loadDraft(page, aperiodic(), retainedView, 600)
    const stats = await measureFrames(page, MEASURE_MS, true)
    report('retained "all", t=600, non-periodic, edit every frame', stats)
    expect(stats.p95Ms).toBeLessThan(100)
  })
})
