import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { ensureDependencyInstalled } from '@nuxt/kit'
import { readTSConfig, resolveTSConfig } from 'pkg-types'

export async function VitePluginCheckerPlugin (nuxt: Nuxt): Promise<Plugin | undefined> {
  if (!nuxt.options.test && (nuxt.options.typescript.typeCheck === true || (nuxt.options.typescript.typeCheck === 'build' && !nuxt.options.dev))) {
    if (!await ensureDependencyInstalled('vite-plugin-checker', {
      rootDir: nuxt.options.rootDir,
      searchPaths: nuxt.options.modulesDir,
      from: import.meta.url,
    })) {
      return
    }

    const [checker, tsconfigPath] = await Promise.all([
      import('vite-plugin-checker').then(r => r.default),
      resolveTSConfig(nuxt.options.rootDir),
    ])
    const supportsProjects = await readTSConfig(tsconfigPath).then(r => !!(r.references?.length))
    return {
      applyToEnvironment: environment => environment.name === 'client',
      ...checker({
        vueTsc: {
          tsconfigPath,
          buildMode: supportsProjects,
        },
      }),
    }
  }
}
