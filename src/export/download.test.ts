import { downloadBlob } from './download'

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('clicks a temporary download link and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const clicked: { href: string; download: string; attached: boolean }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download, attached: this.isConnected })
    })
    const blob = new Blob(['data'])

    downloadBlob(blob, '我的函数.png')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ href: 'blob:fake', download: '我的函数.png', attached: true }])
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a')).toBeNull()
  })

  it('revokes the object URL even when the click throws', () => {
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => downloadBlob(new Blob(['data']), 'a.png')).toThrow('blocked')

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a')).toBeNull()
  })
})
