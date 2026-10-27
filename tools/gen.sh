#!/bin/zsh
# gen.sh <out.png> <prompt> [ref]
# 用 ChatGPT 內建的 codex 生一張圖。只拿這次 codex 工作階段自己的圖（別的 session 同時生圖也不會拿錯），
# 標準輸入關掉，背景執行不會卡在等輸入。
out=$1; prompt=$2; ref=$3
CODEX=/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex
msg="Generate one image with your image generation tool: $prompt. Do not run any shell commands."
if [ -n "$ref" ]; then
  $CODEX exec --skip-git-repo-check "$msg" -i "$ref" < /dev/null > "$out.log" 2>&1
else
  $CODEX exec --skip-git-repo-check "$msg" < /dev/null > "$out.log" 2>&1
fi
sid=$(grep -m1 -i "session id:" "$out.log" | awk '{print $3}')
img=$(ls -t ~/.codex/generated_images/$sid/*.png 2>/dev/null | head -1)
if [ -n "$sid" ] && [ -n "$img" ]; then cp "$img" "$out"; echo "ok $out"; else echo "FAIL $out (session $sid)"; fi
