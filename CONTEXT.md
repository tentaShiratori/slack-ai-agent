# Slack AI Agent

自分用 Slack から GitHub のカンバンと mtg 記録を回すボットのドメイン。

## Language

**報告**:
Slack の slash から起こす、GitHub Issue として追跡する作業単位（不具合・機能・リファクタ・非機能）。
_Avoid_: チケット（曖昧なとき）, タスク全般

**grilling**:
前提を問いで固め、決定と非目標を短く残す対話プロセス。このボットでは `/grill` のスレッド往復を指す。
_Avoid_: インタビュー, ヒアリング（汎用語）

**Project**:
GitHub のカンバン。報告の Issue を載せるボード。
_Avoid_: 下書きだけの Draft item（v1 では使わない）

**Discussion**:
grilling 要約の保存先。報告用 Issue とは分ける。
_Avoid_: Issue に mtg メモを混ぜる

**ヘルプ応答**:
素のメンションに対し、slash の使い方だけを返す振る舞い。自由対話ではない。
_Avoid_: 汎用チャット

**wiki 回答**（後続）:
GitHub Wiki を根拠に Slack で答える能力。v1 完成の外。
_Avoid_: v1 の主機能として扱うこと
