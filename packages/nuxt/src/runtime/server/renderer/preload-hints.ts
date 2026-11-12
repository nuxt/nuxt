import { getModuleDependencies, getRequestDependencies } from 'vue-bundle-renderer/runtime'
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { joinURL } from 'ufo'
import type { NuxtSSRContext } from '#app/types'
import { NUXT_PRELOAD_MODULES, appId } from 'nuxt/internal/renderer-config'

import { PAGE_HINTS_PREFIX } from '../../../app/internal/preload-hints-shared'
import type { ChunkHints } from '../../../app/internal/preload-hints-shared'

import { addPrerenderRoutes } from './runtime'
import type { RendererEvent } from './runtime'
import type { NuxtRendererInstance } from './instance'

/** Whether the build has route components to hint: the same for every render, so worked out once. */
const HAS_PAGE_HINTS = !!NUXT_PRELOAD_MODULES && Object.keys(NUXT_PRELOAD_MODULES.pages).length > 0

function pageHintsPath (buildId: string) {
  return `${PAGE_HINTS_PREFIX}${buildId}.json`
}

const layoutHints = new WeakMap<RendererContext, ChunkHints | null>()
const pageHints = new WeakMap<RendererContext, string>()

/**
 * The scripts and stylesheets each layout needs beyond the entry, for the client to fetch
 * without evaluating or applying them when it cannot yet know which layout will render. They do
 * not depend on the route, so a prerendered SPA shell served for any path carries them.
 *
 * Route components are only hinted for a `<NuxtLink>` prefetch, which is never on the critical
 * path, so rather than growing every document with the number of pages, their hints are a
 * separate build-scoped response the client fetches when it first needs them.
 *
 * The hints are written even when they list nothing. Their presence is how the client tells a
 * build with hints, where a prefetch evaluates nothing, from one without, where it loads what it
 * fetches.
 */
export function pushPreloadHints (event: RendererEvent, ssrContext: NuxtSSRContext, rendererContext: RendererContext) {
  let layouts = layoutHints.get(rendererContext)
  if (layouts === undefined) {
    layouts = resolveChunkHints(rendererContext, Object.entries(NUXT_PRELOAD_MODULES!.layouts))
    layoutHints.set(rendererContext, layouts)
  }
  const pagesPath = pageHintsPath(ssrContext.runtimeConfig.app.buildId)
  ssrContext.head.push({
    script: [{
      'type': 'application/json',
      'data-nuxt-preload': appId,
      // unhead v3 JSON-stringifies object innerHTML for <script> tags
      'innerHTML': {
        files: layouts?.files ?? [],
        layouts: layouts?.chunks ?? {},
        ...HAS_PAGE_HINTS ? { pages: joinURL(ssrContext.runtimeConfig.app.baseURL, pagesPath) } : {},
      },
    }],
  })
  // a static host serves the route component hints next to the documents that point to them
  if (import.meta.prerender && HAS_PAGE_HINTS) {
    addPrerenderRoutes(event, pagesPath)
  }
}

/** Answer a request for the route component hints of this build, or a 404 for another build's. */
export async function renderPageHintsResponse (instance: NuxtRendererInstance, event: RendererEvent): Promise<Response> {
  const runtime = instance.options
  if (event.url.pathname !== pageHintsPath(runtime.runtimeConfig(event).app.buildId)) {
    // a client still running a previous build leaves its route components to the navigation
    return runtime.createResponse(null, { status: 404 })
  }
  // the client manifest is the same for both renderers; the SPA one loads no server entry
  const { rendererContext } = await instance.getRenderer({ noSSR: true } as NuxtSSRContext)
  let body = pageHints.get(rendererContext)
  if (body === undefined) {
    body = JSON.stringify(resolveChunkHints(rendererContext, Object.entries(NUXT_PRELOAD_MODULES!.pages)) ?? { files: [], chunks: {} })
    pageHints.set(rendererContext, body)
  }
  return runtime.createResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

function resolveChunkHints (rendererContext: RendererContext, modules: ReadonlyArray<readonly [key: string, id: string]>): ChunkHints | null {
  const entry = getRequestDependencies({}, rendererContext)
  const hints: ChunkHints = { files: [], chunks: {} }
  const indices = new Map<string, number>()

  for (const [key, id] of modules) {
    const meta = rendererContext.manifest?.[id] ?? rendererContext.precomputed?.modules[id]
    if (!meta) {
      continue
    }
    const { preload, styles } = getModuleDependencies(id, rendererContext)
    // A module whose own script cannot be hinted, such as one a `build:manifest` hook keeps from
    // being preloaded, is left to the navigation rather than fetched in part. webpack and rspack
    // give a module no file of its own, only the chunks it imports.
    const hasScript = meta.file
      ? id in preload || id in entry.scripts
      : Object.values(preload).some(resource => resource.resourceType === 'script')
    if (!hasScript) {
      continue
    }
    const links: number[] = []
    for (const [resourceId, resource] of Object.entries({ ...preload, ...styles })) {
      if (!resource.file || resourceId in entry.preload || resourceId in entry.scripts || resourceId in entry.styles) {
        continue
      }
      let index = indices.get(resourceId)
      if (index === undefined) {
        // Not its URL: where the build assets are served from is runtime config, and the hints
        // of route components are cached for the lifetime of the build.
        const file = resource.file
        // module scripts are always requested with CORS, other chunks as the client build requests them
        const mode = NUXT_PRELOAD_MODULES!.crossOrigin ? {} : { noCors: true as const }
        if (resource.resourceType === 'style') {
          hints.files.push({ rel: 'preload', as: 'style', file, ...mode })
        } else if (resource.resourceType === 'script') {
          hints.files.push(resource.module && NUXT_PRELOAD_MODULES!.moduleScripts ? { rel: 'modulepreload', file } : { rel: 'preload', as: 'script', file, ...mode })
        } else {
          continue
        }
        index = hints.files.length - 1
        indices.set(resourceId, index)
      }
      links.push(index)
    }
    // listed even when empty: a module whose chunks all load with the entry has nothing left to fetch
    hints.chunks[key] = links
  }
  return Object.keys(hints.chunks).length ? hints : null
}
