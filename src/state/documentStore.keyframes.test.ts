import { createDefaultFunction } from '../core/function'
import { animated, constant } from '../core/types'
import { useDocumentStore } from './documentStore'

const store = () => useDocumentStore.getState()
const first = () => store().history.present.components[0]
const id = () => first()?.id ?? ''

beforeEach(() => store().loadFunction(createDefaultFunction(), false))

describe('documentStore keyframes', () => {
  test('each keyframe operation is one undoable step', () => {
    store().addKeyframe(id(), 'amplitude', 0)
    store().setParamValue(id(), 'amplitude', 2, 5, 'commit')
    store().setKeyframeEasing(id(), 'amplitude', 0, 'smooth')
    store().moveKeyframe(id(), 'amplitude', 5, 6, 'commit')
    store().removeKeyframe(id(), 'amplitude', 0)
    expect(store().history.past).toHaveLength(5)
    expect(first()?.amplitude).toEqual(animated([{ time: 6, value: 2, easing: 'linear' }]))
  })

  test('editing an animated parameter at a free time adds a keyframe, at a taken time updates it', () => {
    store().addKeyframe(id(), 'phase', 0)
    store().setParamValue(id(), 'phase', 90, 4, 'commit')
    store().setParamValue(id(), 'phase', 45, 4, 'commit')
    expect(first()?.phase).toEqual(
      animated([
        { time: 0, value: 0, easing: 'linear' },
        { time: 4, value: 45, easing: 'linear' },
      ]),
    )
  })

  test('dragging a keyframe previews and commits as a single step', () => {
    store().addKeyframe(id(), 'phase', 1)
    const steps = store().history.past.length
    store().moveKeyframe(id(), 'phase', 1, 1.5, 'preview')
    store().moveKeyframe(id(), 'phase', 1.5, 2, 'preview')
    store().commitEdit()
    expect(store().history.past).toHaveLength(steps + 1)
  })

  test('removing the last keyframe restores a constant, and undo brings the keyframe back', () => {
    store().addKeyframe(id(), 'amplitude', 2)
    const animatedTrack = first()?.amplitude
    store().removeKeyframe(id(), 'amplitude', 2)
    expect(first()?.amplitude.kind).toBe('constant')
    store().undo()
    expect(first()?.amplitude).toBe(animatedTrack)
  })

  test('undoing the deletion of a component restores its keyframes', () => {
    store().addKeyframe(id(), 'frequency', 3)
    const component = first()
    store().removeComponent(id())
    store().undo()
    expect(first()).toBe(component)
  })

  test('errors leave the document untouched', () => {
    const history = store().history
    const result = store().removeKeyframe(id(), 'amplitude', 9)
    expect(result.ok).toBe(false)
    expect(store().editTrack('missing', 'phase', () => ({ ok: true, value: constant(0) }), 'commit').ok).toBe(false)
    expect(store().history).toBe(history)
  })
})
