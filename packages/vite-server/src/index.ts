import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import { addPlugin, addTemplate, addTypeTemplate, addVitePlugin, getLayerDirectories, logger } from '@nuxt/kit'
import { bundlerDiagnostics, setServerBuild } from '@nuxt/kit/internal'
import { defu } from 'defu'
import { resolveModulePath } from 'exsolve'
import type { Nuxt } from '@nuxt/schema'

import { distDir } from './dirs.ts'
import { setupSSR } from './ssr.ts'
import { DevServerListenerPlugin, setupDevServer } from './dev.ts'
import { BuildEnvironmentsPlugin, DocumentPlugin, EntryImportMapPlugin, documentPath } from './document.ts'
import { writeStaticOutput } from './output.ts'

/**
 * Experimental server builder implemented with Vite alone.
 *
 * It builds the client and emits a document for it: with `ssr: false` that is a complete
 * static SPA. With SSR enabled it also builds a server from the Nuxt SSR renderer, whose
 * entry exports a web-standard `{ fetch }` and, on node, serves the static output in
 * front of it.
 *
 * Features that need a server runtime are unsupported: server routes and middleware,
 * route rules, prerendering, and composables that need more of a request than the platform
 * provides. Modules work to the extent that they do not require one: `useNitro()` throws
 * and the `nitro:config` / `nitro:init` hooks never fire.
 */
export function bundle (nuxt: Nuxt): Promise<void> {
  if (nuxt.options.builder !== '@nuxt/vite-builder') {
    throw new Error('`@nuxt/vite-server` requires the Vite builder.')
  }

  const outputDir = resolve(nuxt.options.rootDir, nuxt.options.nitro.output?.dir || '.output')

  // a deploy target resolves its own configuration file, and the paths written inside it,
  // from vite's root, and writes its artifact to the `build.outDir` the environments this
  // builder does not configure inherit; both of Nuxt's defaults for those are inside `srcDir`
  if (nuxt.options.vite.root === nuxt.options.srcDir) {
    nuxt.options.vite.root = nuxt.options.rootDir
  }
  nuxt.options.vite.build ||= {}
  nuxt.options.vite.build.outDir ||= outputDir

  const publicDir = resolve(outputDir, 'public')
  const ssr = nuxt.options.ssr !== false
  const handler = ssr && !nuxt.options.dev ? resolve(outputDir, 'server/index.mjs') : undefined

  setServerBuild({
    name: 'vite',
    label: ssr ? 'Vite server' : 'Vite SPA',
    output: { dir: () => outputDir, publicDir: () => publicDir },
    capabilities: { server: ssr, dev: true },
    buildsSeparately: false,
    // neither `nitro` nor `nitro/runtime-config` resolves in a build without nitro
    runtime: {
      fetch: resolve(distDir, 'runtime/fetch'),
      runtimeConfig: resolve(nuxt.options.buildDir, 'vite-server/runtime-config.mjs'),
      // the emitted entry, which only exists once a build has run
      handler,
    },
    preview: ssr
      ? { command: () => 'node ./server/index.mjs' }
      : { staticDir: () => publicDir },
  }, nuxt)

  const server = ssr ? setupSSR(nuxt, outputDir) : undefined

  if (server) {
    addServerEntryAlias(nuxt, server.handler)
  }

  warnExperimental(nuxt, { ssr, unsupported: server?.unsupported ?? [] })

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
    // shows compile failures and errors the browser raised over the page already open
    addPlugin(resolve(nuxt.options.appDir, 'plugins/dev-error-overlay.client'))
    setupDevServer(nuxt, server?.entry)
  } else {
    nuxt.hook('build:done', () => writeStaticOutput(nuxt, publicDir, { ssr }))
  }

  return Promise.resolve()
}

/**
 * Resolves `#server-entry` to the render as a module for a deploy target's own environment
 * to build, so that the app is compiled with that target's export conditions and nothing
 * spells a path inside the build directory.
 *
 * In development it resolves to a stub answering every request with a 503: the dev server
 * serves the app there, and a target rendering would render from a second module graph.
 */
function addServerEntryAlias (nuxt: Nuxt, entry: string): void {
  nuxt.options.alias['#server-entry'] = nuxt.options.dev ? resolve(distDir, 'runtime/dev-handler') : entry

  addTypeTemplate({
    filename: 'types/server-entry.d.ts',
    getContents: () => [
      `declare module '#server-entry' {`,
      `  export const fetch: (request: Request) => Promise<Response>`,
      `  const handler: { fetch: typeof fetch }`,
      `  export default handler`,
      `}`,
      '',
    ].join('\n'),
  }, { nuxt: true, node: true, shared: true })
}

function warnExperimental (nuxt: Nuxt, build: { ssr: boolean, unsupported: string[] }) {
  const unsupported = [...build.unsupported]

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

  const what = build.ssr
    ? 'renders with the Nuxt SSR renderer and brings no server runtime of its own'
    : 'builds a static SPA and ships no server'

  logger.warn([
    `\`@nuxt/vite-server\` is experimental. It ${what}.`,
    unsupported.length ? ` Unsupported in this build, and ignored: ${unsupported.join(', ')}.` : '',
  ].join(''))
}
