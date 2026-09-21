import { createInMemoryFunctionRepository } from '../storage/InMemoryFunctionRepository'
import type { FunctionRepository } from '../storage/FunctionRepository'
import { setRepository } from '../storage/repository'
import { resetStores } from '../test/resetStores'
import { useToastStore } from '../ui/toastStore'
import { AUTOSAVE_DELAY_MS, restoreDraft, startAutosave } from './autosave'
import { useDocumentStore } from './documentStore'
import { usePlaybackStore } from './playbackStore'
import { useViewStore } from './viewStore'

let repository: FunctionRepository
let stop: () => void

beforeEach(() => {
  vi.useFakeTimers()
  resetStores()
  repository = createInMemoryFunctionRepository()
  setRepository(repository)
  stop = startAutosave()
})

afterEach(() => {
  stop()
  setRepository(null)
  vi.useRealTimers()
})

describe('autosave', () => {
  test('debounces a burst of edits into a single draft write', async () => {
    const saveDraft = vi.spyOn(repository, 'saveDraft')
    useDocumentStore.getState().addComponent()
    useDocumentStore.getState().addComponent()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(saveDraft).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  test('stores the function, time settings, view and dirty flag, but not isPlaying', async () => {
    useDocumentStore.getState().addComponent()
    usePlaybackStore.getState().seek(3)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    const draft = await repository.loadDraft()
    if (!draft.ok || !draft.value) throw new Error('expected a draft')
    expect(draft.value.function.components).toHaveLength(4)
    expect(draft.value.playback).toEqual({ time: 3, speed: 1, loop: null })
    expect(draft.value.isDirty).toBe(true)
    expect(draft.value).not.toHaveProperty('playback.isPlaying')
  })

  test('does not write on every frame while playing', async () => {
    const saveDraft = vi.spyOn(repository, 'saveDraft')
    usePlaybackStore.getState().play()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    saveDraft.mockClear()
    for (let i = 0; i < 30; i++) usePlaybackStore.getState().tick(1 / 60)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saveDraft).not.toHaveBeenCalled()
  })

  test('reports a failing store once and keeps the edit', async () => {
    vi.spyOn(repository, 'saveDraft').mockResolvedValue({
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE', message: '浏览器存储不可用' },
    })
    useDocumentStore.getState().addComponent()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    useDocumentStore.getState().addComponent()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(useToastStore.getState().messages).toHaveLength(1)
    expect(useDocumentStore.getState().history.present.components).toHaveLength(5)
  })
})

describe('restoreDraft', () => {
  test('restores function, time, view and the dirty flag', async () => {
    useDocumentStore.getState().addComponent()
    usePlaybackStore.getState().seek(4)
    useViewStore.getState().toggle('showGrid')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    resetStores()

    expect(await restoreDraft()).toBe(true)
    expect(useDocumentStore.getState().history.present.components).toHaveLength(4)
    expect(useDocumentStore.getState().hasUnsavedChanges()).toBe(true)
    expect(usePlaybackStore.getState()).toMatchObject({ time: 4, isPlaying: false })
    expect(useViewStore.getState().showGrid).toBe(false)
  })

  test('returns false when there is no draft', async () => {
    expect(await restoreDraft()).toBe(false)
  })

  test('tells the user when the draft is corrupt and keeps the current function', async () => {
    vi.spyOn(repository, 'loadDraft').mockResolvedValue({
      ok: false,
      error: { code: 'DATA_CORRUPT', message: 'x' },
    })
    const before = useDocumentStore.getState().history.present
    expect(await restoreDraft()).toBe(false)
    expect(useDocumentStore.getState().history.present).toBe(before)
    expect(useToastStore.getState().messages[0]?.text).toContain('已损坏')
  })
})
