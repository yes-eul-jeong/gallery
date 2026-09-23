#!/bin/bash
# 재생 경로 검증. CORS 헤더와 실제 스트림 디코딩을 확인한다.
# worker 서비스가 떠 있어야 한다: docker compose -f docker/compose.yml up -d worker

set -uo pipefail
ORIGIN="http://localhost:4321"
BASE="http://worker:8787"

echo "=== CORS 헤더 확인 (hls.js 는 fetch 를 쓰므로 필수) ==="
signed=$(curl -s -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/" "$BASE/sign/test-video")
echo "서명 응답: $signed"
PLAYLIST=$(echo "$signed" | sed -n 's/.*"playlist":"\([^"]*\)".*/\1/p')
QUERY="${PLAYLIST#*\?}"

echo
echo "재생목록 응답 헤더:"
curl -s -D - -o /dev/null -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/" "$PLAYLIST" \
  | grep -iE "^(HTTP/|access-control-allow-origin|content-type|vary)" | sed 's/^/  /'

echo
echo "조각 응답 헤더:"
curl -s -D - -o /dev/null -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/" \
  "$BASE/hls/test-video/seg0000.m4s?$QUERY" \
  | grep -iE "^(HTTP/|access-control-allow-origin|content-type|accept-ranges)" | sed 's/^/  /'

echo
echo "=== 스트림 전체 디코딩 (실제 재생 경로) ==="
ffmpeg -hide_banner -loglevel error \
  -headers $'Referer: '"$ORIGIN"$'/\r\nOrigin: '"$ORIGIN"$'\r\n' \
  -i "$PLAYLIST" -f null - 2>&1 | head -5
echo "디코딩 종료 코드: $?"

echo
echo "=== 받은 스트림 정보 ==="
ffprobe -v error \
  -headers $'Referer: '"$ORIGIN"$'/\r\n' \
  -show_entries format=duration -show_entries stream=codec_name,codec_type,width,height \
  -of csv=p=0 "$PLAYLIST"

echo
echo "=== 구간 이동 확인 (15초 지점에서 2초 추출) ==="
ffmpeg -hide_banner -loglevel error \
  -headers $'Referer: '"$ORIGIN"$'/\r\n' \
  -ss 15 -i "$PLAYLIST" -t 2 -f null - 2>&1 | head -3
echo "구간 이동 종료 코드: $?"
