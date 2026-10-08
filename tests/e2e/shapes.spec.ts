import { expect, test, type Page } from '@playwright/test'
import { canvasShot, currentTime, diffRatio, openPaused, rows, seekTo, stillShot, undoShortcut } from './helpers'

const openShapes = async (page: Page) => {
  await page.getByRole('button', { name: '图形', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '图形' })).toBeVisible()
}
const componentCount = async (page: Page) =>
  Number((await page.locator('.components-panel__count').textContent())?.split('/')[0])

test.describe('story 1: shape library', () => {
  test('three interactions draw a snowflake; after one period the figure is complete and stays', async ({ page }) => {
    await openPaused(page)
    await openShapes(page) // 1
    await page.getByRole('button', { name: '雪花' }).click() // 2
    await page.getByRole('button', { name: '关闭' }).click() // 3
    // openPaused 模拟了"减少动态效果": 应用后不自动播放, 时间直接跳到一个周期的末尾, 整幅图形显示出来
    await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
    await expect(page.getByTestId('time-readout')).toHaveText('5.00')
    expect(await componentCount(page)).toBeGreaterThan(100)

    // 周期恰为 5 秒(频率都是 0.2 的整数倍): 画完一圈后再播多久, 画面都与"同相位"的时刻一致
    await seekTo(page, 5.5)
    const afterOnePeriod = await canvasShot(page)
    await seekTo(page, 10.5)
    // 同相位的两帧只允许高亮段边界上一两个采样的舍入差异
    expect(await diffRatio(page, afterOnePeriod, await canvasShot(page))).toBeLessThan(0.002)
    await seekTo(page, 2.5)
    expect(await diffRatio(page, afterOnePeriod, await canvasShot(page))).toBeGreaterThan(0.01)
  })

  test('fewer components give a rounder approximation; undo restores the previous function', async ({ page }) => {
    await openPaused(page)
    await openShapes(page)
    await page.getByRole('button', { name: '雪花' }).click()
    await page.getByRole('button', { name: '关闭' }).click()
    await seekTo(page, 5.5)
    const detailed = await stillShot(page)
    const detailedCount = await componentCount(page)

    // 分量数滑块在对话框内, 应用后直接调整
    await openShapes(page)
    await page.getByRole('button', { name: '雪花' }).click()
    await page.getByRole('slider', { name: '图形分量个数' }).fill('10')
    await page.getByRole('button', { name: '关闭' }).click()
    await seekTo(page, 5.5)
    expect(await componentCount(page)).toBeLessThanOrEqual(10)
    expect(await stillShot(page)).not.toBe(detailed)

    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press(undoShortcut) // 撤销滑块的那一步
    expect(await componentCount(page)).toBe(detailedCount)
    await page.keyboard.press(undoShortcut) // 撤销第二次应用
    await page.keyboard.press(undoShortcut) // 撤销第一次应用
    await expect(rows(page)).toHaveCount(3)
  })
})

test('without reduced motion, applying a shape starts playback from zero', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  await openShapes(page)
  await page.getByRole('button', { name: '心形' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible()
  await expect.poll(() => currentTime(page)).toBeLessThan(3)
})

test.describe('story 2: hand drawing', () => {
  const drawHeart = async (page: Page, cx: number, cy: number, scale: number) => {
    const point = (u: number) => ({
      x: cx + 16 * Math.sin(u) ** 3 * scale,
      y: cy - (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * scale,
    })
    const start = point(0)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    for (let i = 1; i <= 60; i++) {
      const p = point((2 * Math.PI * i) / 60)
      await page.mouse.move(p.x, p.y, { steps: 2 })
    }
    await page.mouse.up()
  }
  const startDrawing = async (page: Page) => {
    await openShapes(page)
    await page.getByRole('tab', { name: '手绘' }).click()
    await page.getByRole('button', { name: '开始绘制' }).click()
    await expect(page.getByRole('toolbar', { name: '手绘工具' })).toBeVisible()
  }

  test('a drawn heart is traced back; smoothing changes the result; a dot is refused', async ({ page }) => {
    await openPaused(page)
    await startDrawing(page)
    const box = await page.getByTestId('drawing-layer').boundingBox()
    if (!box) throw new Error('no drawing layer')
    const before = await componentCount(page)
    await drawHeart(page, box.x + box.width / 2, box.y + box.height / 2, Math.min(box.width, box.height) / 60)
    await expect.poll(() => componentCount(page)).not.toBe(before)
    await expect(page.getByRole('slider', { name: '平滑程度' })).toBeEnabled()

    await page.getByRole('slider', { name: '平滑程度' }).fill('0')
    await page.getByRole('button', { name: '退出绘制' }).click()
    await seekTo(page, 5.5)
    const rough = await stillShot(page)
    await startDrawing(page)
    await page.getByRole('slider', { name: '平滑程度' }).fill('100')
    await page.getByRole('button', { name: '退出绘制' }).click()
    await seekTo(page, 5.5)
    expect(await stillShot(page)).not.toBe(rough)

    await startDrawing(page)
    const count = await componentCount(page)
    await page.mouse.move(box.x + 20, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 22, box.y + 21)
    await page.mouse.up()
    await expect(page.getByText(/再画长一些/)).toBeVisible()
    expect(await componentCount(page)).toBe(count)
    await page.getByRole('button', { name: '清除' }).click()
    await page.getByRole('button', { name: '退出绘制' }).click()
    await expect(page.getByRole('toolbar', { name: '手绘工具' })).not.toBeVisible()
  })
})

test.describe('story 3: SVG import', () => {
  const openImport = async (page: Page) => {
    await openShapes(page)
    await page.getByRole('tab', { name: '导入' }).click()
  }

  test('a single-path SVG is traced; a multi-path file says which path was used', async ({ page }) => {
    await openPaused(page)
    const before = await stillShot(page)
    await openImport(page)
    await page.getByLabel('选择 SVG 文件').setInputFiles('tests/fixtures/svg/single-path.svg')
    await page.getByRole('button', { name: '关闭' }).click()
    await expect(page.getByText('二维绘图')).toBeVisible()
    await seekTo(page, 5.5)
    expect(await stillShot(page)).not.toBe(before)

    await openImport(page)
    await page.getByLabel('选择 SVG 文件').setInputFiles('tests/fixtures/svg/multi-path.svg')
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('最长')
  })

  test('hostile and invalid files are refused without any network request or script', async ({ page }) => {
    await openPaused(page)
    const requests: string[] = []
    page.on('request', (request) => {
      if (!request.url().startsWith('http://localhost')) requests.push(request.url())
    })
    await openImport(page)
    const count = await componentCount(page)
    await page.getByLabel('选择 SVG 文件').setInputFiles('tests/fixtures/svg/with-script.svg')
    await page.getByRole('button', { name: '关闭' }).click()
    await expect(page.getByText('二维绘图')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined()
    expect(requests).toEqual([])

    await openImport(page)
    const applied = await componentCount(page)
    await page.getByLabel('选择 SVG 文件').setInputFiles('tests/fixtures/svg/not-svg.txt')
    await expect(page.getByRole('alert')).toContainText('SVG')
    expect(await componentCount(page)).toBe(applied)
    expect(applied).not.toBe(count)
  })
})
