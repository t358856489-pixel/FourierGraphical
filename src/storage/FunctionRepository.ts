import type { Draft } from '../core/schema'
import type { FourierFunction, Result } from '../core/types'

export type { Draft } from '../core/schema'

export interface FunctionSummary {
  readonly id: string
  readonly name: string
  readonly updatedAt: string
  /** false 表示该条目未通过 schema 校验, 只能删除, 不能打开 */
  readonly readable: boolean
}

/** 任何方法都不抛异常、不 reject; 失败一律以 Result 返回 (contracts §7) */
export interface FunctionRepository {
  findAll(): Promise<Result<readonly FunctionSummary[]>>
  findById(id: string): Promise<Result<FourierFunction>>
  save(fn: FourierFunction): Promise<Result<FourierFunction>>
  rename(id: string, name: string): Promise<Result<void>>
  remove(id: string): Promise<Result<void>>
  loadDraft(): Promise<Result<Draft | null>>
  saveDraft(draft: Draft): Promise<Result<void>>
}
