import { useState } from 'react'
import { rename } from '../../core/function'
import { MAX_NAME_LENGTH } from '../../core/ranges'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { getRepository } from '../../storage/repository'
import { Dialog } from '../../ui/Dialog'
import { showInfo } from '../../ui/toastStore'

interface SaveDialogProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

/** 保存并命名. 已保存过的函数可选择覆盖原条目或另存为新条目. */
export function SaveDialog({ isOpen, onClose }: SaveDialogProps) {
  const fn = useDocumentStore(selectFunction)
  const savedId = useDocumentStore((state) => state.savedFunctionId)
  const [name, setName] = useState(fn.name)
  const [error, setError] = useState<string | null>(null)

  const save = async (asCopy: boolean) => {
    const named = rename(fn, name)
    if (!named.ok) return setError(named.error.message)
    const target = asCopy ? { ...named.value, id: crypto.randomUUID() } : named.value
    const result = await getRepository().save(target)
    // 保存失败时明确说明原因, 且不丢失正在编辑的内容 (边界情况: 存储不可用)
    if (!result.ok) return setError(`保存失败: ${result.error.message}`)
    useDocumentStore.getState().markSaved(result.value)
    showInfo(`已保存"${result.value.name}"`)
    setError(null)
    onClose()
  }

  return (
    <Dialog title="保存函数" isOpen={isOpen} onClose={onClose}>
      <form
        className="save-dialog"
        onSubmit={(event) => {
          event.preventDefault()
          void save(false)
        }}
      >
        <label className="save-dialog__field">
          <span className="nameplate">名称</span>
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            aria-invalid={error !== null}
            aria-describedby={error ? 'save-error' : undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error && (
          <p id="save-error" className="save-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          {savedId && (
            <button type="button" className="button" onClick={() => void save(true)}>
              另存为新函数
            </button>
          )}
          <button type="submit" className="button button--primary">
            保存
          </button>
        </div>
      </form>
    </Dialog>
  )
}
