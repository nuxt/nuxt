// Simple Nuxt Plugin

import Vue from 'vue'

function $reverseStr (str) {
  return str.split('').reverse().join('')
}

Vue.prototype.$reverseStr = $reverseStr

export default undefined

// Legacy support: https://github.com/nuxt/nuxt.js/issues/4350
// <%= _.toUpper('foo') %>
