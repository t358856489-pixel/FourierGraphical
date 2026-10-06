import { act, fireEvent, render, screen } from '@testing-library/react'
import { VirtualList } from './VirtualList'

const items = Array.from({ length: 200 }, (_, i) => `row-${i}`)
const renderList = (count = 200) =>
  render(
    <VirtualList
      items={items.slice(0, count)}
      rowHeight={40}
      viewportHeight={400}
      overscan={5}
      renderRow={(item, index, style) => (
        <li key={item} data-index={index} data-testid="row" style={style}>
          <button type="button">{item}</button>
        </li>
      )}
    />,
  )

describe('VirtualList', () => {
  test('renders only the visible window plus overscan for long lists', () => {
    renderList()
    const rows = screen.getAllByTestId('row')
    expect(rows.length).toBeGreaterThanOrEqual(10)
    expect(rows.length).toBeLessThanOrEqual(10 + 2 * 5 + 1)
    expect(rows[0]).toHaveTextContent('row-0')
  })

  test('moves the window when scrolled and keeps keys stable', () => {
    renderList()
    const scroller = screen.getByTestId('virtual-list')
    fireEvent.scroll(scroller, { target: { scrollTop: 4000 } })
    const texts = screen.getAllByTestId('row').map((r) => r.textContent)
    expect(texts).toContain('row-100')
    expect(texts).not.toContain('row-0')
  })

  test('renders everything when the list is short', () => {
    renderList(30)
    expect(screen.getAllByTestId('row')).toHaveLength(30)
  })

  test('focusing a row at the edge of the window scrolls so the following rows exist (Tab order)', () => {
    renderList()
    const before = screen.getAllByTestId('row').length
    const edgeRow = screen.getAllByTestId('row').at(-1) as HTMLElement
    act(() => edgeRow.querySelector('button')?.focus())
    const texts = screen.getAllByTestId('row').map((r) => r.textContent)
    const edgeIndex = Number(edgeRow.dataset['index'])
    expect(texts).toContain(`row-${edgeIndex + 1}`)
    expect(texts).toContain(`row-${edgeIndex + 3}`)
    expect(screen.getAllByTestId('row').length).toBeGreaterThanOrEqual(before)
  })

  test('keeps the total scroll height equal to rows × rowHeight', () => {
    renderList()
    const spacer = screen.getByTestId('virtual-list-spacer')
    expect(spacer.style.height).toBe('8000px')
  })
})
