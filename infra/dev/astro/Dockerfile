FROM node:18-alpine
WORKDIR /usr/src/frontend
RUN corepack enable
# デフォルトのlocalhostだとDockerがバインドしてくれなくてERR_EMPTY_RESPONSEになるので明示的に0.0.0.0を指定
ENTRYPOINT pnpm install && pnpm dev --host 0.0.0.0 
EXPOSE 3000
