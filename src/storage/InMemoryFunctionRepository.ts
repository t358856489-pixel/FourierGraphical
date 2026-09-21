import type { Clock } from '../core/function'
import type { FunctionRepository } from './FunctionRepository'
import { createKeyValueRepository, type KeyValueStore } from './keyValueRepository'

const systemClock: Clock = () => new Date().toISOString()

/** 与 IndexedDB 一样按值存取(结构化克隆), 调用方之后对对象的改动不会渗入存储 */
export const createMemoryStore = (): KeyValueStore => {
  const data = new Map<string, unknown>()
  return {
    get: async (key) => structuredClone(data.get(key)),
    getMany: async (keys) => keys.map((key) => structuredClone(data.get(key))),
    setMany: async (entries) => {
      entries.forEach(([key, value]) => data.set(key, structuredClone(value)))
    },
    del: async (key) => {
      data.delete(key)
    },
    keys: async () => [...data.keys()],
  }
}

export const createInMemoryFunctionRepository = (
  clock: Clock = systemClock,
  store: KeyValueStore = createMemoryStore(),
): FunctionRepository => createKeyValueRepository(store, clock)
