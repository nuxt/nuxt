import { existsSync } from 'node:fs'
import { join } from 'pathe'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { ensureDependencyInstalled, getAddDependencyCommand } from '@nuxt/kit'
import { bundlerDiagnostics, isInsideNodeModules } from '@nuxt/kit/internal'
import { readTSConfig, resolveTSConfig } from 'pkg-types'

export async function VitePluginCheckerPlugin (nuxt: Nuxt): Promise<Plugin[] | undefined> {
  const { typeCheck } = nuxt.options.typescript
  if (nuxt.options.test || !(typeCheck === true || typeCheck === (nuxt.options.dev ? 'dev' : 'build'))) {
    return
  }

  const missing = await ensureDependencyInstalled(['typescript', 'vue-tsc'], {
    rootDir: nuxt.options.rootDir,
    searchPaths: nuxt.options.modulesDir,
    from: import.meta.url,
  })
  if (missing !== true) {
    const diagnostic = {
      deps: missing.map(dep => `\`${dep}\``).join(' and '),
      installCommand: await getAddDependencyCommand(missing, nuxt.options.rootDir, { dev: true }),
      skipped: nuxt.options.dev,
    }
    if (!nuxt.options.dev) {
      throw bundlerDiagnostics.NUXT_B7040(diagnostic, { method: 'error' })
    }
    bundlerDiagnostics.NUXT_B7040(diagnostic)
    return
  }

  const resolvedTsConfig = await resolveTSConfig(nuxt.options.rootDir).catch(() => undefined)
  const rootTsConfig = resolvedTsConfig && !isInsideNodeModules(resolvedTsConfig) ? resolvedTsConfig : undefined
  const tsconfigPath = rootTsConfig ?? join(nuxt.options.typesDir || nuxt.options.buildDir, 'tsconfig.app.json')
  if (!existsSync(tsconfigPath)) {
    const diagnostic = { rootDir: nuxt.options.rootDir, tsconfigPath, skipped: nuxt.options.dev }
    if (!nuxt.options.dev) {
      throw bundlerDiagnostics.NUXT_B7041(diagnostic, { method: 'error' })
    }
    bundlerDiagnostics.NUXT_B7041(diagnostic)
    return
  }

  const [checker, supportsProjects] = await Promise.all([
    import('vite-plugin-checker').then(r => r.default),
    rootTsConfig ? readTSConfig(rootTsConfig).then(r => !!(r.references?.length)) : false,
  ])
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
