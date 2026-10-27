import { defineNuxtPlugin } from '../nuxt'
import { THROWN_VALUE, isNuxtError } from '../composables/error'

declare global {
  interface Window {
    /** Set by the dev error badge rendered into the page. */
    __NUXT_DEV_ERROR__?: {
      requestId?: string
      /** Whether the app can update in place once its error clears, rather than reload. */
      recovers?: () => boolean
    }
  }
}

/** Reports the errors the browser raises to the development error channel. */
export default defineNuxtPlugin({
  name: 'nuxt:dev-error-overlay',
  setup (nuxtApp) {
    const hot = import.meta.hot
    if (!hot || import.meta.test) { return }

    const state = window.__NUXT_DEV_ERROR__ ||= {}
    let mounted = false
    let fatal = false
    let reportedHere = false
    nuxtApp.hook('app:mounted', () => { mounted = true })
    // an error before mount, a fatal one, or an error page leaves nothing to update in place
    state.recovers = () => mounted && !fatal && !nuxtApp.payload.error

    // reported once, however many hooks see it
    const reportedObjects = new WeakSet<object>()
    const reportedValues = new Set<unknown>()
    const report = (error: unknown, isFatal: boolean) => {
      if (isExpected(error)) { return }
      const raw = unwrap(error)
      const reported = typeof raw === 'object' && raw !== null ? reportedObjects : reportedValues
      if (raw === undefined || reported.has(raw as object)) { return }
      reported.add(raw as object)
      fatal ||= isFatal || !mounted
      reportedHere = true
      hot.send('nuxt:dev:client-error', {
        ...raw instanceof Error
          ? { name: raw.name, message: raw.message, stack: raw.stack }
          : { name: 'Error', message: `Thrown value: ${describe(raw)}` },
        requestId: state.requestId,
      })
    }

    nuxtApp.hook('vue:error', error => report(error, isNuxtError(error) && !!(error.fatal || error.unhandled)))
    nuxtApp.hook('app:error', error => report(error, true))
    window.addEventListener('error', (event) => {
      // browser notices such as the ResizeObserver loop limit have no error and no source location
      if (event.error === null && !event.lineno) { return }
      report(event.error, false)
    })
    window.addEventListener('unhandledrejection', event => report(event.reason, false))

    // a route that rendered after the error is not the one the report is about
    let reportedBefore = false
    nuxtApp.hook('page:start', () => { reportedBefore = reportedHere })
    nuxtApp.hook('page:finish', () => {
      if (reportedBefore && !nuxtApp.payload.error) {
        fatal = reportedBefore = reportedHere = false
        hot.send('nuxt:dev:client-error:clear', { requestId: state.requestId })
      }
    })
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
