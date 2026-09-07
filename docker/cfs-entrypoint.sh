#!/bin/sh
set -eu

node build/src/main.js &
cfs_pid=$!

forward_signal() {
  kill -TERM "$cfs_pid" 2>/dev/null || true
}
trap forward_signal INT TERM

bootstrap_admin() {
  if [ -z "${TMX_ADMIN_EMAIL:-}" ] && [ -z "${TMX_ADMIN_PASSWORD:-}" ]; then
    return
  fi
  if [ -z "${TMX_ADMIN_EMAIL:-}" ] || [ -z "${TMX_ADMIN_PASSWORD:-}" ]; then
    echo "[bootstrap] TMX_ADMIN_EMAIL and TMX_ADMIN_PASSWORD must be set together" >&2
    return
  fi

  # CFS applies PostgreSQL migrations during startup. Wait for its readiness
  # endpoint before invoking the bundled admin CLI against a fresh database.
  attempts=0
  until node -e "fetch('http://127.0.0.1:' + process.env.APP_PORT + '/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  do
    attempts=$((attempts + 1))
    if ! kill -0 "$cfs_pid" 2>/dev/null; then
      echo "[bootstrap] CFS exited before admin provisioning" >&2
      return
    fi
    if [ "$attempts" -ge 60 ]; then
      echo "[bootstrap] timed out waiting to provision the initial admin" >&2
      return
    fi
    sleep 1
  done

  if node src/scripts/admin-user.mjs list | grep -Fq -- "$TMX_ADMIN_EMAIL"; then
    echo "[bootstrap] admin already exists: $TMX_ADMIN_EMAIL"
    return
  fi

  set -- create --email "$TMX_ADMIN_EMAIL" --password "$TMX_ADMIN_PASSWORD"
  if [ -n "${TMX_ADMIN_PROVIDER_ID:-}" ]; then
    set -- "$@" --provider-id "$TMX_ADMIN_PROVIDER_ID"
  fi
  node src/scripts/admin-user.mjs "$@"
}

bootstrap_admin &
wait "$cfs_pid"
