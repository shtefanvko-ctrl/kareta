<?php
$root=dirname(__DIR__);$need=['js/next/pages/admin_workspaces.js','css/next/workspace_admin.css','docs/releases/changelog/CHANGELOG_R188.md'];foreach($need as $f){if(!is_file($root.'/'.$f)){fwrite(STDERR,"missing $f
");exit(1);}}$nav=file_get_contents($root.'/js/next/navigation_core.js');foreach(['organization_service','adminUsers','adminMonitoring'] as $x){if(strpos($nav,$x)===false){fwrite(STDERR,"missing contract $x
");exit(1);}}echo "R188 verifier OK
";
