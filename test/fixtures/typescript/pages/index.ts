import Vue, { VNode } from 'vue'

export default Vue.extend({
  name: 'Index',
  data() {
    return {
      message: 'Index Page'
    }
  },
  render(h): VNode {
    return h('div', this.message)
  }
})
