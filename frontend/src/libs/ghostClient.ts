// 本当は型定義ライブラリを追加すべきだが、追加すると自前で定義した型と競合して大改修必要なので保留
// @ts-ignore
import GhostContentAPI from '@tryghost/content-api';

// Create API instance with site credentials
export const ghostClient = new GhostContentAPI({
	url: import.meta.env.GHOST_API_URL,
	key: import.meta.env.GHOST_CONTENT_KEY,
	version: 'v5.0'
});
