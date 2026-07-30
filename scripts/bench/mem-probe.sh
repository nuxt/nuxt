#!/bin/sh
# Start a dev server against a fixture, exercise it, then dump the per-process
# RSS of the whole tree and (optionally) a heap snapshot of the main process.
#
#   sh scripts/bench/mem-probe.sh .bench/medium 3400 [snapshot]
set -e
FIXTURE=${1:-.bench/medium}
PORT=${2:-3400}
SNAPSHOT=${3:-}

rm -rf "$FIXTURE/.nuxt" "$FIXTURE/node_modules/.cache" "$FIXTURE/node_modules/.vite" node_modules/.vite

NODE_OPTS="--expose-gc"
if [ -n "$SNAPSHOT" ]; then
  NODE_OPTS="$NODE_OPTS --heapsnapshot-signal=SIGUSR2"
fi

NODE_ENV=development NUXT_TELEMETRY_DISABLED=1 NUXT_IGNORE_LOCK=1 FORCE_COLOR=0 \
NODE_OPTIONS="$NODE_OPTS" \
node node_modules/@nuxt/cli/bin/nuxi.mjs dev "$FIXTURE" --no-fork --port "$PORT" --profile verbose > /tmp/mem-probe.log 2>&1 &
PID=$!
echo "dev pid $PID"

until curl -s -o /dev/null "http://localhost:$PORT/__ping__"; do
  sleep 1
  kill -0 $PID 2>/dev/null || { echo "dev server died"; tail -40 /tmp/mem-probe.log; exit 1; }
done

curl -s -o /dev/null "http://localhost:$PORT/"
curl -s -o /dev/null "http://localhost:$PORT/page-7"
sleep 3

echo "--- process tree ---"
node scripts/bench/proc-tree.mjs $PID

if [ -n "$SNAPSHOT" ]; then
  echo "--- heap snapshot ---"
  kill -USR2 $PID
  sleep 20
fi

kill -INT $PID
sleep 5
kill -9 $PID 2>/dev/null || true
echo "report: $FIXTURE/.nuxt/perf-report.json"
