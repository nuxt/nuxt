export default {
  name: 'nuxt-link',
  functional: true,
  render (h, { data, children }) {
    return h('router-link', data, children)
  }
}
