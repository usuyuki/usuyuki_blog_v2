FROM oven/bun:1.0 AS prod
WORKDIR /frontend
COPY package.json ./
COPY bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
# -R frontendすると確実だが、node_modulesとか含めた莫大になるので、最低限だけやる
RUN chown bun:bun /frontend && chown -R bun:bun /frontend/node_modules/proxy-from-env
# RUNでbuildすると環境変数取れないのでCMDでbuildする
CMD bun run build && bun ./dist/server/entry.mjs
EXPOSE 1000 
