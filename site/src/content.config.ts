import { defineCollection, z } from 'astro:content'
import { glob, file } from 'astro/loaders'

/** 경기 결과 판정 방식 */
const method = z.enum([
  'ko',        // KO
  'tko',       // TKO
  'unanimous', // 판정 만장일치
  'majority',  // 판정 다수
  'split',     // 판정 스플릿
  'retire',    // 기권
])

/**
 * 경기 등급.
 * 셋을 합산하지 않는다. 격투기에서 등급이 다른 전적을 섞어 적는 것은 결례로 본다.
 */
const level = z.enum(['pro', 'semipro', 'amateur'])

/** 업로드된 영상 한 편 */
const video = z.object({
  /** R2 키 접두사. hls/{key}/index.m3u8 형태로 조합한다 */
  key: z.string(),
  /** 초 단위 길이 */
  duration: z.number().positive(),
  resolution: z.enum(['1080p', '720p']),
  /** 호버 미리보기용 짧은 클립. public/media 아래 파일명 */
  preview: z.string().optional(),
  /** 목록용 포스터. public/media 아래 파일명 */
  poster: z.string().optional(),
})

const matches = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/matches' }),
  schema: z.object({
    date: z.string(),
    level,
    event: z.string(),
    /** 킥복싱은 단체마다 규칙이 달라 별도로 기록한다 */
    rule: z.enum(['k1', 'muaythai', 'oriental']),
    weightClass: z.string(),
    opponent: z.object({
      name: z.string(),
      gym: z.string().optional(),
      country: z.string().optional(),
    }),
    rounds: z.string(),
    result: z.enum(['win', 'loss', 'draw', 'nc']),
    method,
    /** 결정 시점. 판정이면 비운다 */
    endTime: z.string().optional(),
    titleFight: z
      .object({
        name: z.string(),
        type: z.enum(['challenge', 'defense']),
      })
      .optional(),
    title: z.string(),
    description: z.string().optional(),
    video: video.optional(),
    photos: z.array(z.string()).default([]),
  }),
})

const training = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/training' }),
  schema: z.object({
    date: z.string(),
    type: z.enum(['sparring', 'mitt', 'bag', 'technique', 'conditioning']),
    title: z.string(),
    description: z.string().optional(),
    place: z.string().optional(),
    video: video.optional(),
    photos: z.array(z.string()).default([]),
  }),
})

/** 갤러리에 뿌리는 사진 목록 */
const photos = defineCollection({
  loader: file('./src/content/photos/index.json'),
  schema: z.object({
    /** public/media 아래 파일명 */
    file: z.string(),
    /** 분류. 갤러리 필터에 쓴다 */
    kind: z.enum(['match', 'weighin', 'award', 'training']),
    caption: z.string(),
    context: z.string(),
  }),
})

const profile = defineCollection({
  loader: file('./src/content/profile.json'),
  schema: z.object({
    name: z.string(),
    nameEn: z.string(),
    birthYear: z.number(),
    /** 체급은 성별과 함께 읽어야 뜻이 정해진다 */
    gender: z.enum(['female', 'male']),
    gym: z.string(),
    /** cm */
    height: z.number(),
    weightClass: z.string(),
    /** 단체와 기준 시점이 없으면 검증할 수 없다 */
    rankings: z
      .array(
        z.object({
          org: z.string(),
          division: z.string(),
          rank: z.number(),
          asOf: z.string(),
        }),
      )
      .default([]),
    titles: z
      .array(
        z.object({
          org: z.string(),
          division: z.string(),
          status: z.enum(['current', 'former']),
          since: z.string(),
        }),
      )
      .default([]),
    /**
     * 확정된 다음 경기. 있으면 첫 화면이 이걸 먼저 알린다.
     * 경기가 끝나면 지우고 경기 기록으로 옮긴다.
     */
    nextBout: z
      .object({
        date: z.string(),
        event: z.string(),
        weightClass: z.string().optional(),
        rounds: z.string().optional(),
      })
      .optional(),
    /** 확정 경기가 없을 때 언제부터 뛸 수 있는지 */
    availableFrom: z.string().optional(),
    availableNote: z.string().optional(),
    instagram: z.string(),
    email: z.string().optional(),
  }),
})

export const collections = { matches, training, photos, profile }
