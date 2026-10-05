#!/usr/bin/env bash
# Cursor Cloud Agent install step (see .cursor/environment.json). Runs in a
# non-interactive login shell, so nothing from ~/.bashrc is on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."

export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
	curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh |
		PROFILE=/dev/null bash
fi
# nvm.sh references unset variables.
set +u
. "$NVM_DIR/nvm.sh"
nvm install 24
nvm alias default 24
NODE_BIN="$(dirname "$(nvm which 24)")"
set -u

[ -x "$HOME/.bun/bin/bun" ] || curl -fsSL https://bun.sh/install | bash

# The VM's login PATH lists /exec-daemon and an older nvm Node ahead of
# /usr/local/bin, so the profile.d entry is what makes Node 24 win.
for tool in node npm npx; do
	sudo ln -sf "$NODE_BIN/$tool" "/usr/local/bin/$tool"
done
sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bunx
echo "export PATH=\"$NODE_BIN:$HOME/.bun/bin:\$PATH\"" |
	sudo tee /etc/profile.d/gratitext-toolchain.sh >/dev/null
export PATH="$NODE_BIN:$HOME/.bun/bin:$PATH"

bun install --frozen-lockfile

needs_seed=false
[ -f prisma/sqlite.db ] || needs_seed=true
bun run setup:env
if [ "$needs_seed" = true ]; then
	bunx prisma db seed
fi

# `--with-deps` can stall after the download finishes; the browser itself is
# what the e2e tests need.
timeout 600 bunx playwright install --with-deps chromium ||
	bunx playwright install chromium
