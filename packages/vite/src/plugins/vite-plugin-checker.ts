import type { Plugin } from 'vite'
import { type Nuxt, shouldEnableTypeCheck } from '@nuxt/schema'
import { readTSConfig, resolveTSConfig } from 'pkg-types'

export async function VitePluginCheckerPlugin (nuxt: Nuxt, environment?: string): Promise<Array<Plugin | undefined> | undefined> {
  if (shouldEnableTypeCheck(nuxt.options.typescript.typeCheck, { dev: nuxt.options.dev, test: nuxt.options.test })) {
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
