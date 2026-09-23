import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { env } from './config.js'

let client: S3Client | undefined

function s3(): S3Client {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  })
  return client
}

/**
 * 확장자별 Content-Type.
 * HLS 재생목록과 조각은 타입이 틀리면 브라우저가 재생을 거부한다.
 */
const contentTypes: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

function contentTypeOf(path: string): string {
  return contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

export async function putFile(key: string, path: string): Promise<number> {
  const info = await stat(path)
  await s3().send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: createReadStream(path),
      ContentLength: info.size,
      ContentType: contentTypeOf(path),
    }),
  )
  return info.size
}

export interface UploadProgress {
  done: number
  total: number
  key: string
}

/** 디렉터리 전체를 지정한 접두사 아래로 올린다 */
export async function putDirectory(
  dir: string,
  prefix: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<{ count: number; bytes: number }> {
  const names = (await readdir(dir)).sort()
  let bytes = 0

  for (const [index, name] of names.entries()) {
    const key = `${prefix}/${name}`
    bytes += await putFile(key, join(dir, name))
    onProgress?.({ done: index + 1, total: names.length, key })
  }

  return { count: names.length, bytes }
}

/** 접두사 아래 객체를 모두 지운다. 재업로드 전 정리에 쓴다 */
export async function removePrefix(prefix: string): Promise<number> {
  let removed = 0
  let token: string | undefined

  do {
    const listed = await s3().send(
      new ListObjectsV2Command({ Bucket: env.bucket, Prefix: prefix, ContinuationToken: token }),
    )
    const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key)

    if (keys.length > 0) {
      await s3().send(
        new DeleteObjectsCommand({ Bucket: env.bucket, Delete: { Objects: keys } }),
      )
      removed += keys.length
    }
    token = listed.NextContinuationToken
  } while (token)

  return removed
}

export async function listPrefix(prefix: string): Promise<string[]> {
  const listed = await s3().send(
    new ListObjectsV2Command({ Bucket: env.bucket, Prefix: prefix }),
  )
  return (listed.Contents ?? []).map((o) => o.Key!).filter(Boolean)
}
