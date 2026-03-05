#!/bin/bash
# Patches the Electron.app bundle in node_modules for macOS dev mode.
# Renames the .app bundle, binary, Info.plist, and icon so macOS dock
# shows the correct app name and icon.
# Called automatically via the "postinstall" npm script.

set -e

DIST_DIR="node_modules/electron/dist"
OLD_APP="$DIST_DIR/Electron.app"
APP_NAME="Broadcaster Administrator"
NEW_APP="$DIST_DIR/$APP_NAME.app"
PATH_FILE="node_modules/electron/path.txt"

if [ ! -d "$OLD_APP" ] && [ ! -d "$NEW_APP" ]; then
  exit 0
fi

# Rename the .app bundle
if [ -d "$OLD_APP" ] && [ ! -d "$NEW_APP" ]; then
  mv "$OLD_APP" "$NEW_APP"
fi

PLIST="$NEW_APP/Contents/Info.plist"
MACOS_DIR="$NEW_APP/Contents/MacOS"
RESOURCES="$NEW_APP/Contents/Resources"

# Read app version from package.json
APP_VERSION=$(node -p "require('./package.json').version")

# Patch Info.plist
plutil -replace CFBundleName -string "$APP_NAME" "$PLIST"
plutil -replace CFBundleDisplayName -string "$APP_NAME" "$PLIST"
plutil -replace CFBundleExecutable -string "$APP_NAME" "$PLIST"
plutil -replace CFBundleIdentifier -string "com.byheads.bcadmin.dev" "$PLIST"
plutil -replace CFBundleShortVersionString -string "$APP_VERSION" "$PLIST"
plutil -replace CFBundleVersion -string "$APP_VERSION" "$PLIST"

# Rename the binary
if [ -f "$MACOS_DIR/Electron" ] && [ ! -f "$MACOS_DIR/$APP_NAME" ]; then
  mv "$MACOS_DIR/Electron" "$MACOS_DIR/$APP_NAME"
fi

# Update path.txt so the electron module finds the renamed binary
printf '%s' "$APP_NAME.app/Contents/MacOS/$APP_NAME" > "$PATH_FILE"

# Copy icon with a new name and update plist reference
if [ -f "build/icon.icns" ]; then
  cp build/icon.icns "$RESOURCES/bcadmin.icns"
  plutil -replace CFBundleIconFile -string "bcadmin" "$PLIST"
  # Remove old icon to prevent caching issues
  rm -f "$RESOURCES/electron.icns"
fi

# Re-sign the app bundle (renaming invalidates the macOS code signature)
codesign --force --deep --sign - "$NEW_APP"

echo "Patched Electron.app → $APP_NAME.app (bundle, binary, plist, icon, codesign)"
