# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Current Status (feat/v6-api branch)**: Project upgraded to Ghost v6 API with enhanced article aggregation system that combines internal Ghost CMS content with external RSS feeds (Qiita, Zenn). Ghost v6 API now has a maximum limit of 100 posts per request, requiring pagination for larger datasets.

## Project Overview

This is a blog application with two main components:
- **Backend**: Ghost CMS (headless)
- **Frontend**: Astro-based static site generator with server-side rendering

## Architecture

The project uses a Docker-based development and deployment setup:
- Frontend runs on **Astro 5** with **Tailwind CSS 4** and **Svelte 5**
- Backend uses **Ghost CMS 6** as a headless CMS
- Production deployment uses Docker containers with GitHub Actions CI/CD
- **Monitoring Stack**: Grafana + Loki + Promtail for log aggregation and visualization
  - **Loki 3.5**: Log aggregation system (port 3100)
  - **Grafana 12.1**: Metrics visualization and alerting dashboard (port 1002 in dev)
  - **Promtail 3.5**: Log collection agent for Docker containers

## Development Commands

All development work happens in the `frontend/` directory. Use these commands:

```bash
# Development server (NOTE: DO NOT run 'make dev' or 'pnpm dev' manually)
# The development server starts automatically when containers are launched
# and runs continuously in the background

# Complete build pipeline (format, lint, check, build)
make 1
# or
docker compose exec astro pnpm 1

# Individual commands
docker compose exec astro pnpm build
docker compose exec astro pnpm check      # Astro type checking
docker compose exec astro pnpm lint       # Biome linting and checking
docker compose exec astro pnpm format     # Biome formatting

# Access shell in container
make sh
# or
docker compose exec astro sh

# Install new packages/libraries
docker compose exec astro pnpm add <package-name>
# After installing new packages, restart the container to ensure proper loading
docker compose restart astro
```

## Production Deployment

Test production build:
```bash
docker compose down
docker compose -f compose-prod.yml up -d --build
```

Production update (no downtime):
```bash
docker pull ghost:6-alpine && docker pull cloudflare/cloudflared && docker pull mysql:8.0 && docker pull ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest
docker compose -f compose-prod.yml up -d
```

## Component Architecture

The frontend follows Atomic Design principles:
- **Atom**: Basic components with no dependencies or state
- **Molecule**: Components that depend on other components
- **Organism**: Components that fetch external data or manage state

## Key Files and Directories

- `frontend/src/consts.ts` - Site configuration constants
- `frontend/src/libs/ghostClient.ts` - Ghost CMS API client with retry logic and caching
- `frontend/src/libs/astroLogger.ts` - Winston-based structured logger with Loki integration
- `frontend/src/libs/articleAggregator.ts` - Unified article aggregation from Ghost and RSS feeds
- `frontend/src/libs/rssClient.ts` - RSS feed processing for external blogs
- `frontend/src/libs/config.ts` - Configuration management for external integrations
- `frontend/src/libs/errorHandler.ts` - Centralized error handling and logging
- `frontend/src/libs/cache.ts` - In-memory caching system for API responses
- `frontend/src/components/` - Astro components organized by atomic design
- `frontend/src/pages/` - Astro pages and routes
- `frontend/src/styles/` - CSS files including Ghost content styling
- `compose.yml` - Development Docker configuration
- `compose-prod.yml` - Production Docker configuration

### Monitoring Configuration
- `grafana/` - Grafana configuration and dashboards
  - `grafana.ini` - Grafana server configuration
  - `dashboards/` - Pre-configured dashboards (astro-logs.json, ghost-logs.json)
  - `provisioning/` - Automated provisioning configuration
- `loki/loki-config.yml` - Loki log aggregation configuration
- `promtail/promtail-config.yml` - Promtail log collection configuration

## Logging

Use `astroLogger` for all logging operations throughout the application:

```typescript
import astroLogger from '../libs/astroLogger.ts';

// Basic logging
astroLogger.info('Operation completed');
astroLogger.warn('Warning message');
astroLogger.error('Error occurred', error);
astroLogger.debug('Debug information');

// Structured logging with context
astroLogger.info('User action', {
  component: 'UserComponent',
  route: '/user/profile',
  method: 'POST'
});

// Specialized logging methods
astroLogger.requestLog(request, response, duration);
astroLogger.componentError('ComponentName', error);
astroLogger.apiError('/api/endpoint', error);
astroLogger.cacheLog('get', 'cache-key', true);
astroLogger.systemLog('System startup completed');
```

## Environment Variables

### Required Variables
- `BACKEND_API_URL` - Ghost CMS backend URL (e.g., http://localhost:1001)
- `GHOST_API_URL` - Ghost CMS API endpoint
- `GHOST_CONTENT_KEY` - Ghost CMS content API key
- `FRONTEND_URL` - Frontend application URL (e.g., http://localhost:1000)
- `GHOST_FRONT_URL` - Ghost frontend URL for admin interface

### Optional Variables
- `TUNNEL_TOKEN` - Cloudflare tunnel token for production deployment
- `EXTERNAL_BLOGS` - JSON array of external blog RSS feeds for article aggregation
  ```json
  [
    {"name": "Qiita", "rssUrl": "https://qiita.com/username/feed", "color": "#55c500"},
    {"name": "Zenn", "rssUrl": "https://zenn.dev/username/feed", "color": "#3ea8ff"}
  ]
  ```
- `LOKI_URL` - Loki log aggregation endpoint (default: http://loki:3100)

### Monitoring Variables
- `GF_SECURITY_ADMIN_USER` - Grafana admin username (default: admin)
- `GF_SECURITY_ADMIN_PASSWORD` - Grafana admin password (default: admin)
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for error notifications
- `GRAFANA_BASE_URL` - Grafana base URL for notification links

## Code Style Guidelines

- IMPORTANT: DO NOT ADD ***ANY*** COMMENTS unless asked
- Exception: When making changes to CLAUDE.md, add comments to explain the reason if the code change alone is unclear

## Testing and Quality Assurance

### Testing Framework
The project uses **Vitest** with Testing Library for comprehensive testing:

```bash
# Run tests in watch mode
docker compose exec astro pnpm test

# Run tests once
docker compose exec astro pnpm test:run

# Run tests with UI
docker compose exec astro pnpm test:ui
```

### Writing Tests
**IMPORTANT**: When adding new code, always write corresponding tests:

- **Components**: Place tests in `__tests__/` directory next to the component
- **Libraries**: Place tests in `libs/__tests__/` directory
- **API Routes**: Place tests in `pages/api/__test__/` directory
- **Types**: Place tests in `types/__tests__/` directory

Example test structure:
```typescript
// src/components/organism/article/__tests__/ComponentName.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ComponentName from '../ComponentName.svelte';

describe('ComponentName', () => {
  it('should render correctly', () => {
    const { getByText } = render(ComponentName);
    expect(getByText('Expected text')).toBeInTheDocument();
  });
});
```

### Complete Pipeline
Always run the complete pipeline before committing:
```bash
make 1
```

This runs:
1. Biome formatting
2. Biome linting and checking
3. Astro type checking
4. **All tests** (vitest run)
5. Build process

**IMPORTANT**: Always verify that `make 1` completes without any errors before considering any task complete. This ensures code quality and prevents broken builds.

## Caching System

The application uses multiple layers of caching for performance:

### In-Memory Application Cache
- **Location**: `frontend/src/libs/cache.ts`
- **Scope**: In-memory cache that persists during container runtime
- **Used by**: Archive API (`/api/archive`), Ghost client, RSS client
- **Cache Duration**: 
  - Archive articles: 1 hour (`ONE_HOUR_MS`)
  - Ghost API responses: 1 hour (configurable per endpoint)
  - RSS feed responses: Varies by feed freshness

### Cache Management Commands

```bash
# Clear all caches by restarting containers
docker compose restart astro

# For production
docker compose -f compose-prod.yml restart astro
```

### Important Notes
- **Cache Keys**: When modifying data aggregation logic (like `articleAggregator.ts`), change cache keys to force cache invalidation
- **Development**: Caches persist until container restart - always restart after significant changes
- **Production**: Caches improve performance but may require container restart for immediate updates
- **Ghost Client Cache**: Individual Ghost API calls are cached with TTL, check logs for cache HIT/MISS status

## Monitoring and Observability

### Accessing Grafana
- Development: http://localhost:1002
- Default credentials: admin/admin (configurable via environment variables)
- Pre-configured dashboards for Astro and Ghost log analysis

### Log Aggregation
- **Loki** aggregates logs from all Docker containers
- **Promtail** collects and forwards container logs to Loki
- **astroLogger** sends structured logs to Loki via LOKI_URL environment variable
- Logs are automatically labeled with container information

### Alert Notifications
- Discord notifications for critical errors (configure DISCORD_WEBHOOK_URL)
- Grafana alerting rules for system monitoring
- Contact points and notification policies configured in `grafana/provisioning/alerting/`

## Deployment Pipeline

- CI/CD runs on GitHub Actions
- Pushes to main branch trigger automated deployment
- Containers are built and pushed to ghcr.io (ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest)
- Production server pulls and deploys latest containers
- Cloudflare tunnel provides secure external access in production