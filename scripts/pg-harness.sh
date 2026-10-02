#!/bin/bash
# A throwaway Postgres carrying the REAL schema, built by running every
# migration in order.
#
# There was a hand-written scaffold before this. It stood in for the tables a
# new migration touched, and it was wrong: it called the discussion author
# `author_id` (really `author_profile_id`), gave ticket types a `quantity`
# (really `quantity_available`) and made `clubs.slug` a `text` (really
# `citext`). Four functions in 0117 and 0118 were written against those names,
# passed every test, and failed on the first real request. A test against a
# schema you invented tests your invention.
#
#   scripts/pg-harness.sh start     # the server itself, if it is not up
#   scripts/pg-harness.sh build     # from scratch, all migrations
#   scripts/pg-harness.sh apply     # re-apply the newest migrations only
#   scripts/pg-harness.sh psql      # a prompt on it
#
# It never touches Supabase and holds no real data. The data directory lives in
# /tmp, so a restart takes it with it: `start` is here because rediscovering
# the initdb incantation has cost an afternoon twice, and `build` calls it
# rather than failing with a socket error that says nothing about what to do.
set -euo pipefail
cd "$(dirname "$0")/.."
export PGHOST=${PGHOST:-/tmp/fagcpg/sock} PGPORT=${PGPORT:-5599} PGUSER=${PGUSER:-postgres}
PGDATA_DIR=${PGDATA_DIR:-/tmp/fagcpg/data}
DB=${DB:-fagcfull}

prereq() {
  # What Supabase gives you and plain Postgres does not. Deliberately thin:
  # every one of these is a thing the platform provides, never a stand-in for
  # one of our own tables.
  psql -d "$DB" -q -c "create schema if not exists extensions;
    create extension if not exists citext schema public;
    create extension if not exists pg_trgm schema public;
    create extension if not exists unaccent schema public;
    create extension if not exists cube schema public;
    create extension if not exists earthdistance schema public;"
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f scripts/pg-harness-prereq.sql
  # Supabase's real table default, off unless asked for. See the prereq file.
  if [ -n "${PGHARNESS_SUPABASE_GRANTS:-}" ]; then
    psql -d "$DB" -q -c "alter default privileges in schema public
      grant all on tables to anon, authenticated, service_role;"
  fi
}

start() {
  # No -q: Postgres 18 dropped it, and the failure only shows on a machine
  # whose data directory has been thrown away, so it hid behind the `[ -d ]`.
  [ -d "$PGDATA_DIR/base" ] || initdb -D "$PGDATA_DIR" -U postgres -A trust >/dev/null
  pg_isready -q 2>/dev/null && return 0
  mkdir -p "$PGHOST"
  pg_ctl -D "$PGDATA_DIR" -l "$PGDATA_DIR/../log" \
    -o "-k $PGHOST -p $PGPORT -c listen_addresses=''" -w start
}

case "${1:-build}" in
  start) start ;;
  build)
    start
    psql -d postgres -q -c "drop database if exists $DB"
    psql -d postgres -q -c "create database $DB"
    psql -d postgres -q -c "alter database $DB set search_path = public, extensions"
    prereq
    n=0
    for f in supabase/migrations/*.sql; do
      n=$((n+1))
      err=$(psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -i "^psql.*ERROR" | head -1 || true)
      if [ -n "$err" ]; then
        echo "STOP at $(basename "$f") (#$n)"; echo "$err"; exit 1
      fi
    done
    echo "$n migrations applied to $DB"
    ;;
  apply)
    shift
    for f in "$@"; do
      psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
      echo "applied $(basename "$f")"
    done
    ;;
  # ON_ERROR_STOP, because a behaviour test that raises and then carries on
  # still reaches its own "all pass" echo and still exits 0. Twenty-eight of
  # the twenty-nine suites were written that way. psql ignores it on an
  # interactive prompt, so one flag covers both uses.
  psql) shift; exec psql -d "$DB" -v ON_ERROR_STOP=1 "$@" ;;
  *) echo "usage: $0 build|apply <files...>|psql"; exit 2 ;;
esac
