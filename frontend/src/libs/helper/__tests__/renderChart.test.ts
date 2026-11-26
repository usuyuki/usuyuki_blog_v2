import { describe, expect, it } from "vitest";
import {
  buildNiceTicks,
  parseChartSpec,
  renderChart,
  toPercentages,
  xLabelInterval,
} from "../renderChart";

describe("parseChartSpec", () => {
  it("正常系: 正しいJSONはChartSpecとして読み込まれる", () => {
    const spec = parseChartSpec(
      JSON.stringify({
        type: "bar",
        title: "売れ行き",
        unit: "冊",
        labels: ["11時", "12時"],
        series: [{ name: "会場", values: [8, 18] }],
      }),
    );
    expect(spec).toEqual({
      type: "bar",
      title: "売れ行き",
      unit: "冊",
      labels: ["11時", "12時"],
      series: [{ name: "会場", values: [8, 18] }],
    });
  });

  it.each([
    {
      name: "JSONとして読めない文字列を入れるとパースできないのでエラーになる",
      input: "{type: bar}",
      message: "JSON",
    },
    {
      name: "typeにbar/line/pie以外を入れると描画方法が無いのでエラーになる",
      input:
        '{"type":"scatter","labels":["a"],"series":[{"name":"s","values":[1]}]}',
      message: "type",
    },
    {
      name: "pieにseriesを2つ入れると1つの円に収められないのでエラーになる",
      input:
        '{"type":"pie","labels":["a"],"series":[{"name":"s","values":[1]},{"name":"t","values":[2]}]}',
      message: "pie",
    },
    {
      name: "pieのvaluesがすべて0だと割合を計算できないのでエラーになる",
      input:
        '{"type":"pie","labels":["a","b"],"series":[{"name":"s","values":[0,0]}]}',
      message: "pie",
    },
    {
      name: "labelsが空だと横軸を描けないのでエラーになる",
      input: '{"type":"bar","labels":[],"series":[{"name":"s","values":[]}]}',
      message: "labels",
    },
    {
      name: "seriesが空だと描く値が無いのでエラーになる",
      input: '{"type":"bar","labels":["a"],"series":[]}',
      message: "series",
    },
    {
      name: "valuesの数がlabelsと違うと対応が取れないのでエラーになる",
      input:
        '{"type":"bar","labels":["a","b"],"series":[{"name":"s","values":[1]}]}',
      message: "values",
    },
    {
      name: "valuesに負の数を入れると0始まりの軸で描けないのでエラーになる",
      input:
        '{"type":"bar","labels":["a"],"series":[{"name":"s","values":[-1]}]}',
      message: "values",
    },
    {
      name: "valuesに数値以外を入れると高さを計算できないのでエラーになる",
      input:
        '{"type":"bar","labels":["a"],"series":[{"name":"s","values":["1"]}]}',
      message: "values",
    },
  ])("異常系: $name", ({ input, message }) => {
    expect(() => parseChartSpec(input)).toThrow(message);
  });
});

describe("buildNiceTicks", () => {
  it.each([
    // 1・2・5×10^nの刻みで、目盛りが4〜5本程度になる
    { max: 21, expected: [0, 5, 10, 15, 20, 25] },
    { max: 82, expected: [0, 20, 40, 60, 80, 100] },
    { max: 3, expected: [0, 1, 2, 3] },
    // すべて0のときも軸が潰れないよう最低1の目盛りを持つ
    { max: 0, expected: [0, 1] },
  ])("正常系: 最大値$maxから目盛り$expectedを作る", ({ max, expected }) => {
    expect(buildNiceTicks(max)).toEqual(expected);
  });
});

describe("toPercentages", () => {
  it.each([
    // 1つずつ四捨五入すると33%×3で99%になるが、合計が100になるよう端数の大きいものに配る
    { values: [1, 1, 1], expected: [34, 33, 33] },
    { values: [82, 15, 7], expected: [79, 14, 7] },
    { values: [3, 0], expected: [100, 0] },
  ])("正常系: $valuesの割合は$expectedになる", ({ values, expected }) => {
    const result = toPercentages(values);
    expect(result).toEqual(expected);
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});

describe("xLabelInterval", () => {
  it.each([
    // 短いラベルが少なければ全部出す
    { labels: ["11時", "12時", "13時"], bandWidth: 168, expected: 1 },
    // 最長の「2026年10月」(半角6文字+全角2文字=約78)は区間幅42の2つ分にも収まらないので3個おきにする
    {
      labels: Array.from({ length: 12 }, (_, i) => `2026年${i + 1}月`),
      bandWidth: 42,
      expected: 3,
    },
  ])(
    "正常系: 区間幅$bandWidthでは$expected個おきにラベルを出す",
    ({ labels, bandWidth, expected }) => {
      expect(xLabelInterval(labels, bandWidth)).toBe(expected);
    },
  );
});

describe("renderChart", () => {
  it("正常系: 棒グラフはタイトル・棒・値ラベル・軸ラベルを持つfigureになる", () => {
    const html = renderChart({
      type: "bar",
      title: "11/23の売れ行き",
      unit: "冊",
      labels: ["11時", "12時", "13時"],
      series: [{ name: "会場", values: [8, 18, 0] }],
    });
    expect(html).toMatch(/^<figure class="chart">/);
    expect(html).toContain('<figcaption class="chart-title">11/23の売れ行き');
    expect(html).toContain('role="img"');
    // スマホ幅で横スクロールさせるため、SVGはスクロール用の枠で包む
    expect(html).toContain(
      '<div class="chart-svg-scroll"><svg class="chart-svg"',
    );
    // 値が0の棒も要素は出し、高さ0で描く
    expect(html.match(/<rect class="chart-bar chart-series-0"/g)).toHaveLength(
      3,
    );
    expect(html).toContain(">18冊<");
    expect(html).toContain(">12時<");
    // 系列が1つなら凡例は出さない
    expect(html).not.toContain("chart-legend");
  });

  it("正常系: 複数系列の棒グラフは積み上げ、合計を値ラベルにし、凡例を出す", () => {
    const html = renderChart({
      type: "bar",
      labels: ["a"],
      series: [
        { name: "紙", values: [3] },
        { name: "電子", values: [2] },
      ],
    });
    expect(html).toContain('class="chart-bar chart-series-0"');
    expect(html).toContain('class="chart-bar chart-series-1"');
    expect(html).toContain(">5<");
    expect(html).toContain('class="chart-legend"');
    expect(html).toContain(">紙<");
    expect(html).not.toContain("chart-title");
  });

  it("正常系: 折れ線グラフは系列ごとに線と点を描く", () => {
    const html = renderChart({
      type: "line",
      labels: ["a", "b"],
      series: [{ name: "s", values: [1, 2] }],
    });
    expect(html).toContain('<polyline class="chart-line chart-series-0"');
    expect(
      html.match(/<circle class="chart-point chart-series-0"/g),
    ).toHaveLength(2);
  });

  it("正常系: 円グラフは0以外の値ごとに扇形を描き、中央に合計、凡例に値と割合を出す", () => {
    const html = renderChart({
      type: "pie",
      unit: "冊",
      labels: ["会場", "オンライン", "電子版", "見本誌", "その他", "なし"],
      series: [{ name: "頒布数", values: [50, 20, 10, 10, 10, 0] }],
    });
    // 値が0の「なし」は扇形を描かない
    expect(html.match(/<path class="chart-slice /g)).toHaveLength(5);
    // 色は4色を順に使い、5つ目は1つ目の色に戻る(6つ目の「なし」は0なので描かない)
    expect(
      html.match(/<path class="chart-slice chart-series-0"/g),
    ).toHaveLength(2);
    expect(html).toContain(">100冊<");
    // 1系列でも、円グラフはどの色が何かを示すため凡例を出す
    expect(html).toContain('class="chart-legend"');
    expect(html).toContain(">会場<");
    expect(html).toContain("50冊（50%）");
    expect(html).toContain("0冊（0%）");
    // 縦軸の目盛りは描かない
    expect(html).not.toContain("chart-grid");
  });

  it("正常系: 円グラフの扇形が5つだと、最後を2色目にして最初の扇形と同じ色で隣り合わないようにする", () => {
    const html = renderChart({
      type: "pie",
      labels: ["a", "b", "c", "d", "e"],
      series: [{ name: "s", values: [1, 1, 1, 1, 1] }],
    });
    const sliceClasses = [
      ...html.matchAll(/<path class="chart-slice (chart-series-\d)"/g),
    ].map((m) => m[1]);
    expect(sliceClasses).toEqual([
      "chart-series-0",
      "chart-series-1",
      "chart-series-2",
      "chart-series-3",
      "chart-series-1",
    ]);
    // 凡例の色も扇形とそろえる
    expect(html).toContain(
      '<span class="chart-swatch chart-series-1"></span>e<',
    );
  });

  it("正常系: 小数の合計は浮動小数点の誤差を出さずに表示する", () => {
    const bar = renderChart({
      type: "bar",
      labels: ["a"],
      series: [
        { name: "s", values: [0.1] },
        { name: "t", values: [0.2] },
      ],
    });
    const pie = renderChart({
      type: "pie",
      labels: ["a", "b"],
      series: [{ name: "s", values: [0.1, 0.2] }],
    });
    for (const html of [bar, pie]) {
      expect(html).toContain(">0.3<");
      expect(html).not.toContain("0.30000000000000004");
    }
  });

  it("正常系: 横軸のラベルが多く重なる場合は間引いて描く", () => {
    const labels = Array.from({ length: 12 }, (_, i) => `2026年${i + 1}月`);
    const html = renderChart({
      type: "line",
      labels,
      series: [{ name: "s", values: labels.map(() => 1) }],
    });
    expect(html).toContain(">2026年1月<");
    expect(html).not.toContain(">2026年2月<");
    expect(html).toContain(">2026年4月<");
  });

  it("正常系: 円グラフで1つの値が100%でも扇形の座標が壊れない", () => {
    const html = renderChart({
      type: "pie",
      labels: ["a", "b"],
      series: [{ name: "s", values: [3, 0] }],
    });
    expect(html.match(/<path class="chart-slice /g)).toHaveLength(1);
    expect(html).not.toContain("NaN");
    expect(html).toContain("3（100%）");
  });

  it("正常系: タイトルやラベルに含まれるHTMLはエスケープされる", () => {
    const html = renderChart({
      type: "bar",
      title: "<script>",
      labels: ["a&b"],
      series: [{ name: "<i>", values: [1] }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&amp;b");
  });
});
