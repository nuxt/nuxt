import { isAbsolute, resolve } from 'pathe'
import { addVitePlugin, directoryToURL, resolveAlias } from '@nuxt/kit'
import type { EnvironmentModuleGraph, Plugin as VitePlugin } from 'vite'
import { toFetchHandler } from 'srvx/node'
import { resolveModulePath } from 'exsolve'
import { getQuery } from 'ufo'
import { nitro as nitroPlugin } from 'nitro/vite'
import escapeRE from 'escape-string-regexp'
import MagicString from 'magic-string'
import remapping from '@ampproject/remapping'

import type { Nitro } from 'nitro/types'
import type { Nuxt, NuxtBuildOutputs } from '@nuxt/schema'

import { NUXT_BUILD_OUTPUT_MAP, distDir } from './utils.ts'

const IS_CSS_RE = /\.(?:css|scss|sass|postcss|pcss|less|stylus|styl)(?:\?[^.]+)?$/

const DEV_CLIENT_CSS_EVENT = 'nuxt:dev-client-css'
const DEV_CLIENT_CSS_SEED = 'nuxt:dev-client-css:seed'

/**
 * Derive the CSS the ssr render touched from the main-process ssr module graph.
 * The graph is the cumulative union of every module the ssr runner has fetched,
 * so this is eventually consistent rather than a strict per-request subset
 * (which nothing tracks).
 */
function collectSsrGraphCss (moduleGraph: EnvironmentModuleGraph): string[] {
  const css = new Set<string>()
  for (const [mod, node] of moduleGraph.urlToModuleMap.entries()) {
    if (!IS_CSS_RE.test(mod) || 'raw' in getQuery(mod)) { continue }
    const importers = node.importers
    if (importers?.size && [...importers].every(i => i.url && 'raw' in getQuery(i.url))) { continue }
    css.add(mod)
  }
  return [...css]
}

/**
 * Resolve `nuxt.options.css` entries to dev-server urls so globally-registered
 * styles are always present in the dev SSR manifest, even before the ssr graph
 * has loaded the component that imports them.
 */
function collectGlobalCss (nuxt: Nuxt): string[] {
  const out: string[] = []
  for (const entry of nuxt.options.css) {
    if (typeof entry !== 'string') { continue }
    const resolved = resolveAlias(entry, nuxt.options.alias)
    if (isAbsolute(resolved)) {
      out.push(resolved)
      continue
    }
    const fromModules = resolveModulePath(resolved, {
      try: true,
      from: nuxt.options.modulesDir.map(d => directoryToURL(d)),
    })
    if (fromModules) {
      out.push('/@fs' + fromModules.replace(/^(?!\/)/, '/'))
    }
  }
  return out
}

/**
 * Set up Nitro as a Vite environment using the `nitro/vite` plugin.
 */
export function setupNitroViteEnvironment (nuxt: Nuxt & { _nitro?: Nitro }, nitro: Nitro): void {
  addVitePlugin(NuxtBuildOutputsPlugin(nuxt))
  addVitePlugin(NitroVirtualBridge(nitro))

  // In dev, feed the CSS the ssr graph has loaded to `@nuxt/nitro-server`'s
  // `dev-client-css` middleware. `devClientCssPlugin` (registered at the root,
  // not via `addVitePlugin`, so its `configureServer` hook runs in the main
  // process) pushes the derived set to the ssr module-runner worker over the
  // env hot channel whenever the graph gains a CSS module. The worker caches
  // the latest set and serves it, unioned with the globally-registered CSS.
  if (nuxt.options.dev) {
    nuxt.options.vite.plugins ||= []
    nuxt.options.vite.plugins.push(DevClientCssPlugin())

    const globalCssCode = JSON.stringify(collectGlobalCss(nuxt))
    // The virtual is evaluated once per importer in the ssr runner, so the
    // cache lives on a worker-scoped `globalThis` property shared across those
    // instances rather than a module-local binding. On eval the worker asks
    // for a seed, so a freshly (re)started runner picks up the CSS the graph
    // already holds without waiting for a new transform.
    nitro.options.virtual['#internal/nuxt/dev-client-css'] = () => [
      `const globalCss = ${globalCssCode}`,
      `const store = (globalThis.__nuxtDevClientCss__ ??= { css: [] })`,
      `if (import.meta.hot) {`,
      `  import.meta.hot.on(${JSON.stringify(DEV_CLIENT_CSS_EVENT)}, (css) => { store.css = css || [] })`,
      `  import.meta.hot.send(${JSON.stringify(DEV_CLIENT_CSS_SEED)})`,
      `}`,
      'export function getDevClientCss () {',
      '  return [...new Set([...globalCss, ...store.css])]',
      '}',
    ].join('\n')
  }

  // Per-env `buildStart`/`buildEnd` is what causes unimport's plugin-instance
  // ctx to scan auto-import dirs at request time in dev. Without this, the
  // nitro env's plugins (including `unimport`) never get their `buildStart`
  // hook called, so `addServerImportsDir` entries never reach the transform
  // pipeline. The flag is a no-op in build mode.
  if (nuxt.options.dev) {
    nuxt.options.vite.server ||= {}
    nuxt.options.vite.server.perEnvironmentStartEndDuringDev = true
  }

  nuxt.options.vite.plugins ||= []
  nuxt.options.vite.plugins.push(nitroPlugin({
    // reuse the Nitro instance we have created
    _nitro: nitro,
    experimental: {
      vite: {
        services: {
          ssr: {
            entry: resolveModulePath(resolve(distDir, 'runtime/handlers/renderer'), {
              extensions: ['.ts', '.mjs', '.js'],
            }),
          },
        },
      },
    },
  }))

  if (nuxt.options.dev) {
    nuxt.hook('vite:serverCreated', (viteServer, { isServer }) => {
      if (!isServer) { return }

      // Vite's internal handlers for `@vite/client`, `@vite/env` and
      // `@react-refresh` live at the root of the dev server, but Nuxt serves
      // them under `buildAssetsDir`. Without this rewrite they 404 (or get
      // misrouted to the SSR pipeline based on `sec-fetch-dest`), so we drop
      // the prefix before Vite's own middlewares run.
      const buildAssetsDir = nuxt.options.app.buildAssetsDir
      const VITE_ASSET_PREFIX_RE = new RegExp(`^${escapeRE(buildAssetsDir.replace(/\/+$/, ''))}\\/(@vite\\/(?:client|env)|@react-refresh)(?:\\?|$|\\/)`)
      viteServer.middlewares.use((req, _res, next) => {
        if (!req.url) { return next() }
        const match = req.url.match(VITE_ASSET_PREFIX_RE)
        if (match) {
          req.url = '/' + req.url.slice(buildAssetsDir.length).replace(/^\/+/, '')
        }
        next()
      })

      // expose vite server to nuxt/cli
      nuxt.server = {
        handler: viteServer.middlewares,
        fetch: toFetchHandler(viteServer.middlewares),
        reload: () => viteServer.restart(),
        close: () => viteServer.close(),
      }
    })
  }

  // `compiled` is the only Nitro hook that fires after `copyPublicAssets`, so
  // it is where `nitro:build:public-assets` can see the copied assets.
  if (!nuxt.options.dev) {
    // TODO: hook to vite
    nitro.hooks.hook('compiled', () => nuxt.callHook('nitro:build:public-assets', nitro))
  }
}

const VIRTUAL_PREFIX = '\0nuxt-build-output:'
const NITRO_VIRTUAL_PREFIX = '\0nuxt-nitro-virtual:'

/**
 * Build outputs whose value is not final until the ssr environment's own
 * `generateBundle` has run: `SSRStylesPlugin` emits the per-component style
 * chunks and (via `build:manifest`) collects entry ids and suppresses CSS
 * links only at that point, so resolving these in `load()` would lock in stub
 * values. (`build:manifest` cannot fire any earlier: it consumes data that the
 * ssr env's `transform`/`renderChunk` hooks produce.)
 *
 * In a production build `load()` emits a unique string-literal sentinel, which
 * is substituted with the final provider value in the ssr env's
 * `generateBundle`. The sentinel is a string literal so neither Vite's
 * minifier nor Nitro's subsequent inline-and-minify pass can rename or
 * tree-shake it before the substitution runs. Because the sentinel sits in
 * expression position, deferred providers must produce a module body of
 * exactly the form `export default <expression>` (no other statements); the
 * substitution inlines the expression, parenthesised, in its place.
 *
 * `entryChunkName` is excluded: `StableEntryPlugin` finalises it in the client
 * env's `writeBundle`, which completes before the ssr env loads it.
 *
 * `ssrStyles` is deferred because the ssr environment cannot import its own
 * emitted `styles.mjs`; `SSRStylesPlugin` exposes the styles map as a code
 * string referencing the per-component style chunks by output-relative paths,
 * which we inline into the ssr entry where those paths resolve.
 */
const DEFERRED_KEYS = new Set<keyof NuxtBuildOutputs>(['clientManifest', 'clientPrecomputed', 'entryIds', 'ssrStyles'])

function sentinel (specifier: string): string {
  return `__NUXT_BUILD_OUTPUT__${specifier.replace(/\W/g, '_')}__`
}

async function getDeferredExpression (nuxt: Nuxt, key: keyof NuxtBuildOutputs): Promise<string> {
  const code = String(await nuxt.buildOutputs[key]() ?? 'export default {}')
  const body = code.trim().replace(/;$/, '')
  if (!body.startsWith('export default ')) {
    throw new Error(`[nuxt] Deferred build output \`${key}\` must be a module body of the form \`export default <expression>\`.`)
  }
  return body.slice('export default '.length)
}

/**
 * Resolves the `nuxt/*` build-output specifiers for the ssr environment.
 *
 * `nuxt/entry` resolves to its value provider's re-export body. Every other key
 * is deferred to `generateBundle` in a production build (see `DEFERRED_KEYS`),
 * so it picks up values finalised after the ssr env has bundled.
 */
function NuxtBuildOutputsPlugin (nuxt: Nuxt & { _nitro?: Nitro }): VitePlugin {
  return {
    name: 'nuxt:build-outputs',
    // `post` so the deferred substitution in `generateBundle` runs after
    // `SSRStylesPlugin` (`enforce: 'pre'`) has emitted its styles and populated
    // the data that `build:manifest` listeners consume.
    enforce: 'post',
    applyToEnvironment: env => env.name === 'ssr',
    resolveId: {
      order: 'pre',
      handler (id) {
        if (id in NUXT_BUILD_OUTPUT_MAP) {
          return VIRTUAL_PREFIX + id
        }
      },
    },
    load: {
      order: 'pre',
      async handler (id) {
        if (!id.startsWith(VIRTUAL_PREFIX)) { return }
        const specifier = id.slice(VIRTUAL_PREFIX.length)

        const key = NUXT_BUILD_OUTPUT_MAP[specifier]
        if (!key) { return }

        // In a production build, defer keys whose value is only final after the
        // ssr env has bundled. They emit a sentinel here, substituted in
        // `generateBundle`.
        if (!nuxt.options.dev && DEFERRED_KEYS.has(key)) {
          return { code: `export default ${JSON.stringify(sentinel(specifier))}`, map: null }
        }

        const code = await nuxt.buildOutputs[key]()
        return { code: code ?? '', map: null }
      },
    },
    generateBundle: {
      // The deferred providers are only final once this env's own
      // `generateBundle` has run: `post` so it follows `SSRStylesPlugin`'s ssr
      // `generateBundle` and the `ClientManifestPlugin` provider's lazy
      // `build:manifest`.
      order: 'post',
      async handler (_options, bundle) {
        if (nuxt.options.dev || this.environment?.name !== 'ssr') { return }

        const replacements = new Map<string, string>()
        for (const [specifier, key] of Object.entries(NUXT_BUILD_OUTPUT_MAP)) {
          if (!DEFERRED_KEYS.has(key)) { continue }
          replacements.set(sentinel(specifier), `(${await getDeferredExpression(nuxt, key)})`)
        }

        const sourcemap = !!this.environment.config.build.sourcemap
        for (const file of Object.values(bundle)) {
          if (file.type !== 'chunk') { continue }
          let s: MagicString | undefined
          for (const [token, expression] of replacements) {
            for (const quote of ['"', '\''] as const) {
              const literal = quote + token + quote
              const index = file.code.indexOf(literal)
              if (index === -1) { continue }
              s ??= new MagicString(file.code)
              s.overwrite(index, index + literal.length, expression)
            }
          }
          if (!s) { continue }
          if (sourcemap && file.map) {
            const editMap = s.generateMap({ hires: true, source: file.fileName })
            file.map = remapping([editMap as any, file.map as any], () => null) as unknown as typeof file.map
          }
          file.code = s.toString()
        }
      },
    },
  }
}

/**
 * Dev-only: push the CSS the ssr module graph has loaded to the ssr
 * module-runner worker over the env hot channel.
 */
function DevClientCssPlugin (): VitePlugin {
  let push: (() => void) | undefined
  return {
    name: 'nuxt:dev-client-css',
    configureServer (server) {
      const env = server.environments.ssr
      if (!env) { return }
      push = () => env.hot.send(DEV_CLIENT_CSS_EVENT, collectSsrGraphCss(env.moduleGraph))
      env.hot.on(DEV_CLIENT_CSS_SEED, push)
    },
    transform: {
      handler (_code, id) {
        if (this.environment.name === 'ssr' && IS_CSS_RE.test(id)) { push?.() }
      },
    },
  }
}

function NitroVirtualBridge (nitro: Nitro): VitePlugin {
  return {
    name: 'nuxt:nitro-virtual-bridge',
    applyToEnvironment: env => env.name === 'ssr',
    resolveId: {
      order: 'pre',
      handler (id) {
        if (nitro.options.virtual[id]) {
          return NITRO_VIRTUAL_PREFIX + id
        }
      },
    },
    load: {
      order: 'pre',
      async handler (id) {
        if (!id.startsWith(NITRO_VIRTUAL_PREFIX)) { return }
        const specifier = id.slice(NITRO_VIRTUAL_PREFIX.length)
        const entry = nitro.options.virtual[specifier]
        const code = typeof entry === 'function' ? await entry() : entry
        return { code: code ?? '', map: null }
      },
    },
  }
}
