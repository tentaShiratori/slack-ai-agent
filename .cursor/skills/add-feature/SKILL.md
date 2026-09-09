---
name: add-feature
description: Adds a feature on the existing web, app, or api surface without inventing new layers. Use when the user asks to add a feature, implement a screen, or extend an endpoint.
---

# 機能追加

## 手順

1. 対象面を決める（`apps/web` / `apps/app` / `api`）
2. graphify と better-code-review-graph `query`（`action=search`）で既存配置を確認する
3. 置き場所は `architecture.mdc`。`apps/web` と `apps/app` は既存の隣。`api` は `internal/` の構成に、今要るフォルダだけ足す（空のフォルダは作らない）。書く処理は usecase、読む処理は query、HTTP は controller
4. `write-test` スキルで、変更したファイルだけテストする
5. `progress.md` の状態・意思決定・次セッションを更新する
6. `graphify update .` を実行する
