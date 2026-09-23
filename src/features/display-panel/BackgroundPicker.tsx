import { useId, useState } from 'react'
import { parseColor, toHex } from '../../core/color'
import { BACKGROUND_PRESETS } from '../../core/ranges'
import { useViewStore } from '../../state/viewStore'

const DEFAULT_TOKEN = '--screen-bg'
const FALLBACK_HEX = '#0f1a16'

/** 原生取色器只认 #rrggbb: 默认背景是 oklch 令牌, 换算成十六进制给它显示 */
const defaultHex = (): string => {
  const token = getComputedStyle(document.documentElement).getPropertyValue(DEFAULT_TOKEN).trim()
  const parsed = parseColor(token)
  return parsed.ok ? toHex(parsed.value) : FALLBACK_HEX
}

/** 画布背景色 (FR-014–017, FR-020): 预置色块、取色器、十六进制输入、恢复默认 */
export function BackgroundPicker() {
  const background = useViewStore((state) => state.background)
  const setBackground = useViewStore((state) => state.setBackground)
  // 草稿只在输入期间存在; 提交后显示值取自 store, 被拒绝的输入自然回到上一个有效值
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const shown = background ?? defaultHex()

  const commit = (text: string) => {
    setDraft(null)
    const result = setBackground(text)
    setError(result.ok ? null : result.error.message)
  }
  const choose = (value: string | null) => {
    setDraft(null)
    setError(null)
    setBackground(value)
  }

  return (
    <section className="display-panel__section" aria-labelledby="display-background-heading">
      <h3 id="display-background-heading" className="nameplate">
        背景
      </h3>
      <div className="background-picker__presets" role="group" aria-label="预置背景色">
        {BACKGROUND_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="background-picker__swatch"
            aria-label={preset.name}
            aria-pressed={background === preset.value}
            title={preset.name}
            style={{ background: preset.value ?? `var(${DEFAULT_TOKEN})` }}
            onClick={() => choose(preset.value)}
          />
        ))}
      </div>
      <div className="background-picker__custom">
        <input
          type="color"
          aria-label="取色"
          className="background-picker__color"
          value={shown}
          onChange={(event) => choose(event.target.value)}
        />
        <input
          type="text"
          aria-label="十六进制颜色值"
          className="background-picker__hex mono"
          spellCheck={false}
          autoComplete="off"
          value={draft ?? shown}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft !== null && commit(draft)}
          onKeyDown={(event) => event.key === 'Enter' && commit(draft ?? shown)}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="background-picker__error">
          {error}
        </p>
      )}
      <button type="button" className="button" disabled={background === null} onClick={() => choose(null)}>
        恢复默认
      </button>
    </section>
  )
}
