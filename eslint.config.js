// @ts-check
import {
  defineEslintConfig,
  importConfig,
  javaScriptConfig,
  stylisticConfig,
  typeScriptConfig,
  unicornConfig,
  vueConfig
} from '@nuxt/eslint-config-tooling'

export default defineEslintConfig(
  {
    ignores: ['**/dist', '**/*.tmpl.*', 'sw.js', 'packages/schema/schema']
  },
  javaScriptConfig(),
  vueConfig({
    isTypeScriptEnabled: true
  }),
  typeScriptConfig({
    tsconfigPaths: 'tsconfig.json'
  }),
  unicornConfig(),
  stylisticConfig(),
  importConfig()
)
