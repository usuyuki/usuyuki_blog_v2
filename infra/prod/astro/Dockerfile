FROM node:22-slim AS prod
RUN npm install -g pnpm
WORKDIR /frontend
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN chown -R node:node .
# RUNでbuildすると環境変数取れないのでCMDでbuildする
CMD pnpm build && node ./dist/server/entry.mjs
EXPOSE 1000 
