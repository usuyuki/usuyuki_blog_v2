FROM node:18-alpine AS prod
RUN corepack enable
WORKDIR /usr/src/frontend
COPY frontend/package.json ./
COPY frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend .
EXPOSE 3000
CMD ["pnpm", "run", "start", "--", "--host", "0.0.0.0"]
