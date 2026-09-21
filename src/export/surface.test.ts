import { createDefaultSurface } from './surface'

describe('createDefaultSurface', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('prefers OffscreenCanvas and encodes through convertToBlob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    const convertToBlob = vi.fn(async () => blob)
    const ctx = {}
    class FakeOffscreenCanvas {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
      getContext = (): unknown => ctx
      convertToBlob = convertToBlob
    }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)

    const surface = createDefaultSurface(320, 200)

    expect(surface?.canvas).toMatchObject({ width: 320, height: 200 })
    expect(surface?.ctx).toBe(ctx)
    expect(await surface?.toPng()).toBe(blob)
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/png' })
  })

  it('falls back to a canvas element and encodes through toBlob', async () => {
    const blob = new Blob(['y'], { type: 'image/png' })
    const ctx = {} as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob))

    const surface = createDefaultSurface(100, 50)

    expect(surface?.canvas).toBeInstanceOf(HTMLCanvasElement)
    expect(surface?.canvas).toMatchObject({ width: 100, height: 50 })
    expect(await surface?.toPng()).toBe(blob)
  })

  it('returns null when no 2D context is available', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    expect(createDefaultSurface(100, 50)).toBeNull()
  })
})
