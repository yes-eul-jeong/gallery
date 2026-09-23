#!/bin/bash
# Worker 동작 검증. 서명, 토큰 검증, Referer 검사, m3u8 재작성, Range 를 확인한다.
#   docker compose -f docker/compose.yml run --rm app 'bash scripts/verify-worker.sh'
# HLS_DIR 로 검증에 쓸 인코딩 산출물 경로를 지정할 수 있다.

set -euo pipefail
cd /app/worker

ORIGIN="http://localhost:4321"
BASE="http://127.0.0.1:8787"

echo "=== 로컬 R2 에 테스트 파일 적재 ==="
for f in ${HLS_DIR:-/app/cache/test-hls}/*; do
  name=$(basename "$f")
  case "$name" in
    *.m3u8) ct="application/vnd.apple.mpegurl" ;;
    *.m4s)  ct="video/iso.segment" ;;
    *.mp4)  ct="video/mp4" ;;
    *.webp) ct="image/webp" ;;
    *)      ct="application/octet-stream" ;;
  esac
  npx wrangler r2 object put "kickbox-media/hls/test-video/$name" \
    --file="$f" --ct="$ct" --local >/dev/null 2>&1
done
echo "적재 완료: $(ls ${HLS_DIR:-/app/cache/test-hls} | wc -l) 개"

echo "=== Worker 기동 ==="
npx wrangler dev --port 8787 --ip 0.0.0.0 >/app/cache/wrangler.log 2>&1 &
WPID=$!
trap 'kill $WPID 2>/dev/null || true' EXIT

curl -s -o /dev/null --retry 30 --retry-delay 2 --retry-all-errors --retry-connrefused \
  --max-time 120 "$BASE/health" || true

health=$(curl -s --max-time 10 "$BASE/health" || echo "실패")
echo "health: $health"

echo
echo "=== 검증 ==="

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/sign/test-video")
echo "1. Referer 없이 서명 요청        → $code  (기대 403)"

signed=$(curl -s -H "Referer: $ORIGIN/" "$BASE/sign/test-video")
echo "2. 정상 서명 요청                → $signed"

PLAYLIST=$(echo "$signed" | sed -n 's/.*"playlist":"\([^"]*\)".*/\1/p')
QUERY="${PLAYLIST#*\?}"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Referer: $ORIGIN/" "$PLAYLIST")
echo "3. 서명된 재생목록               → $code  (기대 200)"

echo "4. 재생목록 내용 (토큰 주입 확인):"
curl -s -H "Referer: $ORIGIN/" "$PLAYLIST" | grep -E "seg0000|EXT-X-MAP" | sed 's/^/     /'

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Referer: $ORIGIN/" \
  "$BASE/hls/test-video/seg0000.m4s")
echo "5. 토큰 없이 조각 직접 접근      → $code  (기대 403)"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Referer: $ORIGIN/" \
  "$BASE/hls/test-video/seg0000.m4s?t=aaaa&e=9999999999")
echo "6. 위조 토큰                     → $code  (기대 403)"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Referer: $ORIGIN/" \
  "$BASE/hls/test-video/index.m3u8?${QUERY%&e=*}&e=1000000000")
echo "7. 만료된 토큰                   → $code  (기대 403)"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Referer: https://evil.example.com/" \
  "$BASE/hls/test-video/index.m3u8?$QUERY")
echo "8. 다른 사이트에서 삽입          → $code  (기대 403)"

result=$(curl -s -o /dev/null -w "%{http_code} %{size_download}" -H "Referer: $ORIGIN/" \
  -H "Range: bytes=0-1023" "$BASE/hls/test-video/seg0000.m4s?$QUERY")
echo "9. Range 요청 (구간 이동)        → $result  (기대 206 1024)"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Referer: $ORIGIN/" \
  "$BASE/thumb/test-video/thumb-640.webp")
echo "10. 썸네일 (서명 면제)           → $code  (기대 200)"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/thumb/test-video/thumb-640.webp")
echo "11. 썸네일 Referer 없이          → $code  (기대 403)"
