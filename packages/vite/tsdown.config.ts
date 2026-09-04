import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { oxc: true },
  entry: ['src/index', 'src/vite-node', 'src/vite-node-entry', 'src/vite-node-islands-entry', 'src/vite-node-runner', 'src/fix-stacktrace'],
  deps: {
    skipNodeModulesBundle: true,
    onlyBundle: [],
    neverBundle: [
      '@nuxt/schema',
      '#vite-node',
      '#vite-node-runner',
      '#internal/nuxt/vite-node-runner.mjs',
    ],
  },
})
