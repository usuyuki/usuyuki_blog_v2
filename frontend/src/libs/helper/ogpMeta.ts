import {
  DEFAULT_OGP_IMAGE_HEIGHT,
  DEFAULT_OGP_IMAGE_URL,
  DEFAULT_OGP_IMAGE_WIDTH,
} from "~/consts";

/**
 * 固定OGP画像(images/ogp/ogp.png)を使うページ用のog:image/width/heightをまとめて返す。
 * トップ・404・タグ一覧など固定画像を使う全ページで共用し、
 * 画像を差し替えた際の修正箇所を1箇所に留める。
 */
export function buildFixedOgpMeta(): {
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
} {
  return {
    ogImage: DEFAULT_OGP_IMAGE_URL,
    ogImageWidth: DEFAULT_OGP_IMAGE_WIDTH,
    ogImageHeight: DEFAULT_OGP_IMAGE_HEIGHT,
  };
}
