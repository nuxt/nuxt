import { defineConfig } from 'tsdown'
import { failOnInvalidAnnotation } from '../../scripts/tsdown-plugins.ts'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index', 'src/vite-node', 'src/vite-node-entry', 'src/vite-node-runner', 'src/vite-node-warmup', 'src/ssr-sourcemap'],
  plugins: [failOnInvalidAnnotation()],
  deps: {
    onlyBundle: [],
    neverBundle: true,
  },
  // `deps.neverBundle: true` only covers bare package specifiers and `node_modules`;
  // subpath imports and aliases resolved at Nuxt build time need to stay external too.
  inputOptions: {
    external: [
      '#vite-node',
      '#vite-node-runner',
    ],
  },
})
