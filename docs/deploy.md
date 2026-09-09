# デプロイ前の準備

本番は Vercel（`apps/webhook`）と Cloud Run（`apps/worker`）。構成の説明は [architecture.md](architecture.md)、GCP / Upstash のリソース定義は [infra/prd/README.md](../infra/prd/README.md)。

このページは **一度だけ** やる認証とリンク。終わったら `mise run deploy`（または `deploy-webhook` / `deploy-worker`）で載せられる。

## 必要なもの

- [mise](https://mise.jdx.dev/)（`gcloud` / `terraform` / `pnpm` はこのリポジトリの `mise.toml` で入る）
- GCP プロジェクト（課金有効）
- AWS アカウント（Terraform 状態用の S3。リージョンは `ap-northeast-1`）
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)（`aws` コマンド）
- [Vercel](https://vercel.com/) アカウント（Hobby で可）
- [Upstash Management API key](https://console.upstash.com/account/api)
- Slack アプリの Bot Token（`xoxb-...`）と Signing Secret
- Anthropic API key

リポジトリルートでツールを入れる:

```powershell
mise install
pnpm install
```

## 1. gcloud

Terraform と `mise run deploy-worker` の両方が、今の `gcloud` のプロジェクト設定を使う。

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT
gcloud config get-value project
```

`application-default login` は Terraform 用。`auth login` は `gcloud run deploy` 用。プロジェクト ID はあとで `infra/prd/terraform.tfvars` の `project_id` と揃える。

Cloud Run の名前とリージョンは `mise.toml` の `[vars]`（既定 `slack-ai-agent` / `asia-northeast1`）と Terraform の `name` / `region` が一致している前提。

## 2. AWS

Terraform の状態は S3 backend（`infra/prd/terraform.tf` の `bucket = "tenta-tfstate"` / `region = "ap-northeast-1"`）に置く。AWS provider も同リージョン。

アクセスキーを使う場合:

```powershell
aws configure
aws sts get-caller-identity
```

`Default region name` は `ap-northeast-1`。SSO を使う場合はプロファイルを用意したうえで:

```powershell
aws sso login --profile YOUR_PROFILE
$env:AWS_PROFILE = "YOUR_PROFILE"
aws sts get-caller-identity
```

`infra-init` / `infra-plan` / `apply` の前に、この認証が通っていること。バケット `tenta-tfstate` への読み書き権限が必要。

## 3. Vercel

`apps/webhook` を Vercel プロジェクトに紐づける。CLI は webhook の依存に入っている。

```powershell
pnpm exec vercel login
pnpm exec vercel link
```

`link` で既存プロジェクトを選ぶか、新規作成する。`.vercel/` は git に含めない。

`mise run deploy-webhook` は `pnpm exec vercel --prod --yes` なので、リンク済みでないと本番向けプロジェクトを作れない／別プロジェクトに載る。

## 4. Terraform（初回）

Cloud Run 本体・Secret Manager・Artifact Registry・Upstash は Terraform が作る。worker のデプロイより先に apply する。

```powershell
cd infra/prd
copy terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` に `project_id`、Upstash、`anthropic_api_key`、`slack_bot_token` を入れる。ファイルは git 対象外。

```powershell
mise run infra-init
mise run infra-plan
terraform -chdir=infra/prd apply
```

最初の apply では Cloud Run のイメージは hello サンプルになる。アプリの認証（`WORKER_SECRET`）は Secret Manager に入る。

## 5. Terraform 出力を Vercel に渡す

```powershell
terraform -chdir=infra/prd output worker_url
terraform -chdir=infra/prd output worker_secret_id
```

秘密の値は:

```powershell
gcloud secrets versions access latest --secret=WORKER_SECRET_ID
```

`apps/webhook` の Vercel プロジェクトに、Production の Environment Variables を設定する。

| 変数                   | 値                                |
| ---------------------- | --------------------------------- |
| `WORKER_URL`           | `worker_url` の出力               |
| `WORKER_SECRET`        | Secret Manager の `worker-secret` |
| `SLACK_BOT_TOKEN`      | Slack Bot Token                   |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret              |

Dashboard か、リンク済みディレクトリから:

```powershell
cd apps/webhook
pnpm exec vercel env add WORKER_URL production
pnpm exec vercel env add WORKER_SECRET production
pnpm exec vercel env add SLACK_BOT_TOKEN production
pnpm exec vercel env add SLACK_SIGNING_SECRET production
```

## 6. Slack Events URL

`mise run deploy-webhook` のあとに出る Vercel の URL を、Slack アプリの Event Subscriptions に設定する（`https://<project>.vercel.app/api/slack/events`）。Request URL の検証には Signing Secret が Vercel 側に入っている必要がある。

## デプロイ

準備が終わったらリポジトリ根で:

```powershell
mise run deploy-webhook
mise run deploy-worker
```

両方なら `mise run deploy`。

`deploy-worker` は `gcloud run deploy slack-ai-agent-worker --source .` で、Cloud Build が `apps/worker` の Dockerfile をビルドする。プロジェクトは手順 1 の `gcloud config set project`、サービス名とリージョンは `mise.toml` の `[vars]`。
