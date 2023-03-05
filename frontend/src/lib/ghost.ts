import GhostContentAPI from "@tryghost/content-api";

// Create API instance with site credentials
export const ghostClient = new GhostContentAPI({
  url: "https://demo.ghost.io",
  key: "22444f78447824223cefc48062",
  version: "v5.0",
});

console.log(ghostClient);
