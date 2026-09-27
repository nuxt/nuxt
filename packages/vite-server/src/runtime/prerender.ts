import { AsyncLocalStorage } from 'node:async_hooks'
import { createError } from 'nuxt/server'
import type { CachedResponse, NuxtRendererOptions } from 'nuxt/internal/renderer/runtime'

/**
 * The capabilities the renderer only has while prerendering. Everything is held in memory:
 * the crawler drives the handler in-process, so nothing outlives the build.
 */
export function createPrerenderOptions (options: { sharedData?: boolean } = {}): NonNullable<NuxtRendererOptions['prerender']> {
  const payloads = new Map<string, CachedResponse>()

  return {
    payloadCache: {
      hasItem: key => payloads.has(key),
      getItem: key => payloads.get(key),
      setItem: (key, value) => void payloads.set(key, value),
    },
    sharedDataCache: options.sharedData === false ? undefined : createSharedDataCache(),
    wrapRender: (event, render) => {
      const renderingURL = event.url.pathname + event.url.search
      const stack = renderingURLs.getStore()
      // a `useFetch`/`$fetch` against the URL currently rendering deadlocks the build:
      // https://github.com/nuxt/nuxt/issues/33871
      if (stack?.includes(renderingURL)) {
        const chain = [...stack, renderingURL].filter(url => !url.startsWith('/__nuxt_error')).map(url => `"${url}"`).join(' -> ')
        throw createError({
          status: 508,
          statusText: `Loop detected while prerendering "${renderingURL}" (${chain}). Check for \`useFetch\`/\`$fetch\` calls targeting a URL that is currently being rendered.`,
        })
      }
      return renderingURLs.run([...stack || [], renderingURL], render)
    },
  }
}

/** URLs rendering in the active async context, oldest first. A repeat entry is a cycle. */
const renderingURLs = new AsyncLocalStorage<readonly string[]>()

function createSharedDataCache (): NonNullable<NuxtRendererOptions['prerender']>['sharedDataCache'] {
  const resolved = new Map<string, Promise<unknown>>()
  const pending = new Map<string, Promise<unknown>>()
  const chains = new Map<string, readonly string[]>()

  return {
    get<T = unknown> (key: string): Promise<T> | undefined {
      const chain = renderingURLs.getStore()
      const setChain = chains.get(key)
      // a pending entry set from a render the caller is nested in would deadlock on itself
      if (chain?.length && setChain?.length && setChain.some(url => chain.includes(url))) {
        return
      }
      return (pending.get(key) ?? resolved.get(key)) as Promise<T> | undefined
    },
    async set<T> (key: string, value: Promise<T>): Promise<void> {
      pending.set(key, value)
      const chain = renderingURLs.getStore()
      if (chain?.length) {
        chains.set(key, chain)
      }
      try {
        resolved.set(key, Promise.resolve(await value))
      } catch {
        // rejections propagate through the original promise; only resolved values are kept
      } finally {
        pending.delete(key)
        chains.delete(key)
      }
    },
  }
}
