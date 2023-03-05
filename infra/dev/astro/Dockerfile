FROM node:18-alpine
WORKDIR /usr/src/frontend
COPY ./frontend /frontend
RUN corepack enable
CMD pnpm install
# デフォルトのlocalhostだとDockerがバインドしてくれなくてERR_EMPTY_RESPONSEになるので明示的に0.0.0.0を指定
CMD pnpm dev --host 0.0.0.0 
EXPOSE 3000
