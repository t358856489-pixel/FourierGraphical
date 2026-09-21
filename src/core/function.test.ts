import {
  addComponent,
  createDefaultFunction,
  moveComponent,
  removeComponent,
  rename,
  setComponentEnabled,
  setPresentationMode,
  updateTrack,
} from './function'
import { MAX_COMPONENTS } from './ranges'
import { constant, type FourierFunction } from './types'

const unwrap = (result: ReturnType<typeof addComponent>): FourierFunction => {
  if (!result.ok) throw new Error('expected ok')
  return result.value
}

describe('createDefaultFunction', () => {
  test('provides a non-empty example with three enabled components', () => {
    const fn = createDefaultFunction()
    expect(fn.components).toHaveLength(3)
    expect(fn.components.every((component) => component.enabled)).toBe(true)
    expect(fn.schemaVersion).toBe(1)
    expect(fn.presentationMode).toBe('waveform')
  })

  test('gives every component a distinct id', () => {
    const ids = createDefaultFunction().components.map((component) => component.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('addComponent', () => {
  test('appends a component with the documented defaults and the next colour', () => {
    const fn = createDefaultFunction()
    const next = unwrap(addComponent(fn))
    const added = next.components.at(-1)
    expect(next.components).toHaveLength(4)
    expect(added?.amplitude).toEqual(constant(1))
    expect(added?.frequency.kind === 'constant' && added.frequency.value).toBeCloseTo(0.8, 10)
    expect(added?.phase).toEqual(constant(0))
    expect(added?.enabled).toBe(true)
    expect(added?.color).toBe('c3')
  })

  test('keeps existing components reference-equal', () => {
    const fn = createDefaultFunction()
    const next = unwrap(addComponent(fn))
    expect(next.components[0]).toBe(fn.components[0])
  })

  test('refuses the 51st component', () => {
    let fn = createDefaultFunction()
    while (fn.components.length < MAX_COMPONENTS) fn = unwrap(addComponent(fn))
    const result = addComponent(fn)
    expect(result.ok === false && result.error.code).toBe('COMPONENT_LIMIT')
  })
})

describe('component edits', () => {
  const fn = createDefaultFunction()
  const [first, second, third] = fn.components
  if (!first || !second || !third) throw new Error('fixture')

  test('removeComponent drops only the target', () => {
    const next = removeComponent(fn, second.id)
    expect(next.components).toEqual([first, third])
    expect(fn.components).toHaveLength(3)
  })

  test('setComponentEnabled toggles only the target and keeps others reference-equal', () => {
    const next = setComponentEnabled(fn, second.id, false)
    expect(next.components[1]?.enabled).toBe(false)
    expect(next.components[0]).toBe(first)
  })

  test('setComponentEnabled returns the same function when nothing changes', () => {
    expect(setComponentEnabled(fn, second.id, true)).toBe(fn)
  })

  test('moveComponent reorders and clamps the target index', () => {
    expect(moveComponent(fn, first.id, 2).components.map((c) => c.id)).toEqual([
      second.id,
      third.id,
      first.id,
    ])
    expect(moveComponent(fn, third.id, -5).components[0]?.id).toBe(third.id)
  })

  test('updateTrack replaces one parameter track', () => {
    const next = updateTrack(fn, first.id, 'amplitude', constant(9))
    expect(next.components[0]?.amplitude).toEqual(constant(9))
    expect(next.components[0]?.frequency).toBe(first.frequency)
    expect(next.components[1]).toBe(second)
  })

  test('edits targeting an unknown id return the same function', () => {
    expect(removeComponent(fn, 'missing')).toBe(fn)
    expect(updateTrack(fn, 'missing', 'phase', constant(1))).toBe(fn)
    expect(moveComponent(fn, 'missing', 0)).toBe(fn)
  })

  test('setPresentationMode changes only the mode', () => {
    const next = setPresentationMode(fn, 'drawing2d')
    expect(next.presentationMode).toBe('drawing2d')
    expect(next.components).toBe(fn.components)
    expect(setPresentationMode(fn, 'waveform')).toBe(fn)
  })
})

describe('rename', () => {
  const fn = createDefaultFunction()

  test('trims surrounding whitespace', () => {
    const result = rename(fn, '  我的方波  ')
    expect(result.ok && result.value.name).toBe('我的方波')
  })

  test.each(['', '   ', 'x'.repeat(61)])('rejects invalid name %j', (name) => {
    const result = rename(fn, name)
    expect(result.ok === false && result.error.code).toBe('INVALID_NAME')
  })
})
