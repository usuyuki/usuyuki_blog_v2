```
dc exec astro pnpm install
dc exec astro pnpm dev
```

本番用のビルドを試す

```
dc down
dc -f compose-prod.yml up -d --build
```


## 本番変更

stop不要
```sh
docker pull ghost:5-alpine && docker pull cloudflare/cloudflared && docker pull mysql:8.0-debian && docker pull ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest
dc -f compose-prod.yml up -d
```
