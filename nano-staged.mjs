import { relative } from 'node:path'

const uiTemplateSources = /^packages\/ui-templates\/(?:templates|lib|public)\//

// written by the `packages/ui-templates` vite build
const generatedOutputs = [
  'packages/ui-templates/test/__snapshots__/templates.spec.ts.snap',
  'packages/nuxt/src/app/components/error-404.vue',
  'packages/nuxt/src/app/components/error-500.vue',
  'packages/nuxt/src/app/components/welcome.vue',
  'packages/nitro-server/src/runtime/templates/error-500.ts',
  'packages/nitro-server/src/templates/spa-loading-icon.ts',
  'packages/vite-server/src/templates/spa-loading-icon.ts',
  'packages/schema/src/templates/loading.ts',
]

export default ({ filenames } = { filenames: [] }) => {
  const cwd = process.cwd()
  const touchesTemplates = filenames.some(file => uiTemplateSources.test(relative(cwd, file).replace(/\\/g, '/')))

  if (!touchesTemplates) {
    return []
  }

  return [
    'pnpm --filter @nuxt/ui-templates exec vitest run -u',
    `git add ${generatedOutputs.join(' ')}`,
  ]
}
