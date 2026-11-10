import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { readTSConfig, resolveTSConfig } from 'pkg-types'

import { ClientEntryImportPlugin } from './client-entry-import.ts'

export async function VitePluginCheckerPlugin (nuxt: Nuxt): Promise<Plugin[] | undefined> {
  const { typeCheck } = nuxt.options.typescript
  if (nuxt.options.test || !(typeCheck === true || typeCheck === (nuxt.options.dev ? 'dev' : 'build'))) {
    return
  }

  const [checker, tsconfigPath] = await Promise.all([
    import('vite-plugin-checker').then(r => r.default),
    resolveTSConfig(nuxt.options.rootDir),
  ])
  const supportsProjects = await readTSConfig(tsconfigPath).then(r => !!(r.references?.length))
  const runtime = ClientEntryImportPlugin('nuxt:type-check', '/@vite-plugin-checker-runtime-entry')
  return [
    {
      applyToEnvironment: environment => environment.name === 'client',
      ...checker({
        vueTsc: {
          tsconfigPath,
          buildMode: supportsProjects,
        },
      }),
    },
    {
      ...runtime,
      applyToEnvironment: environment => environment.name === 'client' && !environment.config.isProduction,
    },
  ]
}
