# 本番 Terraform

Vercel 上の webhook 以外（Cloud Run / Secret Manager / Artifact Registry / Upstash Redis / Upstash Vector / 予算アラート）を作る。VPC は使わない。

## 手順

1. GCP プロジェクトと [Upstash Management API key](https://console.upstash.com/account/api) を用意する
2. `gcloud auth application-default login`
3. `terraform.tfvars.example` を `terraform.tfvars` にコピーして値を入れる
4. 適用する

```bash
cd infra/prd
terraform init
terraform plan
terraform apply
```

または `mise run prd-plan`。

5. 出力の `worker_url` と `worker_secret_id` を Vercel の `WORKER_URL` / `WORKER_SECRET` に設定する
6. Worker イメージを Artifact Registry に push し、`worker_image` を更新して再 apply する

最初の apply では Cloud Run は hello サンプルイメージになる。アプリの認証（`WORKER_SECRET`）は Secret Manager 経由で入る。

## 変数

| 変数 | 内容 |
|---|---|
| `project_id` | GCP プロジェクト |
| `region` | 既定 `asia-northeast1` |
| `upstash_redis_primary_region` | 既定 `ap-southeast-1`（Tokyo は Upstash global の候補に無い） |
| `cursor_api_key` | Cursor API key（Secret Manager → Cloud Run の `CURSOR_API_KEY`） |
| `allow_unauthenticated` | Vercel から叩くため既定 true。実体の認証は `WORKER_SECRET` |
| `sentry_dsn` | Worker の Sentry DSN。空なら無効 |
| `billing_account_id` | 月次予算アラート用の課金アカウント ID |
| `alert_email` | 予算アラートの送信先 |
| `monthly_budget_amount` | 既定 `10`（`budget_currency` 単位） |
| `budget_currency` | 課金アカウントの通貨。既定 `USD` |

状態ファイルは git に含めない。チームで共有するときは `terraform.tf` の GCS backend コメントを外す。

予算アラートの apply には、課金アカウントで予算を作る権限（Billing Account Administrator など）が必要。見方は [docs/ops.md](../../docs/ops.md)。
