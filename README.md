# slack-ai-agent

自分用 Slack ボット。**GitHub Issue（＋ Project カンバン）への報告**と、**mtg grilling → Discussion** を slash コマンドから行う。

完成の定義・受け入れ基準は **[docs/completion.md](docs/completion.md)**。用語は [CONTEXT.md](CONTEXT.md)。

## できること（v1）

| コマンド | 内容 |
|---|---|
| `/bug` | モーダル入力 → AI 整理 → Issue → Project |
| `/feature` `/refactor` `/nfr` | 指示文 → AI 整理 → Issue → Project |
| `/grill` | スレッドで grilling → 要約を Discussion へ |
| `@bot` | slash のヘルプのみ |

wiki 質問応答・チャンネルごとのリポ切替は後続。

## 構成（要約）

- **Vercel Hobby**: Slack の署名検証と 3 秒 ack
- **Cloud Run**: Cursor SDK、GitHub API、Slack 返信
- **Upstash Redis**: session / lock / 重複排除
- **Secret Manager**: Cursor・Slack・GitHub PAT・Worker 秘密

詳細図とシーケンスは [docs/architecture.md](docs/architecture.md)。デプロイ準備は [docs/deploy.md](docs/deploy.md)。

## ローカル

前提: [mise](https://mise.jdx.dev/)、Docker Desktop、`pnpm install`。

```powershell
mise install
pnpm install
copy infra\dev\.env.example infra\dev\.env
mise run dev
```

- webhook: `http://localhost:3000`
- worker: `http://localhost:8080`
- Redis: `localhost:6379`

偽イベントの例は [infra/dev/README.md](infra/dev/README.md)。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/completion.md](docs/completion.md) | v1 完成の定義 |
| [docs/architecture.md](docs/architecture.md) | 実行時構成 |
| [docs/deploy.md](docs/deploy.md) | 本番デプロイ準備 |
| [docs/ops.md](docs/ops.md) | Sentry・構造化ログ・メトリクス・予算アラート |
| [docs/adr/](docs/adr/) | 意思決定 |
| [CONTEXT.md](CONTEXT.md) | 用語集 |
| [AGENTS.md](AGENTS.md) | エージェント運用 |

## 開発メモ

- パッケージマネージャは **pnpm**（Bun ではない）
- タスクは GitHub Issue ベース。進行中は `In Progress` ラベル
- ブランチ: `{feat|fix|chore}/{issue番号}-{slug}`
- CI（GitHub Actions）で `fmt:check` / `lint` / webhook・worker のテストを回す
