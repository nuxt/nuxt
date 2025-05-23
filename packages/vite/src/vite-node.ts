import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { type App, createApp, createError, defineEventHandler, toNodeListener } from 'h3'
import { isAbsolute, join, normalize, resolve } from 'pathe'
// import { addDevServerHandler } from '@nuxt/kit'
import { isFileServingAllowed } from 'vite'
import type { ModuleNode, ViteDevServer, Plugin as VitePlugin } from 'vite'
import { getQuery } from 'ufo'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import type { Nuxt } from '@nuxt/schema'
import { distDir } from './dirs'
import { isCSS } from './utils'
import { resolveClientEntry, resolveServerEntry } from './utils/config'

// TODO: Remove this in favor of registerViteNodeMiddleware
// after Nitropack or h3 allows adding middleware after setup
export function ViteNodePlugin (nuxt: Nuxt): VitePlugin {
  // Store the invalidates for the next rendering
  const invalidates = new Set<string>()

  function markInvalidate (mod: ModuleNode) {
    if (!mod.id) { return }
    if (invalidates.has(mod.id)) { return }
    invalidates.add(mod.id)
    markInvalidates(mod.importers)
  }

  function markInvalidates (mods?: ModuleNode[] | Set<ModuleNode>) {
    if (!mods) { return }
    for (const mod of mods) {
      markInvalidate(mod)
    }
  }

  return {
    name: 'nuxt:vite-node-server',
    enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    configureServer (clientServer) {
      const app = createApp()

      clientServer.middlewares.use('/__nuxt_vite_node__', toNodeListener(app))

      app.use('/manifest', defineEventHandler(() => {
        const manifest = getManifest(nuxt, clientServer, resolveClientEntry(clientServer.config))
        return manifest
      }))

      app.use('/invalidates', defineEventHandler(() => {
        const ids = Array.from(invalidates)
        invalidates.clear()
        return ids
      }))

      nuxt.hook('vite:serverCreated', (ssrServer, ctx) => {
        if (ctx.isServer) {
          registerSSRHandlers(app, ssrServer, clientServer)
        }
      })

      // invalidate changed virtual modules when templates are regenerated
      nuxt.hook('app:templatesGenerated', (_app, changedTemplates) => {
        for (const template of changedTemplates) {
          const mods = clientServer.moduleGraph.getModulesByFile(`virtual:nuxt:${encodeURIComponent(template.dst)}`)

          for (const mod of mods || []) {
            markInvalidate(mod)
          }
        }
      })

      clientServer.watcher.on('all', (event, file) => {
        invalidates.add(file)
        markInvalidates(clientServer.moduleGraph.getModulesByFile(normalize(file)))
      })
    },
  }
}

// TODO: Use this when Nitropack or h3 allows adding middleware after setup
// export function registerViteNodeMiddleware (ctx: ViteBuildContext) {
//   addDevServerHandler({
//     route: '/__nuxt_vite_node__/',
//     handler: createViteNodeApp(ctx).handler,
//   })
// }

function getManifest (nuxt: Nuxt, clientServer: ViteDevServer, clientEntry: string) {
  const css = new Set<string>()
  for (const key of clientServer.moduleGraph.urlToModuleMap.keys()) {
    if (isCSS(key)) {
      const query = getQuery(key)
      if ('raw' in query) { continue }
      const importers = clientServer.moduleGraph.urlToModuleMap.get(key)?.importers
      if (importers && [...importers].every(i => i.id && 'raw' in getQuery(i.id))) {
        continue
      }
      css.add(key)
    }
  }

  const manifest = normalizeViteManifest({
    '@vite/client': {
      file: '@vite/client',
      css: [...css],
      module: true,
      isEntry: true,
    },
    ...nuxt.options.features.noScripts === 'all'
      ? {}
      : {
          [clientEntry]: {
            file: clientEntry,
            isEntry: true,
            module: true,
            resourceType: 'script',
          },
        },
  })

  return manifest
}

function registerSSRHandlers (app: App, ssrServer: ViteDevServer, clientServer: ViteDevServer) {
  const RESOLVE_RE = /^\/(?<id>[^?]+)(?:\?importer=(?<importer>.*))?$/
  app.use('/resolve', defineEventHandler(async (event) => {
    const { id, importer } = event.path.match(RESOLVE_RE)?.groups || {}
    if (!id || !ssrServer) {
      throw createError({ statusCode: 400 })
    }
    return await ssrServer.pluginContainer.resolveId(decodeURIComponent(id), importer ? decodeURIComponent(importer) : undefined).catch(() => null)
  }))

  app.use('/module', defineEventHandler(async (event) => {
    const moduleId = decodeURI(event.path).substring(1)
    if (moduleId === '/' || !ssrServer) {
      throw createError({ statusCode: 400 })
    }
    // TODO: replace
    if (isAbsolute(moduleId) && !isFileServingAllowed(ssrServer.config, moduleId)) {
      throw createError({ statusCode: 403 /* Restricted */ })
    }

    const module = await ssrServer.environments.ssr.fetchModule(moduleId).catch(async (err) => {
      const errorData = {
        code: 'VITE_ERROR',
        id: moduleId,
        stack: '',
        ...err,
      }

      if (!errorData.frame && errorData.code === 'PARSE_ERROR') {
        errorData.frame = await clientServer.transformRequest(moduleId).then(res => `${err.message || ''}\n${res?.code}`).catch(() => undefined)
      }
      throw createError({ data: errorData })
    })
    return module
  }))
}

export type ViteNodeServerOptions = {
  baseURL: string
  root: string
  entryPath: string
  base: string
}

export async function initViteNodeServer (nuxt: Nuxt, ssrServer: ViteDevServer) {
  // Serialize and pass vite-node runtime options
  const viteNodeServerOptions = {
    baseURL: `${nuxt.options.devServer.url}__nuxt_vite_node__`,
    root: nuxt.options.srcDir,
    entryPath: resolveServerEntry(ssrServer.config),
    base: ssrServer.config.base || '/_nuxt/',
  } satisfies ViteNodeServerOptions

  process.env.NUXT_VITE_NODE_OPTIONS = JSON.stringify(viteNodeServerOptions)

  const serverResolvedPath = resolve(distDir, 'runtime/vite-node.mjs')
  const manifestResolvedPath = resolve(distDir, 'runtime/client.manifest.mjs')

  await mkdir(join(nuxt.options.buildDir, 'dist/server'), { recursive: true })

  await writeFile(
    resolve(nuxt.options.buildDir, 'dist/server/server.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(serverResolvedPath).href)}`,
  )
  await writeFile(
    resolve(nuxt.options.buildDir, 'dist/server/client.manifest.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(manifestResolvedPath).href)}`,
  )
}
