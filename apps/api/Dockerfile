FROM oven/bun:1.4

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN bun install --frozen-lockfile --production

# La imagen es para producción: sin /docs, sin mensajes de error en los logs y con correos reales.
# Para usarla en local, `apps/api/.env` puede poner NODE_ENV=development.
ENV NODE_ENV=production

USER bun
EXPOSE 8000

CMD ["bun", "apps/api/src/main.ts"]
