import type { ParamName, Range, TrailRetention } from './types'

export const AMPLITUDE_RANGE: Range = { min: 0, max: 100, step: 0.01, unit: '' }
export const FREQUENCY_RANGE: Range = { min: -100, max: 100, step: 0.001, unit: '圈/秒' }
export const PHASE_RANGE: Range = { min: -3600, max: 3600, step: 0.1, unit: '°' }
export const SPEED_RANGE: Range = { min: 0.1, max: 10, step: 0.1, unit: '×' }
export const TRAIL_SECONDS_RANGE: Range = { min: 1, max: 30, step: 1, unit: '秒' }
export const ZOOM_RANGE: Range = { min: 0.1, max: 20, step: 0.1, unit: '×' }

export const STEP_SECONDS = 1 / 60
export const MIN_LOOP_SECONDS = 0.1
export const MAX_WALL_DELTA_SECONDS = 0.25
export const MIN_TIMELINE_SECONDS = 10

export const MAX_COMPONENTS = 50
export const MAX_KEYFRAMES = 50
export const MAX_HISTORY = 50
export const MAX_NAME_LENGTH = 60
export const COMPONENT_COLOR_COUNT = 12

export const KEYFRAME_TIME_QUANTUM = 0.001
export const DEFAULT_TRAIL_SECONDS = 8
export const INITIAL_TIME_SECONDS = DEFAULT_TRAIL_SECONDS
export const DEFAULT_MAX_TRAIL_POINTS = 4000
export const MIN_TRAIL_SAMPLE_RATE = 60
export const SAMPLES_PER_TURN = 32

export const PRESET_BASE_FREQUENCY = 0.2
export const MAX_VIDEO_SECONDS = 60
export const ALIASING_WARNING_FREQUENCY = 30

const RANGES: Readonly<Record<ParamName, Range>> = {
  amplitude: AMPLITUDE_RANGE,
  frequency: FREQUENCY_RANGE,
  phase: PHASE_RANGE,
}

export const rangeOf = (param: ParamName): Range => RANGES[param]

export const PARAM_LABELS: Readonly<Record<ParamName, string>> = {
  amplitude: '振幅',
  frequency: '频率',
  phase: '相位',
}

export const quantizeTime = (t: number): number =>
  Math.round(t / KEYFRAME_TIME_QUANTUM) * KEYFRAME_TIME_QUANTUM

/** 滑块覆盖的常用范围; 数值框仍允许完整取值范围 */
export const SLIDER_RANGES: Readonly<Record<ParamName, Range>> = {
  amplitude: { min: 0, max: 5, step: 0.01, unit: '' },
  frequency: { min: -10, max: 10, step: 0.01, unit: '圈/秒' },
  phase: { min: -180, max: 180, step: 1, unit: '°' },
}

export const decimalsOf = (step: number): number => {
  const text = String(step)
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

export const formatValue = (value: number, step: number): string =>
  String(Number(value.toFixed(decimalsOf(step))))

// —— 功能 002: 画布显示选项 ——
export const TRAIL_RETENTION_OPTIONS: readonly TrailRetention[] = [5, 10, 30, 60, 120, 300, 600, 'all']
export const MAX_RETENTION_SECONDS = 600
/** 保留模式下最新的这一段更亮, 并平滑过渡到正常亮度 */
export const HIGHLIGHT_SECONDS = 2
export const HIGHLIGHT_BANDS = 12
/** 正常亮度 = 轨迹色与背景色按此比例混合(越大越接近轨迹色) */
export const NORMAL_BRIGHTNESS_MIX = 0.55
export const RETAINED_TRAIL_POINT_BUDGET = 40000
/** 形状永远正确: 保留模式的采样不得低于每圈这么多点, 不够时缩短实际保留窗口 */
export const MIN_SAMPLES_PER_TURN = 8
export const SMOOTH_BELOW_SAMPLES_PER_TURN = 16
export const MIN_LINE_CONTRAST = 3
export const MIN_TEXT_CONTRAST = 4.5

export const BACKGROUND_PRESETS: readonly { readonly name: string; readonly value: string | null }[] = [
  { name: '默认深色', value: null },
  { name: '纯黑', value: '#000000' },
  { name: '纯白', value: '#ffffff' },
  { name: '浅米色', value: '#f3ecdc' },
]
