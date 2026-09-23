// @ts-check
import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'

// GitHub Pages 가 저장소 이름을 경로에 붙이므로 base 를 지정한다.
// 이 값을 빠뜨리면 빌드는 통과하지만 배포 후 모든 링크와 자산 경로가 깨진다.
export default defineConfig({
  site: 'https://yes-eul-jeong.github.io',
  base: '/gallery',
  integrations: [vue()],

  vite: {
    server: {
      watch: {
        // .astro 는 Astro 가 만드는 상태 디렉터리다.
        // 기동할 때 settings.json 을 쓰는데, 볼륨 마운트 환경에서는 이 쓰기가
        // 설정 파일 변경으로 감지되어 서버가 재시작된다. 그 재시작 과정에서
        // content layer 의 Vite transport 가 끊겨 콘텐츠 동기화가 통째로 누락되고
        // 컬렉션이 빈 상태로 남는다.
        // chokidar 4 는 glob 을 지원하지 않으므로 정규식으로 지정한다.
        ignored: [/[\\/]\.astro[\\/]/],
      },
    },
  },
})
