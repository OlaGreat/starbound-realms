# Indexer Ledger Lag Runbook

## Overview

The backend indexer listens to contract events from Soroban and writes them to PostgreSQL. If the indexer falls behind (due to RPC outage, database issues, or high event volume), the API will serve stale data and players see outdated game state.

This runbook tells you how to detect lag, diagnose the cause, and recover.

---

## Detecting Lag

### Method 1: Check the Indexer Service (Operational)

SSH to the backend host and check the indexer process:

```bash
systemctl status starbound-indexer
journalctl -u starbound-indexer -f
```

Look for errors in the logs. If the service is running but you see repeated timeouts or connection errors, the indexer is likely stalled.

### Method 2: Check the Ledger Cursor (Authoritative)

Connect to the PostgreSQL database and query the cursor table:

```sql
SELECT * FROM indexer_cursor ORDER BY updated_at DESC LIMIT 1;
```

Output columns:
- `ledger_sequence`: The last ledger the indexer processed
- `updated_at`: Timestamp of the last successful sync
- `contract_id`: Which contract this cursor tracks

**How to interpret:**
- If `updated_at` is more than 2 minutes old, lag is likely.
- If `updated_at` is more than 10 minutes old, lag is severe.

Compare against the current ledger on Soroban RPC:

```bash
curl -X POST https://soroban-testnet.stellar.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0", "id":1, "method":"getLatestLedger"}' | jq '.result.sequence'
```

If the RPC's ledger is significantly ahead of your cursor, the indexer is lagging.

### Method 3: Check the Metrics Endpoint (Optional)

If the backend exposes a `/metrics` endpoint, check the indexer's poll frequency:

```bash
curl http://localhost:3000/metrics | grep indexer
```

Look for a metric like `indexer_last_poll_ms`. If it's consistently growing (e.g., 60000ms instead of the expected 5000ms), the indexer is blocked.

---

## Diagnosing Lag

### Checklist

1. **Is the indexer process running?**
   ```bash
   systemctl status starbound-indexer
   ```
   If stopped, restart it: `systemctl start starbound-indexer`

2. **Are database writes working?**
   ```bash
   psql $DATABASE_URL -c "INSERT INTO test_table (id) VALUES (1);"
   ```
   If this fails, database connectivity or disk space is the issue.

3. **Can the indexer reach Soroban RPC?**
   ```bash
   curl -X POST $SOROBAN_RPC_URL \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0", "id":1, "method":"getLatestLedger"}' 2>&1 | head -20
   ```
   If timeouts or connection refused, RPC is unreachable.

4. **Are there permission errors?**
   ```bash
   journalctl -u starbound-indexer | grep -i "permission\|denied"
   ```

5. **Is disk full?**
   ```bash
   df -h /var/lib/postgresql
   ```

6. **Is memory exhausted?**
   ```bash
   free -h
   ```

### Common Causes

| Symptom | Likely Cause | Fix |
|---|---|---|
| Indexer process dead | Service crashed or was stopped | `systemctl start starbound-indexer` |
| Cursor very old, RPC unreachable | Soroban RPC down | Wait for RPC to recover, or switch to backup RPC |
| Cursor old, database full | Disk exhausted | Add disk space or archive old events |
| Cursor old, permission denied in logs | Database user lacks write permission | Grant `INSERT, UPDATE` on all tables to the indexer user |
| High CPU in indexer process | Event volume spike or N+1 query in processor | Check processor.ts for inefficiencies, restart indexer |

---

## Recovery

### Quick Recovery (Service Restart)

If the indexer is simply stalled:

```bash
systemctl restart starbound-indexer
sleep 5
journalctl -u starbound-indexer -n 20
```

The indexer will resume from the last saved cursor and catch up. This usually takes seconds to minutes depending on lag.

### Partial Recovery (Reset Cursor)

If the cursor is corrupt or pointing to a deleted ledger, manually reset it:

```bash
psql $DATABASE_URL <<SQL
UPDATE indexer_cursor 
SET ledger_sequence = (SELECT MAX(sequence) FROM contract_events) - 1000,
    updated_at = CURRENT_TIMESTAMP
WHERE contract_id = 'C...';
SQL

systemctl restart starbound-indexer
```

This tells the indexer to re-process the last 1000 ledgers. You may see duplicate events in the database briefly; this is acceptable and automatic deduplication handles it.

### Full Recovery (Rebuild Index)

If the database is severely corrupted:

```bash
psql $DATABASE_URL <<SQL
TRUNCATE contract_events, star_systems, battles, fleet_snapshots, resource_events CASCADE;
DELETE FROM indexer_cursor;
SQL

systemctl restart starbound-indexer
```

**Warning:** This loses all historical data. Use only as a last resort. The indexer will crawl the entire contract history from the beginning (can take 30+ minutes depending on network age).

### If RPC is Down

The indexer cannot proceed while Soroban RPC is unavailable. Wait for RPC recovery or switch to a backup RPC:

```bash
export SOROBAN_RPC_URL="https://soroban-testnet-backup.example.com"
systemctl restart starbound-indexer
```

---

## Post-Recovery Validation

After recovery, verify the indexer is healthy:

1. **Check the cursor is advancing:**
   ```bash
   psql $DATABASE_URL -c "SELECT updated_at FROM indexer_cursor ORDER BY updated_at DESC LIMIT 1;"
   ```
   Run this twice, 10 seconds apart. `updated_at` should change.

2. **Check the API reflects current state:**
   ```bash
   curl http://localhost:3000/leaderboard | jq '.[0].systems_owned'
   ```
   The numbers should match your in-game state.

3. **Check logs for errors:**
   ```bash
   journalctl -u starbound-indexer | tail -50 | grep -i "error\|panic"
   ```
   There should be no errors.

---

## Prevention

- **Monitor the cursor regularly:** Set up an alert if `updated_at` is older than 5 minutes.
- **Monitor RPC health:** Ping Soroban RPC every 30 seconds; alert if it fails.
- **Monitor database disk:** Alert if PostgreSQL partition is > 80% full.
- **Monitor indexer memory:** Alert if the process exceeds 1 GB (or your system's limit).

---

## Escalation

If you cannot recover after 30 minutes, contact the maintainers on the project's Slack. Provide:
- Output of `systemctl status starbound-indexer`
- Output of `journalctl -u starbound-indexer -n 100`
- Output of `SELECT * FROM indexer_cursor ORDER BY updated_at DESC LIMIT 1;`
- Output of `SELECT MAX(sequence) FROM contract_events;`
