import { z } from 'zod'
import { rename as renameFunction, type Clock } from '../core/function'
import { parseDraft, parseFunction } from '../core/schema'
import { err, ok, type FourierFunction, type Result } from '../core/types'
import type { FunctionRepository, FunctionSummary } from './FunctionRepository'

/** 仓储所依赖的最小键值存储; IndexedDB 与内存实现共用同一套仓储逻辑, 保证行为一致 */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  getMany(keys: readonly string[]): Promise<readonly unknown[]>
  setMany(entries: readonly (readonly [string, unknown])[]): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<readonly string[]>
}

const FUNCTION_KEY_PREFIX = 'fn:'
export const INDEX_KEY = 'index'
export const DRAFT_KEY = 'draft'
export const functionKey = (id: string): string => `${FUNCTION_KEY_PREFIX}${id}`

const UNREADABLE_NAME = '无法读取'
const QUOTA_ERROR_NAME = 'QuotaExceededError'

const indexSchema = z.array(
  z.strictObject({ id: z.string(), name: z.string(), updatedAt: z.string() }),
)
type IndexEntry = z.infer<typeof indexSchema>[number]

const isQuotaError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === QUOTA_ERROR_NAME

const mapStorageError = <T>(error: unknown): Result<T> =>
  isQuotaError(error)
    ? err('STORAGE_QUOTA', '浏览器存储空间不足, 请删除一些已保存的函数后重试')
    : err('STORAGE_UNAVAILABLE', '浏览器存储不可用, 本次修改无法保存')

const guard = async <T>(operation: () => Promise<Result<T>>): Promise<Result<T>> => {
  try {
    return await operation()
  } catch (error) {
    return mapStorageError(error)
  }
}

const toEntry = (key: string, raw: unknown): IndexEntry => {
  const parsed = parseFunction(raw)
  return parsed.ok
    ? { id: parsed.value.id, name: parsed.value.name, updatedAt: parsed.value.updatedAt }
    : { id: key.slice(FUNCTION_KEY_PREFIX.length), name: UNREADABLE_NAME, updatedAt: '' }
}

// 索引只是列表页的缓存: 它自身损坏时从 fn:* 条目重建, 不让用户丢失已保存的函数
const rebuildIndex = async (store: KeyValueStore): Promise<readonly IndexEntry[]> => {
  const keys = (await store.keys()).filter((key) => key.startsWith(FUNCTION_KEY_PREFIX))
  const values = await store.getMany(keys)
  return keys.map((key, position) => toEntry(key, values[position]))
}

const loadIndex = async (store: KeyValueStore): Promise<readonly IndexEntry[]> => {
  const parsed = indexSchema.safeParse(await store.get(INDEX_KEY))
  return parsed.success ? parsed.data : rebuildIndex(store)
}

const byUpdatedAtDesc = (a: FunctionSummary, b: FunctionSummary): number =>
  b.updatedAt.localeCompare(a.updatedAt)

const findAll = async (store: KeyValueStore): Promise<Result<readonly FunctionSummary[]>> => {
  const index = await loadIndex(store)
  const values = await store.getMany(index.map((entry) => functionKey(entry.id)))
  const summaries = index
    .map((entry, position) => ({ entry, raw: values[position] }))
    .filter(({ raw }) => raw !== undefined)
    .map(({ entry, raw }) => ({ ...entry, readable: parseFunction(raw).ok }))
  return ok([...summaries].sort(byUpdatedAtDesc))
}

const findById = async (store: KeyValueStore, id: string): Promise<Result<FourierFunction>> => {
  const raw = await store.get(functionKey(id))
  return raw === undefined ? err('NOT_FOUND', '找不到这个函数, 它可能已被删除') : parseFunction(raw)
}

const write = async (
  store: KeyValueStore,
  clock: Clock,
  fn: FourierFunction,
): Promise<Result<FourierFunction>> => {
  const stamped = parseFunction({ ...fn, updatedAt: clock() })
  if (!stamped.ok) return err('DATA_CORRUPT', '函数数据不合法, 无法保存')
  const { id, name, updatedAt } = stamped.value
  const others = (await loadIndex(store)).filter((entry) => entry.id !== id)
  await store.setMany([
    [functionKey(id), stamped.value],
    [INDEX_KEY, [{ id, name, updatedAt }, ...others]],
  ])
  return stamped
}

const rename = async (
  store: KeyValueStore,
  clock: Clock,
  id: string,
  name: string,
): Promise<Result<void>> => {
  const found = await findById(store, id)
  if (!found.ok) return found
  const renamed = renameFunction(found.value, name)
  if (!renamed.ok) return renamed
  const written = await write(store, clock, renamed.value)
  return written.ok ? ok(undefined) : written
}

const remove = async (store: KeyValueStore, id: string): Promise<Result<void>> => {
  const remaining = (await loadIndex(store)).filter((entry) => entry.id !== id)
  await store.setMany([[INDEX_KEY, remaining]])
  await store.del(functionKey(id))
  return ok(undefined)
}

export const createKeyValueRepository = (
  store: KeyValueStore,
  clock: Clock,
): FunctionRepository => ({
  findAll: () => guard(() => findAll(store)),
  findById: (id) => guard(() => findById(store, id)),
  save: (fn) => guard(() => write(store, clock, fn)),
  rename: (id, name) => guard(() => rename(store, clock, id, name)),
  remove: (id) => guard(() => remove(store, id)),
  loadDraft: () =>
    guard(async () => {
      const raw = await store.get(DRAFT_KEY)
      return raw === undefined ? ok(null) : parseDraft(raw)
    }),
  saveDraft: (draft) =>
    guard(async () => {
      await store.setMany([[DRAFT_KEY, draft]])
      return ok(undefined)
    }),
})
