import type { HarmonicComponent, ParamName } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { useViewStore } from '../../state/viewStore'
import { ParamControl } from './ParamControl'

const PARAMS: readonly ParamName[] = ['amplitude', 'frequency', 'phase']

interface ComponentRowProps {
  readonly component: HarmonicComponent
  readonly index: number
  readonly count: number
}

export function ComponentRow({ component, index, count }: ComponentRowProps) {
  const { setEnabled, moveComponent, removeComponent } = useDocumentStore.getState()
  const isHighlighted = useViewStore((state) => state.highlightedComponentId === component.id)
  const highlight = useViewStore((state) => state.highlight)
  const hover = useViewStore((state) => state.hover)
  const name = `分量 ${index + 1}`

  return (
    <li
      className="component-row"
      data-enabled={component.enabled}
      data-highlighted={isHighlighted}
      onFocusCapture={() => useViewStore.getState().select(component.id)}
      onPointerEnter={() => hover(component.id)}
      onPointerLeave={() => hover(null)}
    >
      <header className="component-row__header">
        {/* 分量色在荧光屏上定义, 面板上置于深色 bezel 内以保证对比度 */}
        <span className="component-row__chip" aria-hidden="true">
          <span style={{ background: `var(--component-${component.color})` }} />
        </span>
        <h3 className="component-row__title">{name}</h3>
        <label className="component-row__enable">
          <input
            type="checkbox"
            checked={component.enabled}
            onChange={(event) => setEnabled(component.id, event.target.checked)}
          />
          <span>启用</span>
          <span className="visually-hidden">{name}</span>
        </label>
        <div className="component-row__actions">
          <button
            type="button"
            className="button button--icon"
            aria-pressed={isHighlighted}
            aria-label={`高亮${name}`}
            onClick={() => highlight(isHighlighted ? null : component.id)}
          >
            ◉
          </button>
          <button
            type="button"
            className="button button--icon"
            aria-label={`上移${name}`}
            disabled={index === 0}
            onClick={() => moveComponent(component.id, index - 1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="button button--icon"
            aria-label={`下移${name}`}
            disabled={index === count - 1}
            onClick={() => moveComponent(component.id, index + 1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="button button--icon button--danger"
            aria-label={`删除${name}`}
            onClick={() => removeComponent(component.id)}
          >
            ×
          </button>
        </div>
      </header>
      {PARAMS.map((param) => (
        <ParamControl key={param} component={component} index={index} param={param} />
      ))}
    </li>
  )
}
