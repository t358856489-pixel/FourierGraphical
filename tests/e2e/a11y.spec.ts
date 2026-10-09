import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openExpression, openPaused, seekTo } from './helpers'

const seriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(' | ')}`,
    )
}

test.beforeEach(async ({ page }) => openPaused(page))

test('initial screen has no serious accessibility violations', async ({ page }) => {
  expect(await seriousViolations(page)).toEqual([])
})

test('a selected keyframe and its inspector have no serious violations', async ({ page }) => {
  await seekTo(page, 2)
  await page.getByRole('button', { name: /为分量 1 振幅添加关键帧/ }).click()
  await page.getByRole('button', { name: /振幅关键帧, 2\.000 秒/ }).click()
  expect(await seriousViolations(page)).toEqual([])
})

for (const [button, dialog] of [
  ['导出', '导出'],
  ['我的函数', '我的函数'],
  ['保存', '保存函数'],
] as const) {
  test(`the "${dialog}" dialog has no serious violations`, async ({ page }) => {
    await page.getByRole('button', { name: button, exact: true }).click()
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
}

for (const background of ['默认深色', '纯白'] as const) {
  test(`the display panel on a ${background} canvas has no serious violations`, async ({
    page,
  }) => {
    await page.getByText('画面', { exact: true }).click()
    await page.getByRole('button', { name: background }).click()
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    expect(await seriousViolations(page)).toEqual([])
  })
}

for (const tab of ['图形库', '手绘', '导入'] as const) {
  test(`the shape dialog's "${tab}" tab has no serious violations`, async ({ page }) => {
    await page.getByRole('button', { name: '图形', exact: true }).click()
    await page.getByRole('tab', { name: tab }).click()
    expect(await seriousViolations(page)).toEqual([])
  })
}

test('the drawing overlay has no serious violations', async ({ page }) => {
  await page.getByRole('button', { name: '图形', exact: true }).click()
  await page.getByRole('tab', { name: '手绘' }).click()
  await page.getByRole('button', { name: '开始绘制' }).click()
  await expect(page.getByRole('toolbar', { name: '手绘工具' })).toBeVisible()
  expect(await seriousViolations(page)).toEqual([])
})

test('the expression panel has no serious violations (004 SC-005)', async ({ page }) => {
  await page.getByRole('button', { name: '方波' }).click()
  await openExpression(page)
  expect(await seriousViolations(page)).toEqual([])
})
