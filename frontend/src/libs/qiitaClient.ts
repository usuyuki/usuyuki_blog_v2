import type { ExternalBlogConfig, RSSItem } from "~/types/RSSType";
import { cache, ONE_HOUR_MS } from "~/libs/cache";
import astroLogger from "./astroLogger";
import errorHandler from "./errorHandler";

const SLOW_QIITA_THRESHOLD_MS = 2000;

type QiitaApiItem = {
  title: string;
  url: string;
  created_at: string;
};

export async function fetchQiitaItems(
  config: ExternalBlogConfig & { qiitaUserId: string },
): Promise<RSSItem[]> {
  const cacheKey = `qiita_api:${config.qiitaUserId}`;

  const cached = cache.get<RSSItem[]>(cacheKey);
  if (cached) {
    astroLogger.cacheLog("get", cacheKey, true);
    return cached;
  }

  const allItems: RSSItem[] = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const url = `https://qiita.com/api/v2/users/${config.qiitaUserId}/items?page=${page}&per_page=${perPage}`;

      astroLogger.info(`Fetching Qiita items page ${page}`, {
        service: "qiita-client",
        userId: config.qiitaUserId,
        page,
      });

      const fetchStart = Date.now();
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Blog Reader)" },
      });
      const fetchDuration = Date.now() - fetchStart;
      if (fetchDuration > SLOW_QIITA_THRESHOLD_MS) {
        astroLogger.warn(
          `Slow Qiita API: page ${page} took ${fetchDuration}ms`,
          {
            service: "qiita-client",
            userId: config.qiitaUserId,
            page,
            duration: fetchDuration,
            type: "slow_qiita_fetch",
          },
        );
      }

      if (!response.ok) {
        errorHandler.handleNetworkError(
          url,
          new Error(
            `Qiita API failed: ${response.status} ${response.statusText}`,
          ),
          {
            blogName: config.name,
            status: response.status,
            type: "qiita_api_error",
          },
        );
        break;
      }

      const items: QiitaApiItem[] = await response.json();
      if (items.length === 0) break;

      allItems.push(
        ...items.map((item) => ({
          title: item.title,
          link: item.url,
          published_at: item.created_at,
          source: config.name,
        })),
      );

      if (items.length < perPage) break;
      page++;
    }

    cache.set(cacheKey, allItems, ONE_HOUR_MS);

    astroLogger.info(
      `Fetched ${allItems.length} Qiita items for ${config.qiitaUserId}`,
      {
        service: "qiita-client",
        userId: config.qiitaUserId,
        totalItems: allItems.length,
        pages: page,
      },
    );

    return allItems;
  } catch (error) {
    errorHandler.handleError(error as Error, {
      blogName: config.name,
      qiitaUserId: config.qiitaUserId,
      type: "qiita_api_error",
    });
    return [];
  }
}
