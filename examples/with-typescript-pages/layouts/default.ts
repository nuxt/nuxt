import Vue from 'vue'

export default Vue.extend({
  render(h) {
    return h('div', [
      h('header', 'Header'),
      h('main', [h('nuxt')]),
      h('footer', 'Footer')
    ])
  }
})
