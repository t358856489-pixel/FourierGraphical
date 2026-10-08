import heartStroke from '../../tests/fixtures/strokes/heart.json'
import { useDocumentStore } from './documentStore'
import { useDrawingStore } from './drawingStore'
import { usePlaybackStore } from './playbackStore'
import { resetStores } from '../test/resetStores'

const raw = (heartStroke as number[][]).map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 }))
const drawing = () => useDrawingStore.getState()

beforeEach(() => {
  resetStores()
  useDrawingStore.getState().exit()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

describe('drawingStore', () => {
  test('enter pauses playback and remembers whether to resume; exit restores it', () => {
    usePlaybackStore.getState().play()
    drawing().enter()
    expect(drawing().isActive).toBe(true)
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
    drawing().exit()
    expect(drawing().isActive).toBe(false)
    expect(usePlaybackStore.getState().isPlaying).toBe(true)
  })

  test('finishing a valid stroke applies a generated function and keeps the raw stroke', () => {
    drawing().enter()
    for (const point of raw) drawing().append(point)
    const result = drawing().finish(600)
    expect(result.ok).toBe(true)
    expect(useDocumentStore.getState().history.present.presentationMode).toBe('drawing2d')
    expect(useDocumentStore.getState().history.present.components.length).toBeGreaterThan(10)
    expect(drawing().lastRaw).toHaveLength(raw.length)
    expect(drawing().stroke).toHaveLength(0)
  })

  test('a too-short stroke is rejected, stays in drawing mode and leaves the document alone', () => {
    const before = useDocumentStore.getState().history.present
    drawing().enter()
    drawing().append({ x: 1, y: 1 })
    drawing().append({ x: 2, y: 2 })
    const result = drawing().finish(600)
    expect(result.ok).toBe(false)
    expect(drawing().isActive).toBe(true)
    expect(useDocumentStore.getState().history.present).toBe(before)
  })

  test('changing smoothing or count previews a re-derived function; committing makes the whole drag one undo step', () => {
    drawing().enter()
    for (const point of raw) drawing().append(point)
    drawing().finish(600)
    const steps = useDocumentStore.getState().history.past.length
    const before = useDocumentStore.getState().history.present
    drawing().setSmoothing(100)
    expect(useDocumentStore.getState().history.present).not.toBe(before)
    drawing().setCount(12)
    expect(useDocumentStore.getState().history.present.components.length).toBeLessThanOrEqual(12)
    // 拖动中只预览: 历史不增长; 松手提交才算一步
    expect(useDocumentStore.getState().history.past).toHaveLength(steps)
    useDocumentStore.getState().commitEdit()
    expect(useDocumentStore.getState().history.past).toHaveLength(steps + 1)
    useDocumentStore.getState().undo()
    expect(useDocumentStore.getState().history.present).toBe(before)
  })

  test('clear empties the current stroke', () => {
    drawing().enter()
    drawing().append({ x: 1, y: 1 })
    drawing().clear()
    expect(drawing().stroke).toHaveLength(0)
  })
})
