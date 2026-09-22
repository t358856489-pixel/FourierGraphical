import { z } from 'zod'
import {
  COMPONENT_COLOR_COUNT,
  MAX_COMPONENTS,
  MAX_KEYFRAMES,
  MAX_NAME_LENGTH,
  MIN_LOOP_SECONDS,
  SPEED_RANGE,
  TRAIL_RETENTION_OPTIONS,
  TRAIL_SECONDS_RANGE,
  rangeOf,
} from './ranges'
import {
  err,
  ok,
  type FourierFunction,
  type LoopRegion,
  type ParamName,
  type Result,
  type ViewSettings,
} from './types'

export interface Draft {
  readonly function: FourierFunction
  readonly playback: {
    readonly time: number
    readonly speed: number
    readonly loop: LoopRegion | null
  }
  readonly view: ViewSettings
  readonly savedFunctionId: string | null
  readonly isDirty: boolean
}

const finite = z.number().refine(Number.isFinite, '必须是有限数值')
const nonNegative = finite.refine((value) => value >= 0, '不能为负数')

const isStrictlyIncreasing = (times: readonly number[]): boolean =>
  times.every((time, index) => index === 0 || time > (times[index - 1] as number))

const trackSchema = (param: ParamName) => {
  const { min, max } = rangeOf(param)
  const value = finite.refine((v) => v >= min && v <= max, `取值需在 ${min} 到 ${max} 之间`)
  const keyframe = z.strictObject({
    time: nonNegative,
    value,
    easing: z.enum(['linear', 'smooth', 'hold']),
  })
  return z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('constant'), value }),
    z.strictObject({
      kind: z.literal('animated'),
      keyframes: z
        .array(keyframe)
        .min(1)
        .max(MAX_KEYFRAMES)
        .refine(
          (keyframes) => isStrictlyIncreasing(keyframes.map((k) => k.time)),
          '关键帧时刻必须严格递增',
        ),
    }),
  ])
}

const colorSchema = z
  .string()
  .regex(/^c\d{1,2}$/)
  .refine((color) => Number(color.slice(1)) < COMPONENT_COLOR_COUNT, '未知的分量颜色')

const componentSchema = z.strictObject({
  id: z.uuid(),
  amplitude: trackSchema('amplitude'),
  frequency: trackSchema('frequency'),
  phase: trackSchema('phase'),
  enabled: z.boolean(),
  color: colorSchema,
})

export const fourierFunctionSchema = z.strictObject({
  id: z.uuid(),
  schemaVersion: z.literal(1),
  name: z
    .string()
    .max(MAX_NAME_LENGTH)
    .refine((name) => name.trim().length > 0, '名称不能为空'),
  components: z
    .array(componentSchema)
    .max(MAX_COMPONENTS)
    .refine(
      (components) => new Set(components.map((c) => c.id)).size === components.length,
      '分量 id 不能重复',
    ),
  presentationMode: z.enum(['waveform', 'drawing2d']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const loopSchema = z
  .strictObject({ start: nonNegative, end: nonNegative, enabled: z.boolean() })
  .refine((loop) => loop.end - loop.start >= MIN_LOOP_SECONDS, '循环区间过短')

const HEX_COLOR = /^#[0-9a-f]{6}$/

// 功能 001 写出的草稿没有这些字段: 先补默认值, 再走严格校验.
// 坐标轴沿用旧的"网格"开关——升级前两者同显同隐, 升级后画面不应突然多出坐标轴.
const withDisplayDefaults = (input: unknown): unknown => {
  if (typeof input !== 'object' || input === null) return input
  const view = input as Record<string, unknown>
  // 只有"缺失"才补默认值; 显式写入的 null 等非法值照常交给严格校验去拒绝
  const orDefault = (key: string, fallback: unknown) => (view[key] === undefined ? fallback : view[key])
  return {
    ...view,
    showAxes: orDefault('showAxes', view['showGrid']),
    trailFade: orDefault('trailFade', true),
    trailRetention: orDefault('trailRetention', 'all'),
    background: orDefault('background', null),
  }
}

const strictViewSchema = z.strictObject({
  zoom: z.union([z.literal('auto'), finite.refine((zoom) => zoom > 0, '缩放必须为正数')]),
  pan: z.strictObject({ x: finite, y: finite }),
  showVectors: z.boolean(),
  showCircles: z.boolean(),
  showTrail: z.boolean(),
  showGrid: z.boolean(),
  trailSeconds: finite.refine(
    (seconds) => seconds >= TRAIL_SECONDS_RANGE.min && seconds <= TRAIL_SECONDS_RANGE.max,
    '轨迹时长越界',
  ),
  highlightedComponentId: z.string().nullable(),
  selectedComponentId: z.string().nullable(),
  showAxes: z.boolean(),
  trailFade: z.boolean(),
  trailRetention: z.union(TRAIL_RETENTION_OPTIONS.map((option) => z.literal(option))),
  background: z.string().regex(HEX_COLOR).nullable(),
})

const viewSchema = z.preprocess(withDisplayDefaults, strictViewSchema)

export const draftSchema = z.strictObject({
  function: fourierFunctionSchema,
  playback: z.strictObject({
    time: nonNegative,
    speed: finite.refine(
      (speed) => speed >= SPEED_RANGE.min && speed <= SPEED_RANGE.max,
      '播放速度越界',
    ),
    loop: loopSchema.nullable(),
  }),
  view: viewSchema,
  savedFunctionId: z.string().nullable(),
  isDirty: z.boolean(),
})

export const parseFunction = (input: unknown): Result<FourierFunction> => {
  const parsed = fourierFunctionSchema.safeParse(input)
  return parsed.success ? ok(parsed.data) : err('DATA_CORRUPT', '函数数据已损坏, 无法读取')
}

export const parseDraft = (input: unknown): Result<Draft> => {
  const parsed = draftSchema.safeParse(input)
  return parsed.success ? ok(parsed.data) : err('DATA_CORRUPT', '草稿数据已损坏, 无法恢复')
}
