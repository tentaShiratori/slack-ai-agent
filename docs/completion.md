# 完成の定義（v1）

grilling セッションで合意した Done の線。実装・issue・受け入れの共通基準。

## 製品一文

自分用 Slack ボット。**不具合／機能／リファクタ／非機能を GitHub Issue 化し、指定 Project のカンバンに載せ**、**mtg は grilling で構造化して Discussion に残す**。

- 利用者: 自分一人・1 Workspace・Vercel Hobby
- wiki 質問応答は **v1 の外**（後続マイルストーン）

## 完成に入るもの

### コマンド契約

| コマンド | 入力 | 結果 |
|---|---|---|
| `/bug` | モーダル | AI が整理 → **Issue**（bug 系 label）→ **Project に追加** → スレッドに URL |
| `/feature` `/refactor` `/nfr` | コマンド＋ AI 向け指示文 | 同上（種別ごとの label）→ Project → URL |
| `/grill` | 開始（テーマ任意）→ スレッド往復 | 終了後、要約をデフォルトリポの **Discussion** に保存＋スレッドにリンク |
| 素の `@bot` | — | slash の使い方ヘルプのみ（自由対話・wiki なし） |

- デフォルトの `owner/repo`・Project・Discussion 用リポは環境変数。値は完成時点で未定でもよいが、枠と文書はある
- GitHub 認証: fine-grained PAT（Secret Manager）
- 実行基盤: Vercel（ack）+ Cloud Run（Cursor SDK）+ Redis（session / lock / dedup）

### 運用（GCP / Sentry 無料枠）

1. 本番デプロイ済み＆自分の Slack で実コマンドが通る
2. [deploy.md](deploy.md) で再デプロイ再現可
3. 失敗時はスレッドに短いエラー返信
4. 構造化ログ＋ Cloud Logging の見方を文書化
5. Sentry で未処理例外捕捉（Worker、可能なら webhook）
6. Sentry アラート（メール等・無料枠）
7. Cloud Run メトリクスの見方を文書化
8. GCP 予算アラート

外形監視（Uptime 等）は **issue 化のみ**（v1 実装必須ではない）。

## 完成に入れないもの（後続）

| 後続 | 内容 |
|---|---|
| Wiki RAG | 別リポ GitHub Wiki の意味検索回答 |
| チャンネル→リポ切替 | チャンネル名で対象リポを変える |
| 外形監視の実装 | Uptime 等の死活監視 |
| その他 | 独自ダッシュボード、GitHub App 移行、複数 WS、メンション万能 Agent |

## 受け入れテスト

1. `/bug` でモーダル → Issue＋Project カードができる
2. `/feature`（指示文付き）で Issue＋Project ができる
3. `/grill` で2ラウンド以上往復 → Discussion に要約が残る
4. `@bot` だけだとヘルプが返る
5. 故意に失敗させてもスレッドにエラーが出て、Sentry / Logging で追える
