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

test('space on a focused button activates that button instead of toggling playback', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '网格' }).focus()
  await page.keyboard.press(' ')
  await expect(page.getByRole('button', { name: '网格' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
})

test('display options can be changed without a mouse, each within two interactions (SC-001)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  // 坐标轴: 1 次操作
  await page.getByRole('button', { name: '坐标轴' }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '坐标轴' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  // 其余选项: 展开面板 + 1 次操作
  await page.getByText('画面', { exact: true }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '轨迹淡化' }).focus()
  await page.keyboard.press(' ')
  await expect(page.getByRole('button', { name: '轨迹淡化' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()

  const select = page.getByRole('combobox', { name: '轨迹保留时长' })
  await select.focus()
  expect(await focusIsVisible(page)).toBe(true)
  await select.selectOption({ label: '30 秒' })
  await expect(select).toHaveValue('30')

  await page.getByRole('button', { name: '纯白' }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: '十六进制颜色值' })).toHaveValue('#ffffff')
  await page.getByRole('button', { name: '恢复默认' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '默认深色' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('a shape can be chosen, resized and applied with the keyboard; the file picker is reachable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '图形', exact: true }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '五角星' }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  const slider = page.getByRole('slider', { name: '图形分量个数' })
  await slider.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(slider).toHaveValue('59')
  await page.getByRole('tab', { name: '导入' }).focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('选择 SVG 文件').focus()
  expect(await page.evaluate(() => document.activeElement?.getAttribute('type'))).toBe('file')
  await page.getByRole('button', { name: '关闭' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('二维绘图')).toBeVisible()
})

test('with 200 components, Tab keeps moving through rows beyond the rendered window', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '图形', exact: true }).click()
  await page.getByRole('button', { name: '雪花' }).click()
  await page.getByRole('slider', { name: '图形分量个数' }).fill('200')
  await page.getByRole('button', { name: '关闭' }).click()
  // 直接聚焦第 60 行附近的控件, 然后一路 Tab: 虚拟化不得切断顺序
  const list = page.getByTestId('virtual-list')
  await list.evaluate((element) => element.scrollTo({ top: 60 * 156 }))
  const row = page.locator('.component-row[data-index="62"]')
  await expect(row).toBeVisible()
  await row.getByRole('checkbox').focus()
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
  const focusedRow = await page.evaluate(() =>
    Number(document.activeElement?.closest('[data-index]')?.getAttribute('data-index')),
  )
  expect(focusedRow).toBeGreaterThan(62)
})

test('the expression panel is fully operable with the keyboard (004 FR-013)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Firefox/WebKit 的 Playwright 没有剪贴板权限: 用桩接住写入
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
  })
  await page.goto('/')
  const button = page.getByRole('button', { name: '表达式', exact: true })
  await button.focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  const panel = page.getByRole('region', { name: '表达式' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { name: '表达式' })).toBeFocused()

  // 方向键切换写法
  await panel.getByRole('radio', { name: '波形' }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(panel.getByRole('radio', { name: '参数方程' })).toBeChecked()
  expect(await page.getByTestId('expression-plain').textContent()).toContain('x(t) = ')

  // Tab 到"复制"并回车 → 提示
  await panel.getByRole('button', { name: '复制' }).focus()
  expect(await focusIsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('提示')).toContainText('已复制')

  // Esc 收起并把焦点还给按钮
  await panel.getByRole('radio', { name: '参数方程' }).focus()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(button).toBeFocused()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
})
