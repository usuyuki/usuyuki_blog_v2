```
dc exec astro bun install
dc exec astro bun dev
```

本番用のビルドを試す

```
dc down
dc -f compose-prod.yml up -d --build
```
