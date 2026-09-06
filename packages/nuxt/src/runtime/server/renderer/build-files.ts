import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { createRenderer } from 'vue-bundle-renderer/runtime'
import type { Manifest, PrecomputedData } from 'vue-bundle-renderer'
import { renderToString as _renderToString } from 'vue/server-renderer'
import { propsToString } from '@unhead/vue/server'
import type { App } from 'vue'

import type { NuxtSSRContext } from '#app/types'

import { NUXT_NO_SSR, appRootAttrs, appRootTag, appSpaLoaderAttrs, appSpaLoaderTag, spaLoadingTemplateOutside, spaTemplate } from 'nuxt/internal/renderer-config'
import { lazyCachedFunction } from './cache'
import { rendererDiagnostics } from './diagnostics'
import type { NuxtRendererOptions } from './runtime'

export type Entry = (ssrContext: NuxtSSRContext) => Promise<App>

export const APP_ROOT_OPEN_TAG: string = `<${appRootTag}${propsToString(appRootAttrs)}>`
export const APP_ROOT_CLOSE_TAG: string = `</${appRootTag}>`

const getServerEntry: () => Promise<Entry> = () => import('nuxt/internal/entry').then(r => (r.default || r) as Entry)

const getClientManifest: () => Promise<Manifest> = () => import('nuxt/internal/manifest')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r) as Promise<Manifest>

const getPrecomputedDependencies: () => Promise<PrecomputedData | undefined> = () => import('nuxt/internal/precomputed')
  .then(r => 'default' in r ? r.default : r)
  .then(r => typeof r === 'function' ? r() : r) as Promise<PrecomputedData | undefined>

interface Renderer {
  rendererContext: RendererContext
  renderToString(ssrContext: NuxtSSRContext): Promise<{
    html: string
    renderResourceHeaders: () => Record<string, string>
    renderResourceHints: () => string
    renderStyles: () => string
    renderScripts: () => string
  }>
}

/** The build artifacts a set of renderer options renders with, loaded once per renderer. */
export interface BuildFiles {
  /** The renderer for a request: the SSR renderer, or the SPA shell for a request opted out of it. */
  getRenderer(ssrContext: NuxtSSRContext): Promise<Renderer>
  /** The SSR renderer, for a consumer that renders a document fragment (an island) rather than a route. */
  getSSRRenderer(): Promise<Renderer>
  /** The SSR app factory, which streaming needs directly. */
  getServerApp(): Promise<Entry>
}

/** Load the build artifacts for a set of renderer options, caching each of them on the returned object. */
export function createBuildFiles (options: NuxtRendererOptions): BuildFiles {
  const buildAssetsURL = (...path: string[]) => options.buildAssetsURL(...path)

  // -- SSR Renderer --
  const getSSRRenderer = lazyCachedFunction(async (): Promise<Renderer> => {
    // Load server bundle
    const createSSRApp = await getServerEntry()
    if (!createSSRApp) { throw rendererDiagnostics.NUXT_E8004() }

    // Load precomputed dependencies
    const precomputed = import.meta.dev ? undefined : await getPrecomputedDependencies()

    // Create renderer. `vue-bundle-renderer`'s `CreateApp` is typed against
    // its own `SSRContext`; Nuxt's entry expects the `NuxtSSRContext` shape
    // (a structural superset) which Nuxt populates before invoking the renderer.
    const renderer = createRenderer(createSSRApp as Parameters<typeof createRenderer<App>>[0], {
      precomputed,
      manifest: import.meta.dev ? await getClientManifest() : undefined,
      renderToString,
      buildAssetsURL,
    })

    type RenderToStringParams = Parameters<typeof _renderToString>
    async function renderToString (input: RenderToStringParams[0], context: RenderToStringParams[1]) {
      const html = await _renderToString(input, context)
      // In development with vite-node, the manifest is on-demand and will be available after rendering
      // eslint-disable-next-line no-restricted-globals
      if (import.meta.dev && process.env.NUXT_VITE_NODE_OPTIONS) {
        renderer.rendererContext.updateManifest(await getClientManifest())
      }
      return APP_ROOT_OPEN_TAG + html + APP_ROOT_CLOSE_TAG
    }

    return renderer
  })

  // -- SPA Renderer --
  const getSPARenderer = lazyCachedFunction(async (): Promise<Renderer> => {
    const precomputed = import.meta.dev ? undefined : await getPrecomputedDependencies()

    const template = renderSPATemplate()

    // Create SPA renderer and cache the result for all requests
    const renderer = createRenderer(() => () => {}, {
      precomputed,
      manifest: import.meta.dev ? await getClientManifest() : undefined,
      renderToString: () => template,
      buildAssetsURL,
    })
    const result = await renderer.renderToString({})

    const renderToString = (ssrContext: NuxtSSRContext) => {
      const config = ssrContext.runtimeConfig
      ssrContext.modules ||= new Set<string>()
      ssrContext.payload.serverRendered = false
      ssrContext.config = {
        public: config.public,
        app: config.app,
      }
      return Promise.resolve(result)
    }

    return {
      rendererContext: renderer.rendererContext,
      renderToString,
    }
  })

  return {
    getRenderer: ssrContext => (NUXT_NO_SSR || ssrContext.noSSR) ? getSPARenderer() : getSSRRenderer(),
    getSSRRenderer,
    // Expose the server app factory for streaming (renderToWebStream needs it directly)
    getServerApp: lazyCachedFunction(getServerEntry),
  }
}

function renderSPATemplate () {
  if (spaLoadingTemplateOutside) {
    const APP_SPA_LOADER_OPEN_TAG = `<${appSpaLoaderTag}${propsToString(appSpaLoaderAttrs)}>`
    const APP_SPA_LOADER_CLOSE_TAG = `</${appSpaLoaderTag}>`
    const appTemplate = APP_ROOT_OPEN_TAG + APP_ROOT_CLOSE_TAG
    const loaderTemplate = spaTemplate ? APP_SPA_LOADER_OPEN_TAG + spaTemplate + APP_SPA_LOADER_CLOSE_TAG : ''
    return appTemplate + loaderTemplate
  }
  return APP_ROOT_OPEN_TAG + spaTemplate + APP_ROOT_CLOSE_TAG
}

export const getSSRStyles: () => Promise<Record<string, () => Promise<string[]>>> = lazyCachedFunction((): Promise<Record<string, () => Promise<string[]>>> => import('nuxt/internal/styles').then(r => r.default || r))

export const getInlinedCSS: () => Promise<Record<string, string[][]>> = lazyCachedFunction((): Promise<Record<string, string[][]>> => import('nuxt/internal/styles').then(r => r.inlinedCSS || {}))
