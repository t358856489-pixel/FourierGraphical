import { useRef } from 'react'
import type { Range } from '../core/types'
import './slider.css'

interface SliderProps {
  readonly label: string
  readonly value: number
  readonly range: Range
  /** 拖动过程中持续触发 */
  readonly onInput: (value: number) => void
  /** 一次拖动或键盘操作结束时触发一次, 用于"一次拖拽 = 一步撤销" */
  readonly onCommit: () => void
  readonly accentColor?: string
  readonly disabled?: boolean
}

export function Slider({
  label,
  value,
  range,
  onInput,
  onCommit,
  accentColor,
  disabled = false,
}: SliderProps) {
  const isDirty = useRef(false)
  const clamped = Math.min(range.max, Math.max(range.min, value))

  const finish = () => {
    if (!isDirty.current) return
    isDirty.current = false
    onCommit()
  }

  return (
    <input
      type="range"
      className="slider"
      aria-label={label}
      min={range.min}
      max={range.max}
      step={range.step}
      value={clamped}
      disabled={disabled}
      style={accentColor ? { accentColor } : undefined}
      onChange={(event) => {
        isDirty.current = true
        onInput(Number(event.target.value))
      }}
      onPointerUp={finish}
      onKeyUp={finish}
      onBlur={finish}
    />
  )
}
