import { expect, test } from '@playwright/test'
import { currentTime, openPaused, seekTo, setNumber, stillShot, undoShortcut } from './helpers'

const amplitudeField = '分量 1 振幅数值'

const rampAmplitude = async (page: import('@playwright/test').Page) => {
  await seekTo(page, 0)
  await page.getByRole('button', { name: /为分量 1 振幅添加关键帧/ }).click()
  await setNumber(page, amplitudeField, '0')
  await seekTo(page, 5)
  await setNumber(page, amplitudeField, '1')
}

test.beforeEach(async ({ page }) => openPaused(page))

test('two keyframes animate the amplitude: 0 at 0s, 1 at 5s, 0.5 at 2.5s', async ({ page }) => {
  await rampAmplitude(page)
  await expect(page.getByRole('button', { name: /振幅关键帧/ })).toHaveCount(2)
  await seekTo(page, 2.5)
  await expect(page.getByRole('textbox', { name: amplitudeField })).toHaveValue('0.5')
  await seekTo(page, 9)
  await expect(page.getByRole('textbox', { name: amplitudeField })).toHaveValue('1')
})

test('easing changes the curve between keyframes', async ({ page }) => {
  await rampAmplitude(page)
  await page.getByRole('button', { name: /振幅关键帧, 0\.000 秒/ }).click()
  await page.getByText('保持', { exact: true }).click()
  await seekTo(page, 4.9)
  await expect(page.getByRole('textbox', { name: amplitudeField })).toHaveValue('0')
})

test('keyframes can be moved and deleted with the keyboard, and undone', async ({ page }) => {
  await rampAmplitude(page)
  const marker = page.getByRole('button', { name: /振幅关键帧, 5\.000 秒/ })
  await marker.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: /振幅关键帧, 5\.100 秒/ })).toBeVisible()

  await page.getByRole('button', { name: /振幅关键帧, 5\.100 秒/ }).press('Delete')
  await page.getByRole('button', { name: /振幅关键帧, 0\.000 秒/ }).press('Delete')
  await expect(page.getByRole('button', { name: /振幅关键帧/ })).toHaveCount(0)

  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(undoShortcut)
  await expect(page.getByRole('button', { name: /振幅关键帧/ })).toHaveCount(1)
})

test('scrubbing to a moment shows exactly what continuous playback showed there (FR-018f)', async ({ page }) => {
  await seekTo(page, 0)
  await page.getByRole('button', { name: /为分量 1 频率添加关键帧/ }).click()
  await setNumber(page, '分量 1 频率数值', '1')
  await seekTo(page, 4)
  await setNumber(page, '分量 1 频率数值', '-1')

  await page.getByRole('button', { name: '重置到 0 秒' }).click()
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect.poll(() => currentTime(page)).toBeGreaterThan(3)
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  const moment = await page.getByTestId('time-readout').getAttribute('data-time')
  const played = await stillShot(page)

  await page.getByRole('button', { name: '重置到 0 秒' }).click()
  await seekTo(page, moment ?? '0')
  expect(await stillShot(page)).toBe(played)
})
