import type { FunctionRepository } from './FunctionRepository'
import { createIndexedDbFunctionRepository } from './IndexedDbFunctionRepository'

let current: FunctionRepository | null = null

/** 应用使用的仓储; 测试通过 setRepository 换成内存实现 */
export const getRepository = (): FunctionRepository => {
  current ??= createIndexedDbFunctionRepository()
  return current
}

export const setRepository = (repository: FunctionRepository | null): void => {
  current = repository
}
