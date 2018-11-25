import Vue, { VNode } from 'vue'

export default Vue.extend({
  name: 'About',
  data() {
    return {
      message: 'About Page'
    }
  },
  render(h): VNode {
    return <div>{this.message}</div>
  }
})
