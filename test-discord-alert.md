# Discord アラート設定テスト手順

## 1. Discord Webhook URLの取得

1. Discordサーバーの設定画面を開く
2. 「連携」→「ウェブフック」を選択
3. 「新しいウェブフック」をクリック
4. 名前を設定（例: "Blog Error Alerts"）
5. チャンネルを選択
6. 「ウェブフックURLをコピー」でURLを取得

## 2. 環境変数の設定

`.env`ファイルに以下を追加：
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

## 3. サービスの再起動

```bash
# 開発環境
docker compose down
docker compose up -d

# 本番環境
docker compose -f compose-prod.yml down
docker compose -f compose-prod.yml up -d
```

## 4. テスト用エラーの発生

### Astroでエラーを発生させる場合

```bash
# Astroコンテナでエラーログを出力
docker compose exec astro sh -c "echo 'ERROR: Test error message for Discord alert' >&2"
```

### Ghostでエラーを発生させる場合

```bash
# Ghostコンテナでエラーログを出力  
docker compose exec ghost sh -c "echo 'ERROR: Test database error' >&2"
```

## 5. アラートの確認

- Grafana UI (http://localhost:1002) でアラートが発火していることを確認
- Discordチャンネルに通知が届いていることを確認

## 6. 設定されるアラート

### Astro関連
- **AstroApplicationError**: ERRORレベルのログが5分間で1回以上検出
- **AstroApplicationCritical**: FATAL/CRITICALレベルのログが検出

### Ghost関連  
- **GhostApplicationError**: ERRORレベルのログが5分間で1回以上検出
- **GhostDatabaseError**: データベース関連のエラーが検出

## 7. アラート解除

エラーログの出力が停止すると、自動的にアラートが解除されます。