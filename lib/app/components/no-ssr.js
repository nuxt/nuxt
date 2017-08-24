/*
** From https://github.com/egoist/vue-no-ssr
** With the authorization of @egoist
*/
export default {
  name: 'no-ssr',
  props: ['placeholder'],
  data () {
    return {
      canRender: false
    }
  },
  mounted () {
    this.canRender = true
  },
  render (h) {
    if (this.canRender) {
      if (
        process.env.NODE_ENV === 'development' &&
        this.$slots.default.length > 1
      ) {
        throw new Error('<no-ssr> You cannot use multiple child components')
      }
      return this.$slots.default[0]
    }
    return h('div', { class: { 'no-ssr-placeholder': true } }, this.placeholder)
  }
}
