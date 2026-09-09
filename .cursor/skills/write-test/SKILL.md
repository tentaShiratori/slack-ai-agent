---
name: write-test
description: Writes targeted tests for a specific file and runs only that file. Use when the user asks to write tests, add test cases, or verify a changed file.
---

# テスト追加

## 手順

1. 対象ファイルの export を列挙する
2. 各 export に正常系・異常系・境界値を書く
3. 実行は `pnpm test run {ファイル名}` のみ。全テスト実行は禁止

## ランナー未導入のとき

ハーネス初期構築では Vitest を入れない。そのパッケージにテストが初めて必要になったら、そのパッケージだけ Vitest を足す。

```bash
pnpm --filter {package} add -D vitest
```

`package.json` に `"test": "vitest"` を追加してから、対象ファイルだけ `pnpm test run {ファイル名}` する。
