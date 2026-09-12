# ローカル再現

アプリはホスト（mise / Node `--watch`）、Redis と Qdrant だけ Docker。Windows の bind mount によるファイル監視の問題を避ける。

| 本番 | ローカル |
|---|---|
| Vercel Hobby | ホスト `webhook` (`localhost:3000`) |
| Cloud Run | ホスト `worker` (`localhost:8080`) |
| Upstash Redis | Docker `redis` (`localhost:6379`) |
| Upstash Vector | Docker `qdrant` (`localhost:6333`) |
| Secret Manager | `infra/dev/.env` |

起動:

Docker Desktop を起動したうえで:

```bash
cp infra/dev/.env.example infra/dev/.env
mise run dev
```

`infra/dev/.env` に GitHub fine-grained PAT、デフォルトの `owner/repo` / Project id / Discussion カテゴリ id、`SLACK_BOT_TOKEN`、`CURSOR_API_KEY` を入れる。mise の `[env]` には起動用のプレースホルダがある。本番は Secret Manager と Cloud Run の env。

データストアだけ起動 / 停止:

```bash
mise run deps
mise run deps-down
```

偽 Slack イベント（署名検証は `SKIP_SLACK_VERIFY=1` でスキップ）:

```powershell
curl.exe -s http://localhost:3000/api/slack/events `
  -H "content-type: application/json" `
  -d '{"type":"event_callback","event_id":"evt-1","event":{"type":"app_mention","channel":"C123","ts":"1.0","text":"<@Ubot> hi"}}'

curl.exe -s http://localhost:3000/api/slack/commands `
  -H "content-type: application/x-www-form-urlencoded" `
  -d "command=/feature&text=add+login&trigger_id=trig-1&channel_id=C123"

curl.exe -s http://localhost:3000/api/slack/interactive `
  -H "content-type: application/x-www-form-urlencoded" `
  -d "payload={""type"":""view_submission"",""trigger_id"":""trig-2""}"
```

`/bug` のモーダルは webhook が `views.open` する。送信後の Issue 化は Worker の Cursor SDK と GitHub クライアント。ローカルでモーダルを開くには実 Slack の `SLACK_BOT_TOKEN` が必要。v1 の完成線は [docs/completion.md](../../docs/completion.md)。
