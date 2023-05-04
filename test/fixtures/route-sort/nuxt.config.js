export default {
  modules: [
    '@nuxtjs/i18n'
  ],

  router: {
    base: '/',
    extendRoutes (routes, resolve) {
      routes.push({
        name: 'custom',
        path: '*',
        component: resolve(__dirname, 'layouts/error.vue')
      })
    }
  },

  i18n: {
    locales: [
      {
        code: 'en',
        name: 'English',
        file: 'en.json'
      },
      {
        code: 'de',
        name: 'Deutsch',
        file: 'de.json'
      }
    ],
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    vueI18n: {
      fallbackLocale: 'en',
      silentFallbackWarn: true
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'lang'
    },
    vueI18nLoader: true,
    langDir: '~/locales/'
  }
}
