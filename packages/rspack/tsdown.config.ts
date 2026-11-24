import { defineConfig } from 'tsdown'
import { failOnInvalidAnnotation } from '../../scripts/tsdown-plugins.ts'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index.ts', 'src/loaders/vue-module-identifier.ts'],
  plugins: [failOnInvalidAnnotation()],
  deps: {
    onlyBundle: [],
    neverBundle: true,
  },
})
