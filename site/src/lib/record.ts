import type { CollectionEntry } from 'astro:content'

type Match = CollectionEntry<'matches'>

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
export function tally(matches: Match[], level: 'pro' | 'amateur'): Record {
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

/** 최신 경기가 앞에 오도록 정렬한다 */
export function byDateDesc(a: Match, b: Match): number {
  return b.data.date.localeCompare(a.data.date)
}
