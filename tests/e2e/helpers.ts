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
  // 等网页字体就绪: 字体换入会让工具栏重新换行, 进而改变画布尺寸, 使紧随其后的截图与稍后的不一致
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
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

/** 两张画布截图中颜色不同的像素占比(0–1); 用于"几乎相同"的断言, 哈希相等对亚像素舍入过于苛刻 */
export const diffRatio = async (page: Page, a: Buffer, b: Buffer): Promise<number> =>
  page.evaluate(
    async ([first, second]) => {
      const decode = async (dataUrl: string) => {
        const image = new Image()
        image.src = dataUrl
        await image.decode()
        const probe = document.createElement('canvas')
        probe.width = image.width
        probe.height = image.height
        const ctx = probe.getContext('2d')
        ctx?.drawImage(image, 0, 0)
        return ctx?.getImageData(0, 0, image.width, image.height).data ?? new Uint8ClampedArray()
      }
      const [pa, pb] = await Promise.all([decode(first as string), decode(second as string)])
      let differing = 0
      for (let i = 0; i < pa.length; i += 4) {
        const channel = (data: Uint8ClampedArray, index: number) => data[index] ?? 0
        const delta = Math.max(
          Math.abs(channel(pa, i) - channel(pb, i)),
          Math.abs(channel(pa, i + 1) - channel(pb, i + 1)),
          Math.abs(channel(pa, i + 2) - channel(pb, i + 2)),
        )
        if (delta > 24) differing += 1
      }
      return differing / (pa.length / 4)
    },
    [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`],
  )

export const canvasShot = async (page: Page): Promise<Buffer> => {
  await page.mouse.move(0, 0)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return canvas(page).screenshot({ animations: 'disabled' })
}
