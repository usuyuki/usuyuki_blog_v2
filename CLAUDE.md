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

## Development Commands

All development work happens in the `frontend/` directory. Use these commands:

```bash
# Start development server
make dev
# or
docker compose exec astro pnpm dev

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
- `frontend/src/components/` - Astro components organized by atomic design
- `frontend/src/pages/` - Astro pages and routes
- `frontend/src/styles/` - CSS files including Ghost content styling
- `compose.yml` - Development Docker configuration
- `compose-prod.yml` - Production Docker configuration

## Environment Variables

The Ghost CMS connection requires:
- `GHOST_API_URL` - Ghost CMS API endpoint
- `GHOST_CONTENT_KEY` - Ghost CMS content API key

## Testing and Quality Assurance

Always run the complete pipeline before committing:
```bash
docker compose exec astro pnpm 1
```

This runs:
1. Biome formatting
2. Biome linting and checking
3. Astro type checking
4. Build process

## Deployment Pipeline

- CI/CD runs on GitHub Actions
- Pushes to main branch trigger automated deployment
- Containers are built and pushed to ghcr.io
- Production server pulls and deploys latest containers