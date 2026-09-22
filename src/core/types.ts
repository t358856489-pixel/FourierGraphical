export type Easing = 'linear' | 'smooth' | 'hold'
export type ParamName = 'amplitude' | 'frequency' | 'phase'
export type PresentationMode = 'waveform' | 'drawing2d'

export interface Keyframe {
  readonly time: number
  readonly value: number
  readonly easing: Easing
}

export type ParamTrack =
  | { readonly kind: 'constant'; readonly value: number }
  | { readonly kind: 'animated'; readonly keyframes: readonly Keyframe[] }

export interface HarmonicComponent {
  readonly id: string
  readonly amplitude: ParamTrack
  readonly frequency: ParamTrack
  readonly phase: ParamTrack
  readonly enabled: boolean
  readonly color: string
}

export interface FourierFunction {
  readonly id: string
  readonly schemaVersion: 1
  readonly name: string
  readonly components: readonly HarmonicComponent[]
  readonly presentationMode: PresentationMode
  readonly createdAt: string
  readonly updatedAt: string
}

export interface LoopRegion {
  readonly start: number
  readonly end: number
  readonly enabled: boolean
}

export interface PlaybackState {
  readonly time: number
  readonly maxReachedTime: number
  readonly isPlaying: boolean
  readonly speed: number
  readonly loop: LoopRegion | null
}

export interface Vec2 {
  readonly x: number
  readonly y: number
}

/** 轨迹保留时长(秒); 'all' = 从 0 秒起, 受 MAX_RETENTION_SECONDS 约束 */
export type TrailRetention = 5 | 10 | 30 | 60 | 120 | 300 | 600 | 'all'

export interface ViewSettings {
  readonly zoom: number | 'auto'
  readonly pan: Vec2
  readonly showVectors: boolean
  readonly showCircles: boolean
  readonly showTrail: boolean
  readonly showGrid: boolean
  readonly trailSeconds: number
  /** 坐标轴与波形区的零值基准线; showGrid 只管网格线与时间刻度线 */
  readonly showAxes: boolean
  /** true = 功能 001 的余辉效果; false = 按 trailRetention 保留轨迹 */
  readonly trailFade: boolean
  readonly trailRetention: TrailRetention
  /** null = 应用默认背景; 否则为小写的 #rrggbb */
  readonly background: string | null
  readonly highlightedComponentId: string | null
  readonly selectedComponentId: string | null
}

/** 这一帧要画哪一段轨迹、怎么采样; 每帧由 (函数, t, 显示选项, 呈现模式) 重新算出, 不保存 */
export interface TrailPlan {
  readonly start: number
  readonly end: number
  readonly step: number
  /** step = 基础步长 × 2^stepPower; fading 模式下恒为 0 */
  readonly stepPower: number
  /** 保留模式下, 这个时刻之后的轨迹更亮 */
  readonly highlightStart: number
  readonly mode: 'fading' | 'retained'
  readonly samplesPerTurn: number
  /** "全部"且已超过保留上限 */
  readonly isCapped: boolean
  /** 为保证形状正确(采样不低于每圈 MIN_SAMPLES_PER_TURN 点), 实际保留窗口短于用户所选 */
  readonly isShortened: boolean
}

export interface History {
  readonly past: readonly FourierFunction[]
  readonly present: FourierFunction
  readonly future: readonly FourierFunction[]
}

export interface Range {
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit: string
}

export type ErrorCode =
  | 'OUT_OF_RANGE'
  | 'NOT_A_NUMBER'
  | 'COMPONENT_LIMIT'
  | 'KEYFRAME_LIMIT'
  | 'INVALID_LOOP_REGION'
  | 'INVALID_NAME'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA'
  | 'DATA_CORRUPT'
  | 'NOT_FOUND'
  | 'EXPORT_UNSUPPORTED'
  | 'EXPORT_FAILED'
  | 'EXPORT_ABORTED'

export interface AppError {
  readonly code: ErrorCode
  readonly message: string
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export const err = <T = never>(code: ErrorCode, message: string): Result<T> => ({
  ok: false,
  error: { code, message },
})

export const constant = (value: number): ParamTrack => ({ kind: 'constant', value })

export const animated = (keyframes: readonly Keyframe[]): ParamTrack => ({
  kind: 'animated',
  keyframes,
})
