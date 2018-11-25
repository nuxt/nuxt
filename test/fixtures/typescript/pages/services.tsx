import Vue, { VNode } from 'vue'

export default Vue.extend({
  // @ts-ignore
  layout: 'alt',
  name: 'Services',
  data() {
    return {
      message: 'Services Page'
    }
  },
  render(h): VNode {
    return <div>{this.message}</div>
  }
})
