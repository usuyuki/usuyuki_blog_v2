import { describe, it, expect } from "vitest";
import { getReactionErrorMessage } from "../reactionErrorMessage";

describe("getReactionErrorMessage", () => {
  const tests: { name: string; status: number | null; want: string }[] = [
    {
      name: "異常系: 429を入れるとレート制限に掛かっているので時間をおくよう促すメッセージになる",
      status: 429,
      want: "リアクションが多すぎます。少し時間をおいてお試しください",
    },
    {
      name: "異常系: 404を入れると公開記事として見つからないのでリアクションできない旨のメッセージになる",
      status: 404,
      want: "この記事にはリアクションできません",
    },
    {
      name: "異常系: 503を入れると記事一覧を確認できないので受付停止中のメッセージになる",
      status: 503,
      want: "現在リアクションを受け付けられません。時間をおいてお試しください",
    },
    {
      name: "異常系: nullを入れると通信自体に失敗しているので接続確認を促すメッセージになる",
      status: null,
      want: "通信に失敗しました。接続を確認してお試しください",
    },
    {
      name: "異常系: 500を入れると個別の対応が無いので汎用の失敗メッセージになる",
      status: 500,
      want: "リアクションを送信できませんでした",
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(getReactionErrorMessage(tt.status)).toBe(tt.want);
    });
  }
});
