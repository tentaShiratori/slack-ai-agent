# webhook

Slack 入口（Vercel / ローカル）。本体は `src/`（worker と同じ `internal/controller|usecase|infra`）。Vercel の `api/` は薄いアダプタ。全体像はリポジトリルートの [README.md](../../README.md) と [docs/architecture.md](../../docs/architecture.md)。

## ローカル

リポジトリルートで:

```powershell
mise run webhook
```

または `mise run dev`（worker・Redis 込み）。

本番デプロイは [docs/deploy.md](../../docs/deploy.md)。
