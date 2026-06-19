import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { oxc: true },
  // `index` is the builder; the `nasti-node*` entries are the dev-SSR runtime modules that
  // execute inside the Nitro process (referenced via the `#nasti-node*` subpath imports).
  entry: [
    'src/index.ts',
    'src/nasti-node.ts',
    'src/nasti-node-runner.ts',
    'src/nasti-node-entry.ts',
  ],
  deps: {
    skipNodeModulesBundle: true,
    onlyBundle: [],
    neverBundle: [
      '@nuxt/schema',
      '@nasti-toolchain/nasti',
      // Resolved at runtime (in Nitro) via this package's `imports` field; keep them
      // external so the dev-SSR entries don't bundle one another.
      '#nasti-node',
      '#nasti-node-runner',
      '#nasti-node-entry',
    ],
  },
})
