import { memo } from 'react'
import { findComponent } from '../../core/function'
import { PARAM_LABELS, rangeOf } from '../../core/ranges'
import { keyframeAt } from '../../core/tracks'
import type { Easing, Range } from '../../core/types'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { NumberField } from '../../ui/NumberField'
import { showError } from '../../ui/toastStore'
import { useKeyframeSelection } from './selectionStore'
import './keyframe-inspector.css'

const TIME_RANGE: Range = { min: 0, max: 1e6, step: 0.001, unit: '秒' }

const EASINGS: readonly { readonly easing: Easing; readonly label: string; readonly path: string }[] = [
  { easing: 'linear', label: '匀速', path: 'M2 14 L22 2' },
  { easing: 'smooth', label: '缓入缓出', path: 'M2 14 C12 14 12 2 22 2' },
  { easing: 'hold', label: '保持', path: 'M2 14 L22 14 L22 2' },
]

export const KeyframeInspector = memo(function KeyframeInspector() {
  const selected = useKeyframeSelection((state) => state.selected)
  const select = useKeyframeSelection((state) => state.select)
  const fn = useDocumentStore(selectFunction)
  const { moveKeyframe, removeKeyframe, setKeyframeEasing, setParamValue } =
    useDocumentStore.getState()
  if (!selected) return null
  const component = findComponent(fn, selected.componentId)
  const keyframe = component && keyframeAt(component[selected.param], selected.time)
  if (!component || !keyframe) return null
  const { componentId, param, time } = selected
  const index = fn.components.indexOf(component)

  const report = (result: { ok: boolean; error?: { message: string } }) => {
    if (!result.ok && result.error) showError(result.error.message)
    return result.ok
  }

  return (
    <fieldset className="keyframe-inspector">
      <legend className="nameplate">
        关键帧 · 分量 {index + 1} {PARAM_LABELS[param]}
      </legend>
      <NumberField
        label="时刻"
        value={keyframe.time}
        range={TIME_RANGE}
        onCommit={(to) => {
          if (report(moveKeyframe(componentId, param, time, to, 'commit'))) {
            select({ componentId, param, time: to })
          }
        }}
      />
      <NumberField
        label="值"
        value={keyframe.value}
        range={rangeOf(param)}
        onCommit={(value) => report(setParamValue(componentId, param, value, time, 'commit'))}
      />
      <div className="keyframe-inspector__easing" role="radiogroup" aria-label="到下一关键帧的过渡方式">
        {EASINGS.map((option) => (
          <label key={option.easing} className="keyframe-inspector__option">
            <input
              type="radio"
              name="keyframe-easing"
              className="visually-hidden"
              checked={keyframe.easing === option.easing}
              onChange={() => report(setKeyframeEasing(componentId, param, time, option.easing))}
            />
            <svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true">
              <path d={option.path} fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="button button--danger"
        onClick={() => {
          report(removeKeyframe(componentId, param, time))
          select(null)
        }}
      >
        删除关键帧
      </button>
    </fieldset>
  )
})
