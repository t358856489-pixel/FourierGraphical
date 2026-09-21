import { detectVideoSupport } from './videoSupport'

const stubEncoder = (isConfigSupported: (config: VideoEncoderConfig) => Promise<unknown>): void => {
  vi.stubGlobal('VideoEncoder', { isConfigSupported })
}

describe('detectVideoSupport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports unsupported with a Chinese reason when VideoEncoder is missing', async () => {
    vi.stubGlobal('VideoEncoder', undefined)

    const support = await detectVideoSupport()

    expect(support.supported).toBe(false)
    expect(support.reason).toMatch(/[一-龥]/)
  })

  it('probes an H.264 configuration at 1280x720', async () => {
    const probe = vi.fn(async () => ({ supported: true }))
    stubEncoder(probe)

    const support = await detectVideoSupport()

    expect(support).toEqual({ supported: true })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(probe).toHaveBeenCalledWith(
      expect.objectContaining({
        codec: expect.stringMatching(/^avc1\./),
        width: 1280,
        height: 720,
      }),
    )
  })

  it('reports unsupported with a Chinese reason when H.264 cannot be encoded', async () => {
    stubEncoder(async () => ({ supported: false }))

    const support = await detectVideoSupport()

    expect(support.supported).toBe(false)
    expect(support.reason).toMatch(/H\.264/)
    expect(support.reason).toMatch(/[一-龥]/)
  })

  it('reports unsupported instead of rejecting when the probe throws', async () => {
    stubEncoder(() => Promise.reject(new TypeError('bad config')))

    const support = await detectVideoSupport()

    expect(support.supported).toBe(false)
    expect(support.reason).toMatch(/[一-龥]/)
  })
})
