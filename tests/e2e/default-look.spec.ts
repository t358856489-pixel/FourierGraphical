import { expect, test } from '@playwright/test'
import { canvas, openPaused, seekTo } from './helpers'

/**
 * 本机回归护栏 (功能 002 的 SC-007): 默认显示设置下的画面与功能 001 一致.
 * 基线截图录制于功能 002 动工之前. 光栅化随机器与引擎而异, 所以只在 chromium 上比对;
 * 与环境无关的保障是 src/render/drawFrame.regression.test.ts.
 */
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'baseline recorded on desktop Chromium')

for (const mode of ['波形', '二维绘图'] as const) {
  test(`default look is unchanged in ${mode} mode`, async ({ page }) => {
    await openPaused(page)
    await page.getByText(mode, { exact: true }).click()
    await seekTo(page, 4.5)
    await page.mouse.move(0, 0)
    await expect(canvas(page)).toHaveScreenshot(`default-${mode === '波形' ? 'waveform' : 'drawing2d'}.png`, {
      maxDiffPixels: 0,
    })
  })
}
