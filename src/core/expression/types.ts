/** 表达式的写法: 复数形式 z(t) / 参数方程 x(t), y(t) / 波形 y(t) */
export type Notation = 'complex' | 'parametric' | 'waveform'

/** 复制格式 */
export type CopyFormat = 'plain' | 'latex'

/** 一个系数: 未取整的瞬时值与按显示精度格式化后的文本 */
export interface Coefficient {
  readonly value: number
  /** 最多 EXPRESSION_DECIMALS 位小数, 去掉末尾 0, 负零为 "0" */
  readonly text: string
  /** text 与 value 不相等(发生了四舍五入) */
  readonly isRounded: boolean
}

/** 表达式中的一项, 对应一个启用的分量 */
export interface ExpressionTerm {
  readonly componentId: string
  /** 分量的语义色索引, 如 "c3" */
  readonly color: string
  readonly amplitude: Coefficient
  /** 圈/秒 */
  readonly frequency: Coefficient
  /** 度 */
  readonly phaseDeg: Coefficient
  /** 三个参数中任一带关键帧 */
  readonly isAnimated: boolean
}

/** 由 (函数, t) 派生的表达式结构; 不保存 */
export interface Expression {
  /** 只含启用分量, 顺序与分量列表一致 */
  readonly terms: readonly ExpressionTerm[]
  /** 停用分量的个数 */
  readonly excludedCount: number
  readonly hasAnimated: boolean
  readonly isRounded: boolean
  /** 构建时使用的时刻; 仅当 hasAnimated 时有意义 */
  readonly time: number
}
