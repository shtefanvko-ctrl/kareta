#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK="${ANDROID_SDK_ROOT:-$HOME/kareta-android-build/sdk}"
BT="$SDK/build-tools/35.0.0"
BUILD="$ROOT/manual-build"
mkdir -p "$BUILD/classes" "$BUILD/dex" "$BUILD/gen" "$BUILD/src"
echo '[1/6] Android manifest/resources'
sed 's/<manifest xmlns:android="/<manifest package="kz.kareta.adminassistant" xmlns:android="/' "$ROOT/app/src/main/AndroidManifest.xml" > "$BUILD/AndroidManifest.xml"
"$BT/aapt2" compile --dir "$ROOT/app/src/main/res" -o "$BUILD/res.zip"
"$BT/aapt2" link -o "$BUILD/base.apk" --manifest "$BUILD/AndroidManifest.xml" -I "$SDK/platforms/android-36/android.jar" --min-sdk-version 26 --target-sdk-version 35 --version-code 4 --version-name 1.0.0.3 --java "$BUILD/gen" "$BUILD/res.zip"
echo '[2/6] Java sources'
mkdir -p "$BUILD/src/kz/kareta/adminassistant"
printf '%s\n' 'package kz.kareta.adminassistant;' 'public final class BuildConfig {' ' public static final String CHAT_URL = "https://kareta.kz/ai/";' '}' > "$BUILD/src/kz/kareta/adminassistant/BuildConfig.java"
javac --release 17 -encoding UTF-8 -cp "$SDK/platforms/android-36/android.jar" -d "$BUILD/classes" "$ROOT/app/src/main/java/kz/kareta/adminassistant/MainActivity.java" "$BUILD/src/kz/kareta/adminassistant/BuildConfig.java"
echo '[3/6] DEX'
"$BT/d8" --min-api 26 --output "$BUILD/dex" $(find "$BUILD/classes" -name '*.class')
echo '[4/6] Packaging'
cp "$BUILD/base.apk" "$BUILD/unaligned.apk"
(cd "$BUILD/dex" && zip -q "$BUILD/unaligned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$BUILD/unaligned.apk" "$BUILD/aligned.apk"
echo '[5/6] Signing'
"$BT/apksigner" sign --ks "$HOME/.android/debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$ROOT/KARETA-AI-v1.0.0.3-debug.apk" "$BUILD/aligned.apk"
echo '[6/6] Verification'
"$BT/apksigner" verify --verbose "$ROOT/KARETA-AI-v1.0.0.3-debug.apk"
"$BT/aapt" dump badging "$ROOT/KARETA-AI-v1.0.0.3-debug.apk" | head -6
sha256sum "$ROOT/KARETA-AI-v1.0.0.3-debug.apk"
ls -lh "$ROOT/KARETA-AI-v1.0.0.3-debug.apk"
