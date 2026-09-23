import sample from '../../tests/fixtures/sample-function.json'
import type { Draft } from '../core/schema'
import type { FourierFunction, Result } from '../core/types'
import type { FunctionRepository } from './FunctionRepository'
import { createIdbStore, createIndexedDbFunctionRepository } from './IndexedDbFunctionRepository'
import { INDEX_KEY, functionKey, type KeyValueStore } from './keyValueRepository'
import { describeRepositoryContract } from './repositoryContract'

const fn = sample as FourierFunction
const fixedClock = (): string => '2030-01-01T00:00:00.000Z'

let databaseCounter = 0
const freshStore = (): KeyValueStore => {
  databaseCounter += 1
  return createIdbStore(`contract-test-${databaseCounter}`)
}

describeRepositoryContract('IndexedDB', (clock) => {
  const store = freshStore()
  return {
    repository: createIndexedDbFunctionRepository(clock, store),
    writeRaw: (key, value) => store.setMany([[key, value]]),
  }
})

const draft: Draft = {
  function: fn,
  playback: { time: 0, speed: 1, loop: null },
  view: {
    zoom: 'auto',
    pan: { x: 0, y: 0 },
    showVectors: true,
    showCircles: true,
    showTrail: true,
    showGrid: true,
    trailSeconds: 8,
    showAxes: true,
    trailFade: true,
    trailRetention: 'all',
    background: null,
    highlightedComponentId: null,
    selectedComponentId: null,
  },
  savedFunctionId: null,
  isDirty: false,
}

const failingStore = (error: unknown): KeyValueStore => {
  const fail = (): Promise<never> => Promise.reject(error)
  return { get: fail, getMany: fail, setMany: fail, del: fail, keys: fail }
}

const callEveryMethod = (repository: FunctionRepository): Promise<readonly Result<unknown>[]> =>
  Promise.all([
    repository.findAll(),
    repository.findById(fn.id),
    repository.save(fn),
    repository.rename(fn.id, '新名字'),
    repository.remove(fn.id),
    repository.loadDraft(),
    repository.saveDraft(draft),
  ])

describe('createIndexedDbFunctionRepository error mapping', () => {
  it('returns STORAGE_UNAVAILABLE from every method when the store rejects', async () => {
    const repository = createIndexedDbFunctionRepository(
      fixedClock,
      failingStore(new DOMException('blocked', 'SecurityError')),
    )

    const results = await callEveryMethod(repository)

    expect(results.map((result) => !result.ok && result.error.code)).toEqual(
      Array.from({ length: 7 }, () => 'STORAGE_UNAVAILABLE'),
    )
    results.forEach((result) => {
      if (!result.ok) expect(result.error.message).toMatch(/[一-龥]/)
    })
  })

  it('returns STORAGE_UNAVAILABLE when the store throws synchronously', async () => {
    const explode = (): never => {
      throw new Error('indexedDB is not defined')
    }
    const repository = createIndexedDbFunctionRepository(fixedClock, {
      get: explode,
      getMany: explode,
      setMany: explode,
      del: explode,
      keys: explode,
    })

    const results = await callEveryMethod(repository)

    expect(results.every((result) => !result.ok)).toBe(true)
  })

  it('maps QuotaExceededError on write to STORAGE_QUOTA', async () => {
    const working = freshStore()
    const store: KeyValueStore = {
      ...working,
      setMany: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
    }
    const repository = createIndexedDbFunctionRepository(fixedClock, store)

    const saved = await repository.save(fn)
    const draftSaved = await repository.saveDraft(draft)

    expect(!saved.ok && saved.error.code).toBe('STORAGE_QUOTA')
    expect(!draftSaved.ok && draftSaved.error.code).toBe('STORAGE_QUOTA')
  })

  it('reports STORAGE_UNAVAILABLE when indexedDB does not exist', async () => {
    vi.stubGlobal('indexedDB', undefined)
    try {
      const repository = createIndexedDbFunctionRepository(fixedClock, createIdbStore('no-idb'))

      const all = await repository.findAll()

      expect(!all.ok && all.error.code).toBe('STORAGE_UNAVAILABLE')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rebuilds the list from stored functions when the index is corrupt', async () => {
    const store = freshStore()
    const repository = createIndexedDbFunctionRepository(fixedClock, store)
    await repository.save(fn)
    await store.setMany([
      [INDEX_KEY, 'not-an-index'],
      [functionKey('broken'), { nope: true }],
    ])

    const all = await repository.findAll()

    expect(all.ok && all.value.map((item) => [item.id, item.readable])).toEqual([
      [fn.id, true],
      ['broken', false],
    ])
  })

  it('persists across repository instances sharing a database', async () => {
    const name = 'shared-database'
    await createIndexedDbFunctionRepository(fixedClock, createIdbStore(name)).save(fn)

    const found = await createIndexedDbFunctionRepository(
      fixedClock,
      createIdbStore(name),
    ).findById(fn.id)

    expect(found.ok && found.value.name).toBe(fn.name)
  })

  it('can be created with default arguments', () => {
    expect(typeof createIndexedDbFunctionRepository().findAll).toBe('function')
  })
})
