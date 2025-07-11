# Build stage
FROM node:22-slim AS build
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
RUN npm install -g pnpm
WORKDIR /frontend

# Copy package files for production dependencies
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from build stage
COPY --from=build /frontend/dist ./dist

# Create non-root user
RUN addgroup --gid 1001 --system nodejs
RUN adduser --system --uid 1001 astro

# Change ownership of application files
RUN chown -R astro:nodejs .
USER astro

EXPOSE 1000

CMD ["node", "./dist/server/entry.mjs"] 
