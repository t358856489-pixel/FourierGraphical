import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buildExpression } from '../../core/expression/build'
import { toLatex } from '../../core/expression/latex'
import { toPlainText } from '../../core/expression/plainText'
import type { CopyFormat, Notation } from '../../core/expression/types'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { effectiveNotation, useExpressionStore } from '../../state/expressionStore'
import { showInfo } from '../../ui/toastStore'
import { formatTime } from '../transport/TimeReadout'
import { copyText } from './copyText'
import { ExpressionTerms } from './ExpressionTerms'
import { useAnimatedTime } from './useAnimatedTime'
import './expression.css'

export const EXPRESSION_PANEL_ID = 'expression-panel'

const NOTATIONS: readonly (readonly [Notation, string])[] = [
  ['complex', '复数形式'],
  ['parametric', '参数方程'],
  ['waveform', '波形'],
]

const FORMATS: readonly (readonly [CopyFormat, string])[] = [
  ['plain', '纯文本'],
  ['latex', 'LaTeX'],
]

interface ExpressionPanelProps {
  /** 用户在面板内按 Esc: 收起并把焦点还给切换按钮 */
  readonly onCollapse: () => void
}

/**
 * 表达式折叠面板 (specs/004 US1): 非模态, 随函数即时更新; 含动画参数时按节流后的播放时刻取值.
 */
export function ExpressionPanel({ onCollapse }: ExpressionPanelProps) {
  const fn = useDocumentStore(selectFunction)
  const prefs = useExpressionStore()
  const notation = effectiveNotation(prefs, fn.presentationMode)
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)

  const hasAnimated = useMemo(
    () =>
      fn.components.some(
        (c) =>
          c.enabled &&
          (c.amplitude.kind === 'animated' ||
            c.frequency.kind === 'animated' ||
            c.phase.kind === 'animated'),
      ),
    [fn],
  )
  const displayTime = useAnimatedTime(hasAnimated)
  const expression = useMemo(() => buildExpression(fn, displayTime), [fn, displayTime])
  const plain = useMemo(() => toPlainText(expression, notation), [expression, notation])
  // 读屏版本: 按项标注含动画参数的项 (FR-012a / FR-013)
  const readable = useMemo(
    () => toPlainText(expression, notation, { annotateAnimated: true }),
    [expression, notation],
  )
  const isEmpty = expression.terms.length === 0
  /** 剪贴板不可用时的回退: 说明 + 已全选的文本框 (FR-011) */
  const [fallback, setFallback] = useState<{ text: string; message: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!fallback) return
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [fallback])

  const handleCopy = async () => {
    const text = prefs.format === 'latex' ? toLatex(expression, notation) : plain
    const result = await copyText(text)
    if (result.ok) {
      setFallback(null)
      showInfo(`已复制 ${expression.terms.length} 项的表达式`)
      return
    }
    setFallback({ text, message: result.error.message })
  }

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Esc 收起: 用原生监听而不是 <section onKeyDown>, 区块本身不是交互元素 (jsx-a11y)
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCollapse()
    }
    section.addEventListener('keydown', handleKeyDown)
    return () => section.removeEventListener('keydown', handleKeyDown)
  }, [onCollapse])

  return (
    <section
      id={EXPRESSION_PANEL_ID}
      ref={sectionRef}
      className="expression-panel"
      aria-labelledby={headingId}
    >
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="nameplate expression-panel__title"
      >
        表达式
      </h3>

      <div className="expression-panel__controls">
        <fieldset className="expression-panel__choice">
          <legend className="nameplate">写法</legend>
          {NOTATIONS.map(([value, label]) => (
            <label key={value} className="expression-panel__radio">
              <input
                type="radio"
                name="expression-notation"
                value={value}
                checked={notation === value}
                onChange={() => prefs.setNotation(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="expression-panel__choice">
          <legend className="nameplate">格式</legend>
          {FORMATS.map(([value, label]) => (
            <label key={value} className="expression-panel__radio">
              <input
                type="radio"
                name="expression-format"
                value={value}
                checked={prefs.format === value}
                onChange={() => prefs.setFormat(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="button" disabled={isEmpty} onClick={handleCopy}>
          复制
        </button>
      </div>

      {fallback && (
        <>
          <p role="alert" className="expression-panel__alert">
            {fallback.message}
          </p>
          <textarea
            ref={textareaRef}
            className="expression-panel__fallback"
            aria-label="表达式文本"
            readOnly
            value={fallback.text}
          />
        </>
      )}

      {expression.excludedCount > 0 && (
        <p className="expression-panel__note">已排除 {expression.excludedCount} 个停用分量</p>
      )}
      {expression.hasAnimated && (
        <p className="expression-panel__note expression-panel__note--animated">
          含动画参数, 按 t = {formatTime(expression.time)} 取值
        </p>
      )}
      {expression.isRounded && <p className="expression-panel__note">显示精度 4 位小数</p>}

      {isEmpty ? (
        <p className="expression-panel__empty">当前没有启用的分量</p>
      ) : (
        <div className="expression-panel__scroll">
          <ExpressionTerms expression={expression} notation={notation} />
        </div>
      )}
      <p className="visually-hidden" data-testid="expression-plain">
        {readable}
      </p>
    </section>
  )
}
