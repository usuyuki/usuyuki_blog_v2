FROM node:18-alpine AS prod
RUN apk add curl
RUN corepack enable
WORKDIR /usr/src/frontend
COPY frontend/package.json ./
COPY frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/astro.config.mjs .
COPY frontend/tailwind.config.cjs .
COPY frontend/tsconfig.json .
COPY frontend/public ./public
COPY frontend/src ./src
RUN chown -R node:node .
EXPOSE 1111
CMD ["pnpm", "run", "start", "--port", "1111","--host", "0.0.0.0"]
