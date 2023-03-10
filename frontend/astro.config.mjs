import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://blog.usuyuki.net",
  vite: {
    resolve: {
      alias: {
        "~": "/src",
        $components: "/src/components",
      },
    },
  },
  integrations: [sitemap()],
});
