import { useState } from 'react'
import { PRESETS, type PresetId } from '../../core/presets'
import { MAX_COMPONENTS } from '../../core/ranges'
import type { Range } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { Slider } from '../../ui/Slider'
import { showError } from '../../ui/toastStore'
import { useOverwriteGuard } from '../shapes/useOverwriteGuard'
import './presets.css'

const COUNT_RANGE: Range = { min: 1, max: MAX_COMPONENTS, step: 1, unit: '' }
const DEFAULT_COUNT = 5

const THUMBNAILS: Readonly<Record<PresetId, string>> = {
  square: 'M2 14 V4 H14 V14 H26 V4',
  sawtooth: 'M2 14 L14 4 V14 L26 4',
  triangle: 'M2 14 L8 4 L20 14 L26 4',
}

/** 预设波形 (FR-019/020): 选择即应用; 会覆盖未保存修改时先确认 */
export function PresetPicker() {
  const [active, setActive] = useState<PresetId | null>(null)
  const [count, setCount] = useState(DEFAULT_COUNT)
  const { guard, markGenerated, dialog } = useOverwriteGuard({
    title: '替换当前函数?',
    message: '应用预设会替换全部分量, 它们的关键帧和尚未保存的修改都会被丢弃. 之后仍可用撤销恢复.',
    confirmLabel: '替换',
  })
  const { applyPreset, commitEdit } = useDocumentStore.getState()

  const apply = (preset: PresetId, nextCount: number, mode: 'preview' | 'commit') => {
    const result = applyPreset(preset, nextCount, mode)
    if (!result.ok) return showError(result.error.message)
    setActive(preset)
    markGenerated(result.value)
  }

  const choose = (preset: PresetId) => guard(() => apply(preset, count, 'commit'))

  return (
    <div className="presets">
      <h3 className="nameplate">预设波形</h3>
      <div className="presets__options" role="group" aria-label="预设波形">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="presets__option"
            aria-pressed={active === preset.id}
            onClick={() => choose(preset.id)}
          >
            <svg viewBox="0 0 28 18" width="28" height="18" aria-hidden="true">
              <path d={THUMBNAILS[preset.id]} fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            {preset.name}
          </button>
        ))}
      </div>
      {active && (
        <div className="presets__count">
          <span className="nameplate">分量个数</span>
          <Slider
            label="预设分量个数"
            value={count}
            range={COUNT_RANGE}
            onInput={(next) => {
              setCount(next)
              apply(active, next, 'preview')
            }}
            onCommit={commitEdit}
          />
          <output className="mono">{count}</output>
        </div>
      )}
      {dialog}
    </div>
  )
}
