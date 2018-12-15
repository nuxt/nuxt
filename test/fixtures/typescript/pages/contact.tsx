import Vue from 'vue'

export default Vue.extend({
  name: 'Contact',
  data () {
    return {
      message: 'Contact Page'
    }
  },
  render () {
    return <div>{this.message}</div>
  }
})
