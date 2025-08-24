# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a blog application with two main components:
- **Backend**: Ghost CMS (headless)
- **Frontend**: Astro-based static site generator with server-side rendering

## Architecture

The project uses a Docker-based development and deployment setup:
- Frontend runs on Astro with Tailwind CSS
- Backend uses Ghost CMS as a headless CMS
- Production deployment uses Docker containers with GitHub Actions CI/CD
- **Monitoring Stack**: Grafana + Loki + Promtail for log aggregation and visualization
  - **Loki**: Log aggregation system (port 3100)
  - **Grafana**: Metrics visualization and alerting dashboard (port 1002 in dev)
  - **Promtail**: Log collection agent for Docker containers

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
docker pull ghost:5-alpine && docker pull cloudflare/cloudflared && docker pull mysql:8.0-debian && docker pull ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest
docker compose -f compose-prod.yml up -d
```

## Component Architecture

The frontend follows Atomic Design principles:
- **Atom**: Basic components with no dependencies or state
- **Molecule**: Components that depend on other components
- **Organism**: Components that fetch external data or manage state

## Key Files and Directories

- `frontend/src/consts.ts` - Site configuration constants
- `frontend/src/libs/ghostClient.ts` - Ghost CMS API client
- `frontend/src/libs/astroLogger.ts` - Astro-specific logger with structured logging
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

### Optional Variables
- `TUNNEL_TOKEN` - Cloudflare tunnel token for production deployment
- `EXTERNAL_BLOGS` - JSON array of external blog RSS feeds
  ```json
  [
    {"name": "Qiita", "rssUrl": "https://qiita.com/username/feed", "color": "#55c500"},
    {"name": "Zenn", "rssUrl": "https://zenn.dev/username/feed", "color": "#3ea8ff"}
  ]
  ```

### Monitoring Variables
- `GF_SECURITY_ADMIN_USER` - Grafana admin username (default: admin)
- `GF_SECURITY_ADMIN_PASSWORD` - Grafana admin password (default: admin)
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for error notifications
- `GRAFANA_BASE_URL` - Grafana base URL for notification links

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