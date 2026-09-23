/**
 * 업로드 CLI
 *
 * 영상 한 편을 받아 인코딩, HLS 분할, 썸네일 추출, R2 업로드, 콘텐츠 JSON 생성까지 처리한다.
 *
 *   npm run add -- ./경기영상.mov
 */
import * as p from '@clack/prompts'
import { rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { paths, pickResolution } from './config.js'
import { encodeToHls, extractThumbnails } from './encode.js'
import { load as loadHistory, remember, type History } from './history.js'
import { probe } from './probe.js'
import { makeId } from './slug.js'
import { putDirectory, removePrefix } from './upload.js'
import { writeMatch, writeTraining, type MatchEntry, type TrainingEntry } from './content.js'

function bail(message: string): never {
  p.cancel(message)
  process.exit(1)
}

/** 취소(Ctrl+C)를 일관되게 처리한다 */
function required<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) bail('취소했습니다')
  return value as Exclude<T, symbol>
}

/** clack 의 validate 는 값이 비어 있을 때 undefined 를 넘긴다 */
function notEmpty(value: string | undefined): string | undefined {
  return value && value.trim() ? undefined : '값을 입력하세요'
}

/** 이전 입력이 있으면 목록에서 고르고, 없거나 새로 넣으려면 직접 입력한다 */
async function pickOrType(label: string, previous: string[], initial?: string): Promise<string> {
  if (previous.length === 0) {
    return required(
      await p.text({
        message: label,
        initialValue: initial,
        validate: notEmpty,
      }),
    ).trim()
  }

  const choice = required(
    await p.select({
      message: label,
      options: [
        ...previous.map((value) => ({ value, label: value })),
        { value: '__new__', label: '직접 입력' },
      ],
    }),
  )

  if (choice !== '__new__') return choice

  return required(
    await p.text({
      message: `${label} (직접 입력)`,
      validate: notEmpty,
    }),
  ).trim()
}

/** 파일 수정 시각에서 촬영 날짜를 추정한다 */
async function guessDate(file: string): Promise<string> {
  const info = await stat(file)
  return info.mtime.toISOString().slice(0, 10)
}

async function askMatch(history: History, date: string): Promise<MatchEntry> {
  const level = required(
    await p.select({
      message: '프로 경기인가요?',
      options: [
        { value: 'pro' as const, label: '프로' },
        { value: 'amateur' as const, label: '아마추어' },
      ],
    }),
  )

  const event = await pickOrType('대회명', history.events)
  await remember(history, 'events', event)

  const rule = required(
    await p.select({
      message: '룰',
      options: [
        { value: 'k1' as const, label: 'K-1' },
        { value: 'muaythai' as const, label: '무에타이' },
        { value: 'oriental' as const, label: '오리엔탈' },
      ],
    }),
  )

  const weightClass = await pickOrType('체급', history.weightClasses)
  await remember(history, 'weightClasses', weightClass)

  const opponentName = required(
    await p.text({ message: '상대 선수', validate: notEmpty }),
  ).trim()

  const opponentGym = required(await p.text({ message: '상대 소속 (없으면 엔터)' })).trim()
  if (opponentGym) await remember(history, 'gyms', opponentGym)

  const rounds = await pickOrType('라운드 형식', history.roundFormats, '3R 3분')
  await remember(history, 'roundFormats', rounds)

  const result = required(
    await p.select({
      message: '결과',
      options: [
        { value: 'win' as const, label: '승' },
        { value: 'loss' as const, label: '패' },
        { value: 'draw' as const, label: '무' },
        { value: 'nc' as const, label: '무효' },
      ],
    }),
  )

  const method = required(
    await p.select({
      message: '결정 방식',
      options: [
        { value: 'ko' as const, label: 'KO' },
        { value: 'tko' as const, label: 'TKO' },
        { value: 'unanimous' as const, label: '판정 (만장일치)' },
        { value: 'majority' as const, label: '판정 (다수)' },
        { value: 'split' as const, label: '판정 (스플릿)' },
        { value: 'retire' as const, label: '기권' },
      ],
    }),
  )

  const endTime =
    method === 'ko' || method === 'tko' || method === 'retire'
      ? required(await p.text({ message: '결정 시점 (예: 2R 1:34)' })).trim()
      : ''

  const isTitle = required(await p.confirm({ message: '타이틀전인가요?', initialValue: false }))
  let titleFight: MatchEntry['titleFight']
  if (isTitle) {
    const name = required(
      await p.text({ message: '타이틀명', validate: notEmpty }),
    ).trim()
    const type = required(
      await p.select({
        message: '도전인가요 방어인가요?',
        options: [
          { value: 'challenge' as const, label: '도전' },
          { value: 'defense' as const, label: '방어' },
        ],
      }),
    )
    titleFight = { name, type }
  }

  const title = required(
    await p.text({
      message: '제목 (카드에 표시)',
      initialValue: `${event} vs ${opponentName}`,
      validate: notEmpty,
    }),
  ).trim()

  const description = required(await p.text({ message: '설명 (없으면 엔터)' })).trim()

  return {
    date,
    level,
    event,
    rule,
    weightClass,
    opponent: opponentGym ? { name: opponentName, gym: opponentGym } : { name: opponentName },
    rounds,
    result,
    method,
    ...(endTime ? { endTime } : {}),
    ...(titleFight ? { titleFight } : {}),
    title,
    ...(description ? { description } : {}),
    photos: [],
  }
}

async function askTraining(date: string): Promise<TrainingEntry> {
  const type = required(
    await p.select({
      message: '훈련 유형',
      options: [
        { value: 'sparring' as const, label: '스파링' },
        { value: 'mitt' as const, label: '미트' },
        { value: 'bag' as const, label: '샌드백' },
        { value: 'technique' as const, label: '기술' },
        { value: 'conditioning' as const, label: '체력' },
      ],
    }),
  )

  const title = required(
    await p.text({ message: '제목', validate: notEmpty }),
  ).trim()

  const description = required(await p.text({ message: '설명 (없으면 엔터)' })).trim()

  return { date, type, title, ...(description ? { description } : {}), photos: [] }
}

async function main(): Promise<void> {
  const input = process.argv[2]
  if (!input) bail('사용법: npm run add -- <영상 파일 경로>')

  await stat(input).catch(() => bail(`파일을 찾을 수 없습니다: ${input}`))

  p.intro(`영상 등록 · ${basename(input)}`)

  const info = await probe(input)
  const resolution = pickResolution(info.durationSec)
  const minutes = Math.floor(info.durationSec / 60)
  const seconds = Math.round(info.durationSec % 60)

  p.log.info(
    [
      `길이 ${minutes}분 ${seconds}초`,
      `${info.width}x${info.height}`,
      info.videoCodec,
      `→ ${resolution} 로 인코딩`,
    ].join(' · '),
  )

  const history = await loadHistory()

  const guessed = await guessDate(input)
  const date = required(
    await p.text({
      message: '날짜',
      initialValue: guessed,
      validate: (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? undefined : 'YYYY-MM-DD 형식으로 입력하세요'),
    }),
  )

  const kind = required(
    await p.select({
      message: '무엇을 등록하나요?',
      options: [
        { value: 'match' as const, label: '경기' },
        { value: 'training' as const, label: '훈련' },
      ],
    }),
  )

  const entry = kind === 'match' ? await askMatch(history, date) : await askTraining(date)
  const id = makeId(date, kind === 'match' ? (entry as MatchEntry).event : (entry as TrainingEntry).title)
  const workDir = join(paths.cache, id)

  const spinner = p.spinner()

  spinner.start('인코딩')
  await rm(workDir, { recursive: true, force: true })
  const encoded = await encodeToHls(input, workDir, resolution, info, (ratio) => {
    spinner.message(`인코딩 ${Math.round(ratio * 100)}%`)
  })
  await extractThumbnails(input, workDir, info)
  spinner.stop(`인코딩 완료 · 조각 ${encoded.segmentCount}개`)

  spinner.start('업로드')
  await removePrefix(`hls/${id}`)
  const uploaded = await putDirectory(workDir, `hls/${id}`, (progress) => {
    spinner.message(`업로드 ${progress.done}/${progress.total}`)
  })
  spinner.stop(`업로드 완료 · ${(uploaded.bytes / 1024 / 1024).toFixed(1)}MB`)

  const video = { key: id, duration: Math.round(info.durationSec), resolution }
  const path =
    kind === 'match'
      ? await writeMatch(id, { ...(entry as MatchEntry), video })
      : await writeTraining(id, { ...(entry as TrainingEntry), video })

  p.outro(`${path}\ngit push 하면 약 2분 뒤 사이트에 반영됩니다.`)
}

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
