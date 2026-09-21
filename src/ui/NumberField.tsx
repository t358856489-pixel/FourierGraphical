import { useId, useState, type KeyboardEvent } from 'react'
import { formatValue } from '../core/ranges'
import type { Range } from '../core/types'
import './number-field.css'

interface NumberFieldProps {
  readonly label: string
  readonly value: number
  readonly range: Range
  readonly onCommit: (value: number) => void
  readonly hideLabel?: boolean
  readonly disabled?: boolean
}

const validate = (text: string, range: Range): { value: number } | { error: string } => {
  const value = Number(text.trim())
  if (text.trim() === '' || !Number.isFinite(value)) return { error: '请输入数字' }
  if (value < range.min || value > range.max) {
    return { error: `允许范围为 ${range.min} 到 ${range.max}${range.unit}` }
  }
  return { value }
}

/** 带校验的数值输入 (FR-005): 非法输入给出原因并恢复上一个有效值 */
export function NumberField({
  label,
  value,
  range,
  onCommit,
  hideLabel = false,
  disabled = false,
}: NumberFieldProps) {
  const id = useId()
  const formatted = formatValue(value, range.step)
  // draft 只在用户输入期间存在; 提交后回到 null, 显示值永远取自 value 属性.
  // 这样所有者拒绝某个值(value 不变)时, 输入框自然回到有效值, 撤销与播放中的变化也无需同步.
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const commit = (text: string) => {
    setDraft(null)
    const result = validate(text, range)
    if ('error' in result) return setError(result.error)
    setError(null)
    if (result.value !== value) onCommit(result.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit(draft ?? formatted)
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const direction = event.key === 'ArrowUp' ? 1 : -1
    const next = Math.min(range.max, Math.max(range.min, value + direction * range.step))
    commit(String(next))
  }

  return (
    <div className="number-field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'number-field__label'}>
        {label}
      </label>
      <div className="number-field__box">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="number-field__input"
          value={draft ?? formatted}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft !== null && commit(draft)}
          onKeyDown={handleKeyDown}
        />
        {range.unit && <span className="number-field__unit">{range.unit}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} className="number-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
