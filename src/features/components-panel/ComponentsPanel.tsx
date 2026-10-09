import { MAX_COMPONENTS } from '../../core/ranges'
import {
  selectCanRedo,
  selectCanUndo,
  selectFunction,
  useDocumentStore,
} from '../../state/documentStore'
import { useExpressionStore } from '../../state/expressionStore'
import { showError } from '../../ui/toastStore'
import { EXPRESSION_PANEL_ID, ExpressionPanel } from '../expression/ExpressionPanel'
import { PresetPicker } from '../presets/PresetPicker'
import { ShapeDialog } from '../shapes/ShapeDialog'
import { useRef, useState } from 'react'
import { ComponentRow } from './ComponentRow'
import { VIRTUALIZE_FROM, VirtualList } from './VirtualList'

/** 虚拟化时的固定行高(CSS 像素): 头部 + 三个参数行 + 内边距 */
const ROW_HEIGHT = 156
const LIST_HEIGHT = 640
import './components-panel.css'

export function ComponentsPanel() {
  const components = useDocumentStore((state) => selectFunction(state).components)
  const canUndo = useDocumentStore(selectCanUndo)
  const canRedo = useDocumentStore(selectCanRedo)
  const { addComponent, undo, redo } = useDocumentStore.getState()
  const isFull = components.length >= MAX_COMPONENTS
  const [isShapeOpen, setShapeOpen] = useState(false)
  const isExpressionOpen = useExpressionStore((state) => state.isOpen)
  const toggleExpression = useExpressionStore((state) => state.toggleOpen)
  const expressionButtonRef = useRef<HTMLButtonElement | null>(null)
  const collapseExpression = () => {
    toggleExpression()
    expressionButtonRef.current?.focus()
  }

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
          <button
            ref={expressionButtonRef}
            type="button"
            className="button"
            aria-expanded={isExpressionOpen}
            aria-controls={EXPRESSION_PANEL_ID}
            onClick={toggleExpression}
          >
            表达式
          </button>
          <button type="button" className="button" onClick={() => setShapeOpen(true)}>
            图形
          </button>
          <button type="button" className="button" disabled={!canUndo} onClick={undo}>
            撤销
          </button>
          <button type="button" className="button" disabled={!canRedo} onClick={redo}>
            重做
          </button>
        </div>
      </header>

      <div className="components-panel__stack">
        <PresetPicker />
        {isExpressionOpen && <ExpressionPanel onCollapse={collapseExpression} />}
      </div>
      <ShapeDialog isOpen={isShapeOpen} onClose={() => setShapeOpen(false)} />

      {components.length === 0 ? (
        <p className="components-panel__empty">
          还没有分量. 添加一个旋转向量, 开始搭建你的傅立叶函数.
        </p>
      ) : components.length >= VIRTUALIZE_FROM ? (
        <VirtualList
          items={components}
          rowHeight={ROW_HEIGHT}
          viewportHeight={LIST_HEIGHT}
          listClassName="components-panel__list components-panel__list--virtual"
          renderRow={(component, index, style) => (
            <ComponentRow
              key={component.id}
              component={component}
              index={index}
              count={components.length}
              style={style}
            />
          )}
        />
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
