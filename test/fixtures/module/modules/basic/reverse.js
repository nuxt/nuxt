// Simple Nuxt Plugin

import Vue from 'vue'

function $reverseStr(str) {
  return str.split('').reverse().join('')
}

Vue.prototype.$reverseStr = $reverseStr

export default undefined
