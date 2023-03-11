FROM node:18-alpine AS prod
RUN apk update
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
# RUNでbuildすると環境変数取れないのでCMDでbuildする
CMD pnpm build && node ./dist/server/entry.mjs
EXPOSE 1000 
