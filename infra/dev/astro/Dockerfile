FROM node:18-alpine
WORKDIR /usr/src/frontend
RUN corepack enable
ENTRYPOINT pnpm install && pnpm dev --host 0.0.0.0
EXPOSE 3000
