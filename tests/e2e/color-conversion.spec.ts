import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseColor } from '../../src/core/color'

/**
 * 自带的 OKLCH→sRGB 转换必须与浏览器一致 (功能 002 修订记录 F3): 配色派生用前者算对比度, 画布用后者上色.
 * 让浏览器把每个令牌颜色画到一张**独立**的 1×1 画布上取值(不读应用的真实画布).
 */
const tokens = [...readFileSync('src/styles/tokens.css', 'utf8').matchAll(/--(screen-[\w-]+|component-c\d+):\s*(oklch\([^)]*\))/g)]
  .map((match) => ({ name: match[1] as string, value: match[2] as string }))
  // 画布不使用带透明度的令牌
  .filter((token) => !token.value.includes('/'))

test('token colours convert to the same sRGB values the browser uses', async ({ page }) => {
  expect(tokens.length).toBeGreaterThan(15)
  await page.goto('/')
  const rendered = await page.evaluate((values) => {
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    const ctx = probe.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d context')
    return values.map((value) => {
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
    })
  }, tokens.map((token) => token.value))

  tokens.forEach((token, index) => {
    const parsed = parseColor(token.value)
    if (!parsed.ok) throw new Error(`cannot parse ${token.name}: ${token.value}`)
    const [r, g, b] = rendered[index] as [number, number, number]
    const delta = Math.max(Math.abs(parsed.value.r - r), Math.abs(parsed.value.g - g), Math.abs(parsed.value.b - b))
    expect(delta, `${token.name} ${token.value}: ours ${JSON.stringify(parsed.value)} vs browser ${r},${g},${b}`).toBeLessThanOrEqual(2)
  })
})
