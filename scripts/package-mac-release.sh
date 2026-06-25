#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_NAME="${APP_NAME:-CatDesktopPet}"
BUNDLE_ID="${BUNDLE_ID:-com.desktoppet.CatDesktopPet}"
VERSION="${VERSION:-0.1.0}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
RELEASE_DIR="${RELEASE_DIR:-$ROOT_DIR/release/mac}"
NOTARY_PROFILE="${NOTARY_PROFILE:-CatDesktopPetNotary}"
SIGN_IDENTITY="${SIGN_IDENTITY:-}"
SKIP_SIGN="${SKIP_SIGN:-0}"
SKIP_NOTARIZE="${SKIP_NOTARIZE:-0}"

APP_BUNDLE="$RELEASE_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
INFO_PLIST="$APP_CONTENTS/Info.plist"
DMG_ROOT="$RELEASE_DIR/dmg-root"
DMG_PATH="$RELEASE_DIR/$APP_NAME-mac-arm64.dmg"

detect_sign_identity() {
  security find-identity -v -p codesigning | awk -F '"' '/Developer ID Application/ { print $2; exit }'
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command swift
require_command codesign
require_command hdiutil
require_command xcrun

cd "$ROOT_DIR"

echo "Building $APP_NAME release binary..."
swift build -c release

BINARY_PATH="$ROOT_DIR/.build/arm64-apple-macosx/release/$APP_NAME"
if [[ ! -x "$BINARY_PATH" ]]; then
  BINARY_PATH="$ROOT_DIR/.build/release/$APP_NAME"
fi

if [[ ! -x "$BINARY_PATH" ]]; then
  echo "Could not find built executable for $APP_NAME." >&2
  exit 1
fi

echo "Creating app bundle at $APP_BUNDLE..."
rm -rf "$APP_BUNDLE" "$DMG_ROOT" "$DMG_PATH"
mkdir -p "$APP_MACOS" "$APP_RESOURCES" "$RELEASE_DIR"
cp "$BINARY_PATH" "$APP_MACOS/$APP_NAME"
chmod 755 "$APP_MACOS/$APP_NAME"

cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>$BUILD_NUMBER</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.lifestyle</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

if [[ "$SKIP_SIGN" != "1" ]]; then
  if [[ -z "$SIGN_IDENTITY" ]]; then
    SIGN_IDENTITY="$(detect_sign_identity)"
  fi

  if [[ -z "$SIGN_IDENTITY" ]]; then
    echo "No Developer ID Application signing identity found." >&2
    echo "Install the certificate in Keychain, or set SIGN_IDENTITY explicitly." >&2
    exit 1
  fi

  echo "Signing app bundle with: $SIGN_IDENTITY"
  codesign --force --timestamp --options runtime --sign "$SIGN_IDENTITY" "$APP_BUNDLE"
  codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
else
  echo "Skipping code signing because SKIP_SIGN=1."
fi

echo "Creating DMG at $DMG_PATH..."
mkdir -p "$DMG_ROOT"
cp -R "$APP_BUNDLE" "$DMG_ROOT/"
ln -s /Applications "$DMG_ROOT/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_ROOT" -ov -format UDZO "$DMG_PATH"
rm -rf "$DMG_ROOT"

if [[ "$SKIP_SIGN" != "1" ]]; then
  echo "Signing DMG..."
  codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DMG_PATH"
  codesign --verify --verbose=2 "$DMG_PATH"
fi

if [[ "$SKIP_NOTARIZE" != "1" ]]; then
  echo "Submitting DMG for notarization with keychain profile: $NOTARY_PROFILE"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
else
  echo "Skipping notarization because SKIP_NOTARIZE=1."
fi

echo "Done: $DMG_PATH"
