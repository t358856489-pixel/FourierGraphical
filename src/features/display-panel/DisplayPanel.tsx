import { useId } from 'react'
import { TRAIL_RETENTION_OPTIONS } from '../../core/ranges'
import { planTrail } from '../../core/trailPlan'
import type { TrailRetention } from '../../core/types'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { selectViewSettings, useViewStore } from '../../state/viewStore'
import { Toggle } from '../../ui/Toggle'
import { BackgroundPicker } from './BackgroundPicker'
import { formatRetention } from './formatRetention'
import './display-panel.css'

const parseRetention = (value: string): TrailRetention =>
  value === 'all' ? 'all' : (Number(value) as TrailRetention)

/** 轨迹的实际保留情况: 只按整秒更新, 不随每一帧重渲染 (章程原则 V) */
function TrailStatus() {
  const fn = useDocumentStore(selectFunction)
  const wholeSecond = usePlaybackStore((state) => Math.floor(state.time))
  const viewState = useViewStore()
  if (viewState.trailFade || fn.presentationMode !== 'drawing2d') return null
  const plan = planTrail(fn, wholeSecond, selectViewSettings(viewState), fn.presentationMode)
  if (plan.isShortened) {
    return (
      <p role="status" className="display-panel__status">
        当前函数频率较高, 为保证轨迹形状正确, 实际保留约 {Math.round(plan.end - plan.start)} 秒.
      </p>
    )
  }
  if (!plan.isCapped) return null
  return (
    <p role="status" className="display-panel__status">
      轨迹已达到 10 分钟保留上限, 更早的部分不再显示.
    </p>
  )
}

function TrailSection() {
  const trailFade = useViewStore((state) => state.trailFade)
  const trailRetention = useViewStore((state) => state.trailRetention)
  const { toggle, setTrailRetention } = useViewStore.getState()
  const hintId = useId()

  return (
    <section className="display-panel__section" aria-labelledby="display-trail-heading">
      <h3 id="display-trail-heading" className="nameplate">
        轨迹
      </h3>
      <Toggle label="轨迹淡化" pressed={trailFade} onChange={() => toggle('trailFade')} />
      <label className="display-panel__field">
        <span className="number-field__label">轨迹保留时长</span>
        <select
          value={String(trailRetention)}
          disabled={trailFade}
          aria-describedby={trailFade ? hintId : undefined}
          onChange={(event) => setTrailRetention(parseRetention(event.target.value))}
        >
          {TRAIL_RETENTION_OPTIONS.map((option) => (
            <option key={option} value={String(option)}>
              {formatRetention(option)}
            </option>
          ))}
        </select>
      </label>
      {trailFade && (
        <p id={hintId} className="display-panel__hint">
          关闭"轨迹淡化"后, 才能选择轨迹保留多久.
        </p>
      )}
      <TrailStatus />
    </section>
  )
}

/** "画面"面板: 原生 <details>, 键盘与读屏行为由浏览器保证 */
export function DisplayPanel() {
  return (
    <details className="display-panel">
      <summary className="button display-panel__summary">画面</summary>
      <div className="display-panel__body">
        <TrailSection />
        <BackgroundPicker />
      </div>
    </details>
  )
}
