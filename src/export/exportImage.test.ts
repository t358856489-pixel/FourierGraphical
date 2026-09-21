import { drawFrame } from '../render/drawFrame'
import { exportImage, IMAGE_PIXEL_RATIO } from './exportImage'
import { createFakeSurfaces, frameInput } from './testSupport'

vi.mock('../render/drawFrame', () => ({ drawFrame: vi.fn() }))

const png = new Blob(['png'], { type: 'image/png' })

describe('exportImage', () => {
  beforeEach(() => {
    vi.mocked(drawFrame).mockReset()
  })

  it('draws one frame at double pixel density and returns the PNG blob', async () => {
    const surfaces = createFakeSurfaces(async () => png)

    const result = await exportImage(frameInput, surfaces.factory)

    expect(result).toEqual({ ok: true, value: png })
    expect(IMAGE_PIXEL_RATIO).toBe(2)
    expect(surfaces.created.map(({ width, height }) => [width, height])).toEqual([[1280, 720]])
    expect(drawFrame).toHaveBeenCalledTimes(1)
    const call = vi.mocked(drawFrame).mock.calls[0]
    expect(call?.[0]).toBe(surfaces.created[0]?.surface.ctx)
    expect(call?.[1]).toBe(frameInput.fn)
    expect(call?.[2]).toBe(frameInput.t)
    expect(call?.[3]).toBe(frameInput.view)
    expect(call?.[4]).toEqual({ width: 640, height: 360, pixelRatio: 2 })
    expect(call?.[5]).toBe(frameInput.theme)
  })

  it('returns EXPORT_UNSUPPORTED when no drawing surface can be created', async () => {
    const result = await exportImage(frameInput, () => null)

    expect(!result.ok && result.error.code).toBe('EXPORT_UNSUPPORTED')
    expect(drawFrame).not.toHaveBeenCalled()
  })

  it('returns EXPORT_FAILED when the canvas yields no blob', async () => {
    const result = await exportImage(frameInput, createFakeSurfaces(async () => null).factory)

    expect(!result.ok && result.error.code).toBe('EXPORT_FAILED')
    expect(!result.ok && result.error.message).toMatch(/[一-龥]/)
  })

  it('returns EXPORT_FAILED instead of throwing when drawing or encoding throws', async () => {
    const rejecting = createFakeSurfaces(() => Promise.reject(new Error('tainted')))
    const encoded = await exportImage(frameInput, rejecting.factory)
    vi.mocked(drawFrame).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const drawn = await exportImage(frameInput, createFakeSurfaces(async () => png).factory)

    expect(!encoded.ok && encoded.error.code).toBe('EXPORT_FAILED')
    expect(!drawn.ok && drawn.error.code).toBe('EXPORT_FAILED')
  })

  it('rejects a size that is not positive', async () => {
    const input = { ...frameInput, size: { width: 0, height: 360 } }

    const result = await exportImage(input, createFakeSurfaces(async () => png).factory)

    expect(!result.ok && result.error.code).toBe('OUT_OF_RANGE')
  })
})
