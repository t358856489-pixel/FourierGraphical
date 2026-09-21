import { COMPONENT_COLOR_COUNT, MAX_COMPONENTS, MAX_NAME_LENGTH, PRESET_BASE_FREQUENCY } from './ranges'
import { findPreset, type PresetId } from './presets'
import {
  constant,
  err,
  ok,
  type FourierFunction,
  type HarmonicComponent,
  type ParamName,
  type ParamTrack,
  type PresentationMode,
  type Result,
} from './types'

export type IdFactory = () => string
export type Clock = () => string

const defaultIdFactory: IdFactory = () => crypto.randomUUID()
const defaultClock: Clock = () => new Date().toISOString()

const colorFor = (index: number): string => `c${index % COMPONENT_COLOR_COUNT}`

export const createComponent = (
  id: string,
  amplitude: number,
  frequency: number,
  phase: number,
  colorIndex: number,
): HarmonicComponent => ({
  id,
  amplitude: constant(amplitude),
  frequency: constant(frequency),
  phase: constant(phase),
  enabled: true,
  color: colorFor(colorIndex),
})

// 示例函数 (FR-007): 方波级数的前三项, 首屏即可看出"叠加逼近"的含义
const EXAMPLE_HARMONICS = [1, 3, 5] as const

export const createDefaultFunction = (
  idFactory: IdFactory = defaultIdFactory,
  clock: Clock = defaultClock,
): FourierFunction => {
  const now = clock()
  return {
    id: idFactory(),
    schemaVersion: 1,
    name: '未命名函数',
    components: EXAMPLE_HARMONICS.map((harmonic, index) =>
      createComponent(
        idFactory(),
        4 / (Math.PI * harmonic),
        harmonic * PRESET_BASE_FREQUENCY,
        0,
        index,
      ),
    ),
    presentationMode: 'waveform',
    createdAt: now,
    updatedAt: now,
  }
}

export const addComponent = (
  fn: FourierFunction,
  idFactory: IdFactory = defaultIdFactory,
): Result<FourierFunction> => {
  if (fn.components.length >= MAX_COMPONENTS) {
    return err('COMPONENT_LIMIT', `最多 ${MAX_COMPONENTS} 个分量`)
  }
  const enabledCount = fn.components.filter((component) => component.enabled).length
  const frequency = (enabledCount + 1) * PRESET_BASE_FREQUENCY
  const added = createComponent(idFactory(), 1, frequency, 0, fn.components.length)
  return ok({ ...fn, components: [...fn.components, added] })
}

const mapComponent = (
  fn: FourierFunction,
  componentId: string,
  update: (component: HarmonicComponent) => HarmonicComponent,
): FourierFunction => {
  let changed = false
  const components = fn.components.map((component) => {
    if (component.id !== componentId) return component
    const next = update(component)
    changed = changed || next !== component
    return next
  })
  return changed ? { ...fn, components } : fn
}

export const removeComponent = (fn: FourierFunction, componentId: string): FourierFunction => {
  const components = fn.components.filter((component) => component.id !== componentId)
  return components.length === fn.components.length ? fn : { ...fn, components }
}

export const setComponentEnabled = (
  fn: FourierFunction,
  componentId: string,
  enabled: boolean,
): FourierFunction =>
  mapComponent(fn, componentId, (component) =>
    component.enabled === enabled ? component : { ...component, enabled },
  )

export const moveComponent = (
  fn: FourierFunction,
  componentId: string,
  toIndex: number,
): FourierFunction => {
  const fromIndex = fn.components.findIndex((component) => component.id === componentId)
  if (fromIndex < 0) return fn
  const target = Math.min(fn.components.length - 1, Math.max(0, toIndex))
  if (target === fromIndex) return fn
  const moving = fn.components[fromIndex] as HarmonicComponent
  const rest = fn.components.filter((_, index) => index !== fromIndex)
  return { ...fn, components: [...rest.slice(0, target), moving, ...rest.slice(target)] }
}

export const updateTrack = (
  fn: FourierFunction,
  componentId: string,
  param: ParamName,
  track: ParamTrack,
): FourierFunction =>
  mapComponent(fn, componentId, (component) =>
    component[param] === track ? component : { ...component, [param]: track },
  )

export const rename = (fn: FourierFunction, name: string): Result<FourierFunction> => {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    return err('INVALID_NAME', `名称需为 1 到 ${MAX_NAME_LENGTH} 个字符`)
  }
  return ok(trimmed === fn.name ? fn : { ...fn, name: trimmed })
}

export const setPresentationMode = (
  fn: FourierFunction,
  mode: PresentationMode,
): FourierFunction => (fn.presentationMode === mode ? fn : { ...fn, presentationMode: mode })

export const findComponent = (
  fn: FourierFunction,
  componentId: string,
): HarmonicComponent | undefined => fn.components.find((component) => component.id === componentId)

/** 用预设波形的级数替换全部分量; 原有关键帧随之丢弃 (FR-019) */
export const applyPreset = (
  fn: FourierFunction,
  presetId: PresetId,
  count: number,
  baseFrequency: number = PRESET_BASE_FREQUENCY,
  idFactory: IdFactory = defaultIdFactory,
): Result<FourierFunction> => {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COMPONENTS) {
    return err('OUT_OF_RANGE', `分量个数需为 1 到 ${MAX_COMPONENTS} 的整数`)
  }
  const preset = findPreset(presetId)
  const components = Array.from({ length: count }, (_, index) => {
    const harmonic = preset.harmonic(index + 1)
    return createComponent(
      idFactory(),
      harmonic.amplitude,
      harmonic.multiple * baseFrequency,
      harmonic.phase,
      index,
    )
  })
  return ok({ ...fn, components })
}
