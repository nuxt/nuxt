import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { readTSConfig, resolveTSConfig } from 'pkg-types'
import { shouldTypeCheck } from '../utils/type-check.ts'

export async function VitePluginCheckerPlugin (nuxt: Nuxt, environment?: string): Promise<Array<Plugin | undefined> | undefined> {
  if (!nuxt.options.test && shouldTypeCheck(nuxt.options.typescript.typeCheck, nuxt.options.dev)) {
    const [checker, tsconfigPath] = await Promise.all([
      import('vite-plugin-checker').then(r => r.default),
      resolveTSConfig(nuxt.options.rootDir),
    ])
    const supportsProjects = await readTSConfig(tsconfigPath).then(r => !!(r.references?.length))
    const environments = (['client', nuxt.options.ssr ? 'ssr' : undefined] as const).filter(name => environment ? name === environment : !!name)
    return environments.map(envName => ({
      applyToEnvironment: environment => environment.name === envName,
      ...checker({
        vueTsc: {
          tsconfigPath,
          buildMode: supportsProjects,
        },
      }),
    }))
  }
}
