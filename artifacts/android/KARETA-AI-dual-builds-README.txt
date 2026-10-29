KARETA AI — Android builds 2026-10-29

STANDARD BUILD
File: KARETA-AI-v1.0.0.2-debug.apk
Package: kz.kareta.adminassistant
versionName: 1.0.0.2
versionCode: 3
Minimum Android 8.0 / API 26
Starts at https://chat.kareta.kz/ (not an admin's private chat)
APK SHA256: b632a7187f62177fc65fdc6163cc82310ebf2baa8da1006974f7d01658b13a92
APK signature: v2/v3 verified
The package and debug signing key match the prior v1.0.0.1.

LITE BUILD
File: KARETA-AI-Lite-Android4-v1.0.0.1.apk
Package: kz.kareta.ailite (separately installable)
versionName: 1.0.0.1
versionCode: 1
Minimum Android 4.4 / API 19
Native Android chat UI (does not load modern Open WebUI in old WebView).
Logs in to KARETA AI using an existing email/password account, calls authenticated /api/models and /api/chat/completions API, keeps its session token and chat history in RAM, uses system HTTPS certificate verification with TLS 1.2 enabled if supported.
APK SHA256: 3413da85aa7d6e75eb61399c8625762115fd365a1c0653572404da745adf9054
APK signature: v1/v2/v3 verified, including Android 4.4 JAR signing.
Installed and launched successfully over ADB on connected Android 4.4.4 / API19 device.
Device test did NOT confirm login, real AI response, TLS connectivity, or WhatsApp registration.

KNOWN BLOCKERS
chat.kareta.kz returns Cloudflare HTTP 403 challenge from external access. Existing WhatsApp Hermes connections do not prove real OTP delivery or SSO login. Existing Open WebUI signup is disabled and one user account was observed. Neither APK provides automatic WhatsApp account registration until the secure backend is implemented and tested. Do NOT distribute either as production-ready to friends.
This branch holds only distributable debug APKs and documentation, without modifying main or production.
