/** 画布当前的 CSS 尺寸, 供导出按屏幕所见取景 */
let current = { width: 0, height: 0 }

export const setStageSize = (width: number, height: number): void => {
  current = { width, height }
}

export const getStageSize = (): { readonly width: number; readonly height: number } => current
