import sample from '../../tests/fixtures/sample-function.json'
import type { FourierFunction } from '../core/types'
import { createInMemoryFunctionRepository, createMemoryStore } from './InMemoryFunctionRepository'
import { describeRepositoryContract } from './repositoryContract'

describeRepositoryContract('in-memory', (clock) => {
  const store = createMemoryStore()
  return {
    repository: createInMemoryFunctionRepository(clock, store),
    writeRaw: (key, value) => store.setMany([[key, value]]),
  }
})

describe('createInMemoryFunctionRepository', () => {
  it('works with default arguments and a real clock', async () => {
    const repository = createInMemoryFunctionRepository()

    const saved = await repository.save(sample as FourierFunction)

    expect(saved.ok && Date.parse(saved.value.updatedAt)).toBeGreaterThan(
      Date.parse(sample.updatedAt),
    )
  })

  it('isolates stored data from later changes to the caller objects', async () => {
    const store = createMemoryStore()
    const value = { nested: { count: 1 } }

    await store.setMany([['k', value]])
    value.nested.count = 2

    expect(await store.get('k')).toEqual({ nested: { count: 1 } })
  })
})
