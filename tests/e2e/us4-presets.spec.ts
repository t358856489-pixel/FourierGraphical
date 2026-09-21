import { expect, test } from '@playwright/test'
import { openPaused, rows, setNumber, stillShot } from './helpers'

test.beforeEach(async ({ page }) => openPaused(page))

test('a twenty-component square wave takes at most three interactions', async ({ page }) => {
  const before = await stillShot(page)
  await page.getByRole('button', { name: '方波' }).click() // 1
  await expect(rows(page)).toHaveCount(5)
  await page.getByRole('slider', { name: '预设分量个数' }).fill('20') // 2
  await expect(rows(page)).toHaveCount(20)
  expect(await stillShot(page)).not.toBe(before)
})

test('asks before overwriting edits; cancelling keeps them', async ({ page }) => {
  await setNumber(page, '分量 1 相位数值', '30')
  await page.getByRole('button', { name: '锯齿波' }).click()
  await expect(page.getByRole('dialog', { name: '替换当前函数?' })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('textbox', { name: '分量 1 相位数值' })).toHaveValue('30')

  await page.getByRole('button', { name: '锯齿波' }).click()
  await page.getByRole('button', { name: '替换' }).click()
  await expect(rows(page)).toHaveCount(5)
})
