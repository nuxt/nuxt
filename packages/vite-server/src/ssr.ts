import { resolve } from 'pathe'
import { addTemplate } from '@nuxt/kit'
import { getServerRuntime } from '@nuxt/kit/internal'
import type { NuxtServerRuntime } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import { defu } from 'defu'
import type { Plugin } from 'vite'

import { distDir } from './dirs.ts'
import { spaLoadingTemplate } from './output.ts'

/** The contract version this builder is written against. */
const SUPPORTED_SERVER_RUNTIME_VERSION = 1

/**
 * Stand up the SSR renderer for the vite server build: the modules it renders with, the
 * entry that creates it, and the environment configuration that compiles it.
 *
 * The server environment is the app build's own ssr environment, with its input replaced
 * by the generated entry: the renderer and the SSR app are bundled together, so the app's
 * entry is reached through the renderer rather than emitted on its own.
 */
export function setupSSR (nuxt: Nuxt, outputDir: string): { entry: string, unsupported: string[] } {
  const serverRuntime = getServerRuntime({
    overrides: async () => ({
      spaTemplate: JSON.stringify(await spaLoadingTemplate(nuxt)),
    }),
  }, nuxt)

  if (serverRuntime.version !== SUPPORTED_SERVER_RUNTIME_VERSION) {
    throw new Error(`[nuxt:vite-server] This builder renders with v${SUPPORTED_SERVER_RUNTIME_VERSION} of the Nuxt server runtime contract, and Nuxt provides v${serverRuntime.version}. Update \`@nuxt/vite-server\`.`)
  }

  // prerendering needs a server to crawl the app with, and the renderer's prerender-only
  // capabilities (the payload and shared-data caches) are not provided here
  if (nuxt.options.nitro.static) {
    throw new Error('[nuxt:vite-server] `nuxt generate` is not supported by `@nuxt/vite-server`: it does not prerender. Run `nuxt build` for a server build, or set `ssr: false` for a static SPA.')
  }

  const unsupported = disableUnsupported(nuxt)

  const serverDir = resolve(outputDir, 'server')
  const entry = addServerEntry(nuxt, serverRuntime)

  nuxt.options.vite.plugins ||= []
  nuxt.options.vite.plugins.push(
    ServerEnvironmentPlugin(nuxt, serverRuntime, entry, serverDir),
    BundledVuePlugin(nuxt),
    ServerRuntimeModulesPlugin(serverRuntime),
  )

  return { entry, unsupported }
}

/**
 * The module the server build makes its `{ fetch }` from. Everything it imports is
 * imported by absolute path, so the entry needs no alias of its own to resolve.
 *
 * The node server is only created in a build, where the entry is emitted as
 * `server/index.mjs` beside the `public` directory it serves, and only listens when run as
 * the main module, so a custom server can import `fetch` from it instead.
 */
function addServerEntry (nuxt: Nuxt, serverRuntime: NuxtServerRuntime): string {
  const { dst } = addTemplate({
    filename: 'vite-server/server-entry.mjs',
    write: true,
    getContents: () => [
      `import { createNuxtRenderer } from ${JSON.stringify(serverRuntime.entry)}`,
      `import { useRuntimeConfig } from ${JSON.stringify(resolve(nuxt.options.buildDir, 'vite-server/runtime-config.mjs'))}`,
      `import { createFetchHandler, createRendererOptions } from ${JSON.stringify(resolve(distDir, 'runtime/renderer'))}`,
      `import { createNodeServer, listen } from ${JSON.stringify(resolve(distDir, 'runtime/node'))}`,
      '',
      `const renderer = createNuxtRenderer(createRendererOptions(useRuntimeConfig))`,
      `export const fetch = createFetchHandler(renderer)`,
      '',
      `const server = import.meta.dev ? undefined : createNodeServer({ fetch, publicDir: new URL('../public/', import.meta.url) })`,
      `export default server`,
      '',
      `if (server && import.meta.main) {`,
      `  listen(server)`,
      `}`,
    ].join('\n'),
  })

  return dst
}

/**
 * Configures the environment that renders: the server entry as its only input, the output
 * a deployable expects, and the defines the renderer must be compiled with.
 *
 * The input is replaced rather than added to: the app entry the app build would give this
 * environment is reached through the renderer instead, so building it as an entry of its
 * own would emit a second copy of the app.
 */
function ServerEnvironmentPlugin (nuxt: Nuxt, serverRuntime: NuxtServerRuntime, entry: string, serverDir: string): Plugin {
  return {
    name: 'nuxt:vite-server:server-environment',
    applyToEnvironment: environment => environment.name === 'ssr',
    configEnvironment (name, config) {
      if (name !== 'ssr') { return }

      // `import.meta.prerender` reaching the runtime undefined silently disables payload
      // extraction, so the renderer's defines take precedence over a configured value
      config.define = { ...config.define, ...serverRuntime.defines }

      // dev serves modules from the module graph and resolves dependencies through node
      if (nuxt.options.dev) { return }

      // mutated rather than returned: vite merges what a plugin returns, and the app
      // entry has to be dropped from the input rather than merged with
      config.build ||= {}
      config.build.outDir = serverDir
      config.build.emptyOutDir = true
      config.build.rolldownOptions ||= {}
      config.build.rolldownOptions.input = { index: entry }
      // `nuxt preview` runs `server/index.mjs`, so the entry name is not configurable
      config.build.rolldownOptions.output = {
        ...defu({ chunkFileNames: '_chunks/[name]-[hash].mjs' }, config.build.rolldownOptions.output),
        entryFileNames: 'index.mjs',
      }

      // the output is the deployable: nothing traces `node_modules` into it afterwards, so
      // every dependency is bundled and only node builtins are left as imports
      config.resolve ||= {}
      config.resolve.noExternal = true
      config.resolve.external = []
      // the app builder leaves the specifiers a nitro build resolves for itself external;
      // there is no nitro here to resolve them, and they all resolve through an alias, so
      // the bundle takes them too
      config.build.rolldownOptions.external = []
    },
  }
}

/**
 * Resolves Vue to its bundler builds for the server bundle.
 *
 * Bundling every dependency means resolving Vue ourselves: its `node` export condition is
 * the CommonJS full build, which carries the template compiler the SSR app never calls
 * (~700kB of it, between `vue` and `vue/server-renderer`) and cannot be tree-shaken
 * through cjs interop. The bundler builds are the same runtime without the compiler.
 */
function BundledVuePlugin (nuxt: Nuxt): Plugin {
  const BUNDLER_BUILDS: Record<string, string> = {
    'vue': 'vue/dist/vue.runtime.esm-bundler.js',
    'vue/server-renderer': '@vue/server-renderer/dist/server-renderer.esm-bundler.js',
  }

  return {
    name: 'nuxt:vite-server:bundled-vue',
    // dev resolves Vue through node, and inlining it into the module graph breaks that
    apply: 'build',
    applyToEnvironment: environment => environment.name === 'ssr',
    resolveId: {
      order: 'pre',
      filter: { id: /^vue(?:\/server-renderer)?$/ },
      handler (id, importer) {
        if (nuxt.options.vue.runtimeCompiler) { return }
        return this.resolve(BUNDLER_BUILDS[id]!, importer, { skipSelf: true })
      },
    },
  }
}

/**
 * Resolves the modules the renderer imports for the environment that renders.
 *
 * Every specifier comes from the record, so this plugin never names one: the set is Nuxt's
 * to change. Each body is read when the environment loads it, which is after the client
 * environment has built, so the values it derives from the client build are final.
 */
function ServerRuntimeModulesPlugin (serverRuntime: NuxtServerRuntime): Plugin {
  const prefix = '\0nuxt-server-runtime:'

  return {
    name: 'nuxt:vite-server:server-runtime',
    applyToEnvironment: environment => environment.name === 'ssr',
    resolveId: {
      order: 'pre',
      handler: id => id in serverRuntime.modules ? prefix + id : undefined,
    },
    load: {
      order: 'pre',
      async handler (id) {
        if (!id.startsWith(prefix)) { return }
        const module = serverRuntime.modules[id.slice(prefix.length)]
        return module ? { code: await module.code(), map: null } : undefined
      },
    },
  }
}

/**
 * Turn off what this build cannot render with, and report it for the builder's warning.
 */
function disableUnsupported (nuxt: Nuxt): string[] {
  const unsupported: string[] = []

  // TODO: the styles map is only final in the ssr environment's `generateBundle`, after
  // the renderer's module for it has been loaded in the same build
  if (nuxt.options.features.inlineStyles) {
    nuxt.options.features.inlineStyles = false
    unsupported.push('inlined styles (stylesheets are linked instead)')
  }
  if (nuxt.options.experimental.componentIslands && nuxt.options.experimental.componentIslands !== 'auto') {
    unsupported.push('server components and islands')
  }

  return unsupported
}
