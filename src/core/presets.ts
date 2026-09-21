export type PresetId = 'square' | 'sawtooth' | 'triangle'

export interface Harmonic {
  /** 基频的整数倍 */
  readonly multiple: number
  readonly amplitude: number
  readonly phase: number
}

export interface PresetDefinition {
  readonly id: PresetId
  readonly name: string
  /** 第 n 项 (n 从 1 起), 按 y = Σ A·sin θ 的约定 (data-model "PresetDefinition") */
  readonly harmonic: (n: number) => Harmonic
}

const alternating = (n: number): number => (n % 2 === 0 ? 180 : 0)

export const PRESETS: readonly PresetDefinition[] = [
  {
    id: 'square',
    name: '方波',
    harmonic: (n) => {
      const multiple = 2 * n - 1
      return { multiple, amplitude: 4 / (Math.PI * multiple), phase: 0 }
    },
  },
  {
    id: 'sawtooth',
    name: '锯齿波',
    harmonic: (n) => ({ multiple: n, amplitude: 2 / (Math.PI * n), phase: alternating(n) }),
  },
  {
    id: 'triangle',
    name: '三角波',
    harmonic: (n) => {
      const multiple = 2 * n - 1
      return { multiple, amplitude: 8 / (Math.PI ** 2 * multiple ** 2), phase: alternating(n) }
    },
  },
]

export const findPreset = (id: PresetId): PresetDefinition =>
  PRESETS.find((preset) => preset.id === id) as PresetDefinition
