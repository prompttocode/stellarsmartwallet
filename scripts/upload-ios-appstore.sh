#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
WORKSPACE="$MOBILE_DIR/ios/Privy.xcworkspace"
EXPORT_OPTIONS="$MOBILE_DIR/ios/ExportOptions-AppStore.plist"

# Key ID and Issuer ID are identifiers, not the private key. The .p8 remains local.
APPSTORE_KEY_ID="${APPSTORE_KEY_ID:-D7B8DWK8AN}"
APPSTORE_ISSUER_ID="${APPSTORE_ISSUER_ID:-2ddf7746-d4c0-433b-ac06-f22085ff2aa4}"
APPSTORE_KEY_PATH="${APPSTORE_KEY_PATH:-$HOME/Downloads/AuthKey_${APPSTORE_KEY_ID}.p8}"

for command in xcodebuild xcrun; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

for file in "$WORKSPACE" "$EXPORT_OPTIONS" "$APPSTORE_KEY_PATH"; do
  [[ -e "$file" ]] || {
    echo "Missing required file: $file" >&2
    exit 1
  }
done

BUILD_SETTINGS="$(xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme Privy \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -showBuildSettings)"
MARKETING_VERSION="$(awk -F ' = ' '/^[[:space:]]*MARKETING_VERSION = / { print $2; exit }' <<<"$BUILD_SETTINGS")"
BUILD_NUMBER="$(awk -F ' = ' '/^[[:space:]]*CURRENT_PROJECT_VERSION = / { print $2; exit }' <<<"$BUILD_SETTINGS")"

[[ -n "$MARKETING_VERSION" && -n "$BUILD_NUMBER" ]] || {
  echo "Could not determine MARKETING_VERSION/CURRENT_PROJECT_VERSION." >&2
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="$MOBILE_DIR/build/app-store/${MARKETING_VERSION}-${BUILD_NUMBER}-${STAMP}"
ARCHIVE_PATH="$OUTPUT_DIR/Privy.xcarchive"
IPA_DIR="$OUTPUT_DIR/ipa"
IPA_PATH="$IPA_DIR/Privy.ipa"

mkdir -p "$OUTPUT_DIR"

echo "Building version ${MARKETING_VERSION} (${BUILD_NUMBER})..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme Privy \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive

echo "Exporting IPA..."
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$IPA_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

[[ -f "$IPA_PATH" ]] || {
  echo "IPA export did not produce: $IPA_PATH" >&2
  exit 1
}

KEY_DIR="$HOME/.appstoreconnect/private_keys"
TRANSPORTER_KEY="$KEY_DIR/AuthKey_${APPSTORE_KEY_ID}.p8"
BACKUP_KEY=""

cleanup_key() {
  if [[ -n "$BACKUP_KEY" ]]; then
    mv -f "$BACKUP_KEY" "$TRANSPORTER_KEY"
  else
    rm -f "$TRANSPORTER_KEY"
  fi
}
trap cleanup_key EXIT

mkdir -p "$KEY_DIR"
if [[ -f "$TRANSPORTER_KEY" ]]; then
  BACKUP_KEY="$(mktemp "$KEY_DIR/AuthKey_${APPSTORE_KEY_ID}.backup.XXXXXX")"
  cp "$TRANSPORTER_KEY" "$BACKUP_KEY"
fi
cp "$APPSTORE_KEY_PATH" "$TRANSPORTER_KEY"
chmod 600 "$TRANSPORTER_KEY"

echo "Uploading $IPA_PATH to App Store Connect..."
xcrun iTMSTransporter \
  -m upload \
  -assetFile "$IPA_PATH" \
  -apiKey "$APPSTORE_KEY_ID" \
  -apiIssuer "$APPSTORE_ISSUER_ID" \
  -v informational

echo "Upload complete: ${MARKETING_VERSION} (${BUILD_NUMBER})"
echo "IPA: $IPA_PATH"
