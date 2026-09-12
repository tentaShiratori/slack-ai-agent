# アーキテクチャ

完成の線は [completion.md](completion.md)。このページは **v1 の実行時構成** と、後続の wiki をどこに足すかを示す。

## 何をするシステムか

Slack の slash から:

- **報告系**（`/bug` / `/feature` / `/refactor` / `/nfr`）→ AI が整理 → GitHub **Issue** → **Project** に追加
- **grilling**（`/grill`）→ スレッド往復 → 要約を **Discussion** に保存
- 素の `@bot` → ヘルプのみ

## インフラ構成

Vercel Hobby（Slack 入口）+ Cloud Run（Agent）+ Upstash Redis。Upstash Vector は **wiki RAG 後続用**（Terraform / ローカル Qdrant は用意済みだが v1 では使わない）。

- **Vercel**: 署名検証と 3 秒 ack（Events / slash / interactivity）。ack 前に Cloud Tasks へ enqueue
- **Cloud Tasks**: `POST /jobs` を Cloud Run へ配送し、リクエスト中は接続を維持する
- **Cloud Run**: Cursor SDK、GitHub API、Slack 返信
- **Upstash Redis**: スレッド↔session、transcript、lock、重複排除
- **Secret Manager**: `CURSOR_API_KEY`、Slack token、GitHub PAT、Worker 秘密、enqueue 用 SA キー

本番の GCP / Upstash は Terraform（[infra/prd](../infra/prd/README.md)）。Vercel は Terraform 対象外で、apply 後の `worker_url` と Cloud Tasks の出力を渡す。

ローカルはホストでアプリ、Docker で Redis（と後続用 Qdrant）。起動は [infra/dev/README.md](../infra/dev/README.md)。本番の Vercel isolate は Slack ack 後に freeze するため、Cloud Run へ直接 `fetch` してはいけない。

## Cloud Tasks の制約

- HTTP task の **dispatch deadline は最大約 30 分**（実装は 1800 秒）。それを超える Agent はこの経路の対象外。超えるなら別 issue で Cloud Run Jobs を検討する
- 失敗時のリトライはキューの `retry_config`（最大 5 回、backoff 10s〜300s、全体 3600s）。Cloud Tasks は HTTP **429 / 5xx** と接続失敗をリトライする。**4xx**（401 の秘密違い、400 の不正ジョブ）はリトライしない
- Worker の `POST /jobs` はリクエストを開けたまま処理する。クライアントは Vercel ではなく Cloud Tasks
- 同一 Slack `event_id` の再 enqueue は Cloud Tasks 上で ALREADY_EXISTS とし、成功扱い（Slack の再送に耐える）

| 本番 | ローカル |
|---|---|
| Vercel Hobby | ホスト `webhook` :3000（`--watch`） |
| Cloud Tasks | なし（`WORKER_URL` へ HTTP。完了は待たない） |
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
  Webhook -->|"POST /jobs (完了は待たない)"| Worker
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
    Tasks[Cloud Tasks queue]
    Run[Cloud Run Worker\nCursor SDK]
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

  Cursor[Cursor API]

  User --> SlackAPI
  SlackAPI --> Edge
  Edge -->|"enqueue (await)"| Tasks
  Tasks -->|"POST /jobs + OIDC"| Run
  Run --> SM
  Run --> Redis
  Run --> Cursor
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
  participant Tasks as CloudTasks
  participant Run as CloudRun
  participant Redis
  participant Cursor as Cursor SDK
  participant GH as GitHub

  Slack->>Vercel: slash or view_submission
  Vercel->>Vercel: verify
  Vercel->>Tasks: create task (await)
  Vercel->>Slack: ack within 3s
  Tasks->>Run: POST /jobs (connection held)
  Run->>Redis: SETNX eventId and lock
  Run->>Cursor: organize title body labels
  Cursor-->>Run: structured issue draft
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
  participant Tasks as CloudTasks
  participant Run as CloudRun
  participant Redis
  participant Cursor as Cursor SDK
  participant GH as GitHub

  Slack->>Vercel: /grill or thread reply
  Vercel->>Tasks: create task (await)
  Vercel->>Slack: ack within 3s
  Tasks->>Run: POST /jobs (connection held)
  Run->>Redis: lock + get sessionId
  Run->>Cursor: grilling round resume agentId
  Cursor-->>Run: questions or summary
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

環境変数でデフォルトを渡す。値は完成時点で未定でもよい。

| 変数 | 内容 |
|---|---|
| `GITHUB_PAT` | fine-grained PAT（Secret Manager / `infra/dev/.env`） |
| `GITHUB_DEFAULT_REPO` | Issue のデフォルト `owner/repo` |
| `GITHUB_PROJECT_ID` | Project v2 の node id（`PVT_...`） |
| `GITHUB_DISCUSSION_CATEGORY_ID` | Discussion カテゴリの node id（`DIC_...`） |
| `GITHUB_DISCUSSION_REPO` | Discussion 用 `owner/repo`。省略時は `GITHUB_DEFAULT_REPO` |

## 後続: Wiki RAG

別リポの GitHub Wiki を Embed し、Vector 検索して回答に載せる。チャンネル名でのリポ切替も後続。v1 のコマンド契約には含めない。詳細な完成条件は [completion.md](completion.md) の「完成に入れないもの」。
