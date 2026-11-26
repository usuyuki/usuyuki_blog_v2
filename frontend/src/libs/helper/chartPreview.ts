// グラフのプレビューページ(pages/dev/chart-preview.astro。本番ではBasic認証で保護)で使う処理。
// Ghostの下書きはContent APIで取得できず、公開するまで本番でグラフを確認できないため、
// コードカードに貼る前のJSONを描画して確かめられるようにする。
import { parseChartSpec, renderChart } from "./renderChart";

export type ChartPreviewResult = { html: string } | { error: string };

// 入力されたJSONを記事本文と同じ処理で描画する。描画できなければ理由を返す
export const previewChart = (source: string): ChartPreviewResult => {
  if (source.trim() === "") {
    return { error: "chartコードブロックに書くJSONを入力してください" };
  }
  try {
    return { html: renderChart(parseChartSpec(source)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

// サンプルをテキストエリアに表示するため、インデント付きのJSON文字列にする
const toJson = (spec: unknown): string => JSON.stringify(spec, null, 2);

// プレビューページで読み込めるサンプル(技術書典21の頒布数)
export const CHART_PREVIEW_SAMPLES: { label: string; json: string }[] = [
  {
    label: "棒グラフ",
    json: toJson({
      type: "bar",
      title: "技術書典21 11/23 会場（電子＋紙）の時間帯別頒布数",
      unit: "冊",
      labels: ["11時", "12時", "13時", "14時", "15時", "16時"],
      series: [{ name: "会場（電子＋紙）", values: [8, 18, 18, 21, 9, 8] }],
    }),
  },
  {
    label: "折れ線グラフ",
    json: toJson({
      type: "line",
      title: "技術書典21 11/21〜11/23 オンラインの頒布数",
      unit: "冊",
      labels: ["11/21", "11/22", "11/23"],
      series: [
        { name: "電子＋紙", values: [6, 2, 7] },
        { name: "電子版", values: [3, 2, 1] },
      ],
    }),
  },
  {
    label: "円グラフ",
    json: toJson({
      type: "pie",
      title: "技術書典21 11/21〜11/23 種別ごとの頒布数",
      unit: "冊",
      labels: ["会場（電子＋紙）", "オンライン（電子＋紙）", "電子版"],
      series: [{ name: "頒布数", values: [82, 15, 7] }],
    }),
  },
];
