import {
  createRenderer,
} from 'vue-bundle-renderer/runtime'
import type { Manifest, PrecomputedData } from 'vue-bundle-renderer'
import { renderToString as _renderToString } from 'vue/server-renderer'
import { propsToString } from '@unhead/vue/server'
import { useRuntimeConfig } from 'nitro/runtime'

import type { NuxtSSRContext } from 'nuxt/app'

// @ts-expect-error virtual file
import { appRootAttrs, appRootTag, appSpaLoaderAttrs, appSpaLoaderTag, spaLoadingTemplateOutside } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import { buildAssetsURL } from '#internal/nuxt/paths'

const APP_ROOT_OPEN_TAG = `<${appRootTag}${propsToString(appRootAttrs)}>`
const APP_ROOT_CLOSE_TAG = `</${appRootTag}>`

// @ts-expect-error file will be produced after app build
const getServerEntry = () => import('#build/dist/server/server.mjs').then(r => r.default || r)

// @ts-expect-error file will be produced after app build
const getClientManifest: () => Promise<Manifest> = () => import('#build/dist/server/client.manifest.mjs')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r) as Promise<Manifest>

// @ts-expect-error file will be produced after app build
const getPrecomputedDependencies: () => Promise<PrecomputedData> = () => import('#build/dist/server/client.precomputed.mjs')
  .then(r => r.default || r)
  .then(r => typeof r === 'function' ? r() : r) as Promise<PrecomputedData>

// -- SSR Renderer --
export const getSSRRenderer = lazyCachedFunction(async () => {
  // Load server bundle
  const createSSRApp = await getServerEntry()
  if (!createSSRApp) { throw new Error('Server bundle is not available') }

  // Load precomputed dependencies
  const precomputed = import.meta.dev ? undefined : await getPrecomputedDependencies()

  // Create renderer
  const renderer = createRenderer(createSSRApp, {
    precomputed,
    manifest: import.meta.dev ? await getClientManifest() : undefined,
    renderToString,
    buildAssetsURL,
  })

  type RenderToStringParams = Parameters<typeof _renderToString>
  async function renderToString (input: RenderToStringParams[0], context: RenderToStringParams[1]) {
    const html = await _renderToString(input, context)
    // In development with vite-node, the manifest is on-demand and will be available after rendering
    if (import.meta.dev && process.env.NUXT_VITE_NODE_OPTIONS) {
      renderer.rendererContext.updateManifest(await getClientManifest())
    }
    return APP_ROOT_OPEN_TAG + html + APP_ROOT_CLOSE_TAG
  }

  return renderer
})

// -- SPA Renderer --
const getSPARenderer = lazyCachedFunction(async () => {
  const precomputed = import.meta.dev ? undefined : await getPrecomputedDependencies()

  // @ts-expect-error virtual file
  const spaTemplate = await import('#spa-template').then(r => r.template).catch(() => '')
    .then((r) => {
      if (spaLoadingTemplateOutside) {
        const APP_SPA_LOADER_OPEN_TAG = `<${appSpaLoaderTag}${propsToString(appSpaLoaderAttrs)}>`
        const APP_SPA_LOADER_CLOSE_TAG = `</${appSpaLoaderTag}>`
        const appTemplate = APP_ROOT_OPEN_TAG + APP_ROOT_CLOSE_TAG
        const loaderTemplate = r ? APP_SPA_LOADER_OPEN_TAG + r + APP_SPA_LOADER_CLOSE_TAG : ''
        return appTemplate + loaderTemplate
      } else {
        return APP_ROOT_OPEN_TAG + r + APP_ROOT_CLOSE_TAG
      }
    })

  // Create SPA renderer and cache the result for all requests
  const renderer = createRenderer(() => () => {}, {
    precomputed,
    manifest: import.meta.dev ? await getClientManifest() : undefined,
    renderToString: () => spaTemplate,
    buildAssetsURL,
  })
  const result = await renderer.renderToString({})

  const renderToString = (ssrContext: NuxtSSRContext) => {
    const config = useRuntimeConfig()
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

function lazyCachedFunction<T> (fn: () => Promise<T>): () => Promise<T> {
  let res: Promise<T> | null = null
  return () => {
    if (res === null) {
      res = fn().catch((err) => { res = null; throw err })
    }
    return res
  }
}

export function getRenderer (ssrContext: NuxtSSRContext) {
  return (process.env.NUXT_NO_SSR || ssrContext.noSSR) ? getSPARenderer() : getSSRRenderer()
}

// @ts-expect-error file will be produced after app build
export const getSSRStyles = lazyCachedFunction((): Promise<Record<string, () => Promise<string[]>>> => import('#build/dist/server/styles.mjs').then(r => r.default || r))
