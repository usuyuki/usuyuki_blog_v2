# Build stage
FROM node:24-slim AS build
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /frontend

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (includes prisma generate via @prisma/client postinstall if schema exists)
RUN pnpm install --frozen-lockfile

# Copy source code (including prisma/schema.prisma)
COPY . .

# Set production environment and build (runs prisma generate + astro build)
ENV NODE_ENV=production
RUN pnpm build

# Production stage
FROM node:24-slim AS prod

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
