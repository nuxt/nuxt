import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import { addTemplate, addVitePlugin, getLayerDirectories, logger } from '@nuxt/kit'
import { bundlerDiagnostics, setServerBuild } from '@nuxt/kit/internal'
import { defu } from 'defu'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

import { distDir } from './dirs.ts'
import { DevServerListenerPlugin, setupDevServer } from './dev.ts'
import { BuildEnvironmentsPlugin, DocumentPlugin, EntryImportMapPlugin, documentPath } from './document.ts'
import { writeStaticOutput } from './output.ts'

/**
 * Experimental server builder implemented with Vite alone.
 *
 * It builds the client, emits a document for it, and ships no server of its own: with
 * `ssr: false` that is a complete static SPA. With SSR enabled the server environment is
 * built too, but running it is left to a Vite plugin or a custom server.
 *
 * Features that need a server are therefore unsupported: server routes and middleware,
 * route rules, prerendering, and composables that need a request (such as
 * `useRequestEvent`). Modules work to the extent that they do not require one:
 * `useNitro()` throws and the `nitro:config` / `nitro:init` hooks never fire.
 *
 * TODO: render on the server, by extracting the renderer from `@nuxt/nitro-server` into
 * something both builders can depend on, and exposing it here as a `{ fetch }` entry
 * a plugin-provided target can run. Until then the document carries an
 * `<!--ssr-outlet-->` marker, so a target can supply its own renderer.
 * TODO: skip building the server environment if unclaimed.
 */
export function bundle (nuxt: Nuxt): Promise<void> {
  if (nuxt.options.builder !== '@nuxt/vite-builder') {
    throw new Error('`@nuxt/vite-server` requires the Vite builder.')
  }

  logger.warn('`@nuxt/vite-server` is experimental. It builds with Vite alone and ships no server, so features and modules that need one will not work.')

  if (nuxt.options.ssr !== false) {
    logger.warn('`@nuxt/vite-server` does not render on the server. The server environment is built for a vite plugin or a custom server to run; until one does, the document is served as a client-only shell.')
  }

  warnUnsupported(nuxt)

  const outputDir = resolve(nuxt.options.rootDir, nuxt.options.nitro.output?.dir || '.output')
  const publicDir = resolve(outputDir, 'public')

  setServerBuild({
    name: 'vite',
    label: 'Vite SPA',
    output: { dir: () => outputDir, publicDir: () => publicDir },
    // TODO: report what actually claimed the server, once a target can declare itself
    capabilities: { server: nuxt.options.ssr !== false, dev: true },
    buildsSeparately: false,
    // neither `nitro` nor `nitro/runtime-config` resolves in a build without nitro
    runtime: {
      fetch: resolve(distDir, 'runtime/fetch'),
      runtimeConfig: resolve(nuxt.options.buildDir, 'vite-server/runtime-config.mjs'),
    },
    preview: { staticDir: () => publicDir },
  }, nuxt)

  // There is no server to read runtime config from the environment, so the values known
  // at build time are serialised instead. Only `app` and `public` are included: this
  // module is reachable from the client, where anything else would be a leak.
  addTemplate({
    filename: 'vite-server/runtime-config.mjs',
    write: true,
    getContents: ({ nuxt }) => [
      `const config = ${JSON.stringify({ app: nuxt.options.runtimeConfig.app, public: nuxt.options.runtimeConfig.public })}`,
      `export const useRuntimeConfig = () => globalThis.__NUXT__?.config || config`,
    ].join('\n'),
  })

  // The app manifest is served by nitro from a generated public asset directory.
  nuxt.options.experimental.appManifest = false
  nuxt.options.alias['#app-manifest'] = resolveModulePath('mocked-exports/empty', { from: import.meta.url })

  // Registered at the root rather than through `addVitePlugin`, which scopes plugins to
  // an environment, where an app-level `buildApp` hook is never called.
  nuxt.options.vite.plugins ||= []
  nuxt.options.vite.plugins.push(BuildEnvironmentsPlugin(nuxt), DevServerListenerPlugin(nuxt))

  if (!nuxt.options.dev) {
    // the document is a real HTML build input, so vite links the entry chunk, injects its
    // stylesheets and module preloads, and runs the `transformIndexHtml` hook of every
    // configured plugin over it
    //
    // the client build writes straight into the public directory of the output, so that a
    // target reading the client environment's `outDir` finds the deployable assets there
    const client = defu(nuxt.options.vite.$client, {
      build: {
        outDir: publicDir,
        emptyOutDir: true,
        rolldownOptions: { input: { index: documentPath(nuxt) } },
      },
    })

    // the client output directory belongs to the build rather than to the project: it is
    // the directory `output.publicDir()` reports and the one the output is finished in
    // place from, so a configured value is reported and replaced rather than merged
    if (resolve(nuxt.options.rootDir, client.build.outDir) !== publicDir) {
      bundlerDiagnostics.NUXT_B7024({ outDir: client.build.outDir, publicDir })
      client.build.outDir = publicDir
    }

    // an input that is not a set of named inputs replaces the document rather than adding
    // to it, and takes the app entry with it, so it is reported and replaced too
    const input = client.build.rolldownOptions.input
    if (typeof input !== 'object' || Array.isArray(input)) {
      bundlerDiagnostics.NUXT_B7025({ input: JSON.stringify(input) })
      client.build.rolldownOptions.input = { index: documentPath(nuxt) }
    }

    nuxt.options.vite.$client = client
    addVitePlugin(() => [DocumentPlugin(nuxt), EntryImportMapPlugin()], { server: false })
  }

  if (nuxt.options.dev) {
    setupDevServer(nuxt)
  } else {
    nuxt.hook('build:done', () => writeStaticOutput(nuxt, publicDir))
  }

  return Promise.resolve()
}

function warnUnsupported (nuxt: Nuxt) {
  const unsupported: string[] = []

  if (nuxt.options.serverHandlers.length || getLayerDirectories(nuxt).some(dirs => existsSync(dirs.server))) {
    unsupported.push('server routes and server middleware')
  }
  if (Object.keys(nuxt.options.routeRules || {}).length || Object.keys(nuxt.options.nitro.routeRules || {}).length) {
    unsupported.push('route rules')
  }
  if (nuxt.options.nitro.prerender?.routes?.length || nuxt.options.nitro.prerender?.crawlLinks) {
    unsupported.push('prerendering')
  }
  // @todo serve these in dev: they are h3 handlers, so it needs an h3 app in front of
  // the vite middlewares rather than the plain node listener used today
  if (nuxt.options.dev && nuxt.options.devServerHandlers.length) {
    unsupported.push('dev server handlers')
  }

  if (unsupported.length) {
    logger.warn(`\`@nuxt/vite-server\` builds a static SPA with no server, so ${unsupported.join(', ')} will be ignored.`)
  }
}
