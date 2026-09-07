import type { Nuxt } from '@nuxt/schema'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

function escapeAttr (value: string): string {
  return value.replace(/[&<>"]/g, c => ESCAPES[c]!)
}

function renderAttrs (attrs: Record<string, unknown>): string {
  let rendered = ''
  for (const key in attrs) {
    const value = attrs[key]
    if (value === undefined || value === null || value === false) { continue }
    rendered += value === true ? ` ${key}` : ` ${key}="${escapeAttr(String(value))}"`
  }
  return rendered
}

function renderTag (tag: string, input: Record<string, unknown>): string {
  const { innerHTML, children, textContent, ...attrs } = input
  const content = innerHTML ?? children ?? textContent
  const open = `<${tag}${renderAttrs(attrs)}>`
  return VOID_TAGS.has(tag) ? open : `${open}${content ?? ''}</${tag}>`
}

const VOID_TAGS = new Set(['base', 'link', 'meta'])

/**
 * Renders the head entries configured in `app.head`. Anything registered at runtime
 * (`useHead`, `definePageMeta`) is applied by unhead once the app mounts, so it is
 * intentionally absent from the static shell.
 */
function renderConfiguredHead (nuxt: Nuxt): string {
  const head = nuxt.options.app.head
  const tags: string[] = []

  if (head.title) {
    tags.push(`<title>${escapeAttr(head.title)}</title>`)
  }
  if (head.base) {
    tags.push(renderTag('base', head.base as unknown as Record<string, unknown>))
  }
  for (const meta of head.meta || []) {
    tags.push(renderTag('meta', meta as unknown as Record<string, unknown>))
  }
  for (const link of head.link || []) {
    tags.push(renderTag('link', link as unknown as Record<string, unknown>))
  }
  for (const style of head.style || []) {
    tags.push(renderTag('style', style as unknown as Record<string, unknown>))
  }
  for (const script of head.script || []) {
    tags.push(renderTag('script', script as unknown as Record<string, unknown>))
  }
  for (const noscript of head.noscript || []) {
    tags.push(renderTag('noscript', noscript as unknown as Record<string, unknown>))
  }

  return tags.join('')
}

/**
 * The client reads `window.__NUXT__` for public runtime config and to decide whether
 * it is hydrating server-rendered markup.
 */
function renderPayload (nuxt: Nuxt): string {
  const payload = {
    serverRendered: false,
    config: {
      public: nuxt.options.runtimeConfig.public,
      app: nuxt.options.runtimeConfig.app,
    },
  }
  return `<script>window.__NUXT__=${JSON.stringify(payload).replace(/</g, '\\u003C')}</script>`
}

/**
 * Renders the SPA document.
 *
 * Only the app entry is linked: stylesheets, module preloads and the transforms of any
 * configured Vite plugin are added by Vite itself, which owns this document as an HTML
 * build input (and, in dev, transforms it on the way out).
 */
export function renderIndexHtml (nuxt: Nuxt, entry: string, spaLoadingTemplate = ''): string {
  const app = nuxt.options.app
  const rootAttrs = renderAttrs(app.rootAttrs as Record<string, unknown>)
  const teleportAttrs = renderAttrs(app.teleportAttrs as Record<string, unknown>)

  const head = renderConfiguredHead(nuxt)

  const loader = spaLoadingTemplate
    ? `<${app.spaLoaderTag}${renderAttrs(app.spaLoaderAttrs as Record<string, unknown>)}>${spaLoadingTemplate}</${app.spaLoaderTag}>`
    : ''

  // the marker vite's SSR convention (and nitro's own vite integration) renders into, so
  // that a server brought by a plugin can use this document as its template
  const root = nuxt.options.ssr === false ? '' : '<!--ssr-outlet-->'

  const body = [
    `<${app.rootTag}${rootAttrs}>${root}</${app.rootTag}>`,
    loader,
    `<${app.teleportTag}${teleportAttrs}></${app.teleportTag}>`,
    renderPayload(nuxt),
    `<script type="module" src="${escapeAttr(entry)}"></script>`,
  ].join('')

  return [
    '<!DOCTYPE html>',
    `<html${renderAttrs(app.head.htmlAttrs as Record<string, unknown> || {})}>`,
    `<head>${head}</head>`,
    `<body${renderAttrs(app.head.bodyAttrs as Record<string, unknown> || {})}>${body}</body>`,
    '</html>',
  ].join('')
}
