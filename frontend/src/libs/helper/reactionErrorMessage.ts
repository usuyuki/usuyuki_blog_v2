// リアクションPOSTが失敗したときに利用者へ表示するメッセージを返す。
// statusがnullのときは通信自体に失敗した(fetchが例外を投げた)ことを表す
export function getReactionErrorMessage(status: number | null): string {
  switch (status) {
    case 429:
      return "リアクションが多すぎます。少し時間をおいてお試しください";
    case 404:
      return "この記事にはリアクションできません";
    case 503:
      return "現在リアクションを受け付けられません。時間をおいてお試しください";
    case null:
      return "通信に失敗しました。接続を確認してお試しください";
    default:
      return "リアクションを送信できませんでした";
  }
}
