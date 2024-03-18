import { createUnplugin } from 'unplugin'
import { join, resolve } from 'pathe'
import { updateTemplates } from '@nuxt/kit'
import { distDir } from '../../dirs'

interface DetectComponentUsageOptions {
  rootDir: string
  exclude?: Array<RegExp | string>
  detectedComponents: Set<string>
}

export const DetectComponentUsagePlugin = (options: DetectComponentUsageOptions) => createUnplugin(() => {
  const importersToExclude = options?.exclude || []

  const detectComponentUsagePatterns: Array<[importPattern: string | RegExp, name: string]> = [
    [resolve(distDir, 'pages/runtime/page'), 'NuxtPage'],
    [resolve(distDir, 'app/components/nuxt-layout'), 'NuxtLayout']
  ]

  return {
    name: 'nuxt:detect-component-usage',
    enforce: 'pre',
    resolveId (id, importer) {
      if (!importer) { return }
      if (id[0] === '.') {
        id = join(importer, '..', id)
      }
      if (importersToExclude.some(p => typeof p === 'string' ? importer === p : p.test(importer))) { return }

      for (const [pattern, name] of detectComponentUsagePatterns) {
        if (pattern instanceof RegExp ? pattern.test(id) : pattern === id) {
          options.detectedComponents.add(name)
          updateTemplates({ filter: template => template.filename === 'detected-component-usage.mjs' })
        }
      }
      return null
    }
  }
})
