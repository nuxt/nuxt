import { getPrefetchLinks, getPreloadLinks, getRequestDependencies, renderResourceHeaders } from 'vue-bundle-renderer/runtime'
import { renderToWebStream } from 'vue/server-renderer'
import { createBootstrapScript, renderSSRHeadSuspenseChunk, renderShell, renderStreamBodyTags } from '@unhead/vue/stream/server'
import { streamingIifeCode } from '@unhead/vue/stream/iife'
import type { Link } from '@unhead/vue/types'

import type { NuxtPayload, NuxtRenderHTMLContext, NuxtSSRContext } from '#app/types'
import { NUXT_DEFER_PREFETCH_HINTS, NUXT_INLINE_ERROR_RENDERING, NUXT_INLINE_STYLES, NUXT_NO_SCRIPTS_PROD, iifeChunkFileName, renderSSRHeadOptions } from 'nuxt/internal/renderer-config'
import entryIds from 'nuxt/internal/entry-ids'
import { entryFileName } from 'nuxt/internal/entry-chunk'

import { APP_ROOT_CLOSE_TAG, APP_ROOT_OPEN_TAG } from './build-files'
import type { SSRError } from './error'
import { captureError } from './error-page'
import { returnRenderResponse } from './app'
import { applyRenderOptions, joinTags, normalizeChunks, renderAppTeleports, renderDevBadge, renderDocumentOpen } from './document'
import { inertPrefetchLink, inlinesStyles, isDevInlineStyle, pushEntryImportMap, pushEntryScripts, pushNoScriptsHints, pushPayloadPreload, pushPayloadScript } from './head'
import { renderInlineStyles } from './inline-styles'
import { renderPayloadJsonScript } from './payload'
import { renderStreamedIslandTeleports } from './islands'
import { rendererDiagnostics } from './diagnostics'
import { warnNoScriptsClientReliance } from './no-scripts'
import { extractCspNonce } from './csp-nonce'
import { appEvent } from './runtime'
import type { RendererEvent } from './runtime'
import type { NuxtRendererInstance } from './instance'

export interface StreamedRender {
  instance: NuxtRendererInstance
  event: RendererEvent
  ssrContext: NuxtSSRContext
  renderer: Awaited<ReturnType<NuxtRendererInstance['getRenderer']>>
  noScripts: boolean
  ssrError?: SSRError
  payloadExtraction: boolean
  payloadInline: boolean
  payloadURL: string | undefined
}

/** Render a route as a stream: the shell is flushed before the app renders, and the app markup follows as Vue produces it. */
export async function renderStreamedResponse ({ instance, event, ssrContext, renderer, noScripts: NO_SCRIPTS, ssrError, payloadExtraction, payloadInline, payloadURL }: StreamedRender): Promise<Response> {
  const runtime = instance.options
  const hookEvent = appEvent(event)
  const DEFER_PREFETCH = NUXT_DEFER_PREFETCH_HINTS && !NO_SCRIPTS
  const { rendererContext } = renderer

  pushNoScriptsHints(ssrContext, NO_SCRIPTS)

  // 1. Set HTTP Link headers with entry-point preload hints (fastest resource hinting)
  const { link: linkHeader } = renderResourceHeaders({}, rendererContext, { scripts: !NO_SCRIPTS, prefetch: !DEFER_PREFETCH })
  if (linkHeader) {
    event.res.headers.append('link', linkHeader)
  }

  // 2. Push shell head entries (known before rendering)
  const entryInlineStyles = NUXT_INLINE_STYLES
    ? await renderInlineStyles(new Set(entryIds))
    : []
  if (entryInlineStyles.length) {
    ssrContext.head.push({ style: entryInlineStyles })
  }

  const { styles: entryStyles, scripts: entryScripts } = getRequestDependencies({}, rendererContext)
  const shellLinks: Link[] = []
  for (const resource of Object.values(entryStyles)) {
    if (isDevInlineStyle(resource.file)) { continue }
    shellLinks.push({ rel: 'stylesheet', href: rendererContext.buildAssetsURL(resource.file), crossorigin: '' })
  }
  if (shellLinks.length) {
    ssrContext.head.push({ link: shellLinks })
  }

  if (entryFileName && !NO_SCRIPTS) {
    pushEntryImportMap(instance, event, ssrContext)
  }

  if (payloadExtraction && !payloadInline && !NO_SCRIPTS) {
    pushPayloadPreload(ssrContext, payloadURL)
  }

  const entryScriptHrefs = new Set(Object.values(entryScripts).map(resource => rendererContext.buildAssetsURL(resource.file)))
  const entryHints = [
    ...(getPreloadLinks({}, rendererContext, { scripts: !NO_SCRIPTS }) as Link[]).filter(l => !(l.href && entryScriptHrefs.has(l.href))),
    ...(getPrefetchLinks({}, rendererContext, { scripts: !NO_SCRIPTS }) as Link[]).map(l => DEFER_PREFETCH ? inertPrefetchLink(l) : l),
  ]
  if (entryHints.length) {
    ssrContext.head.push({ link: entryHints })
  }

  if (!NO_SCRIPTS) {
    pushEntryScripts(ssrContext, entryScripts, rendererContext)
  }

  // in development the streaming IIFE is inlined instead
  if (!NO_SCRIPTS && !import.meta.dev && iifeChunkFileName) {
    ssrContext.head.push({
      link: [{ rel: 'preload', as: 'script', href: runtime.buildAssetsURL(iifeChunkFileName) }],
    })
  }

  // a response the app chose over the render needs none of the hints sent for the stream
  const renderResponse = (response: Response) => {
    event.res.headers.delete('link')
    return returnRenderResponse(runtime, event, response)
  }

  // 3. Create the Vue app first so plugins (which push critical resource hints, fonts, etc.
  // via `useHead`) get their entries into `ssrContext.head` before the shell consumes them.
  // `createSSRApp` runs plugins and middleware: `navigateTo()` from either throws
  // `skipping render` here, which is caught before committing any bytes.
  const createSSRApp = await instance.getServerApp()
  let vueApp
  try {
    vueApp = await createSSRApp(ssrContext)
  } catch (error: any) {
    if (ssrContext['~renderResponse'] && error?.message === 'skipping render') {
      return renderResponse(ssrContext['~renderResponse'])
    }
    await ssrContext.nuxt?.hooks.callHook('app:error', error)
    throw error
  }
  if (ssrContext['~renderResponse']) {
    return renderResponse(ssrContext['~renderResponse'])
  }

  // 4. Create the Vue stream and pre-read the first chunk. The shell head is rendered
  // afterwards so `useHead` calls in setup land in it.
  const vueStream = renderToWebStream(vueApp, ssrContext)
  const reader = vueStream.getReader()

  // Three things can surface in the first chunk that must short-circuit
  // streaming, since once the shell is on the wire the status is committed:
  //   1. `navigateTo()` from a page `<script setup>` sets `~renderResponse`
  //      during Vue's setup phase - we must return that redirect instead.
  //   2. Fatal errors thrown during initial render - fall through to the
  //      buffered error renderer.
  //   3. `createError({ fatal: true })` populates `payload.error` without
  //      throwing - same as above.
  let firstChunk: Uint8Array | undefined
  try {
    const { done, value } = await reader.read()
    if (!done) { firstChunk = value }
  } catch (error) {
    reader.releaseLock()
    const response = ssrContext['~renderResponse'] as NuxtSSRContext['~renderResponse']
    if (response) {
      return renderResponse(response)
    }
    event.res.headers.delete('link')
    const _err = (!ssrError && ssrContext.payload?.error) || error
    await ssrContext.nuxt?.hooks.callHook('app:error', _err)
    throw _err
  }

  const response = ssrContext['~renderResponse'] as NuxtSSRContext['~renderResponse']
  if (response) {
    reader.cancel().catch(() => {})
    return renderResponse(response)
  }

  if (ssrContext.payload?.error && !ssrError) {
    reader.cancel().catch(() => {})
    event.res.headers.delete('link')
    throw ssrContext.payload.error
  }

  // 5. Render the shell head (atomically renders and clears every entry
  // pushed so far, including those from the synchronous part of setup).
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderShell(ssrContext.head)

  // CSP nonce: streaming emits several inline `<script>`s that bypass unhead
  // (bootstrap queue, IIFE, mid-stream head-push chunks, island relocation), so
  // a strict `script-src 'nonce-…'` policy would block them. Reuse whatever
  // nonce a security module stamped onto the rendered head scripts; if none is
  // present the attribute is omitted and behaviour is unchanged.
  const cspNonce = extractCspNonce(headTags)
  const nonceAttr = cspNonce ? ` nonce="${cspNonce}"` : ''
  const headChunkScript = (chunk: string) => `<script${nonceAttr}>${chunk};document.currentScript.remove()</script>`

  // 6. Fire `render:html` with `streaming: true` on the shell. Changes to
  // `htmlAttrs`/`head`/`bodyAttrs`/`bodyPrepend` land in the shell; `body` and
  // `bodyAppend` are dropped, as the body is about to stream.
  let iifeScript = ''
  if (!NO_SCRIPTS) {
    iifeScript = !import.meta.dev && iifeChunkFileName
      ? `<script async${nonceAttr} src="${runtime.buildAssetsURL(iifeChunkFileName)}"></script>`
      : `<script${nonceAttr}>${streamingIifeCode}</script>`
  }
  const shellContext: NuxtRenderHTMLContext = {
    htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
    head: normalizeChunks([NO_SCRIPTS ? '' : createBootstrapScript(undefined, cspNonce), headTags, import.meta.dev ? await renderDevBadge(runtime, event, NO_SCRIPTS, cspNonce) : undefined]),
    bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
    bodyPrepend: normalizeChunks([iifeScript, bodyTagsOpen]),
    body: [],
    bodyAppend: [],
  }
  const hooks = instance.hooks
  const renderHtmlResult = hooks.callHook('render:html', shellContext, { event: hookEvent, streaming: true })
  if (renderHtmlResult instanceof Promise) { await renderHtmlResult }
  if (import.meta.dev && (shellContext.body.length || shellContext.bodyAppend.length)) {
    rendererDiagnostics.NUXT_E8001({ path: event.url.pathname })
  }

  const shellHtml = renderDocumentOpen(shellContext)

  // Snapshot status + headers before shell commit so we can warn in dev when
  // composables like `useCookie`, `setResponseStatus`, or `useResponseHeader`
  // mutate the response after the wire is closed. These mutations are
  // silently lost in production - the warning is dev-only diagnostic.
  const committedSnapshot = import.meta.dev
    ? {
        status: event.res.status,
        statusText: event.res.statusText,
        headers: serializeHeaders(event.res.headers),
      }
    : null

  // 7. Build the streaming response
  const encoder = new TextEncoder()
  let chunkIndex = 0
  // `enqueueChunk` runs `render:html:chunk` per chunk so listeners can mutate
  // bytes (e.g. CSP nonce injection). Hook implementations should stay
  // synchronous to preserve the TTFB gains.
  const enqueueChunk = (controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array): void | Promise<void> => {
    const chunkContext = { chunk, index: chunkIndex++ }
    const result = hooks.callHook('render:html:chunk', chunkContext, { event: hookEvent })
    if (result instanceof Promise) {
      return result.then(() => { controller.enqueue(chunkContext.chunk) })
    }
    controller.enqueue(chunkContext.chunk)
  }
  const enqueueHeadChunk = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    const headChunk = renderSSRHeadSuspenseChunk(ssrContext.head)
    if (headChunk && !NO_SCRIPTS) {
      await enqueueChunk(controller, encoder.encode(headChunkScript(headChunk)))
    }
  }
  // Route/layout styles. The shell was flushed before render, so it only
  // carries entry-chunk styles; once render has registered the page, layout
  // and (later) async-component modules we emit their styles too - inlined as
  // `<style>` when `inlineStyles` is on (matching the buffered path), otherwise
  // as stylesheet links. They sit after the shell and outside `#__nuxt`, so the
  // browser applies them without a hydration mismatch. Deduped against the
  // entry styles and across calls.
  const emittedStyles = new Set<string>(Object.values(entryStyles).map(r => r.file))
  const inlinedCss = new Set<string>(entryInlineStyles.map(s => String(s.innerHTML)))
  const renderRouteStyles = async (): Promise<string> => {
    let tags = ''
    if (inlinesStyles(NO_SCRIPTS)) {
      for (const style of await renderInlineStyles(ssrContext.modules ?? [])) {
        const css = String(style.innerHTML)
        if (!css || inlinedCss.has(css)) { continue }
        inlinedCss.add(css)
        tags += `<style${nonceAttr}>${css}</style>`
      }
      // a scriptless render inlines only its own modules; the rest still need links
      if (NUXT_INLINE_STYLES) { return tags }
    }
    for (const resource of Object.values(getRequestDependencies(ssrContext, rendererContext).styles)) {
      if (emittedStyles.has(resource.file) || isDevInlineStyle(resource.file)) { continue }
      emittedStyles.add(resource.file)
      tags += `<link rel="stylesheet" crossorigin href="${rendererContext.buildAssetsURL(resource.file)}">`
    }
    return tags
  }

  const outputStream = new ReadableStream<Uint8Array>({
    async start (controller) {
      try {
        // Flush the shell immediately - fastest TTFB is the whole point. Route
        // assets are computed *after* this enqueue so resolving inline styles
        // never delays the shell, then sent before the app root opens.
        await enqueueChunk(controller, encoder.encode(shellHtml))
        await enqueueChunk(controller, encoder.encode((await renderRouteStyles()) + APP_ROOT_OPEN_TAG))
        if (firstChunk) {
          await enqueueChunk(controller, firstChunk)
          await enqueueHeadChunk(controller)
        }

        // Pipe the rest of the Vue stream, injecting head updates from resolved suspense boundaries
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) { break }
            await enqueueChunk(controller, value)
            await enqueueHeadChunk(controller)
          }
        } finally {
          reader.releaseLock()
        }

        // Final head flush - entries pushed after the last suspense boundary
        // resolves (e.g. `bodyClose` scripts via `onPrehydrate`) would otherwise
        // bypass the streaming push pipeline and land as static tags in `</body>`.
        if (!NO_SCRIPTS) {
          await enqueueHeadChunk(controller)
        }

        const appRenderedResult = ssrContext.nuxt?.hooks.callHook('app:rendered', { ssrContext, renderResult: {} as any })
        if (appRenderedResult instanceof Promise) { await appRenderedResult }

        // The HTTP status is already committed (200), so an error here can
        // only reach the client via the payload - the client renders the
        // error page during hydration.
        if (ssrContext.payload?.error && !ssrError) {
          await ssrContext.nuxt?.hooks.callHook('app:error', ssrContext.payload.error)
        }

        if (!NO_SCRIPTS) {
          pushPayloadScript(ssrContext, payloadInline, payloadURL)
        }

        // Render any final head updates (payload scripts, etc.) and fire the
        // streaming `render:html:close` hook so modules can inject final
        // bodyAppend content (analytics tags, end-of-body scripts, etc.).
        const streamBodyTags = renderStreamBodyTags(ssrContext.head)
        const closingHead = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions)
        const closeContext = { bodyAppend: normalizeChunks([streamBodyTags, bodyTags, closingHead.bodyTags]) }
        const closeResult = hooks.callHook('render:html:close', closeContext, { event: hookEvent })
        if (closeResult instanceof Promise) { await closeResult }

        const closingHtml = APP_ROOT_CLOSE_TAG
          // Styles for modules registered after the first chunk (deeply nested
          // async components) - emitted outside the app root.
          + (await renderRouteStyles())
          + renderAppTeleports(ssrContext)
          // the buffered renderer places `<Teleport to="body">` content at
          // `bodyPrepend`, which has already streamed
          + (ssrContext.teleports?.body || '')
          // island teleports cannot be stitched into the streamed body, so they are
          // relocated client-side before the deferred entry hydrates
          + (NO_SCRIPTS ? '' : renderStreamedIslandTeleports(ssrContext, nonceAttr))
          + joinTags(closeContext.bodyAppend)
          + '</body></html>'

        await enqueueChunk(controller, encoder.encode(closingHtml))
        controller.close()

        if (import.meta.dev && !ssrError && !ssrContext.payload?.error) {
          runtime.onRenderSuccess?.(event)
        }

        if (import.meta.dev && NUXT_NO_SCRIPTS_PROD && !NO_SCRIPTS && !ssrError) {
          warnNoScriptsClientReliance(ssrContext, event.url.pathname)
        }

        if (committedSnapshot) {
          const lateMutations: string[] = []
          if (event.res.status !== committedSnapshot.status) {
            lateMutations.push(`response status changed from ${committedSnapshot.status || 200} to ${event.res.status} (e.g. \`setResponseStatus\`)`)
          }
          if (event.res.statusText !== committedSnapshot.statusText) {
            lateMutations.push(`response statusText changed (e.g. \`setResponseStatus\`)`)
          }
          if (serializeHeaders(event.res.headers) !== committedSnapshot.headers) {
            lateMutations.push(`response headers changed during render (e.g. \`useCookie\`, \`useResponseHeader\`, \`setHeader\`)`)
          }
          if (lateMutations.length) {
            rendererDiagnostics.NUXT_E8002({ mutations: lateMutations.join('\n  - '), path: event.url.pathname })
          }
        }
      } catch (error) {
        // Status code is already committed (200) because the shell flushed
        // before this error was thrown. The browser can only learn about the
        // error via hydration - set `payload.error` so the client renders
        // the error page once it picks up the SSR data, then emit a
        // well-formed closing so HTML parsing doesn't choke.
        if (NUXT_INLINE_ERROR_RENDERING) {
          await captureError(runtime, event, error, ['streaming'])
        }
        await Promise.resolve(ssrContext.nuxt?.hooks.callHook('app:error', error)).catch(() => {})
        ssrContext.payload ||= {} as NuxtPayload
        ssrContext.payload.error ||= error as any
        try {
          if (!NO_SCRIPTS) {
            ssrContext.head.push({
              script: renderPayloadJsonScript({ ssrContext, data: ssrContext.payload }),
            }, { tagPosition: 'bodyClose', tagPriority: 'high' })
          }
          // a tag getter that throws on the error's broken state must not take
          // the payload script with it - the client needs it to render the
          // error page
          let headChunk: string | undefined
          try {
            headChunk = renderSSRHeadSuspenseChunk(ssrContext.head)
          } catch (error) {
            rendererDiagnostics.NUXT_E8009({
              path: event.url.pathname,
              what: 'flushing the head tags registered after the shell',
              cause: String(error),
            })
          }
          if (headChunk && !NO_SCRIPTS) {
            controller.enqueue(encoder.encode(headChunkScript(headChunk)))
          }
          const streamBodyTags = renderStreamBodyTags(ssrContext.head)
          const tail = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions)
          controller.enqueue(encoder.encode(streamBodyTags + tail.bodyTags))
        } catch (error) {
          rendererDiagnostics.NUXT_E8009({
            path: event.url.pathname,
            what: 'rendering the closing HTML that carries the page error',
            cause: String(error),
          })
        }
        controller.enqueue(encoder.encode(APP_ROOT_CLOSE_TAG + '</body></html>'))
        controller.close()
      }
    },
    cancel (reason) {
      // Client disconnected (or downstream cancelled). Stop Vue from rendering,
      // otherwise it keeps walking the component tree until completion,
      // burning CPU/memory on abandoned requests.
      reader.cancel(reason).catch(() => {})
    },
  })

  event.res.headers.set('content-type', 'text/html;charset=utf-8')
  event.res.headers.set('x-powered-by', 'Nuxt')

  return runtime.createResponse(outputStream, event.res)
}

function serializeHeaders (headers: Headers): string {
  return Array.from(headers.entries()).sort().map(([k, v]) => `${k}: ${v}`).join('\n')
}
