import { copyText } from './copyText'

const stubClipboard = (writeText: ((text: string) => Promise<void>) | undefined) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

afterEach(() => stubClipboard(undefined))

describe('copyText (FR-009 / FR-011)', () => {
  test('writes the text once and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const result = await copyText('z(t) = 1')
    expect(result).toEqual({ ok: true, value: undefined })
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('z(t) = 1')
  })

  test('a rejected write becomes a CLIPBOARD_UNAVAILABLE result with a Chinese explanation', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')))
    const result = await copyText('x')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CLIPBOARD_UNAVAILABLE')
      expect(result.error.message).toContain('浏览器不允许')
    }
  })

  test('a missing clipboard API gives the same result instead of throwing', async () => {
    stubClipboard(undefined)
    await expect(copyText('x')).resolves.toMatchObject({
      ok: false,
      error: { code: 'CLIPBOARD_UNAVAILABLE' },
    })
  })
})
