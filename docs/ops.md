# 運用

GCP / Sentry の無料枠で、失敗を追うための見方。再デプロイ手順は [deploy.md](deploy.md)。完成条件は [completion.md](completion.md)。

Cloud Run のサービス名は `slack-ai-agent-worker`、リージョンは `asia-northeast1`（`mise.toml` の `[vars]`）。プロジェクト ID は `gcloud config get-value project`。

## 構造化ログ（Cloud Logging）

Worker と webhook は 1 行 JSON を stdout / stderr に出す。Cloud Logging は `severity` をログレベル、`message` を本文として読む。

| フィールド | 内容 |
|---|---|
| `severity` | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL` |
| `message` | 短い説明 |
| `timestamp` | ISO 8601 |
| `service` | `worker` または `webhook` |
| `errorName` / `errorMessage` / `errorStack` | 例外時 |

Logs Explorer:

1. [Logs Explorer](https://console.cloud.google.com/logs/query) を開く
2. プロジェクトを合わせる
3. クエリ例:

```
resource.type="cloud_run_revision"
resource.labels.service_name="slack-ai-agent-worker"
```

エラーだけ:

```
resource.type="cloud_run_revision"
resource.labels.service_name="slack-ai-agent-worker"
severity>=ERROR
```

アプリ JSON のメッセージで絞る:

```
resource.type="cloud_run_revision"
jsonPayload.message="unhandled request error"
```

Vercel の webhook ログは [Vercel Dashboard](https://vercel.com/dashboard) → プロジェクト → Logs。同じ JSON 形式。

## Cloud Run メトリクス

1. [Cloud Run](https://console.cloud.google.com/run) → `slack-ai-agent-worker`
2. **METRICS** タブ

見るもの:

| 指標 | 見る理由 |
|---|---|
| Request count | 到達しているか |
| Request latency | タイムアウト（テンプレートは 3600s）に近づいていないか |
| Container instance count | 同時実行 1・最大 5 の範囲か |
| Billable container time / CPU / Memory | 無料枠と予算の消費 |

任意の期間は Cloud Monitoring の Metrics Explorer でも同じ指標を開ける。サービスは `run.googleapis.com`、リソースは Cloud Run Revision。

## Sentry

未処理例外は Worker で捕捉する。webhook も `withSlackApi` とローカル stand-in で同じ DSN に送る。`SENTRY_DSN` が空なら何もしない。

### プロジェクト（無料枠）

1. [Sentry](https://sentry.io/) で Developer プランのアカウントを作る
2. プラットフォーム **Node.js** のプロジェクトを作る
3. DSN をコピーする（`https://...@oNNNN.ingest.sentry.io/NNNN`）
4. Terraform の `sentry_dsn` と、Vercel の `SENTRY_DSN` に入れる（[deploy.md](deploy.md)）

### アラート（メール）

無料枠のデフォルトで、**新しい issue** はプロジェクトメンバーのメールに届く。追加の確認:

1. Sentry → **Alerts**（または Settings → Alerts）
2. 既定の "Send a notification for new issues" が On であること
3. Settings → **Account → Notifications** でメールが有効であること
4. 初回はテスト例外（ローカルで `SENTRY_DSN` を入れて故意に throw）か、本番で失敗するリクエストを 1 件出して、issue とメールを確認する

Slack 通知は無料枠の制限があるので、v1 はメールにする。

## GCP 予算アラート

Terraform が月次予算（既定 10 USD、50% / 90% / 100%）と、`alert_email` 向けの Monitoring メールチャネルを作る。通貨は課金アカウントと一致させる（`budget_currency`）。

確認:

1. [Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. 課金アカウントを選び、`slack-ai-agent-monthly` があること
3. 閾値とメール宛先が `alert_email` であること

Terraform 実行ユーザーは、その課金アカウントで予算を作る権限（Billing Account Administrator など）が必要。
