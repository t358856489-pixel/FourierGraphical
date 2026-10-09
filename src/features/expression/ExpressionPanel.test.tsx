import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildExpression } from '../../core/expression/build'
import { toLatex } from '../../core/expression/latex'
import { toPlainText } from '../../core/expression/plainText'
import { animated } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { useExpressionStore } from '../../state/expressionStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useToastStore } from '../../ui/toastStore'
import { resetStores } from '../../test/resetStores'
import { ComponentsPanel } from '../components-panel/ComponentsPanel'

const doc = () => useDocumentStore.getState()
const present = () => doc().history.present
const toggle = () => screen.getByRole('button', { name: '表达式' })
const region = () => screen.getByRole('region', { name: '表达式' })
const terms = () => region().querySelectorAll('.expr-term')
const plain = () => screen.getByTestId('expression-plain').textContent
/** 等式行(去掉 # 说明行) */
const equations = () => (plain() ?? '').split('\n').filter((line) => !line.startsWith('#'))

const applySquare = (count = 5) => {
  const result = doc().applyPreset('square', count, 'commit')
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

const open = async () => {
  await userEvent.click(toggle())
  return region()
}

beforeEach(resetStores)

describe('ExpressionPanel: opening and closing (FR-001, FR-013)', () => {
  test('the header button expands a labelled region and moves focus to its heading', async () => {
    render(<ComponentsPanel />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: '表达式' })).not.toBeInTheDocument()
    const panel = await open()
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(toggle()).toHaveAttribute('aria-controls', panel.id)
    expect(within(panel).getByRole('heading', { name: '表达式' })).toHaveFocus()
  })

  test('Escape inside the panel collapses it and returns focus to the button', async () => {
    render(<ComponentsPanel />)
    const panel = await open()
    fireEvent.keyDown(within(panel).getByRole('radio', { name: '波形' }), { key: 'Escape' })
    expect(screen.queryByRole('region', { name: '表达式' })).not.toBeInTheDocument()
    expect(toggle()).toHaveFocus()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('ExpressionPanel: content (FR-002, FR-004, FR-005, FR-007)', () => {
  test('a 5-term square wave renders five coloured terms with the list coefficients', async () => {
    const fn = applySquare()
    render(<ComponentsPanel />)
    await open()
    const items = terms()
    expect(items).toHaveLength(5)
    items.forEach((item, index) => {
      expect(item).toHaveAttribute('data-color', fn.components[index]?.color)
    })
    expect(items[0]).toHaveTextContent('1.2732')
    expect(items[0]).toHaveTextContent('0.2')
    expect(items[0]).toHaveTextContent('0°')
    expect(items[1]).toHaveTextContent('0.4244')
  })

  test('edits, undo and redo update the terms immediately', async () => {
    const fn = applySquare()
    render(<ComponentsPanel />)
    await open()
    const second = fn.components[1]
    if (!second) throw new Error('missing component')
    act(() => {
      doc().setParamValue(second.id, 'phase', 90, 0, 'commit')
    })
    expect(terms()[1]).toHaveTextContent('90°')
    act(() => doc().undo())
    expect(terms()[1]).toHaveTextContent('0°')
    expect(terms()[1]).not.toHaveTextContent('90°')
    act(() => doc().redo())
    expect(terms()[1]).toHaveTextContent('90°')
  })

  test('disabled components are left out and counted', async () => {
    const fn = applySquare()
    render(<ComponentsPanel />)
    await open()
    const third = fn.components[2]
    if (!third) throw new Error('missing component')
    act(() => doc().setEnabled(third.id, false))
    expect(terms()).toHaveLength(4)
    expect(region()).toHaveTextContent('已排除 1 个停用分量')
    expect(plain()).not.toContain('0.2546')
  })

  test('the notation follows the presentation mode until chosen, and the radios switch the structure', async () => {
    applySquare(2)
    render(<ComponentsPanel />)
    const panel = await open()
    // 示例函数是波形模式 → 默认波形写法
    expect(within(panel).getByRole('radio', { name: '波形' })).toBeChecked()
    expect(equations()[0]?.startsWith('y(t) = ')).toBe(true)
    expect(plain()).toContain('·sin(')

    act(() => doc().setPresentationMode('drawing2d'))
    expect(within(panel).getByRole('radio', { name: '复数形式' })).toBeChecked()
    expect(equations()[0]?.startsWith('z(t) = ')).toBe(true)
    expect(plain()).toContain('e^{i(')

    await userEvent.click(within(panel).getByRole('radio', { name: '参数方程' }))
    expect(equations()).toHaveLength(2)
    expect(plain()).toContain('x(t) = ')
    expect(plain()).toContain('y(t) = ')
    // 显式选择后不再跟随模式
    act(() => doc().setPresentationMode('waveform'))
    expect(within(panel).getByRole('radio', { name: '参数方程' })).toBeChecked()
    expect(useExpressionStore.getState().notation).toBe('parametric')
  })

  test('an empty function shows the empty state and disables copying', async () => {
    for (const component of present().components) doc().removeComponent(component.id)
    render(<ComponentsPanel />)
    const panel = await open()
    expect(within(panel).getByText('当前没有启用的分量')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: '复制' })).toBeDisabled()
    expect(terms()).toHaveLength(0)
  })

  test('the visual formula is hidden from assistive tech and a plain-text twin is provided', async () => {
    applySquare(3)
    render(<ComponentsPanel />)
    await open()
    const visual = region().querySelector('.expression')
    expect(visual).toHaveAttribute('aria-hidden', 'true')
    const expected = toPlainText(
      buildExpression(present(), usePlaybackStore.getState().time),
      'waveform',
    )
    expect(plain()).toBe(expected)
    expect(screen.getByTestId('expression-plain')).toHaveClass('visually-hidden')
  })

  test('rounded coefficients are flagged with the precision note', async () => {
    applySquare(2) // 4/π 必然被取整
    render(<ComponentsPanel />)
    await open()
    expect(region()).toHaveTextContent('显示精度 4 位小数')
  })
})

describe('ExpressionPanel: animated parameters (FR-012a)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  test('animated terms are marked, the note shows the time, and values follow playback (throttled)', async () => {
    const fn = applySquare(2)
    const first = fn.components[0]
    if (!first) throw new Error('missing component')
    doc().editTrack(
      first.id,
      'amplitude',
      () => ({
        ok: true,
        value: animated([
          { time: 0, value: 1, easing: 'linear' },
          { time: 10, value: 3, easing: 'linear' },
        ]),
      }),
      'commit',
    )
    usePlaybackStore.getState().seek(0)
    render(<ComponentsPanel />)
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(region()).toHaveTextContent('含动画参数, 按 t = 0.00 取值')
    expect(terms()[0]).toHaveAttribute('data-animated', 'true')
    expect(terms()[1]).not.toHaveAttribute('data-animated', 'true')
    expect(plain()).toContain('[动画]')
    expect(plain()).toBe(
      toPlainText(buildExpression(present(), usePlaybackStore.getState().time), 'waveform', {
        annotateAnimated: true,
      }),
    )
    expect(plain()?.match(/\[动画\]/g)).toHaveLength(1)

    act(() => usePlaybackStore.getState().seek(5))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(region()).toHaveTextContent('按 t = 5.00 取值')
    expect(terms()[0]).toHaveTextContent('2·')
  })
})

describe('ExpressionPanel: copying (US2, FR-009 / FR-010 / FR-011)', () => {
  const stubClipboard = (writeText: ((text: string) => Promise<void>) | undefined) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: writeText ? { writeText } : undefined,
    })
  }
  afterEach(() => stubClipboard(undefined))

  test('copies exactly the plain-text twin and announces it with the term count', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    applySquare()
    render(<ComponentsPanel />)
    const panel = await open()
    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(toPlainText(buildExpression(present(), 0), 'waveform'))
    const toast = useToastStore.getState().messages.at(-1)
    expect(toast?.text).toContain('已复制')
    expect(toast?.text).toContain('5')
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument()
  })

  test('when the clipboard is refused, an alert and a pre-selected textarea appear; a later success clears them', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
      .mockResolvedValue(undefined)
    stubClipboard(writeText)
    applySquare(3)
    render(<ComponentsPanel />)
    const panel = await open()
    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    expect(within(panel).getByRole('alert')).toHaveTextContent('浏览器不允许')
    const textarea = within(panel).getByRole('textbox', {
      name: '表达式文本',
    }) as HTMLTextAreaElement
    expect(textarea.value).toBe(plain())
    expect(textarea).toHaveFocus()
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(textarea.value.length)

    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('textbox', { name: '表达式文本' })).not.toBeInTheDocument()
  })

  test('copying after an edit yields the edited expression', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const fn = applySquare(2)
    render(<ComponentsPanel />)
    const panel = await open()
    const first = fn.components[0]
    if (!first) throw new Error('missing component')
    act(() => {
      doc().setParamValue(first.id, 'phase', 45, 0, 'commit')
    })
    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    expect(writeText.mock.calls[0]?.[0]).toContain('+ 45°')
  })
})

describe('ExpressionPanel: copy format (US3, FR-012)', () => {
  const stubClipboard = (writeText: (text: string) => Promise<void>) => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  }

  test('plain text is the default; choosing LaTeX copies toLatex and is remembered for the session', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    applySquare(3)
    render(<ComponentsPanel />)
    let panel = await open()
    expect(within(panel).getByRole('radio', { name: '纯文本' })).toBeChecked()

    await userEvent.click(within(panel).getByRole('radio', { name: 'LaTeX' }))
    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    const expected = toLatex(buildExpression(present(), 0), 'waveform')
    expect(writeText).toHaveBeenLastCalledWith(expected)
    expect(expected).toContain('\\begin{aligned}')

    // 切换写法后 LaTeX 结构随之变化
    await userEvent.click(within(panel).getByRole('radio', { name: '参数方程' }))
    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    expect(writeText.mock.calls.at(-1)?.[0]).toContain('x(t) =')
    expect(writeText.mock.calls.at(-1)?.[0]).toContain('\\cos(')

    // 收起再展开仍是 LaTeX
    await userEvent.click(toggle())
    panel = await open()
    expect(within(panel).getByRole('radio', { name: 'LaTeX' })).toBeChecked()
    expect(useExpressionStore.getState().format).toBe('latex')
  })

  test('the fallback textarea carries the LaTeX when the clipboard is refused', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')))
    applySquare(2)
    render(<ComponentsPanel />)
    const panel = await open()
    await userEvent.click(within(panel).getByRole('radio', { name: 'LaTeX' }))
    await userEvent.click(within(panel).getByRole('button', { name: '复制' }))
    const textarea = within(panel).getByRole('textbox', {
      name: '表达式文本',
    }) as HTMLTextAreaElement
    expect(textarea.value).toBe(toLatex(buildExpression(present(), 0), 'waveform'))
  })
})
