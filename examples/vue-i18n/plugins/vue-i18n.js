import Vue from 'vue'

if (process.BROWSER_BUILD) {
  var VueI18n = require('vue-i18n')
  Vue.use(VueI18n)
}
