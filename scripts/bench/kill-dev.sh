#!/bin/sh
# Kill stray `nuxt dev` processes.
#
# No pkill/killall in slim containers, so walk /proc. Two things this has to get
# right, both learned the hard way:
#
# 1. Match every entrypoint a dev server can start from. The harness spawns
#    `@nuxt/cli/bin/nuxi.mjs`; a manual `./node_modules/.bin/nuxt dev` resolves
#    to `nuxt/bin/nuxt.mjs`. A leftover dev server competes for CPU and keeps
#    writing into the fixture, silently skewing every later measurement.
# 2. Only match processes whose executable is node. Matching on the command line
#    alone also matches the shell that invoked this script, because that shell's
#    command line usually contains the words it is grepping for.
self=$$
for p in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
  [ "$p" = "$self" ] && continue
  [ -r "/proc/$p/cmdline" ] || continue
  cmd=$(tr '\0' '\n' < "/proc/$p/cmdline" 2>/dev/null)
  exe=$(printf '%s\n' "$cmd" | head -1)
  case "$exe" in
    *node|*node.exe) ;;
    *) continue ;;
  esac
  script=$(printf '%s\n' "$cmd" | sed -n 2p)
  case "$script" in
    *nuxi.mjs|*nuxt.mjs) ;;
    *) continue ;;
  esac
  printf '%s\n' "$cmd" | sed -n 3p | grep -qx dev || continue
  kill -9 "$p" 2>/dev/null
done
