import { definePlugin } from 'nitro'

import { serverDiagnostics } from '../diagnostics.ts'
import { LEGACY_RESPONSE_HOOKS, hasLegacyHookListener, markLegacyHookBridge, observeLegacyHooks } from './hook-registry.ts'
import { isStreamedResponse } from './render-response.ts'

/**
 * Bridge the Nitro v2 response hooks (`request`, `error` and `close` are unchanged in v3).
 *
 * v2 handed them `{ body }`, where v3's `response` hook receives the built `Response`. The
 * body is recovered from a clone for buffered responses; a streamed body, and a
 * replacement written back, cannot be honoured and are reported. A hook writing to the
 * event reaches headers that no longer go to the wire, so those are diffed onto the response.
 */
export default definePlugin((nitroApp) => {
  const hooks = nitroApp.hooks as any
  if (!hooks) {
    return
  }

  markLegacyHookBridge(hooks)
  observeLegacyHooks(hooks)

  const reported = new Set<string>()
  const report = (code: 'NUXT_E8008' | 'NUXT_E8009', hook: string) => {
    const key = `${code}:${hook}`
    if (!reported.has(key)) {
      reported.add(key)
      serverDiagnostics[code]({ hook })
    }
  }

  hooks.hook('response', async (response: Response, event: unknown) => {
    const wanted = LEGACY_RESPONSE_HOOKS.filter(hook => hasLegacyHookListener(hooks, hook))
    if (wanted.length === 0) {
      return
    }

    // the event's headers were drained into the response before this hook ran, so a v2
    // `removeResponseHeader` has nothing to remove until they are seeded back
    const eventHeaders = (event as { res?: { headers?: Headers } } | undefined)?.res?.headers
    let before: HeaderSnapshot | undefined
    if (eventHeaders && typeof eventHeaders.get === 'function') {
      seedHeaders(response.headers, eventHeaders)
      before = snapshotHeaders(eventHeaders)
    }

    // a streamed response is already being written, so its body cannot be read back: a
    // clone tees the source, and reading one branch holds the response until the render
    // ends. A buffered body has no such cost, and carries no `content-length` either
    // until the runtime writes it, so the responses that stream are marked as they are built
    const streamed = isStreamedResponse(response)
    let body: unknown
    if (!streamed) {
      body = await response.clone().text().catch(() => undefined)
    }

    for (const hook of wanted) {
      const legacyResponse = {
        get body () {
          if (streamed) {
            report('NUXT_E8009', hook)
          }
          return body
        },
        set body (value: unknown) {
          if (value !== body) {
            report('NUXT_E8008', hook)
          }
          body = value
        },
        /** The Nitro v3 response, for hooks that need the real thing. */
        response,
      }
      await hooks.callHook(hook, event, legacyResponse)
    }

    if (before && eventHeaders) {
      applyHeaderDelta(before, eventHeaders, response.headers)
    }
  })
})

interface HeaderSnapshot {
  values: Map<string, string>
  cookies: string[]
}

function seedHeaders (source: Headers, target: Headers): void {
  for (const [name, value] of source) {
    if (name !== 'set-cookie' && !target.has(name)) {
      target.set(name, value)
    }
  }
  const existing = target.getSetCookie?.() ?? []
  for (const cookie of source.getSetCookie?.() ?? []) {
    if (!existing.includes(cookie)) {
      target.append('set-cookie', cookie)
    }
  }
}

function snapshotHeaders (headers: Headers): HeaderSnapshot {
  const values = new Map<string, string>()
  for (const [name, value] of headers) {
    if (name !== 'set-cookie') {
      values.set(name, value)
    }
  }
  return { values, cookies: headers.getSetCookie?.() ?? [] }
}

/**
 * Carry what a legacy hook wrote to the event onto the already built response. The hook ran
 * after the handler, as it did in v2, so it wins where both wrote the same header.
 */
function applyHeaderDelta (before: HeaderSnapshot, headers: Headers, target: Headers): void {
  const after = snapshotHeaders(headers)

  for (const [name, value] of after.values) {
    if (before.values.get(name) !== value) {
      target.set(name, value)
    }
  }

  for (const name of before.values.keys()) {
    if (!after.values.has(name)) {
      target.delete(name)
    }
  }

  if (after.cookies.join('\n') !== before.cookies.join('\n')) {
    target.delete('set-cookie')
    for (const cookie of after.cookies) {
      target.append('set-cookie', cookie)
    }
  }
}
