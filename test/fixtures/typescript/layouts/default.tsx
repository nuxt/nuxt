import Vue, { VNode } from 'vue'

export default Vue.extend({
  name: 'DefaultLayout',
  render(h): VNode {
    return <nuxt />
  }
})
