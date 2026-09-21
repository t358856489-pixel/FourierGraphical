import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDefaultFunction, rename } from '../../core/function'
import { useDocumentStore } from '../../state/documentStore'
import type { FunctionRepository } from '../../storage/FunctionRepository'
import { createInMemoryFunctionRepository, createMemoryStore } from '../../storage/InMemoryFunctionRepository'
import { functionKey } from '../../storage/keyValueRepository'
import { setRepository } from '../../storage/repository'
import { resetStores } from '../../test/resetStores'
import { Library } from './Library'
import { SaveDialog } from './SaveDialog'

let repository: FunctionRepository
const store = () => useDocumentStore.getState()

const seed = async (name: string) => {
  const named = rename(createDefaultFunction(), name)
  if (!named.ok) throw new Error('fixture')
  const saved = await repository.save(named.value)
  if (!saved.ok) throw new Error('fixture')
  return saved.value
}

beforeEach(() => {
  resetStores()
  repository = createInMemoryFunctionRepository()
  setRepository(repository)
})
afterEach(() => setRepository(null))

describe('SaveDialog', () => {
  test('saving with a name stores the function and clears the unsaved state', async () => {
    store().addComponent()
    render(<SaveDialog isOpen onClose={vi.fn()} />)
    const field = screen.getByRole('textbox', { name: '名称' })
    await userEvent.clear(field)
    await userEvent.type(field, '我的方波')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))

    const all = await repository.findAll()
    expect(all.ok && all.value.map((item) => item.name)).toEqual(['我的方波'])
    expect(store().hasUnsavedChanges()).toBe(false)
    expect(store().savedFunctionId).toBe(store().history.present.id)
  })

  test('rejects a blank name without saving', async () => {
    render(<SaveDialog isOpen onClose={vi.fn()} />)
    await userEvent.clear(screen.getByRole('textbox', { name: '名称' }))
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByRole('alert')).toHaveTextContent('名称')
    const all = await repository.findAll()
    expect(all.ok && all.value).toHaveLength(0)
  })

  test('explains a storage failure and keeps the current edit', async () => {
    vi.spyOn(repository, 'save').mockResolvedValue({
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE', message: '浏览器存储不可用' },
    })
    store().addComponent()
    const onClose = vi.fn()
    render(<SaveDialog isOpen onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败: 浏览器存储不可用')
    expect(onClose).not.toHaveBeenCalled()
    expect(store().history.present.components).toHaveLength(4)
  })

  test('save-as creates a second entry once the function has been saved', async () => {
    render(<SaveDialog isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    await userEvent.click(await screen.findByRole('button', { name: '另存为新函数' }))
    await waitFor(async () => {
      const all = await repository.findAll()
      expect(all.ok && all.value).toHaveLength(2)
    })
  })
})

describe('Library', () => {
  test('shows an empty state', async () => {
    render(<Library isOpen onClose={vi.fn()} />)
    expect(await screen.findByText(/还没有保存过函数/)).toBeInTheDocument()
  })

  test('opens a saved function, restoring all of its components', async () => {
    const saved = await seed('锯齿')
    const onClose = vi.fn()
    render(<Library isOpen onClose={onClose} />)
    await userEvent.click(await screen.findByRole('button', { name: '打开锯齿' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(store().history.present).toEqual(saved)
    expect(store().hasUnsavedChanges()).toBe(false)
  })

  test('asks before discarding unsaved changes', async () => {
    await seed('锯齿')
    store().addComponent()
    const before = store().history.present
    render(<Library isOpen onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: '打开锯齿' }))
    expect(screen.getByText(/尚未保存的修改/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(store().history.present).toBe(before)
  })

  test('renames and deletes with confirmation', async () => {
    await seed('旧名')
    render(<Library isOpen onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: '重命名旧名' }))
    const field = screen.getByRole('textbox', { name: '旧名的新名称' })
    await userEvent.clear(field)
    await userEvent.type(field, '新名{Enter}')
    expect(await screen.findByRole('button', { name: '打开新名' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '删除新名' }))
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(await screen.findByText(/还没有保存过函数/)).toBeInTheDocument()
  })

  test('lists an unreadable entry that can be deleted but not opened', async () => {
    const kv = createMemoryStore()
    repository = createInMemoryFunctionRepository(undefined, kv)
    setRepository(repository)
    const saved = await seed('好的')
    await kv.setMany([[functionKey(saved.id), { broken: true }]])

    render(<Library isOpen onClose={vi.fn()} />)
    const row = (await screen.findByText('无法读取')).closest('li') as HTMLElement
    expect(within(row).getByRole('button', { name: /打开/ })).toBeDisabled()
    expect(within(row).getByRole('button', { name: /删除/ })).toBeEnabled()
  })
})
