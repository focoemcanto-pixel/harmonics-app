-- Migration: create automation_meta table
-- Used to persist key/value metadata for the automation system.
-- Current usage: record the timestamp of the last cron execution ('last_cron_run').

CREATE TABLE IF NOT EXISTS automation_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
