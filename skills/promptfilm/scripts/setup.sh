#!/bin/sh
# Step 0 of every run: is this machine ready? Installs what is missing (setup.mjs), then prints the environment notice (env_check.mjs).
#   sh setup.sh --model <your model id> --lang ko|en [--check] [--install-chromium]
# Needs only a POSIX shell. Node.js 20+ comes first — everything else is a Node script: with Homebrew it is installed when missing;
# otherwise this says how to get it. The first run on a machine may download about 200 MB; later runs take a second.
HERE=$(cd "$(dirname "$0")" && pwd)
node_ok() { command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 20 ] 2>/dev/null; }
check_only=0; for a in "$@"; do [ "$a" = "--check" ] && check_only=1; done

if ! command -v node >/dev/null 2>&1 && command -v brew >/dev/null 2>&1 && [ $check_only = 0 ]; then
  echo "setup: no Node.js — installing it with Homebrew (brew install node) …"
  brew install node >/dev/null 2>&1 || echo "setup: brew install node failed"
fi
if ! node_ok; then
  echo "SETUP MISSING node: Node.js 20 or newer is needed (now: $(node -v 2>/dev/null || echo none))"
  case "$(uname -s)" in
    Darwin) echo "  install it from https://nodejs.org (the LTS installer), or with Homebrew (https://brew.sh): brew install node" ;;
    Linux)  echo "  install it from https://nodejs.org/en/download (nvm: nvm install --lts), or your package manager's nodejs 20+" ;;
    *)      echo "  install it from https://nodejs.org (the LTS installer), or: winget install OpenJS.NodeJS.LTS" ;;
  esac
  exit 3
fi
node "$HERE/setup.mjs" "$@" || exit $?
exec node "$HERE/env_check.mjs" "$@"
