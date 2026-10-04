<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/catalog/vehicle_catalog.php';

return [
  'version' => 144,
  'note'=>'R188.5.5.6.84.30: stable server vehicle catalog IDs and client vehicle catalog linkage',
  'run'=>static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_catalog_brands(
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      normalized_name VARCHAR(120) NOT NULL,
      popular TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_vehicle_brand_normalized(normalized_name),
      KEY idx_vehicle_brand_active(active,popular,sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_catalog_models(
      brand_id VARCHAR(80) NOT NULL,
      id VARCHAR(80) NOT NULL,
      name VARCHAR(120) NOT NULL,
      normalized_name VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(brand_id,id),
      UNIQUE KEY uq_vehicle_model_normalized(brand_id,normalized_name),
      KEY idx_vehicle_model_active(brand_id,active,sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_catalog_generations(
      brand_id VARCHAR(80) NOT NULL,
      model_id VARCHAR(80) NOT NULL,
      id VARCHAR(80) NOT NULL,
      name VARCHAR(80) NOT NULL,
      normalized_name VARCHAR(80) NOT NULL,
      year_from SMALLINT UNSIGNED NULL,
      year_to SMALLINT UNSIGNED NULL,
      sort_order INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(brand_id,model_id,id),
      UNIQUE KEY uq_vehicle_generation_normalized(brand_id,model_id,normalized_name),
      KEY idx_vehicle_generation_year(brand_id,model_id,year_from,year_to,active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if(function_exists('kareta_ensure_column')&&function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'client_vehicles')){
      kareta_ensure_column($pdo,'client_vehicles','brand_id',"ALTER TABLE client_vehicles ADD COLUMN brand_id VARCHAR(80) NULL DEFAULT NULL AFTER brand");
      kareta_ensure_column($pdo,'client_vehicles','model_id',"ALTER TABLE client_vehicles ADD COLUMN model_id VARCHAR(80) NULL DEFAULT NULL AFTER model");
      kareta_ensure_column($pdo,'client_vehicles','generation_id',"ALTER TABLE client_vehicles ADD COLUMN generation_id VARCHAR(80) NULL DEFAULT NULL AFTER generation");
    }

    $brandUpsert=$pdo->prepare("INSERT INTO vehicle_catalog_brands(id,name,normalized_name,popular,sort_order,active) VALUES(?,?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name),normalized_name=VALUES(normalized_name),popular=VALUES(popular),sort_order=VALUES(sort_order),active=1");
    $modelUpsert=$pdo->prepare("INSERT INTO vehicle_catalog_models(brand_id,id,name,normalized_name,sort_order,active) VALUES(?,?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name),normalized_name=VALUES(normalized_name),sort_order=VALUES(sort_order),active=1");
    $genUpsert=$pdo->prepare("INSERT INTO vehicle_catalog_generations(brand_id,model_id,id,name,normalized_name,year_from,year_to,sort_order,active) VALUES(?,?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name),normalized_name=VALUES(normalized_name),year_from=VALUES(year_from),year_to=VALUES(year_to),sort_order=VALUES(sort_order),active=1");
    foreach(kareta_vehicle_catalog_seed() as $bi=>$brand){
      $bid=(string)$brand['id'];$brandUpsert->execute([$bid,(string)$brand['name'],kareta_vehicle_catalog_normalize((string)$brand['name']),!empty($brand['popular'])?1:0,$bi]);
      foreach(($brand['models']??[]) as $mi=>$model){
        $mid=(string)$model['id'];$modelUpsert->execute([$bid,$mid,(string)$model['name'],kareta_vehicle_catalog_normalize((string)$model['name']),$mi]);
        foreach(($model['generations']??[]) as $gi=>$gen){$genUpsert->execute([$bid,$mid,(string)$gen['id'],(string)$gen['name'],kareta_vehicle_catalog_normalize((string)$gen['name']),(int)($gen['from']??0)?:null,(int)($gen['to']??0)?:null,$gi]);}
      }
    }

    if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'client_vehicles')){
      foreach(kareta_vehicle_catalog_seed() as $brand){
        $bid=(string)$brand['id'];$bname=(string)$brand['name'];
        $pdo->prepare("UPDATE client_vehicles SET brand_id=? WHERE (brand_id IS NULL OR brand_id='') AND LOWER(TRIM(brand))=LOWER(?)")->execute([$bid,$bname]);
        foreach(($brand['models']??[]) as $model){
          $mid=(string)$model['id'];$mname=(string)$model['name'];
          $pdo->prepare("UPDATE client_vehicles SET model_id=? WHERE brand_id=? AND (model_id IS NULL OR model_id='') AND LOWER(TRIM(model))=LOWER(?)")->execute([$mid,$bid,$mname]);
          foreach(($model['generations']??[]) as $gen){$pdo->prepare("UPDATE client_vehicles SET generation_id=? WHERE brand_id=? AND model_id=? AND (generation_id IS NULL OR generation_id='') AND LOWER(TRIM(generation))=LOWER(?)")->execute([(string)$gen['id'],$bid,$mid,(string)$gen['name']]);}
        }
      }
    }
  },
];
