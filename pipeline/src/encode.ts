import { spawn } from 'node:child_process'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { audioBitrate, resolveEncodeSettings, segmentSeconds, type Resolution } from './config.js'
import type { MediaInfo } from './probe.js'

export interface EncodeResult {
  /** HLS 재생목록 경로 */
  playlist: string
  /** 조각 파일 개수 */
  segmentCount: number
  /** 산출물 디렉터리 */
  outDir: string
}

function ffmpeg(args: string[], onProgress?: (sec: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      // -progress pipe:1 이 내보내는 key=value 스트림에서 진행 시각을 읽는다
      for (const line of chunk.toString().split('\n')) {
        const [key, value] = line.split('=')
        if (key === 'out_time_us' && onProgress) {
          const us = Number(value)
          if (Number.isFinite(us)) onProgress(us / 1_000_000)
        }
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      // 메모리 보호. 실패 시 뒤쪽이 더 유용하다
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000)
    })

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 실패 (종료 코드 ${code})\n${stderr}`))
    })
  })
}

/**
 * 원본을 H.264 로 인코딩하고 HLS 로 분할한다.
 *
 * 조각을 내는 이유는 두 가지다. 재생 시작이 빨라지고, 통째로 내려받으려면
 * 조각 전부를 모아 합쳐야 해서 일반적인 다운로드 시도가 막힌다.
 */
export async function encodeToHls(
  input: string,
  outDir: string,
  resolution: Resolution,
  info: MediaInfo,
  onProgress?: (ratio: number) => void,
): Promise<EncodeResult> {
  await mkdir(outDir, { recursive: true })

  const settings = resolveEncodeSettings(resolution, info.height, info.videoBitrate)
  const playlist = join(outDir, 'index.m3u8')

  const args = [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i', input,

    // 비디오: H.264 로 통일한다. HEVC 나 다른 코덱은 브라우저 호환성이 갈린다
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', String(settings.crf),
    '-maxrate', settings.maxrate,
    '-bufsize', settings.bufsize,
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    // 세로 해상도를 맞추고 가로는 비율대로. -2 는 2의 배수로 맞춘다
    '-vf', `scale=-2:${settings.height}:flags=lanczos`,
    // 조각 경계를 키프레임에 맞춘다. 맞지 않으면 구간 이동이 어긋난다
    '-g', String(segmentSeconds * 30),
    '-keyint_min', String(segmentSeconds * 30),
    '-sc_threshold', '0',
  ]

  if (info.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', audioBitrate, '-ac', '2')
  } else {
    args.push('-an')
  }

  args.push(
    '-f', 'hls',
    '-hls_time', String(segmentSeconds),
    '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'fmp4',
    '-hls_flags', 'independent_segments',
    '-hls_fmp4_init_filename', 'init.mp4',
    '-hls_segment_filename', join(outDir, 'seg%04d.m4s'),
    '-progress', 'pipe:1',
    playlist,
  )

  await ffmpeg(args, (sec) => onProgress?.(Math.min(sec / info.durationSec, 1)))

  const files = await readdir(outDir)
  return {
    playlist,
    segmentCount: files.filter((f) => f.endsWith('.m4s')).length,
    outDir,
  }
}

/**
 * 썸네일을 뽑는다. 기본은 10% 지점이며, KO 장면 같은 특정 순간을 쓰고 싶으면
 * 초를 직접 지정한다.
 */
export async function extractThumbnails(
  input: string,
  outDir: string,
  info: MediaInfo,
  atSecond?: number,
): Promise<{ grid: string; detail: string }> {
  await mkdir(outDir, { recursive: true })

  const seek = atSecond ?? info.durationSec * 0.1
  const grid = join(outDir, 'thumb-640.webp')
  const detail = join(outDir, 'thumb-1280.webp')

  for (const [path, width] of [
    [grid, 640],
    [detail, 1280],
  ] as const) {
    await ffmpeg([
      '-hide_banner',
      '-nostdin',
      '-y',
      '-ss', seek.toFixed(3),
      '-i', input,
      '-frames:v', '1',
      '-vf', `scale=${width}:-2:flags=lanczos`,
      '-c:v', 'libwebp',
      '-quality', '82',
      path,
    ])
  }

  return { grid, detail }
}
