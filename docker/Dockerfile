FROM node:22-bookworm-slim

# ffmpeg: 영상 인코딩과 HLS 분할
# git: Astro 일부 의존성과 버전 정보 조회에 필요
# curl: Worker 와 개발 서버 동작 확인
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 호스트 사용자와 UID를 맞춰 볼륨 파일 소유권 문제를 피한다
ARG UID=1000
ARG GID=1000
RUN if [ "$UID" != "1000" ]; then \
        usermod -u "$UID" node && groupmod -g "$GID" node; \
    fi \
    && chown -R node:node /app

USER node
