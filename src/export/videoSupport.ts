export interface VideoSupport {
  readonly supported: boolean
  readonly reason?: string
}

// H.264 High profile level 4.0: 足以覆盖 1080p30; 探测按契约固定在 1280x720
const H264_PROBE_CONFIG: VideoEncoderConfig = {
  codec: 'avc1.640028',
  width: 1280,
  height: 720,
  bitrate: 5_000_000,
  framerate: 30,
}

const NO_WEBCODECS_REASON = '当前浏览器不支持 WebCodecs, 无法导出视频; 请改用新版 Chrome 或 Edge'
const NO_H264_REASON = '当前浏览器不支持 H.264 视频编码, 无法导出视频; 图片导出仍然可用'

/** 仅探测 H.264/MP4 (FR-023d); 任何异常都视为不支持, 绝不 reject */
export const detectVideoSupport = async (): Promise<VideoSupport> => {
  if (typeof VideoEncoder === 'undefined') return { supported: false, reason: NO_WEBCODECS_REASON }
  try {
    const support = await VideoEncoder.isConfigSupported(H264_PROBE_CONFIG)
    return support.supported === true
      ? { supported: true }
      : { supported: false, reason: NO_H264_REASON }
  } catch {
    return { supported: false, reason: NO_H264_REASON }
  }
}
