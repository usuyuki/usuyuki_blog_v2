import GhostContentAPI from "@tryghost/content-api";

// Create API instance with site credentials
export const ghostClient = new GhostContentAPI({
  url: import.meta.env.GHOST_URL,
  key: import.meta.env.GHOST_CONTENT_KEY,
  version: "v5.0",
});

console.log(ghostClient);
