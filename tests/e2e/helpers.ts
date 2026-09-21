import { createHash } from 'node:crypto'
import { expect, type Locator, type Page } from '@playwright/test'

export const readout = (page: Page): Locator => page.getByTestId('time-readout')

export const currentTime = async (page: Page): Promise<number> =>
  Number(await readout(page).getAttribute('data-time'))

export const canvas = (page: Page): Locator => page.getByRole('img', { name: /傅立叶函数图形/ })

export const rows = (page: Page): Locator => page.locator('.component-row')

/** 打开应用并暂停, 得到确定的静止画面 */
/** 打开应用并处于暂停: 用"减少动态效果"关闭自动播放与过渡动画, 得到确定的静止画面 */
export const openPaused = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(canvas(page)).toBeVisible()
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
}

export const seekTo = async (page: Page, seconds: number | string): Promise<void> => {
  const field = page.getByRole('textbox', { name: '跳转到' })
  await field.fill(String(seconds))
  await field.press('Enter')
}

export const setNumber = async (page: Page, name: string, value: string): Promise<void> => {
  const field = page.getByRole('textbox', { name, exact: true })
  await field.fill(value)
  await field.press('Enter')
}

export const undoShortcut = process.platform === 'darwin' ? 'Meta+z' : 'Control+z'

/**
 * 画布当前画面的指纹. 用元素截图而不是 getImageData: Chrome 在画布被多次读回后会把它从 GPU
 * 光栅化切到 CPU 光栅化, 抗锯齿随之改变——测量手段会改变被测对象.
 * 截图前把鼠标移开(悬停分量行会高亮该分量)并滚回顶部(吸顶布局下的亚像素偏移会影响截图).
 */
export const stillShot = async (page: Page): Promise<string> => {
  await page.mouse.move(0, 0)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.scrollTo(0, 0)
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
  const shot = await canvas(page).screenshot({ animations: 'disabled' })
  return createHash('sha256').update(shot).digest('hex')
}
