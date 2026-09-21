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

export interface ViewSettings {
  readonly zoom: number | 'auto'
  readonly pan: Vec2
  readonly showVectors: boolean
  readonly showCircles: boolean
  readonly showTrail: boolean
  readonly showGrid: boolean
  readonly trailSeconds: number
  readonly highlightedComponentId: string | null
  readonly selectedComponentId: string | null
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
