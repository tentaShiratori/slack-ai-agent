# インフラ構成

Vercel Hobby（Slack 入口）+ Cloud Run（Agent）+ Upstash Redis / Vector。

- **Vercel**: Slack Events の署名検証と 3 秒 ack だけ
- **Cloud Run**: Claude Agent SDK、wiki 検索、Slack 返信
- **Upstash Redis**: スレッドと session id、transcript、lock、重複排除
- **Upstash Vector**: wiki の意味検索（後から足してもよい）
- **Secret Manager**: `ANTHROPIC_API_KEY`、Slack token、Worker 秘密

本番の GCP / Upstash は Terraform（[infra/prd](../infra/prd/README.md)）。Vercel の webhook は Terraform 対象外で、apply 後の `worker_url` を Vercel に渡す。

ローカル再現はホストでアプリ、Docker で Redis / Qdrant。起動方法は [infra/dev/README.md](../infra/dev/README.md)。

| 本番 | ローカル |
|---|---|
| Vercel Hobby | ホスト `webhook` :3000（`--watch`） |
| Cloud Run | ホスト `worker` :8080（`--watch`） |
| Upstash Redis | Docker `redis` :6379 |
| Upstash Vector | Docker `qdrant` :6333 |
| Secret Manager | `infra/dev/.env` |

```mermaid
flowchart LR
  subgraph host [mise run dev]
    Webhook[webhook :3000]
    Worker[worker :8080]
  end

  subgraph dockerCompose [infra/dev docker-compose]
    Redis[(redis :6379)]
    Qdrant[(qdrant :6333)]
  end

  Curl[curl fake Slack event] --> Webhook
  Webhook --> Worker
  Worker --> Redis
  Worker --> Qdrant
```

## 全体構成

```mermaid
flowchart TB
  subgraph slackSide [Slack]
    User[User]
    SlackAPI[Slack Events and Web API]
  end

  subgraph vercelSide [Vercel Hobby]
    Events["api/slack/events\nverify + 3s ack"]
  end

  subgraph gcpSide [GCP]
    Run[Cloud Run Worker\nClaude Agent SDK]
    SM[Secret Manager]
  end

  subgraph upstashSide [Upstash]
    Redis[(Redis\nsession lock transcript)]
    Vector[(Vector\nwiki embeddings)]
  end

  Claude[Anthropic API]

  User --> SlackAPI
  SlackAPI -->|"Events API"| Events
  Events -->|"POST + shared secret"| Run
  Run --> SM
  Run --> Redis
  Run --> Vector
  Run --> Claude
  Run -->|"chat.postMessage"| SlackAPI
```

## Slack 1通の流れ

```mermaid
sequenceDiagram
  participant Slack
  participant Vercel
  participant Run as CloudRun
  participant SM as SecretManager
  participant Redis as UpstashRedis
  participant Vector as UpstashVector
  participant Claude as Anthropic

  Slack->>Vercel: app_mention or thread reply
  Vercel->>Vercel: verify signature and ack
  Vercel->>Run: POST event
  Run->>SM: load API keys
  Run->>Redis: SETNX eventId and thread lock
  Run->>Redis: GET thread to sessionId
  opt wiki RAG
    Run->>Vector: query similar chunks
    Vector-->>Run: top-k passages
  end
  Run->>Claude: query resume sessionId plus wiki context
  Claude-->>Run: result and sessionId
  Run->>Redis: append SessionStore and SET mapping
  Run->>Slack: reply in thread
  Run->>Redis: release lock
```

## データ置き場

```mermaid
flowchart LR
  subgraph redisKeys [Upstash Redis]
    K1["slack:event:event_id"]
    K2["slack:thread:channel:ts"]
    K3["slack:lock:channel:ts"]
    K4["SessionStore lists"]
  end

  subgraph vectorIdx [Upstash Vector]
    V1["wiki chunks + embeddings"]
    V2["metadata page url title"]
  end

  SlackThread[Slack thread] --> K2
  K2 --> Agent[Cloud Run Agent]
  K4 --> Agent
  V1 --> Agent
```
