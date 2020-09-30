<% if (router.scrollBehavior) { %>
<%= isTest ? '/* eslint-disable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
export default <%= serializeFunction(router.scrollBehavior) %>
<%= isTest ? '/* eslint-enable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
<% } else { %>import { getMatchedComponents } from './utils'

if (process.client) {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'

    // reset scrollRestoration to auto when leaving page, allowing page reload
    // and back-navigation from other pages to use the browser to restore the
    // scrolling position.
    window.addEventListener('beforeunload', () => {
      window.history.scrollRestoration = 'auto'
    })

    // Setting scrollRestoration to manual again when returning to this page.
    window.addEventListener('load', () => {
      window.history.scrollRestoration = 'manual'
    })
  }
}

  export default function (to, from, savedPosition) {
  // If the returned position is falsy or an empty object, will retain current scroll position
  let position = false

  const Pages = getMatchedComponents(to)

  // Scroll to the top of the page if...
  if (
      // One of the children set `scrollToTop`
      Pages.some(Page => Page.options.scrollToTop) ||
      // scrollToTop set in only page without children
      (Pages.length < 2 && Pages.every(Page => Page.options.scrollToTop !== false))
  ) {
    position = { x: 0, y: 0 }
  }

  // savedPosition is only available for popstate navigations (back button)
  if (savedPosition) {
    position = savedPosition
  }

  const nuxt = window.<%= globals.nuxt %>

  if (
    // Route hash changes
    (to.path === from.path && to.hash !== from.hash) ||
    // Initial load (vuejs/vue-router#3199)
    to === from
  ) {
    nuxt.$nextTick(() => nuxt.$emit('triggerScroll'))
  }

  return new Promise((resolve) => {
    // wait for the out transition to complete (if necessary)
    nuxt.$once('triggerScroll', () => {
      // coords will be used if no selector is provided,
      // or if the selector didn't match any element.
      if (to.hash) {
        let hash = to.hash
        // CSS.escape() is not supported with IE and Edge.
        if (typeof window.CSS !== 'undefined' && typeof window.CSS.escape !== 'undefined') {
          hash = '#' + window.CSS.escape(hash.substr(1))
        }
        try {
          if (document.querySelector(hash)) {
            // scroll to anchor by returning the selector
            position = { selector: hash }
          }
        } catch (e) {
          <%= isTest ? '// eslint-disable-next-line no-console' : '' %>
          console.warn('Failed to save scroll position. Please add CSS.escape() polyfill (https://github.com/mathiasbynens/CSS.escape).')
        }
      }
      resolve(position)
    })
  })
}
<% } %>
