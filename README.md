# 킥복싱 선수 파이트 레주메

프로 킥복싱 선수가 프로모터에게 보내는 포트폴리오 사이트.

- 기획: [docs/product.md](docs/product.md)
- 개발: [docs/development.md](docs/development.md)

## 구성

| 디렉터리 | 내용 |
|---|---|
| `site/` | Astro + Vue 사이트 |
| `pipeline/` | 영상 인코딩과 R2 업로드 CLI |
| `worker/` | 미디어 전달 Cloudflare Worker |
| `docker/` | Node 22 + ffmpeg 실행 환경 |

## 개발

로컬에 Node 가 없다. 모든 명령은 컨테이너 안에서 실행한다.

```bash
# 개발 서버 (http://localhost:4321/gallery/)
docker compose -f docker/compose.yml up dev

# 일회성 명령
docker compose -f docker/compose.yml run --rm app 'npm run build'
docker compose -f docker/compose.yml run --rm app 'npm run typecheck'
```

## 환경 변수

`.env.example` 을 복사해 `.env` 를 만들고 Cloudflare R2 값을 채운다.
