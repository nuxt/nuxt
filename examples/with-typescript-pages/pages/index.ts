import Vue, { VNode } from 'vue'

export default Vue.extend({
  name: 'Index',
  data() {
    return {
      message: 'Default Page'
    }
  },
  render(h): VNode {
    return h('div', this.message)
  }
})
