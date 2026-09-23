import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export interface MediaInfo {
  durationSec: number
  width: number
  height: number
  videoCodec: string
  hasAudio: boolean
  /** 비디오 스트림 비트레이트(bps). 읽지 못하면 전체에서 추정한다 */
  videoBitrate: number
}

/** ffprobe 로 원본 정보를 읽는다 */
export async function probe(file: string): Promise<MediaInfo> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,bit_rate',
    '-show_entries', 'stream=codec_type,codec_name,width,height,bit_rate',
    '-of', 'json',
    file,
  ])

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; bit_rate?: string }
    streams?: Array<{
      codec_type?: string
      codec_name?: string
      width?: number
      height?: number
      bit_rate?: string
    }>
  }

  const streams = parsed.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video')
  if (!video) throw new Error(`영상 스트림이 없습니다: ${file}`)

  const duration = Number(parsed.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`길이를 읽을 수 없습니다: ${file}`)
  }

  const audio = streams.find((s) => s.codec_type === 'audio')
  const hasAudio = audio !== undefined

  // 컨테이너에 따라 스트림 비트레이트가 비어 있다. 그 경우 전체에서 오디오를 뺀다
  let videoBitrate = Number(video.bit_rate)
  if (!Number.isFinite(videoBitrate) || videoBitrate <= 0) {
    const total = Number(parsed.format?.bit_rate)
    const audioBits = Number(audio?.bit_rate)
    videoBitrate = Number.isFinite(total)
      ? total - (Number.isFinite(audioBits) ? audioBits : 0)
      : 0
  }

  return {
    durationSec: duration,
    width: video.width ?? 0,
    height: video.height ?? 0,
    videoCodec: video.codec_name ?? 'unknown',
    hasAudio,
    videoBitrate: Math.max(videoBitrate, 0),
  }
}
