import type { CollectionEntry } from 'astro:content'

type Match = CollectionEntry<'matches'>
export type Level = Match['data']['level']

export interface Record {
  win: number
  loss: number
  draw: number
  /** KO 와 TKO 로 거둔 승리 */
  ko: number
  /** 무효 경기. 전적 수에서 제외한다 */
  noContest: number
}

const empty = (): Record => ({ win: 0, loss: 0, draw: 0, ko: 0, noContest: 0 })

/**
 * 경기 목록에서 전적을 집계한다.
 * 별도로 관리하는 숫자가 없으므로 전적과 경기 목록이 어긋날 수 없다.
 */
export function tally(matches: Match[], level: Level): Record {
  return matches
    .filter((m) => m.data.level === level)
    .reduce((acc, m) => {
      const { result, method } = m.data
      if (result === 'nc') {
        acc.noContest += 1
        return acc
      }
      if (result === 'win') {
        acc.win += 1
        if (method === 'ko' || method === 'tko') acc.ko += 1
      } else if (result === 'loss') {
        acc.loss += 1
      } else {
        acc.draw += 1
      }
      return acc
    }, empty())
}

/** 경기 수. 무효는 제외한다 */
export function bouts(r: Record): number {
  return r.win + r.loss + r.draw
}

/** 승률. 경기가 없으면 0 */
export function winRate(r: Record): number {
  const n = bouts(r)
  return n === 0 ? 0 : Math.round((r.win / n) * 100)
}

/** 승리 중 피니시로 끝낸 비율 */
export function finishRate(r: Record): number {
  return r.win === 0 ? 0 : Math.round((r.ko / r.win) * 100)
}

/** 승리 중 판정으로 끝낸 비율 */
export function decisionRate(r: Record): number {
  return r.win === 0 ? 0 : 100 - finishRate(r)
}

/** 최신 경기가 앞에 오도록 정렬한다 */
export function byDateDesc(
  a: { data: { date: string } },
  b: { data: { date: string } },
): number {
  return b.data.date.localeCompare(a.data.date)
}
