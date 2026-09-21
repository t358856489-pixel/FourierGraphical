export interface RecordedCall {
  readonly method: string
  readonly args: readonly unknown[]
  readonly strokeStyle: unknown
  readonly globalAlpha: unknown
  readonly lineWidth: unknown
}

export interface FakeContext {
  readonly ctx: CanvasRenderingContext2D
  readonly calls: RecordedCall[]
  readonly count: (method: string) => number
}

/** 记录所有方法调用的假 2D 上下文, 用于断言绘制行为而不依赖真实 canvas */
export const createFakeContext = (): FakeContext => {
  const calls: RecordedCall[] = []
  const state: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1, strokeStyle: '#000' }
  const ctx = new Proxy(state, {
    get: (target, property: string) => {
      if (property in target) return target[property]
      return (...args: unknown[]) => {
        calls.push({
          method: property,
          args,
          strokeStyle: target['strokeStyle'],
          globalAlpha: target['globalAlpha'],
          lineWidth: target['lineWidth'],
        })
      }
    },
    set: (target, property: string, value: unknown) => {
      return Reflect.set(target, property, value)
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls, count: (method) => calls.filter((call) => call.method === method).length }
}
