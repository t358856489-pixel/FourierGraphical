import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { SHAPE_DEFAULT_COUNT } from '../../core/ranges'
import type { FourierFunction } from '../../core/types'
import { applySpectrum, spectrumOf } from './applyShape'
import { importSvg } from './importSvg'

interface ImportPanelProps {
  readonly guard: (action: () => void) => void
  readonly onApplied: (fn: FourierFunction) => void
}

const SLOW_IMPORT_MS = 500

/** 导入 SVG (FR-015–018): 文件选择器与拖放; 超过 0.5 秒显示进度; 错误在对话框内说明 */
export function ImportPanel({ guard, onApplied }: ImportPanelProps) {
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<readonly string[]>([])
  const [progress, setProgress] = useState<number | null>(null)

  const importFile = async (file: File) => {
    setError(null)
    setWarnings([])
    const slowTimer = setTimeout(() => setProgress(0), SLOW_IMPORT_MS)
    const result = await importSvg(await file.text(), (fraction) =>
      setProgress((current) => (current === null ? null : fraction)),
    )
    clearTimeout(slowTimer)
    setProgress(null)
    if (!result.ok) return setError(result.error.message)
    const { path, warnings: notes } = result.value
    guard(() => {
      const applied = applySpectrum(spectrumOf(path), SHAPE_DEFAULT_COUNT)
      if (!applied.ok) return setError(applied.error.message)
      setWarnings(notes)
      onApplied(applied.value)
    })
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void importFile(file)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void importFile(file)
  }

  return (
    <div className="import-panel">
      <div
        className="import-panel__dropzone"
        data-testid="import-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <p>把 SVG 文件拖到这里, 或</p>
        <label htmlFor={inputId} className="button button--primary">
          选择 SVG 文件
        </label>
        <input
          id={inputId}
          type="file"
          accept=".svg,image/svg+xml"
          className="visually-hidden"
          onChange={onChange}
        />
        <p className="import-panel__hint">只读取其中的路径; 文件只在你的设备上处理, 不会上传.</p>
      </div>
      {progress !== null && (
        <progress
          className="import-panel__progress"
          aria-label="正在导入"
          max={1}
          value={progress}
        />
      )}
      {progress !== null && <p className="import-panel__status">正在导入…</p>}
      {error && (
        <p role="alert" className="import-panel__error">
          {error}
        </p>
      )}
      {warnings.map((note) => (
        <p key={note} role="status" className="import-panel__note">
          {note}
        </p>
      ))}
    </div>
  )
}
