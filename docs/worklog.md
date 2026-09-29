# 작업 기록과 인계

최종 갱신: 2026-09-29 (2차 배포 · 디자인과 링크 미리보기 반영)

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
| 2단계 디자인 | 시안 확정 후 Astro 로 이관. 색·타이포·컴포넌트·SCSS 토큰 |
| 링크 미리보기 | Open Graph 태그와 1200×630 이미지 |

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

### 디자인 결정 (2026-09-29)

레퍼런스 세 곳을 뜯어보고 정했다.

| 사이트 | 가져온 것 |
|---|---|
| ONE Championship (Janet Todd) | 화면 구성. 이름 → 전적 → 다음 경기 → 경기 목록 → Breakdown |
| waverunmedia.com | 영상 카드. 글자가 카드 밖에 있다가 호버하면 영상이 커지며 덮는다 |
| nickho-motorsports.nl | 투명도 단계 토큰, 배경 영상, Anton 같은 압축 헤드라인 |

**색**

```
배경   #0A0A0A
텍스트 #FFFFFF
보조   #8E8E96   6.1:1
흐림   .55 투명도 · 패배 행
액센트 #00FF85   14.7:1
```

액센트는 선수 가운과 털에서 뽑았다. 사진 속 초록이 색상각 150° 근처였고
후보 셋 중 `#00FF85`(151°)가 일치했다. 선수 고유색이 그대로 사이트 색이다.

지켜야 할 규칙 둘.

1. 초록 위 글자는 반드시 검정이다. 흰색은 1.4:1 로 읽히지 않는다
2. 패배 행 투명도는 `.55` 아래로 내리지 않는다. 본문 대비 4.5:1 에 미달한다

**폰트**: 한글 Pretendard, 영문과 숫자 Satoshi.

**연출 범위**: 히어로에만 둔다. 그 아래는 훑는 영역이라 스크롤할 때마다
요소가 떠오르면 읽는 속도만 느려진다. 관성 스크롤(Lenis)은 넣었다가 뺐다.

**승패 표기**: 색으로 가르지 않는다. 초록은 액센트 전용이고 승패는
글자(`W`/`L`)와 명암으로 구분한다.

### 진행 중

비공개로 배포돼 있다. 데이터가 샘플이라 검색 색인만 막았다.

```
https://yes-eul-jeong.github.io/gallery/
```

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

순서가 정해져 있다. 위에서부터 한다.

### 3.1 업로드 CLI 를 스키마에 맞춘다 (선결)

**영상을 하나도 올릴 수 없는 상태다.** 사이트 스키마는 바뀌었는데
파이프라인이 옛 스키마를 그대로 쓴다.

```
pipeline/src/content.ts:13   level: 'pro' | 'amateur'
pipeline/src/cli.ts:79       { value: 'amateur', label: '아마추어' }
```

고칠 것.

- `level` 에 `semipro` 추가. 선택지와 타입 양쪽
- `video` 에 `preview`(호버용 짧은 클립), `poster`(목록 썸네일) 필드 추가
- 인코딩할 때 2.5초 무음 클립과 포스터를 같이 뽑아 `site/public/media/` 에 넣기
- 사진 일괄 등록. `site/src/content/photos/index.json` 에 붙이는 방식

클립과 포스터를 만드는 ffmpeg 명령은 이미 검증했다.

```bash
# 2.5초 무음 미리보기
ffmpeg -ss <시작> -t 2.5 -i <원본> -vf "scale=640:-2,fps=24" -an \
  -c:v libx264 -crf 30 -preset veryfast -movflags +faststart -pix_fmt yuv420p out.mp4

# 포스터
ffmpeg -ss <시작> -i <원본> -vframes 1 -vf "scale=640:-2" -q:v 5 out.jpg
```

### 3.2 실제 영상 업로드

편집과 가공은 직접 한다. 원본이 준비되면 아래 한 줄로 끝난다.

```bash
docker compose -f docker/compose.yml run --rm app 'npm run add /media/<파일>'
```

지금은 모든 경기와 훈련이 R2 의 `test-video` 를 가리킨다.
호버 미리보기 클립 5개도 테스트 영상에서 잘라낸 것이다.

### 3.3 실제 데이터 교체

| 항목 | 지금 | 필요 |
|---|---|---|
| 경기 5건 | `상대 선수`, `대회명` | 날짜 · 대회명 · 상대 · 소속 · 결과 · 결정 방식 |
| 프로 전적 | 2-0 (경기 2건) | 프로 3전이므로 1건 추가 |
| 이메일 | 비어 있음 | `profile.json` 의 `email` |
| 사진 14장 | 실제 2장, 나머지는 테스트 영상 프레임 | 실제 경기 사진 |
| `og-default.jpg` | 입장 사진에서 자른 임시본 | 직접 고른 1200×630 |

전적은 경기 JSON 을 세어 만든다. 따로 적는 숫자가 없으므로
경기를 넣으면 첫 화면 숫자가 따라 바뀐다.

### 3.4 공개 전환

지금은 `noindex` 만 걸려 있다. 공개할 때 지울 곳은 한 군데다.

```
site/src/layouts/Base.astro   <meta name="robots" content="noindex, nofollow" />
```

`robots.txt` 는 이미 열려 있다. 막으면 안 되는 이유는 4.6 에 적었다.

### 3.5 남은 화면

`development.md` 13절 4단계에 있다. 급하지 않다.

- 대회별 보기 (`event/[slug]`)
- 사진 일괄 등록 화면
- 인코딩 결과 로컬 캐시

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

### 4.6 robots.txt 를 막으면 안 되는 이유

`Disallow: /` 는 접근 제어가 아니다. 크롤러에게 하는 부탁이고,
주소를 아는 사람은 그대로 연다.

막으면 두 가지가 같이 죽는다.

1. 크롤러가 페이지를 못 읽으니 `noindex` 도 못 본다. 외부 링크만 보고
   주소가 색인되는 경우가 생긴다
2. 카카오톡 · 슬랙의 링크 미리보기가 안 뜬다. Open Graph 를 읽을 수 없다

검색 노출 차단이 목적이면 `noindex` 만 쓴다.

**모르는 사람의 접근 차단은 GitHub Pages 로 불가능하다.** 완전 공개 호스팅이다.
정말 막으려면 Worker 앞에 비밀번호를 걸거나 Cloudflare Access 를 붙여야 한다.

### 4.7 출전 가능 시기를 날짜로 박지 않는다

`profile.json` 의 `availableFrom` 을 비워두면 첫 화면이 날짜 대신
`출전 문의` 카드로 바뀐다. 날짜를 적으면 지날 때마다 고쳐야 하고,
지난 날짜가 남아 있으면 관리를 안 하는 선수로 읽힌다.

확정된 경기가 잡히면 `nextBout` 을 채운다. 그때만 날짜가 크게 뜬다.

### 4.8 브라우저 기본 마진

`figure` 는 좌우 40px, 위아래 1em 을 기본으로 갖는다. `p` 는 위아래 1em 이다.
`margin-bottom` 만 지정하면 나머지가 그대로 남는다. 갤러리에서 사진이
390px 가 아니라 87px 로 나온 원인이었다. `margin` 을 통째로 지정한다.

## 5. 현재 파일 구조

```
docs/
  product.md        서비스 기획
  development.md    개발 가이드, 구현 순서, 사전 준비
  worklog.md        이 문서
site/
  public/media/     사진 · 호버용 클립 · 포스터 · OG 이미지
  src/
    styles/         SCSS. 토큰 · 믹스인 · 컴포넌트 10개
    components/     화면 조각 12개
    layouts/        Base.astro — 메타 태그와 껍데기
    pages/          index · videos · gallery · match/[slug] · training/[slug]
    content/        경기 · 훈련 · 사진 · 프로필 JSON
    lib/            record.ts(전적 집계) · media.ts(주소 생성)
    i18n/ko.ts      화면 문자열
    scripts/app.js  호버 미리보기 · 부채 · 슬라이더 · 필터 · 라이트박스
pipeline/           ffprobe, 인코딩, 썸네일, R2 업로드, 대화형 CLI
worker/             서명 발급과 검증, Referer 검사, m3u8 재작성
scripts/            검증 스크립트
docker/             node 22 + ffmpeg + curl
```

## 6. 미디어를 어디에 두는가

| | 위치 | 이유 |
|---|---|---|
| 풀 경기 영상 | R2 + Worker | 보호 대상. 서명 토큰과 Referer 검사를 거친다 |
| 호버용 2.5초 클립 | GitHub Pages | 저화질 조각이라 보호할 것이 없다. 첫 화면에서 서명을 다섯 번 받으면 느려진다 |
| 사진 · OG 이미지 | GitHub Pages | 히어로와 링크 미리보기에 즉시 떠야 한다 |
