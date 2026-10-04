<?php
declare(strict_types=1);

return [
    'version' => 141,
    'note' => 'R188.5.5.6.84.24: normalize MASTER first-entry to three parent steps with review inside step 3',
    'run' => static function (PDO $pdo): void {
        if (!function_exists('kareta_table_exists') || !kareta_table_exists($pdo,'master_onboarding_state')) return;
        // Migration 128 historically stored review/completed as step 4. The new UX has
        // only three parent steps; review is a subview of step 3. Preserve status,
        // revision and idempotency while normalizing navigation metadata.
        $pdo->exec("UPDATE master_onboarding_state
          SET current_step=3,
              current_view='master-review',
              draft_json=CASE
                WHEN draft_json IS NULL THEN NULL
                ELSE JSON_SET(draft_json,'$.currentStep',3,'$.currentView','review','$.returnTarget',NULL)
              END,
              updated_at=CURRENT_TIMESTAMP
          WHERE current_step>=4 OR current_view IN ('master-review','review')");
    },
];
