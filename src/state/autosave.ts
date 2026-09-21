import type { Draft } from '../core/schema'
import { getRepository } from '../storage/repository'
import { showError } from '../ui/toastStore'
import { useDocumentStore } from './documentStore'
import { usePlaybackStore } from './playbackStore'
import { selectViewSettings, useViewStore } from './viewStore'

export const AUTOSAVE_DELAY_MS = 500

export const currentDraft = (): Draft => {
  const document = useDocumentStore.getState()
  const playback = usePlaybackStore.getState()
  return {
    function: document.history.present,
    // 不保存 isPlaying: 恢复后由启动逻辑决定是否自动播放
    playback: { time: playback.time, speed: playback.speed, loop: playback.loop },
    view: { ...selectViewSettings(useViewStore.getState()), highlightedComponentId: null },
    savedFunctionId: document.savedFunctionId,
    isDirty: document.hasUnsavedChanges(),
  }
}

/** 恢复草稿 (FR-022); 返回是否恢复成功. 失败不影响应用启动. */
export const restoreDraft = async (): Promise<boolean> => {
  const result = await getRepository().loadDraft()
  if (!result.ok) {
    if (result.error.code === 'DATA_CORRUPT') showError('上次的编辑内容已损坏, 无法恢复')
    return false
  }
  const draft = result.value
  if (!draft) return false
  useDocumentStore.getState().loadFunction(draft.function, draft.isDirty, draft.savedFunctionId)
  usePlaybackStore.getState().restore(draft.playback)
  useViewStore.getState().restore(draft.view)
  return true
}

/**
 * 编辑后防抖写入草稿. 播放时 time 每帧都变, 所以只有暂停状态下的时间变化才触发保存.
 * 返回取消订阅的函数.
 */
export const startAutosave = (): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let hasReportedFailure = false

  const flush = async () => {
    timer = null
    const result = await getRepository().saveDraft(currentDraft())
    if (result.ok) {
      hasReportedFailure = false
    } else if (!hasReportedFailure) {
      hasReportedFailure = true
      showError(`无法自动保存: ${result.error.message}`)
    }
  }
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
  }

  const unsubscribers = [
    useDocumentStore.subscribe((state, previous) => {
      if (state.history.present !== previous.history.present) schedule()
    }),
    useViewStore.subscribe(schedule),
    usePlaybackStore.subscribe((state, previous) => {
      const timeChangedWhilePaused = !state.isPlaying && state.time !== previous.time
      const settingsChanged = state.speed !== previous.speed || state.loop !== previous.loop
      if (timeChangedWhilePaused || settingsChanged || state.isPlaying !== previous.isPlaying) schedule()
    }),
  ]
  return () => {
    if (timer) clearTimeout(timer)
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}
