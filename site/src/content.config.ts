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

/** 업로드된 영상 한 편 */
const video = z.object({
  /** R2 키 접두사. hls/{key}/index.m3u8 형태로 조합한다 */
  key: z.string(),
  /** 초 단위 길이 */
  duration: z.number().positive(),
  resolution: z.enum(['1080p', '720p']),
})

const matches = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/matches' }),
  schema: z.object({
    date: z.string(),
    /** 프로 전적과 아마추어 전적은 합산하지 않는다 */
    level: z.enum(['pro', 'amateur']),
    event: z.string(),
    /** 킥복싱은 단체마다 규칙이 달라 별도로 기록한다 */
    rule: z.enum(['k1', 'muaythai', 'oriental']),
    weightClass: z.string(),
    opponent: z.object({
      name: z.string(),
      gym: z.string().optional(),
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
    video: video.optional(),
    photos: z.array(z.string()).default([]),
  }),
})

const profile = defineCollection({
  loader: file('./src/content/profile.json'),
  schema: z.object({
    name: z.string(),
    nameEn: z.string(),
    birthYear: z.number(),
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
    /** 출전 가능 시기. 부상 회복은 본인만 알므로 직접 입력한다 */
    availableFrom: z.string().optional(),
    instagram: z.string(),
  }),
})

export const collections = { matches, training, profile }
