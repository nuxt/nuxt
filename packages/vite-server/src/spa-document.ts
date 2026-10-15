import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { getServerRuntime } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin, ViteDevServer } from 'vite'

import { distDir } from './dirs.ts'

type DocumentRenderer = (html: string, url: string) => Promise<string>

const RENDERER_PLUGINS_SPECIFIER = 'nuxt/internal/renderer-plugins'

/** Whether the static SPA document is rendered through the renderer plugins. */
export function rendersSpaDocument (nuxt: Nuxt): boolean {
  return nuxt.options.ssr === false && nuxt.options._rendererPlugins.length > 0
}

/**
 * Renders the static SPA document through the `render:html` hooks of the renderer plugins,
 * as a prerendered route: once per build, for the base URL. The plugins are built in the
 * ssr environment, which a static SPA otherwise skips. In development the document is
 * rendered for each navigation.
 */
export function SpaDocumentPlugins (nuxt: Nuxt): Plugin[] {
  const entry = resolve(distDir, 'runtime/spa-document')
  const outDir = resolve(nuxt.options.buildDir, 'vite-server/spa-document')
  const serverRuntime = getServerRuntime({ phase: nuxt.options.dev ? 'server' : 'prerender' }, nuxt)
  const rendererPlugins = serverRuntime.modules[RENDERER_PLUGINS_SPECIFIER]!
  const prefix = '\0nuxt-server-runtime:'

  let server: ViteDevServer | undefined
  let render: Promise<DocumentRenderer> | undefined

  return [
    {
      name: 'nuxt:vite-server:spa-document-environment',
      configureServer (devServer) {
        server = devServer
      },
      configEnvironment (name, config) {
        if (name !== 'ssr') { return }

        config.define = { ...config.define, ...serverRuntime.defines }
        if (nuxt.options.dev) { return }

        // mutated rather than returned: vite merges what a plugin returns, and the app
        // entry has to be dropped from the input rather than merged with
        config.build ||= {}
        config.build.outDir = outDir
        config.build.emptyOutDir = true
        config.build.rolldownOptions ||= {}
        config.build.rolldownOptions.input = { index: entry }
        config.build.rolldownOptions.output = { ...config.build.rolldownOptions.output, entryFileNames: 'index.mjs' }

        // imported from the build directory, where its dependencies may not resolve
        config.resolve ||= {}
        config.resolve.noExternal = true
        config.resolve.external = []
      },
    },
    {
      name: 'nuxt:vite-server:renderer-plugins',
      applyToEnvironment: environment => environment.name === 'ssr',
      resolveId: {
        order: 'pre',
        handler: id => id === RENDERER_PLUGINS_SPECIFIER ? prefix + id : undefined,
      },
      load: {
        order: 'pre',
        async handler (id) {
          if (id === prefix + RENDERER_PLUGINS_SPECIFIER) {
            return { code: await rendererPlugins.code(), map: null }
          }
        },
      },
    },
    {
      name: 'nuxt:vite-server:spa-document',
      applyToEnvironment: environment => environment.name === 'client',
      transformIndexHtml: {
        order: 'post',
        async handler (html, ctx) {
          if (server) {
            const module = await server.ssrLoadModule(entry) as { default: DocumentRenderer }
            return module.default(html, new URL(ctx.originalUrl || ctx.path, 'http://localhost').href)
          }
          render ||= import(pathToFileURL(resolve(outDir, 'index.mjs')).href).then(module => module.default)
          return (await render)(html, new URL(nuxt.options.app.baseURL || '/', 'http://localhost').href)
        },
      },
    },
  ]
}
