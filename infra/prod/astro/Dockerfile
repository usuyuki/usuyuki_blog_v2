FROM node:18-alpine AS prod
RUN apk update
RUN apk add curl
RUN corepack enable
WORKDIR /frontend
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN chown -R node:node .
# RUNでbuildすると環境変数取れないのでCMDでbuildする
CMD pnpm build && node ./dist/server/entry.mjs
EXPOSE 1000 
