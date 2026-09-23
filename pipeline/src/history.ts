import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { paths } from './config.js'

const file = join(paths.cache, 'history.json')

export interface History {
  events: string[]
  weightClasses: string[]
  roundFormats: string[]
  gyms: string[]
}

const empty: History = { events: [], weightClasses: [], roundFormats: [], gyms: [] }

export async function load(): Promise<History> {
  try {
    return { ...empty, ...JSON.parse(await readFile(file, 'utf8')) }
  } catch {
    return { ...empty }
  }
}

/**
 * 입력값을 기억한다.
 * 같은 대회를 조금씩 다르게 적으면 묶음이 갈라진다. 이 사고가 제일 흔하다.
 */
export async function remember(history: History, field: keyof History, value: string): Promise<void> {
  if (!value) return
  const list = history[field]
  const index = list.indexOf(value)
  if (index >= 0) list.splice(index, 1)
  list.unshift(value)
  history[field] = list.slice(0, 20)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(history, null, 2))
}
