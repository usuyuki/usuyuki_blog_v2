FROM node:22-slim
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
# corepackだとpnpmのインストールが初回コマンド実行時になるのでnpmでインストール
WORKDIR /frontend
EXPOSE 1000
CMD ["sh", "-c", "pnpm install && pnpm dev --host 0.0.0.0 --port 1000"]
