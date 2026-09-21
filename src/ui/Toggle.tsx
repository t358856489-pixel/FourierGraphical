import './toggle.css'

interface ToggleProps {
  readonly label: string
  readonly pressed: boolean
  readonly onChange: (pressed: boolean) => void
  readonly children?: React.ReactNode
  readonly title?: string
}

/** 带指示灯的按压式开关 */
export function Toggle({ label, pressed, onChange, children, title }: ToggleProps) {
  return (
    <button
      type="button"
      className="toggle"
      aria-pressed={pressed}
      aria-label={children ? label : undefined}
      title={title}
      onClick={() => onChange(!pressed)}
    >
      <span className="toggle__lamp" aria-hidden="true" />
      {children ?? label}
    </button>
  )
}
