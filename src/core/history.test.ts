import { createDefaultFunction, rename } from './function'
import { commit, createHistory, redo, undo } from './history'
import { MAX_HISTORY } from './ranges'
import type { FourierFunction } from './types'

const named = (fn: FourierFunction, name: string): FourierFunction => {
  const result = rename(fn, name)
  if (!result.ok) throw new Error('rename failed')
  return result.value
}

describe('history', () => {
  const base = createDefaultFunction()

  test('commit pushes the previous present and clears the future', () => {
    const a = named(base, 'a')
    const b = named(base, 'b')
    const afterUndo = undo(commit(createHistory(base), a))
    const history = commit(afterUndo, b)
    expect(history.past).toEqual([base])
    expect(history.present).toBe(b)
    expect(history.future).toEqual([])
  })

  test('committing the identical reference adds no step', () => {
    const history = createHistory(base)
    expect(commit(history, base)).toBe(history)
  })

  test('drops the oldest step beyond the limit', () => {
    let history = createHistory(base)
    for (let i = 0; i < MAX_HISTORY + 5; i++) history = commit(history, named(base, `n${i}`))
    expect(history.past).toHaveLength(MAX_HISTORY)
    expect(history.past[0]?.name).toBe('n4')
  })

  test('undo then redo restores the same reference', () => {
    const a = named(base, 'a')
    const history = commit(createHistory(base), a)
    expect(undo(history).present).toBe(base)
    expect(redo(undo(history)).present).toBe(a)
  })

  test('undo and redo on empty stacks return the same history', () => {
    const history = createHistory(base)
    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })
})
