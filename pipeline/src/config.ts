import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(here, '../..')

loadEnv({ path: resolve(repoRoot, '.env'), quiet: true })

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`환경 변수가 비어 있습니다: ${key}`)
  return value
}

export const env = {
  get accountId() {
    return required('R2_ACCOUNT_ID')
  },
  get accessKeyId() {
    return required('R2_ACCESS_KEY_ID')
  },
  get secretAccessKey() {
    return required('R2_SECRET_ACCESS_KEY')
  },
  get bucket() {
    return required('R2_BUCKET')
  },
  get signSecret() {
    return required('MEDIA_SIGN_SECRET')
  },
}

export const paths = {
  /** 인코딩 중간 산출물. 저장소에 넣지 않는다 */
  cache: resolve(repoRoot, 'cache'),
  content: resolve(repoRoot, 'site/src/content'),
}

export type Resolution = '1080p' | '720p'

/** 해상도별 인코딩 설정 */
export const presets = {
  '1080p': { height: 1080, crf: 22, maxrate: '6M', bufsize: '12M' },
  '720p': { height: 720, crf: 24, maxrate: '3M', bufsize: '6M' },
} as const

/** HLS 조각 길이(초) */
export const segmentSeconds = 6

/** 오디오 비트레이트 */
export const audioBitrate = '128k'

/**
 * 영상 길이로 해상도를 결정한다.
 *
 * 짧은 경기 영상은 포트폴리오의 얼굴이므로 화질을 우선하고,
 * 장시간 기록물은 용량을 우선한다. 2~3시간짜리를 1080p 로 정주행할 방문자는 없다.
 */
export const longFormThresholdSec = 15 * 60

export function pickResolution(durationSec: number): Resolution {
  return durationSec <= longFormThresholdSec ? '1080p' : '720p'
}

/**
 * 실제로 적용할 인코딩 설정을 계산한다.
 *
 * 재인코딩으로 화질이 원본보다 좋아질 수는 없으므로 비트레이트를 원본 이상 쓸 이유가 없다.
 * 상한을 두지 않으면 이미 잘 압축된 원본(HEVC, SNS 전송본)이 오히려 커진다.
 * 해상도도 같은 이유로 원본을 넘겨 확대하지 않는다.
 */
export function resolveEncodeSettings(
  resolution: Resolution,
  sourceHeight: number,
  sourceVideoBitrate: number,
) {
  const preset = presets[resolution]
  const height = sourceHeight > 0 ? Math.min(preset.height, sourceHeight) : preset.height

  const presetMaxBps = Number(preset.maxrate.replace('M', '')) * 1_000_000
  // 원본과 같은 비트레이트면 화질 손실분만큼 손해이므로 약간의 여유를 준다
  const sourceCap = sourceVideoBitrate > 0 ? Math.round(sourceVideoBitrate * 1.1) : Infinity
  const maxBps = Math.min(presetMaxBps, sourceCap)

  return {
    height,
    crf: preset.crf,
    maxrate: `${Math.round(maxBps / 1000)}k`,
    bufsize: `${Math.round((maxBps * 2) / 1000)}k`,
  }
}
