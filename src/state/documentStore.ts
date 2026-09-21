import { create } from 'zustand'
import type { PresetId } from '../core/presets'
import {
  addComponent,
  applyPreset,
  createDefaultFunction,
  findComponent,
  moveComponent,
  removeComponent,
  rename,
  setComponentEnabled,
  setPresentationMode,
  updateTrack,
} from '../core/function'
import { commit, createHistory, redo, undo } from '../core/history'
import { rangeOf } from '../core/ranges'
import { addKeyframe, moveKeyframe, removeKeyframe, setEasing, setValueAt } from '../core/tracks'
import {
  err,
  ok,
  type FourierFunction,
  type Easing,
  type History,
  type ParamName,
  type ParamTrack,
  type PresentationMode,
  type Result,
} from '../core/types'

/** preview: 拖拽中, 只替换 present; commit: 立即成为一步撤销 */
export type EditMode = 'preview' | 'commit'

interface DocumentState {
  readonly history: History
  /** 一次拖拽开始前的文档; commitEdit 时以它为撤销点 */
  readonly editBase: FourierFunction | null
  /** 上次保存/加载时的引用; null 表示恢复的草稿本身就带有未保存修改 */
  readonly lastSavedRef: FourierFunction | null
  /** 当前文档在函数库中的 id; null 表示从未保存过 */
  readonly savedFunctionId: string | null
}

interface DocumentActions {
  readonly applyEdit: (next: FourierFunction, mode: EditMode) => void
  readonly commitEdit: () => void
  readonly setParamValue: (
    componentId: string,
    param: ParamName,
    value: number,
    t: number,
    mode: EditMode,
  ) => Result<FourierFunction>
  readonly editTrack: (
    componentId: string,
    param: ParamName,
    edit: (track: ParamTrack) => Result<ParamTrack>,
    mode: EditMode,
  ) => Result<FourierFunction>
  readonly addKeyframe: (componentId: string, param: ParamName, t: number) => Result<FourierFunction>
  readonly moveKeyframe: (
    componentId: string,
    param: ParamName,
    from: number,
    to: number,
    mode: EditMode,
  ) => Result<FourierFunction>
  readonly removeKeyframe: (
    componentId: string,
    param: ParamName,
    t: number,
  ) => Result<FourierFunction>
  readonly setKeyframeEasing: (
    componentId: string,
    param: ParamName,
    t: number,
    easing: Easing,
  ) => Result<FourierFunction>
  readonly addComponent: () => Result<FourierFunction>
  readonly applyPreset: (preset: PresetId, count: number, mode: EditMode) => Result<FourierFunction>
  readonly removeComponent: (componentId: string) => void
  readonly setEnabled: (componentId: string, enabled: boolean) => void
  readonly moveComponent: (componentId: string, toIndex: number) => void
  readonly setPresentationMode: (mode: PresentationMode) => void
  readonly undo: () => void
  readonly redo: () => void
  readonly loadFunction: (fn: FourierFunction, isDirty: boolean, savedFunctionId?: string | null) => void
  readonly rename: (name: string) => Result<FourierFunction>
  readonly markSaved: (fn: FourierFunction) => void
  readonly hasUnsavedChanges: () => boolean
}

// 撤销永远不改变呈现模式: 它是视图行为, 却位于快照之内 (data-model "呈现模式与撤销")
const keepMode = (history: History, mode: PresentationMode): History => ({
  ...history,
  present: setPresentationMode(history.present, mode),
})

/** 把进行中的预览折叠为历史中的一步; 没有预览时原样返回 */
const settlePreview = (state: DocumentState): History =>
  state.editBase
    ? commit({ ...state.history, present: state.editBase }, state.history.present)
    : state.history

const initialFunction = createDefaultFunction()

export const useDocumentStore = create<DocumentState & DocumentActions>()((set, get) => ({
  history: createHistory(initialFunction),
  editBase: null,
  // 未经修改的示例函数不算"有未保存修改"
  lastSavedRef: initialFunction,
  savedFunctionId: null,

  applyEdit: (next, mode) =>
    set((state) => {
      if (mode === 'preview') {
        return {
          editBase: state.editBase ?? state.history.present,
          history: { ...state.history, present: next },
        }
      }
      // 提交型操作不属于任何拖拽: 先把未结束的预览结算成独立的一步, 再提交自己
      return { editBase: null, history: commit(settlePreview(state), next) }
    }),

  commitEdit: () => set((state) => ({ editBase: null, history: settlePreview(state) })),

  editTrack: (componentId, param, edit, mode) => {
    const fn = get().history.present
    const component = findComponent(fn, componentId)
    if (!component) return err('NOT_FOUND', '找不到该分量')
    const track = edit(component[param])
    if (!track.ok) return track
    const next = updateTrack(fn, componentId, param, track.value)
    get().applyEdit(next, mode)
    return ok(next)
  },

  setParamValue: (componentId, param, value, t, mode) =>
    get().editTrack(componentId, param, (track) => setValueAt(track, t, value, rangeOf(param)), mode),

  addKeyframe: (componentId, param, t) =>
    get().editTrack(componentId, param, (track) => addKeyframe(track, t, rangeOf(param)), 'commit'),

  moveKeyframe: (componentId, param, from, to, mode) =>
    get().editTrack(componentId, param, (track) => moveKeyframe(track, from, to), mode),

  removeKeyframe: (componentId, param, t) =>
    get().editTrack(componentId, param, (track) => removeKeyframe(track, t), 'commit'),

  setKeyframeEasing: (componentId, param, t, easing) =>
    get().editTrack(componentId, param, (track) => setEasing(track, t, easing), 'commit'),

  addComponent: () => {
    const result = addComponent(get().history.present)
    if (result.ok) get().applyEdit(result.value, 'commit')
    return result
  },

  applyPreset: (preset, count, mode) => {
    const result = applyPreset(get().history.present, preset, count)
    if (result.ok) get().applyEdit(result.value, mode)
    return result
  },

  removeComponent: (componentId) =>
    get().applyEdit(removeComponent(get().history.present, componentId), 'commit'),

  setEnabled: (componentId, enabled) =>
    get().applyEdit(setComponentEnabled(get().history.present, componentId, enabled), 'commit'),

  moveComponent: (componentId, toIndex) =>
    get().applyEdit(moveComponent(get().history.present, componentId, toIndex), 'commit'),

  setPresentationMode: (mode) =>
    set((state) => {
      const wasClean = state.lastSavedRef === state.history.present
      const history = keepMode(state.history, mode)
      // 切换模式会产生新的文档对象; 若此前无未保存修改, 让保存引用跟随, 不因切换视图而变脏
      return { history, lastSavedRef: wasClean ? history.present : state.lastSavedRef }
    }),

  // 拖拽中按下撤销: 先结算预览, 这样撤销只去掉这次拖拽, 不会吞掉更早的一步
  undo: () =>
    set((state) => ({
      editBase: null,
      history: keepMode(undo(settlePreview(state)), state.history.present.presentationMode),
    })),

  redo: () =>
    set((state) => ({
      editBase: null,
      history: keepMode(redo(settlePreview(state)), state.history.present.presentationMode),
    })),

  loadFunction: (fn, isDirty, savedFunctionId = null) =>
    set({
      history: createHistory(fn),
      editBase: null,
      lastSavedRef: isDirty ? null : fn,
      savedFunctionId,
    }),

  // 名称随保存而定, 不是一步可撤销的编辑
  rename: (name) => {
    const result = rename(get().history.present, name)
    if (result.ok) set((state) => ({ history: { ...state.history, present: result.value } }))
    return result
  },

  // 保存会盖上新的 updatedAt: 让 present 跟随保存结果, 否则会立刻又被判为"有未保存修改"
  markSaved: (fn) =>
    set((state) => ({
      history: { ...state.history, present: fn },
      lastSavedRef: fn,
      savedFunctionId: fn.id,
    })),

  hasUnsavedChanges: () => get().lastSavedRef !== get().history.present,
}))

export const selectFunction = (state: DocumentState): FourierFunction => state.history.present
export const selectCanUndo = (state: DocumentState): boolean => state.history.past.length > 0
export const selectCanRedo = (state: DocumentState): boolean => state.history.future.length > 0
