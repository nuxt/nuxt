import type { RenderResponse } from 'nitro/types'
import process from 'node:process'
import devalue from '@nuxt/devalue'
import { stringify, uneval } from 'devalue'
import type { Script } from '@unhead/vue'

import type { NuxtPayload, NuxtSSRContext } from 'nuxt/app'

// @ts-expect-error virtual file
import { appId, multiApp } from '#internal/nuxt.config.mjs'

export function renderPayloadResponse (ssrContext: NuxtSSRContext): RenderResponse {
  return {
    body: process.env.NUXT_JSON_PAYLOADS
      ? stringify(splitPayload(ssrContext).payload, ssrContext['~payloadReducers'])
      : `export default ${devalue(splitPayload(ssrContext).payload)}`,
    status: ssrContext.event.res.status || 200,
    statusText: ssrContext.event.res.statusText || '',
    headers: {
      'content-type': process.env.NUXT_JSON_PAYLOADS ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  }
}

export function renderPayloadJsonScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  const contents = opts.data ? stringify(opts.data, opts.ssrContext['~payloadReducers']) : ''
  const payload: Script = {
    'type': 'application/json',
    'innerHTML': contents,
    'data-nuxt-data': appId,
    'data-ssr': !(process.env.NUXT_NO_SSR || opts.ssrContext.noSSR),
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

export function renderPayloadScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  opts.data.config = opts.ssrContext.config
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !opts.ssrContext.noSSR
  const nuxtData = devalue(opts.data)
  if (_PAYLOAD_EXTRACTION) {
    const singleAppPayload = `import p from "${opts.src}";window.__NUXT__={...p,...(${nuxtData})}`
    const multiAppPayload = `import p from "${opts.src}";window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]={...p,...(${nuxtData})}`
    return [
      {
        type: 'module',
        innerHTML: multiApp ? multiAppPayload : singleAppPayload,
      },
    ]
  }
  const singleAppPayload = `window.__NUXT__=${nuxtData}`
  const multiAppPayload = `window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]=${nuxtData}`
  return [
    {
      innerHTML: multiApp ? multiAppPayload : singleAppPayload,
    },
  ]
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
