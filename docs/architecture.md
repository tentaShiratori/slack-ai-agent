# アーキテクチャ

完成の線は [completion.md](completion.md)。このページは **v1 の実行時構成** と、後続の wiki をどこに足すかを示す。

## 何をするシステムか

Slack の slash から:

- **報告系**（`/bug` / `/feature` / `/refactor` / `/nfr`）→ AI が整理 → GitHub **Issue** → **Project** に追加
- **grilling**（`/grill`）→ スレッド往復 → 要約を **Discussion** に保存
- 素の `@bot` → ヘルプのみ

## インフラ構成

Vercel Hobby（Slack 入口）+ Cloud Run（Agent）+ Upstash Redis。Upstash Vector は **wiki RAG 後続用**（Terraform / ローカル Qdrant は用意済みだが v1 では使わない）。

- **Vercel**: 署名検証と 3 秒 ack（Events / slash / interactivity）
- **Cloud Run**: Claude Agent SDK、GitHub API、Slack 返信
- **Upstash Redis**: スレッド↔session、transcript、lock、重複排除
- **Secret Manager**: `ANTHROPIC_API_KEY`、Slack token、GitHub PAT、Worker 秘密

本番の GCP / Upstash は Terraform（[infra/prd](../infra/prd/README.md)）。Vercel は Terraform 対象外で、apply 後の `worker_url` を渡す。

ローカルはホストでアプリ、Docker で Redis（と後続用 Qdrant）。起動は [infra/dev/README.md](../infra/dev/README.md)。

| 本番 | ローカル |
|---|---|
| Vercel Hobby | ホスト `webhook` :3000（`--watch`） |
| Cloud Run | ホスト `worker` :8080（`--watch`） |
| Upstash Redis | Docker `redis` :6379 |
| Upstash Vector（後続） | Docker `qdrant` :6333 |
| Secret Manager | `infra/dev/.env` |

```mermaid
flowchart LR
  subgraph host [mise run dev]
    Webhook[webhook :3000]
    Worker[worker :8080]
  end

  subgraph dockerCompose [infra/dev docker-compose]
    Redis[(redis :6379)]
    Qdrant[(qdrant :6333 later)]
  end

  Curl[curl fake Slack event] --> Webhook
  Webhook --> Worker
  Worker --> Redis
```

## 全体構成

```mermaid
flowchart TB
  subgraph slackSide [Slack]
    User[User]
    SlackAPI[Slack Events Interactivity Slash]
  end

  subgraph vercelSide [Vercel Hobby]
    Edge["api/slack/*\nverify + 3s ack"]
  end

  subgraph gcpSide [GCP]
    Run[Cloud Run Worker\nClaude Agent SDK]
    SM[Secret Manager]
  end

  subgraph upstashSide [Upstash]
    Redis[(Redis\nsession lock transcript)]
  end

  subgraph githubSide [GitHub]
    Issues[Issues]
    Project[Project kanban]
    Disc[Discussions]
  end

  Claude[Anthropic API]

  User --> SlackAPI
  SlackAPI --> Edge
  Edge -->|"POST + shared secret"| Run
  Run --> SM
  Run --> Redis
  Run --> Claude
  Run --> Issues
  Run --> Project
  Run --> Disc
  Run -->|"chat.postMessage"| SlackAPI
```

## 報告系（Issue + Project）

`/bug` はモーダル、他は「コマンド＋ AI 向け指示文」。どちらも Worker 上の Agent が本文を整え、Issue 作成後に Project へ追加する。

```mermaid
sequenceDiagram
  participant Slack
  participant Vercel
  participant Run as CloudRun
  participant Redis
  participant Claude as Anthropic
  participant GH as GitHub

  Slack->>Vercel: slash or view_submission
  Vercel->>Vercel: verify and ack
  Vercel->>Run: POST job
  Run->>Redis: SETNX eventId and lock
  Run->>Claude: organize title body labels
  Claude-->>Run: structured issue draft
  Run->>GH: create Issue
  Run->>GH: add Issue to Project
  Run->>Slack: reply with Issue URL
  Run->>Redis: release lock
```

## grilling（Discussion）

`/grill` でスレッドを開始し、frontier 質問 → 返信 → 次ラウンドを Redis session で継続。終了宣言で要約を Discussion に残す。

```mermaid
sequenceDiagram
  participant Slack
  participant Vercel
  participant Run as CloudRun
  participant Redis
  participant Claude as Anthropic
  participant GH as GitHub

  Slack->>Vercel: /grill or thread reply
  Vercel->>Run: POST job
  Run->>Redis: lock + get sessionId
  Run->>Claude: grilling round resume sessionId
  Claude-->>Run: questions or summary
  alt still grilling
    Run->>Slack: post next questions in thread
  else finished
    Run->>GH: create Discussion with summary
    Run->>Slack: reply with Discussion URL
  end
  Run->>Redis: save session + release lock
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

  subgraph githubData [GitHub]
    I1[Issues + labels]
    P1[Project items]
    D1[Discussions]
  end

  SlackThread[Slack thread] --> K2
  K2 --> Agent[Cloud Run Agent]
  K4 --> Agent
  Agent --> I1
  Agent --> P1
  Agent --> D1
```

環境変数（名前は実装時に確定）で `GITHUB_DEFAULT_REPO`・Project id・Discussion 用リポ／カテゴリを渡す。値は完成時点で未定でもよい。

## 後続: Wiki RAG

別リポの GitHub Wiki を Embed し、Vector 検索して回答に載せる。チャンネル名でのリポ切替も後続。v1 のコマンド契約には含めない。詳細な完成条件は [completion.md](completion.md) の「完成に入れないもの」。
