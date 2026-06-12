FROM node:24-slim
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
# corepackだとpnpmのインストールが初回コマンド実行時になるのでnpmでインストール
WORKDIR /frontend
# node_modules用named volumeの初期化時にこのディレクトリの所有権が引き継がれるため、
# 実行ユーザー(uid:1000)で書き込めるよう事前に作成しておく
RUN mkdir -p /frontend/node_modules && chown -R node:node /frontend
EXPOSE 1000
# .astro/dev.jsonはAstro7のdevサーバーロック。コンテナ強制終了で残留すると
# 新コンテナ内の無関係なプロセスとPIDが偶然一致して起動失敗するため毎回削除する
CMD ["sh", "-c", "rm -f .astro/dev.json && pnpm install && exec pnpm dev --host 0.0.0.0 --port 1000"]
