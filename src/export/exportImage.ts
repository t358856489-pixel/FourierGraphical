import { err, ok, type FourierFunction, type Result, type ViewSettings } from '../core/types'
import { drawFrame } from '../render/drawFrame'
import type { RenderTheme } from '../render/theme'
import { createDefaultSurface, type SurfaceFactory } from './surface'

export interface FrameInput {
  readonly fn: FourierFunction
  readonly t: number
  readonly view: ViewSettings
  readonly size: { readonly width: number; readonly height: number }
  readonly theme: RenderTheme
}

export const IMAGE_PIXEL_RATIO = 2

export const UNSUPPORTED_SURFACE_MESSAGE = '当前浏览器无法创建离屏画布, 不能导出'

export const isValidFrameSize = (size: FrameInput['size']): boolean =>
  Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0

export const exportImage = async (
  input: FrameInput,
  createSurface: SurfaceFactory = createDefaultSurface,
): Promise<Result<Blob>> => {
  if (!isValidFrameSize(input.size)) return err('OUT_OF_RANGE', '画面尺寸无效, 无法导出图片')
  try {
    const { width, height } = input.size
    const surface = createSurface(
      Math.round(width * IMAGE_PIXEL_RATIO),
      Math.round(height * IMAGE_PIXEL_RATIO),
    )
    if (!surface) return err('EXPORT_UNSUPPORTED', UNSUPPORTED_SURFACE_MESSAGE)
    const size = { width, height, pixelRatio: IMAGE_PIXEL_RATIO }
    drawFrame(surface.ctx, input.fn, input.t, input.view, size, input.theme)
    const blob = await surface.toPng()
    return blob ? ok(blob) : err('EXPORT_FAILED', '图片生成失败, 请重试')
  } catch {
    return err('EXPORT_FAILED', '图片生成失败, 请重试')
  }
}
