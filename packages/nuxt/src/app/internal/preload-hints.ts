import { joinURL } from 'ufo'
import { appId } from '#build/nuxt.config.mjs'
import { baseURL, buildAssetsURL } from '#internal/nuxt/paths'
import { HINTS_PREFIX, PRELOAD_MODULE_KEY } from './preload-hints-shared'
import type { PreloadHint, RouteChunkHints } from './preload-hints-shared'

interface DocumentHints {
  url?: string
}

let documentHints: DocumentHints | false | undefined
let buildHints: Promise<RouteChunkHints | null> | undefined
const hintsRetry = { after: 0, delay: 1000 }
const relSupport = new Map<string, boolean>()
const requested = new Set<string>()
const fileRetries = new Map<string, { after: number, delay: number }>()
let preloadFailed = false
const preloadFailureListeners: Array<() => void> = []
let assetsURL: string | undefined
let nonce: string | null | undefined

// `false` in a build without hints, where the renderer writes nothing
function readDocumentHints (): DocumentHints | false {
  if (documentHints !== undefined) {
    return documentHints
  }
  const script = document.querySelector(`script[data-nuxt-preload="${appId}"]`)
  if (!script) {
    return documentHints = false
  }
  const parsed: DocumentHints = {}
  try {
    const url = JSON.parse(script.textContent || '')?.url
    // markup injected into the document can point the hints elsewhere
    if (typeof url === 'string' && isHintsURL(url)) {
      parsed.url = url
    }
  } catch {
    // what cannot be read says nothing of where the hints are
  }
  return documentHints = parsed
}

function loadHints (): Promise<RouteChunkHints | null> {
  const url = (readDocumentHints() as DocumentHints).url
  if (!url) {
    return Promise.resolve(null)
  }
  if (!buildHints && Date.now() >= hintsRetry.after) {
    buildHints = fetch(url, { priority: 'low' })
      .then(response => response.ok
        ? response.json().then(hints => isHints(hints) ? supported(hints as RouteChunkHints) : null)
        : retryHints())
      .catch(retryHints)
  }
  return buildHints || Promise.resolve(null)
}

// a failed request is not kept as the answer: a later prefetch asks again, with the delay doubled
function retryHints (): null {
  buildHints = undefined
  hintsRetry.after = Date.now() + hintsRetry.delay
  hintsRetry.delay *= 2
  return null
}

function isHints (value: any): boolean {
  return Array.isArray(value?.files) && isTable(value.layouts) && isTable(value.pages)
}

function isTable (value: unknown): boolean {
  return !!value && typeof value === 'object'
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

function isHintsURL (url: string): boolean {
  try {
    return new URL(url, document.baseURI).href.startsWith(new URL(joinURL(baseURL(), HINTS_PREFIX), document.baseURI).href)
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
        if (hint.rel === 'modulepreload') {
          retryFile(link, href)
        } else {
          failPreload()
        }
        resolve()
      }, { once: true })
    }))
    requested.add(href)
    document.head.appendChild(link)
  }
  return Promise.all(pending).then(() => {})
}

// left in the document, the link would keep a later prefetch from asking for the file again
function retryFile (link: HTMLLinkElement, href: string): void {
  link.remove()
  requested.delete(href)
  const retry = fileRetries.get(href) || { after: 0, delay: 1000 }
  retry.after = Date.now() + retry.delay
  retry.delay *= 2
  fileRetries.set(href, retry)
}

function failPreload (): void {
  if (preloadFailed) {
    return
  }
  preloadFailed = true
  for (const listener of preloadFailureListeners.splice(0)) {
    listener()
  }
}

/**
 * Chromium keeps a failed `rel="preload"` for as long as the document lives, and answers every
 * later request for the file with it.
 *
 * @internal
 */
export function onFailedPreload (listener: () => void): void {
  if (preloadFailed) {
    listener()
  } else {
    preloadFailureListeners.push(listener)
  }
}

/**
 * Resolves to `false` only where the build has no hints, in which case the caller loads the layout.
 * Where it has, a layout the hints do not list is left to the navigation rather than loaded, which
 * would run it and apply its styles to the current page.
 *
 * @internal
 */
export async function preloadLayoutChunks (name: string): Promise<boolean> {
  if (readDocumentHints() === false) {
    return false
  }
  const hints = await loadHints()
  const indices = hints?.layouts[name]
  if (hints && Array.isArray(indices)) {
    await preloadFiles(hints.files, indices)
  }
  return true
}

/** @internal */
export function warmRouteChunkHints (): void {
  if (readDocumentHints() !== false) {
    void loadHints()
  }
}

/**
 * Resolves to `false` only where the build has no hints, as {@link preloadLayoutChunks} does.
 *
 * @internal
 */
export async function preloadRouteChunks (components: unknown[]): Promise<boolean> {
  if (readDocumentHints() === false) {
    return false
  }
  const keys: string[] = []
  for (const component of components) {
    const key = typeof component === 'function' && (component as unknown as Record<string, unknown>)[PRELOAD_MODULE_KEY]
    if (typeof key === 'string') {
      keys.push(key)
    }
  }
  const hints = keys.length ? await loadHints() : null
  if (hints) {
    const indices = new Set<number>()
    for (const key of keys) {
      const chunks = hints.pages[key]
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
