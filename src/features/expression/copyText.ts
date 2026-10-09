import { err, ok, type Result } from '../../core/types'

const UNAVAILABLE = '浏览器不允许自动复制, 请在下方文本框中按 Ctrl/⌘+C 复制'

/**
 * 剪贴板边界 (specs/004 research R6): 只在用户手势里调用. API 不存在(非安全上下文、旧浏览器)
 * 或写入被拒绝(权限、文档失焦)都以 Result 返回同一条中文说明, 由视图退回到可全选的文本框.
 */
export const copyText = async (text: string): Promise<Result<void>> => {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    return err('CLIPBOARD_UNAVAILABLE', UNAVAILABLE)
  }
  try {
    await clipboard.writeText(text)
    return ok(undefined)
  } catch {
    return err('CLIPBOARD_UNAVAILABLE', UNAVAILABLE)
  }
}
