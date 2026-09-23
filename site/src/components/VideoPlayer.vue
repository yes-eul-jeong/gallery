<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type Hls from 'hls.js'

const props = defineProps<{
  /** Worker 도메인 */
  mediaBase: string
  /** R2 의 영상 식별자 */
  videoId: string
  /** 포스터 이미지 경로 */
  poster?: string
}>()

const video = ref<HTMLVideoElement>()
const hls = shallowRef<Hls>()
const error = ref<string>()
const loading = ref(true)

/**
 * 재생 직전에 토큰을 받아온다.
 * 페이지에 고정 주소를 심어두지 않으므로 HTML 을 저장해도 영상 주소가 남지 않는다.
 */
async function resolvePlaylist(): Promise<string> {
  const response = await fetch(`${props.mediaBase}/sign/${props.videoId}`)
  if (!response.ok) throw new Error(`서명 실패 (${response.status})`)
  const data = (await response.json()) as { playlist: string }
  return data.playlist
}

async function setup() {
  const element = video.value
  if (!element) return

  try {
    const playlist = await resolvePlaylist()

    // 사파리와 iOS 는 HLS 를 기본 지원한다. 그쪽은 라이브러리를 쓰지 않는다
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = playlist
      loading.value = false
      return
    }

    const { default: Hls } = await import('hls.js')
    if (!Hls.isSupported()) {
      throw new Error('이 브라우저는 HLS 재생을 지원하지 않습니다')
    }

    const instance = new Hls({ enableWorker: true })
    hls.value = instance
    instance.loadSource(playlist)
    instance.attachMedia(element)
    instance.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) error.value = `재생 오류: ${data.details}`
    })
    loading.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : '재생을 시작할 수 없습니다'
    loading.value = false
  }
}

onMounted(setup)
onBeforeUnmount(() => hls.value?.destroy())
</script>

<template>
  <figure class="player">
    <video ref="video" controls playsinline :poster="poster" preload="none" />
    <figcaption v-if="loading">불러오는 중</figcaption>
    <figcaption v-else-if="error" class="error">{{ error }}</figcaption>
  </figure>
</template>

<style scoped>
.player {
  margin: 0;
}
video {
  width: 100%;
  max-width: 960px;
  background: #000;
  display: block;
}
figcaption {
  font-size: 0.875rem;
  padding: 0.5rem 0;
}
.error {
  color: #c0392b;
}
</style>
