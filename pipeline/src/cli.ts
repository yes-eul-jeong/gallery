/**
 * 업로드 CLI
 *
 * 영상 한 편을 받아 인코딩, HLS 분할, 썸네일 추출, R2 업로드, 콘텐츠 JSON 생성까지 처리한다.
 * 현재는 환경 변수 확인만 한다. 나머지는 1단계에서 구현한다.
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(here, '../../.env') })

const required = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'MEDIA_SIGN_SECRET',
] as const

const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`환경 변수가 비어 있습니다: ${missing.join(', ')}`)
  process.exit(1)
}

console.log('환경 변수 확인 완료')
console.log(`버킷: ${process.env.R2_BUCKET}`)
console.log('업로드 기능은 아직 구현되지 않았습니다.')
