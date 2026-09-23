import { resetStores } from '../test/resetStores'
import { useDocumentStore } from './documentStore'
import { useViewStore } from './viewStore'

const view = () => useViewStore.getState()
const doc = () => useDocumentStore.getState()
const displayOptions = () => {
  const { showVectors, showCircles, showTrail, showGrid, showAxes, trailFade, trailRetention, background } = view()
  return { showVectors, showCircles, showTrail, showGrid, showAxes, trailFade, trailRetention, background }
}

beforeEach(resetStores)

describe('display options', () => {
  test('start from the documented defaults', () => {
    expect(displayOptions()).toMatchObject({ showAxes: true, trailFade: true, trailRetention: 'all', background: null })
  })

  test('toggles flip only their own field', () => {
    view().toggle('showAxes')
    view().toggle('trailFade')
    expect(displayOptions()).toMatchObject({ showAxes: false, trailFade: false, showGrid: true })
  })

  test('retention and background can be set', () => {
    view().setTrailRetention(30)
    const result = view().setBackground('#FFF')
    expect(result.ok).toBe(true)
    expect(displayOptions()).toMatchObject({ trailRetention: 30, background: '#ffffff' })
    view().setBackground(null)
    expect(view().background).toBeNull()
  })

  test('an invalid background is refused, explained, and leaves the state alone', () => {
    view().setBackground('#123456')
    const result = view().setBackground('red')
    expect(result.ok === false && result.error.message).toContain('#RRGGBB')
    expect(view().background).toBe('#123456')
  })
})

describe('display options belong to the app, not to a function (FR-023a, FR-025)', () => {
  test('changing them neither adds undo steps nor marks the function as unsaved', () => {
    const history = doc().history
    view().toggle('showAxes')
    view().toggle('trailFade')
    view().setTrailRetention(60)
    view().setBackground('#ffffff')
    expect(doc().history).toBe(history)
    expect(doc().hasUnsavedChanges()).toBe(false)
  })

  test('loading, saving and presets leave them untouched', () => {
    view().toggle('showGrid')
    view().setBackground('#000000')
    view().setTrailRetention(10)
    const before = displayOptions()
    doc().applyPreset('square', 5, 'commit')
    doc().markSaved(doc().history.present)
    doc().loadFunction(doc().history.present, false, null)
    doc().undo()
    expect(displayOptions()).toEqual(before)
  })
})
