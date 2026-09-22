import { createDefaultFunction, setPresentationMode } from '../core/function'
import { INITIAL_VIEW } from '../state/viewStore'
import { createFakeContext } from '../test/fakeContext'
import { drawFrame } from './drawFrame'
import { FALLBACK_THEME } from './theme'

/**
 * 回归基准 (功能 002 的 SC-007): 默认显示设置下的画面必须与功能 001 完全一致.
 * 这份快照录制于功能 002 动工之前. 如果它失败了, 说明默认画面变了——去找原因, **不要**用 -u 更新它.
 */
const fixedFunction = () => {
  let next = 0
  return createDefaultFunction(
    () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`,
    () => '2026-01-01T00:00:00.000Z',
  )
}

const callsOf = (mode: 'waveform' | 'drawing2d', t: number) => {
  const fake = createFakeContext()
  const fn = setPresentationMode(fixedFunction(), mode)
  drawFrame(fake.ctx, fn, t, INITIAL_VIEW, { width: 800, height: 400, pixelRatio: 2 }, FALLBACK_THEME)
  return fake.calls
}

describe('default look regression', () => {
  test.each([
    ['waveform', 5],
    ['drawing2d', 5],
    ['drawing2d', 0.5],
  ] as const)('%s at t = %s draws exactly what feature 001 drew', (mode, t) => {
    expect(callsOf(mode, t)).toMatchSnapshot()
  })
})
