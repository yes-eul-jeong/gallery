/**
 * 미디어 주소를 만든다.
 *
 * 사진과 호버용 짧은 클립은 사이트에 같이 올린다. 저화질 조각이라
 * 보호할 것이 없고, 첫 화면에서 서명을 여러 번 받으면 느려진다.
 * 풀 경기 영상만 Worker 를 거친다.
 */

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

/** public/media 아래 파일 */
export function asset(file: string): string {
  return `${base}/media/${file}`
}

/** 사이트 안 경로 */
export function url(path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** 보호된 영상을 재생할 Worker 도메인. 비어 있으면 재생기를 감춘다 */
export const mediaBase: string = import.meta.env.PUBLIC_MEDIA_BASE ?? ''
