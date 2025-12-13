import type { RenderResponse } from 'nitropack/types'
import process from 'node:process'
import { getResponseStatus, getResponseStatusText } from 'h3'
import devalue from '@nuxt/devalue'
import { stringify, uneval } from 'devalue'
import type { Script } from '@unhead/vue'

import type { NuxtSSRContext } from 'nuxt/app'

// @ts-expect-error virtual file
import { appId, multiApp } from '#internal/nuxt.config.mjs'

export function renderPayloadResponse (ssrContext: NuxtSSRContext) {
  const payload = { [appId]: splitPayload(ssrContext).payload }
  return {
    body: process.env.NUXT_JSON_PAYLOADS
      ? stringify(payload, ssrContext._payloadReducers)
      : `export default ${devalue(payload)}`,
    statusCode: getResponseStatus(ssrContext.event),
    statusMessage: getResponseStatusText(ssrContext.event),
    headers: {
      'content-type': process.env.NUXT_JSON_PAYLOADS ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
      'x-powered-by': 'Nuxt',
    },
  } satisfies RenderResponse
}

export function renderPayloadJsonScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  const payloadData = opts.data ? { [appId]: opts.data } : null
  const contents = payloadData ? stringify(payloadData, opts.ssrContext._payloadReducers) : ''
  const payloadScript: Script = {
    'type': 'application/json',
    'innerHTML': contents,
    'data-nuxt-data': appId,
    'data-ssr': !(process.env.NUXT_NO_SSR || opts.ssrContext.noSSR),
  }
  if (!multiApp) {
    payloadScript.id = '__NUXT_DATA__'
  }
  if (opts.src) {
    payloadScript['data-src'] = opts.src
  }
  const config = uneval(opts.ssrContext.config)
  return [
    payloadScript,
    {
      innerHTML: `window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]=Object.assign(window.__NUXT__[${JSON.stringify(appId)}]||{}, {config:${config}})`,
    },
  ]
}

export function renderPayloadScript (opts: { ssrContext: NuxtSSRContext, data?: any, src?: string }): Script[] {
  const appPayload = { ...(opts.data || {}), config: opts.ssrContext.config }
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !opts.ssrContext.noSSR
  const nuxtData = devalue(appPayload)
  if (_PAYLOAD_EXTRACTION) {
    return [
      {
        type: 'module',
        innerHTML: `import p from "${opts.src}";const a=(p&&p[${JSON.stringify(appId)}])||{};window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]={...a,...(${nuxtData})}`,
      },
    ]
  }
  return [
    {
      innerHTML: `window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]=${nuxtData}`,
    },
  ]
}

export function splitPayload (ssrContext: NuxtSSRContext) {
  const { data, prerenderedAt, ...initial } = ssrContext.payload
  return {
    initial: { ...initial, prerenderedAt },
    payload: { data, prerenderedAt },
  }
}
