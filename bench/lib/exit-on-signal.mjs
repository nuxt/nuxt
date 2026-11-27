// Preloaded into profiled servers: a plain exit lets V8 write the `--cpu-prof` output, which a
// signal-terminated process never does.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(0))
}
