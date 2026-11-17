import { pathToFileURL } from 'node:url'
import type { Nuxt, NuxtBuilder } from '@nuxt/schema'
import type { RsbuildInstance, Rspack } from '@rsbuild/core'
import { createRsbuild } from '@rsbuild/core'
import { setBuildOutput } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { join } from 'pathe'

import { resolveRsbuildConfig } from './config.ts'
import { setupDevServer } from './dev-server.ts'

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const config = await resolveRsbuildConfig(nuxt)

  await nuxt.callHook('rsbuild:config', config)

  const rsbuild = await createRsbuild({
    cwd: config.root,
    callerName: 'nuxt',
    config,
  })

  if (nuxt.options.ssr) {
    setupServerEntry(nuxt, rsbuild)
  }

  if (nuxt.options.dev) {
    await setupDevServer(nuxt, rsbuild)
    return
  }

  await build(rsbuild)
}

/** Provide the `serverEntry` build output from the file emitted for the `server` entry of the `ssr` environment. */
function setupServerEntry (nuxt: Nuxt, rsbuild: RsbuildInstance) {
  let entry: { path: string, fs: typeof import('node:fs') } | undefined
  rsbuild.onAfterEnvironmentCompile(({ environment, stats }) => {
    if (environment.name !== 'ssr' || !stats) {
      return
    }
    const { compilation } = stats
    const file = compilation.entrypoints.get('server')?.getFiles().find(file => /\.[cm]?js$/.test(file))
    if (file && compilation.outputOptions.path) {
      entry = {
        path: join(compilation.outputOptions.path, file),
        fs: compilation.compiler.outputFileSystem as typeof import('node:fs'),
      }
    }
  })

  setBuildOutput('serverEntry', () => {
    if (!entry) {
      return `export default () => { throw new Error('[nuxt] The Rsbuild \`ssr\` environment did not emit a \`server\` entry.') }`
    }
    // in development the bundle is kept in memory
    return nuxt.options.dev
      ? entry.fs.readFileSync(entry.path, 'utf-8')
      : `export { default } from ${JSON.stringify(pathToFileURL(entry.path).href)}`
  }, nuxt)
}

async function build (rsbuild: RsbuildInstance) {
  const failures: Array<{ name: string, stats: Rspack.Stats }> = []
  rsbuild.onAfterEnvironmentCompile(({ environment, stats }) => {
    if (stats?.hasErrors()) {
      failures.push({ name: environment.name, stats })
    }
  })

  try {
    const { close } = await rsbuild.build()
    await close()
  } catch (error) {
    if (!failures.length) {
      throw error
    }

    const names = failures.map(({ name }) => `\`${name}\``)
    throw bundlerDiagnostics.NUXT_B7032({
      environments: names.length > 1 ? `${names.join(' and ')} environments` : `${names[0]} environment`,
      cause: failures.flatMap(({ stats }) => stats.compilation.errors),
    })
  }
}
