# 작업 기록과 인계

최종 갱신: 2026-09-28 (Worker 배포 완료)

다른 환경에서 이어서 작업할 때 이 문서부터 읽는다.

## 1. 지금까지 한 일

### 완료

| 단계 | 내용 |
|---|---|
| 기획 | 파이트 레주메로 성격 확정. 페르소나, 화면 설계, 데이터 항목 (`product.md`) |
| 개발 설정 | Docker(node 22 + ffmpeg + curl), npm workspaces, R2 연결 검증 |
| 1단계 | 영상 인코딩 → HLS 분할 → R2 업로드 → Worker 서명 → 재생. 로컬 검증 12항목 통과 |
| 사이트 배포 | GitHub Actions → Pages. https://yes-eul-jeong.github.io/gallery/ 동작 확인 |
| Worker 배포 | workers.dev 서브도메인을 `sree-cloud` 로 바꾼 뒤 배포. 배포본 검증 13항목 통과 |

### workers.dev 서브도메인

`mpjeong0325` 는 이메일 로컬 파트와 같아 주소를 본 사람이 이메일을 추측할 수 있었다.
영상 재생 시 개발자도구와 사이트 HTML 에 노출되는 값이라 `sree-cloud` 로 바꿨다.

```
https://kickbox-media.sree-cloud.workers.dev
```

변경은 대시보드에서만 된다. API 의 PUT 은 이미 존재하는 서브도메인을 덮어쓰지 못한다
(`10036 Account already has an associated subdomain`). 실제로 시도해 같은 오류를 확인했다.

위치는 dash.cloudflare.com → 왼쪽 **Compute → Workers & Pages** → 우측 패널
**Account details** 카드 안의 `Subdomain` 항목이다. 값 오른쪽 연필 아이콘이 변경 버튼이다.
Settings 탭에는 없다.

서브도메인은 계정에 하나뿐이고, 최종 주소는 `<워커이름>.<서브도메인>.workers.dev` 가 된다.
나중에 또 바꾸면 기존 workers.dev 주소가 전부 죽으므로 `.env` 와 GitHub Secrets 두 군데를
같이 고쳐야 한다. 개인 도메인을 붙이면 이 주소는 아예 노출되지 않는다.

### 배포본 검증 결과 (2026-09-28)

`scripts/verify-worker.sh` 는 로컬 `wrangler dev` 전용이다. 로컬 R2 에 파일을 적재하고
서버를 직접 띄우기 때문에 배포본에는 그대로 쓸 수 없다. 배포본은 curl 로 따로 확인했다.

| 항목 | 결과 |
|---|---|
| `/health` | `{"ok":true,"bucket":true}` |
| Referer 없이 서명 요청 | 403 |
| 다른 사이트 Referer | 403 |
| 정상 서명 요청 | 200, 30분 만료 토큰 |
| 서명된 재생목록 | 200, 조각 주소에 토큰 주입 확인 |
| 토큰 없이 조각 접근 | 403 |
| 위조 토큰 | 403 |
| 만료 토큰 | 403 |
| 정상 조각 | 200, 2.5MB |
| Range 요청 | 206, 요청한 1024바이트 |
| `init.mp4` | 200 |
| 썸네일 640 / 1280 | 200 |
| 썸네일 Referer 없이 | 403 |
| CORS | `access-control-allow-origin: https://yes-eul-jeong.github.io` |

썸네일 경로는 `/thumb/<id>/<파일명>` 이다. `/thumb/test-video/thumb-640.webp` 처럼
파일명을 그대로 넣는다. 크기 숫자만 넣으면 404 가 난다.

배포 중 wrangler 가 R2 바인딩 존재 여부를 확인할 권한이 없다는 경고를 낸다.
토큰에 R2 조회 권한이 없어서 그런 것이고, 실제 요청이 객체를 200 으로 반환하므로 바인딩은 정상이다.
같은 이유로 `wrangler r2 object get --remote` 도 403 이 난다. R2 를 CLI 로 직접 다뤄야 하면
S3 자격증명(`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`)으로 aws-cli 를 쓴다.

### 진행 중

GitHub Secrets 에 `PUBLIC_MEDIA_BASE` 를 등록했다. 재배포한 뒤 휴대폰에서 실제 재생을
확인하면 1단계가 끝난다.

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

채울 값은 일곱 개다.

| 키 | 어디서 구하나 |
|---|---|
| `R2_ACCOUNT_ID` | 기존 `.env` 에서 복사. 또는 dash.cloudflare.com → R2 → Account ID |
| `R2_ACCESS_KEY_ID` | 기존 `.env` 에서 복사 |
| `R2_SECRET_ACCESS_KEY` | **기존 `.env` 에서 복사해야 한다.** 대시보드에서 다시 볼 수 없다. 잃었으면 R2 → Manage API Tokens 에서 재발급 |
| `R2_BUCKET` | `kickbox-media` |
| `CLOUDFLARE_API_TOKEN` | 기존 `.env` 에서 복사. 잃었으면 재발급 (권한은 아래 참고) |
| `MEDIA_SIGN_SECRET` | **기존 `.env` 에서 복사해야 한다.** 로컬에서 생성한 값이라 어디에도 백업이 없다 |
| `PUBLIC_MEDIA_BASE` | 로컬 `wrangler dev` 를 쓸 때는 `http://localhost:8787`. 배포본을 볼 때는 `https://kickbox-media.sree-cloud.workers.dev` |

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

### 3.1 재배포와 실재생 확인 (1단계 마지막)

GitHub Secret 은 등록만으로 반영되지 않는다. 다시 빌드해야 값이 HTML 에 들어간다.
커밋을 푸시하거나, 저장소 Actions 탭에서 `사이트 배포` 워크플로를 `Run workflow` 로 직접 돌린다.

재배포 후 휴대폰에서 https://yes-eul-jeong.github.io/gallery/ 를 연다.

- 끊김 없이 재생되는가
- 구간 이동이 되는가
- 개발자도구에서 조각 주소를 복사해 다른 탭에서 열면 403 이 나오는가

페이지에 "PUBLIC_MEDIA_BASE 가 설정되지 않아 영상을 재생할 수 없습니다" 가 그대로 보이면
시크릿이 빌드에 전달되지 않은 것이다. Environment secret 이 아니라 Repository secret 인지 확인한다.
값을 쓰는 `build` job 에는 `environment:` 지정이 없어 Environment secret 은 읽히지 않는다.

### 3.2 2단계

`development.md` 13절의 2단계부터 이어간다.

현재 `site/src/pages/index.astro` 는 스타일 없는 뼈대다. CSS 가 한 줄도 없고 경기 목록이
`<ul>` 나열이며, 최근 5경기 접기와 하단 고정 연락처 버튼이 없다. 컴포넌트는 `VideoPlayer.vue`
하나뿐이고 `RecordHeader`, `MediaCard`, `FilterBar`, `Lightbox` 는 아직 없다.
`lib/media.ts` 와 `i18n/ko.ts` 도 없다. 페이지도 `index.astro` 하나뿐이다.

전적 집계(`lib/record.ts`)와 콘텐츠 스키마는 동작한다.

화면을 쓰기 전에 두 가지를 먼저 한다.

1. 실제 프로필 값과 경기 기록 확정. 지금은 샘플 두 건이다
2. `product.md` 10절의 첫 화면 시안 비교. 전적 표기 방식, 랭킹 위치, 인스타 버튼 형태,
   벨트 자리, 승패 색은 글로 정해지지 않는다

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
