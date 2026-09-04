import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { createHead } from '@unhead/vue/server'
import type { NuxtPayload, NuxtSSRContext } from '#app/types'
import { sharedPrerenderCache } from '../cache'
import unheadOptions from '#internal/unhead-options.mjs'
import { NUXT_NO_SSR, NUXT_PRERENDER_NO_SSR_ROUTES, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

const PRERENDER_NO_SSR_ROUTES = new Set<string>(NUXT_PRERENDER_NO_SSR_ROUTES)

const ENC_PIPE_RE = /%7C/g
const ENC_BRACKET_OPEN_RE = /%5B/g
const ENC_BRACKET_CLOSE_RE = /%5D/g
const ENC_ENC_SLASH_RE = /%252F/gi
const HASH_RE = /#/g
const QUESTION_MARK_RE = /\?/g

// h3 decodes the path, apart from `%2F`, and vue-router expects an encoded path
function encodeEventPath (path: string): string {
  const queryIndex = path.indexOf('?')
  if (queryIndex === -1) { return encodeVueRouterPath(path) }
  return encodeVueRouterPath(path.slice(0, queryIndex)) + path.slice(queryIndex)
}

// Kept in sync with `unrouting`, which encodes the static segments of route records with the
// same steps. The inputs differ, though: unrouting encodes a filename token, where `%` is a
// literal character, while this encodes an already-decoded URL path, where `%25` means an
// encoded percent. They agree on `&`, `+`, `[`, `]` and `%2F`, and diverge on `%25`, so a page
// file with a literal `%` in its name does not round-trip: h3 v1 decodes requests for both
// `/100%25` and `/100%2525` to the same `event.path`, so the two cannot be told apart here.
function encodeVueRouterPath (path: string): string {
  return encodeURI(path)
    .replace(ENC_PIPE_RE, '|')
    .replace(ENC_BRACKET_OPEN_RE, '[')
    .replace(ENC_BRACKET_CLOSE_RE, ']')
    .replace(HASH_RE, '%23')
    .replace(QUESTION_MARK_RE, '%3F')
    .replace(ENC_ENC_SLASH_RE, '%2F')
}

export function createSSRContext (event: H3Event): NuxtSSRContext {
  const url = encodeEventPath(event.path)
  const ssrContext: NuxtSSRContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig(event) as NuxtSSRContext['runtimeConfig'],
    noSSR: !!(NUXT_NO_SSR) || event.context.nuxt?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head: createHead(unheadOptions),
    error: false,
    nuxt: undefined!, /* NuxtApp */
    payload: {},
    ['~payloadReducers']: Object.create(null),
    modules: new Set(),
  }

  if (import.meta.prerender) {
    if (NUXT_SHARED_DATA) {
      ssrContext['~sharedPrerenderCache'] = sharedPrerenderCache!
    }
    ssrContext.payload.prerenderedAt = Date.now()
  }

  return ssrContext
}

export function setSSRError (ssrContext: NuxtSSRContext, error: NuxtPayload['error'] & { url: string }): void {
  ssrContext.error = true
  ssrContext.payload = { error }
  ssrContext.url = error.url
}
