import { useCallback, useEffect, useState } from 'react'
import type { FunctionSummary } from '../../storage/FunctionRepository'
import { getRepository } from '../../storage/repository'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { ConfirmDialog, Dialog } from '../../ui/Dialog'
import { showError, showInfo } from '../../ui/toastStore'
import './library.css'

type Pending =
  | { readonly kind: 'open'; readonly item: FunctionSummary }
  | { readonly kind: 'remove'; readonly item: FunctionSummary }

const formatDate = (iso: string): string => iso.slice(0, 16).replace('T', ' ')

const loadSummaries = async (): Promise<readonly FunctionSummary[] | null> => {
  const result = await getRepository().findAll()
  if (result.ok) return result.value
  showError(result.error.message)
  return null
}

function useSummaries(isOpen: boolean) {
  const [items, setItems] = useState<readonly FunctionSummary[]>([])
  const refresh = useCallback(async () => {
    const next = await loadSummaries()
    if (next) setItems(next)
  }, [])
  useEffect(() => {
    if (!isOpen) return
    let isCurrent = true
    void loadSummaries().then((next) => {
      if (isCurrent && next) setItems(next)
    })
    return () => {
      isCurrent = false
    }
  }, [isOpen])
  return { items, refresh }
}

interface RowProps {
  readonly item: FunctionSummary
  readonly onOpen: () => void
  readonly onRename: (name: string) => void
  readonly onRemove: () => void
}

function LibraryRow({ item, onOpen, onRename, onRemove }: RowProps) {
  const [draftName, setDraftName] = useState<string | null>(null)
  return (
    <li className="library__row">
      {draftName === null ? (
        <span className="library__name">{item.readable ? item.name : '无法读取'}</span>
      ) : (
        <form
          className="library__rename"
          onSubmit={(event) => {
            event.preventDefault()
            onRename(draftName)
            setDraftName(null)
          }}
        >
          <input
            aria-label={`${item.name}的新名称`}
            value={draftName}
            maxLength={60}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button type="submit" className="button">
            确定
          </button>
        </form>
      )}
      <time className="library__date mono" dateTime={item.updatedAt}>
        {formatDate(item.updatedAt)}
      </time>
      <div className="library__actions">
        <button type="button" className="button" disabled={!item.readable} onClick={onOpen}>
          打开<span className="visually-hidden">{item.name}</span>
        </button>
        <button
          type="button"
          className="button"
          disabled={!item.readable}
          onClick={() => setDraftName(item.name)}
        >
          重命名<span className="visually-hidden">{item.name}</span>
        </button>
        <button type="button" className="button button--danger" onClick={onRemove}>
          删除<span className="visually-hidden">{item.name}</span>
        </button>
      </div>
    </li>
  )
}

interface LibraryProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

/** "我的函数" (FR-021): 列出、打开、重命名、删除已保存的函数 */
export function Library({ isOpen, onClose }: LibraryProps) {
  const { items, refresh } = useSummaries(isOpen)
  const [pending, setPending] = useState<Pending | null>(null)
  const currentId = useDocumentStore((state) => state.savedFunctionId)

  const open = async (item: FunctionSummary) => {
    const result = await getRepository().findById(item.id)
    if (!result.ok) return showError(result.error.message)
    useDocumentStore.getState().loadFunction(result.value, false, result.value.id)
    usePlaybackStore.getState().reset()
    onClose()
  }

  const requestOpen = (item: FunctionSummary) => {
    if (useDocumentStore.getState().hasUnsavedChanges()) setPending({ kind: 'open', item })
    else void open(item)
  }

  const rename = async (item: FunctionSummary, name: string) => {
    const result = await getRepository().rename(item.id, name)
    if (!result.ok) return showError(result.error.message)
    if (item.id === currentId) useDocumentStore.getState().rename(name)
    await refresh()
  }

  const remove = async (item: FunctionSummary) => {
    const result = await getRepository().remove(item.id)
    if (!result.ok) return showError(result.error.message)
    showInfo(`已删除"${item.name}"`)
    await refresh()
  }

  const confirm = () => {
    if (pending?.kind === 'open') void open(pending.item)
    if (pending?.kind === 'remove') void remove(pending.item)
    setPending(null)
  }

  return (
    <Dialog title="我的函数" isOpen={isOpen} onClose={onClose}>
      {items.length === 0 ? (
        <p className="dialog__message">还没有保存过函数. 保存后的函数只存在于这个浏览器里.</p>
      ) : (
        <ul className="library__list">
          {items.map((item) => (
            <LibraryRow
              key={item.id}
              item={item}
              onOpen={() => requestOpen(item)}
              onRename={(name) => void rename(item, name)}
              onRemove={() => setPending({ kind: 'remove', item })}
            />
          ))}
        </ul>
      )}
      <div className="dialog__actions">
        <button type="button" className="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <ConfirmDialog
        title={pending?.kind === 'remove' ? '删除这个函数?' : '放弃未保存的修改?'}
        message={
          pending?.kind === 'remove'
            ? `"${pending.item.name}"将被永久删除, 无法恢复.`
            : '当前函数有尚未保存的修改, 打开另一个函数会丢弃它们.'
        }
        confirmLabel={pending?.kind === 'remove' ? '删除' : '放弃并打开'}
        isOpen={pending !== null}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </Dialog>
  )
}

export const useFunctionName = (): string => useDocumentStore((state) => selectFunction(state).name)
