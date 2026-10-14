# PR 133 boot shell regeneration — 2026-10-14

Previous head: 54bf32ef7a04abe6badf77bafb5b19063d2c2059.

Application gates reported a stale generated shell bundle because the mobile Back source had changed without rebuilding its boot bundle.

This increment updates js/boot/runtime_shell_bundle.js using the existing deterministic generator and adds tools/test_mobile_back_bundle_sync.py as a static negative regression check, executed by the feature-preservation workflow.

All twelve other shell source sections are unchanged. No runtime source files, route URLs, API contracts, or existing user-role flows are removed.

Verification required on new exact head: boot bundle freshness and feature preservation. Browser and physical-device acceptance are not run. Keep PR draft and do not merge without independent approval.
