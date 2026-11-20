#!/usr/bin/env bash
#
# 本地打 APK（需要已安装 JDK 17+ 与 Android SDK）
#
# 用法：bash scripts/build-apk.sh
# 产物：mobile/android/app/build/outputs/apk/debug/app-debug.apk
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v java >/dev/null 2>&1; then
  echo "✗ 没找到 java。请先安装 JDK：brew install openjdk@17"
  exit 1
fi

if [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] && [ ! -d "$HOME/Library/Android/sdk" ]; then
  echo "✗ 没找到 Android SDK。请安装：brew install --cask android-commandlinetools"
  echo "  然后运行：sdkmanager \"platform-tools\" \"platforms;android-35\" \"build-tools;35.0.0\""
  exit 1
fi

echo "→ 1/3 导出静态包"
bash scripts/build-offline.sh

echo "→ 2/3 同步到 Android 工程"
cd mobile
if [ ! -d android ]; then
  npx cap add android
fi
npx cap sync android

echo "→ 3/3 编译 APK"
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

APK="$ROOT/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK" ]; then
  echo "✓ 完成：$APK"
  ls -lh "$APK"
else
  echo "✗ 没有找到 APK，请检查上面的日志"
  exit 1
fi
