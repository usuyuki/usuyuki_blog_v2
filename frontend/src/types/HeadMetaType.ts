export type HeadMetaType = {
  title: string;
  slug: string;
  description: string;
  ogImage: string;
  // 未指定時はog:image:width/heightを出力しない
  ogImageWidth?: number;
  ogImageHeight?: number;
};
