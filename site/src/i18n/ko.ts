/**
 * 화면 문자열을 한곳에 모은다.
 * 다국어는 나중에 도입한다. 지금은 코드에 문자열을 흩뿌리지 않는 선까지만 대비한다.
 */

export const ui = {
  record: 'RECORD',
  nextBout: 'NEXT BOUT',
  availability: 'AVAILABILITY',
  eventResults: 'EVENT RESULTS',
  videos: 'VIDEOS',
  breakdown: 'BREAKDOWN',
  photos: 'PHOTOS',
  contact: 'CONTACT',

  viewAll: '전체 보기',
  viewList: 'VIEW LIST',
  viewGallery: '전체 갤러리',
  back: 'BACK',
  scroll: 'SCROLL',
  all: '전체',
  empty: {
    videos: '해당하는 영상이 없습니다.',
    photos: '해당하는 사진이 없습니다.',
  },

  proRecord: 'PRO RECORD',
  availableFrom: (d: string) => `${d} 이후 출전 가능`,
  available: '출전 가능',
  countUnit: (n: number) => `${n}개`,
} as const

export const levelLabel = {
  pro: '프로',
  semipro: '세미프로',
  amateur: '아마추어',
} as const

export const resultLabel = {
  win: '승',
  loss: '패',
  draw: '무',
  nc: '무효',
} as const

/** 목록에 쓰는 한 글자 표기 */
export const resultMark = {
  win: 'W',
  loss: 'L',
  draw: 'D',
  nc: 'NC',
} as const

export const methodLabel = {
  ko: 'KO',
  tko: 'TKO',
  unanimous: '만장일치',
  majority: '다수',
  split: '스플릿',
  retire: '기권',
} as const

export const ruleLabel = {
  k1: 'K-1',
  muaythai: '무에타이',
  oriental: '오리엔탈',
} as const

export const trainingLabel = {
  sparring: '스파링',
  mitt: '미트',
  bag: '샌드백',
  technique: '기술',
  conditioning: '체력',
} as const

export const photoKindLabel = {
  match: '경기',
  weighin: '계체',
  award: '시상',
  training: '훈련',
} as const

export const genderLabel = {
  female: '여자',
  male: '남자',
} as const

/** 2026-06-24 → 2026.06.24 */
export function formatDate(iso: string): string {
  return iso.replaceAll('-', '.')
}

/** 초 → 14:32 */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
