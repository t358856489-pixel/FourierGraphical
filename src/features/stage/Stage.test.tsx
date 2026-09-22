import { act, render } from '@testing-library/react'
import { contrastRatio, parseColor } from '../../core/color'
import { useDocumentStore } from '../../state/documentStore'
import { useViewStore } from '../../state/viewStore'
import { resetStores } from '../../test/resetStores'
import { Stage } from './Stage'

const stage = (container: HTMLElement) => container.querySelector('.stage') as HTMLElement

beforeEach(resetStores)

describe('Stage surface follows the chosen background (feature 002)', () => {
  test('keeps the default oscilloscope look when no background is chosen', () => {
    const { container } = render(<Stage />)
    expect(stage(container)).toHaveAttribute('data-custom-background', 'false')
    expect(stage(container).style.getPropertyValue('--stage-bg')).toBe('')
  })

  test('a custom background switches off the dark vignette and recolours the container', () => {
    const { container } = render(<Stage />)
    act(() => void useViewStore.getState().setBackground('#ffffff'))
    expect(stage(container)).toHaveAttribute('data-custom-background', 'true')
    expect(stage(container).style.getPropertyValue('--stage-bg')).toBe('#ffffff')
  })

  test('the empty-state text stays readable on a light background', () => {
    const { container } = render(<Stage />)
    act(() => {
      useViewStore.getState().setBackground('#ffffff')
      for (const component of useDocumentStore.getState().history.present.components) {
        useDocumentStore.getState().removeComponent(component.id)
      }
    })
    const text = parseColor(stage(container).style.getPropertyValue('--stage-text'))
    const white = parseColor('#ffffff')
    if (!text.ok || !white.ok) throw new Error('expected parseable colours')
    expect(contrastRatio(text.value, white.value)).toBeGreaterThanOrEqual(4.5)
  })
})
