import gridOff from '../../tests/fixtures/draft-v001-grid-off.json'
import gridOn from '../../tests/fixtures/draft-v001-grid-on.json'
import sample from '../../tests/fixtures/sample-function.json'
import { parseDraft, parseFunction } from './schema'

const withView = (patch: Record<string, unknown>) => ({
  ...gridOn,
  view: { ...gridOn.view, showAxes: true, trailFade: true, trailRetention: 'all', background: null, ...patch },
})

describe('drafts written by feature 001 (no display options)', () => {
  test.each([
    ['grid on', gridOn, true],
    ['grid off', gridOff, false],
  ])('%s: opens with defaults, and the axes follow the old grid switch', (_, draft, grid) => {
    const result = parseDraft(draft)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.value.view).toMatchObject({
      showGrid: grid,
      showAxes: grid,
      trailFade: true,
      trailRetention: 'all',
      background: null,
    })
    expect(result.value.function.components).toHaveLength(gridOn.function.components.length)
  })
})

describe('display options in a draft', () => {
  test('accepts every documented value', () => {
    for (const trailRetention of [5, 10, 30, 60, 120, 300, 600, 'all']) {
      expect(parseDraft(withView({ trailRetention })).ok).toBe(true)
    }
    const result = parseDraft(withView({ background: '#f3ecdc', showAxes: false, trailFade: false }))
    expect(result.ok && result.value.view.background).toBe('#f3ecdc')
  })

  test.each([['#FFFFFF'], ['white'], [123], ['#fff']])('rejects background %j', (background) => {
    const result = parseDraft(withView({ background }))
    expect(result.ok === false && result.error.code).toBe('DATA_CORRUPT')
  })

  test.each([[7], ['forever'], [null]])('rejects trailRetention %j', (trailRetention) => {
    expect(parseDraft(withView({ trailRetention })).ok).toBe(false)
  })

  test('still rejects unknown view fields', () => {
    expect(parseDraft(withView({ surprise: 1 })).ok).toBe(false)
  })
})

describe('saved functions are untouched by this feature (FR-023a)', () => {
  test('the feature 001 sample still parses, and display options are not part of a function', () => {
    expect(parseFunction(sample).ok).toBe(true)
    expect(parseFunction({ ...sample, background: '#ffffff' }).ok).toBe(false)
  })
})
