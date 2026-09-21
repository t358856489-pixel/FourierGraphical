import { expect, test, type Page } from '@playwright/test'
import { currentTime, readout, rows } from './helpers'

const focusIsVisible = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement
    if (!element || element === document.body) return false
    const style = getComputedStyle(element)
    const ring = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
    // 数值框与模式切换把焦点环画在容器或相邻元素上
    const container = element.closest('.number-field__box')
    const sibling = element.nextElementSibling
    const delegated = [container, sibling].some(
      (target) => target && getComputedStyle(target).outlineStyle !== 'none',
    )
    return ring || delegated
  })

test('the main flow works without a mouse (FR-024)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  // 添加分量
  await page.getByRole('button', { name: /添加分量/ }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await expect(rows(page)).toHaveCount(4)

  // 用方向键调参数
  const slider = page.getByRole('slider', { name: '分量 4 振幅' })
  await slider.focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('textbox', { name: '分量 4 振幅数值' })).toHaveValue('1.01')

  // 滑块上的方向键不触发全局"单步"
  await expect(readout(page)).toHaveText('8.00')

  // 空格播放/暂停, 方向键单步, Home 重置
  await page.locator('body').focus()
  await page.keyboard.press('Tab')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press(' ')
  await expect.poll(() => currentTime(page)).toBeGreaterThan(8)
  await page.keyboard.press(' ')
  const paused = await currentTime(page)
  await page.keyboard.press('ArrowRight')
  expect(await currentTime(page)).toBeCloseTo(paused + 1 / 60, 6)
  await page.keyboard.press('Home')
  await expect(readout(page)).toHaveText('0.00')

  // 添加关键帧并用键盘移动
  await page.getByRole('button', { name: /为分量 1 相位添加关键帧/ }).focus()
  await page.keyboard.press('Enter')
  const marker = page.getByRole('button', { name: /相位关键帧, 0\.000 秒/ })
  await marker.focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: /相位关键帧, 0\.100 秒/ })).toBeVisible()
  // 关键帧上的方向键同样不触发全局"单步"
  await expect(readout(page)).toHaveText('0.00')

  // 保存
  await page.getByRole('button', { name: '保存', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('textbox', { name: '名称' }).fill('键盘作品')
  await page.keyboard.press('Enter')
  await expect(page.getByText('已保存"键盘作品"')).toBeVisible()
})

test('space on a focused button activates that button instead of toggling playback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '网格' }).focus()
  await page.keyboard.press(' ')
  await expect(page.getByRole('button', { name: '网格' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
})
