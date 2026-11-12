import { joinURL } from 'ufo'
import { appId } from '#build/nuxt.config.mjs'
import { baseURL, buildAssetsURL } from '#internal/nuxt/paths'
import { PAGE_HINTS_PREFIX, PRELOAD_MODULE_KEY } from './preload-hints-shared'
import type { ChunkHints, PreloadHint } from './preload-hints-shared'

interface DocumentHints {
  files: PreloadHint[]
  layouts: Record<string, number[]>
  /** Where the hints of the route components of this build are served. */
  pages?: string
}

let documentHints: DocumentHints | null | false | undefined
let pageHints: Promise<ChunkHints | null> | undefined
/** When the hints of route components may be requested again after a failure, and how long the next failure defers that. */
const pageHintsRetry = { after: 0, delay: 1000 }
/** Whether the browser acts on a `<link>` of a given `rel`. */
const relSupport = new Map<string, boolean>()
const requested = new Set<string>()
const fileRetries = new Map<string, { after: number, delay: number }>()
let assetsURL: string | undefined
let nonce: string | null | undefined

/**
 * The hints of the document. `false` where the renderer wrote none, which tells a build that has
 * no hints (with a builder that has not said how it loads its chunks) from one that has: in the
 * latter, `null` stands for hints that cannot be used.
 */
function readDocumentHints (): DocumentHints | null | false {
  if (documentHints !== undefined) {
    return documentHints
  }
  const script = document.querySelector(`script[data-nuxt-preload="${appId}"]`)
  if (!script) {
    return documentHints = false
  }
  let parsed: DocumentHints | null = null
  try {
    const hints = JSON.parse(script.textContent || '')
    parsed = isHints(hints, 'layouts') ? supported(hints as DocumentHints) : null
  } catch {
    // hints that cannot be read are hints that cannot be used
  }
  return documentHints = parsed
}

function loadPageHints (url: string): Promise<ChunkHints | null> {
  // markup injected into the document can point the hints elsewhere
  if (!isPageHintsURL(url)) {
    return Promise.resolve(null)
  }
  // a prefetch that comes too soon after a failed request does without the hints
  if (!pageHints && Date.now() >= pageHintsRetry.after) {
    pageHints = fetch(url, { priority: 'low' })
      .then(response => response.ok
        ? response.json().then(hints => isHints(hints, 'chunks') ? supported(hints as ChunkHints) : null)
        : retryPageHints())
      .catch(retryPageHints)
  }
  return pageHints || Promise.resolve(null)
}

/**
 * A request that failed says nothing about the hints: a connection drops, and a server that is
 * being deployed answers for another build. Kept as the answer, it would leave route components
 * unfetched until the page is reloaded. The hints are asked for again instead, by a later
 * prefetch and after twice as long each time, so that a server in trouble is left alone.
 */
function retryPageHints (): null {
  pageHints = undefined
  pageHintsRetry.after = Date.now() + pageHintsRetry.delay
  pageHintsRetry.delay *= 2
  return null
}

/**
 * Whether a value is shaped like hints: a list of files and a table of indices into it. Anything
 * else served or injected in their place is treated as unusable, rather than failing the
 * prefetch that reads it.
 */
function isHints (value: any, table: 'layouts' | 'chunks'): boolean {
  return Array.isArray(value?.files) && !!value[table] && typeof value[table] === 'object'
}

// A browser that cannot act on a hint fires neither `load` nor `error` for its link, so the
// prefetch that waits for it would never end.
function supported<T extends { files: PreloadHint[] }> (hints: T): T | null {
  for (const file of hints.files) {
    if (!isHint(file)) {
      continue
    }
    const rel = file.rel
    let known = relSupport.get(rel)
    if (known === undefined) {
      known = !!document.createElement('link').relList?.supports?.(rel)
      relSupport.set(rel, known)
    }
    if (!known) {
      return null
    }
  }
  return hints
}

// a `<link>` made from an entry the renderer does not write could apply a stylesheet to the current page
function isHint (hint: any): hint is PreloadHint {
  return !!hint && typeof hint.file === 'string' && !!hint.file && (hint.rel === 'modulepreload'
    ? hint.as === undefined
    : hint.rel === 'preload' && (hint.as === 'script' || hint.as === 'style'))
}

function isPageHintsURL (url: string): boolean {
  try {
    return new URL(url, document.baseURI).href.startsWith(new URL(joinURL(baseURL(), PAGE_HINTS_PREFIX), document.baseURI).href)
  } catch {
    return false
  }
}

// Stylesheets are preloaded rather than prefetched: Firefox holds a `rel="prefetch"` back while
// other preloads are in flight, and a click that needs the file then waits longer than with no
// hint at all.
function preloadFiles (files: PreloadHint[], indices: number[]): Promise<void> {
  assetsURL ??= new URL(buildAssetsURL('/'), document.baseURI).href
  const wanted = new Map<string, PreloadHint>()
  for (const index of indices) {
    const hint = files[index]
    if (!isHint(hint)) {
      continue
    }
    let href: string
    try {
      href = new URL(buildAssetsURL(hint.file), document.baseURI).href
    } catch {
      continue
    }
    // only chunks of this build: a file in the hints could otherwise resolve outside the build assets
    if (href.startsWith(assetsURL) && !requested.has(href) && (fileRetries.get(href)?.after ?? 0) <= Date.now()) {
      wanted.set(href, hint)
    }
  }
  if (!wanted.size) {
    return Promise.resolve()
  }
  // a prefetch of the same file does not count: Safari ignores it, and other browsers merge a hint into it
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[href]:not([rel~="prefetch"])')) {
    if (wanted.delete(link.href)) {
      requested.add(link.href)
    }
  }
  if (wanted.size && nonce === undefined) {
    // the nonce a strict `script-src`/`style-src` policy expects, read where Vite's preload helper reads it
    const meta = document.querySelector<HTMLMetaElement>('meta[property=csp-nonce]')
    nonce = meta?.nonce || meta?.getAttribute('nonce') || null
  }
  const pending: Promise<void>[] = []
  for (const [href, hint] of wanted) {
    const link = document.createElement('link')
    link.rel = hint.rel
    if (hint.as) {
      link.as = hint.as
    }
    // must match the mode of the request the module or stylesheet is later loaded with
    if (!hint.noCors) {
      link.crossOrigin = ''
    }
    link.href = href
    if (nonce) {
      link.setAttribute('nonce', nonce)
    }
    pending.push(new Promise((resolve) => {
      link.addEventListener('load', () => resolve(), { once: true })
      link.addEventListener('error', () => {
        retryFile(link, href)
        resolve()
      }, { once: true })
    }))
    requested.add(href)
    document.head.appendChild(link)
  }
  return Promise.all(pending).then(() => {})
}

/**
 * A hint may fail for a file the deployment does have, such as when a connection drops. Left in
 * the document, its link would keep a later prefetch from asking for the file, which the
 * navigation would then wait for. The link is removed instead, so that a later prefetch asks for
 * the file again, after a delay that doubles with every failure.
 */
function retryFile (link: HTMLLinkElement, href: string): void {
  link.remove()
  requested.delete(href)
  const retry = fileRetries.get(href) || { after: 0, delay: 1000 }
  retry.after = Date.now() + retry.delay
  retry.delay *= 2
  fileRetries.set(href, retry)
}

/**
 * Resolves to `false` only where the build has no hints, in which case the caller loads the layout.
 * Where it has, a layout the hints do not list is left to the navigation rather than loaded, which
 * would run it and apply its styles to the current page.
 *
 * @internal
 */
export async function preloadLayoutChunks (name: string): Promise<boolean> {
  const hints = readDocumentHints()
  if (hints === false) {
    return false
  }
  const indices = hints?.layouts[name]
  if (hints && Array.isArray(indices)) {
    await preloadFiles(hints.files, indices)
  }
  return true
}

/**
 * Start fetching the hints of route components, so the first `<NuxtLink>` prefetch does not wait
 * on a request for them. Once fetched they are cached permanently, as their path names the build.
 *
 * @internal
 */
export function warmRouteChunkHints (): void {
  const hints = readDocumentHints()
  if (hints && hints.pages) {
    void loadPageHints(hints.pages)
  }
}

/**
 * Resolves to `false` only where the build has no hints, as {@link preloadLayoutChunks} does.
 *
 * @internal
 */
export async function preloadRouteChunks (components: unknown[]): Promise<boolean> {
  const documentHints = readDocumentHints()
  if (documentHints === false) {
    return false
  }
  const keys: string[] = []
  for (const component of components) {
    const key = typeof component === 'function' && (component as unknown as Record<string, unknown>)[PRELOAD_MODULE_KEY]
    if (typeof key === 'string') {
      keys.push(key)
    }
  }
  const hints = keys.length && documentHints?.pages ? await loadPageHints(documentHints.pages) : null
  if (hints) {
    const indices = new Set<number>()
    for (const key of keys) {
      const chunks = hints.chunks[key]
      if (Array.isArray(chunks)) {
        for (const index of chunks) {
          indices.add(index)
        }
      }
    }
    await preloadFiles(hints.files, [...indices])
  }
  return true
}
