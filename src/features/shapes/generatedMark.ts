import type { FourierFunction } from '../../core/types'

/**
 * 最近一次由系统生成(图形库 / 手绘 / 导入)且用户尚未改动的函数.
 * 从它出发再次替换不需要覆盖确认; 用户一编辑, present 就不再等于它.
 */
let lastGenerated: FourierFunction | null = null

export const rememberGenerated = (fn: FourierFunction): void => {
  lastGenerated = fn
}

export const isUntouchedGenerated = (present: FourierFunction): boolean => present === lastGenerated
