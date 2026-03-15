#!/usr/bin/env bash
set -euo pipefail

REPO="ByHeads/bcadmin"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="mac" ;;
  Linux)  PLATFORM="linux" ;;
  *)      error "Unsupported OS: $OS. For Windows, use: irm https://raw.githubusercontent.com/${REPO}/main/scripts/install.ps1 | iex" ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_SUFFIX="x64" ;;
  arm64|aarch64) ARCH_SUFFIX="arm64" ;;
  *)             error "Unsupported architecture: $ARCH" ;;
esac

info "Detected platform: $PLATFORM ($ARCH_SUFFIX)"
info "Fetching latest release from GitHub..."

RELEASE_JSON=$(curl -fsSL "$API_URL")
VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')
info "Latest version: $VERSION"

if [ "$PLATFORM" = "mac" ]; then
  ASSET_PATTERN="${ARCH_SUFFIX}\.dmg"
  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -iE "$ASSET_PATTERN" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')

  if [ -z "$DOWNLOAD_URL" ]; then
    error "Could not find macOS DMG for $ARCH_SUFFIX in release $VERSION"
  fi

  TMPFILE=$(mktemp /tmp/bcadmin-XXXXXX.dmg)
  info "Downloading $DOWNLOAD_URL..."
  curl -fSL -o "$TMPFILE" "$DOWNLOAD_URL"

  info "Mounting DMG..."
  MOUNT_POINT=$(hdiutil attach "$TMPFILE" -nobrowse | tail -1 | awk -F'\t' '{print $NF}')

  if [ -d "/Applications/Broadcaster Administrator.app" ]; then
    warn "Removing existing /Applications/Broadcaster Administrator.app..."
    rm -rf "/Applications/Broadcaster Administrator.app"
  fi

  info "Installing to /Applications..."
  APP_NAME=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)
  if [ -z "$APP_NAME" ]; then error "No .app found in DMG"; fi
  cp -R "$APP_NAME" /Applications/

  hdiutil detach "$MOUNT_POINT" -quiet
  rm -f "$TMPFILE"

  info "bcadmin $VERSION installed to /Applications/Broadcaster Administrator.app"
  info "Run: open /Applications/Broadcaster Administrator.app"

elif [ "$PLATFORM" = "linux" ]; then
  ASSET_PATTERN="${ARCH_SUFFIX}.*\.AppImage"
  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -iE "$ASSET_PATTERN" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')

  if [ -z "$DOWNLOAD_URL" ]; then
    error "Could not find Linux AppImage for $ARCH_SUFFIX in release $VERSION"
  fi

  INSTALL_DIR="${HOME}/.local/bin"
  mkdir -p "$INSTALL_DIR"

  info "Downloading $DOWNLOAD_URL..."
  curl -fSL -o "${INSTALL_DIR}/bcadmin" "$DOWNLOAD_URL"
  chmod +x "${INSTALL_DIR}/bcadmin"

  info "bcadmin $VERSION installed to ${INSTALL_DIR}/bcadmin"

  if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    warn "Add ${INSTALL_DIR} to your PATH if not already present"
  fi
fi

info "Done!"
