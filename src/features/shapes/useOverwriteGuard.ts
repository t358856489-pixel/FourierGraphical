import { useState, type ReactNode } from 'react'
import { createElement } from 'react'
import type { FourierFunction } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { ConfirmDialog } from '../../ui/Dialog'
import { isUntouchedGenerated, rememberGenerated } from './generatedMark'

interface OverwriteGuard {
  /** 有未保存修改时先确认, 否则立即执行 */
  readonly guard: (action: () => void) => void
  /** 记下"刚由系统生成、用户尚未改动"的文档: 从它出发再次替换不需要确认 */
  readonly markGenerated: (fn: FourierFunction) => void
  readonly dialog: ReactNode
}

interface Texts {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
}

const DEFAULT_TEXTS: Texts = {
  title: '替换当前函数?',
  message: '这会替换全部分量, 它们的关键帧和尚未保存的修改都会被丢弃. 之后仍可用撤销恢复.',
  confirmLabel: '替换',
}

/** 预设波形与图形生成共用的覆盖确认 (FR-020 / 功能 003 FR-006) */
export const useOverwriteGuard = (texts: Texts = DEFAULT_TEXTS): OverwriteGuard => {
  const [pending, setPending] = useState<(() => void) | null>(null)

  const guard = (action: () => void) => {
    const { hasUnsavedChanges, history } = useDocumentStore.getState()
    if (hasUnsavedChanges() && !isUntouchedGenerated(history.present)) setPending(() => action)
    else action()
  }

  const dialog = createElement(ConfirmDialog, {
    ...texts,
    isOpen: pending !== null,
    onCancel: () => setPending(null),
    onConfirm: () => {
      pending?.()
      setPending(null)
    },
  })

  return {
    guard,
    markGenerated: rememberGenerated,
    dialog,
  }
}
