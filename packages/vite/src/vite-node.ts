import { pathToFileURL } from 'node:url'
import { createApp, createError, defineEventHandler, defineLazyEventHandler, eventHandler, toNodeListener } from 'h3'
import { ViteNodeServer } from 'vite-node/server'
import fse from 'fs-extra'
import { resolve } from 'pathe'
import { addDevServerHandler } from '@nuxt/kit'
import type { ModuleNode, Plugin as VitePlugin } from 'vite'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import { resolve as resolveModule } from 'mlly'
import { distDir } from './dirs'
import type { ViteBuildContext } from './vite'
import { isCSS } from './utils'
import { createIsExternal } from './utils/external'

// TODO: Remove this in favor of registerViteNodeMiddleware
// after Nitropack or h3 fixed for adding middlewares after setup
export function viteNodePlugin (ctx: ViteBuildContext): VitePlugin {
  // Store the invalidates for the next rendering
  const invalidates = new Set<string>()
  function markInvalidate (mod: ModuleNode) {
    if (!mod.id) { return }
    if (invalidates.has(mod.id)) { return }
    invalidates.add(mod.id)
    for (const importer of mod.importers) {
      markInvalidate(importer)
    }
  }

  return {
    name: 'nuxt:vite-node-server',
    enforce: 'post',
    configureServer (server) {
      server.middlewares.use('/__nuxt_vite_node__', toNodeListener(createViteNodeApp(ctx, invalidates)))
      // Invalidate all virtual modules when templates are regenerated
      ctx.nuxt.hook('app:templatesGenerated', () => {
        for (const [id, mod] of server.moduleGraph.idToModuleMap) {
          if (id.startsWith('virtual:')) {
            markInvalidate(mod)
          }
        }
      })
    },
    handleHotUpdate ({ file, server }) {
      const mods = server.moduleGraph.getModulesByFile(file) || []
      for (const mod of mods) {
        markInvalidate(mod)
      }
    }
  }
}

export function registerViteNodeMiddleware (ctx: ViteBuildContext) {
  addDevServerHandler({
    route: '/__nuxt_vite_node__/',
    handler: createViteNodeApp(ctx).handler
  })
}

function getManifest (ctx: ViteBuildContext) {
  const css = Array.from(ctx.ssrServer!.moduleGraph.urlToModuleMap.keys())
    .filter(i => isCSS(i))

  const manifest = normalizeViteManifest({
    '@vite/client': {
      file: '@vite/client',
      css,
      module: true,
      isEntry: true
    },
    [ctx.entry]: {
      file: ctx.entry,
      isEntry: true,
      module: true,
      resourceType: 'script'
    }
  })

  return manifest
}

function createViteNodeApp (ctx: ViteBuildContext, invalidates: Set<string> = new Set()) {
  const app = createApp()

  app.use('/manifest', defineEventHandler(() => {
    const manifest = getManifest(ctx)
    return manifest
  }))

  app.use('/invalidates', defineEventHandler(() => {
    const ids = Array.from(invalidates)
    invalidates.clear()
    return ids
  }))

  app.use('/module', defineLazyEventHandler(() => {
    const viteServer = ctx.ssrServer!
    const node: ViteNodeServer = new ViteNodeServer(viteServer, {
      deps: {
        inline: [
          /\/(nuxt|nuxt3)\//,
          /^#/,
          ...ctx.nuxt.options.build.transpile as string[]
        ]
      },
      transformMode: {
        ssr: [/.*/],
        web: []
      }
    })
    const isExternal = createIsExternal(viteServer, ctx.nuxt.options.rootDir)
    node.shouldExternalize = async (id: string) => {
      const result = await isExternal(id)
      if (result?.external) {
        return resolveModule(result.id, { url: ctx.nuxt.options.modulesDir })
      }
      return false
    }

    return eventHandler(async (event) => {
      const moduleId = decodeURI(event.req.url!).substring(1)
      if (moduleId === '/') {
        throw createError({ statusCode: 400 })
      }
      const module = await node.fetchModule(moduleId).catch((err) => {
        const errorData = {
          code: 'VITE_ERROR',
          id: moduleId,
          stack: '',
          ...err
        }
        throw createError({ data: errorData })
      })
      return module
    })
  }))

  return app
}

export async function initViteNodeServer (ctx: ViteBuildContext) {
  // Serialize and pass vite-node runtime options
  const viteNodeServerOptions = {
    baseURL: `${ctx.nuxt.options.devServer.url}__nuxt_vite_node__`,
    root: ctx.nuxt.options.srcDir,
    entryPath: ctx.entry,
    base: ctx.ssrServer!.config.base || '/_nuxt/'
  }
  process.env.NUXT_VITE_NODE_OPTIONS = JSON.stringify(viteNodeServerOptions)

  const serverResolvedPath = resolve(distDir, 'runtime/vite-node.mjs')
  const manifestResolvedPath = resolve(distDir, 'runtime/client.manifest.mjs')

  await fse.writeFile(
    resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(serverResolvedPath).href)}`
  )
  await fse.writeFile(
    resolve(ctx.nuxt.options.buildDir, 'dist/server/client.manifest.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(manifestResolvedPath).href)}`
  )
}
