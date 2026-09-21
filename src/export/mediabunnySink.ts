import type { VideoSink, VideoSinkFactory } from './exportVideo'

const MP4_MIME_TYPE = 'video/mp4'
const KEY_FRAME_INTERVAL_SECONDS = 2

// 编码是 CPU 密集的长循环; 每帧后让出事件循环, 进度条与"取消"按钮才有机会响应
const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

/** 真实的 H.264/MP4 编码器. mediabunny 体积较大, 仅在用户真正导出视频时才加载 */
export const createMediabunnySink: VideoSinkFactory = async (canvas, config) => {
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } =
    await import('mediabunny')
  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target })
  const source = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
    keyFrameInterval: KEY_FRAME_INTERVAL_SECONDS,
  })
  output.addVideoTrack(source, { frameRate: config.fps })
  await output.start()

  const sink: VideoSink = {
    addFrame: async (timestampSeconds, durationSeconds) => {
      // add() 的 Promise 在编码器与写入器可以接收更多帧时才完成, await 它即背压
      await source.add(timestampSeconds, durationSeconds)
      await yieldToEventLoop()
    },
    finish: async () => {
      await output.finalize()
      if (!target.buffer) throw new Error('mediabunny produced no buffer')
      return new Blob([target.buffer], { type: MP4_MIME_TYPE })
    },
    cancel: () => output.cancel(),
  }
  return sink
}
