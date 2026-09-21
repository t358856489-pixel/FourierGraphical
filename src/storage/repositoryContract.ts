import sample from '../../tests/fixtures/sample-function.json'
import type { Clock } from '../core/function'
import type { FourierFunction, ViewSettings } from '../core/types'
import type { Draft, FunctionRepository } from './FunctionRepository'
import { DRAFT_KEY, functionKey } from './keyValueRepository'

export interface RepositoryHarness {
  readonly repository: FunctionRepository
  /** 绕过仓储直接写入底层存储, 用于模拟损坏数据 */
  readonly writeRaw: (key: string, value: unknown) => Promise<void>
}

export type RepositoryFactory = (clock: Clock) => Promise<RepositoryHarness> | RepositoryHarness

const base = sample as FourierFunction
const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'
const ID_C = '33333333-3333-4333-8333-333333333333'

const makeFunction = (id: string, name: string): FourierFunction => ({ ...base, id, name })

const view: ViewSettings = {
  zoom: 'auto',
  pan: { x: 0, y: 0 },
  showVectors: true,
  showCircles: true,
  showTrail: true,
  showGrid: true,
  trailSeconds: 8,
  highlightedComponentId: null,
  selectedComponentId: null,
}

const draft: Draft = {
  function: base,
  playback: { time: 2, speed: 1.5, loop: { start: 1, end: 4, enabled: true } },
  view,
  savedFunctionId: null,
  isDirty: true,
}

/** 每次调用前进一秒的时钟, 使 updatedAt 的先后顺序可预测 */
const tickingClock = (): Clock => {
  let tick = 0
  return () => {
    tick += 1
    return new Date(Date.UTC(2030, 0, 1, 0, 0, tick)).toISOString()
  }
}

export const describeRepositoryContract = (name: string, factory: RepositoryFactory): void => {
  describe(`FunctionRepository contract: ${name}`, () => {
    let repository: FunctionRepository
    let writeRaw: RepositoryHarness['writeRaw']

    beforeEach(async () => {
      const harness = await factory(tickingClock())
      repository = harness.repository
      writeRaw = harness.writeRaw
    })

    it('returns an empty list and a null draft when nothing was stored', async () => {
      expect(await repository.findAll()).toEqual({ ok: true, value: [] })
      expect(await repository.loadDraft()).toEqual({ ok: true, value: null })
    })

    it('round-trips a saved function with deep equality', async () => {
      const saved = await repository.save(makeFunction(ID_A, '甲'))

      const found = await repository.findById(ID_A)

      expect(saved.ok).toBe(true)
      expect(found).toEqual(saved)
      if (found.ok) expect(found.value.components).toEqual(base.components)
    })

    it('stamps updatedAt on save without mutating the input', async () => {
      const input = makeFunction(ID_A, '甲')

      const saved = await repository.save(input)

      expect(input.updatedAt).toBe(base.updatedAt)
      expect(saved.ok && saved.value.updatedAt).toBe('2030-01-01T00:00:01.000Z')
      expect(saved.ok && saved.value.createdAt).toBe(base.createdAt)
    })

    it('overwrites an existing function instead of listing it twice', async () => {
      await repository.save(makeFunction(ID_A, '旧'))
      await repository.save(makeFunction(ID_A, '新'))

      const all = await repository.findAll()

      expect(all.ok && all.value.map((item) => item.name)).toEqual(['新'])
    })

    it('lists summaries sorted by updatedAt descending', async () => {
      await repository.save(makeFunction(ID_A, '甲'))
      await repository.save(makeFunction(ID_B, '乙'))
      await repository.save(makeFunction(ID_C, '丙'))
      await repository.save(makeFunction(ID_A, '甲'))

      const all = await repository.findAll()

      expect(all.ok && all.value.map((item) => item.id)).toEqual([ID_A, ID_C, ID_B])
      expect(all.ok && all.value[0]).toEqual({
        id: ID_A,
        name: '甲',
        updatedAt: '2030-01-01T00:00:04.000Z',
        readable: true,
      })
    })

    it('refuses to save a function that violates the schema', async () => {
      const result = await repository.save({ ...makeFunction(ID_A, '甲'), name: '' })

      expect(!result.ok && result.error.code).toBe('DATA_CORRUPT')
      expect(await repository.findAll()).toEqual({ ok: true, value: [] })
    })

    it('renames a stored function and trims the new name', async () => {
      await repository.save(makeFunction(ID_A, '甲'))

      const renamed = await repository.rename(ID_A, '  新名字  ')
      const found = await repository.findById(ID_A)
      const all = await repository.findAll()

      expect(renamed).toEqual({ ok: true, value: undefined })
      expect(found.ok && found.value.name).toBe('新名字')
      expect(all.ok && all.value[0]?.name).toBe('新名字')
    })

    it('rejects an invalid name and a rename of a missing function', async () => {
      await repository.save(makeFunction(ID_A, '甲'))

      const blank = await repository.rename(ID_A, '   ')
      const missing = await repository.rename(ID_B, '乙')

      expect(!blank.ok && blank.error.code).toBe('INVALID_NAME')
      expect(!missing.ok && missing.error.code).toBe('NOT_FOUND')
    })

    it('returns NOT_FOUND after a function is removed', async () => {
      await repository.save(makeFunction(ID_A, '甲'))
      await repository.save(makeFunction(ID_B, '乙'))

      const removed = await repository.remove(ID_A)
      const found = await repository.findById(ID_A)
      const all = await repository.findAll()

      expect(removed).toEqual({ ok: true, value: undefined })
      expect(!found.ok && found.error.code).toBe('NOT_FOUND')
      expect(all.ok && all.value.map((item) => item.id)).toEqual([ID_B])
    })

    it('treats removing a missing function as success', async () => {
      expect(await repository.remove(ID_C)).toEqual({ ok: true, value: undefined })
    })

    it('reports a corrupt entry without breaking the others', async () => {
      await repository.save(makeFunction(ID_A, '甲'))
      await repository.save(makeFunction(ID_B, '乙'))
      await writeRaw(functionKey(ID_A), { ...makeFunction(ID_A, '甲'), schemaVersion: 99 })

      const found = await repository.findById(ID_A)
      const other = await repository.findById(ID_B)
      const all = await repository.findAll()

      expect(!found.ok && found.error.code).toBe('DATA_CORRUPT')
      expect(other.ok).toBe(true)
      expect(all.ok && all.value.map((item) => [item.id, item.readable])).toEqual([
        [ID_B, true],
        [ID_A, false],
      ])
    })

    it('can remove a corrupt entry but not rename it', async () => {
      await repository.save(makeFunction(ID_A, '甲'))
      await writeRaw(functionKey(ID_A), 'garbage')

      const renamed = await repository.rename(ID_A, '乙')
      const removed = await repository.remove(ID_A)

      expect(!renamed.ok && renamed.error.code).toBe('DATA_CORRUPT')
      expect(removed.ok).toBe(true)
      expect(await repository.findAll()).toEqual({ ok: true, value: [] })
    })

    it('round-trips the draft and keeps only the latest one', async () => {
      await repository.saveDraft(draft)
      const latest: Draft = { ...draft, savedFunctionId: ID_A, isDirty: false }

      const saved = await repository.saveDraft(latest)

      expect(saved).toEqual({ ok: true, value: undefined })
      expect(await repository.loadDraft()).toEqual({ ok: true, value: latest })
    })

    it('reports a corrupt draft as DATA_CORRUPT', async () => {
      await writeRaw(DRAFT_KEY, { ...draft, playback: { ...draft.playback, isPlaying: true } })

      const loaded = await repository.loadDraft()

      expect(!loaded.ok && loaded.error.code).toBe('DATA_CORRUPT')
    })

    it('does not list the draft as a saved function', async () => {
      await repository.saveDraft(draft)

      expect(await repository.findAll()).toEqual({ ok: true, value: [] })
    })
  })
}
