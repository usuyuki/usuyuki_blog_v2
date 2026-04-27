FROM node:24-slim
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
# corepackだとpnpmのインストールが初回コマンド実行時になるのでnpmでインストール
WORKDIR /frontend
# named volumeが空の状態で初めてマウントされた時にDockerがこのディレクトリをvolumeにコピーする
# その際にnode所有権も引き継がれるためpnpm installが1000:1000で実行できる
RUN mkdir -p /frontend/node_modules && chown node:node /frontend/node_modules
EXPOSE 1000
USER node
CMD ["sh", "-c", "pnpm install && pnpm dev --host 0.0.0.0 --port 1000"]
