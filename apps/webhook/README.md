# webhook

Slack 入口（Vercel / ローカル stand-in）。全体像はリポジトリルートの [README.md](../../README.md) と [docs/architecture.md](../../docs/architecture.md)。

## ローカル

リポジトリルートで:

```powershell
mise run webhook
```

または `mise run dev`（worker・Redis 込み）。

本番デプロイは [docs/deploy.md](../../docs/deploy.md)。
