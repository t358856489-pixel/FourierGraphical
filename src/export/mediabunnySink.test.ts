import { createMediabunnySink } from './mediabunnySink'

const state = vi.hoisted(() => ({
  log: [] as string[],
  buffer: null as ArrayBuffer | null,
  sourceArgs: [] as unknown[],
  trackArgs: [] as unknown[],
}))

vi.mock('mediabunny', () => {
  class BufferTarget {
    get buffer(): ArrayBuffer | null {
      return state.buffer
    }
  }
  class Mp4OutputFormat {
    readonly mimeType = 'video/mp4'
  }
  class CanvasSource {
    constructor(...args: unknown[]) {
      state.sourceArgs.push(...args)
    }
    add = async (timestamp: number, duration: number): Promise<void> => {
      state.log.push(`add:${timestamp}:${duration}`)
    }
  }
  class Output {
    addVideoTrack = (...args: unknown[]): void => {
      state.trackArgs.push(...args)
    }
    start = async (): Promise<void> => {
      state.log.push('start')
    }
    finalize = async (): Promise<void> => {
      state.log.push('finalize')
    }
    cancel = async (): Promise<void> => {
      state.log.push('cancel')
    }
  }
  return { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH: 'high' }
})

const canvas = {} as HTMLCanvasElement
const config = { width: 1280, height: 720, fps: 60 } as const

describe('createMediabunnySink', () => {
  beforeEach(() => {
    state.log.length = 0
    state.sourceArgs.length = 0
    state.trackArgs.length = 0
    state.buffer = null
  })

  it('configures an H.264 canvas source at the requested frame rate and starts the output', async () => {
    await createMediabunnySink(canvas, config)

    expect(state.sourceArgs[0]).toBe(canvas)
    expect(state.sourceArgs[1]).toMatchObject({ codec: 'avc' })
    expect(state.trackArgs[1]).toEqual({ frameRate: 60 })
    expect(state.log).toEqual(['start'])
  })

  it('forwards frames and returns an MP4 blob on finish', async () => {
    state.buffer = new ArrayBuffer(8)
    const sink = await createMediabunnySink(canvas, config)

    await sink.addFrame(0.5, 1 / 60)
    const blob = await sink.finish()

    expect(state.log).toEqual(['start', `add:0.5:${1 / 60}`, 'finalize'])
    expect(blob.type).toBe('video/mp4')
    expect(blob.size).toBe(8)
  })

  it('rejects on finish when no buffer was produced and cancels the output on cancel', async () => {
    const sink = await createMediabunnySink(canvas, config)

    await expect(sink.finish()).rejects.toThrow()
    await sink.cancel()

    expect(state.log.at(-1)).toBe('cancel')
  })
})
