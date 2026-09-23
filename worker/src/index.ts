/**
 * 미디어 전달 Worker
 *
 * R2 앞에 서서 모든 미디어 요청을 받는다. 서명 토큰과 Referer 를 검사해
 * 고정 다운로드 주소가 존재하지 않게 만든다.
 *
 * 현재는 뼈대만 있다. 서명 발급과 검증은 1단계에서 구현한다.
 */

export interface Env {
  MEDIA: R2Bucket
  MEDIA_SIGN_SECRET: string
  ALLOWED_ORIGINS: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        bucket: typeof env.MEDIA === 'object',
      })
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
