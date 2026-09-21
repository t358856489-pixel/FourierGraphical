import { vectorChain, tipAt } from '../../core/evaluator'
import { createDefaultFunction, updateTrack } from '../../core/function'
import { constant } from '../../core/types'
import { hitTestLink, pointerToAmplitudePhase } from './vectorDrag'

const identity = (v: { x: number; y: number }) => v

describe('hitTestLink', () => {
  const fn = createDefaultFunction()
  const chain = vectorChain(fn, 0)

  test('picks the nearest tip within the hit radius', () => {
    const target = chain[1]
    if (!target) throw new Error('fixture')
    const scaled = (v: { x: number; y: number }) => ({ x: v.x * 100, y: v.y * 100 })
    const tip = scaled(target.to)
    expect(hitTestLink(chain, { x: tip.x + 3, y: tip.y - 2 }, scaled)?.componentId).toBe(
      target.componentId,
    )
  })

  test('returns null when nothing is close enough', () => {
    expect(hitTestLink(chain, { x: 9999, y: 9999 }, identity)).toBeNull()
  })
})

describe('pointerToAmplitudePhase', () => {
  test('dragging the tip makes the vector point at the pointer at the current time', () => {
    const base = createDefaultFunction()
    const component = base.components[0]
    if (!component) throw new Error('fixture')
    const single = { ...base, components: [component] }
    const t = 3.21
    const pointer = { x: -1.5, y: 2 }

    const { amplitude, phase } = pointerToAmplitudePhase(component, { x: 0, y: 0 }, pointer, t, 0)
    const edited = updateTrack(
      updateTrack(single, component.id, 'amplitude', constant(amplitude)),
      component.id,
      'phase',
      constant(phase),
    )

    const tip = tipAt(edited, t)
    expect(tip.x).toBeCloseTo(pointer.x, 1)
    expect(tip.y).toBeCloseTo(pointer.y, 1)
  })

  test('chooses the equivalent phase closest to the current one', () => {
    const component = createDefaultFunction().components[0]
    if (!component) throw new Error('fixture')
    const { phase } = pointerToAmplitudePhase(component, { x: 0, y: 0 }, { x: 1, y: 0.01 }, 0, 720)
    expect(Math.abs(phase - 720)).toBeLessThan(5)
  })

  test('clamps the amplitude to the allowed maximum', () => {
    const component = createDefaultFunction().components[0]
    if (!component) throw new Error('fixture')
    const result = pointerToAmplitudePhase(component, { x: 0, y: 0 }, { x: 1e6, y: 0 }, 0, 0)
    expect(result.amplitude).toBe(100)
  })
})
