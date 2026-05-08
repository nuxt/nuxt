import type { RenderResponse } from 'nitro/types'
import { stringify, uneval } from 'devalue'
import type { Script } from '@unhead/vue'

import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'

// @ts-expect-error virtual file
import { appId, multiApp } from '#internal/nuxt.config.mjs'
// @ts-expect-error virtual file
import { NUXT_NO_SSR } from '#internal/nuxt/nitro-config.mjs'

export function renderPayloadResponse (ssrContext: NuxtSSRContext): RenderResponse {
  return {
    body: encodeForwardSlashes(stringify(splitPayload(ssrContext).payload, ssrContext['~payloadReducers'])),
    status: ssrContext.event.res.status || 200,
    statusText: ssrContext.event.res.statusText || '',
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  }
}

export function renderPayloadJsonScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  const contents = opts.data ? encodeForwardSlashes(stringify(opts.data, opts.ssrContext['~payloadReducers'])) : ''
  const payload: Script = {
    'type': 'application/json',
    'innerHTML': contents,
    'data-nuxt-data': appId,
    'data-ssr': !(NUXT_NO_SSR || opts.ssrContext.noSSR),
  }
  if (!multiApp) {
    payload.id = '__NUXT_DATA__'
  }
  if (opts.src) {
    payload['data-src'] = opts.src
  }
  const config = uneval(opts.ssrContext.config)
  return [
    payload,
    {
      innerHTML: multiApp
        ? `window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]={config:${config}}`
        : `window.__NUXT__={};window.__NUXT__.config=${config}`,
    },
  ]
}

/**
 * Encode forward slashes as unicode escape sequences to prevent
 * Google from treating them as internal links and trying to crawl them.
 * @see https://github.com/nuxt/nuxt/issues/24175
 */
function encodeForwardSlashes (str: string): string {
  return str.replaceAll('/', '\\u002F')
}

interface SplitPayload {
  initial: Omit<NuxtPayload, 'data'>
  payload: {
    data?: NuxtPayload['data']
    prerenderedAt?: NuxtPayload['prerenderedAt']
  }
}

export function splitPayload (ssrContext: NuxtSSRContext): SplitPayload {
  const { data, prerenderedAt, ...initial } = ssrContext.payload
  return {
    initial: { ...initial, prerenderedAt },
    payload: { data, prerenderedAt },
  }
}
