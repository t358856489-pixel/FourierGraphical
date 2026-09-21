import { expect, test } from '@playwright/test'
import { openPaused, rows, seekTo, setNumber } from './helpers'

test.beforeEach(async ({ page }) => openPaused(page))

test('the current edit survives a reload, including keyframes and the unsaved marker', async ({ page }) => {
  await page.getByRole('button', { name: /添加分量/ }).click()
  await seekTo(page, 3)
  await page.getByRole('button', { name: /为分量 1 振幅添加关键帧/ }).click()
  // 等自动保存落盘. 注意: 必须等应用自己建好数据库再打开它, 否则测试会抢先建出一个没有对象仓库的空库
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const databases = await indexedDB.databases()
        if (!databases.some((database) => database.name === 'fourier-graphical')) return false
        return new Promise<boolean>((resolve) => {
          const request = indexedDB.open('fourier-graphical')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('keyval')) return resolve(false)
            const get = db.transaction('keyval').objectStore('keyval').get('draft')
            get.onsuccess = () => {
              db.close()
              resolve(get.result?.function?.components?.[0]?.amplitude?.kind === 'animated')
            }
          }
          request.onerror = () => resolve(false)
        })
      }),
    )
    .toBe(true)

  await page.reload()
  await expect(rows(page)).toHaveCount(4)
  await expect(page.getByRole('button', { name: /振幅关键帧, 3\.000 秒/ })).toBeVisible()
  await expect(page.getByText('(有未保存的修改)')).toBeAttached()
})

test('save, reopen from the library, rename and delete', async ({ page }) => {
  await setNumber(page, '分量 1 相位数值', '77')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('textbox', { name: '名称' }).fill('我的作品')
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('(有未保存的修改)')).not.toBeAttached()

  // 刚保存过、没有未保存修改, 应用预设不需要确认
  await page.getByRole('button', { name: '方波' }).click()
  await expect(rows(page)).toHaveCount(5)
  await page.getByRole('button', { name: '我的函数' }).click()
  await page.getByRole('button', { name: /^打开\s*我的作品$/ }).click()
  await page.getByRole('button', { name: '放弃并打开' }).click()
  await expect(page.getByRole('textbox', { name: '分量 1 相位数值' })).toHaveValue('77')

  await page.getByRole('button', { name: '我的函数' }).click()
  await page.getByRole('button', { name: /^重命名\s*我的作品$/ }).click()
  await page.getByRole('textbox', { name: '我的作品的新名称' }).fill('改名了')
  await page.getByRole('button', { name: '确定' }).click()
  await page.getByRole('button', { name: /^删除\s*改名了$/ }).click()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText(/还没有保存过函数/)).toBeVisible()
})

test('exports the current frame as a PNG', async ({ page }) => {
  await page.getByRole('button', { name: '导出', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出图片' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.png$/)
})

test('video export either produces an MP4 or is disabled with a reason; cancel produces no file', async ({ page }) => {
  await page.getByRole('button', { name: '导出', exact: true }).click()
  await page.getByRole('tab', { name: '视频' }).click()
  const start = page.getByRole('button', { name: '开始导出' })
  const unsupported = page.getByRole('tabpanel').getByRole('status')
  await expect(start.or(unsupported)).toBeVisible()
  if (await unsupported.isVisible()) {
    await expect(unsupported).toContainText('图片导出不受影响')
    return
  }

  await setNumber(page, '终点', '30')
  let downloads = 0
  page.on('download', () => (downloads += 1))
  await start.click()
  await page.getByRole('button', { name: '取消导出' }).click()
  await expect(start).toBeVisible()
  expect(downloads).toBe(0)

  await setNumber(page, '终点', '1')
  const download = page.waitForEvent('download')
  await start.click()
  expect((await download).suggestedFilename()).toMatch(/\.mp4$/)
})
