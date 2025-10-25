# Build stage
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /frontend

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set production environment and build
ENV NODE_ENV=production
RUN pnpm build

# Production stage
FROM node:22-slim AS prod

# Create non-root user first
RUN addgroup --gid 1001 --system nodejs \
    && adduser --system --uid 1001 astro

# Set up working directory with correct ownership
RUN mkdir -p /frontend && chown -R astro:nodejs /frontend
WORKDIR /frontend

# Copy package files and install production dependencies with correct ownership
COPY --chown=astro:nodejs package.json pnpm-lock.yaml ./
RUN npm install -g pnpm \
    && pnpm install --frozen-lockfile --prod \
    && npm cache clean --force \
    && rm -rf /root/.npm

# Copy built application from build stage with correct ownership
COPY --chown=astro:nodejs --from=build /frontend/dist ./dist

USER astro
EXPOSE 1000

CMD ["node", "./dist/server/entry.mjs"] 
