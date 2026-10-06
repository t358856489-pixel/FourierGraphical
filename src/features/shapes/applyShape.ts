import { analyze, normalize, resample, toComponents } from '../../core/shape/spectrum'
import { PRESET_BASE_FREQUENCY, SHAPE_SAMPLE_COUNT, SHAPE_SAMPLE_MAX } from '../../core/ranges'
import type { FourierFunction, Result, ShapePath, ShapeSpectrum } from '../../core/types'
import type { EditMode } from '../../state/documentStore'
import { prefersReducedMotion } from '../../hooks/useReducedMotion'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useViewStore } from '../../state/viewStore'
import { rememberGenerated } from './generatedMark'

/** 路径 → 频谱: 采样数取 1024 或路径点数的下一个 2 的幂, 上限 4096 */
export const spectrumOf = (path: ShapePath): ShapeSpectrum => {
  const wanted = 2 ** Math.ceil(Math.log2(Math.max(SHAPE_SAMPLE_COUNT, path.length)))
  return analyze(normalize(resample(path, Math.min(SHAPE_SAMPLE_MAX, wanted))))
}

/**
 * 把频谱装进编辑器 (FR-006/007/007a): 一步可撤销地替换分量, 切到二维绘图, 时间归零并播放,
 * 显示选项切换为"保留整幅图形". 开启"减少动态效果"时不播放, 直接跳到一个周期的末尾显示整幅图形.
 */
export const applySpectrum = (
  spectrum: ShapeSpectrum,
  count: number,
  mode: EditMode = 'commit',
): Result<FourierFunction> => {
  const result = useDocumentStore.getState().applyGenerated(toComponents(spectrum, count), mode)
  if (!result.ok) return result
  rememberGenerated(result.value)
  // 拖动滑块时只预览分量; 显示选项与播放的切换属于"应用"这一动作, 预览不重复触发
  if (mode === 'preview') return result

  const view = useViewStore.getState()
  if (!view.showTrail) view.toggle('showTrail')
  if (view.trailFade) view.toggle('trailFade')
  view.setTrailRetention('all')

  const playback = usePlaybackStore.getState()
  playback.reset()
  if (prefersReducedMotion()) playback.seek(1 / PRESET_BASE_FREQUENCY)
  else playback.play()
  return result
}
