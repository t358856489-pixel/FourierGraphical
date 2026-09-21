import { useState } from 'react'
import type { LoopRegion, Range } from '../../core/types'
import { usePlaybackStore } from '../../state/playbackStore'
import { NumberField } from '../../ui/NumberField'
import { Toggle } from '../../ui/Toggle'

const BOUND_RANGE: Range = { min: 0, max: 1e6, step: 0.01, unit: '秒' }
const DEFAULT_LOOP_SECONDS = 5

/** 手动循环区间 (FR-017): 非法区间被拒绝并说明原因, 保留上一个有效区间 */
export function LoopRegionEditor() {
  const loop = usePlaybackStore((state) => state.loop)
  const setLoop = usePlaybackStore((state) => state.setLoop)
  const [error, setError] = useState<string | null>(null)

  const apply = (region: LoopRegion) => {
    const result = setLoop(region)
    setError(result.ok ? null : result.error.message)
  }

  const toggle = (enabled: boolean) => {
    const time = usePlaybackStore.getState().time
    apply(loop ? { ...loop, enabled } : { start: time, end: time + DEFAULT_LOOP_SECONDS, enabled })
  }

  return (
    <div className="transport__loop" role="group" aria-label="循环区间">
      <Toggle label="循环" pressed={loop?.enabled ?? false} onChange={toggle} />
      {loop && (
        <>
          <NumberField
            label="循环起点"
            value={loop.start}
            range={BOUND_RANGE}
            onCommit={(start) => apply({ ...loop, start })}
          />
          <NumberField
            label="循环终点"
            value={loop.end}
            range={BOUND_RANGE}
            onCommit={(end) => apply({ ...loop, end })}
          />
        </>
      )}
      {error && (
        <p className="transport__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
