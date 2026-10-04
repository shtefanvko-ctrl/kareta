# KARETA 84.171 Design Canon — isolated overlay

> **DO NOT MERGE THIS BRANCH DIRECTLY INTO `main`.**
>
> This branch is an integration marker and exact overlay for the recovered full server base `188.5.5.6.84.170`. GitHub `main` is currently on an older lineage and does not contain the complete 84.159–84.170 server history.

## Purpose

Keep the Design Canon work isolated from parallel development while preserving a reproducible, reviewable delta. No existing branch is rebased, force-pushed, merged, or rewritten by this overlay.

## Required base

- Exact base: `KARETA_84.170_PLESK_SERVER_HARDENING_FULL.zip`
- Base runtime: `188.5.5.6.84.170`
- DB target: `138`
- Target runtime after applying overlay: `188.5.5.6.84.171`

## Scope

The overlay changes only the 84.171 design/release contract:

- canonical design tokens and z-index scale;
- Master shell responsive ownership: phone / tablet / desktop;
- one-row six-item Master phone navigation, no `Сегодня`;
- Master Exchange client-style search/filter/card presentation;
- generated Master CSS contract and verifier;
- release/SW/provenance metadata needed for a real 84.171 host test.

It does **not** intentionally change DB schema, API/business logic, Android/native bridge, or the 84.170 server-hardening behavior.

## Files in this branch

- `84.171-design-canon.patch` — exact unified diff from full 84.170 to the verified 84.171 host candidate.
- `84.171-overlay-manifest.json` — SHA-256 before/after contract for all 26 affected files.
- `APPLY_84.171.md` — safe application procedure and abort conditions.

## Parallel-work rule

If another branch changes one of the 26 overlay paths, do not auto-resolve it. Treat that as a conflict requiring reconciliation after host acceptance. Other paths are outside this overlay's ownership.

## Promotion rule

Only after host acceptance passes should this overlay be reconciled into a new canonical release lineage. The correct follow-up is to recover/import the full 84.170 source lineage first, then apply this overlay, then open a normal PR. Do not use this branch as a shortcut around the missing 84.170 Git history.