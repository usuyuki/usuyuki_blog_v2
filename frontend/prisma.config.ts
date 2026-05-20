import { defineConfig } from "prisma/config";

function buildDatasourceUrl(): string {
  const host = process.env.REACTIONS_DB_HOST ?? "localhost";
  const user = process.env.REACTIONS_DB_USER ?? "root";
  const password = process.env.REACTIONS_DB_PASSWORD ?? "";
  const name = process.env.REACTIONS_DB_NAME ?? "usuyuki_blog";
  return `mysql://${user}:${encodeURIComponent(password)}@${host}/${name}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: buildDatasourceUrl(),
  },
});
