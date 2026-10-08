import { useState } from 'react'
import { Dialog } from '../../ui/Dialog'
import { useDrawingStore } from '../../state/drawingStore'
import { ImportPanel } from './ImportPanel'
import { ShapeLibrary } from './ShapeLibrary'
import { useOverwriteGuard } from './useOverwriteGuard'
import './shapes.css'

type Tab = 'library' | 'draw' | 'import'
const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: 'library', label: '图形库' },
  { id: 'draw', label: '手绘' },
  { id: 'import', label: '导入' },
]

interface ShapeDialogProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

/** "图形"对话框 (功能 003): 图形库 / 手绘 / 导入三个页签, 共用覆盖确认 */
export function ShapeDialog({ isOpen, onClose }: ShapeDialogProps) {
  const [tab, setTab] = useState<Tab>('library')
  const { guard, markGenerated, dialog } = useOverwriteGuard()

  return (
    <Dialog title="图形" isOpen={isOpen} onClose={onClose}>
      <div className="shape-dialog__tabs" role="tablist" aria-label="图形来源">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`shape-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="shape-panel"
            className="shape-dialog__tab"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="shape-panel" role="tabpanel" aria-labelledby={`shape-tab-${tab}`}>
        {tab === 'library' && <ShapeLibrary guard={guard} onApplied={markGenerated} />}
        {tab === 'draw' && (
          <div className="shape-dialog__draw">
            <p className="dialog__message">
              在画布上一笔画出一个闭合的形状, 松手后旋转向量会沿着它描一遍.
              可以之后再调整平滑程度与分量数.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                guard(() => {
                  useDrawingStore.getState().enter()
                  onClose()
                })
              }}
            >
              开始绘制
            </button>
          </div>
        )}
        {tab === 'import' && <ImportPanel guard={guard} onApplied={markGenerated} />}
      </div>
      {dialog}
      <div className="dialog__actions shape-dialog__close">
        <button type="button" className="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </Dialog>
  )
}
