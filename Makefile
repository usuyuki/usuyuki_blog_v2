sh:
	docker compose exec astro sh
1:
	docker compose exec astro pnpm 1
test:
	docker compose exec astro pnpm test:run
log:
	docker compose logs astro
db:
	docker compose exec db mysql -u root -p -D usuyuki_blog
