# デプロイ用Dockerfile。実ネットワークアクセスのある環境でスクレイパー・LZH解凍を
# 実地検証するための最小構成。Debianベース(better-sqlite3のプリビルドバイナリが
# glibc向けのため、alpine/muslは避ける)。

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DISABLE_SCHEDULER=true npm run build

FROM node:22-bookworm-slim AS runner
# lhasa: レーサー期別成績・競走成績アーカイブのLZH解凍に必須(src/lib/lzh.ts参照)
RUN apt-get update \
  && apt-get install -y --no-install-recommends lhasa \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/scripts ./scripts

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
