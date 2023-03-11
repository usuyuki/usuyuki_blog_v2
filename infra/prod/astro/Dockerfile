FROM node:18-alpine AS prod
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
EXPOSE 3000
CMD ["pnpm", "run", "start", "--", "--host", "0.0.0.0"]
