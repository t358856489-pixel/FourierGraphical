import { expect, test, type Page } from '@playwright/test'
import {
  componentCount,
  expressionButton,
  expressionPanel,
  expressionTerms,
  expressionText,
  openExpression,
  openPaused,
  setNumber,
} from './helpers'

const applySquare = async (page: Page, count = 5) => {
  await page.getByRole('button', { name: '方波' }).click()
  if (count !== 5) await page.getByRole('slider', { name: '预设分量个数' }).fill(String(count))
  await expect.poll(() => componentCount(page)).toBe(count)
}

test.describe('story 1: viewing the expression', () => {
  test('the five square-wave terms match the component list and follow edits (FR-002/004/005/007)', async ({
    page,
  }) => {
    await openPaused(page)
    await applySquare(page)
    await openExpression(page)
    await expect(expressionButton(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(expressionTerms(page)).toHaveCount(5)

    // 第 1 项的振幅与分量面板第 1 行的数值框一致
    const amplitude = await page.getByRole('textbox', { name: '分量 1 振幅数值' }).inputValue()
    await expect(expressionTerms(page).first()).toContainText(
      Number(amplitude).toFixed(4).replace(/0+$/, ''),
    )
    await expect(expressionTerms(page).first()).toContainText('0.2')
    // 示例函数是波形模式 → 默认波形写法
    await expect(expressionPanel(page).getByRole('radio', { name: '波形' })).toBeChecked()
    expect(await expressionText(page)).toContain('y(t) = ')

    await setNumber(page, '分量 2 相位数值', '90')
    await expect(expressionTerms(page).nth(1)).toContainText('90°')

    await page.locator('.component-row').nth(2).getByRole('checkbox').uncheck()
    await expect(expressionTerms(page)).toHaveCount(4)
    await expect(expressionPanel(page)).toContainText('已排除 1 个停用分量')

    // 切换写法
    await expressionPanel(page).getByRole('radio', { name: '复数形式' }).check()
    expect(await expressionText(page)).toContain('z(t) = ')
    expect(await expressionText(page)).toContain('e^{i(')
  })

  test('a snowflake and a 200-term sawtooth render completely within a second (FR-014)', async ({
    page,
  }) => {
    await openPaused(page)
    await page.getByRole('button', { name: '图形', exact: true }).click()
    await page.getByRole('button', { name: '雪花' }).click()
    await page.getByRole('button', { name: '关闭' }).click()
    const snowflakeCount = await componentCount(page)
    expect(snowflakeCount).toBeGreaterThan(100)
    expect(snowflakeCount).toBeLessThanOrEqual(150)

    const started = Date.now()
    await openExpression(page)
    await expect(expressionTerms(page)).toHaveCount(snowflakeCount)
    expect(Date.now() - started).toBeLessThan(1000)
    await expressionTerms(page).last().scrollIntoViewIfNeeded()
    await expect(expressionTerms(page).last()).toBeInViewport()

    await page.getByRole('button', { name: '锯齿波' }).click()
    await page.getByRole('slider', { name: '预设分量个数' }).fill('200')
    await expect.poll(() => componentCount(page)).toBe(200)
    await expect(expressionTerms(page)).toHaveCount(200)
    // 应用图形后处于二维绘图模式 → 复数写法; 按项的记法计数, 与写法无关
    expect(((await expressionText(page)).match(/·(e\^\{|sin\(|cos\()/g) ?? []).length).toBe(200)
  })

  test('an empty function shows the empty state', async ({ page }) => {
    await openPaused(page)
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '删除分量 1' }).click()
    await openExpression(page)
    await expect(expressionPanel(page)).toContainText('当前没有启用的分量')
    await expect(expressionPanel(page).getByRole('button', { name: '复制' })).toBeDisabled()
  })
})

test.describe('story 2: copying', () => {
  /** 三个浏览器都用桩捕获写入; 真剪贴板只在 Chromium 验证 */
  const stubClipboard = (page: Page, reject = false) =>
    page.addInitScript((shouldReject) => {
      const stub = {
        writeText: (text: string) => {
          if (shouldReject) return Promise.reject(new DOMException('denied', 'NotAllowedError'))
          ;(window as unknown as { __copied?: string }).__copied = text
          return Promise.resolve()
        },
      }
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: stub })
    }, reject)
  const copied = (page: Page) =>
    page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? null)

  test('the copied text equals the panel text and a toast confirms it (SC-001: two interactions)', async ({
    page,
  }) => {
    await stubClipboard(page)
    await openPaused(page)
    await applySquare(page)
    await openExpression(page) // 1
    await expressionPanel(page).getByRole('button', { name: '复制' }).click() // 2
    await expect(page.getByLabel('提示')).toContainText('已复制 5 项')
    expect(await copied(page)).toBe(await expressionText(page))
    expect(await copied(page)).toContain('y(t) = ')
  })

  test('the real clipboard receives the text', async ({ page, context, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'only Chromium grants clipboard permissions in Playwright',
    )
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openPaused(page)
    await applySquare(page)
    await openExpression(page)
    await expressionPanel(page).getByRole('button', { name: '复制' }).click()
    await expect(page.getByLabel('提示')).toContainText('已复制')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await expressionText(page),
    )
  })

  test('a refused clipboard falls back to a pre-selected textarea (FR-011)', async ({ page }) => {
    await stubClipboard(page, true)
    await openPaused(page)
    await applySquare(page)
    await openExpression(page)
    await expressionPanel(page).getByRole('button', { name: '复制' }).click()
    await expect(expressionPanel(page).getByRole('alert')).toContainText('浏览器不允许')
    const textarea = expressionPanel(page).getByRole('textbox', { name: '表达式文本' })
    await expect(textarea).toBeFocused()
    await expect(textarea).toHaveValue(await expressionText(page))
    expect(
      await textarea.evaluate((el) => {
        const field = el as HTMLTextAreaElement
        return field.selectionStart === 0 && field.selectionEnd === field.value.length
      }),
    ).toBe(true)
  })
})

test.describe('story 3: LaTeX format', () => {
  const stubClipboard = (page: Page) =>
    page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            ;(window as unknown as { __copied?: string }).__copied = text
            return Promise.resolve()
          },
        },
      })
    })
  const copied = (page: Page) =>
    page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '')

  test('LaTeX copies render-ready aligned blocks and the choice is session-only', async ({
    page,
  }) => {
    await stubClipboard(page)
    await openPaused(page)
    await applySquare(page)
    await openExpression(page)
    const panel = expressionPanel(page)
    await panel.getByRole('radio', { name: 'LaTeX' }).check()
    await panel.getByRole('button', { name: '复制' }).click()
    let latex = await copied(page)
    // 5 项且含精度说明 → gathered 包着 aligned
    expect(latex.startsWith('\\begin{gathered}')).toBe(true)
    expect(latex).toContain('\\begin{aligned}')
    expect((latex.match(/\\cdot/g) ?? []).length).toBe(5 * 2)
    expect(latex).toContain('^\\circ')

    await panel.getByRole('radio', { name: '参数方程' }).check()
    await panel.getByRole('button', { name: '复制' }).click()
    latex = await copied(page)
    expect((latex.match(/\\begin\{aligned\}/g) ?? []).length).toBe(2)

    // 刷新后格式回到纯文本(会话偏好不保存)
    await page.reload()
    await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible()
    await openExpression(page)
    await expect(expressionPanel(page).getByRole('radio', { name: '纯文本' })).toBeChecked()
  })
})
