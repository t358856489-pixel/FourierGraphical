import { MAX_VIDEO_SECONDS, SPEED_RANGE } from '../core/ranges'
import { err, ok, type Result } from '../core/types'
import { drawFrame, type FrameSize } from '../render/drawFrame'
import { UNSUPPORTED_SURFACE_MESSAGE, isValidFrameSize, type FrameInput } from './exportImage'
import { createMediabunnySink } from './mediabunnySink'
import { createDefaultSurface, type ExportSurface, type SurfaceFactory } from './surface'

export type VideoFps = 30 | 60
export type VideoResolution = '720p' | '1080p'

export interface VideoOptions {
  readonly start: number
  readonly end: number
  readonly speed: number
  readonly fps: VideoFps
  readonly resolution: VideoResolution
}

export interface VideoSinkConfig {
  readonly width: number
  readonly height: number
  readonly fps: VideoFps
}

/** 编码器抽象: 每次 addFrame 抓取画布当前内容; cancel 释放编码器并丢弃输出 */
export interface VideoSink {
  addFrame(timestampSeconds: number, durationSeconds: number): Promise<void>
  finish(): Promise<Blob>
  cancel(): Promise<void>
}

export type VideoSinkFactory = (
  canvas: ExportSurface['canvas'],
  config: VideoSinkConfig,
) => Promise<VideoSink>

export interface VideoExportDeps {
  readonly createSurface: SurfaceFactory
  readonly createSink: VideoSinkFactory
}

export const VIDEO_PIXEL_SIZES: Readonly<
  Record<VideoResolution, { readonly width: number; readonly height: number }>
> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
}

// 浮点除法可能得到 210.00000000000003 这样的结果, 取整前先扣掉噪声
const FLOAT_NOISE = 1e-9
// 封装(finish)也要时间, 逐帧阶段不报满, 保证 1 只在真正完成时出现
const FRAME_PROGRESS_SHARE = 0.98

const defaultDeps: VideoExportDeps = {
  createSurface: createDefaultSurface,
  createSink: createMediabunnySink,
}

export const outputSeconds = (options: Pick<VideoOptions, 'start' | 'end' | 'speed'>): number =>
  (options.end - options.start) / options.speed

export const frameCountOf = (options: VideoOptions): number =>
  Math.ceil(outputSeconds(options) * options.fps - FLOAT_NOISE)

export const validateVideoOptions = (options: VideoOptions): Result<VideoOptions> => {
  const { start, end, speed } = options
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return err('OUT_OF_RANGE', '导出区间无效: 终点需晚于起点, 且起点不小于 0')
  }
  if (!(speed >= SPEED_RANGE.min && speed <= SPEED_RANGE.max)) {
    return err('OUT_OF_RANGE', `播放速度需在 ${SPEED_RANGE.min}× 到 ${SPEED_RANGE.max}× 之间`)
  }
  if (outputSeconds(options) > MAX_VIDEO_SECONDS + FLOAT_NOISE) {
    return err('OUT_OF_RANGE', `成片时长不能超过 ${MAX_VIDEO_SECONDS} 秒, 请缩短区间或提高播放速度`)
  }
  return ok(options)
}

// 让屏幕上看到的画面完整落在视频帧内, 并按视频宽高比向外补足
const videoFrameSize = (screen: FrameInput['size'], resolution: VideoResolution): FrameSize => {
  const pixels = VIDEO_PIXEL_SIZES[resolution]
  const pixelRatio = Math.min(pixels.width / screen.width, pixels.height / screen.height)
  return { width: pixels.width / pixelRatio, height: pixels.height / pixelRatio, pixelRatio }
}

type RenderOutcome = 'done' | 'aborted'

const renderFrames = async (
  input: Omit<FrameInput, 't'>,
  options: VideoOptions,
  surface: ExportSurface,
  sink: VideoSink,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<RenderOutcome> => {
  const total = frameCountOf(options)
  const size = videoFrameSize(input.size, options.resolution)
  for (let index = 0; index < total; index += 1) {
    if (signal.aborted) return 'aborted'
    const t = options.start + (index * options.speed) / options.fps
    drawFrame(surface.ctx, input.fn, t, input.view, size, input.theme)
    await sink.addFrame(index / options.fps, 1 / options.fps)
    onProgress(((index + 1) / total) * FRAME_PROGRESS_SHARE)
  }
  return signal.aborted ? 'aborted' : 'done'
}

const cancelQuietly = async (sink: VideoSink): Promise<void> => {
  try {
    await sink.cancel()
  } catch {
    // 编码器可能已因出错而关闭; 此时已无资源可释放, 原始错误由调用方返回
  }
}

const aborted = (): Result<Blob> => err('EXPORT_ABORTED', '已取消视频导出')
const failed = (): Result<Blob> => err('EXPORT_FAILED', '视频编码失败, 请重试或降低分辨率与帧率')

const encode = async (
  input: Omit<FrameInput, 't'>,
  options: VideoOptions,
  surface: ExportSurface,
  sink: VideoSink,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Result<Blob>> => {
  try {
    const outcome = await renderFrames(input, options, surface, sink, onProgress, signal)
    if (outcome === 'aborted') {
      await cancelQuietly(sink)
      return aborted()
    }
    const blob = await sink.finish()
    onProgress(1)
    return ok(blob)
  } catch {
    await cancelQuietly(sink)
    return failed()
  }
}

export const exportVideo = async (
  input: Omit<FrameInput, 't'>,
  options: VideoOptions,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
  deps: VideoExportDeps = defaultDeps,
): Promise<Result<Blob>> => {
  const valid = validateVideoOptions(options)
  if (!valid.ok) return valid
  if (!isValidFrameSize(input.size)) return err('OUT_OF_RANGE', '画面尺寸无效, 无法导出视频')
  if (signal.aborted) return aborted()
  try {
    const pixels = VIDEO_PIXEL_SIZES[options.resolution]
    const surface = deps.createSurface(pixels.width, pixels.height)
    if (!surface) return err('EXPORT_UNSUPPORTED', UNSUPPORTED_SURFACE_MESSAGE)
    const sink = await deps.createSink(surface.canvas, { ...pixels, fps: options.fps })
    return await encode(input, options, surface, sink, onProgress, signal)
  } catch {
    return failed()
  }
}
