FROM oven/bun:1.4

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN bun install --frozen-lockfile --production

USER bun
EXPOSE 8000

CMD ["bun", "apps/api/src/main.ts"]
