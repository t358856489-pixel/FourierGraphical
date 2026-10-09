import type { Coefficient } from './types'

/** 乘积里的负系数加括号: 2π·(-0.4)·t; 三种渲染(纯文本 / LaTeX / 视图)共用同一规则 */
export const signedFactor = (c: Coefficient): string =>
  c.value < 0 && c.text !== '0' ? `(${c.text})` : c.text

/** 相位项的符号与绝对值: " - 30°" 而不是 " + -30°" */
export const splitPhase = (
  c: Coefficient,
): { readonly sign: '+' | '-'; readonly magnitude: string } =>
  c.text.startsWith('-')
    ? { sign: '-', magnitude: c.text.slice(1) }
    : { sign: '+', magnitude: c.text }
