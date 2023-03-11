import GhostContentAPI from '@tryghost/content-api';

// Create API instance with site credentials
export const ghostClient = new GhostContentAPI({
  url: process.env.GHOST_API_URL,
  key: process.env.GHOST_CONTENT_KEY,
  version: 'v5.0',
});
