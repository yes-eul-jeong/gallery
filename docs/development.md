# 개발 가이드

작성일: 2026-09-22

## 1. 기술 선택과 근거

| 영역 | 선택 | 근거 |
|---|---|---|
| 사이트 | Astro + Vue | 빌드 시 HTML 생성. 링크 미리보기와 검색 노출이 동작하고, GitHub Pages에서 하위 경로 직접 접속이 깨지지 않는다. 상태가 필요한 부분만 Vue 컴포넌트로 처리한다 |
| 언어 | TypeScript | 사이트, 업로드 CLI, Worker 전체에 적용 |
| 호스팅 | GitHub Pages | 무료. 저장소 push로 자동 배포 |
| 미디어 저장 | Cloudflare R2 | 10GB 무료. 전송량 요금이 없다 |
| 미디어 전달 | Cloudflare Workers | 서명 토큰 검증과 Referer 검사 |
| 인코딩 | Docker + ffmpeg | 업로드 시점에 한 번만 실행. 로컬에서 처리 |

### SPA를 쓰지 않는 이유

React나 Vue를 기본 SPA 방식으로 빌드하면 내용이 빈 `index.html` 하나가 나온다. 세 가지가 걸린다.

- 링크 미리보기 크롤러는 JS를 실행하지 않으므로 썸네일과 제목이 표시되지 않는다
- GitHub Pages는 `/match/max-fc-30` 같은 경로에 파일이 없으면 404를 반환한다. 서버 설정으로 우회할 수 없다
- 검색엔진이 내용을 제대로 읽지 못한다

### Cloudflare Stream을 쓰지 않는 이유

영상 전용 서비스로 기능은 충분하나 최소 월 5달러가 고정으로 나간다. R2 + Worker 조합으로 같은 결과를
무료 한도 안에서 얻을 수 있다.

### Git LFS를 쓰지 않는 이유

GitHub Pages는 LFS 파일을 서빙하지 않는다. 실제 파일 대신 포인터 텍스트가 전달된다.

## 2. 전체 구조

```
내 노트북 (Docker)                 GitHub                 Cloudflare
┌─────────────────────┐      ┌────────────────┐     ┌──────────────────┐
│ npm run add         │      │ Astro 소스     │     │ R2 버킷          │
│  1. ffprobe 분석    │      │ 콘텐츠 JSON    │     │  hls/{id}/*.m4s  │
│  2. ffmpeg 인코딩   │ push │       ↓        │     │  thumb/{id}.webp │
│  3. HLS 분할        │─────>│ GitHub Actions │     │  photo/{id}.webp │
│  4. 썸네일 추출     │      │       ↓        │     │       ↑          │
│  5. R2 업로드 ──────┼──────┼────────────────┼─────┘       │          │
│  6. JSON 생성       │      │ GitHub Pages   │     ┌──────────────────┐
│                     │      │  정적 사이트   │────>│ Worker           │
│ 원본 파일 로컬 보관 │      └────────────────┘     │  토큰 검증       │
└─────────────────────┘                            │  Referer 검사    │
                                                   │  m3u8 재작성     │
                                                   └──────────────────┘
```

원본 영상은 R2에 올리지 않는다. 노트북과 외장 저장장치에 보관한다. 압축본에서 원본을 복원할 수 없으므로
원본 보관은 별도 책임으로 둔다.

## 3. 저장소 구조

```
.
├── CLAUDE.md
├── docs/
│   ├── product.md
│   └── development.md
├── docker/
│   ├── Dockerfile              # node:22 + ffmpeg
│   └── compose.yml
├── site/                       # Astro 사이트
│   ├── astro.config.mjs
│   ├── src/
│   │   ├── content/
│   │   │   ├── config.ts       # zod 스키마 정의
│   │   │   ├── matches/        # 경기 JSON
│   │   │   ├── training/       # 훈련 JSON
│   │   │   ├── photos/         # 사진 JSON
│   │   │   └── profile.json
│   │   ├── components/
│   │   │   ├── MediaCard.astro
│   │   │   ├── RecordHeader.astro
│   │   │   ├── FilterBar.vue
│   │   │   ├── Lightbox.vue
│   │   │   └── VideoPlayer.vue
│   │   ├── layouts/Base.astro
│   │   ├── lib/
│   │   │   ├── record.ts       # 전적 집계
│   │   │   └── media.ts        # 미디어 URL 생성
│   │   └── pages/
│   │       ├── index.astro
│   │       ├── match/[slug].astro
│   │       ├── training/[slug].astro
│   │       └── event/[slug].astro
│   └── package.json
├── pipeline/                   # 업로드 CLI
│   ├── src/
│   │   ├── cli.ts              # 대화형 입력
│   │   ├── probe.ts            # ffprobe 분석
│   │   ├── encode.ts           # ffmpeg 인코딩 + HLS
│   │   ├── thumbnail.ts
│   │   ├── photo.ts            # 사진 변환
│   │   ├── upload.ts           # R2 업로드
│   │   └── content.ts          # JSON 생성
│   └── package.json
├── worker/
│   ├── src/index.ts
│   ├── wrangler.toml
│   └── package.json
├── .github/workflows/deploy.yml
├── .env.example
└── package.json                # npm workspaces
```

## 4. Docker 구성

`docker/Dockerfile`

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
```

`docker/compose.yml` 은 서비스 두 개를 둔다.

| 서비스 | 용도 | 포트 |
|---|---|---|
| `dev` | Astro 개발 서버 | 4321 |
| `app` | 업로드 CLI, 빌드, 린트 실행 | - |

원본 영상을 두는 디렉터리를 볼륨으로 마운트한다. 컨테이너 안에서 파일 경로를 그대로 쓸 수 있게 한다.

## 5. 콘텐츠 스키마

Astro Content Collections 에 zod 스키마를 정의한다. 값이 스키마에 어긋나면 빌드가 실패하므로
잘못된 데이터가 사이트에 올라가지 않는다.

```ts
// site/src/content/config.ts
const matches = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.string(),
    date: z.string().date(),
    level: z.enum(['pro', 'amateur']),
    event: z.string(),
    rule: z.enum(['k1', 'muaythai', 'oriental']),
    weightClass: z.string(),
    opponent: z.object({
      name: z.string(),
      gym: z.string().optional(),
    }),
    rounds: z.string(),
    result: z.enum(['win', 'loss', 'draw', 'nc']),
    method: z.enum(['ko', 'tko', 'unanimous', 'majority', 'split', 'retire']),
    endTime: z.string().optional(),
    titleFight: z.object({
      name: z.string(),
      type: z.enum(['challenge', 'defense']),
    }).optional(),
    title: z.string(),
    description: z.string().optional(),
    video: z.object({
      key: z.string(),
      duration: z.number(),
      resolution: z.enum(['1080p', '720p']),
    }).optional(),
    photos: z.array(z.string()).default([]),
  }),
})
```

프로필은 단일 JSON으로 둔다.

```ts
const profile = z.object({
  name: z.string(),
  nameEn: z.string(),
  birthYear: z.number(),
  gym: z.string(),
  height: z.number(),
  weightClass: z.string(),
  rankings: z.array(z.object({
    org: z.string(),        // 대한킥복싱협회
    division: z.string(),   // -63kg
    rank: z.number(),
    asOf: z.string(),       // 2025-12
  })).default([]),
  titles: z.array(z.object({
    org: z.string(),
    division: z.string(),
    status: z.enum(['current', 'former']),
    since: z.string(),
  })).default([]),
  availableFrom: z.string().optional(),
  instagram: z.string(),
})
```

랭킹에 단체명과 기준 날짜를 함께 받는 이유는, 순위만 적으면 어느 기준인지 검증할 수 없기 때문이다.
타이틀은 보유 예정이 있으므로 구조를 미리 넣어둔다.

훈련과 사진 컬렉션도 같은 방식으로 정의한다.

### 문자열 관리

다국어는 나중에 도입한다. 지금은 `site/src/i18n/ko.ts` 한 곳에 화면 문자열을 모아두고 컴포넌트에서
불러 쓰는 수준까지만 대비한다. 나중에 Astro i18n 라우팅을 붙일 때 문자열을 찾아다니지 않아도 된다.
번역 라이브러리는 지금 넣지 않는다.


## 6. 인코딩 규격

영상 길이로 해상도를 자동 결정한다. 짧은 경기 영상은 포트폴리오의 핵심이므로 화질을 우선하고,
장시간 기록물은 용량을 우선한다.

| 길이 | 해상도 | 비디오 | 예상 용량 (10분 기준) |
|---|---|---|---|
| 15분 이하 | 1080p | H.264, CRF 22, 최대 6Mbps | 약 380MB |
| 15분 초과 | 720p | H.264, CRF 24, 최대 3Mbps | 약 190MB |

오디오는 AAC 128kbps 로 통일한다.

HLS 분할 기준.

```
-hls_time 6
-hls_playlist_type vod
-hls_segment_type fmp4
-hls_flags independent_segments
```

6초 단위로 자르면 조각 하나가 2~4MB가 된다. 파일 크기 제한을 신경 쓸 필요가 없어지고,
재생 시작이 빨라지며, 통째로 내려받으려면 조각 전부를 모아 합쳐야 한다.

썸네일은 영상 10% 지점 프레임을 뽑아 WebP로 저장한다. 그리드용 640px, 상세용 1280px 두 종류를 만든다.
지정 시점을 지정할 수 있게 옵션을 둔다. KO 장면을 썸네일로 쓰고 싶은 경우가 생긴다.

사진은 원본을 WebP로 변환한다. 최대 변 2560px, 썸네일 640px.

워터마크는 ffmpeg 필터로 우측 하단에 넣는다. 켜고 끌 수 있게 설정으로 둔다.

## 7. 업로드 CLI

```
$ npm run add ./100m결승.mov

  날짜는? (파일에서 2025-05-12 확인, 엔터=사용) →
  경기인가요 훈련인가요? (1=경기 2=훈련) → 1
  프로 경기인가요? (y/n) → y
  대회명은? (↑↓ 이전 목록) → MAX FC 30
  룰은? (1=K-1 2=무에타이 3=오리엔탈) → 1
  체급은? (이전: -63kg) → -63kg
  상대 선수는? → 홍길동
  상대 소속은? → ○○짐
  라운드는? (이전: 3R 3분) → 3R 3분
  결과는? (1=승 2=패 3=무 4=무효) → 1
  결정 방식은? (1=KO 2=TKO 3=만장일치 4=다수 5=스플릿 6=기권) → 1
  결정 시점은? → 2R 1:34
  제목은? → MAX FC 30 메인이벤트
  설명은? →

  분석: 14분 32초, 1920x1080 → 1080p 적용
  인코딩 ████████████████ 100%  (4분 12초)
  HLS 분할 완료 (146 조각)
  썸네일 추출 완료
  R2 업로드 ██████████████ 100%
  content/matches/2025-05-12-max-fc-30.json 생성

  git push 하면 약 2분 뒤 사이트에 반영됩니다.
```

동작 원칙.

- 이전에 입력한 대회명, 체급, 라운드 형식을 기억해 방향키로 고를 수 있게 한다. 같은 대회를 다르게 적어
  묶음이 갈라지는 사고를 막는다
- 사진 여러 장을 한 번에 넣을 때는 공통 정보를 한 번만 묻고 전부 적용한다
- 인코딩 결과는 로컬 캐시에 두고, 업로드 실패 시 인코딩부터 다시 하지 않는다
- 파일명은 날짜와 대회명에서 생성한다. 한글은 로마자로 변환한다

## 8. 미디어 전달과 보호

Worker가 R2 앞에 서서 모든 미디어 요청을 받는다.

### 재생 흐름

```
1. 브라우저 → Worker  GET /sign?id=2025-05-12-max-fc-30
2. Worker → 브라우저  { url: "/hls/{id}/index.m3u8?t=<서명>&e=<만료>" }
3. 브라우저 → Worker  GET /hls/{id}/index.m3u8?t=...&e=...
4. Worker              토큰 검증 + Referer 검사
                       R2에서 m3u8 읽음
                       내부 조각 주소에 토큰을 주입해 다시 씀
5. 브라우저 → Worker  GET /hls/{id}/seg001.m4s?t=...&e=...
6. Worker              검증 후 R2 객체를 그대로 전달 (Range 지원)
```

- 토큰은 HMAC-SHA256. 만료는 발급 후 30분. 영상 하나를 다 볼 시간을 준다
- Referer 헤더가 사이트 도메인이 아니면 403. 다른 사이트에 삽입해도 재생되지 않는다
- 조각 주소가 매번 달라지므로 고정 다운로드 링크가 존재하지 않는다
- Worker는 R2 바인딩으로 직접 읽으므로 응답 본문을 가공하지 않는다. CPU 시간을 거의 쓰지 않아
  무료 한도 안에서 동작한다

완전한 차단이 아니라는 점을 전제로 한다. 조각을 전부 받아 합치는 것은 기술적으로 가능하다.
그 수준의 시도까지 막으려면 DRM이 필요하고, 개인 포트폴리오에 적용할 규모가 아니다.

### 재생기

`hls.js` 를 사용한다. 사파리는 HLS를 기본 지원하므로 네이티브 재생으로 넘긴다.

## 9. 비용

| 항목 | 무료 한도 | 예상 사용량 | 비용 |
|---|---|---|---|
| R2 저장 | 10GB | 경기 20~30편 + 장편 1~2편 = 17~30GB | 월 100~300원 |
| R2 읽기 요청 | 월 1천만 | 수천 건 | 0원 |
| R2 전송 | 무제한 무료 | - | 0원 |
| Workers 요청 | 일 10만 | 수백 건 | 0원 |
| GitHub Pages | 월 100GB 전송 | 사이트 코드만 (미디어는 R2) | 0원 |

10~15분 영상을 1080p로 뽑으면 편당 380~560MB, 3시간 장편을 720p로 뽑으면 3.4GB다.

## 10. 배포

GitHub Actions 가 `main` push 를 받아 Astro를 빌드하고 Pages에 배포한다.

```yaml
# .github/workflows/deploy.yml 요약
on: push: branches: [main]
jobs:
  build: withastro/action
  deploy: actions/deploy-pages
```

`astro.config.mjs` 에 `site` 와 `base` 를 설정한다. 저장소 이름이 경로에 붙는 형태로 배포되면
`base` 지정이 없을 때 모든 링크가 깨진다.

## 11. 환경 변수

`.env` 로 관리하고 git에서 제외한다. `.env.example` 에 항목만 적어 둔다.

| 변수 | 용도 |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID |
| `R2_ACCESS_KEY_ID` | R2 API 토큰 |
| `R2_SECRET_ACCESS_KEY` | R2 API 토큰 |
| `R2_BUCKET` | 버킷 이름 |
| `MEDIA_SIGN_SECRET` | Worker 서명 키. Worker 시크릿과 동일한 값 |
| `PUBLIC_MEDIA_BASE` | Worker 도메인. 사이트 빌드에 포함 |

## 12. 구현 순서

영상 업로드와 재생이 선결 과제다. 이 경로가 뚫리지 않으면 나머지 화면을 만들 이유가 없다.
화면을 먼저 만들고 파이프라인을 나중에 붙이면, 마지막에 가서 구조를 다시 짜게 될 위험이 있다.

그래서 1단계에서 영상 한 편을 끝까지 관통시킨다. 인코딩부터 재생까지 전 구간을 얇게 한 번 통과시키고,
동작을 확인한 뒤 각 구간을 두껍게 만든다.

### 1단계 — 영상 한 편 관통 (최우선)

```
원본 mp4 → ffmpeg 인코딩 → HLS 분할 → R2 업로드
         → Worker 서명 → 브라우저 재생
```

- [ ] 저장소 뼈대, npm workspaces, Docker (node:22 + ffmpeg)
- [ ] ffmpeg 인코딩 스크립트 (해상도 자동 판정, HLS 분할, 썸네일)
- [ ] Cloudflare 계정, R2 버킷 생성, 업로드 스크립트
- [ ] Worker: 서명 발급, 토큰 검증, Referer 검사, m3u8 재작성
- [ ] 최소 HTML 페이지에서 hls.js 로 재생

**검증 기준**

1. 휴대폰 LTE 환경에서 끊김 없이 재생된다
2. 구간 이동이 동작한다
3. 개발자도구에서 조각 주소를 복사해 다른 탭에서 열면 403이 뜬다
4. 30분 뒤 같은 주소로 요청하면 만료로 거부된다

이 네 가지가 확인되기 전에는 다음 단계로 넘어가지 않는다.

### 2단계 — 첫 화면과 경기 목록

- [ ] Astro 프로젝트, 콘텐츠 스키마 정의
- [ ] 샘플 경기 데이터 5건 작성
- [ ] 전적 집계 (`lib/record.ts`)
- [ ] 첫 화면: 프로필, 전적, 랭킹, 연락처 고정 버튼
- [ ] 경기 목록: 최근 5경기 노출, 나머지 접기
- [ ] 영상 재생기를 Vue 컴포넌트로 정리 (배속 포함)
- [ ] GitHub Actions 배포

**검증 기준**: 실제 URL을 휴대폰으로 열어 첫 화면에서 스크롤 없이 전적과 체급이 보인다.

### 3단계 — 업로드 CLI

- [ ] 대화형 입력 (이전 입력값 기억)
- [ ] 사진 일괄 등록
- [ ] 인코딩 결과 로컬 캐시
- [ ] JSON 생성과 git 연동

**검증 기준**: 명령 한 줄로 영상 등록부터 사이트 반영까지 끝난다.

### 4단계 — 나머지 화면

- [ ] 훈련 · 사진 카드 그리드
- [ ] 필터 (URL 쿼리 반영)
- [ ] 대회별 보기
- [ ] 사진 뷰어 (확대, 좌우 이동)
- [ ] 상세 페이지와 링크 미리보기 메타 태그

### 5단계 — 디자인 마감

- [ ] 색상, 타이포그래피 확정
- [ ] 모바일 점검
- [ ] 로딩 성능 점검

### 이후 과제

- 다국어 (i18n 라우팅)
- PDF 출력
