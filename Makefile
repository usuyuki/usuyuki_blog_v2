sh:
	docker compose exec astro sh
1:
	docker compose exec astro pnpm 1
test:
	docker compose exec astro pnpm test:run
prisma:
	docker compose exec astro pnpm exec prisma generate
log:
	docker compose logs astro
db:
	docker compose exec db mysql -u root -p -D usuyuki_blog
# 本番のログを見る共通Grafanaの接続先。.gcx.yaml はURLを持てない(認証情報を含むstackはユーザー設定にしか置けない)ため、ここを唯一の定義にする
GRAFANA_SERVER := http://192.168.37.112:2008

# 本番のログを見る共通Grafanaを gcx から参照するための初回ログイン。トークンは GRAFANA_TOKEN か入力で渡す（gcx は端末がないと対話入力しないため）。
# リポジトリの .gcx.yaml がある場所では新しい認証情報を受け付けないので、ユーザー設定を明示して保存し、既定コンテキストは元に戻す。手順は CLAUDE.md の「本番ログ調査（gcx）」
# 入力中にCtrl-Cで抜けても端末のエコーが消えたままにならないよう、trapで戻す。
# current-context は失敗時もエラーをJSONで標準出力に出すことがあるため、終了コードで判定して空にする。
gcx-login:
	@token="$$GRAFANA_TOKEN"; \
	if [ -z "$$token" ]; then \
		printf 'Grafana service account token: '; \
		trap 'stty echo; echo; exit 130' INT TERM; \
		stty -echo; read -r token; stty echo; \
		trap - INT TERM; echo; \
	fi; \
	user_config="$$HOME/.config/gcx/config.yaml"; \
	prev=$$(gcx --config "$$user_config" config current-context -o text 2>/dev/null) || prev=""; \
	GRAFANA_TOKEN="$$token" gcx --config "$$user_config" login shared-grafana --server $(GRAFANA_SERVER) --yes && \
	if [ -n "$$prev" ]; then gcx --config "$$user_config" config use-context "$$prev" >/dev/null; fi
# ユーザー設定と .gcx.yaml を重ねた結果で、本番用の shared-grafana コンテキストだけを確認する(他のコンテキストの不備は対象外)
gcx-check:
	gcx config check --context shared-grafana
