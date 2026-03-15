#!/usr/bin/env bash
set -euo pipefail

REPO="ByHeads/bcadmin"
APP_NAME="Broadcaster Administrator"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_banner() {
  local version_tag="${1:-}"
  printf '\n'
  echo "________________________________________________________________________"
  printf '                 ___                   __             __               /\n'
  printf '                / _ )_______  ___ ____/ /______ ____ / /____ ____      \\\n'
  printf '   |\\ |\\       / _  / __/ _ \\/ _ `/ _  / __/ _ `(_-</ __/ -_) __/      /\n'
  printf '|\\ || || |\\   /____/_/  \\___/\\_,_/\\_,_/\\__/\\_,_/___/\\__/\\__/_/         \\\n'
  printf '|| || || ||   ___     __      _      _     __           __   %7s   /\n' "$version_tag"
  printf '\\| || || \\|  / _ |___/ /_ _  (_)__  (_)__ / /________ _/ /____  ____   \\\n'
  printf '   \\| \\|    / __ / _  /  '\'' \\/ / _ \\/ (_-</ __/ __/ _ `/ __/ _ \\/ __/   /\n'
  printf '           /_/ |_|\\_,_/_/_/_/_/_//_/_/___/\\__/_/  \\_,_/\\__/\\___/_/     \\\n'
  printf '          <>------------------------------------------------------<>   /\n'
  echo "_______________________________________________________________________\\"
  echo
}

step() { echo -n "> $*... "; }
done_msg() { echo "Done!"; }
info()  { echo "> $*"; }
warn()  { echo -e "${YELLOW}> $*${NC}"; }
error() { echo -e "${RED}> $*${NC}" >&2; exit 1; }

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="mac" ;;
  Linux)  PLATFORM="linux" ;;
  *)      error "Unsupported OS: $OS. For Windows, use: irm https://raw.githubusercontent.com/${REPO}/main/install.ps1 | iex" ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_SUFFIX="x64" ;;
  arm64|aarch64) ARCH_SUFFIX="arm64" ;;
  *)             error "Unsupported architecture: $ARCH" ;;
esac

step "Fetching the latest ${APP_NAME} release from GitHub"

RELEASE_JSON=$(curl -fsSL "$API_URL")
VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')
done_msg
print_banner "$VERSION"
info "Detected platform: $PLATFORM ($ARCH_SUFFIX)"
info "Latest version: $VERSION"

if [ "$PLATFORM" = "mac" ]; then
  ASSET_PATTERN="${ARCH_SUFFIX}\.dmg"
  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -iE "$ASSET_PATTERN" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')

  if [ -z "$DOWNLOAD_URL" ]; then
    error "Could not find macOS DMG for $ARCH_SUFFIX in release $VERSION"
  fi

  TMPFILE=$(mktemp -t bcadmin)
  step "Pulling the ${APP_NAME} installer from GitHub"
  curl -fsSL -o "$TMPFILE" "$DOWNLOAD_URL"
  done_msg

  step "Mounting the DMG"
  MOUNT_POINT=$(hdiutil attach "$TMPFILE" -nobrowse | tail -1 | awk -F'\t' '{print $NF}')
  done_msg

  if [ -d "/Applications/Broadcaster Administrator.app" ]; then
    step "Removing the existing /Applications/Broadcaster Administrator.app"
    rm -rf "/Applications/Broadcaster Administrator.app"
    done_msg
  fi

  step "Installing ${APP_NAME} to /Applications"
  APP_BUNDLE=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)
  if [ -z "$APP_BUNDLE" ]; then error "No .app found in DMG"; fi
  cp -R "$APP_BUNDLE" /Applications/
  done_msg

  hdiutil detach "$MOUNT_POINT" -quiet
  rm -f "$TMPFILE"

  info "${APP_NAME} $VERSION was installed to /Applications/${APP_NAME}.app"
  info "Run: open /Applications/${APP_NAME}.app"

elif [ "$PLATFORM" = "linux" ]; then
  ASSET_PATTERN="${ARCH_SUFFIX}.*\.AppImage"
  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -iE "$ASSET_PATTERN" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')

  if [ -z "$DOWNLOAD_URL" ]; then
    error "Could not find Linux AppImage for $ARCH_SUFFIX in release $VERSION"
  fi

  INSTALL_DIR="${HOME}/.local/bin"
  mkdir -p "$INSTALL_DIR"

  step "Pulling the ${APP_NAME} AppImage from GitHub"
  curl -fsSL -o "${INSTALL_DIR}/bcadmin" "$DOWNLOAD_URL"
  chmod +x "${INSTALL_DIR}/bcadmin"
  done_msg

  info "${APP_NAME} $VERSION was installed to ${INSTALL_DIR}/bcadmin"

  if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    warn "Add ${INSTALL_DIR} to your PATH if not already present"
  fi
fi

echo -e "${GREEN}> All done! ${APP_NAME} was successfully installed!${NC}"
