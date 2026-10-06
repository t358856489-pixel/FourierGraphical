import {
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type UIEvent,
} from 'react'

interface VirtualListProps<T> {
  readonly items: readonly T[]
  readonly rowHeight: number
  readonly viewportHeight: number
  readonly overscan?: number
  /** 行必须把 style 应用到自己的根元素(绝对定位与高度) */
  readonly renderRow: (item: T, index: number, style: CSSProperties) => ReactNode
  readonly className?: string
  readonly listClassName?: string
}

/** 行数不多时不值得虚拟化; 阈值取分量列表开始明显变慢的数量级 */
export const VIRTUALIZE_FROM = 60

/**
 * 固定行高的虚拟列表 (功能 003 R3): 只渲染可视区附近的行, 不引入依赖.
 * 滚出可视区的行会卸载, 所以焦点落到窗口边缘的行时把它滚到中间, 让后面的行先渲染出来, Tab 顺序才不会断.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  viewportHeight,
  overscan = 5,
  renderRow,
  className,
  listClassName,
}: VirtualListProps<T>) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const isVirtual = items.length >= VIRTUALIZE_FROM
  const visible = Math.ceil(viewportHeight / rowHeight)
  const first = isVirtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0
  const last = isVirtual
    ? Math.min(items.length - 1, first + visible + 2 * overscan)
    : items.length - 1

  const keepFocusedRowCentred = (event: FocusEvent<HTMLDivElement>) => {
    if (!isVirtual || !scroller.current) return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
    const index = Number(row?.dataset['index'])
    if (!Number.isFinite(index)) return
    const nearEdge = index <= first + 1 || index >= last - 1
    if (nearEdge) {
      const top = Math.max(0, index * rowHeight - viewportHeight / 2 + rowHeight / 2)
      scroller.current.scrollTop = top
      setScrollTop(top)
    }
  }

  return (
    <div
      ref={scroller}
      data-testid="virtual-list"
      className={className}
      style={{ maxHeight: viewportHeight, overflowY: 'auto', position: 'relative' }}
      onScroll={(event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop)}
      onFocusCapture={keepFocusedRowCentred}
    >
      <ol
        data-testid="virtual-list-spacer"
        className={listClassName}
        style={{ height: items.length * rowHeight, position: 'relative', margin: 0, padding: 0 }}
      >
        {items.slice(first, last + 1).map((item, offset) => {
          const index = first + offset
          return renderRow(item, index, {
            position: 'absolute',
            top: index * rowHeight,
            left: 0,
            right: 0,
            height: rowHeight,
          })
        })}
      </ol>
    </div>
  )
}
