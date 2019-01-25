import * as tsx from 'vue-tsx-support'

export default tsx.component({
  name: 'Title',
  props: {
    label: {
      type: String,
      required: true as true
    }
  },
  render () {
    return <h1>{this.label}</h1>
  }
})
