import { defineNuxtPlugin } from '../nuxt'
import { THROWN_VALUE, isNuxtError } from '../composables/error'

/** Shows the development error overlay on a page that is already open. */
export default defineNuxtPlugin({
  name: 'nuxt:dev-error-overlay',
  setup (nuxtApp) {
    const hot = import.meta.hot
    if (!hot || import.meta.test) { return }

    // a runtime error leaves the app half-rendered, so the page starts over
    let reloadOnClear = false

    const hasOverlay = () => !!document.querySelector('[data-nuxt-dev-error], nuxt-error-overlay')

    const remove = () => {
      for (const node of document.querySelectorAll('[data-nuxt-dev-error]')) {
        node.remove()
      }
    }

    hot.on('nuxt:dev:error', ({ url, reloadOnClear: reload }: { url: string, reloadOnClear?: boolean }) => {
      reloadOnClear = !!reload
      if (hasOverlay()) { return }
      mount(url).catch(() => {})
    })
    hot.on('nuxt:dev:error:clear', () => {
      remove()
      // a page rendered into its error page has nothing to update in place
      if (reloadOnClear || nuxtApp.payload.error) {
        reloadOnClear = false
        window.location.reload()
      }
    })

    // reported once, however many hooks see it
    const reportedObjects = new WeakSet<object>()
    const reportedValues = new Set<unknown>()
    // an error before mount leaves nothing to update in place, so the page reloads on clear
    let mounted = false
    nuxtApp.hook('app:mounted', () => { mounted = true })
    const report = (error: unknown, fatal: boolean) => {
      if (isExpected(error)) { return }
      const raw = unwrap(error)
      const reported = typeof raw === 'object' && raw !== null ? reportedObjects : reportedValues
      if (raw === undefined || reported.has(raw as object)) { return }
      reported.add(raw as object)
      hot.send('nuxt:dev:client-error', {
        ...raw instanceof Error
          ? { name: raw.name, message: raw.message, stack: raw.stack }
          : { name: 'Error', message: `Thrown value: ${describe(raw)}` },
        fatal: fatal || !mounted,
      })
    }

    nuxtApp.hook('vue:error', error => report(error, isNuxtError(error) && !!(error.fatal || error.unhandled)))
    nuxtApp.hook('app:error', error => report(error, true))
    window.addEventListener('error', event => report(event.error, false))
    window.addEventListener('unhandledrejection', event => report(event.reason, false))

    // the report this error page was rendered with may have been retired before it connected
    if (nuxtApp.payload.error) {
      hot.send('nuxt:dev:error:shown', { since: performance.timeOrigin })
    }

    // a route that rendered is not the one the overlay is about
    nuxtApp.hook('page:finish', () => {
      if (!nuxtApp.payload.error) {
        reloadOnClear = false
        remove()
      }
    })

    async function mount (url: string) {
      const html = await fetch(url).then(res => res.ok ? res.text() : undefined)
      if (!html || hasOverlay()) { return }
      const template = document.createElement('template')
      template.innerHTML = html
      for (const node of [...template.content.children]) {
        // scripts parsed from a template do not run; recreate them so they do
        const mounted = node.tagName === 'SCRIPT' ? document.createElement('script') : node
        if (mounted !== node) {
          for (const attribute of node.attributes) {
            mounted.setAttribute(attribute.name, attribute.value)
          }
          mounted.textContent = node.textContent
        }
        mounted.setAttribute('data-nuxt-dev-error', '')
        document.body.append(mounted)
      }
    }
  },
})

function describe (value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/** A handled client error (a 404, a failed validation) is the app working as intended. */
function isExpected (error: unknown): boolean {
  return isNuxtError(error) && !error.unhandled && (error.status || 500) < 500 && !(THROWN_VALUE in error)
}

/** The error as it was thrown: a `NuxtError` wrapper carries the wrapping code's stack. */
function unwrap (error: unknown): unknown {
  if (isNuxtError(error)) {
    return error.cause instanceof Error ? error.cause : THROWN_VALUE in error ? error[THROWN_VALUE as keyof typeof error] : error
  }
  return error
}
