# Agent 実行は Cursor SDK

Cloud Run worker 上の Agent 実行は Claude Agent SDK ではなく **Cursor SDK**（`@cursor/sdk`）にする。認証は `CURSOR_API_KEY`。grilling の往復は Redis に agent id を置き、`Agent.resume` で継続する。
