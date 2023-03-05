FROM node:18-alpine
WORKDIR /usr/src/frontend
COPY ./frontend /frontend
RUN corepack enable
CMD pnpm install
CMD pnpm dev
EXPOSE 3000
