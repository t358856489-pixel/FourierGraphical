import { useEffect, useRef, useState } from 'react'
import { MAX_VIDEO_SECONDS } from '../../core/ranges'
import type { Range } from '../../core/types'
import { downloadBlob } from '../../export/download'
import { exportImage, type FrameInput } from '../../export/exportImage'
import {
  exportVideo,
  outputSeconds,
  validateVideoOptions,
  type VideoFps,
  type VideoOptions,
  type VideoResolution,
} from '../../export/exportVideo'
import { detectVideoSupport, type VideoSupport } from '../../export/videoSupport'
import { derivePalette } from '../../render/palette'
import { readRenderTheme } from '../../render/theme'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { selectViewSettings, useViewStore } from '../../state/viewStore'
import { Dialog } from '../../ui/Dialog'
import { NumberField } from '../../ui/NumberField'
import { getStageSize } from '../stage/stageSize'
import './export-dialog.css'

const BOUND_RANGE: Range = { min: 0, max: 1e6, step: 0.01, unit: '秒' }
const DEFAULT_OUTPUT_SECONDS = 10

// 与舞台循环用同一个 derivePalette: 成片的背景与线条配色和画面一致 (FR-022)
export const frameInput = (): Omit<FrameInput, 't'> => {
  const view = { ...selectViewSettings(useViewStore.getState()), highlightedComponentId: null }
  return {
    fn: selectFunction(useDocumentStore.getState()),
    view,
    size: getStageSize(),
    theme: derivePalette(view.background, readRenderTheme(document.documentElement)),
  }
}

const fileStem = (): string => selectFunction(useDocumentStore.getState()).name.replace(/[\\/:*?"<>|]/g, '_')

/** 默认区间 (FR-023a): 取循环区间; 未设定时取按当前速度恰好生成 10 秒成片的区间 */
const defaultInterval = (): { start: number; end: number } => {
  const { loop, speed } = usePlaybackStore.getState()
  return loop ? { start: loop.start, end: loop.end } : { start: 0, end: DEFAULT_OUTPUT_SECONDS * speed }
}

function ImageTab({ onDone }: { readonly onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    const result = await exportImage({ ...frameInput(), t: usePlaybackStore.getState().time })
    if (!result.ok) return setError(result.error.message)
    downloadBlob(result.value, `${fileStem()}.png`)
    onDone()
  }
  return (
    <div className="export-dialog__body">
      <p className="dialog__message">把当前时刻的画面导出为 PNG 图片, 与屏幕上所见一致.</p>
      {error && <p role="alert" className="export-dialog__error">{error}</p>}
      <div className="dialog__actions">
        <button type="button" className="button button--primary" onClick={() => void save()}>
          导出图片
        </button>
      </div>
    </div>
  )
}

function VideoTab({ support, onDone }: { readonly support: VideoSupport; readonly onDone: () => void }) {
  const speed = usePlaybackStore((state) => state.speed)
  const [interval, setInterval] = useState(defaultInterval)
  const [fps, setFps] = useState<VideoFps>(60)
  const [resolution, setResolution] = useState<VideoResolution>('720p')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const options: VideoOptions = { ...interval, speed, fps, resolution }
  const validation = validateVideoOptions(options)
  const seconds = outputSeconds(options)
  const isExporting = progress !== null

  useEffect(() => () => abort.current?.abort(), [])

  const start = async () => {
    const playback = usePlaybackStore.getState()
    const wasPlaying = playback.isPlaying
    playback.pause()
    abort.current = new AbortController()
    setError(null)
    setProgress(0)
    const result = await exportVideo(frameInput(), options, setProgress, abort.current.signal)
    setProgress(null)
    if (wasPlaying) usePlaybackStore.getState().play()
    if (result.ok) {
      downloadBlob(result.value, `${fileStem()}.mp4`)
      return onDone()
    }
    // 用户主动取消不是错误 (FR-023c)
    if (result.error.code !== 'EXPORT_ABORTED') setError(result.error.message)
  }

  if (!support.supported) {
    return (
      <p className="dialog__message" role="status">
        {support.reason ?? '当前浏览器不支持视频导出'} 图片导出不受影响.
      </p>
    )
  }

  return (
    <div className="export-dialog__body">
      <div className="export-dialog__grid">
        <NumberField label="起点" value={interval.start} range={BOUND_RANGE} disabled={isExporting}
          onCommit={(start) => setInterval((current) => ({ ...current, start }))} />
        <NumberField label="终点" value={interval.end} range={BOUND_RANGE} disabled={isExporting}
          onCommit={(end) => setInterval((current) => ({ ...current, end }))} />
        <label className="export-dialog__select">
          <span className="number-field__label">分辨率</span>
          <select value={resolution} disabled={isExporting}
            onChange={(event) => setResolution(event.target.value as VideoResolution)}>
            <option value="720p">1280 × 720</option>
            <option value="1080p">1920 × 1080</option>
          </select>
        </label>
        <label className="export-dialog__select">
          <span className="number-field__label">帧率</span>
          <select value={fps} disabled={isExporting}
            onChange={(event) => setFps(Number(event.target.value) as VideoFps)}>
            <option value={60}>60 帧/秒</option>
            <option value={30}>30 帧/秒</option>
          </select>
        </label>
      </div>
      <p className="export-dialog__summary">
        按当前播放速度 <span className="mono">{speed}×</span>, 成片时长{' '}
        <span className="mono">{Number.isFinite(seconds) ? seconds.toFixed(1) : '—'}</span> 秒 (上限{' '}
        {MAX_VIDEO_SECONDS} 秒). 视频不含声音.
      </p>
      {!validation.ok && <p role="alert" className="export-dialog__error">{validation.error.message}</p>}
      {error && <p role="alert" className="export-dialog__error">{error}</p>}
      {isExporting && (
        <progress className="export-dialog__progress" aria-label="导出进度" max={1} value={progress} />
      )}
      <div className="dialog__actions">
        {isExporting ? (
          <button type="button" className="button" onClick={() => abort.current?.abort()}>
            取消导出
          </button>
        ) : (
          <button type="button" className="button button--primary" disabled={!validation.ok}
            onClick={() => void start()}>
            开始导出
          </button>
        )}
      </div>
    </div>
  )
}

interface ExportDialogProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const [tab, setTab] = useState<'image' | 'video'>('image')
  const [support, setSupport] = useState<VideoSupport | null>(null)

  useEffect(() => {
    if (!isOpen || support) return
    let isCurrent = true
    void detectVideoSupport().then((result) => {
      if (isCurrent) setSupport(result)
    })
    return () => {
      isCurrent = false
    }
  }, [isOpen, support])

  return (
    <Dialog title="导出" isOpen={isOpen} onClose={onClose}>
      <div className="export-dialog__tabs" role="tablist" aria-label="导出类型">
        {(['image', 'video'] as const).map((id) => (
          <button key={id} type="button" role="tab" id={`export-tab-${id}`}
            aria-selected={tab === id} aria-controls="export-panel"
            className="export-dialog__tab" onClick={() => setTab(id)}>
            {id === 'image' ? '图片' : '视频'}
          </button>
        ))}
      </div>
      <div id="export-panel" role="tabpanel" aria-labelledby={`export-tab-${tab}`}>
        {tab === 'image' && <ImageTab onDone={onClose} />}
        {tab === 'video' &&
          (support ? <VideoTab support={support} onDone={onClose} /> : <p className="dialog__message">正在检测浏览器能力…</p>)}
      </div>
      <div className="dialog__actions export-dialog__close">
        <button type="button" className="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </Dialog>
  )
}
