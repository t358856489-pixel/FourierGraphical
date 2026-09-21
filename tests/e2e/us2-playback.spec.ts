import { expect, test } from '@playwright/test'
import { currentTime, openPaused, readout, seekTo, setNumber, stillShot } from './helpers'

test('plays automatically on open, pauses, and resumes from the same moment', async ({ page }) => {
  await page.goto('/')
  const first = await currentTime(page)
  await expect.poll(() => currentTime(page)).toBeGreaterThan(first + 0.2)

  await page.getByRole('button', { name: '暂停', exact: true }).click()
  const paused = await currentTime(page)
  // 暂停后画面不再变化: 连续两张一致. 用轮询是因为紧跟暂停的第一张可能赶在最后一帧合成之前;
  // 如果动画并未停止, 这个条件永远无法满足
  await expect
    .poll(async () => (await stillShot(page)) === (await stillShot(page)))
    .toBe(true)

  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect.poll(() => currentTime(page)).toBeGreaterThan(paused)
})

test('does not autoplay when the user prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
  await expect(readout(page)).toHaveText('8.00')
})

test('speed changes how fast time runs without a jump', async ({ page }) => {
  await openPaused(page)
  await setNumber(page, '播放速度数值', '10')
  const before = await currentTime(page)
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect.poll(() => currentTime(page)).toBeGreaterThan(before + 5)
  await page.getByRole('button', { name: '暂停', exact: true }).click()
})

test('seeking by input, stepping and resetting', async ({ page }) => {
  await openPaused(page)
  await seekTo(page, 120)
  await expect(readout(page)).toHaveText('120.00')

  await page.getByRole('button', { name: '前进一步' }).click()
  expect(await currentTime(page)).toBeCloseTo(120 + 1 / 60, 6)
  await page.getByRole('button', { name: '后退一步' }).click()
  expect(await currentTime(page)).toBeCloseTo(120, 6)

  await page.getByRole('button', { name: '重置到 0 秒' }).click()
  await expect(readout(page)).toHaveText('0.00')
})

test('scrubbing the timeline shows that moment immediately', async ({ page }) => {
  await openPaused(page)
  const before = await stillShot(page)
  await page.getByRole('slider', { name: '时间轴' }).fill('3')
  await expect(readout(page)).toHaveText('3.00')
  expect(await stillShot(page)).not.toBe(before)
})

test('a loop region wraps playback and an invalid one is refused', async ({ page }) => {
  await openPaused(page)
  await seekTo(page, 2)
  await page.getByRole('button', { name: '循环' }).click()
  await setNumber(page, '循环终点', '2.5')
  await setNumber(page, '循环终点', '1')
  await expect(page.getByRole('alert')).toContainText('循环终点')
  await expect(page.getByRole('textbox', { name: '循环终点' })).toHaveValue('2.5')

  await page.getByRole('button', { name: '播放', exact: true }).click()
  const samples: number[] = []
  await expect
    .poll(async () => {
      samples.push(await currentTime(page))
      return samples.length >= 2 && (samples.at(-1) ?? 0) < (samples.at(-2) ?? 0)
    })
    .toBe(true)
  expect(Math.max(...samples)).toBeLessThan(2.5)
})

test('editing a parameter during playback does not interrupt the animation', async ({ page }) => {
  await page.goto('/')
  await setNumber(page, '分量 1 相位数值', '45')
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible()
  const t = await currentTime(page)
  await expect.poll(() => currentTime(page)).toBeGreaterThan(t)
})
