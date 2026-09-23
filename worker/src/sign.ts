/**
 * 미디어 접근 토큰
 *
 * 영상 하나 단위로 서명한다. 파일마다 서명하면 재생목록을 다시 쓸 때
 * 조각 수만큼 서명을 계산해야 하는데, 조각이 수백 개인 장편에서는 낭비다.
 */

const encoder = new TextEncoder()

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  // URL 에 넣으므로 base64url 로 인코딩한다
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export interface Token {
  sig: string
  exp: number
}

export async function issue(secret: string, id: string, ttlSeconds: number): Promise<Token> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return { sig: await hmac(secret, `${id}:${exp}`), exp }
}

export async function verify(
  secret: string,
  id: string,
  sig: string | null,
  exp: string | null,
): Promise<boolean> {
  if (!sig || !exp) return false

  const expiry = Number(exp)
  if (!Number.isFinite(expiry)) return false
  if (expiry < Math.floor(Date.now() / 1000)) return false

  const expected = await hmac(secret, `${id}:${expiry}`)
  // 타이밍 공격을 피하려면 길이를 먼저 맞추고 전체를 비교한다
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  }
  return diff === 0
}
