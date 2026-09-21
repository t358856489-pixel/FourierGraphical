import { expect, test } from '@playwright/test'
import { boundingRadius, vectorChain } from '../../src/core/evaluator'
import { createDefaultFunction } from '../../src/core/function'
import { layoutRegions } from '../../src/render/drawFrame'
import { createViewport } from '../../src/render/viewport'
import { canvas, openPaused, rows, seekTo, setNumber, stillShot, undoShortcut } from './helpers'

test.beforeEach(async ({ page }) => openPaused(page))

test('opens with an example function and a drawn figure, not a blank screen', async ({ page }) => {
  await expect(rows(page)).toHaveCount(3)
  const shot = await stillShot(page)
  await page.getByRole('button', { name: '轨迹' }).click()
  expect(await stillShot(page)).not.toBe(shot)
})

test('adding a component adds a row and changes the figure', async ({ page }) => {
  const before = await stillShot(page)
  await page.getByRole('button', { name: /添加分量/ }).click()
  await expect(rows(page)).toHaveCount(4)
  expect(await stillShot(page)).not.toBe(before)
})

test('the figure follows a slider while it is being dragged, and the drag is one undo step', async ({ page, isMobile }) => {
  // Playwright 的触摸屏只支持点按, 无法模拟拖动; 触摸拖动滑块需要真机验证
  test.skip(isMobile, 'mouse drag is not meaningful on an emulated touch device')
  const slider = page.getByRole('slider', { name: '分量 1 振幅' })
  const field = page.getByRole('textbox', { name: '分量 1 振幅数值' })
  const original = await field.inputValue()
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  if (!box) throw new Error('slider not laid out')

  const start = await stillShot(page)
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 })
  const midDrag = await stillShot(page)
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  expect(midDrag).not.toBe(start)
  await expect(field).not.toHaveValue(original)

  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(undoShortcut)
  await expect(field).toHaveValue(original)
  await expect(page.getByRole('button', { name: '撤销' })).toBeDisabled()
})

test('invalid numbers are explained and the previous value is kept', async ({ page }) => {
  const field = page.getByRole('textbox', { name: '分量 1 振幅数值' })
  const original = await field.inputValue()
  await setNumber(page, '分量 1 振幅数值', 'abc')
  await expect(page.getByRole('alert')).toHaveText('请输入数字')
  await expect(field).toHaveValue(original)
  await setNumber(page, '分量 1 振幅数值', '999')
  await expect(page.getByRole('alert')).toContainText('0 到 100')
  await expect(field).toHaveValue(original)
})

test('disabling removes a contribution, re-enabling restores it, deleting all shows the empty state', async ({ page }) => {
  const full = await stillShot(page)
  const enable = page.getByRole('checkbox', { name: /启用\s*分量 2/ })
  await enable.uncheck()
  expect(await stillShot(page)).not.toBe(full)
  await enable.check()
  expect(await stillShot(page)).toBe(full)

  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '删除分量 1' }).click()
  await expect(page.getByText(/没有启用的分量/)).toBeVisible()
  await expect(page.getByText(/还没有分量/)).toBeVisible()
})

test('dragging a vector tip on the canvas updates its amplitude and phase in the list', async ({ page }) => {
  await page.getByText('二维绘图').click()
  await seekTo(page, 1)
  const box = await canvas(page).boundingBox()
  if (!box) throw new Error('canvas not laid out')

  const fn = { ...createDefaultFunction(), presentationMode: 'drawing2d' as const }
  const regions = layoutRegions('drawing2d', box)
  const viewport = createViewport({ zoom: 'auto', pan: { x: 0, y: 0 } }, boundingRadius(fn), regions.epicycles)
  const tip = viewport.toScreen(vectorChain(fn, 1)[0]?.to ?? { x: 0, y: 0 })

  const amplitude = page.getByRole('textbox', { name: '分量 1 振幅数值' })
  const phase = page.getByRole('textbox', { name: '分量 1 相位数值' })
  await page.mouse.move(box.x + tip.x, box.y + tip.y)
  await page.mouse.down()
  await page.mouse.move(box.x + tip.x + 60, box.y + tip.y - 80, { steps: 6 })
  await page.mouse.up()

  await expect(amplitude).not.toHaveValue('1.27')
  await expect(phase).not.toHaveValue('0')
})

test('switching the presentation mode keeps the components and the time', async ({ page }) => {
  await seekTo(page, 4.5)
  const waveform = await stillShot(page)
  await page.getByText('二维绘图').click()
  await expect(rows(page)).toHaveCount(3)
  await expect(page.getByTestId('time-readout')).toHaveText('4.50')
  expect(await stillShot(page)).not.toBe(waveform)
  await page.getByText('波形', { exact: true }).click()
  expect(await stillShot(page)).toBe(waveform)
})
