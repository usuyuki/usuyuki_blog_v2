import { describe, expect, it } from "vitest";
import { CHART_PREVIEW_SAMPLES, previewChart } from "../chartPreview";

describe("previewChart", () => {
  it.each([
    {
      name: "正常系: 正しいJSONを入れると描画したHTMLを返す",
      source:
        '{"type":"bar","labels":["a"],"series":[{"name":"s","values":[1]}]}',
      expectedHtml: '<figure class="chart">',
      expectedError: undefined,
    },
    {
      name: "正常系: 前後の空白や改行は無視して描画する",
      source:
        '\n  {"type":"line","labels":["a"],"series":[{"name":"s","values":[1]}]}  \n',
      expectedHtml: '<figure class="chart">',
      expectedError: undefined,
    },
    {
      name: "異常系: JSONとして読めない文字列を入れるとparseChartSpecが例外を投げるので、その理由をエラーとして返す",
      source: "{broken",
      expectedHtml: undefined,
      expectedError: "JSON",
    },
    {
      name: "異常系: 空文字を入れると描くものが無いので、入力を促すエラーを返す",
      source: "   ",
      expectedHtml: undefined,
      expectedError: "JSONを入力",
    },
  ])("$name", ({ source, expectedHtml, expectedError }) => {
    const result = previewChart(source);
    if (expectedHtml) {
      expect("html" in result && result.html).toContain(expectedHtml);
    }
    if (expectedError) {
      expect("error" in result && result.error).toContain(expectedError);
    }
  });

  it("正常系: サンプルはすべてエラーなく描画できる", () => {
    for (const sample of CHART_PREVIEW_SAMPLES) {
      expect(previewChart(sample.json)).toHaveProperty("html");
    }
    // 棒・折れ線・円の3種類を用意する
    expect(CHART_PREVIEW_SAMPLES.map((s) => JSON.parse(s.json).type)).toEqual([
      "bar",
      "line",
      "pie",
    ]);
  });
});
