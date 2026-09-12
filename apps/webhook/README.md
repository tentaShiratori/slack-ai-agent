# webhook

Slack 入口（Vercel / ローカル）。本体は `src/`（worker と同じ `internal/controller|usecase|infra`）。Vercel の `api/` は薄いアダプタ。

| パス                          | Slack                                                       |
| ----------------------------- | ----------------------------------------------------------- |
| `POST /api/slack/events`      | Events（`url_verification` / `app_mention` / スレッド返信） |
| `POST /api/slack/commands`    | slash commands                                              |
| `POST /api/slack/interactive` | interactivity（`view_submission`）                          |

署名検証失敗は 401。ack の前に Cloud Tasks へ enqueue する（ローカルは `WORKER_URL` へ HTTP）。全体像はリポジトリルートの [README.md](../../README.md) と [docs/architecture.md](../../docs/architecture.md)。

## ローカル

リポジトリルートで:

```powershell
mise run webhook
```

または `mise run dev`（worker・Redis 込み）。

本番デプロイは [docs/deploy.md](../../docs/deploy.md)。
