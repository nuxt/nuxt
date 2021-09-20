import '#polyfill'
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import { localCall } from '../server'
import { requestHasBody, useRequestBody } from '../server/utils'

const PUBLIC_PATH = process.env.PUBLIC_PATH // Default: /_nuxt/

addEventListener('fetch', (event: any) => {
  event.respondWith(handleEvent(event))
})

async function handleEvent (event) {
  try {
    return await getAssetFromKV(event, { cacheControl: assetsCacheControl })
  } catch (_err) {
    // Ignore
  }

  const url = new URL(event.request.url)

  if (requestHasBody(event.request)) {
    event.request.body = await useRequestBody(event.request)
  }

  const r = await localCall({
    event,
    url: url.pathname + url.search,
    host: url.hostname,
    protocol: url.protocol,
    headers: event.request.headers,
    method: event.request.method,
    redirect: event.request.redirect,
    body: event.request.body
  })

  return new Response(r.body, {
    // @ts-ignore
    headers: r.headers,
    status: r.status,
    statusText: r.statusText
  })
}

function assetsCacheControl (request) {
  if (request.url.includes(PUBLIC_PATH) /* TODO: Check with routerBase */) {
    return {
      browserTTL: 31536000,
      edgeTTL: 31536000
    }
  }
  return {}
}
