#!/usr/bin/env bash
# Cloud Agent / ローカル共通の冪等な環境セットアップ。
# 何度実行しても壊れないこと（apt もツールチェーンも導入済みならスキップ）を前提にする。
# プロダクト固有の apt / typegen は TODO を埋めてから有効化する。
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

sudo_cmd=""
if [ "$(id -u)" -ne 0 ]; then sudo_cmd="sudo"; fi

# TODO: ネイティブ依存が要るときだけ apt ブロックを足す（例: Tauri の webkit2gtk）。

export PATH="$HOME/.local/bin:$PATH"
if ! command -v mise >/dev/null 2>&1; then
  curl -fsSL https://mise.run | sh
fi
mise trust --yes "$repo_root"
mise install

if ! grep -q "mise activate bash" "$HOME/.bashrc" 2>/dev/null; then
  echo "eval \"\$($HOME/.local/bin/mise activate bash)\"" >> "$HOME/.bashrc"
fi

mise exec -- pnpm install --frozen-lockfile

shims_dir="$HOME/.local/share/mise/shims"
mise reshim
if [ -d "$shims_dir" ]; then
  for shim in "$shims_dir"/*; do
    $sudo_cmd ln -sf "$shim" "/usr/local/bin/$(basename "$shim")"
  done
fi
