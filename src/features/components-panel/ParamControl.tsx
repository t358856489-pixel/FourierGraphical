import { evaluate } from '../../core/keyframes'
import { ALIASING_WARNING_FREQUENCY, MAX_KEYFRAMES, PARAM_LABELS, SLIDER_RANGES, rangeOf } from '../../core/ranges'
import type { HarmonicComponent, ParamName } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { NumberField } from '../../ui/NumberField'
import { Slider } from '../../ui/Slider'
import { showError } from '../../ui/toastStore'
import './param-control.css'

interface ParamControlProps {
  readonly component: HarmonicComponent
  readonly index: number
  readonly param: ParamName
}

export function ParamControl({ component, index, param }: ParamControlProps) {
  const track = component[param]
  // 固定值与时间无关: 只有已动画的参数才订阅时间, 避免 60fps 下重渲染整个面板
  const time = usePlaybackStore((state) => (track.kind === 'animated' ? state.time : 0))
  const setParamValue = useDocumentStore((state) => state.setParamValue)
  const commitEdit = useDocumentStore((state) => state.commitEdit)
  const addKeyframe = useDocumentStore((state) => state.addKeyframe)
  const isAnimated = track.kind === 'animated'
  const isFull = isAnimated && track.keyframes.length >= MAX_KEYFRAMES
  const value = evaluate(track, time)
  const label = `分量 ${index + 1} ${PARAM_LABELS[param]}`

  const change = (next: number, mode: 'preview' | 'commit') => {
    const at = usePlaybackStore.getState().time
    const result = setParamValue(component.id, param, next, at, mode)
    if (!result.ok) showError(result.error.message)
  }

  const handleAddKeyframe = () => {
    const result = addKeyframe(component.id, param, usePlaybackStore.getState().time)
    if (!result.ok) showError(result.error.message)
  }
  const showsAliasingHint = param === 'frequency' && Math.abs(value) > ALIASING_WARNING_FREQUENCY

  return (
    <div className="param-control" data-animated={isAnimated}>
      <span className="param-control__name" aria-hidden="true">
        {PARAM_LABELS[param]}
      </span>
      <Slider
        label={label}
        value={value}
        range={SLIDER_RANGES[param]}
        accentColor={`var(--component-${component.color})`}
        disabled={!component.enabled}
        onInput={(next) => change(next, 'preview')}
        onCommit={commitEdit}
      />
      <NumberField
        label={`${label}数值`}
        hideLabel
        value={value}
        range={rangeOf(param)}
        disabled={!component.enabled}
        onCommit={(next) => change(next, 'commit')}
      />
      <button
        type="button"
        className="param-control__keyframe"
        aria-label={`在当前时刻为${label}添加关键帧${isAnimated ? '(已动画)' : ''}`}
        title={isFull ? `每个参数最多 ${MAX_KEYFRAMES} 个关键帧` : '在当前时刻添加关键帧'}
        disabled={!component.enabled || isFull}
        onClick={handleAddKeyframe}
      >
        <span aria-hidden="true">◆</span>
      </button>
      {showsAliasingHint && (
        <p className="param-control__hint">
          频率高于 {ALIASING_WARNING_FREQUENCY} 圈/秒时, 旋转向量会因屏幕刷新率出现视觉混叠;
          轨迹与波形不受影响, 可降低播放速度观察.
        </p>
      )}
    </div>
  )
}
