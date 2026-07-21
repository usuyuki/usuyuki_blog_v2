import sharp from "sharp";
import { cache, ONE_HOUR_MS } from "~/libs/cache";
import astroLogger from "~/libs/astroLogger";

export type ImageDimensions = {
  width: number;
  height: number;
};

// 同一URLへの同時呼び出しがfetch/sharpを1回だけ実行するよう共有する進行中Promise
const inFlightRequests = new Map<string, Promise<ImageDimensions | null>>();

// 画像ホストが無応答/極端に遅い場合にSSR全体がハングしないための上限
const FETCH_TIMEOUT_MS = 5000;

async function fetchImageDimensions(
  imageUrl: string,
): Promise<ImageDimensions | null> {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

/**
 * 画像URLから幅・高さを取得する(og:image:width/heightに使用)。
 * 取得できない場合はnullを返す。1時間キャッシュする。
 * cold cache時に同時アクセスがあってもfetch/sharpは1回だけ実行する。
 */
export async function getImageDimensions(
  imageUrl: string,
): Promise<ImageDimensions | null> {
  if (!imageUrl) {
    return null;
  }

  const cacheKey = `image_dimensions:${imageUrl}`;
  const cached = cache.get<ImageDimensions>(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightRequests.get(imageUrl);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchImageDimensions(imageUrl)
    .then((dimensions) => {
      if (dimensions) {
        cache.set(cacheKey, dimensions, ONE_HOUR_MS);
      }
      return dimensions;
    })
    .catch((error) => {
      astroLogger.warn(
        `Failed to get image dimensions: ${(error as Error).message}`,
        {
          imageUrl,
          errorType: "image_dimensions_error",
        },
      );
      return null;
    })
    .finally(() => {
      inFlightRequests.delete(imageUrl);
    });

  inFlightRequests.set(imageUrl, request);
  return request;
}
