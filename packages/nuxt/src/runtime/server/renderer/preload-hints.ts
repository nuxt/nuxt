import { getModuleDependencies, getRequestDependencies } from 'vue-bundle-renderer/runtime'
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { joinURL } from 'ufo'
import type { NuxtSSRContext } from '#app/types'
import { NUXT_PRELOAD_MODULES, appId } from 'nuxt/internal/renderer-config'

import { HINTS_PREFIX } from '../../../app/internal/preload-hints-shared'
import type { RouteChunkHints } from '../../../app/internal/preload-hints-shared'

import { addPrerenderRoutes } from './runtime'
import type { RendererEvent } from './runtime'
import type { NuxtRendererInstance } from './instance'

const builds = new WeakMap<object, boolean>()

function hasHints (): boolean {
  const modules = NUXT_PRELOAD_MODULES!
  let known = builds.get(modules)
  if (known === undefined) {
    known = Object.keys(modules.layouts).length > 0 || Object.keys(modules.pages).length > 0
    builds.set(modules, known)
  }
  return known
}

function hintsPath (buildId: string) {
  return `${HINTS_PREFIX}${buildId}.json`
}

const hintsResponses = new WeakMap<RendererContext, string>()

/**
 * The hints are a separate build-scoped response rather than part of every document, as only a
 * prefetch reads them. The `<script>` is written even when the build has nothing to hint: that is
 * how the client tells a build with hints from one without.
 */
export function pushPreloadHints (event: RendererEvent, ssrContext: NuxtSSRContext) {
  const path = hintsPath(ssrContext.runtimeConfig.app.buildId)
  ssrContext.head.push({
    script: [{
      'type': 'application/json',
      'data-nuxt-preload': appId,
      // unhead v3 JSON-stringifies object innerHTML for <script> tags
      'innerHTML': hasHints() ? { url: joinURL(ssrContext.runtimeConfig.app.baseURL, path) } : {},
    }],
  })
  // a static host serves the hints next to the documents that point to them
  if (import.meta.prerender && hasHints()) {
    addPrerenderRoutes(event, path)
  }
}

export async function renderHintsResponse (instance: NuxtRendererInstance, event: RendererEvent): Promise<Response> {
  const runtime = instance.options
  if (event.url.pathname !== hintsPath(runtime.runtimeConfig(event).app.buildId)) {
    return runtime.createResponse(null, { status: 404 })
  }
  // the client manifest is the same for both renderers; the SPA one loads no server entry
  const { rendererContext } = await instance.getRenderer({ noSSR: true } as NuxtSSRContext)
  let body = hintsResponses.get(rendererContext)
  if (body === undefined) {
    const files: RouteChunkHints['files'] = []
    const indices = new Map<string, number>()
    body = JSON.stringify({
      files,
      layouts: resolveChunkHints(rendererContext, Object.entries(NUXT_PRELOAD_MODULES!.layouts), files, indices),
      pages: resolveChunkHints(rendererContext, Object.entries(NUXT_PRELOAD_MODULES!.pages), files, indices),
    } satisfies RouteChunkHints)
    hintsResponses.set(rendererContext, body)
  }
  return runtime.createResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

function resolveChunkHints (rendererContext: RendererContext, modules: ReadonlyArray<readonly [key: string, id: string]>, files: RouteChunkHints['files'], indices: Map<string, number>): Record<string, number[]> {
  const entry = getRequestDependencies({}, rendererContext)
  const chunks: Record<string, number[]> = {}

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
        const file = resource.file
        // module scripts are always requested with CORS, other chunks as the client build requests them
        const mode = NUXT_PRELOAD_MODULES!.crossOrigin ? {} : { noCors: true as const }
        if (resource.resourceType === 'style') {
          files.push({ rel: 'preload', as: 'style', file, ...mode })
        } else if (resource.resourceType === 'script') {
          files.push(resource.module && NUXT_PRELOAD_MODULES!.moduleScripts ? { rel: 'modulepreload', file } : { rel: 'preload', as: 'script', file, ...mode })
        } else {
          continue
        }
        index = files.length - 1
        indices.set(resourceId, index)
      }
      links.push(index)
    }
    // listed even when empty: a module whose chunks all load with the entry has nothing left to fetch
    chunks[key] = links
  }
  return chunks
}
