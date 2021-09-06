<% if (router.scrollBehavior) { %>
<%= isTest ? '/* eslint-disable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
export default <%= serializeFunction(router.scrollBehavior) %>
<%= isTest ? '/* eslint-enable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
<% } else { %>import { getMatchedComponents, setScrollRestoration } from './utils'

if (process.client) {
  if ('scrollRestoration' in window.history) {
    setScrollRestoration('manual')

    // reset scrollRestoration to auto when leaving page, allowing page reload
    // and back-navigation from other pages to use the browser to restore the
    // scrolling position.
    window.addEventListener('beforeunload', () => {
      setScrollRestoration('auto')
    })

    // Setting scrollRestoration to manual again when returning to this page.
    window.addEventListener('load', () => {
      setScrollRestoration('manual')
    })
  }
}

function shouldScrollToTop(route) {
   const Pages = getMatchedComponents(route)
   if (Pages.length === 1) {
     const { options = {} } = Pages[0]
     return options.scrollToTop !== false
   }
   return Pages.some(({ options }) => options && options.scrollToTop)
}

export default function (to, from, savedPosition) {
  // If the returned position is falsy or an empty object, will retain current scroll position
  let position = false
  const isRouteChanged = to !== from

  // savedPosition is only available for popstate navigations (back button)
  if (savedPosition) {
    position = savedPosition
  } else if (isRouteChanged && shouldScrollToTop(to)) {
    position = { x: 0, y: 0 }
  }

  const nuxt = window.<%= globals.nuxt %>

  if (
    // Initial load (vuejs/vue-router#3199)
    !isRouteChanged ||
    // Route hash changes
    (to.path === from.path && to.hash !== from.hash)
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
          const el = document.querySelector(hash)
          if (el) {
            // scroll to anchor by returning the selector
            position = { selector: hash }
            // Respect any scroll-margin-top set in CSS when scrolling to anchor
            const y = Number(getComputedStyle(el)['scroll-margin-top']?.replace('px', ''))
            if (y) {
              position.offset = { y }
            }
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
