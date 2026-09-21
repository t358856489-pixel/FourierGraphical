import { SPEED_RANGE } from '../../core/ranges'
import type { Range } from '../../core/types'
import { usePlaybackStore } from '../../state/playbackStore'
import { NumberField } from '../../ui/NumberField'
import { Slider } from '../../ui/Slider'
import { showError } from '../../ui/toastStore'
import { LoopRegionEditor } from './LoopRegionEditor'
import { TimeReadout } from './TimeReadout'
import './transport.css'

const SEEK_RANGE: Range = { min: 0, max: 1e6, step: 0.01, unit: '秒' }

export function TransportBar() {
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const speed = usePlaybackStore((state) => state.speed)
  const pausedTime = usePlaybackStore((state) => (state.isPlaying ? null : state.time))
  const { toggle, reset, step, seek, setSpeed } = usePlaybackStore.getState()

  const changeSpeed = (next: number) => {
    const result = setSpeed(next)
    if (!result.ok) showError(result.error.message)
  }

  return (
    <div className="transport">
      <div className="transport__buttons" role="group" aria-label="播放控制">
        <button type="button" className="button button--icon" aria-label="重置到 0 秒" onClick={reset}>
          ⏮
        </button>
        <button type="button" className="button button--icon" aria-label="后退一步" onClick={() => step(-1)}>
          ◂
        </button>
        <button type="button" className="button button--primary transport__play" onClick={toggle}>
          {isPlaying ? '暂停' : '播放'}
        </button>
        <button type="button" className="button button--icon" aria-label="前进一步" onClick={() => step(1)}>
          ▸
        </button>
      </div>

      <TimeReadout />
      <p className="visually-hidden" aria-live="polite">
        {isPlaying ? '正在播放' : '已暂停'}
      </p>

      <div className="transport__field">
        <NumberField
          label="跳转到"
          value={pausedTime ?? 0}
          range={SEEK_RANGE}
          disabled={isPlaying}
          onCommit={seek}
        />
      </div>

      <div className="transport__speed">
        <span className="nameplate">速度</span>
        <Slider
          label="播放速度"
          value={speed}
          range={SPEED_RANGE}
          onInput={changeSpeed}
          onCommit={() => undefined}
        />
        <NumberField label="播放速度数值" hideLabel value={speed} range={SPEED_RANGE} onCommit={changeSpeed} />
      </div>

      <LoopRegionEditor />
    </div>
  )
}
