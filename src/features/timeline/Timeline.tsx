import { timelineEnd } from '../../core/playback'
import { STEP_SECONDS } from '../../core/ranges'
import type { FourierFunction } from '../../core/types'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { KeyframeInspector } from './KeyframeInspector'
import { KeyframeLane } from './KeyframeLane'
import './timeline.css'

const TICK_TARGET = 10

export const latestKeyframeTime = (fn: FourierFunction): number => {
  let latest = 0
  for (const component of fn.components) {
    for (const track of [component.amplitude, component.frequency, component.phase]) {
      if (track.kind === 'animated') latest = Math.max(latest, track.keyframes.at(-1)?.time ?? 0)
    }
  }
  return latest
}

const tickSeconds = (end: number): number => {
  const raw = end / TICK_TARGET
  const power = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? raw
}

/** 只有播放头与滑块依赖当前时间; 单独订阅, 避免整条时间轴每帧重渲染 (章程原则 V) */
function Scrubber({ end }: { readonly end: number }) {
  const time = usePlaybackStore((state) => state.time)
  const seek = usePlaybackStore((state) => state.seek)
  return (
    <>
      <span
        className="timeline__playhead"
        aria-hidden="true"
        style={{ left: `${(Math.min(time, end) / end) * 100}%` }}
      />
      <input
        type="range"
        className="timeline__scrubber"
        aria-label="时间轴"
        aria-valuetext={`${time.toFixed(2)} 秒`}
        min={0}
        max={end}
        step={STEP_SECONDS}
        value={Math.min(time, end)}
        onChange={(event) => seek(Number(event.target.value))}
      />
    </>
  )
}

export function Timeline() {
  const fn = useDocumentStore(selectFunction)
  const loop = usePlaybackStore((state) => state.loop)
  const end = usePlaybackStore((state) => timelineEnd(state, latestKeyframeTime(fn)))
  const tick = tickSeconds(end)
  const ticks = Array.from({ length: Math.floor(end / tick) + 1 }, (_, index) => index * tick)
  const percent = (seconds: number) => `${(Math.min(seconds, end) / end) * 100}%`

  return (
    <div className="timeline">
      <div className="timeline__track">
        <div className="timeline__ruler" aria-hidden="true">
          {ticks.map((seconds) => (
            <span key={seconds} className="timeline__tick mono" style={{ left: percent(seconds) }}>
              {Number(seconds.toFixed(2))}
            </span>
          ))}
          {loop && (
            <span
              className="timeline__loop"
              data-enabled={loop.enabled}
              style={{ left: percent(loop.start), width: `calc(${percent(loop.end)} - ${percent(loop.start)})` }}
            />
          )}
        </div>
        <Scrubber end={end} />
      </div>
      <KeyframeLane end={end} />
      <KeyframeInspector />
    </div>
  )
}
