import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { paths, type Resolution } from './config.js'

export interface VideoRef {
  key: string
  duration: number
  resolution: Resolution
}

export interface MatchEntry {
  date: string
  level: 'pro' | 'amateur'
  event: string
  rule: 'k1' | 'muaythai' | 'oriental'
  weightClass: string
  opponent: { name: string; gym?: string }
  rounds: string
  result: 'win' | 'loss' | 'draw' | 'nc'
  method: 'ko' | 'tko' | 'unanimous' | 'majority' | 'split' | 'retire'
  endTime?: string
  titleFight?: { name: string; type: 'challenge' | 'defense' }
  title: string
  description?: string
  video?: VideoRef
  photos: string[]
}

export interface TrainingEntry {
  date: string
  type: 'sparring' | 'mitt' | 'bag' | 'technique' | 'conditioning'
  title: string
  description?: string
  video?: VideoRef
  photos: string[]
}

/** 빈 값을 지운다. JSON 에 undefined 와 빈 문자열이 남지 않게 한다 */
function clean<T extends object>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (v === '' || v === undefined ? undefined : v)),
  ) as T
}

export async function writeMatch(id: string, entry: MatchEntry): Promise<string> {
  const dir = join(paths.content, 'matches')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${id}.json`)
  await writeFile(path, `${JSON.stringify(clean(entry), null, 2)}\n`)
  return path
}

export async function writeTraining(id: string, entry: TrainingEntry): Promise<string> {
  const dir = join(paths.content, 'training')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${id}.json`)
  await writeFile(path, `${JSON.stringify(clean(entry), null, 2)}\n`)
  return path
}
