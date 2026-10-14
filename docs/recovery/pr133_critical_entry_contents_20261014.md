# PR #133: reject empty critical entry points

Base candidate: c562ea7e385ee8e97b190712eafb4cf4d14fd8b0.

The repository-only feature-preservation gate accepted an empty critical file
because it checked file existence only. Reproduced with 19 isolated fixture files
and one zero-byte entry. The gate now also rejects empty or whitespace-only
contents. Its self-test covers valid contents plus both negative cases without
modifying repository fixtures, and restores its temporary root in a finally block.

Verification before commit: Python syntax PASS; feature-preservation self-test
PASS on the exact base inputs (72 routes, 19 critical files, RU/KK/EN), including
the two new negative cases. No Python coverage configuration or runner is
declared in the inspected repository; coverage percentages are NOT AVAILABLE.

Scope: verification tooling only. Product files, baseline inventory, workflows,
API, DB, UI and Android are unchanged. Static PASS does not prove functional
acceptance. New-head CI is pending until this patch is committed. Live servers,
staging, production and hardware tests NOT RUN / out of scope.

Rollback: revert this two-file increment. Keep PR Draft / DO NOT MERGE.
