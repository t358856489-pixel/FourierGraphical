import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MAX_COMPONENTS } from '../../core/ranges'
import { constant } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { useViewStore } from '../../state/viewStore'
import { resetStores } from '../../test/resetStores'
import { ComponentsPanel } from './ComponentsPanel'

const doc = () => useDocumentStore.getState().history
const rows = () => screen.getAllByRole('listitem')

beforeEach(resetStores)

describe('ComponentsPanel', () => {
  test('lists the example components and adds a new one', async () => {
    render(<ComponentsPanel />)
    expect(rows()).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: /添加分量/ }))
    expect(rows()).toHaveLength(4)
    expect(screen.getByText(`4/${MAX_COMPONENTS}`)).toBeInTheDocument()
  })

  test('disables adding at the limit and explains why', () => {
    for (let i = 0; i < MAX_COMPONENTS; i++) useDocumentStore.getState().addComponent()
    render(<ComponentsPanel />)
    const add = screen.getByRole('button', { name: /添加分量/ })
    expect(add).toBeDisabled()
    expect(add).toHaveAccessibleDescription(/上限/)
  })

  test('dragging a slider updates the document continuously but adds one undo step', () => {
    render(<ComponentsPanel />)
    const slider = screen.getByRole('slider', { name: '分量 1 振幅' })
    fireEvent.change(slider, { target: { value: '2' } })
    fireEvent.change(slider, { target: { value: '3' } })
    expect(doc().present.components[0]?.amplitude).toEqual(constant(3))
    expect(doc().past).toHaveLength(0)
    fireEvent.pointerUp(slider)
    expect(doc().past).toHaveLength(1)
  })

  test('an invalid number keeps the previous value and leaves the document untouched', async () => {
    render(<ComponentsPanel />)
    const before = doc().present
    const field = screen.getByRole('textbox', { name: '分量 1 振幅数值' })
    await userEvent.clear(field)
    await userEvent.type(field, '999{Enter}')
    expect(doc().present).toBe(before)
    expect(screen.getByRole('alert')).toHaveTextContent('0 到 100')
  })

  test('disabling, reordering and deleting act on the right component', async () => {
    render(<ComponentsPanel />)
    const [firstId, secondId] = doc().present.components.map((component) => component.id)
    await userEvent.click(screen.getByRole('checkbox', { name: /启用\s*分量 1/ }))
    expect(doc().present.components[0]?.enabled).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: '下移分量 1' }))
    expect(doc().present.components.map((component) => component.id).slice(0, 2)).toEqual([
      secondId,
      firstId,
    ])
    expect(screen.getByRole('button', { name: '上移分量 1' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '删除分量 1' }))
    expect(rows()).toHaveLength(2)
  })

  test('shows an empty state when every component is removed', async () => {
    render(<ComponentsPanel />)
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: '删除分量 1' }))
    }
    expect(screen.getByText(/还没有分量/)).toBeInTheDocument()
  })

  test('undo and redo buttons follow the history', async () => {
    render(<ComponentsPanel />)
    const undo = screen.getByRole('button', { name: '撤销' })
    expect(undo).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /添加分量/ }))
    await userEvent.click(undo)
    expect(rows()).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(rows()).toHaveLength(4)
  })

  test('the highlight button toggles the highlighted component', async () => {
    render(<ComponentsPanel />)
    const row = rows()[1] as HTMLElement
    const id = doc().present.components[1]?.id
    await userEvent.click(within(row).getByRole('button', { name: '高亮分量 2' }))
    expect(useViewStore.getState().highlightedComponentId).toBe(id)
  })
})
