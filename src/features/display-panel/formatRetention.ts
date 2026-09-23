import type { TrailRetention } from '../../core/types'

const SECONDS_PER_MINUTE = 60

export const formatRetention = (retention: TrailRetention): string => {
  if (retention === 'all') return '全部'
  return retention < SECONDS_PER_MINUTE ? `${retention} 秒` : `${retention / SECONDS_PER_MINUTE} 分钟`
}
