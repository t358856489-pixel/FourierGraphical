import type { Ctx2D } from '../render/drawGrid'

const PNG_MIME_TYPE = 'image/png'

/** 导出用的离屏绘制面; 抽象出来是为了在 jsdom(无真实 canvas)中注入假实现 */
export interface ExportSurface {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  readonly ctx: Ctx2D
  toPng(): Promise<Blob | null>
}

/** 返回 null 表示当前环境无法创建 2D 画布 */
export type SurfaceFactory = (pixelWidth: number, pixelHeight: number) => ExportSurface | null

const createOffscreenSurface = (pixelWidth: number, pixelHeight: number): ExportSurface | null => {
  const canvas = new OffscreenCanvas(pixelWidth, pixelHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx, toPng: () => canvas.convertToBlob({ type: PNG_MIME_TYPE }) }
}

const createElementSurface = (pixelWidth: number, pixelHeight: number): ExportSurface | null => {
  const canvas = document.createElement('canvas')
  canvas.width = pixelWidth
  canvas.height = pixelHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const toPng = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      canvas.toBlob(resolve, PNG_MIME_TYPE)
    })
  return { canvas, ctx, toPng }
}

export const createDefaultSurface: SurfaceFactory = (pixelWidth, pixelHeight) =>
  typeof OffscreenCanvas === 'undefined'
    ? createElementSurface(pixelWidth, pixelHeight)
    : createOffscreenSurface(pixelWidth, pixelHeight)
