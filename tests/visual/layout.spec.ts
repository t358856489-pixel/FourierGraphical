import { expect, test } from '@playwright/test'
import { canvas, openPaused } from '../e2e/helpers'

const WIDTHS = [320, 768, 1024, 1440] as const

for (const width of WIDTHS) {
  test(`no horizontal overflow and nothing cut off at ${width}px (FR-026)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPaused(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    const box = await canvas(page).boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(width * 0.5)
    expect(box?.height ?? 0).toBeGreaterThan(150)

    // 功能 002: 展开"画面"面板后, 面板里的控件也不得越出视口
    await page.getByText('画面', { exact: true }).click()
    for (const control of [
      page.getByRole('combobox', { name: '轨迹保留时长' }),
      page.getByRole('textbox', { name: '十六进制颜色值' }),
      page.getByRole('button', { name: '恢复默认' }),
    ]) {
      await control.scrollIntoViewIfNeeded()
      const rect = await control.boundingBox()
      expect(rect && rect.x >= 0 && rect.x + rect.width <= width).toBe(true)
    }
    await page.getByText('画面', { exact: true }).click()

    // 功能 003: 图形对话框与绘制模式的控件也不得越出视口
    await page.getByRole('button', { name: '图形', exact: true }).click()
    for (const control of [
      page.getByRole('button', { name: '雪花' }),
      page.getByRole('tab', { name: '导入' }),
    ]) {
      const rect = await control.boundingBox()
      expect(rect && rect.x >= 0 && rect.x + rect.width <= width).toBe(true)
    }
    await page.getByRole('tab', { name: '手绘' }).click()
    await page.getByRole('button', { name: '开始绘制' }).click()
    const toolbar = await page.getByRole('toolbar', { name: '手绘工具' }).boundingBox()
    expect(toolbar && toolbar.x >= 0 && toolbar.x + toolbar.width <= width).toBe(true)
    await page.getByRole('button', { name: '退出绘制' }).click()

    // 功能 004: 表达式面板展开后, 控件与公式区都不得越出视口
    await page.getByRole('button', { name: '表达式', exact: true }).click()
    const expression = page.getByRole('region', { name: '表达式' })
    for (const control of [
      expression.getByRole('radio', { name: '参数方程' }),
      expression.getByRole('button', { name: '复制' }),
      expression.locator('.expression-panel__scroll'),
    ]) {
      await control.scrollIntoViewIfNeeded()
      const rect = await control.boundingBox()
      expect(rect && rect.x >= 0 && rect.x + rect.width <= width).toBe(true)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: '表达式', exact: true }).click()

    for (const name of ['播放', '保存', '导出']) {
      const button = page.getByRole('button', { name, exact: true })
      await button.scrollIntoViewIfNeeded()
      const rect = await button.boundingBox()
      expect(rect && rect.x >= 0 && rect.x + rect.width <= width).toBe(true)
    }
  })
}
