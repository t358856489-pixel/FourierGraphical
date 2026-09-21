import { MAX_VIDEO_SECONDS } from '../core/ranges'
import { drawFrame } from '../render/drawFrame'
import type { FrameInput } from './exportImage'
import {
  exportVideo,
  type VideoExportDeps,
  type VideoOptions,
  type VideoSink,
  type VideoSinkConfig,
} from './exportVideo'
import { createFakeSurfaces, frameInput } from './testSupport'

vi.mock('../render/drawFrame', () => ({ drawFrame: vi.fn() }))

const input: Omit<FrameInput, 't'> = {
  fn: frameInput.fn,
  view: frameInput.view,
  size: frameInput.size,
  theme: frameInput.theme,
}
const mp4 = new Blob(['mp4'], { type: 'video/mp4' })
const options: VideoOptions = { start: 0, end: 2, speed: 1, fps: 30, resolution: '720p' }

interface FakeSink {
  readonly deps: VideoExportDeps
  readonly frames: { readonly timestamp: number; readonly duration: number }[]
  readonly configs: VideoSinkConfig[]
  readonly finish: ReturnType<typeof vi.fn>
  readonly cancel: ReturnType<typeof vi.fn>
  readonly surfaces: ReturnType<typeof createFakeSurfaces>
}

const createFakeSink = (onFrame: (index: number) => void = () => undefined): FakeSink => {
  const frames: FakeSink['frames'] = []
  const configs: VideoSinkConfig[] = []
  const finish = vi.fn(async () => mp4)
  const cancel = vi.fn(async () => undefined)
  const sink: VideoSink = {
    addFrame: async (timestamp, duration) => {
      onFrame(frames.length)
      frames.push({ timestamp, duration })
    },
    finish,
    cancel,
  }
  const surfaces = createFakeSurfaces(async () => null)
  const deps: VideoExportDeps = {
    createSurface: surfaces.factory,
    createSink: async (_canvas, config) => {
      configs.push(config)
      return sink
    },
  }
  return { deps, frames, configs, finish, cancel, surfaces }
}

const run = (fake: FakeSink, overrides: Partial<VideoOptions> = {}, signal?: AbortSignal) => {
  const progress: number[] = []
  const result = exportVideo(
    input,
    { ...options, ...overrides },
    (fraction) => progress.push(fraction),
    signal ?? new AbortController().signal,
    fake.deps,
  )
  return { result, progress }
}

const drawnTimes = (): number[] => vi.mocked(drawFrame).mock.calls.map((call) => call[2])

describe('exportVideo', () => {
  beforeEach(() => {
    vi.mocked(drawFrame).mockReset()
  })

  it('encodes ceil((end - start) / speed * fps) frames and returns the MP4 blob', async () => {
    const fake = createFakeSink()

    const result = await run(fake, { start: 1, end: 2.01, speed: 1, fps: 30 }).result

    expect(result).toEqual({ ok: true, value: mp4 })
    expect(fake.frames).toHaveLength(31)
    expect(drawFrame).toHaveBeenCalledTimes(31)
    expect(fake.finish).toHaveBeenCalledTimes(1)
    expect(fake.cancel).not.toHaveBeenCalled()
  })

  it('does not add a spurious frame because of floating point noise', async () => {
    const fake = createFakeSink()

    await run(fake, { start: 0, end: 0.7, speed: 0.1, fps: 30 }).result

    expect(fake.frames).toHaveLength(210)
  })

  it('maps frame i to function time start + i*speed/fps and timestamp i/fps', async () => {
    const fake = createFakeSink()

    await run(fake, { start: 3, end: 5, speed: 2, fps: 60 }).result

    expect(fake.frames).toHaveLength(60)
    drawnTimes().forEach((time, index) => expect(time).toBeCloseTo(3 + (index * 2) / 60, 12))
    fake.frames.forEach((frame, index) => {
      expect(frame.timestamp).toBeCloseTo(index / 60, 12)
      expect(frame.duration).toBeCloseTo(1 / 60, 12)
    })
  })

  it('draws every frame on the same surface with the theme and view of the input', async () => {
    const fake = createFakeSink()

    await run(fake).result

    const ctx = fake.surfaces.created[0]?.surface.ctx
    expect(fake.surfaces.created).toHaveLength(1)
    vi.mocked(drawFrame).mock.calls.forEach((call) => {
      expect(call[0]).toBe(ctx)
      expect(call[1]).toBe(input.fn)
      expect(call[3]).toBe(input.view)
      expect(call[5]).toBe(input.theme)
    })
  })

  it.each([
    ['720p', 1280, 720],
    ['1080p', 1920, 1080],
  ] as const)(
    'renders %s at %dx%d pixels covering the on-screen frame',
    async (resolution, w, h) => {
      const fake = createFakeSink()

      await run(fake, { resolution, end: 0.1 }).result

      const size = vi.mocked(drawFrame).mock.calls[0]?.[4]
      expect(fake.surfaces.created[0]).toMatchObject({ width: w, height: h })
      expect(fake.configs).toEqual([{ width: w, height: h, fps: 30 }])
      expect(size?.pixelRatio).toBeCloseTo(w / input.size.width, 12)
      expect((size?.width ?? 0) * (size?.pixelRatio ?? 0)).toBeCloseTo(w, 9)
      expect((size?.height ?? 0) * (size?.pixelRatio ?? 0)).toBeCloseTo(h, 9)
    },
  )

  it('reports monotonic progress that ends at exactly 1', async () => {
    const fake = createFakeSink()

    const { result, progress } = run(fake)
    await result

    expect(progress.length).toBeGreaterThanOrEqual(60)
    progress.forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual(progress[index - 1] ?? 0)
      expect(value).toBeLessThanOrEqual(1)
    })
    expect(progress.at(-1)).toBe(1)
    expect(progress.filter((value) => value === 1)).toHaveLength(1)
  })

  it('allows an output of exactly the maximum duration at 0.1x speed', async () => {
    const fake = createFakeSink()

    const result = await run(fake, { start: 0, end: MAX_VIDEO_SECONDS / 10, speed: 0.1 }).result

    expect(result.ok).toBe(true)
    expect(fake.frames).toHaveLength(MAX_VIDEO_SECONDS * 30)
  })

  it('returns OUT_OF_RANGE when the output would exceed the maximum duration', async () => {
    const fake = createFakeSink()

    const result = await run(fake, { start: 0, end: 6.1, speed: 0.1 }).result

    expect(!result.ok && result.error.code).toBe('OUT_OF_RANGE')
    expect(!result.ok && result.error.message).toMatch(/[一-龥]/)
    expect(fake.configs).toHaveLength(0)
  })

  it.each([
    { start: 2, end: 2 },
    { start: 3, end: 1 },
    { start: -1, end: 1 },
    { start: 0, end: Number.NaN },
    { speed: 0 },
    { speed: 11 },
  ])('returns OUT_OF_RANGE for invalid options %o', async (overrides) => {
    const fake = createFakeSink()

    const result = await run(fake, overrides).result

    expect(!result.ok && result.error.code).toBe('OUT_OF_RANGE')
    expect(drawFrame).not.toHaveBeenCalled()
  })

  it('returns EXPORT_ABORTED and cancels the sink when aborted mid-export', async () => {
    const controller = new AbortController()
    const fake = createFakeSink((index) => {
      if (index === 9) controller.abort()
    })

    const { result, progress } = run(fake, {}, controller.signal)
    const outcome = await result

    expect(!outcome.ok && outcome.error.code).toBe('EXPORT_ABORTED')
    expect(fake.frames).toHaveLength(10)
    expect(fake.cancel).toHaveBeenCalledTimes(1)
    expect(fake.finish).not.toHaveBeenCalled()
    expect(progress.at(-1)).toBeLessThan(1)
  })

  it('returns EXPORT_ABORTED without creating an encoder when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fake = createFakeSink()

    const outcome = await run(fake, {}, controller.signal).result

    expect(!outcome.ok && outcome.error.code).toBe('EXPORT_ABORTED')
    expect(fake.configs).toHaveLength(0)
  })

  it('returns EXPORT_FAILED and cancels the sink when encoding a frame fails', async () => {
    const fake = createFakeSink((index) => {
      if (index === 3) throw new Error('encoder closed')
    })

    const outcome = await run(fake).result

    expect(!outcome.ok && outcome.error.code).toBe('EXPORT_FAILED')
    expect(!outcome.ok && outcome.error.message).toMatch(/[一-龥]/)
    expect(fake.cancel).toHaveBeenCalledTimes(1)
  })

  it('returns EXPORT_FAILED when finalizing fails, even if cancel also fails', async () => {
    const fake = createFakeSink()
    fake.finish.mockRejectedValueOnce(new Error('mux error'))
    fake.cancel.mockRejectedValueOnce(new Error('already closed'))

    const outcome = await run(fake).result

    expect(!outcome.ok && outcome.error.code).toBe('EXPORT_FAILED')
  })

  it('returns EXPORT_FAILED when the encoder cannot be created', async () => {
    const fake = createFakeSink()
    const deps: VideoExportDeps = {
      ...fake.deps,
      createSink: () => Promise.reject(new Error('no codec')),
    }

    const outcome = await exportVideo(
      input,
      options,
      () => undefined,
      new AbortController().signal,
      deps,
    )

    expect(!outcome.ok && outcome.error.code).toBe('EXPORT_FAILED')
  })

  it('returns EXPORT_UNSUPPORTED when no drawing surface can be created', async () => {
    const fake = createFakeSink()
    const deps: VideoExportDeps = { ...fake.deps, createSurface: () => null }

    const outcome = await exportVideo(
      input,
      options,
      () => undefined,
      new AbortController().signal,
      deps,
    )

    expect(!outcome.ok && outcome.error.code).toBe('EXPORT_UNSUPPORTED')
    expect(fake.configs).toHaveLength(0)
  })
})
