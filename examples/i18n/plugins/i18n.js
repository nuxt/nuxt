import Vue from 'vue'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

export default ({ isClient, app, store, route, error, redirect }) => {
  console.log(route.path)
  if (isClient && route.path === '/fr/about') {
    return redirect('/about')
  }
  console.log(error)
  // Set i18n instance on app
  // This way we can use it in middleware and pages asyncData/fetch
  app.i18n = new VueI18n({
    locale: store.state.locale,
    fallbackLocale: 'en',
    messages: {
      'en': require('~/locales/en.json'),
      'fr': require('~/locales/fr.json')
    }
  })
}
