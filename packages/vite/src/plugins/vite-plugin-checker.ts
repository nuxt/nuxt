import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { readTSConfig, resolveTSConfig } from 'pkg-types'

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
  ]
}
