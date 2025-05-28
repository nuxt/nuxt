import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { resolveTSConfig } from 'pkg-types'

export async function VitePluginCheckerPlugin (nuxt: Nuxt): Promise<Array<Plugin | undefined> | undefined> {
  if (!nuxt.options.test && (nuxt.options.typescript.typeCheck === true || (nuxt.options.typescript.typeCheck === 'build' && !nuxt.options.dev))) {
    const [checker, tsconfigPath] = await Promise.all([
      import('vite-plugin-checker').then(r => r.default),
      resolveTSConfig(nuxt.options.rootDir),
    ])
    const environments = ['client', nuxt.options.ssr ? 'ssr' : undefined] as const
    return environments.map(envName => envName && {
      applyToEnvironment: environment => environment.name === envName,
      ...checker({ vueTsc: { tsconfigPath } }),
    })
  }
}
