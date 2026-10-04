# SERVER 429 / timeout diagnosis

Purpose: prove where a 429/timeout originates before changing limits.

## Correlation contract

Client sends `X-Kareta-Trace-Id`. PHP returns `X-Kareta-Request-Id` and `X-Kareta-Trace-Id`.
Every API request that reaches `api/bootstrap.php` is written to `storage/logs/server-YYYY-MM-DD.jsonl` with:
`requestId`, `traceId`, method, URI/action, status, durationMs, memoryPeak and `slow=true` when duration exceeds 300 ms.

If a browser receives 429 without `X-Kareta-Request-Id`, treat it first as an upstream candidate (nginx/Plesk/ModSecurity/proxy), because PHP may not have executed.

## One-request procedure

1. In browser DevTools copy: timestamp, URL, HTTP status, `X-Kareta-Trace-Id`, `X-Kareta-Request-Id`, `Retry-After`.
2. Search PHP application log by requestId/traceId:
   `grep -R "<ID>" storage/logs/server-*.jsonl storage/logs/db-*.jsonl`
3. Search nginx/Plesk access/error logs for the same timestamp, URI and trace ID if the log format exposes the header.
4. Check PHP-FPM saturation and slow requests.
5. Check MySQL slow queries / process list for the same time window.
6. Only after the emitting layer is identified change rate limits or timeouts.

## nginx / Plesk

Inspect active configuration, not only repository snippets:

`nginx -T 2>&1 | grep -nE "limit_req|limit_conn|fastcgi_read_timeout|proxy_read_timeout|modsecurity|gzip|brotli"`

Plesk hosts may generate config under `/var/www/vhosts/system/<domain>/conf/`; inspect the effective vhost files and Plesk panel settings. Also check ModSecurity/WAF audit logs.

Recommended access-log fields for diagnosis:
request time, upstream response time, status, request URI, remote address, `$http_x_kareta_trace_id`, upstream status.

Do not trust `X-Forwarded-For` blindly. If real-client-IP handling is introduced, accept forwarded headers only from explicitly trusted proxy addresses/ranges.

## PHP-FPM

Check service/unit names for the installed PHP version, then inspect:
- `pm.max_children`
- `pm.max_requests`
- `request_terminate_timeout`
- listen backlog / queue saturation
- slowlog and `request_slowlog_timeout`

Useful commands vary by host:
`systemctl status 'plesk-php*-fpm*' --no-pager`
`journalctl -u <php-fpm-unit> --since "-15 min"`

A full worker pool or queued FastCGI requests can produce timeouts even when application code is syntactically valid.

## MySQL / MariaDB

Check current pressure:
`SHOW FULL PROCESSLIST;`
`SHOW GLOBAL STATUS LIKE 'Threads_connected';`
`SHOW GLOBAL STATUS LIKE 'Threads_running';`

Enable/use slow query logging according to the server policy and inspect requests around the trace timestamp. Application requests above 300 ms are already marked `slow=true` in KARETA server logs.

## Application rate limits currently known

Before changing values, correlate evidence for:
- OTP/challenge: 5/min/IP, 20/hour/IP plus phone/purpose cooldowns.
- `api/client_error.php`: 30/min/IP.
- `api/client_event.php`: 45/min for IP + User-Agent.

These limiters historically use `REMOTE_ADDR`; behind a reverse proxy verify whether PHP sees the real client IP or a shared proxy address.

## Acceptance

A 429 incident is considered diagnosed only when one layer is identified with evidence:
- application limiter,
- nginx/Plesk/ModSecurity,
- PHP-FPM capacity/timeout,
- database latency/lock,
- external network/proxy.

Required evidence: browser traceId/requestId + corresponding server/upstream log line(s). Do not close the incident on inference alone.
