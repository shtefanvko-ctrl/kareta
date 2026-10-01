# Android / WebView / Native Bridge Rules

Load only when a task has a confirmed Android/WebView/native dependency.

## Repository boundary
This repository contains `js/mobile_native_bridge.js` and WebView-facing SPA behavior. Do not infer native Android source exists here unless a concrete repository/file is supplied.

## Invariants
- Web business logic stays in SPA/server; native code owns device capabilities and bridge implementation.
- Bridge changes state old/new method or message shape and compatibility.
- Web fixes are not labeled Android fixes without native/WebView evidence.
- Preserve release/lazy/cache behavior required by WebView.
- For release-sensitive WebView changes, use the active two-pass smoke contract: first pass loads routes; second pass proves warmed navigation without repeated route asset failure/loading unless freshness requires it.

## Scope gate
Without a confirmed bridge/native dependency, keep Android out of the change and report native verification as NOT RUN.
