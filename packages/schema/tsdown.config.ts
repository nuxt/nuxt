import { defineConfig } from 'tsdown'
import { failOnInvalidAnnotation } from '../../scripts/tsdown-plugins.ts'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index.ts', 'src/builder-env.ts', 'src/internal.ts'],
  exports: { devExports: true },
  plugins: [failOnInvalidAnnotation()],
  deps: {
    neverBundle: true,
    // `untyped` is not a dependency, so its types are bundled into the declarations.
    dts: { alwaysBundle: ['untyped'] },
  },
})
