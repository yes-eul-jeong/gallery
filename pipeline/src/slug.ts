/**
 * 파일명과 R2 키에 쓸 식별자를 만든다.
 * 한글은 URL 에서 인코딩되어 읽기 어려워지므로 영문과 숫자만 남긴다.
 */
export function slugify(...parts: string[]): string {
  const base = parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, ' ')
    // 한글은 제거한다. 남기면 주소가 퍼센트 인코딩으로 뒤덮인다
    .replace(/[가-힣]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return base
}

/** 슬러그가 비면(대회명이 전부 한글인 경우) 날짜만으로 만든다 */
export function makeId(date: string, ...parts: string[]): string {
  const slug = slugify(...parts)
  return slug ? `${date}-${slug}` : date
}
