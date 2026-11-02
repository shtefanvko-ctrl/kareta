#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK="${ANDROID_SDK_ROOT:-$HOME/kareta-android-build/sdk}"
BT="$SDK/build-tools/35.0.0"
WORK="$ROOT/build"
OUT="$ROOT/KARETA-AI-Lite-Android4-v1.0.0.2.apk"
mkdir -p "$WORK/classes" "$WORK/dex" "$WORK/gen"
"$BT/aapt2" compile --dir "$ROOT/app/src/main/res" -o "$WORK/res.zip"
"$BT/aapt2" link -o "$WORK/base.apk" --manifest "$ROOT/app/src/main/AndroidManifest.xml" -I "$SDK/platforms/android-36/android.jar" --min-sdk-version 19 --target-sdk-version 28 --version-code 2 --version-name 1.0.0.2 "$WORK/res.zip"
echo '[1/5] Resources OK'
javac --release 8 -encoding UTF-8 -cp "$SDK/platforms/android-36/android.jar" -d "$WORK/classes" "$ROOT/app/src/main/java/kz/kareta/ailite/MainActivity.java"
"$BT/d8" --min-api 19 --output "$WORK/dex" $(find "$WORK/classes" -name '*.class')
echo '[2/5] Code OK'
cp "$WORK/base.apk" "$WORK/unaligned.apk"
(cd "$WORK/dex" && zip -q "$WORK/unaligned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$WORK/unaligned.apk" "$WORK/aligned.apk"
echo '[3/5] APK packaged'
"$BT/apksigner" sign --min-sdk-version 19 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --ks "$HOME/.android/debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$OUT" "$WORK/aligned.apk"
echo '[4/5] Signed'
"$BT/apksigner" verify --min-sdk-version 19 --verbose "$OUT"
"$BT/aapt" dump badging "$OUT" | head -6
sha256sum "$OUT"
ls -lh "$OUT"
echo '[5/5] PASS'
