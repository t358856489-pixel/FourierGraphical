import type { PresentationMode } from '../../core/types'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { useViewStore, type DisplayToggle } from '../../state/viewStore'
import { Toggle } from '../../ui/Toggle'
import { DisplayPanel } from '../display-panel/DisplayPanel'
import './stage-toolbar.css'

const MODES: readonly { readonly mode: PresentationMode; readonly label: string }[] = [
  { mode: 'waveform', label: '波形' },
  { mode: 'drawing2d', label: '二维绘图' },
]

const DISPLAY_TOGGLES: readonly { readonly key: DisplayToggle; readonly label: string }[] = [
  { key: 'showVectors', label: '向量' },
  { key: 'showCircles', label: '圆' },
  { key: 'showTrail', label: '轨迹' },
  { key: 'showGrid', label: '网格' },
  { key: 'showAxes', label: '坐标轴' },
]

export function StageToolbar() {
  const mode = useDocumentStore((state) => selectFunction(state).presentationMode)
  const setMode = useDocumentStore((state) => state.setPresentationMode)
  const view = useViewStore()

  return (
    <div className="stage-toolbar">
      <fieldset className="stage-toolbar__modes">
        <legend className="visually-hidden">呈现模式</legend>
        {MODES.map((option) => (
          <label key={option.mode} className="stage-toolbar__mode">
            <input
              type="radio"
              name="presentation-mode"
              className="visually-hidden"
              checked={mode === option.mode}
              onChange={() => setMode(option.mode)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="stage-toolbar__right">
        <div className="stage-toolbar__toggles" role="group" aria-label="显示元素">
          {DISPLAY_TOGGLES.map((toggle) => (
            <Toggle
              key={toggle.key}
              label={toggle.label}
              pressed={view[toggle.key]}
              onChange={() => view.toggle(toggle.key)}
            />
          ))}
          <button
            type="button"
            className="button"
            onClick={view.fitView}
            disabled={view.zoom === 'auto'}
          >
            适配视图
          </button>
        </div>
        <DisplayPanel />
      </div>
    </div>
  )
}
