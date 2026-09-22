import sample from '../../tests/fixtures/sample-function.json'
import { createDefaultFunction } from './function'
import { MAX_COMPONENTS, MAX_KEYFRAMES, MAX_NAME_LENGTH, SPEED_RANGE } from './ranges'
import { draftSchema, fourierFunctionSchema, parseDraft, parseFunction, type Draft } from './schema'
import type { FourierFunction, HarmonicComponent, Keyframe, ViewSettings } from './types'

const corruptFixtures = import.meta.glob<unknown>('../../tests/fixtures/corrupt-*.json', {
  eager: true,
  import: 'default',
})

const valid = sample as FourierFunction
const first = valid.components[0] as HarmonicComponent

const withFirstComponent = (patch: Record<string, unknown>): unknown => ({
  ...valid,
  components: [{ ...first, ...patch }, ...valid.components.slice(1)],
})

const view: ViewSettings = {
  zoom: 'auto',
  pan: { x: 0, y: 0 },
  showVectors: true,
  showCircles: true,
  showTrail: true,
  showGrid: false,
  trailSeconds: 8,
  showAxes: true,
  trailFade: true,
  trailRetention: 'all',
  background: null,
  highlightedComponentId: null,
  selectedComponentId: first.id,
}

const draft: Draft = {
  function: valid,
  playback: { time: 3.2, speed: 1, loop: { start: 0, end: 5, enabled: true } },
  view,
  savedFunctionId: valid.id,
  isDirty: true,
}

const expectCorrupt = (input: unknown): void => {
  const result = parseFunction(input)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error.code).toBe('DATA_CORRUPT')
    expect(result.error.message).toMatch(/[一-龥]/)
  }
}

describe('parseFunction', () => {
  it('accepts the sample fixture and returns deeply equal data', () => {
    const result = parseFunction(sample)

    expect(result).toEqual({ ok: true, value: sample })
  })

  it('accepts the default example function', () => {
    const result = parseFunction(createDefaultFunction())

    expect(result.ok).toBe(true)
  })

  it('does not mutate its input', () => {
    const input = structuredClone(sample)

    parseFunction(input)

    expect(input).toEqual(sample)
  })

  it('finds at least five corrupt fixtures', () => {
    expect(Object.keys(corruptFixtures).length).toBeGreaterThanOrEqual(5)
  })

  it.each(Object.entries(corruptFixtures))('rejects corrupt fixture %s', (_path, content) => {
    expectCorrupt(content)
  })

  it.each([null, undefined, 42, 'text', []])('rejects non-object input %s', (input) => {
    expectCorrupt(input)
  })

  it('rejects an unknown schemaVersion', () => {
    expectCorrupt({ ...valid, schemaVersion: 2 })
  })

  it('rejects more components than the limit', () => {
    const components = Array.from({ length: MAX_COMPONENTS + 1 }, () => ({
      ...first,
      id: crypto.randomUUID(),
    }))

    expectCorrupt({ ...valid, components })
  })

  it('accepts exactly the maximum number of components', () => {
    const components = Array.from({ length: MAX_COMPONENTS }, () => ({
      ...first,
      id: crypto.randomUUID(),
    }))

    expect(parseFunction({ ...valid, components }).ok).toBe(true)
  })

  it('accepts a function with no components', () => {
    expect(parseFunction({ ...valid, components: [] }).ok).toBe(true)
  })

  it('rejects keyframes whose times are equal or decreasing', () => {
    const equal: Keyframe[] = [
      { time: 1, value: 1, easing: 'linear' },
      { time: 1, value: 2, easing: 'linear' },
    ]
    const decreasing: Keyframe[] = [
      { time: 2, value: 1, easing: 'linear' },
      { time: 1, value: 2, easing: 'linear' },
    ]

    expectCorrupt(withFirstComponent({ phase: { kind: 'animated', keyframes: equal } }))
    expectCorrupt(withFirstComponent({ phase: { kind: 'animated', keyframes: decreasing } }))
  })

  it('rejects an animated track with no keyframes or too many keyframes', () => {
    const tooMany = Array.from({ length: MAX_KEYFRAMES + 1 }, (_, index) => ({
      time: index,
      value: 1,
      easing: 'linear',
    }))

    expectCorrupt(withFirstComponent({ phase: { kind: 'animated', keyframes: [] } }))
    expectCorrupt(withFirstComponent({ phase: { kind: 'animated', keyframes: tooMany } }))
  })

  it('rejects a negative or non-finite keyframe time', () => {
    const at = (time: number): unknown =>
      withFirstComponent({
        phase: { kind: 'animated', keyframes: [{ time, value: 0, easing: 'linear' }] },
      })

    expectCorrupt(at(-0.001))
    expectCorrupt(at(Number.POSITIVE_INFINITY))
  })

  it('rejects duplicate component ids', () => {
    expectCorrupt({ ...valid, components: [first, first] })
  })

  it.each([
    ['amplitude', -0.01],
    ['amplitude', 100.01],
    ['frequency', -100.001],
    ['frequency', 100.001],
    ['phase', -3600.1],
    ['phase', 3600.1],
  ])('rejects a constant %s of %d outside its range', (param, value) => {
    expectCorrupt(withFirstComponent({ [param]: { kind: 'constant', value } }))
  })

  it.each([
    ['amplitude', 0],
    ['amplitude', 100],
    ['frequency', -100],
    ['phase', 3600],
  ])('accepts a constant %s of %d at the edge of its range', (param, value) => {
    const result = parseFunction(withFirstComponent({ [param]: { kind: 'constant', value } }))

    expect(result.ok).toBe(true)
  })

  it('rejects a keyframe value outside the range of its parameter', () => {
    const keyframes: Keyframe[] = [{ time: 0, value: 101, easing: 'linear' }]

    expectCorrupt(withFirstComponent({ frequency: { kind: 'animated', keyframes } }))
  })

  it('rejects NaN values', () => {
    expectCorrupt(withFirstComponent({ amplitude: { kind: 'constant', value: Number.NaN } }))
  })

  it('rejects unknown fields at every level', () => {
    expectCorrupt({ ...valid, extra: true })
    expectCorrupt(withFirstComponent({ extra: true }))
    expectCorrupt(withFirstComponent({ phase: { kind: 'constant', value: 0, extra: true } }))
  })

  it('rejects an empty, blank or over-long name', () => {
    expectCorrupt({ ...valid, name: '' })
    expectCorrupt({ ...valid, name: '   ' })
    expectCorrupt({ ...valid, name: 'x'.repeat(MAX_NAME_LENGTH + 1) })
  })

  it('accepts a name of exactly the maximum length', () => {
    expect(parseFunction({ ...valid, name: 'x'.repeat(MAX_NAME_LENGTH) }).ok).toBe(true)
  })

  it('rejects malformed ids, colors, easings, modes and timestamps', () => {
    expectCorrupt({ ...valid, id: 'not-a-uuid' })
    expectCorrupt(withFirstComponent({ color: 'c12' }))
    expectCorrupt(withFirstComponent({ color: '#ff0000' }))
    expectCorrupt(withFirstComponent({ enabled: 'yes' }))
    expectCorrupt({ ...valid, presentationMode: '3d' })
    expectCorrupt({ ...valid, createdAt: 'yesterday' })
    expectCorrupt(
      withFirstComponent({
        phase: { kind: 'animated', keyframes: [{ time: 0, value: 0, easing: 'bounce' }] },
      }),
    )
  })

  it('exposes the schema for direct use', () => {
    expect(fourierFunctionSchema.safeParse(sample).success).toBe(true)
  })
})

describe('parseDraft', () => {
  const expectCorruptDraft = (input: unknown): void => {
    const result = parseDraft(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DATA_CORRUPT')
  }

  it('accepts a complete draft and returns deeply equal data', () => {
    expect(parseDraft(draft)).toEqual({ ok: true, value: draft })
  })

  it('accepts a draft without loop, saved id or numeric zoom', () => {
    const input: Draft = {
      ...draft,
      playback: { time: 0, speed: SPEED_RANGE.max, loop: null },
      view: { ...view, zoom: 2.5, selectedComponentId: null },
      savedFunctionId: null,
      isDirty: false,
    }

    expect(parseDraft(input)).toEqual({ ok: true, value: input })
  })

  it('rejects a draft that carries isPlaying', () => {
    expectCorruptDraft({ ...draft, playback: { ...draft.playback, isPlaying: true } })
  })

  it('rejects a draft whose function is corrupt', () => {
    expectCorruptDraft({ ...draft, function: { ...valid, schemaVersion: 9 } })
  })

  it('rejects a draft without isDirty', () => {
    const withoutFlag = Object.fromEntries(
      Object.entries(draft).filter(([key]) => key !== 'isDirty'),
    )

    expectCorruptDraft(withoutFlag)
  })

  it('rejects out-of-range playback values', () => {
    expectCorruptDraft({ ...draft, playback: { ...draft.playback, time: -1 } })
    expectCorruptDraft({ ...draft, playback: { ...draft.playback, speed: SPEED_RANGE.max + 1 } })
    expectCorruptDraft({ ...draft, playback: { ...draft.playback, speed: 0 } })
  })

  it('rejects a loop region that is too short or starts before zero', () => {
    const withLoop = (start: number, end: number): unknown => ({
      ...draft,
      playback: { ...draft.playback, loop: { start, end, enabled: true } },
    })

    expectCorruptDraft(withLoop(2, 2.05))
    expectCorruptDraft(withLoop(-1, 3))
  })

  it('rejects invalid view settings', () => {
    expectCorruptDraft({ ...draft, view: { ...view, zoom: 0 } })
    expectCorruptDraft({ ...draft, view: { ...view, zoom: 'fit' } })
    expectCorruptDraft({ ...draft, view: { ...view, trailSeconds: 0 } })
    expectCorruptDraft({ ...draft, view: { ...view, pan: { x: Number.NaN, y: 0 } } })
    expectCorruptDraft({ ...draft, view: { ...view, unknown: 1 } })
  })

  it('rejects non-object input', () => {
    expectCorruptDraft(null)
    expect(draftSchema.safeParse('draft').success).toBe(false)
  })
})
