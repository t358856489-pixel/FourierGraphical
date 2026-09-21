import { createStore, del, get, getMany, keys, setMany, type UseStore } from 'idb-keyval'
import type { Clock } from '../core/function'
import type { FunctionRepository } from './FunctionRepository'
import { createKeyValueRepository, type KeyValueStore } from './keyValueRepository'

const DATABASE_NAME = 'fourier-graphical'
const OBJECT_STORE_NAME = 'keyval'

const systemClock: Clock = () => new Date().toISOString()

/**
 * idb-keyval 的薄封装. 数据库延迟到首次访问才打开, 且每个方法都是 async:
 * 这样无痕模式/禁用存储时的同步异常也会变成 rejection, 由仓储统一映射为 STORAGE_UNAVAILABLE.
 */
export const createIdbStore = (databaseName: string = DATABASE_NAME): KeyValueStore => {
  let opened: UseStore | null = null
  const open = (): UseStore => {
    opened ??= createStore(databaseName, OBJECT_STORE_NAME)
    return opened
  }
  return {
    get: async (key) => get<unknown>(key, open()),
    getMany: async (wanted) => getMany<unknown>([...wanted], open()),
    setMany: async (entries) =>
      setMany(
        entries.map(([key, value]) => [key, value]),
        open(),
      ),
    del: async (key) => del(key, open()),
    keys: async () => (await keys<IDBValidKey>(open())).filter((key) => typeof key === 'string'),
  }
}

export const createIndexedDbFunctionRepository = (
  clock: Clock = systemClock,
  store: KeyValueStore = createIdbStore(),
): FunctionRepository => createKeyValueRepository(store, clock)
