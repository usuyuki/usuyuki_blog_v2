```
dc exec astro pnpm install
dc exec astro pnpm dev --host 0.0.0.0
```

本番用のビルドを試す

```
dc down
dc -f compose-prod.yml up -d --build
```
