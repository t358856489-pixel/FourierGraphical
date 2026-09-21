import { useEffect, useMemo, useState } from 'react'
import { ExportDialog } from './features/export-dialog/ExportDialog'
import { Library } from './features/library/Library'
import { SaveDialog } from './features/library/SaveDialog'
import { ComponentsPanel } from './features/components-panel/ComponentsPanel'
import { Stage } from './features/stage/Stage'
import { StageToolbar } from './features/stage/StageToolbar'
import { Timeline } from './features/timeline/Timeline'
import { TransportBar } from './features/transport/TransportBar'
import { prefersReducedMotion } from './hooks/useReducedMotion'
import { useKeyboardShortcuts, type Shortcut } from './hooks/useKeyboardShortcuts'
import { selectFunction, useDocumentStore } from './state/documentStore'
import { usePlaybackStore } from './state/playbackStore'
import { ToastRegion } from './ui/ToastRegion'
import './app.css'

type OpenDialog = 'save' | 'library' | 'export' | null

function DocumentBar({ onOpen }: { readonly onOpen: (dialog: OpenDialog) => void }) {
  const name = useDocumentStore((state) => selectFunction(state).name)
  const isDirty = useDocumentStore((state) => state.lastSavedRef !== state.history.present)
  return (
    <div className="app__document">
      <span className="app__document-name" data-dirty={isDirty}>
        {name}
        {isDirty && <span className="visually-hidden">(有未保存的修改)</span>}
      </span>
      <button type="button" className="button" onClick={() => onOpen('save')}>
        保存
      </button>
      <button type="button" className="button" onClick={() => onOpen('library')}>
        我的函数
      </button>
      <button type="button" className="button" onClick={() => onOpen('export')}>
        导出
      </button>
    </div>
  )
}

export function App() {
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const close = () => setDialog(null)
  const shortcuts = useMemo<readonly Shortcut[]>(
    () => [
      { key: 'z', mod: true, run: () => useDocumentStore.getState().undo() },
      { key: 'z', mod: true, shift: true, run: () => useDocumentStore.getState().redo() },
      { key: ' ', run: () => usePlaybackStore.getState().toggle() },
      { key: 'ArrowLeft', run: () => usePlaybackStore.getState().step(-1) },
      { key: 'ArrowRight', run: () => usePlaybackStore.getState().step(1) },
      { key: 'Home', run: () => usePlaybackStore.getState().reset() },
    ],
    [],
  )
  useKeyboardShortcuts(shortcuts)

  // 打开后自动播放 (FR-013a), 除非用户开启了"减少动态效果" (FR-025)
  useEffect(() => {
    if (!prefersReducedMotion()) usePlaybackStore.getState().play()
  }, [])

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          傅立叶函数<span>可视化编辑器</span>
        </h1>
        <DocumentBar onOpen={setDialog} />
      </header>
      <main className="app__main">
        <section className="app__stage" aria-labelledby="stage-heading">
          <h2 id="stage-heading" className="visually-hidden">
            图形
          </h2>
          <StageToolbar />
          <Stage />
        </section>
        <section className="app__panel" aria-labelledby="components-heading">
          <ComponentsPanel />
        </section>
        <section className="app__time" aria-labelledby="time-heading">
          <h2 id="time-heading" className="visually-hidden">
            时间
          </h2>
          <TransportBar />
          <Timeline />
        </section>
      </main>
      {dialog === 'save' && <SaveDialog isOpen onClose={close} />}
      <Library isOpen={dialog === 'library'} onClose={close} />
      <ExportDialog isOpen={dialog === 'export'} onClose={close} />
      <ToastRegion />
    </div>
  )
}
