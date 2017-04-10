import Vue from 'vue'
import VueI18n from 'vue-i18n'
import store from '~store'

Vue.use(VueI18n)

console.log(store.state.locale)

const i18n = new VueI18n({
  locale: store.state.locale,
  fallbackLocale: 'en-US',
  messages: {
    'en-US': require('~/locales/en-US.json'),
    'fr-FR': require('~/locales/fr-FR.json')
  }
})

export default i18n
