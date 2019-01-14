export default {
  head: {
    titleTemplate: '%s - NuxtJS Prefetching',
    htmlAttrs: { lang: 'en' },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ],
    // Support polyfill for browsers that don't support it (Safari Mobile for example)
    script: [
      { src: 'https://polyfill.io/v2/polyfill.min.js?features=IntersectionObserver', body: true }
    ]
  },
  router: {
    // To disable prefetching, uncomment the line
    // prefetchLinks: false

    // Activate prefetched class (default: false)
    // Used to display the check mark next to the prefetched link
    linkPrefetchedClass: 'nuxt-link-prefetched'
  }
}
