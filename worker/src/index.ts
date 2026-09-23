/**
 * 미디어 전달 Worker
 *
 * R2 앞에 서서 모든 미디어 요청을 받는다. 고정 다운로드 주소가 존재하지 않게 만들고,
 * 다른 사이트에서의 직접 삽입을 막는다.
 *
 * 완전한 차단은 아니다. 조각을 전부 받아 합치는 것은 기술적으로 가능하다.
 * 그 수준까지 막으려면 DRM 이 필요하고, 개인 포트폴리오에 적용할 규모가 아니다.
 */
import { issue, verify } from './sign.js'

export interface Env {
  MEDIA: R2Bucket
  MEDIA_SIGN_SECRET: string
  ALLOWED_ORIGINS: string
}

/** 토큰 유효 시간. 영상 한 편을 끝까지 볼 시간을 준다 */
const TTL_SECONDS = 30 * 60

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

/** 요청 출처를 확인한다. Origin 이 없으면 Referer 에서 뽑는다 */
function originOf(request: Request): string | null {
  const origin = request.headers.get('Origin')
  if (origin) return origin

  const referer = request.headers.get('Referer')
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

function isAllowed(request: Request, env: Env): boolean {
  const origin = originOf(request)
  if (!origin) return false
  return allowedOrigins(env).includes(origin)
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = originOf(request)
  const allow = origin && allowedOrigins(env).includes(origin) ? origin : ''
  return allow
    ? {
        'Access-Control-Allow-Origin': allow,
        'Vary': 'Origin',
      }
    : {}
}

function deny(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/**
 * 재생목록 안의 상대 경로에 토큰을 붙인다.
 * 조각마다 서명을 다시 계산하지 않고 같은 토큰을 재사용한다.
 */
function rewritePlaylist(text: string, query: string): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      // #EXT-X-MAP:URI="init.mp4" 형태
      if (trimmed.startsWith('#EXT-X-MAP:')) {
        return line.replace(/URI="([^"]+)"/, (_, uri: string) => `URI="${uri}?${query}"`)
      }
      // 주석과 태그는 건드리지 않는다
      if (trimmed.startsWith('#')) return line

      return `${trimmed}?${query}`
    })
    .join('\n')
}

async function serveObject(
  request: Request,
  env: Env,
  key: string,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  const range = request.headers.get('Range')
  const object = await env.MEDIA.get(key, range ? { range: request.headers } : undefined)

  if (!object) return deny(404, 'Not Found')

  const headers = new Headers(extraHeaders)
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  // 토큰이 만료되면 어차피 다시 받아야 하므로 캐시를 짧게 둔다
  headers.set('Cache-Control', 'private, max-age=600')

  // R2 는 range 옵션 없이 가져와도 range 를 채워 넣는다.
  // 요청에 Range 가 없었다면 200 으로 응답해야 한다.
  if (range && object.range && 'offset' in object.range) {
    const offset = object.range.offset ?? 0
    const length = object.range.length ?? object.size - offset
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    return new Response(object.body, { status: 206, headers })
  }

  return new Response(object.body, { headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return deny(405, 'Method Not Allowed')
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, bucket: typeof env.MEDIA === 'object' })
    }

    // 서명 발급: /sign/<id>
    const signMatch = url.pathname.match(/^\/sign\/([\w.-]+)$/)
    if (signMatch) {
      if (!isAllowed(request, env)) return deny(403, 'Forbidden')

      const id = signMatch[1]!
      const token = await issue(env.MEDIA_SIGN_SECRET, id, TTL_SECONDS)
      const query = `t=${token.sig}&e=${token.exp}`

      return Response.json(
        {
          playlist: `${url.origin}/hls/${id}/index.m3u8?${query}`,
          expiresAt: token.exp,
        },
        { headers: { ...cors, 'Cache-Control': 'no-store' } },
      )
    }

    // 미디어 전달: /hls/<id>/<파일>
    const hlsMatch = url.pathname.match(/^\/hls\/([\w.-]+)\/([\w.-]+)$/)
    if (hlsMatch) {
      const [, id, file] = hlsMatch as unknown as [string, string, string]

      if (!isAllowed(request, env)) return deny(403, 'Forbidden')

      const sig = url.searchParams.get('t')
      const exp = url.searchParams.get('e')
      if (!(await verify(env.MEDIA_SIGN_SECRET, id, sig, exp))) {
        return deny(403, 'Invalid or expired token')
      }

      const key = `hls/${id}/${file}`

      // 재생목록은 조각 주소에 토큰을 넣어 다시 쓴다
      if (file.endsWith('.m3u8')) {
        const object = await env.MEDIA.get(key)
        if (!object) return deny(404, 'Not Found')

        const rewritten = rewritePlaylist(await object.text(), `t=${sig}&e=${exp}`)
        return new Response(rewritten, {
          headers: {
            ...cors,
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-store',
          },
        })
      }

      return serveObject(request, env, key, cors)
    }

    // 썸네일: 카드 그리드에서 여러 장이 한꺼번에 뜨므로 서명을 요구하지 않는다.
    // 유출되어도 피해가 작고, Referer 검사로 직접 삽입은 막는다.
    const thumbMatch = url.pathname.match(/^\/thumb\/([\w.-]+)\/([\w.-]+)$/)
    if (thumbMatch) {
      if (!isAllowed(request, env)) return deny(403, 'Forbidden')
      const [, id, file] = thumbMatch as unknown as [string, string, string]
      return serveObject(request, env, `hls/${id}/${file}`, {
        ...cors,
        'Cache-Control': 'private, max-age=86400',
      })
    }

    return deny(404, 'Not Found')
  },
} satisfies ExportedHandler<Env>
