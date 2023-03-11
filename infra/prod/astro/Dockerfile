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
# RUNでやると環境変数取れないのでCMDでやる
# PORTとHOSTもここでシェルフォームで指定しないと適応されない
CMD pnpm build && HOST=0.0.0.0 PORT=1000 node ./dist/server/entry.mjs
EXPOSE 1000 
