sh:
	docker compose exec astro sh
1:
	docker compose exec astro pnpm 1
test:
	docker compose exec astro pnpm test:run
