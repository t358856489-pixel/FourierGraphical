import { resetStores } from '../test/resetStores'
import { defaultNotation, effectiveNotation, useExpressionStore } from './expressionStore'

beforeEach(resetStores)

describe('expressionStore (session preferences, FR-003 / FR-012 / FR-015)', () => {
  test('starts collapsed, following the presentation mode, with plain text', () => {
    expect(useExpressionStore.getState()).toMatchObject({
      isOpen: false,
      notation: null,
      format: 'plain',
    })
  })

  test('the default notation follows the presentation mode until the user chooses one', () => {
    expect(defaultNotation('drawing2d')).toBe('complex')
    expect(defaultNotation('waveform')).toBe('waveform')
    expect(effectiveNotation({ notation: null }, 'drawing2d')).toBe('complex')
    expect(effectiveNotation({ notation: null }, 'waveform')).toBe('waveform')
    useExpressionStore.getState().setNotation('parametric')
    expect(effectiveNotation(useExpressionStore.getState(), 'drawing2d')).toBe('parametric')
    expect(effectiveNotation(useExpressionStore.getState(), 'waveform')).toBe('parametric')
  })

  test('toggleOpen, setFormat and reset', () => {
    const store = useExpressionStore.getState()
    store.toggleOpen()
    expect(useExpressionStore.getState().isOpen).toBe(true)
    store.toggleOpen()
    expect(useExpressionStore.getState().isOpen).toBe(false)
    store.setFormat('latex')
    expect(useExpressionStore.getState().format).toBe('latex')
    store.setNotation('waveform')
    store.toggleOpen()
    store.reset()
    expect(useExpressionStore.getState()).toMatchObject({
      isOpen: false,
      notation: null,
      format: 'plain',
    })
  })
})
