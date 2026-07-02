import { AsyncLocalStorage } from 'node:async_hooks'
import { HTTPError } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

/**
 * Stack of URLs currently rendering in the active async context (oldest first).
 * A repeated entry signals a render cycle.
 */
export const renderingURLs: AsyncLocalStorage<readonly string[]> = new AsyncLocalStorage()

function withoutSearch (url: string) {
  const searchIndex = url.indexOf('?')
  return searchIndex === -1 ? url : url.slice(0, searchIndex)
}

export async function renderWithRenderStack<T> (event: H3Event, render: () => Promise<T>): Promise<T> {
  // Refuse to recurse into a URL that is already rendering higher in the same
  // call chain. Without this, a `useFetch`/`$fetch` against an app-rendered URL
  // can repeatedly re-enter the renderer until the server runs out of memory.
  const renderingURL = event.url.pathname + event.url.search
  const stack = renderingURLs.getStore()
  if (stack?.includes(renderingURL)) {
    const renderingPath = event.url.pathname
    const chain = [...stack, renderingURL]
      .map(withoutSearch)
      .filter(url => !url.startsWith('/__nuxt_error'))
      .map(url => `"${url}"`)
      .join(' -> ')
    const rendering = import.meta.prerender ? 'prerendering' : 'rendering'
    const message = `Loop detected while ${rendering} "${renderingPath}" (${chain}). Check for \`useFetch\`/\`$fetch\` calls targeting a URL that is currently being rendered.`
    throw new HTTPError({
      status: 508,
      statusText: message,
      message,
    })
  }
  const result = await renderingURLs.run([...(stack || []), renderingURL], render)
  return result
}
