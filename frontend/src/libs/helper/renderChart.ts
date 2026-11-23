// Ghostのコードカード(言語: chart)に書いたJSONから、記事本文用のグラフ(SVG)をSSRで組み立てる。
// 色はSVG属性に直書きせずクラス名だけを付け、blogCommon.cssのデザイントークンで塗る。

export type ChartType = "bar" | "line" | "pie";

export type ChartSeries = {
  name: string;
  values: number[];
};

export type ChartSpec = {
  type: ChartType;
  title?: string;
  // 値ラベルの後ろに付ける単位(例: "冊")
  unit?: string;
  labels: string[];
  series: ChartSeries[];
};

const CHART_TYPES: readonly ChartType[] = ["bar", "line", "pie"];

// SVGの座標系。viewBoxで縮小されるため、スマホ幅でも文字が潰れないよう横幅は控えめにしている
const WIDTH = 560;
const HEIGHT = 300;
const MARGIN = { top: 28, right: 12, bottom: 36, left: 44 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
// 1区間のうち棒が占める割合
const BAR_RATIO = 0.6;
// 円グラフ(ドーナツ型)の中心と外径・内径。内側の穴に合計値を出す
const PIE = { cx: WIDTH / 2, cy: HEIGHT / 2, outer: 132, inner: 76 };
// blogCommon.cssで定義している系列色の数。これを超える系列・扇形は先頭の色から繰り返す
const SERIES_COLOR_COUNT = 4;

const seriesClass = (index: number): string =>
  `chart-series-${index % SERIES_COLOR_COUNT}`;

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// JSON文字列を検証してChartSpecにする。描画できない内容なら理由を添えて例外を投げる
export const parseChartSpec = (source: string): ChartSpec => {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("chart: JSONとして読み込めません");
  }
  if (!isRecord(raw))
    throw new Error("chart: JSONはオブジェクトにしてください");

  const { type, title, unit, labels, series } = raw;
  if (!CHART_TYPES.includes(type as ChartType)) {
    throw new Error(
      `chart: typeは${CHART_TYPES.join(" / ")}のどれかにしてください`,
    );
  }
  if (
    !Array.isArray(labels) ||
    labels.length === 0 ||
    !labels.every((label) => typeof label === "string")
  ) {
    throw new Error("chart: labelsは1つ以上の文字列の配列にしてください");
  }
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error("chart: seriesは1つ以上指定してください");
  }
  const parsedSeries = series.map((item): ChartSeries => {
    if (!isRecord(item) || typeof item.name !== "string") {
      throw new Error("chart: seriesの各要素にはnameを指定してください");
    }
    const { values } = item;
    if (
      !Array.isArray(values) ||
      values.length !== labels.length ||
      !values.every(
        (value) =>
          typeof value === "number" && Number.isFinite(value) && value >= 0,
      )
    ) {
      throw new Error(
        "chart: valuesはlabelsと同じ数の、0以上の数値の配列にしてください",
      );
    }
    return { name: item.name, values };
  });
  if (type === "pie") {
    if (parsedSeries.length !== 1) {
      throw new Error("chart: pieのseriesは1つだけにしてください");
    }
    if (parsedSeries[0].values.every((value) => value === 0)) {
      throw new Error(
        "chart: pieのvaluesには0より大きい値を1つ以上入れてください",
      );
    }
  }

  return {
    type: type as ChartType,
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof unit === "string" ? { unit } : {}),
    labels,
    series: parsedSeries,
  };
};

// 0から最大値を覆う、1・2・5×10^n刻みの目盛りを4〜5本程度で作る
export const buildNiceTicks = (max: number): number[] => {
  if (max <= 0) return [0, 1];
  const rawStep = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ??
    10 * magnitude;
  const count = Math.ceil(max / step);
  // 0.1刻みなどで浮動小数点の誤差が出ないよう丸める
  return Array.from({ length: count + 1 }, (_, i) =>
    Number((i * step).toFixed(10)),
  );
};

const round = (n: number): number => Math.round(n * 100) / 100;

// 縦軸の目盛り線と目盛りの数値
const renderYAxis = (ticks: number[], toY: (v: number) => number): string =>
  ticks
    .map((tick) => {
      const y = round(toY(tick));
      return (
        `<line class="chart-grid" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${y}" y2="${y}"/>` +
        `<text class="chart-tick" x="${MARGIN.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${tick}</text>`
      );
    })
    .join("");

// 横軸のラベル(各区間の中央)
const renderXLabels = (
  labels: string[],
  bandCenter: (i: number) => number,
): string =>
  labels
    .map(
      (label, i) =>
        `<text class="chart-tick" x="${round(bandCenter(i))}" y="${HEIGHT - MARGIN.bottom + 22}" text-anchor="middle">${escapeHtml(label)}</text>`,
    )
    .join("");

// 棒グラフ。系列が複数あれば下から順に積み上げ、上に合計値を出す
const renderBars = (
  spec: ChartSpec,
  toY: (v: number) => number,
  bandWidth: number,
  bandCenter: (i: number) => number,
): string => {
  const barWidth = round(bandWidth * BAR_RATIO);
  const unit = escapeHtml(spec.unit ?? "");
  return spec.labels
    .map((_, i) => {
      const x = round(bandCenter(i) - barWidth / 2);
      let stacked = 0;
      const rects = spec.series
        .map((series, seriesIndex) => {
          const value = series.values[i];
          const top = toY(stacked + value);
          const height = round(toY(stacked) - top);
          stacked += value;
          return `<rect class="chart-bar ${seriesClass(seriesIndex)}" x="${x}" y="${round(top)}" width="${barWidth}" height="${height}"/>`;
        })
        .join("");
      const label = `<text class="chart-value" x="${round(bandCenter(i))}" y="${round(toY(stacked) - 8)}" text-anchor="middle">${stacked}${unit}</text>`;
      return rects + label;
    })
    .join("");
};

// 折れ線グラフ。系列ごとに線と各点の丸を描く
const renderLines = (
  spec: ChartSpec,
  toY: (v: number) => number,
  bandCenter: (i: number) => number,
): string =>
  spec.series
    .map((series, seriesIndex) => {
      const points = series.values.map((value, i) => ({
        x: round(bandCenter(i)),
        y: round(toY(value)),
      }));
      const polyline = `<polyline class="chart-line ${seriesClass(seriesIndex)}" points="${points.map((p) => `${p.x},${p.y}`).join(" ")}"/>`;
      const circles = points
        .map(
          (p) =>
            `<circle class="chart-point ${seriesClass(seriesIndex)}" cx="${p.x}" cy="${p.y}" r="4"/>`,
        )
        .join("");
      return polyline + circles;
    })
    .join("");

// 系列が複数あるときだけ凡例を出す(1系列ならタイトルで十分伝わるため)
const renderLegend = (series: ChartSeries[]): string =>
  series.length < 2
    ? ""
    : `<ul class="chart-legend">${series
        .map(
          (s, i) =>
            `<li><span class="chart-swatch ${seriesClass(i)}"></span>${escapeHtml(s.name)}</li>`,
        )
        .join("")}</ul>`;

// 円周上の点。角度0を真上にし、時計回りに進める
const pointOnCircle = (radius: number, angle: number) => ({
  x: round(PIE.cx + radius * Math.sin(angle)),
  y: round(PIE.cy - radius * Math.cos(angle)),
});

// ドーナツ型の扇形のパス。開始点と終了点が重なる100%の扇形でも描けるよう、
// 外周・内周の弧をそれぞれ中間点で2本に分けて描く(1本の弧は180度以下になる)
const donutSlicePath = (start: number, end: number): string => {
  const mid = (start + end) / 2;
  const [o1, o2, o3] = [start, mid, end].map((a) =>
    pointOnCircle(PIE.outer, a),
  );
  const [i1, i2, i3] = [start, mid, end].map((a) =>
    pointOnCircle(PIE.inner, a),
  );
  return (
    `M${o1.x} ${o1.y}` +
    `A${PIE.outer} ${PIE.outer} 0 0 1 ${o2.x} ${o2.y}` +
    `A${PIE.outer} ${PIE.outer} 0 0 1 ${o3.x} ${o3.y}` +
    `L${i3.x} ${i3.y}` +
    `A${PIE.inner} ${PIE.inner} 0 0 0 ${i2.x} ${i2.y}` +
    `A${PIE.inner} ${PIE.inner} 0 0 0 ${i1.x} ${i1.y}Z`
  );
};

// 円グラフ(ドーナツ型)。labelsの各値を扇形にし、中央に合計、凡例に値と割合を出す
const renderPie = (spec: ChartSpec): { svgBody: string; legend: string } => {
  const { values } = spec.series[0];
  const total = values.reduce((sum, value) => sum + value, 0);
  const unit = escapeHtml(spec.unit ?? "");
  let angle = 0;
  const slices = values
    .map((value, i) => {
      const start = angle;
      angle += (value / total) * 2 * Math.PI;
      // 値が0の扇形は幅が無いので描かない(凡例には残す)
      if (value === 0) return "";
      return `<path class="chart-slice ${seriesClass(i)}" d="${donutSlicePath(start, angle)}"/>`;
    })
    .join("");
  const center =
    `<text class="chart-total" x="${PIE.cx}" y="${PIE.cy}" text-anchor="middle" dominant-baseline="middle">${total}${unit}</text>` +
    `<text class="chart-tick" x="${PIE.cx}" y="${PIE.cy + 28}" text-anchor="middle">合計</text>`;
  const legend = `<ul class="chart-legend">${spec.labels
    .map((label, i) => {
      const percent = Math.round((values[i] / total) * 100);
      return `<li><span class="chart-swatch ${seriesClass(i)}"></span>${escapeHtml(label)}<span class="chart-legend-value">${values[i]}${unit}（${percent}%）</span></li>`;
    })
    .join("")}</ul>`;
  return { svgBody: slices + center, legend };
};

// 棒グラフ・折れ線グラフの、目盛り・グラフ本体・軸ラベルを組み立てる
const renderAxisChart = (spec: ChartSpec): string => {
  const maxValue =
    spec.type === "bar"
      ? Math.max(
          ...spec.labels.map((_, i) =>
            spec.series.reduce((sum, s) => sum + s.values[i], 0),
          ),
        )
      : Math.max(...spec.series.flatMap((s) => s.values));
  const ticks = buildNiceTicks(maxValue);
  const yMax = ticks[ticks.length - 1];
  const toY = (value: number) => MARGIN.top + PLOT_HEIGHT * (1 - value / yMax);
  const bandWidth = PLOT_WIDTH / spec.labels.length;
  const bandCenter = (i: number) => MARGIN.left + bandWidth * (i + 0.5);

  const marks =
    spec.type === "bar"
      ? renderBars(spec, toY, bandWidth, bandCenter)
      : renderLines(spec, toY, bandCenter);
  const baseline = `<line class="chart-axis" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${HEIGHT - MARGIN.bottom}" y2="${HEIGHT - MARGIN.bottom}"/>`;
  return (
    renderYAxis(ticks, toY) +
    marks +
    baseline +
    renderXLabels(spec.labels, bandCenter)
  );
};

// ChartSpecから<figure class="chart">のHTML文字列を組み立てる
export const renderChart = (spec: ChartSpec): string => {
  const pie = spec.type === "pie" ? renderPie(spec) : undefined;
  const svgBody = pie ? pie.svgBody : renderAxisChart(spec);
  const legend = pie ? pie.legend : renderLegend(spec.series);
  const ariaLabel = escapeHtml(
    spec.title ?? spec.series.map((s) => s.name).join(" / "),
  );

  const title = spec.title
    ? `<figcaption class="chart-title">${escapeHtml(spec.title)}</figcaption>`
    : "";
  const svg =
    `<div class="chart-svg-scroll"><svg class="chart-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${ariaLabel}">` +
    svgBody +
    "</svg></div>";

  return `<figure class="chart">${title}${svg}${legend}</figure>`;
};
