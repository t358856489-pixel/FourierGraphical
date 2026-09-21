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

    for (const name of ['播放', '保存', '导出']) {
      const button = page.getByRole('button', { name, exact: true })
      await button.scrollIntoViewIfNeeded()
      const rect = await button.boundingBox()
      expect(rect && rect.x >= 0 && rect.x + rect.width <= width).toBe(true)
    }
  })
}
