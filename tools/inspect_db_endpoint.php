<?php
require __DIR__.'/../config.php';
echo json_encode(['host'=>KARETA_DB['host'],'port'=>KARETA_DB['port'],'database'=>KARETA_DB['database'],'configured'=>KARETA_DB_CONFIGURED,'source'=>KARETA_DB_CONFIG_SOURCE],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),PHP_EOL;
