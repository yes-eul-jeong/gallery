# 작업 기록과 인계

최종 갱신: 2026-09-23

다른 환경에서 이어서 작업할 때 이 문서부터 읽는다.

## 1. 지금까지 한 일

### 완료

| 단계 | 내용 |
|---|---|
| 기획 | 파이트 레주메로 성격 확정. 페르소나, 화면 설계, 데이터 항목 (`product.md`) |
| 개발 설정 | Docker(node 22 + ffmpeg + curl), npm workspaces, R2 연결 검증 |
| 1단계 | 영상 인코딩 → HLS 분할 → R2 업로드 → Worker 서명 → 재생. 검증 12항목 통과 |
| 배포 | GitHub Actions → Pages. https://yes-eul-jeong.github.io/gallery/ 동작 확인 |

### 진행 중 (여기서 멈춤)

**Worker 배포**가 서브도메인 미등록으로 막혔다.

```
✘ You need to register a workers.dev subdomain before publishing
```

대시보드 주소는 `dash.cloudflare.com/<계정ID>/workers/onboarding` 이다.
계정 ID 는 `.env` 의 `R2_ACCOUNT_ID` 와 같은 값이다.

Workers 를 처음 쓰는 계정이라 서브도메인을 한 번 등록해야 한다. 계정 전체에 적용되고
이름은 전역에서 고유해야 하므로 사용자가 직접 정한다.

등록하면 Worker 주소가 `kickbox-media.<서브도메인>.workers.dev` 가 된다.

## 2. 다른 환경에서 이어받기

### 2.1 저장소

```bash
git clone https://github.com/yes-eul-jeong/gallery.git
cd gallery
```

### 2.2 환경 변수 (가장 중요)

`.env` 는 git 에 없다. 새 환경에서 직접 만들어야 한다.

```bash
cp .env.example .env
```

채울 값은 여섯 개다.

| 키 | 어디서 구하나 |
|---|---|
| `R2_ACCOUNT_ID` | 기존 `.env` 에서 복사. 또는 dash.cloudflare.com → R2 → Account ID |
| `R2_ACCESS_KEY_ID` | 기존 `.env` 에서 복사 |
| `R2_SECRET_ACCESS_KEY` | **기존 `.env` 에서 복사해야 한다.** 대시보드에서 다시 볼 수 없다. 잃었으면 R2 → Manage API Tokens 에서 재발급 |
| `R2_BUCKET` | `kickbox-media` |
| `CLOUDFLARE_API_TOKEN` | 기존 `.env` 에서 복사. 잃었으면 재발급 (권한은 아래 참고) |
| `MEDIA_SIGN_SECRET` | **기존 `.env` 에서 복사해야 한다.** 로컬에서 생성한 값이라 어디에도 백업이 없다 |
| `PUBLIC_MEDIA_BASE` | 로컬 개발은 `http://localhost:8787`. 배포 후에는 Worker 주소 |

값을 옮길 때는 대화창에 붙여넣지 말고 터미널에서 직접 넣는다.

```bash
echo 'R2_SECRET_ACCESS_KEY=값' >> .env
```

`MEDIA_SIGN_SECRET` 을 잃어버렸다면 새로 만들고 Worker 시크릿도 같은 값으로 갱신한다.
두 곳이 어긋나면 모든 재생이 403 이 된다.

```bash
openssl rand -hex 32
```

**CLOUDFLARE_API_TOKEN 재발급 시 권한**

dash.cloudflare.com/profile/api-tokens → Create Token → Custom token

- Account · Workers Scripts · Edit
- Account · Workers R2 Storage · Edit
- Account · Account Settings · Read

Account Resources 는 본인 계정으로 한정한다. Zone 권한은 필요 없다.

### 2.3 Worker 로컬 시크릿

```bash
echo "MEDIA_SIGN_SECRET=$(grep '^MEDIA_SIGN_SECRET=' .env | cut -d= -f2)" > worker/.dev.vars
chmod 600 worker/.dev.vars
```

### 2.4 컨테이너

```bash
docker compose -f docker/compose.yml build
docker compose -f docker/compose.yml run --rm app 'npm install'
```

### 2.5 동작 확인

```bash
docker compose -f docker/compose.yml run --rm app 'npm run build'
docker compose -f docker/compose.yml run --rm app 'npm run typecheck'
docker compose -f docker/compose.yml up dev        # http://localhost:4321/gallery/
```

## 3. 다음에 할 일

### 3.1 Worker 배포 (막혀 있는 지점)

1. 서브도메인 등록
   `dash.cloudflare.com/<R2_ACCOUNT_ID 값>/workers/onboarding` 에서 등록한다.
   로그인된 상태면 dash.cloudflare.com → Workers & Pages 로 들어가도 안내가 나온다.

2. 배포

```bash
docker compose -f docker/compose.yml run --rm app 'cd worker && npx wrangler deploy'
```

3. 서명 키를 Worker 시크릿으로 등록

```bash
docker compose -f docker/compose.yml run --rm app \
  'cd worker && grep "^MEDIA_SIGN_SECRET=" /app/.env | cut -d= -f2 | npx wrangler secret put MEDIA_SIGN_SECRET'
```

4. 배포된 주소로 검증

`scripts/verify-worker.sh` 의 `BASE` 를 실제 주소로 바꿔 실행하거나, curl 로 직접 확인한다.
확인할 것은 12개 항목이며 `development.md` 13절에 표로 정리되어 있다.

### 3.2 GitHub Secrets 등록

저장소 Settings → Secrets and variables → Actions → New repository secret

| 이름 | 값 |
|---|---|
| `PUBLIC_MEDIA_BASE` | `https://kickbox-media.<서브도메인>.workers.dev` |

이 값이 없으면 빌드는 통과하지만 사이트에 영상 재생기가 표시되지 않는다.
등록 후 아무 커밋이나 푸시하면 재배포된다.

### 3.3 실제 재생 확인

휴대폰에서 https://yes-eul-jeong.github.io/gallery/ 를 열어 확인한다.
이것이 1단계의 마지막 검증 기준이다.

- 끊김 없이 재생되는가
- 구간 이동이 되는가
- 개발자도구에서 조각 주소를 복사해 다른 탭에서 열면 403 이 나오는가

### 3.4 그 다음 (2단계)

`development.md` 13절의 2단계부터 이어간다. 첫 화면과 경기 목록을 실제 디자인으로 만든다.
그 전에 `product.md` 10절의 시안 비교를 한다.

## 4. 알아두면 좋은 것

### 4.1 Docker 볼륨 마운트와 Astro

`site/.astro/` 상태 디렉터리가 호스트 볼륨에 있어 두 가지 문제가 있었고 모두 대응해 두었다.

- `dev.json` 락 → `astro dev --force` 로 무시
- `settings.json` 쓰기가 서버 재시작을 유발 → watcher 에서 `.astro` 제외

자세한 내용은 `development.md` 4절.

### 4.2 인코딩 비트레이트 상한

원본보다 큰 결과물이 나오지 않도록 원본 비트레이트의 1.1배를 상한으로 둔다.
`pipeline/src/config.ts` 의 `resolveEncodeSettings`.

### 4.3 base 경로

`astro.config.mjs` 의 `base: '/gallery'` 를 지우면 배포 후 모든 링크가 깨진다.
개인 도메인을 붙일 때만 제거한다.

### 4.4 테스트 자산

- 테스트 영상: `media-source/` (git 제외). 새 환경에는 없으므로 아무 영상이나 넣으면 된다
- R2 에 `hls/test-video/` 로 샘플이 올라가 있다. 샘플 경기 JSON 이 이걸 참조한다
- 실제 데이터로 교체할 때 `site/src/content/matches/` 의 샘플 두 건을 지운다

### 4.5 검증 스크립트

```bash
# Worker 동작 12항목 (로컬 R2)
docker compose -f docker/compose.yml run --rm app 'bash scripts/verify-worker.sh'

# 재생 경로와 CORS (worker 서비스가 떠 있어야 함)
docker compose -f docker/compose.yml up -d worker
docker compose -f docker/compose.yml run --rm app 'bash scripts/verify-playback.sh'
```

## 5. 현재 파일 구조

```
docs/
  product.md        서비스 기획
  development.md    개발 가이드, 구현 순서, 사전 준비
  worklog.md        이 문서
site/               Astro 7 + Vue. 콘텐츠 스키마, 전적 집계, 재생기
pipeline/           ffprobe, 인코딩, 썸네일, R2 업로드, 대화형 CLI
worker/             서명 발급과 검증, Referer 검사, m3u8 재작성
scripts/            검증 스크립트
docker/             node 22 + ffmpeg + curl
```
