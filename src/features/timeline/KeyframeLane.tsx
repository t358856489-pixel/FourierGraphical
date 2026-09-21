import { memo, type KeyboardEvent, type PointerEvent } from 'react'
import { formatValue, PARAM_LABELS, quantizeTime, rangeOf } from '../../core/ranges'
import type { HarmonicComponent, Keyframe, ParamName } from '../../core/types'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useViewStore } from '../../state/viewStore'
import { showError } from '../../ui/toastStore'
import { useKeyframeSelection, type KeyframeRef } from './selectionStore'
import './keyframe-lane.css'

const PARAMS: readonly ParamName[] = ['amplitude', 'frequency', 'phase']
const COARSE_NUDGE_SECONDS = 0.1
const FINE_NUDGE_SECONDS = 0.001

interface MarkerProps {
  readonly component: HarmonicComponent
  readonly componentIndex: number
  readonly param: ParamName
  readonly keyframe: Keyframe
  readonly end: number
}

function KeyframeMarker({ component, componentIndex, param, keyframe, end }: MarkerProps) {
  const { moveKeyframe, removeKeyframe, commitEdit } = useDocumentStore.getState()
  const select = useKeyframeSelection((state) => state.select)
  const isSelected = useKeyframeSelection(
    (state) =>
      state.selected?.componentId === component.id &&
      state.selected.param === param &&
      state.selected.time === keyframe.time,
  )
  const ref: KeyframeRef = { componentId: component.id, param, time: keyframe.time }

  const moveFrom = (from: number, to: number, mode: 'preview' | 'commit'): number | null => {
    const target = quantizeTime(Math.max(0, to))
    const result = moveKeyframe(component.id, param, from, target, mode)
    if (!result.ok) {
      showError(result.error.message)
      return null
    }
    select({ ...ref, time: target })
    return target
  }

  // 方向键归关键帧所有: preventDefault 让全局的"单步时间"快捷键让路 (章程原则 IV)
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nudge = event.shiftKey ? FINE_NUDGE_SECONDS : COARSE_NUDGE_SECONDS
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveFrom(keyframe.time, keyframe.time + (event.key === 'ArrowRight' ? nudge : -nudge), 'commit')
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeKeyframe(component.id, param, keyframe.time)
      select(null)
    }
  }

  // 拖动状态取自 store 而非本组件: 指针捕获所在的节点在越过其他关键帧后会改为渲染另一个关键帧
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const { dragging, setDragging } = useKeyframeSelection.getState()
    if (!dragging || dragging.componentId !== component.id || dragging.param !== param) return
    const lane = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!lane || lane.width === 0) return
    const moved = moveFrom(dragging.time, ((event.clientX - lane.left) / lane.width) * end, 'preview')
    if (moved !== null) setDragging({ ...dragging, time: moved })
  }

  const label = `分量 ${componentIndex + 1} ${PARAM_LABELS[param]}关键帧, ${keyframe.time.toFixed(3)} 秒, 值 ${formatValue(keyframe.value, rangeOf(param).step)}`

  return (
    <button
      type="button"
      className="keyframe"
      data-keyframe
      aria-label={label}
      aria-pressed={isSelected}
      style={{ left: `${(Math.min(keyframe.time, end) / end) * 100}%`, color: `var(--component-${component.color})` }}
      onClick={() => {
        select(ref)
        usePlaybackStore.getState().seek(keyframe.time)
      }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        useKeyframeSelection.getState().setDragging(ref)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        useKeyframeSelection.getState().setDragging(null)
        commitEdit()
      }}
      onPointerCancel={() => {
        useKeyframeSelection.getState().setDragging(null)
        commitEdit()
      }}
    />
  )
}

/** 关键帧轨道 (FR-018d): 每个"分量 × 已动画参数"一行; 停用的分量不显示 */
export const KeyframeLane = memo(function KeyframeLane({ end }: { readonly end: number }) {
  const components = useDocumentStore((state) => selectFunction(state).components)
  const selectedComponentId = useViewStore((state) => state.selectedComponentId)
  const lanes = components.flatMap((component, componentIndex) =>
    component.enabled
      ? PARAMS.filter((param) => component[param].kind === 'animated').map((param) => ({
          component,
          componentIndex,
          param,
        }))
      : [],
  )
  if (lanes.length === 0) return null

  return (
    <ul className="keyframe-lanes" aria-label="关键帧">
      {lanes.map(({ component, componentIndex, param }) => {
        const track = component[param]
        return (
          <li
            key={`${component.id}-${param}`}
            className="keyframe-lane"
            data-selected={selectedComponentId === component.id}
          >
            <span className="keyframe-lane__name">
              {componentIndex + 1} · {PARAM_LABELS[param]}
            </span>
            <div className="keyframe-lane__track">
              {track.kind === 'animated' &&
                track.keyframes.map((keyframe, index) => (
                  <KeyframeMarker
                    // 不能用 time 作 key: 拖动会改变它, 导致节点重建、指针捕获丢失
                    key={index}
                    component={component}
                    componentIndex={componentIndex}
                    param={param}
                    keyframe={keyframe}
                    end={end}
                  />
                ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
})
