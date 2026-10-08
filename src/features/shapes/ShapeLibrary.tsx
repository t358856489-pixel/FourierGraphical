import { useState } from 'react'
import { MAX_COMPONENTS } from '../../core/ranges'
import { BUILT_IN_SHAPES, type BuiltInShape } from '../../core/shape/builtins'
import { normalize, resample, toComponents } from '../../core/shape/spectrum'
import type { FourierFunction, Range, ShapeSpectrum } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { Slider } from '../../ui/Slider'
import { showError } from '../../ui/toastStore'
import { applySpectrum, spectrumOf } from './applyShape'

const COUNT_RANGE: Range = { min: 2, max: MAX_COMPONENTS, step: 1, unit: '' }
const THUMB_POINTS = 120
const THUMB_CENTER = 16
const THUMB_SCALE = 7

/** 缩略图由图形自身的路径生成, 与实际画出的轨迹一致 (FR-010); SVG 的 y 向下, 所以取负 */
export const thumbnailPath = (shape: BuiltInShape): string =>
  normalize(resample(shape.path(), THUMB_POINTS))
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${(THUMB_CENTER + p.x * THUMB_SCALE).toFixed(2)} ${(THUMB_CENTER - p.y * THUMB_SCALE).toFixed(2)}`,
    )
    .join(' ') + ' Z'

interface ShapeLibraryProps {
  readonly guard: (action: () => void) => void
  readonly onApplied: (fn: FourierFunction) => void
}

interface Selection {
  readonly shape: BuiltInShape
  readonly spectrum: ShapeSpectrum
  readonly count: number
}

export function ShapeLibrary({ guard, onApplied }: ShapeLibraryProps) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const commitEdit = useDocumentStore((state) => state.commitEdit)

  const choose = (shape: BuiltInShape) => {
    const spectrum = spectrumOf(shape.path())
    const result = applySpectrum(spectrum, shape.defaultCount)
    if (!result.ok) return showError(result.error.message)
    setSelection({ shape, spectrum, count: shape.defaultCount })
    onApplied(result.value)
  }

  // 拖动分量数只预览; 松手时 commitEdit 把整个拖动合成一步撤销
  const previewCount = (next: number) => {
    if (!selection) return
    const result = useDocumentStore
      .getState()
      .applyGenerated(toComponents(selection.spectrum, next), 'preview')
    if (!result.ok) return showError(result.error.message)
    setSelection({ ...selection, count: next })
  }

  return (
    <div className="shape-library">
      <div className="shape-library__grid" role="group" aria-label="内置图形">
        {BUILT_IN_SHAPES.map((shape) => (
          <button
            key={shape.id}
            type="button"
            className="shape-library__item"
            aria-pressed={selection?.shape.id === shape.id}
            onClick={() => guard(() => choose(shape))}
          >
            <svg
              viewBox="0 0 32 32"
              width="48"
              height="48"
              aria-hidden="true"
              data-testid={`thumb-${shape.id}`}
            >
              <path d={thumbnailPath(shape)} fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>{shape.name}</span>
          </button>
        ))}
      </div>
      {selection && (
        <div className="shape-library__count">
          <span className="nameplate">分量个数</span>
          <Slider
            label="图形分量个数"
            value={selection.count}
            range={COUNT_RANGE}
            onInput={previewCount}
            onCommit={() => {
              commitEdit()
              onApplied(useDocumentStore.getState().history.present)
            }}
          />
          <output className="mono">{selection.count}</output>
        </div>
      )}
    </div>
  )
}
