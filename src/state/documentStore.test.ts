import { createDefaultFunction } from '../core/function'
import { constant } from '../core/types'
import { useDocumentStore } from './documentStore'

const store = () => useDocumentStore.getState()
const firstId = () => store().history.present.components[0]?.id ?? ''

beforeEach(() => {
  store().loadFunction(createDefaultFunction(), false)
})

describe('documentStore', () => {
  test('a drag made of many previews followed by commitEdit adds exactly one undo step', () => {
    const before = store().history.present
    for (const value of [1.1, 1.2, 1.3]) {
      store().setParamValue(firstId(), 'amplitude', value, 0, 'preview')
    }
    expect(store().history.past).toHaveLength(0)
    expect(store().history.present.components[0]?.amplitude).toEqual(constant(1.3))

    store().commitEdit()
    expect(store().history.past).toEqual([before])

    store().undo()
    expect(store().history.present).toBe(before)
  })

  test('commitEdit without a pending preview does nothing', () => {
    const history = store().history
    store().commitEdit()
    expect(store().history).toBe(history)
  })

  test('a committed edit is one step and can be redone', () => {
    store().setParamValue(firstId(), 'phase', 45, 0, 'commit')
    const edited = store().history.present
    store().undo()
    store().redo()
    expect(store().history.present).toBe(edited)
  })

  test('a failed edit leaves the state untouched and reports the error', () => {
    const history = store().history
    const result = store().setParamValue(firstId(), 'amplitude', 1e9, 0, 'commit')
    expect(result.ok === false && result.error.code).toBe('OUT_OF_RANGE')
    expect(store().history).toBe(history)
  })

  test('switching the presentation mode is not an undo step', () => {
    store().setPresentationMode('drawing2d')
    expect(store().history.past).toHaveLength(0)
    expect(store().history.present.presentationMode).toBe('drawing2d')
  })

  test('undo and redo never change the current presentation mode', () => {
    store().setParamValue(firstId(), 'phase', 45, 0, 'commit')
    store().setPresentationMode('drawing2d')
    store().undo()
    expect(store().history.present.presentationMode).toBe('drawing2d')
    expect(store().history.present.components[0]?.phase).toEqual(constant(0))
    store().redo()
    expect(store().history.present.presentationMode).toBe('drawing2d')
  })

  test('adding beyond the component limit reports the error', () => {
    let last = store().addComponent()
    for (let i = 0; i < 60 && last.ok; i++) last = store().addComponent()
    expect(last.ok === false && last.error.code).toBe('COMPONENT_LIMIT')
    expect(store().history.present.components).toHaveLength(50)
  })

  test('tracks unsaved changes against the last saved reference', () => {
    expect(store().hasUnsavedChanges()).toBe(false)
    store().setParamValue(firstId(), 'phase', 45, 0, 'commit')
    expect(store().hasUnsavedChanges()).toBe(true)
    store().undo()
    expect(store().hasUnsavedChanges()).toBe(false)
    store().loadFunction(createDefaultFunction(), true)
    expect(store().hasUnsavedChanges()).toBe(true)
  })

  test('remove, enable and move are undoable edits', () => {
    const id = firstId()
    store().setEnabled(id, false)
    store().moveComponent(id, 2)
    store().removeComponent(id)
    expect(store().history.present.components).toHaveLength(2)
    expect(store().history.past).toHaveLength(3)
  })
})

describe('documentStore: actions arriving while a drag preview is open', () => {
  const amplitudeOf = () => store().history.present.components[0]?.amplitude

  test('undo during a drag only removes the drag, never an earlier committed step', () => {
    store().addComponent()
    const afterAdd = store().history.present
    store().setParamValue(firstId(), 'amplitude', 2, 0, 'preview')
    store().setParamValue(firstId(), 'amplitude', 3, 0, 'preview')
    const midDrag = store().history.present

    store().undo()
    expect(store().history.present).toBe(afterAdd)
    store().redo()
    expect(store().history.present).toBe(midDrag)
    store().undo()
    store().undo()
    expect(store().history.present.components).toHaveLength(3)
  })

  test('a pointer-up arriving after that undo does not resurrect the drag', () => {
    const before = store().history.present
    store().setParamValue(firstId(), 'amplitude', 2, 0, 'preview')
    store().undo()
    store().commitEdit()
    expect(store().history.present).toBe(before)
  })

  test('an unrelated committed action does not merge with an open preview', () => {
    store().setParamValue(firstId(), 'amplitude', 2, 0, 'preview')
    store().addComponent()
    store().undo()
    expect(store().history.present.components).toHaveLength(3)
    expect(amplitudeOf()).toEqual(constant(2))
    store().undo()
    expect(amplitudeOf()).not.toEqual(constant(2))
  })
})
