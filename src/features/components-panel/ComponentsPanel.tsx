import { MAX_COMPONENTS } from '../../core/ranges'
import {
  selectCanRedo,
  selectCanUndo,
  selectFunction,
  useDocumentStore,
} from '../../state/documentStore'
import { showError } from '../../ui/toastStore'
import { PresetPicker } from '../presets/PresetPicker'
import { ComponentRow } from './ComponentRow'
import './components-panel.css'

export function ComponentsPanel() {
  const components = useDocumentStore((state) => selectFunction(state).components)
  const canUndo = useDocumentStore(selectCanUndo)
  const canRedo = useDocumentStore(selectCanRedo)
  const { addComponent, undo, redo } = useDocumentStore.getState()
  const isFull = components.length >= MAX_COMPONENTS

  const handleAdd = () => {
    const result = addComponent()
    if (!result.ok) showError(result.error.message)
  }

  return (
    <div className="components-panel">
      <header className="components-panel__header">
        <h2 id="components-heading" className="nameplate">
          谐波分量
          <span className="components-panel__count mono">
            {components.length}/{MAX_COMPONENTS}
          </span>
        </h2>
        <div className="components-panel__tools">
          <button type="button" className="button" disabled={!canUndo} onClick={undo}>
            撤销
          </button>
          <button type="button" className="button" disabled={!canRedo} onClick={redo}>
            重做
          </button>
        </div>
      </header>

      <PresetPicker />

      {components.length === 0 ? (
        <p className="components-panel__empty">
          还没有分量. 添加一个旋转向量, 开始搭建你的傅立叶函数.
        </p>
      ) : (
        <ol className="components-panel__list">
          {components.map((component, index) => (
            <ComponentRow
              key={component.id}
              component={component}
              index={index}
              count={components.length}
            />
          ))}
        </ol>
      )}

      <footer className="components-panel__footer">
        <button
          type="button"
          className="button button--primary"
          disabled={isFull}
          aria-describedby={isFull ? 'component-limit' : undefined}
          onClick={handleAdd}
        >
          + 添加分量
        </button>
        {isFull && (
          <p id="component-limit" className="components-panel__limit">
            已达到 {MAX_COMPONENTS} 个分量的上限
          </p>
        )}
      </footer>
    </div>
  )
}
