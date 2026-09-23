# 작업 기록과 인계

최종 갱신: 2026-09-23 (Worker 배포 직전)

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

**Worker 배포 직전까지 왔다.** workers.dev 서브도메인은 해결됐다.

처음에는 서브도메인이 없어 배포가 거부됐는데, 대시보드에서 Compute 메뉴를 여는 것만으로
자동 생성됐다. 현재 값은 다음과 같다.

```
mpjeong0325
```

따라서 배포하면 Worker 주소는 이렇게 된다.

```
kickbox-media.mpjeong0325.workers.dev
```

**결정하지 않은 것**: 이 이름을 쓸지 바꿀지.

`mpjeong0325` 는 이메일 로컬 파트와 같아서, 주소를 본 사람이 `mpjeong0325@gmail.com` 을
추측할 수 있다. 영상 재생 시 개발자도구에 노출되고 사이트 HTML 에도 들어간다.
스팸 수집 대상이 되는 것이 신경 쓰이면 바꾸는 편이 낫다.

바꾸려면 대시보드에서 해야 한다. API 로는 이미 존재하는 서브도메인을 덮어쓸 수 없다
(`10036 Account already has an associated subdomain`).

- dash.cloudflare.com → 왼쪽 **Build → Compute** → Workers
- 그 화면 어딘가에 Subdomain 항목과 변경 링크가 있다
- UI 가 자주 바뀌므로 못 찾으면 상단 Quick search 에 `subdomain` 을 입력해 본다

**찾지 못하면 그냥 진행해도 된다.** 나중에 바꿔도 되고, 그때 고칠 곳은 두 군데뿐이다
(`.env` 의 `PUBLIC_MEDIA_BASE`, GitHub Secrets 의 `PUBLIC_MEDIA_BASE`).
개인 도메인을 붙이면 workers.dev 주소는 아예 노출되지 않는다.

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

### 3.1 Worker 배포

서브도메인 문제는 해결됐으므로 아래 명령을 순서대로 실행하면 된다.

**1) 배포**

```bash
docker compose -f docker/compose.yml run --rm app 'cd worker && npx wrangler deploy'
```

성공하면 주소가 출력된다. `kickbox-media.mpjeong0325.workers.dev` 형태다.

**2) 서명 키를 Worker 시크릿으로 등록**

`.env` 의 `MEDIA_SIGN_SECRET` 과 반드시 같은 값이어야 한다. 어긋나면 모든 재생이 403 이 된다.

```bash
docker compose -f docker/compose.yml run --rm app \
  'grep "^MEDIA_SIGN_SECRET=" /app/.env | cut -d= -f2 | (cd worker && npx wrangler secret put MEDIA_SIGN_SECRET)'
```

**3) 등록 확인**

```bash
docker compose -f docker/compose.yml run --rm app 'cd worker && npx wrangler secret list'
```

**4) 배포된 Worker 검증**

```bash
WORKER=https://kickbox-media.mpjeong0325.workers.dev
SITE=https://yes-eul-jeong.github.io

# 헬스체크
curl -s $WORKER/health

# Referer 없이 서명 요청 → 403 이어야 한다
curl -s -o /dev/null -w "%{http_code}\n" $WORKER/sign/test-video

# 정상 서명 요청 → playlist URL 이 나와야 한다
curl -s -H "Referer: $SITE/" $WORKER/sign/test-video

# 토큰 없이 조각 접근 → 403 이어야 한다
curl -s -o /dev/null -w "%{http_code}\n" -H "Referer: $SITE/" \
  $WORKER/hls/test-video/seg0000.m4s
```

R2 에 `hls/test-video/` 샘플이 올라가 있으므로 그대로 확인할 수 있다.
전체 12개 항목은 `scripts/verify-worker.sh` 의 BASE 를 위 주소로 바꿔 실행한다.

**5) 로컬 .env 갱신**

```bash
# PUBLIC_MEDIA_BASE 를 배포 주소로 바꾼다
```

### 3.2 GitHub Secrets 등록

저장소 Settings → Secrets and variables → Actions → New repository secret

| 이름 | 값 |
|---|---|
| `PUBLIC_MEDIA_BASE` | `https://kickbox-media.mpjeong0325.workers.dev` |

서브도메인을 바꿨다면 그 값으로 넣는다.

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
