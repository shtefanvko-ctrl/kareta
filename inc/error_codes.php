<?php
declare(strict_types=1);

/** Stable public error codes. Never reuse a code for a different cause. */
function kareta_error_code_catalog(): array
{
    return [
        'KRT-BOOT-1001'=>['domain'=>'boot','title'=>'Не удалось синхронизировать файлы приложения','patterns'=>['manifest_not_ready','manifest_preflight_failed','failed to fetch','networkerror']],
        'KRT-BOOT-1002'=>['domain'=>'boot','title'=>'Сервер вернул некорректный список файлов','patterns'=>['manifest_invalid_json']],
        'KRT-BOOT-1003'=>['domain'=>'boot','title'=>'Версии приложения не совпадают','patterns'=>['release_mismatch','manifest_release_mismatch']],
        'KRT-BOOT-1004'=>['domain'=>'boot','title'=>'В сборке отсутствуют обязательные файлы','patterns'=>['manifest_scripts_missing','empty_runtime_registry']],
        'KRT-BOOT-1005'=>['domain'=>'boot','title'=>'Не удалось загрузить модуль приложения','patterns'=>['runtime_script_load_failed','runtime_script_failed']],
        'KRT-BOOT-1006'=>['domain'=>'boot','title'=>'Модуль приложения завершился с ошибкой','patterns'=>['runtime_script_execution_failed']],
        'KRT-BOOT-1007'=>['domain'=>'boot','title'=>'Превышено время загрузки приложения','patterns'=>['runtime_script_timeout','manifest_timeout','aborterror','aborted']],
        'KRT-BOOT-1008'=>['domain'=>'boot','title'=>'Не загружены критические стили','patterns'=>['critical_css_missing']],
        'KRT-BOOT-1009'=>['domain'=>'boot','title'=>'Не загружен логотип приложения','patterns'=>['logo_missing']],
        'KRT-BOOT-1010'=>['domain'=>'boot','title'=>'Не все модули приложения запустились','patterns'=>['runtime_modules_incomplete','atomic_failed']],
        'KRT-BOOT-1099'=>['domain'=>'boot','title'=>'Неизвестная ошибка запуска','patterns'=>[]],
    ];
}
