# Build stage
FROM node:24-slim AS build
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /frontend

# Copy package files
# pnpm-workspace.yamlも先にコピーしないとallowBuilds等の設定が効かず、
# pnpm 11のstrictDepBuilds(デフォルトtrue)で未承認ビルドスクリプトのため失敗する
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies (includes prisma generate via @prisma/client postinstall if schema exists)
RUN pnpm install --frozen-lockfile

# Copy source code (including prisma/schema.prisma)
COPY . .

# Set production environment and build (runs prisma generate + astro build)
ENV NODE_ENV=production
RUN pnpm build

# Remove devDependencies to shrink the runtime image (build artifacts are already in dist).
# The prisma CLI toolchain survives prune because pnpm keeps it as an auto-installed peer of
# @prisma/client, but it is never imported at runtime (driver adapter + generated client only),
# so delete it explicitly.
RUN pnpm prune --prod --ignore-scripts \
    && rm -rf node_modules/.pnpm/prisma@* \
        node_modules/.pnpm/@prisma+studio-core@* \
        node_modules/.pnpm/@prisma+dev@* \
        node_modules/.pnpm/@prisma+engines@* \
        node_modules/.pnpm/@prisma+config@* \
        node_modules/.pnpm/@electric-sql+pglite* \
        node_modules/.pnpm/effect@* \
        node_modules/.pnpm/typescript@* \
        node_modules/prisma \
        node_modules/typescript \
        node_modules/.bin/prisma \
        node_modules/.bin/tsc \
        node_modules/.bin/tsserver

# Production stage
FROM node:24-slim AS prod

# Install OpenSSL for Prisma runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create non-root user first
RUN addgroup --gid 1001 --system nodejs \
    && adduser --system --uid 1001 astro

# Set up working directory with correct ownership
RUN mkdir -p /frontend && chown -R astro:nodejs /frontend
WORKDIR /frontend

# Copy package.json for Node.js module resolution
COPY --chown=astro:nodejs package.json ./

# Copy node_modules from build stage (includes generated Prisma client)
COPY --chown=astro:nodejs --from=build /frontend/node_modules ./node_modules

# Copy built application from build stage
COPY --chown=astro:nodejs --from=build /frontend/dist ./dist

USER astro
EXPOSE 1000

CMD ["node", "./dist/server/entry.mjs"]
