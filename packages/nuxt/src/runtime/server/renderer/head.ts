import { getQuery as getURLQuery, joinURL } from 'ufo'
import { relative } from 'pathe'
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import type { Link, Script } from '@unhead/vue/types'
import type { NuxtSSRContext } from '#app/types'
import { NUXT_HAS_NO_SCRIPTS_ROUTES, NUXT_INLINE_STYLES, NUXT_JSON_PAYLOADS, NUXT_NO_SCRIPTS, NUXT_NO_SCRIPTS_PATTERNS, NUXT_PAGE_PATTERNS, NUXT_VIEW_TRANSITIONS } from 'nuxt/internal/renderer-config'
import { entryFileName } from 'nuxt/internal/entry-chunk'

import { renderPayloadJsonScript, renderPayloadScript, splitPayload } from './payload'
import type { NuxtRendererInstance } from './instance'
import type { RendererEvent, RendererRouteRules } from './runtime'

type Resources = Record<string, { file: string, module?: boolean }>

/** Whether a render inlines the styles of its modules. A scriptless one has no chunk to link them from. */
export function inlinesStyles (noScripts: boolean): boolean {
  return NUXT_INLINE_STYLES || ((NUXT_NO_SCRIPTS || NUXT_HAS_NO_SCRIPTS_ROUTES) && noScripts)
}

/** A stylesheet Vite serves inline in development, which needs no link. */
export function isDevInlineStyle (file: string): boolean {
  return !!import.meta.dev && 'inline' in getURLQuery(file)
}

export function pushEntryScripts (ssrContext: NuxtSSRContext, scripts: Resources, rendererContext: RendererContext, tagPosition: 'head' | 'bodyClose' = 'head'): void {
  ssrContext.head.push({
    script: Object.values(scripts).map(resource => (<Script> {
      type: resource.module ? 'module' : null,
      src: rendererContext.buildAssetsURL(resource.file),
      defer: resource.module ? null : true,
      // an async payload the entry imports has to resolve before the entry executes
      tagPosition,
      crossorigin: '',
    })),
  })
}

export function pushPayloadPreload (ssrContext: NuxtSSRContext, href: string | undefined): void {
  ssrContext.head.push({
    link: [
      NUXT_JSON_PAYLOADS
        ? { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href }
        : { rel: 'modulepreload', crossorigin: '', href },
    ],
  })
}

/**
 * The payload, inlined in full or split into the initial state and an external `_payload.json`.
 * `prefetchLinks` is only read from a `_payload.json` another page prefetched, so an inlined
 * payload leaves it out.
 */
export function pushPayloadScript (ssrContext: NuxtSSRContext, inline: boolean, src: string | undefined, routeOptions: RendererRouteRules): void {
  const data = inline ? withoutPrefetchLinks(ssrContext.payload) : splitPayload(ssrContext).initial
  ssrContext.head.push({
    script: NUXT_JSON_PAYLOADS
      ? renderPayloadJsonScript({ ssrContext, data, src: inline ? undefined : src })
      : renderPayloadScript({ ssrContext, data, routeOptions, src: inline ? undefined : src }),
  }, {
    // ahead of any other end of body scripts
    tagPosition: 'bodyClose',
    tagPriority: 'high',
  })
}

function withoutPrefetchLinks (payload: NuxtSSRContext['payload']): NuxtSSRContext['payload'] {
  if (!payload.prefetchLinks) { return payload }
  const { prefetchLinks: _, ...rest } = payload
  return rest
}

/**
 * Routes served without scripts navigate with full-page loads. This emits the
 * declarative navigation hints that speed those up, on both the pages served
 * without scripts (a blanket rule over same-origin links) and scripted pages
 * that may link to them (rules scoped to the `noScripts` route patterns):
 *
 * - speculation rules, so supporting browsers prefetch and prerender the
 *   target ahead of the navigation;
 * - when view transitions are enabled, an opt-in to same-origin cross-document
 *   view transitions, animating the navigation without a client runtime (the
 *   client-side `startViewTransition` plugin is not shipped).
 *
 * Both tags are declarative and execute no JavaScript.
 */
export function pushNoScriptsHints (ssrContext: NuxtSSRContext, noScripts: boolean): void {
  if (noScripts) {
    // scope to same-origin page routes (safe to GET) so we do not prefetch or
    // prerender non-idempotent server routes; fall back to a blanket rule when
    // there are no pages to enumerate (e.g. pages disabled)
    pushSpeculationRulesScript(ssrContext, NUXT_PAGE_PATTERNS.length ? NUXT_PAGE_PATTERNS : ['/*'])
  } else if (NUXT_NO_SCRIPTS_PATTERNS.length) {
    pushSpeculationRulesScript(ssrContext, NUXT_NO_SCRIPTS_PATTERNS)
  } else {
    return
  }
  if (NUXT_VIEW_TRANSITIONS) {
    ssrContext.head.push({
      style: [{
        tagPosition: 'head',
        innerHTML: '@view-transition{navigation:auto}',
      }],
    })
  }
}

function pushSpeculationRulesScript (ssrContext: NuxtSSRContext, patterns: string[]) {
  const rules = patterns.map(href_matches => ({ where: { href_matches }, eagerness: 'moderate' }))
  ssrContext.head.push({
    script: [{
      tagPosition: 'head',
      // unhead's script type union does not yet include 'speculationrules'
      type: 'speculationrules' as any,
      // unhead v3 JSON-stringifies object innerHTML for <script> tags
      innerHTML: {
        prefetch: rules,
        prerender: rules,
      },
    }],
  })
}

const entryPaths = new WeakMap<NuxtRendererInstance, string>()

/** Import map pinning `#entry` to the hashed entry chunk, so chunk hashes stay stable across it. */
export function pushEntryImportMap (instance: NuxtRendererInstance, event: RendererEvent, ssrContext: NuxtSSRContext, options?: Pick<Script, 'tagPosition' | 'tagPriority'>): void {
  let path = entryPaths.get(instance)
  if (!path) {
    path = instance.options.buildAssetsURL(entryFileName!)
    if (ssrContext.runtimeConfig.app.cdnURL || /^(?:\/|\.+\/)/.test(path)) {
      entryPaths.set(instance, path)
    } else {
      // TODO: provide support for relative paths in assets as well
      path = relative(event.url.pathname.replace(/\/[^/]+$/, '/'), joinURL('/', path))
      if (!/^(?:\/|\.+\/)/.test(path)) {
        path = `./${path}`
      }
    }
  }
  ssrContext.head.push({
    script: [{
      ...options,
      type: 'importmap',
      // unhead v3 JSON-stringifies object innerHTML for <script> tags
      innerHTML: { imports: { '#entry': path } },
    }],
  })
}

/** Rendered without `href`, so the browser ignores it until the client activates it. */
export function inertPrefetchLink ({ href, ...link }: Link): Link {
  return { ...link, 'data-href': href } as Link
}
