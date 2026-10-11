import { relative } from 'node:path'
import { generatedOutputs } from './packages/ui-templates/lib/paths.mjs'

const uiTemplateSources = /^packages\/ui-templates\/(?:templates|lib|public)\//

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
