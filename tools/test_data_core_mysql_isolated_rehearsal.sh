#!/usr/bin/env bash
# Disposable MySQL 8.0 QA only. NO shared database connections or production credentials.
set -euo pipefail
if [[ "$(printenv KARETA_ALLOW_ISOLATED_DOCKER_TEST || true)" != "1" ]]; then
  echo "BLOCKED: explicit KARETA_ALLOW_ISOLATED_DOCKER_TEST=1 required" >&2
  exit 2
fi
for tool in docker php sha256sum; do command -v "$tool" >/dev/null || { echo "BLOCKED: missing $tool" >&2; exit 2; }; done
root="$(cd "$(dirname "$0")/.." && pwd -P)"
work="$(mktemp -d /tmp/kareta-db-rehearsal-XXXXXXXX)"
tag="$(basename "$work")"
container="$tag"
volume="$tag"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT
docker volume create "$volume" >/dev/null
root_pwd="$(php -r 'echo bin2hex(random_bytes(18));')"
# No host ports, no network, strict resource bounds, separate ephemeral Docker volume.
docker run -d --name "$container" --network none --cpus 0.6 --memory 512m --pids-limit 128 \
  -e MYSQL_ROOT_PASSWORD="$root_pwd" -v "$volume":/var/lib/mysql \
  mysql:8.0.46 --innodb-buffer-pool-size=32M --max-connections=12 --skip-log-bin >/dev/null
ready=0
for n in $(seq 1 100); do
  if docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=tcp -h 127.0.0.1 -P 3306 --batch --skip-column-names -e "SELECT 1"' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then echo "FAIL: isolated MySQL did not become ready" >&2; exit 1; fi
echo "PASS disposable offline MySQL 8.0 ready; no network or host port"

docker exec -i "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=socket' <<'SQL'
CREATE DATABASE kareta_qa;
CREATE TABLE kareta_qa.db_migrations (version INT NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL);
CREATE USER 'audit'@'127.0.0.1' IDENTIFIED BY 'qa_fixture_readonly';
GRANT SELECT ON kareta_qa.db_migrations TO 'audit'@'127.0.0.1';
CREATE USER 'elevated'@'127.0.0.1' IDENTIFIED BY 'qa_fixture_elevated';
GRANT SELECT, INSERT ON kareta_qa.db_migrations TO 'elevated'@'127.0.0.1';
SQL

php -r '$m=require $argv[1]; foreach($m["files"] as $n=>$v) {printf("INSERT INTO db_migrations (version,checksum) VALUES (%d,%s);\n", $n, var_export($v["checksum"],true));}' \
  "$root/api/migration_manifest.php" > "$work/seed.sql"
docker exec -i "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=socket kareta_qa' < "$work/seed.sql"
echo "PASS seeded 137 synthetic migration metadata rows"

run_php_auditor() {
  docker run --rm --network "container:$container" -v "$root":/app:ro \
    -e "KARETA_MIGRATION_AUDIT_DSN=mysql:host=127.0.0.1;port=3306;dbname=kareta_qa" \
    -e "KARETA_MIGRATION_AUDIT_USER=$1" -e "KARETA_MIGRATION_AUDIT_PASSWORD=$2" \
    --entrypoint php carat-qa-php:8.3-mysql-v1 /app/tools/check_data_core_db_history.php --mysql
}
if ! run_php_auditor audit qa_fixture_readonly > "$work/readonly.json"; then
  php -r '$r=json_decode(file_get_contents($argv[1]),true); echo "READ_ONLY_AUDIT_FAIL_CODES=".implode(",",array_column($r["issues"]??[],"code")).PHP_EOL;' "$work/readonly.json"
  exit 1
fi
php -r '$v=json_decode(file_get_contents($argv[1]),true); if(($v["historyStatus"]??"")!=="PASS"||($v["releaseReady"]??true)!==false||($v["recordedVersions"]??0)!==137){exit(1);}' "$work/readonly.json"
echo "PASS actual PDO MySQL 8.0 SELECT-only audit; 137 applied; release stays denied"

set +e
run_php_auditor elevated qa_fixture_elevated > "$work/elevated.json"
elevated_exit=$?
set -e
php -r '$v=json_decode(file_get_contents($argv[1]),true); if(($v["historyStatus"]??"")!=="FAIL"||!in_array("AUDIT_USER_NOT_SELECT_ONLY",array_column($v["issues"]??[],"code"),true))exit(1);' "$work/elevated.json"
[[ "$elevated_exit" -eq 1 ]] || { echo "FAIL: elevated MySQL account not rejected" >&2; exit 1; }
echo "PASS actual MySQL elevated account rejected before metadata SELECT"

# Test real migration code on artificial profile rows only, never on user data.
docker exec -i "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=socket kareta_qa' <<'SQL'
CREATE TABLE client_first_entry_state (id INT NOT NULL PRIMARY KEY, current_step INT NOT NULL, status VARCHAR(32) NOT NULL);
INSERT INTO client_first_entry_state VALUES (1,3,'in_progress'),(2,4,'in_progress'),(3,4,'completed');
CREATE USER 'fixture_writer'@'127.0.0.1' IDENTIFIED BY 'qa_fixture_writer';
GRANT SELECT, UPDATE ON kareta_qa.client_first_entry_state TO 'fixture_writer'@'127.0.0.1';
SQL

run_real_142() {
  docker run --rm --network "container:$container" -v "$root":/app:ro \
    -e "KARETA_FIXTURE_DSN=mysql:host=127.0.0.1;port=3306;dbname=kareta_qa" \
    --entrypoint php carat-qa-php:8.3-mysql-v1 \
    -r '$pdo = new PDO(getenv("KARETA_FIXTURE_DSN"), "fixture_writer", "qa_fixture_writer", [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]); $migration=require "/app/api/migrations/142_client_first_entry_three_steps.php"; ($migration["run"])($pdo);'
}
snapshot142() {
  docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=socket --batch --skip-column-names kareta_qa -e "SELECT GROUP_CONCAT(CONCAT(id, CHAR(58), current_step) ORDER BY id) FROM client_first_entry_state"'
}
run_real_142
first="$(snapshot142)"
run_real_142
second="$(snapshot142)"
if [[ "$first" != "1:2,2:3,3:3" || "$second" != "1:1,2:2,3:3" ]]; then
  echo "FAIL: replay evidence not as expected (migration 142)" >&2
  exit 1
fi
echo "PASS reproduced migration 142 non-idempotence from original PHP; 1st=$first; 2nd=$second"
echo "BLOCKED: migration 142 replay cannot be authorized for live data"

# Synthetic backup and separate DB restore, no real production snapshot.
docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --protocol=socket -uroot --no-tablespaces --set-gtid-purged=OFF kareta_qa' > "$work/synthetic.sql"
[[ -s "$work/synthetic.sql" ]] || { echo "FAIL: synthetic dump missing" >&2; exit 1; }
docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot -e "CREATE DATABASE kareta_qa_restore"'
docker exec -i "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot kareta_qa_restore' < "$work/synthetic.sql"
original="$(docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=socket --batch --skip-column-names kareta_qa -e "SELECT version, checksum FROM db_migrations ORDER BY version"' | sha256sum | cut -d' ' -f1)"
restored="$(docker exec "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --protocol=socket --batch --skip-column-names kareta_qa_restore -e "SELECT version, checksum FROM db_migrations ORDER BY version"' | sha256sum | cut -d' ' -f1)"
[[ "$original" == "$restored" ]] || { echo "FAIL: migration history differs after synthetic restore" >&2; exit 1; }
echo "PASS synthetic MySQL dump/restore: 137 history rows byte-equivalent"
echo "QA COMPLETE; releaseReady=false; production untouched"
