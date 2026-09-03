import { defineNuxtPlugin } from '../nuxt'
import { isNuxtError } from '../composables/error'

/**
 * Shows the development error overlay on a page that is already open, for
 * compile failures and for errors the app raises in the browser. The overlay
 * is rendered by the dev server and pushed over the bundler's HMR channel.
 */
export default defineNuxtPlugin({
  name: 'nuxt:dev-error-overlay',
  setup (nuxtApp) {
    const hot = import.meta.hot
    if (!hot || import.meta.test) { return }

    // a runtime error leaves the app half-rendered, so the page starts over
    // once the error is gone
    let reloadOnClear = false

    const remove = () => {
      for (const node of document.querySelectorAll('[data-nuxt-dev-error]')) {
        node.remove()
      }
    }

    hot.on('nuxt:dev:error', ({ html, reloadOnClear: reload }: { html: string, reloadOnClear?: boolean }) => {
      remove()
      reloadOnClear = !!reload
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
    })
    hot.on('nuxt:dev:error:clear', () => {
      remove()
      if (reloadOnClear) {
        reloadOnClear = false
        window.location.reload()
      }
    })

    // an error is reported once, however many hooks see it: `vue:error` for
    // anything uncaught, `app:error` for what the app renders an error page for
    const reported = new WeakSet<Error>()
    const report = (error: unknown) => {
      const raw = unwrap(error)
      if (!(raw instanceof Error) || reported.has(raw)) { return }
      reported.add(raw)
      hot.send('nuxt:dev:client-error', {
        name: raw.name,
        message: raw.message,
        stack: raw.stack,
      })
    }

    nuxtApp.hook('vue:error', report)
    nuxtApp.hook('app:error', report)
  },
})

/**
 * The error as it was thrown. A `NuxtError` wrapper carries the stack of the
 * code that wrapped it rather than the code that failed.
 */
function unwrap (error: unknown): unknown {
  return isNuxtError(error) && error.cause instanceof Error ? error.cause : error
}
