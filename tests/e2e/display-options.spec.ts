import { expect, test, type Page } from '@playwright/test'
import { canvas, currentTime, openPaused, seekTo, setNumber, stillShot, undoShortcut } from './helpers'

/** 展开的"画面"面板浮在画布上方; 截图前必须收起, 所以打开与关闭都走真实的点击 */
const panel = (page: Page) => page.locator('details.display-panel')
const openPanel = async (page: Page) => {
  if (!(await panel(page).evaluate((element) => (element as HTMLDetailsElement).open))) {
    await page.getByText('画面', { exact: true }).click()
  }
}
const closePanel = async (page: Page) => {
  if (await panel(page).evaluate((element) => (element as HTMLDetailsElement).open)) {
    await page.getByText('画面', { exact: true }).click()
  }
}
const shot = async (page: Page) => {
  await closePanel(page)
  return stillShot(page)
}
const retention = (page: Page) => page.getByRole('combobox', { name: '轨迹保留时长' })
const to2d = (page: Page) => page.getByText('二维绘图').click()

test.beforeEach(async ({ page }) => openPaused(page))

test.describe('story 1: retained trail', () => {
  test('turning fading off keeps the whole path; retention trims it; turning it back restores the afterglow', async ({ page }) => {
    await to2d(page)
    await setNumber(page, '分量 1 频率数值', '1.2345') // 不成整数比: 长时间才画完
    await seekTo(page, 30)
    const fading = await shot(page)

    await openPanel(page)
    await expect(retention(page)).toBeDisabled()
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    await expect(retention(page)).toBeEnabled()
    const all = await shot(page)
    expect(all).not.toBe(fading)

    await openPanel(page)
    await retention(page).selectOption({ label: '5 秒' })
    const fiveSeconds = await shot(page)
    expect(fiveSeconds).not.toBe(all)
    await openPanel(page)
    await retention(page).selectOption({ label: '全部' })
    await expect.poll(() => shot(page)).toBe(all)

    await openPanel(page)
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    await expect.poll(() => shot(page)).toBe(fading)
  })

  test('scrubbing to a moment equals playing there, with the retained trail (principle I)', async ({ page }) => {
    await to2d(page)
    await setNumber(page, '分量 1 频率数值', '1.2345')
    await openPanel(page)
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    await closePanel(page)

    await page.getByRole('button', { name: '重置到 0 秒' }).click()
    await page.getByRole('button', { name: '播放', exact: true }).click()
    await expect.poll(() => currentTime(page)).toBeGreaterThan(3)
    await page.getByRole('button', { name: '暂停', exact: true }).click()
    const moment = await page.getByTestId('time-readout').getAttribute('data-time')
    const played = await shot(page)

    await page.getByRole('button', { name: '重置到 0 秒' }).click()
    const cleared = await shot(page)
    expect(cleared).not.toBe(played)
    await seekTo(page, moment ?? '0')
    await expect.poll(() => shot(page)).toBe(played)
  })

  test('editing a parameter redraws the whole retained trail, and reverting restores it exactly', async ({ page }) => {
    await to2d(page)
    await openPanel(page)
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    await seekTo(page, 12)
    const before = await shot(page)
    await setNumber(page, '分量 2 振幅数值', '1.5')
    expect(await shot(page)).not.toBe(before)
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press(undoShortcut)
    await expect.poll(() => shot(page)).toBe(before)
  })

  test('explains the ten minute cap and a shortened retention', async ({ page }) => {
    await to2d(page)
    await setNumber(page, '分量 1 频率数值', '1.2345')
    await openPanel(page)
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    await seekTo(page, 900)
    await openPanel(page)
    await expect(page.locator('.display-panel__status')).toContainText('10 分钟保留上限')
    await setNumber(page, '分量 1 频率数值', '97.1234')
    await expect(page.locator('.display-panel__status')).toContainText('实际保留约')
  })
})

test.describe('story 2: grid and axes', () => {
  test('four combinations look different; both on is the default look', async ({ page }) => {
    const grid = page.getByRole('button', { name: '网格', exact: true })
    const axes = page.getByRole('button', { name: '坐标轴' })
    const both = await shot(page)
    await grid.click()
    const axesOnly = await shot(page)
    await axes.click()
    const none = await shot(page)
    await grid.click()
    const gridOnly = await shot(page)
    expect(new Set([both, axesOnly, none, gridOnly]).size).toBe(4)
    await axes.click()
    await expect.poll(() => shot(page)).toBe(both)
  })

  test('the switches work from the keyboard without toggling playback', async ({ page }) => {
    await page.getByRole('button', { name: '坐标轴' }).focus()
    await page.keyboard.press(' ')
    await expect(page.getByRole('button', { name: '坐标轴' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
  })
})

test.describe('story 3: background colour', () => {
  test('presets recolour the canvas; restore default returns to the original look', async ({ page }) => {
    // 等画面稳定(连续两张一致)再取基准, 避免全量并行下首帧未画完
    await expect.poll(async () => (await shot(page)) === (await shot(page))).toBe(true)
    const original = await shot(page)
    await openPanel(page)
    const shots = [original]
    for (const name of ['纯白', '纯黑', '浅米色']) {
      await openPanel(page)
      await page.getByRole('button', { name }).click()
      shots.push(await shot(page))
    }
    expect(new Set(shots).size).toBe(4)
    await openPanel(page)
    await page.getByRole('button', { name: '恢复默认' }).click()
    await expect.poll(() => shot(page)).toBe(original)
  })

  test('a white background really is white, with no dark vignette over it', async ({ page }) => {
    await openPanel(page)
    await page.getByRole('button', { name: '纯白' }).click()
    await page.getByRole('button', { name: '网格', exact: true }).click()
    await page.getByRole('button', { name: '坐标轴' }).click()
    await closePanel(page)
    await page.mouse.move(0, 0)
    const box = await canvas(page).boundingBox()
    if (!box) throw new Error('no canvas')
    // 取画布右上角附近的一个像素(波形区的空白处): 有暗角覆盖层时这里会发灰
    const shot = await page.screenshot({ clip: { x: box.x + box.width - 12, y: box.y + 12, width: 1, height: 1 } })
    const pixel = await page.evaluate(async (dataUrl) => {
      const image = new Image()
      image.src = dataUrl
      await image.decode()
      const probe = document.createElement('canvas')
      probe.width = probe.height = 1
      const ctx = probe.getContext('2d')
      ctx?.drawImage(image, 0, 0)
      return Array.from(ctx?.getImageData(0, 0, 1, 1).data ?? [])
    }, `data:image/png;base64,${shot.toString('base64')}`)
    expect(pixel.slice(0, 3)).toEqual([255, 255, 255])
  })

  test('typed hex values are validated and normalised', async ({ page }) => {
    await openPanel(page)
    const field = page.getByRole('textbox', { name: '十六进制颜色值' })
    await page.getByRole('button', { name: '纯黑' }).click()
    await field.fill('red')
    await field.press('Enter')
    await expect(page.getByRole('alert')).toContainText('#RRGGBB')
    // 非法输入不改变背景: 输入框回到上一个有效值, 色块仍指向纯黑
    await expect(field).toHaveValue('#000000')
    await expect(page.getByRole('button', { name: '纯黑' })).toHaveAttribute('aria-pressed', 'true')
    await field.fill('#FFF')
    await field.press('Enter')
    await expect(field).toHaveValue('#ffffff')
  })

  test('the panel outside the canvas does not change with the background', async ({ page }) => {
    const panelColor = () =>
      page.locator('.components-panel').evaluate((element) => getComputedStyle(element.parentElement as Element).backgroundColor)
    const before = await panelColor()
    await openPanel(page)
    await page.getByRole('button', { name: '纯白' }).click()
    expect(await panelColor()).toBe(before)
  })
})

test.describe('display options belong to the app', () => {
  test('they survive a reload, do not mark the function unsaved, and are untouched by undo and presets', async ({ page }) => {
    await openPanel(page)
    await page.getByRole('button', { name: '纯白' }).click()
    await page.getByRole('button', { name: '轨迹淡化' }).click()
    await retention(page).selectOption({ label: '30 秒' })
    await page.getByRole('button', { name: '坐标轴' }).click()
    await expect(page.getByText('(有未保存的修改)')).not.toBeAttached()

    await page.getByRole('button', { name: '方波' }).click()
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press(undoShortcut)
    await expect(page.getByRole('button', { name: '坐标轴' })).toHaveAttribute('aria-pressed', 'false')

    await expect
      .poll(() =>
        page.evaluate(async () => {
          const names = (await indexedDB.databases()).map((database) => database.name)
          if (!names.includes('fourier-graphical')) return null
          return new Promise((resolve) => {
            const request = indexedDB.open('fourier-graphical')
            request.onsuccess = () => {
              const db = request.result
              if (!db.objectStoreNames.contains('keyval')) return resolve(null)
              const get = db.transaction('keyval').objectStore('keyval').get('draft')
              get.onsuccess = () => {
                db.close()
                resolve(get.result?.view?.background ?? null)
              }
            }
          })
        }),
      )
      .toBe('#ffffff')

    await page.reload()
    await openPanel(page)
    await expect(retention(page)).toHaveValue('30')
    await expect(page.getByRole('textbox', { name: '十六进制颜色值' })).toHaveValue('#ffffff')
    await expect(page.getByRole('button', { name: '坐标轴' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('a draft written before this feature opens with grid and axes both following the old grid switch', async ({ page }) => {
    await page.getByRole('button', { name: '网格', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise((resolve) => {
              const request = indexedDB.open('fourier-graphical')
              request.onsuccess = () => {
                const db = request.result
                if (!db.objectStoreNames.contains('keyval')) return resolve(false)
                const store = db.transaction('keyval', 'readwrite').objectStore('keyval')
                const get = store.get('draft')
                get.onsuccess = () => {
                  const draft = get.result
                  if (!draft || draft.view.showGrid !== false) return resolve(false)
                  // 抹掉新字段, 伪造成功能 001 写出的草稿
                  const { showAxes, trailFade, trailRetention, background, ...oldView } = draft.view
                  void [showAxes, trailFade, trailRetention, background]
                  store.put({ ...draft, view: oldView }, 'draft').onsuccess = () => {
                    db.close()
                    resolve(true)
                  }
                }
              }
            }),
        ),
      )
      .toBe(true)
    await page.goto('about:blank')
    await page.goto('/')
    await expect(page.getByRole('button', { name: '网格', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: '坐标轴' })).toHaveAttribute('aria-pressed', 'false')
  })
})
